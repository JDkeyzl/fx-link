"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/context/LocaleContext";
import {
  getPersonaPromptKeys,
  pickRandomPersona,
  type DeskPersonaId,
} from "@/data/deskPromptExamples";

const SESSION_KEY = "crealink.desk.sessionId";
const MAX_INPUT = 4000;

type ChatMessage = {
  role: string;
  content: string;
};

type Requirements = Record<string, string>;

type QuoteLine = {
  id?: number;
  part_no: string;
  brand?: string | null;
  name_en?: string | null;
  name_ch?: string | null;
  qty: number;
  unit_price_cny: number;
  unit_price_usd: number;
  line_total_cny: number;
  line_total_usd: number;
};

type DeskQuote = {
  sessionId?: string;
  status: string;
  usd_cny_rate: number;
  confirmed_at?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  lines: QuoteLine[];
  totals: { cny: number; usd: number; line_count: number };
};

type DeskContact = {
  name: string;
  email: string;
  phone: string;
  company: string;
  updated_at?: string | null;
};

function emptyQuote(): DeskQuote {
  return {
    status: "draft",
    usd_cny_rate: 7.2,
    confirmed_at: null,
    submitted_at: null,
    reviewed_at: null,
    review_note: null,
    lines: [],
    totals: { cny: 0, usd: 0, line_count: 0 },
  };
}

function emptyContact(): DeskContact {
  return { name: "", email: "", phone: "", company: "", updated_at: null };
}

function quoteStatusLabelKey(status: string): string {
  if (status === "pending_review") return "desk.quote.pending_review";
  if (status === "approved" || status === "confirmed") return "desk.quote.approved";
  if (status === "rejected") return "desk.quote.rejected";
  return "desk.quote.draft";
}

function isQuoteLockedStatus(status: string): boolean {
  return (
    status === "pending_review" ||
    status === "approved" ||
    status === "confirmed"
  );
}

const REQ_ORDER = [
  "brand",
  "vehicle_model",
  "destination",
  "incoterm",
  "quantity_notes",
  "quality_preference",
  "contact_hint",
  "other_notes",
] as const;

export default function DeskPageClient() {
  const { t } = useI18n();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [requirements, setRequirements] = useState<Requirements>({});
  const [quote, setQuote] = useState<DeskQuote>(emptyQuote);
  const [contact, setContact] = useState<DeskContact>(emptyContact);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactSavedFlash, setContactSavedFlash] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<DeskPersonaId>(() =>
    pickRandomPersona()
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filledCount = useMemo(
    () => REQ_ORDER.filter((k) => requirements[k]?.trim()).length,
    [requirements]
  );

  const persistSession = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(SESSION_KEY, id);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const applySessionPayload = useCallback(
    (data: {
      sessionId?: string;
      requirements?: Requirements;
      messages?: ChatMessage[];
      quote?: DeskQuote;
      contact?: DeskContact;
    }) => {
      if (data.sessionId) {
        setSessionId(data.sessionId);
        persistSession(data.sessionId);
      }
      if (data.requirements) setRequirements(data.requirements);
      if (data.quote) setQuote(data.quote);
      if (data.contact) {
        setContact({
          name: data.contact.name || "",
          email: data.contact.email || "",
          phone: data.contact.phone || "",
          company: data.contact.company || "",
          updated_at: data.contact.updated_at || null,
        });
      }
      if (Array.isArray(data.messages)) {
        setMessages(
          data.messages.map((m) => ({
            role: m.role,
            content: m.content,
          }))
        );
      }
    },
    [persistSession]
  );

  const createSession = useCallback(async () => {
    const res = await fetch("/api/desk/session", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Session failed");
    setMessages([]);
    setRequirements({});
    setQuote(data.quote || emptyQuote());
    setContact(data.contact || emptyContact());
    setError(null);
    applySessionPayload(data);
    return data.sessionId as string;
  }, [applySessionPayload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved =
          typeof window !== "undefined"
            ? localStorage.getItem(SESSION_KEY)
            : null;
        if (saved) {
          const res = await fetch(`/api/desk/session/${encodeURIComponent(saved)}`);
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) applySessionPayload(data);
            return;
          }
          localStorage.removeItem(SESSION_KEY);
        }
        if (!cancelled) await createSession();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Boot failed");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [applySessionPayload, createSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading || booting) return;
    if (text.length > MAX_INPUT) {
      setError(t("desk.errorTooLong"));
      return;
    }

    setLoading(true);
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      let sid = sessionId;
      if (!sid) sid = await createSession();

      const res = await fetch("/api/desk/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, message: text }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          persistSession(null);
          setSessionId(null);
        }
        throw new Error(data.message || data.error || "Chat failed");
      }
      applySessionPayload(data);
      if (data.quote) setQuote(data.quote);
      if (data.contact) {
        setContact({
          name: data.contact.name || "",
          email: data.contact.email || "",
          phone: data.contact.phone || "",
          company: data.contact.company || "",
          updated_at: data.contact.updated_at || null,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function onNewChat() {
    abortRef.current?.abort();
    setLoading(false);
    setBooting(true);
    try {
      persistSession(null);
      await createSession();
      setPersonaId(pickRandomPersona());
    } catch (err) {
      setError(err instanceof Error ? err.message : "New chat failed");
    } finally {
      setBooting(false);
    }
  }

  function shufflePersona() {
    setPersonaId((prev) => pickRandomPersona(prev));
  }

  async function saveContactForm() {
    if (!sessionId || contactBusy) return;
    setContactBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/desk/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save contact failed");
      if (data.contact) setContact({ ...emptyContact(), ...data.contact });
      if (data.requirements) setRequirements(data.requirements);
      if (data.quote) setQuote(data.quote);
      setContactSavedFlash(true);
      window.setTimeout(() => setContactSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save contact failed");
    } finally {
      setContactBusy(false);
    }
  }

  async function submitQuoteForReview() {
    if (!sessionId || quoteBusy || isQuoteLockedStatus(quote.status)) return;
    if (!quote.lines.length) {
      setError(t("desk.quote.emptyConfirm"));
      return;
    }
    if (!contact.email.trim()) {
      setError(t("desk.quote.needEmail"));
      return;
    }
    if (!window.confirm(t("desk.quote.submitPrompt"))) return;
    setQuoteBusy(true);
    setError(null);
    try {
      // Persist contact first so email is on the server
      const contactRes = await fetch("/api/desk/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
        }),
      });
      const contactData = await contactRes.json();
      if (!contactRes.ok) {
        throw new Error(contactData.error || t("desk.quote.needEmail"));
      }
      if (contactData.contact) {
        setContact({ ...emptyContact(), ...contactData.contact });
      }

      const res = await fetch("/api/desk/quote/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      if (data.quote) setQuote(data.quote);
      if (data.contact) setContact({ ...emptyContact(), ...data.contact });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setQuoteBusy(false);
    }
  }

  async function removeQuoteLineRow(partNo: string) {
    if (!sessionId || quoteBusy || isQuoteLockedStatus(quote.status)) return;
    setQuoteBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/desk/quote/line/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, part_no: partNo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      if (data.quote) setQuote(data.quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setQuoteBusy(false);
    }
  }

  const personaKeys = useMemo(
    () => getPersonaPromptKeys(personaId),
    [personaId]
  );

  const quoteLocked = isQuoteLockedStatus(quote.status);
  const canSubmitQuote =
    !quoteLocked &&
    (quote.status === "draft" || quote.status === "rejected") &&
    quote.lines.length > 0;

  return (
    <div className="box-border flex h-full min-h-0 flex-col px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[#002d54] md:text-2xl">
              {t("desk.title")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">
              {t("desk.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onNewChat()}
              disabled={loading || booting}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#002d54] hover:bg-zinc-50 disabled:opacity-50"
            >
              {t("desk.newChat")}
            </button>
            <Link
              href="/"
              className="text-sm font-medium text-[#002d54] underline decoration-[#002d54]/30 underline-offset-2 hover:text-[#e31d22]"
            >
              {t("desk.backHome")}
            </Link>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:col-span-8">
            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 sm:px-5"
              aria-live="polite"
            >
              {booting ? (
                <div className="space-y-2" aria-busy="true">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 max-w-[70%] animate-pulse rounded-xl bg-zinc-100"
                    />
                  ))}
                </div>
              ) : null}
              {!booting && messages.length === 0 && !loading ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-600">
                  <p className="font-medium text-[#002d54]">
                    {t("desk.emptyTitle")}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#002d54] ring-1 ring-[#002d54]/15">
                      {t(personaKeys.labelKey)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {t("desk.examples.personaHint")}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {personaKeys.promptKeys.map((key) => (
                      <li key={key}>
                        <button
                          type="button"
                          disabled={loading || booting}
                          onClick={() => void send(t(key))}
                          className="max-w-full w-fit rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm leading-snug text-zinc-800 transition hover:border-[#002d54]/35 hover:bg-[#f0f4f8] disabled:opacity-50"
                        >
                          {t(key)}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={shufflePersona}
                    disabled={loading || booting}
                    className="mt-3 text-xs font-medium text-[#002d54] underline decoration-[#002d54]/30 underline-offset-2 hover:text-[#e31d22] disabled:opacity-50"
                  >
                    {t("desk.examples.shuffle")}
                  </button>
                </div>
              ) : null}
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[66.666%] w-fit whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-zinc-100 text-zinc-900"
                        : "bg-transparent px-0 text-zinc-900"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 px-0 py-2 text-sm text-zinc-600">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#002d54]" />
                    {t("desk.thinking")}
                  </div>
                </div>
              ) : null}
              {/* Spacer so last bubble clears the sticky input when scrolled to end */}
              <div ref={bottomRef} className="h-2 shrink-0" aria-hidden />
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-white">
              {error ? (
                <div
                  className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <form
                className="p-3 sm:p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <textarea
                      value={input}
                      onChange={(e) =>
                        setInput(e.target.value.slice(0, MAX_INPUT))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      placeholder={t("desk.placeholder")}
                      rows={2}
                      className="max-h-28 min-h-[52px] w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002d54]"
                      disabled={loading || booting}
                      autoComplete="off"
                      maxLength={MAX_INPUT}
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {t("desk.inputHint")}
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || booting || !input.trim()}
                    className="btn-primary-portal h-[44px] shrink-0 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                  >
                    {t("desk.send")}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className="min-h-0 space-y-4 overflow-y-auto overscroll-contain lg:col-span-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[#002d54]">
                {t("desk.contact.title")}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                {t("desk.contact.hint")}
              </p>
              <div className="mt-3 space-y-2">
                {(
                  [
                    ["name", "desk.contact.name"],
                    ["email", "desk.contact.email"],
                    ["phone", "desk.contact.phone"],
                    ["company", "desk.contact.company"],
                  ] as const
                ).map(([field, labelKey]) => (
                  <label key={field} className="block text-xs">
                    <span className="font-medium text-zinc-600">
                      {t(labelKey)}
                      {field === "email" ? " *" : ""}
                    </span>
                    <input
                      type={field === "email" ? "email" : "text"}
                      value={contact[field]}
                      disabled={contactBusy || quoteLocked}
                      onChange={(e) =>
                        setContact((c) => ({ ...c, [field]: e.target.value }))
                      }
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#002d54] disabled:bg-zinc-50"
                      autoComplete={
                        field === "email"
                          ? "email"
                          : field === "name"
                            ? "name"
                            : field === "phone"
                              ? "tel"
                              : "organization"
                      }
                    />
                  </label>
                ))}
                <p className="text-[11px] text-zinc-500">
                  {t("desk.contact.emailRequired")}
                </p>
                <button
                  type="button"
                  disabled={contactBusy || quoteLocked || !sessionId}
                  onClick={() => void saveContactForm()}
                  className="w-full rounded-xl border border-[#002d54]/25 bg-white py-2 text-sm font-semibold text-[#002d54] hover:bg-[#f0f4f8] disabled:opacity-50"
                >
                  {contactSavedFlash
                    ? t("desk.contact.saved")
                    : t("desk.contact.save")}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#002d54]">
                  {t("desk.requirementsTitle")}
                </h2>
                <span className="text-xs text-zinc-500">
                  {filledCount}/{REQ_ORDER.length}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-[#002d54] transition-all"
                  style={{
                    width: `${(filledCount / REQ_ORDER.length) * 100}%`,
                  }}
                />
              </div>
              <ul className="mt-4 space-y-3">
                {REQ_ORDER.map((key) => {
                  const value = requirements[key]?.trim();
                  return (
                    <li key={key} className="text-sm">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            value ? "bg-emerald-500" : "bg-zinc-300"
                          }`}
                        />
                        {t(`desk.fields.${key}`)}
                      </div>
                      <div className="mt-0.5 text-zinc-900">
                        {value || (
                          <span className="text-zinc-400">
                            {t("desk.fieldEmpty")}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#002d54]">
                  {t("desk.quote.title")}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    quote.status === "approved" || quote.status === "confirmed"
                      ? "bg-emerald-50 text-emerald-800"
                      : quote.status === "pending_review"
                        ? "bg-sky-50 text-sky-800"
                        : quote.status === "rejected"
                          ? "bg-red-50 text-red-800"
                          : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {t(quoteStatusLabelKey(quote.status))}
                </span>
              </div>
              {quote.lines.length === 0 ? (
                <p className="mt-3 text-xs text-zinc-500">
                  {t("desk.quote.empty")}
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
                    {quote.lines.map((line) => (
                      <li
                        key={line.part_no}
                        className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-[11px] text-[#002d54]">
                              {line.part_no}
                            </div>
                            <div className="mt-0.5 truncate text-zinc-700">
                              {line.name_en || line.name_ch || "—"}
                            </div>
                            <div className="mt-1 text-zinc-600">
                              ×{line.qty} · ¥{line.unit_price_cny.toFixed(2)} / $
                              {line.unit_price_usd.toFixed(2)}
                            </div>
                            <div className="font-medium text-zinc-900">
                              ¥{line.line_total_cny.toFixed(2)} · $
                              {line.line_total_usd.toFixed(2)}
                            </div>
                          </div>
                          {!quoteLocked ? (
                            <button
                              type="button"
                              disabled={quoteBusy}
                              onClick={() =>
                                void removeQuoteLineRow(line.part_no)
                              }
                              className="shrink-0 text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50"
                            >
                              {t("desk.quote.remove")}
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-zinc-100 pt-2 text-xs">
                    <div className="flex justify-between font-semibold text-[#002d54]">
                      <span>{t("desk.quote.totals")}</span>
                      <span>
                        ¥{quote.totals.cny.toFixed(2)} · $
                        {quote.totals.usd.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {t("desk.quote.rateNote", {
                        rate: quote.usd_cny_rate,
                      })}
                    </p>
                    {quote.submitted_at ? (
                      <p className="mt-1 text-[11px] text-sky-800">
                        {t("desk.quote.submittedAt", {
                          time: quote.submitted_at,
                        })}
                      </p>
                    ) : null}
                    {quote.reviewed_at ? (
                      <p className="mt-1 text-[11px] text-emerald-700">
                        {t("desk.quote.reviewedAt", {
                          time: quote.reviewed_at,
                        })}
                      </p>
                    ) : null}
                    {quote.status === "rejected" && quote.review_note ? (
                      <p className="mt-1 text-[11px] text-red-700">
                        {t("desk.quote.rejectNote", {
                          note: quote.review_note,
                        })}
                      </p>
                    ) : null}
                  </div>
                  {canSubmitQuote ? (
                    <button
                      type="button"
                      disabled={quoteBusy || !quote.lines.length}
                      onClick={() => void submitQuoteForReview()}
                      className="btn-primary-portal w-full rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {t("desk.quote.submitBtn")}
                    </button>
                  ) : null}
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                {t("desk.quote.disclaimer")}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-950">
              {t("desk.disclaimer")}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
