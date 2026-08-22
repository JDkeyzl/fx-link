const { z } = require("zod");
const { tool } = require("@langchain/core/tools");
const {
  getDeskDb,
  getSession,
  saveRequirements,
  getQuote,
  upsertQuoteLine,
  removeQuoteLine,
  upsertContact,
  getContact,
} = require("./desk-db");
const { searchKnowledge } = require("./desk-rag");

const REQUIREMENT_KEYS = [
  "brand",
  "vehicle_model",
  "destination",
  "incoterm",
  "quantity_notes",
  "quality_preference",
  "contact_hint",
  "other_notes",
];

const DEFAULT_USD_CNY_RATE = 7.2;

function readUsdCnyRate(rateStmt) {
  const row = rateStmt.get();
  const rate = Number.parseFloat(String(row?.value ?? String(DEFAULT_USD_CNY_RATE)));
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_CNY_RATE;
}

/** DB `parts.price` is CNY EXW reference; USD = CNY / usd_cny_rate (same as web). */
function priceFields(cnyRaw, usdCnyRate) {
  const cny = Number(cnyRaw);
  const safeCny = Number.isFinite(cny) ? cny : 0;
  const usd = safeCny / usdCnyRate;
  return {
    price_cny_exw_reference: Number(safeCny.toFixed(2)),
    price_usd_exw_reference: Number(usd.toFixed(2)),
    usd_cny_rate: Number(usdCnyRate.toFixed(6)),
    price_basis: "CNY in catalogue; USD converted by CNY / usd_cny_rate",
    disclaimer:
      "EXW China reference only; not a binding offer. Always present both CNY and USD to the customer.",
  };
}

function makePartTools(sessionId) {
  const db = getDeskDb();

  const lookupStmt = db.prepare(`
    SELECT part_no, brand, name_ch, name_en, name_fr, name_ar, price, image_path
    FROM parts WHERE part_no = ?
  `);

  const searchStmt = db.prepare(`
    SELECT part_no, brand, name_ch, name_en, name_fr, name_ar, price, image_path
    FROM parts
    WHERE
      lower(part_no) = lower(@q)
      OR lower(part_no) LIKE lower(@q) || '%'
      OR instr(lower(part_no), lower(@q)) > 0
      OR instr(lower(name_ch), lower(@q)) > 0
      OR instr(lower(name_en), lower(@q)) > 0
    ORDER BY
      CASE
        WHEN lower(part_no) = lower(@q) THEN 0
        WHEN lower(part_no) LIKE lower(@q) || '%' THEN 1
        ELSE 2
      END,
      part_no
    LIMIT @limit
  `);

  const rateStmt = db.prepare(
    `SELECT value FROM app_settings WHERE key = 'usd_cny_rate' LIMIT 1`
  );

  const lookup_part = tool(
    async ({ part_no }) => {
      const key = String(part_no || "").trim().slice(0, 64);
      if (!key) return JSON.stringify({ found: false, error: "empty part_no" });
      const row = lookupStmt.get(key);
      if (!row) {
        return JSON.stringify({
          found: false,
          part_no: key,
          message: "Part not found in catalogue. Do not invent a price.",
        });
      }
      const rate = readUsdCnyRate(rateStmt);
      return JSON.stringify({
        found: true,
        part_no: row.part_no,
        brand: row.brand,
        name_ch: row.name_ch,
        name_en: row.name_en,
        name_fr: row.name_fr,
        name_ar: row.name_ar,
        ...priceFields(row.price, rate),
      });
    },
    {
      name: "lookup_part",
      description:
        "Exact part number lookup in SQLite catalogue. Returns CNY catalogue price and USD converted by usd_cny_rate. Always use before quoting.",
      schema: z.object({
        part_no: z.string().describe("Exact OEM / aftermarket part number"),
      }),
    }
  );

  const search_parts = tool(
    async ({ query, limit }) => {
      const q = String(query || "").trim().slice(0, 120);
      const lim = Math.min(20, Math.max(1, Number(limit) || 8));
      if (q.length < 2) {
        return JSON.stringify({
          items: [],
          error: "Query must be at least 2 characters",
        });
      }
      const rate = readUsdCnyRate(rateStmt);
      const rows = searchStmt.all({ q, limit: lim });
      return JSON.stringify({
        query: q,
        count: rows.length,
        usd_cny_rate: Number(rate.toFixed(6)),
        items: rows.map((r) => ({
          part_no: r.part_no,
          brand: r.brand,
          name_en: r.name_en,
          name_ch: r.name_ch,
          ...priceFields(r.price, rate),
        })),
        disclaimer:
          "EXW China reference only. Catalogue stores CNY; USD = CNY / usd_cny_rate. Quote both currencies.",
      });
    },
    {
      name: "search_parts",
      description:
        "Fuzzy search parts by part number or name (min 2 chars). Each hit includes CNY + USD EXW reference.",
      schema: z.object({
        query: z.string().describe("Part number fragment or keyword"),
        limit: z.number().optional().describe("Max rows, default 8"),
      }),
    }
  );

  const get_fx_rate = tool(
    async () => {
      const rate = readUsdCnyRate(rateStmt);
      return JSON.stringify({
        usd_cny_rate: Number(rate.toFixed(6)),
        formula: "USD = CNY / usd_cny_rate",
        note: "Catalogue parts.price is CNY EXW reference. Convert to USD with this rate; always show both CNY and USD when quoting.",
      });
    },
    {
      name: "get_fx_rate",
      description:
        "Read USD/CNY rate used to convert catalogue CNY prices into USD (USD = CNY / rate).",
      schema: z.object({}),
    }
  );

  const update_requirement_card = tool(
    async (fields) => {
      const session = getSession(sessionId);
      if (!session) {
        return JSON.stringify({ ok: false, error: "session not found" });
      }
      const next = { ...session.requirements };
      for (const key of REQUIREMENT_KEYS) {
        const v = fields?.[key];
        if (v === undefined || v === null) continue;
        const s = String(v).trim().slice(0, 500);
        if (!s) continue;
        next[key] = s;
      }
      saveRequirements(sessionId, next);
      return JSON.stringify({ ok: true, requirements: next });
    },
    {
      name: "update_requirement_card",
      description:
        "Update structured RFQ fields collected from the customer (brand, vehicle, destination, incoterm, qty notes, etc.).",
      schema: z.object({
        brand: z.string().optional(),
        vehicle_model: z.string().optional(),
        destination: z.string().optional(),
        incoterm: z.string().optional(),
        quantity_notes: z.string().optional(),
        quality_preference: z.string().optional(),
        contact_hint: z.string().optional(),
        other_notes: z.string().optional(),
      }),
    }
  );

  const search_knowledge = tool(
    async ({ query, limit }) => {
      const result = searchKnowledge(String(query || "").slice(0, 300), {
        limit: limit || 4,
      });
      return JSON.stringify(result);
    },
    {
      name: "search_knowledge",
      description:
        "RAG search over internal export/trade knowledge (Incoterms, RFQ checklist, quality tiers, talk tracks). Use for process questions. NEVER use this for part prices — use lookup_part/search_parts instead.",
      schema: z.object({
        query: z
          .string()
          .describe("Question about Incoterms, RFQ process, quality tiers, etc."),
        limit: z.number().optional().describe("Max snippets, default 4"),
      }),
    }
  );

  const upsert_quote_line = tool(
    async ({ part_no, qty }) => {
      const key = String(part_no || "").trim().slice(0, 64);
      const quantity = Number(qty);
      if (!key) {
        return JSON.stringify({ ok: false, error: "part_no required" });
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return JSON.stringify({
          ok: false,
          error: "qty must be a positive number",
        });
      }
      const row = lookupStmt.get(key);
      if (!row) {
        return JSON.stringify({
          ok: false,
          error:
            "Part not found in catalogue. Cannot add to quote. Do not invent a price.",
          part_no: key,
        });
      }
      const rate = readUsdCnyRate(rateStmt);
      const prices = priceFields(row.price, rate);
      const result = upsertQuoteLine(sessionId, {
        part_no: row.part_no,
        brand: row.brand,
        name_en: row.name_en,
        name_ch: row.name_ch,
        qty: quantity,
        unit_price_cny: prices.price_cny_exw_reference,
        unit_price_usd: prices.price_usd_exw_reference,
      });
      return JSON.stringify({
        ...result,
        disclaimer:
          "EXW China reference draft only. Customer must submit for sales review in the UI — you cannot submit or approve.",
      });
    },
    {
      name: "upsert_quote_line",
      description:
        "Add or update a quote draft line. Only pass part_no and qty — unit prices are loaded from the catalogue (CNY+USD). Fails if part not found or quote is locked (pending review / approved).",
      schema: z.object({
        part_no: z.string().describe("Exact catalogue part number"),
        qty: z.number().describe("Quantity (positive)"),
      }),
    }
  );

  const remove_quote_line = tool(
    async ({ part_no }) => {
      const result = removeQuoteLine(sessionId, part_no);
      return JSON.stringify(result);
    },
    {
      name: "remove_quote_line",
      description:
        "Remove a part from the quote draft by part_no. Fails if quote is locked.",
      schema: z.object({
        part_no: z.string().describe("Part number to remove from draft"),
      }),
    }
  );

  const get_quote_draft = tool(
    async () => {
      const quote = getQuote(sessionId);
      return JSON.stringify({
        ok: true,
        quote,
        note: "Customer submits for sales review in the UI. Present both CNY and USD totals.",
      });
    },
    {
      name: "get_quote_draft",
      description: "Read the current EXW reference quote draft for this session.",
      schema: z.object({}),
    }
  );

  const upsert_contact = tool(
    async ({ name, email, phone, company }) => {
      const payload = {};
      if (name !== undefined) payload.name = name;
      if (email !== undefined) payload.email = email;
      if (phone !== undefined) payload.phone = phone;
      if (company !== undefined) payload.company = company;
      const result = upsertContact(sessionId, payload, { merge: true });
      return JSON.stringify({
        ...result,
        note: "Contact saved for sales review. Customer still must click Submit for review in the UI.",
      });
    },
    {
      name: "upsert_contact",
      description:
        "Save or update customer contact (name, email, phone/WhatsApp, company) into the structured contact form. Prefer this over contact_hint. Pass only fields the customer provided.",
      schema: z.object({
        name: z.string().optional().describe("Customer or buyer name"),
        email: z.string().optional().describe("Email address"),
        phone: z
          .string()
          .optional()
          .describe("Phone or WhatsApp number"),
        company: z.string().optional().describe("Company name"),
      }),
    }
  );

  const get_contact = tool(
    async () => {
      const contact = getContact(sessionId);
      return JSON.stringify({ ok: true, contact });
    },
    {
      name: "get_contact",
      description: "Read the structured contact details saved for this session.",
      schema: z.object({}),
    }
  );

  return [
    lookup_part,
    search_parts,
    get_fx_rate,
    update_requirement_card,
    search_knowledge,
    upsert_quote_line,
    remove_quote_line,
    get_quote_draft,
    upsert_contact,
    get_contact,
  ];
}

module.exports = { makePartTools, REQUIREMENT_KEYS };
