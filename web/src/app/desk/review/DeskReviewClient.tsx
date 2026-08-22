"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/context/LocaleContext";

const ADMIN_KEY_STORAGE = "crealink.desk.review.adminKey";

type LeadItem = {
  sessionId: string;
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  contact: {
    name: string;
    email: string;
    phone: string;
    company: string;
  };
  totals: { cny: number; usd: number; line_count: number };
};

type LeadDetail = {
  sessionId: string;
  requirements: Record<string, string>;
  contact: LeadItem["contact"];
  quote: {
    status: string;
    lines: Array<{
      part_no: string;
      name_en?: string | null;
      qty: number;
      unit_price_cny: number;
      unit_price_usd: number;
      line_total_cny: number;
      line_total_usd: number;
    }>;
    totals: { cny: number; usd: number; line_count: number };
    submitted_at?: string | null;
    reviewed_at?: string | null;
    review_note?: string | null;
    usd_cny_rate?: number;
  };
  messages: Array<{ role: string; content: string }>;
};

function statusBadgeClass(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-800";
  if (status === "pending_review") return "bg-sky-50 text-sky-800";
  if (status === "rejected") return "bg-red-50 text-red-800";
  return "bg-amber-50 text-amber-900";
}

export default function DeskReviewClient() {
  const { t } = useI18n();
  const [adminKey, setAdminKey] = useState("");
  const [keyReady, setKeyReady] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
      if (saved) setAdminKey(saved);
    } catch {
      /* ignore */
    }
    setKeyReady(true);
  }, []);

  const authHeaders = useCallback((): HeadersInit => {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
      "x-admin-upload-key": adminKey,
    };
  }, [adminKey]);

  const persistKey = () => {
    try {
      sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
    } catch {
      /* ignore */
    }
  };

  const loadList = useCallback(async () => {
    if (!adminKey.trim()) {
      setError(t("desk.review.needKey"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/desk/review/leads?${params}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unauthorized");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [adminKey, authHeaders, q, statusFilter, t]);

  const loadDetail = useCallback(
    async (sessionId: string) => {
      setSelectedId(sessionId);
      setDetail(null);
      setNote("");
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/desk/review/leads/${encodeURIComponent(sessionId)}`,
          { headers: authHeaders(), cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Detail failed");
        setDetail(data as LeadDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Detail failed");
      } finally {
        setBusy(false);
      }
    },
    [authHeaders]
  );

  async function decide(decision: "approved" | "rejected") {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/desk/review/leads/${encodeURIComponent(selectedId)}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ decision, note }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Decision failed");
      await loadList();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  if (!keyReady) {
    return (
      <div className="px-4 py-8 text-sm text-zinc-500">{t("desk.review.loading")}</div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#002d54] md:text-2xl">
              {t("desk.review.title")}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">{t("desk.review.subtitle")}</p>
          </div>
          <Link
            href="/desk"
            className="text-sm font-medium text-[#002d54] underline decoration-[#002d54]/30 underline-offset-2"
          >
            {t("desk.review.openChat")}
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-medium text-zinc-600">
            {t("desk.review.adminKey")}
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
              autoComplete="off"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                persistKey();
                void loadList();
              }}
              className="rounded-xl bg-[#002d54] px-4 py-2 text-sm font-semibold text-white"
            >
              {t("desk.review.unlock")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-zinc-600">
            {t("desk.review.filterStatus")}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="pending_review">{t("desk.quote.pending_review")}</option>
              <option value="approved">{t("desk.quote.approved")}</option>
              <option value="rejected">{t("desk.quote.rejected")}</option>
              <option value="all">{t("desk.review.statusAll")}</option>
            </select>
          </label>
          <label className="min-w-[200px] flex-1 text-xs font-medium text-zinc-600">
            {t("desk.review.search")}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="email / name / phone"
            />
          </label>
          <button
            type="button"
            disabled={loading || !adminKey.trim()}
            onClick={() => void loadList()}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#002d54] disabled:opacity-50"
          >
            {t("desk.review.refresh")}
          </button>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:col-span-5">
            <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-zinc-500">
              {t("desk.review.listTitle")} ({items.length})
            </div>
            <ul className="max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto">
              {loading ? (
                <li className="px-3 py-4 text-sm text-zinc-500">
                  {t("desk.review.loading")}
                </li>
              ) : null}
              {!loading && items.length === 0 ? (
                <li className="px-3 py-4 text-sm text-zinc-500">
                  {t("desk.review.empty")}
                </li>
              ) : null}
              {items.map((item) => (
                <li key={item.sessionId}>
                  <button
                    type="button"
                    onClick={() => void loadDetail(item.sessionId)}
                    className={`w-full px-3 py-3 text-left text-sm hover:bg-zinc-50 ${
                      selectedId === item.sessionId ? "bg-[#f0f4f8]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#002d54]">
                        {item.contact.name || item.contact.email || "—"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-600">
                      {item.contact.email || "—"}
                      {item.contact.phone ? ` · ${item.contact.phone}` : ""}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {item.totals.line_count} lines · ¥
                      {item.totals.cny.toFixed(2)} · $
                      {item.totals.usd.toFixed(2)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-7">
            {!detail ? (
              <p className="text-sm text-zinc-500">{t("desk.review.selectHint")}</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#002d54]">
                    {t("desk.review.detailTitle")}
                  </h2>
                  <p className="mt-1 font-mono text-[11px] text-zinc-500">
                    {detail.sessionId}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-50 p-3 text-sm">
                  <div className="font-medium text-[#002d54]">
                    {t("desk.contact.title")}
                  </div>
                  <dl className="mt-2 grid gap-1 text-xs text-zinc-700 sm:grid-cols-2">
                    <div>
                      {t("desk.contact.name")}: {detail.contact.name || "—"}
                    </div>
                    <div>
                      {t("desk.contact.email")}: {detail.contact.email || "—"}
                    </div>
                    <div>
                      {t("desk.contact.phone")}: {detail.contact.phone || "—"}
                    </div>
                    <div>
                      {t("desk.contact.company")}:{" "}
                      {detail.contact.company || "—"}
                    </div>
                  </dl>
                </div>

                <div>
                  <div className="text-xs font-semibold text-zinc-500">
                    {t("desk.requirementsTitle")}
                  </div>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                    {Object.entries(detail.requirements || {}).map(
                      ([k, v]) =>
                        v ? (
                          <li key={k}>
                            <span className="text-zinc-500">{k}:</span> {v}
                          </li>
                        ) : null
                    )}
                  </ul>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-500">
                      {t("desk.quote.title")}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                        detail.quote.status
                      )}`}
                    >
                      {detail.quote.status}
                    </span>
                  </div>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">
                    {(detail.quote.lines || []).map((line) => (
                      <li
                        key={line.part_no}
                        className="rounded-lg border border-zinc-100 px-2 py-1.5"
                      >
                        <div className="font-mono text-[#002d54]">
                          {line.part_no}
                        </div>
                        <div>
                          {line.name_en || "—"} · ×{line.qty} · ¥
                          {line.line_total_cny.toFixed(2)} / $
                          {line.line_total_usd.toFixed(2)}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs font-semibold text-[#002d54]">
                    ¥{detail.quote.totals.cny.toFixed(2)} · $
                    {detail.quote.totals.usd.toFixed(2)}
                  </p>
                </div>

                {detail.quote.status === "pending_review" ? (
                  <div className="space-y-2 border-t border-zinc-100 pt-3">
                    <label className="block text-xs font-medium text-zinc-600">
                      {t("desk.review.note")}
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide("approved")}
                        className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {t("desk.review.approve")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide("rejected")}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {t("desk.review.reject")}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="text-xs font-semibold text-zinc-500">
                    {t("desk.review.messages")}
                  </div>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
                    {(detail.messages || []).slice(-12).map((m, i) => (
                      <li key={`${m.role}-${i}`} className="text-zinc-700">
                        <span className="font-medium text-[#002d54]">
                          {m.role}:
                        </span>{" "}
                        {m.content.slice(0, 240)}
                        {m.content.length > 240 ? "…" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
