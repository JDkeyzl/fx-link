require("dotenv").config();

const { ChatOpenAI } = require("@langchain/openai");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { makePartTools } = require("./desk-tools");
const {
  createSession,
  getSession,
  listMessages,
  appendMessage,
  getQuote,
  getContact,
} = require("./desk-db");
const { ragStatus } = require("./desk-rag");

const MAX_MESSAGE_CHARS = Number(process.env.DESK_MAX_MESSAGE_CHARS || 4000);
const AGENT_TIMEOUT_MS = Number(process.env.DESK_AGENT_TIMEOUT_MS || 90000);
const HISTORY_TURNS = Number(process.env.DESK_HISTORY_TURNS || 16);

const SYSTEM_PROMPT = `You are CreaLink Chat — a China heavy-truck parts export assistant for RFQ workflows.

Goals:
1) Clarify customer requirements (brand, vehicle, part numbers, qty, destination, Incoterm).
2) Look up the catalogue with lookup_part / search_parts before stating any price.
3) For trade terms, RFQ process, quality-tier explanations, call search_knowledge (RAG). Never use RAG for inventing prices or part numbers.
4) Give procurement-oriented advice; require customer confirmation on substitutes.
5) Never invent part numbers or prices. If not found, say so clearly.
6) Catalogue DB stores **CNY** EXW reference. Tools also return **USD** via USD = CNY / usd_cny_rate. When quoting, always show **both CNY and USD** (and mention the rate if helpful). Do not treat the raw DB number as USD.
7) Prices are EXW China reference only — not a binding commercial offer.
8) Reply in the same language the customer is currently using.
9) When you learn structured fields, call update_requirement_card.
10) When the customer gives contact details (name, email, phone/WhatsApp, company), call upsert_contact. Prefer upsert_contact over contact_hint.
11) To add lines to the formal quote draft panel, call upsert_quote_line(part_no, qty). Unit prices are loaded from the catalogue inside the tool — never invent unit prices. Use remove_quote_line / get_quote_draft as needed.
12) Submitting for sales review and sales approval are **UI / sales actions only**. Never claim the quote is submitted, approved, or locked. Tell the customer to fill contact (email required) and click Submit for review on the quote panel.
13) Keep answers concise and actionable for export sales.
14) If knowledge base returns empty, say you lack internal docs for that topic rather than fabricating policy.`;

function getLlm() {
  const apiKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "Missing LLM_API_KEY (or DEEPSEEK_API_KEY). Set it in server/.env"
    );
    err.code = "LLM_CONFIG";
    throw err;
  }
  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com";
  const model = process.env.LLM_MODEL || "deepseek-chat";

  return new ChatOpenAI({
    apiKey,
    model,
    temperature: 0.2,
    timeout: AGENT_TIMEOUT_MS,
    maxRetries: 1,
    configuration: { baseURL },
  });
}

function historyToMessages(rows) {
  const out = [];
  for (const row of rows) {
    if (row.role === "user") out.push(new HumanMessage(row.content));
    else if (row.role === "assistant") out.push(new AIMessage(row.content));
  }
  return out.slice(-HISTORY_TURNS);
}

function extractTextContent(msg) {
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((c) => (typeof c === "string" ? c : c?.text || ""))
      .join("");
  }
  return "";
}

function buildToolTrace(resultMessages) {
  return resultMessages
    .filter((m) => {
      const t = m?._getType?.() || m?.constructor?.name || "";
      return (
        String(t).toLowerCase().includes("tool") ||
        m?.name ||
        (Array.isArray(m?.tool_calls) && m.tool_calls.length)
      );
    })
    .slice(-12)
    .map((m) => ({
      type: m?._getType?.() || m?.constructor?.name,
      name: m?.name || (m?.tool_calls?.[0]?.name ?? null),
      content:
        typeof m?.content === "string"
          ? m.content.slice(0, 600)
          : JSON.stringify(m?.content || m?.tool_calls || "").slice(0, 600),
    }));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = "TIMEOUT";
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runDeskTurn({ sessionId, message }) {
  const text = String(message || "").trim();
  if (!text) {
    const err = new Error("message is required");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    const err = new Error(
      `message too long (max ${MAX_MESSAGE_CHARS} characters)`
    );
    err.code = "BAD_REQUEST";
    throw err;
  }

  let session = sessionId ? getSession(sessionId) : null;
  if (sessionId && !session) {
    const err = new Error("session not found");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!session) {
    session = createSession();
  }

  appendMessage(session.id, "user", text);

  const tools = makePartTools(session.id);
  const agent = createReactAgent({
    llm: getLlm(),
    tools,
    prompt: SYSTEM_PROMPT,
  });

  const history = historyToMessages(listMessages(session.id, 40));

  let result;
  try {
    result = await withTimeout(
      agent.invoke(
        { messages: history },
        { recursionLimit: 12 }
      ),
      AGENT_TIMEOUT_MS,
      "desk agent"
    );
  } catch (err) {
    appendMessage(
      session.id,
      "assistant",
      err.code === "TIMEOUT"
        ? "The desk timed out while contacting the model or tools. Please retry with a shorter message."
        : "The desk failed to complete this turn. Please retry."
    );
    throw err;
  }

  const resultMessages = result.messages || [];
  const lastAi = [...resultMessages]
    .reverse()
    .find((m) => AIMessage.isInstance(m) || m?._getType?.() === "ai");

  let reply = extractTextContent(lastAi);
  if (!reply) {
    reply =
      "I could not generate a reply. Please try again or check LLM configuration.";
  }

  const toolTrace = buildToolTrace(resultMessages);
  appendMessage(session.id, "assistant", reply, toolTrace);

    const fresh = getSession(session.id);
  return {
    sessionId: session.id,
    reply,
    requirements: fresh?.requirements || {},
    quote: getQuote(session.id),
    contact: getContact(session.id),
    toolTrace,
    rag: ragStatus(),
    messages: listMessages(session.id, 80),
  };
}

module.exports = { runDeskTurn, getLlm, MAX_MESSAGE_CHARS };
