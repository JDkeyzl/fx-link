"use client";

import { useMemo, useState, type ReactNode } from "react";

const ISSUE_TYPE_ZH: Record<string, string> = {
  contains_cjk_after_translation: "译后仍含中文",
  duplicate_term: "重复词汇",
  separator_format_issue: "分隔符/空格异常",
  brand_split_translation: "品牌拆字误译",
  machine_suggestion: "机器建议修正",
};

function issueTypeZh(t: string): string {
  return ISSUE_TYPE_ZH[t] || t;
}

type PartWithIssues = {
  part_no: string;
  brand: string;
  name_ch: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  issues: Array<{
    issue_type: string;
    locale_field: "name_en" | "name_fr" | "name_ar";
    token: string;
    suggestion: string;
  }>;
  locale_fields: Array<"name_en" | "name_fr" | "name_ar">;
  issue_types: string[];
};

function prettyField(field: string): string {
  if (field === "name_en") return "英文";
  if (field === "name_fr") return "法文";
  if (field === "name_ar") return "阿拉伯文";
  return field;
}

function prettyLocales(fields: string[]): string {
  return fields.map(prettyField).join("、");
}

function normPartNo(s: string | undefined): string {
  return String(s ?? "").trim();
}

function formatBeijingTime(raw: string | undefined): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

type BatchPreviewSample = {
  part_no: string;
  locale_field: string;
  before: string;
  after: string;
  name_ch?: string;
  name_en?: string;
  name_fr?: string;
  name_ar?: string;
  match_ranges?: number[][];
};

type AnchorRecord = {
  id: number;
  part_no: string;
  name_ch: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  updated_by?: string;
  created_at: string;
};

function mergeMatchRanges(ranges: number[][]): number[][] {
  const valid = ranges.filter((r) => r.length >= 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[0] < r[1]);
  if (!valid.length) return [];
  valid.sort((a, b) => a[0]! - b[0]!);
  const out: number[][] = [[valid[0]![0]!, valid[0]![1]!]];
  for (let i = 1; i < valid.length; i++) {
    const a = valid[i]![0]!;
    const b = valid[i]![1]!;
    const last = out[out.length - 1]!;
    if (a <= last[1]!) last[1] = Math.max(last[1]!, b);
    else out.push([a, b]);
  }
  return out;
}

function HighlightedText({ text, ranges }: { text: string; ranges: number[][] }) {
  const t = String(text ?? "");
  if (!t) return <span className="text-zinc-400">—</span>;
  const merged = mergeMatchRanges(ranges || []);
  if (!merged.length) {
    return <span className="break-all whitespace-pre-wrap leading-relaxed text-zinc-800">{t}</span>;
  }
  const parts: ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([a, b], i) => {
    if (a > cursor) {
      parts.push(
        <span key={`t-${i}-${cursor}`} className="text-zinc-800">
          {t.slice(cursor, a)}
        </span>
      );
    }
    parts.push(
      <mark
        key={`h-${i}-${a}`}
        className="rounded bg-amber-300 px-0.5 font-medium text-zinc-900 shadow-sm"
      >
        {t.slice(a, b)}
      </mark>
    );
    cursor = Math.max(cursor, b);
  });
  if (cursor < t.length) {
    parts.push(
      <span key={`end-${cursor}`} className="text-zinc-800">
        {t.slice(cursor)}
      </span>
    );
  }
  return <span className="break-all whitespace-pre-wrap leading-relaxed">{parts}</span>;
}

function BatchSampleLocaleBlock({ s }: { s: BatchPreviewSample }) {
  const lf = s.locale_field;
  const ch = String(s.name_ch ?? "");
  const en = String(s.name_en ?? "");
  const fr = String(s.name_fr ?? "");
  const ar = String(s.name_ar ?? "");
  const ranges = s.match_ranges || [];
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      <div className="rounded border border-zinc-100 bg-white px-2 py-1.5">
        <div className="text-[10px] font-medium text-zinc-500">中文 name_ch</div>
        <div className="mt-0.5 break-all whitespace-pre-wrap text-[11px] text-zinc-800">{ch || "—"}</div>
      </div>
      <div
        className={`rounded border px-2 py-1.5 ${lf === "name_en" ? "border-amber-300 bg-amber-50/40" : "border-zinc-100 bg-white"}`}
      >
        <div className={`text-[10px] font-medium ${lf === "name_en" ? "text-amber-900" : "text-zinc-500"}`}>
          英文 name_en
          {lf === "name_en" ? " · 替换列" : ""}
        </div>
        <div className="mt-0.5 text-[11px]">
          {lf === "name_en" ? (
            <HighlightedText text={s.before} ranges={ranges} />
          ) : (
            <span className="break-all whitespace-pre-wrap text-zinc-800">{en || "—"}</span>
          )}
        </div>
      </div>
      <div
        className={`rounded border px-2 py-1.5 ${lf === "name_fr" ? "border-amber-300 bg-amber-50/40" : "border-zinc-100 bg-white"}`}
      >
        <div className={`text-[10px] font-medium ${lf === "name_fr" ? "text-amber-900" : "text-zinc-500"}`}>
          法文 name_fr
          {lf === "name_fr" ? " · 替换列" : ""}
        </div>
        <div className="mt-0.5 text-[11px]">
          {lf === "name_fr" ? (
            <HighlightedText text={s.before} ranges={ranges} />
          ) : (
            <span className="break-all whitespace-pre-wrap text-zinc-800">{fr || "—"}</span>
          )}
        </div>
      </div>
      <div
        className={`rounded border px-2 py-1.5 ${lf === "name_ar" ? "border-amber-300 bg-amber-50/40" : "border-zinc-100 bg-white"}`}
        dir="rtl"
      >
        <div className={`text-[10px] font-medium ${lf === "name_ar" ? "text-amber-900" : "text-zinc-500"}`} dir="ltr">
          阿拉伯文 name_ar
          {lf === "name_ar" ? " · 替换列" : ""}
        </div>
        <div className="mt-0.5 text-[11px]" dir="rtl">
          {lf === "name_ar" ? (
            <HighlightedText text={s.before} ranges={ranges} />
          ) : (
            <span className="break-all whitespace-pre-wrap text-zinc-800" dir="rtl">
              {ar || "—"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TranslationFixClient() {
  const [adminKey, setAdminKey] = useState("");
  const [query, setQuery] = useState("");
  const [partRows, setPartRows] = useState<PartWithIssues[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<PartWithIssues | null>(null);
  const [singleEdit, setSingleEdit] = useState<{
    part_no: string;
    name_ch: string;
    name_en: string;
    name_fr: string;
    name_ar: string;
  } | null>(null);
  const [actor, setActor] = useState("admin");

  const [batchKind, setBatchKind] = useState<"literal" | "regex">("literal");
  const [batchWholeWord, setBatchWholeWord] = useState(false);
  const [batchLocale, setBatchLocale] = useState<"name_en" | "name_fr" | "name_ar" | "all">("name_en");
  const [batchScope, setBatchScope] = useState<"catalog" | "issues_only">("catalog");
  const [batchFind, setBatchFind] = useState("");
  const [batchReplace, setBatchReplace] = useState("");
  const [batchRegexFlags, setBatchRegexFlags] = useState("g");
  const [batchLimit, setBatchLimit] = useState(200000);
  const [batchPreviewCount, setBatchPreviewCount] = useState<number | null>(null);
  const [batchSamples, setBatchSamples] = useState<BatchPreviewSample[]>([]);
  const [batchLastLogId, setBatchLastLogId] = useState<number | null>(null);
  const [anchorRecords, setAnchorRecords] = useState<AnchorRecord[]>([]);
  const [anchorLoading, setAnchorLoading] = useState(false);
  const [allAnchors, setAllAnchors] = useState<AnchorRecord[]>([]);
  const [allAnchorsLoading, setAllAnchorsLoading] = useState(false);
  const [allAnchorsTotal, setAllAnchorsTotal] = useState(0);
  const [allAnchorsQuery, setAllAnchorsQuery] = useState("");
  const [allAnchorsOffset, setAllAnchorsOffset] = useState(0);
  const allAnchorsLimit = 30;

  const canRun = useMemo(() => adminKey.trim().length > 0, [adminKey]);

  async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/api/admin/translation/${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-admin-key": adminKey.trim(),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return data as T;
  }

  async function fetchPartList(): Promise<PartWithIssues[]> {
    const data = await callApi<{ items: PartWithIssues[] }>(
      `issues/parts?q=${encodeURIComponent(query)}&limit=3000`
    );
    return data.items || [];
  }

  async function loadAnchors(partNo: string) {
    const pn = normPartNo(partNo);
    if (!pn || !canRun) {
      setAnchorRecords([]);
      return;
    }
    setAnchorLoading(true);
    try {
      const data = await callApi<{ items: AnchorRecord[] }>(
        `anchors?part_no=${encodeURIComponent(pn)}&limit=30`
      );
      setAnchorRecords(data.items || []);
    } catch {
      setAnchorRecords([]);
    } finally {
      setAnchorLoading(false);
    }
  }

  async function loadAllAnchors(nextOffset = 0) {
    if (!canRun) return;
    setAllAnchorsLoading(true);
    try {
      const data = await callApi<{
        total: number;
        count: number;
        limit: number;
        offset: number;
        items: AnchorRecord[];
      }>(
        `anchors/all?q=${encodeURIComponent(allAnchorsQuery)}&limit=${allAnchorsLimit}&offset=${Math.max(
          0,
          nextOffset
        )}`
      );
      setAllAnchors(data.items || []);
      setAllAnchorsTotal(Number(data.total || 0));
      setAllAnchorsOffset(Number(data.offset || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载锚点总表失败");
      setAllAnchors([]);
      setAllAnchorsTotal(0);
      setAllAnchorsOffset(0);
    } finally {
      setAllAnchorsLoading(false);
    }
  }

  async function loadPartList() {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPartList();
      setPartRows(list);
      setSelectedPart(null);
      setSingleEdit(null);
      setAnchorRecords([]);
      await loadAllAnchors(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载列表失败");
    } finally {
      setLoading(false);
    }
  }

  function selectPartRow(p: PartWithIssues) {
    setError(null);
    setSelectedPart(p);
    setSingleEdit({
      part_no: p.part_no,
      name_ch: p.name_ch,
      name_en: String(p.name_en ?? ""),
      name_fr: String(p.name_fr ?? ""),
      name_ar: String(p.name_ar ?? ""),
    });
    void loadAnchors(p.part_no);
  }

  async function previewBatchReplace() {
    if (!canRun) return;
    setError(null);
    try {
      const data = await callApi<{ count: number; samples: BatchPreviewSample[] }>("batch-preview", {
        method: "POST",
        body: JSON.stringify({
          mode: "replace",
          locale_field: batchLocale,
          replace_scope: batchScope,
          replace_kind: batchKind,
          replace_whole_word: batchKind === "literal" ? batchWholeWord : false,
          replace_regex_flags: batchKind === "regex" ? batchRegexFlags : undefined,
          find_text: batchFind,
          replace_text: batchReplace,
          q: query,
          limit: batchLimit,
          updated_by: actor,
        }),
      });
      setBatchPreviewCount(data.count ?? 0);
      setBatchSamples(data.samples || []);
      setBatchLastLogId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量预览失败");
    }
  }

  async function applyBatchReplace() {
    if (!canRun) return;
    setError(null);
    setLoading(true);
    try {
      const data = await callApi<{ ok: boolean; log_id: number; changed: number }>("batch-apply", {
        method: "POST",
        body: JSON.stringify({
          mode: "replace",
          locale_field: batchLocale,
          replace_scope: batchScope,
          replace_kind: batchKind,
          replace_whole_word: batchKind === "literal" ? batchWholeWord : false,
          replace_regex_flags: batchKind === "regex" ? batchRegexFlags : undefined,
          find_text: batchFind,
          replace_text: batchReplace,
          q: query,
          limit: batchLimit,
          updated_by: actor,
        }),
      });
      setBatchLastLogId(data.log_id ?? null);
      setBatchPreviewCount(null);
      setBatchSamples([]);
      await loadPartList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量应用失败");
    } finally {
      setLoading(false);
    }
  }

  async function copyChineseName(value: string) {
    const text = String(value || "").trim();
    if (!text) {
      setError("中文名为空，无法复制");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
    } catch {
      setError("复制失败：请检查浏览器剪贴板权限");
    }
  }

  async function applySingle() {
    if (!singleEdit) return;
    const savedNo = singleEdit.part_no;
    const payload = {
      part_no: singleEdit.part_no,
      name_en: singleEdit.name_en,
      name_fr: singleEdit.name_fr,
      name_ar: singleEdit.name_ar,
      updated_by: actor,
    };
    setError(null);
    setLoading(true);
    setSingleEdit(null);
    try {
      await callApi("single", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const list = await fetchPartList();
      setPartRows(list);
      await loadAllAnchors(allAnchorsOffset);
      const refreshed = list.find((r) => normPartNo(r.part_no) === normPartNo(savedNo));
      if (refreshed) {
        selectPartRow(refreshed);
      } else {
        setSelectedPart(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "单条保存失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-xl font-semibold text-zinc-900">译文纠错台</h1>
      <p className="mt-1 text-sm text-zinc-500">
        内部管理页：左侧每个配件号一行；选中后在右栏同时修改英 / 法 / 阿译文。
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="管理口令"
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="筛选（配件号 / 名称）"
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="操作人（updated_by）"
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void loadPartList()}
          disabled={!canRun || loading}
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "加载中…" : "加载问题配件"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded border border-zinc-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">问题配件（每行一个配件号）</h2>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-zinc-200 text-zinc-600">
                  <th className="py-2">配件号</th>
                  <th className="py-2">中文名</th>
                  <th className="py-2">问题类型</th>
                  <th className="py-2">涉及语种</th>
                </tr>
              </thead>
              <tbody>
                {partRows.map((p) => {
                  const isActive =
                    selectedPart && normPartNo(selectedPart.part_no) === normPartNo(p.part_no);
                  const typesZh =
                    (p.issue_types || []).length > 0
                      ? (p.issue_types || []).map(issueTypeZh).join("、")
                      : "无自动检出";
                  return (
                    <tr
                      key={normPartNo(p.part_no)}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectPartRow(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectPartRow(p);
                        }
                      }}
                      className={`cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 ${isActive ? "bg-zinc-100" : ""}`}
                    >
                      <td className="py-2 pr-2 font-mono">{p.part_no}</td>
                      <td className="py-2 pr-2">{p.name_ch}</td>
                      <td className="py-2 pr-2">{typesZh}</td>
                      <td className="py-2 pr-2">{prettyLocales(p.locale_fields || [])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded border border-zinc-200 bg-white p-3">
          <h2 className="mb-2 shrink-0 text-sm font-semibold text-zinc-900">单条编辑</h2>
          <div className="min-h-0 flex-1 overflow-auto">
            {!singleEdit ? (
              <p className="text-xs text-zinc-500">请点击左侧某个配件行，在此修改英 / 法 / 阿译文并保存。</p>
            ) : (
              <>
                <dl className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    配件号 Part No
                  </dt>
                  <dd className="mt-1 break-all font-mono text-base font-semibold leading-snug text-zinc-900">
                    {singleEdit.part_no}
                  </dd>
                </dl>
                {selectedPart &&
                  normPartNo(selectedPart.part_no) === normPartNo(singleEdit.part_no) && (
                    <div className="mb-3 flex flex-wrap gap-2 text-xs text-zinc-600">
                      <span className="rounded bg-white px-2 py-1 ring-1 ring-zinc-200">
                        {(selectedPart.issue_types || []).length > 0
                          ? (selectedPart.issue_types || []).map(issueTypeZh).join("、")
                          : "无自动检出"}
                      </span>
                      <span className="rounded bg-white px-2 py-1 ring-1 ring-zinc-200">
                        {prettyLocales(selectedPart.locale_fields || [])}
                      </span>
                    </div>
                  )}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500">中文名（只读）</p>
                  <button
                    type="button"
                    onClick={() => void copyChineseName(singleEdit.name_ch)}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    复制中文名
                  </button>
                </div>
                <div className="mb-3 rounded border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800">
                  {singleEdit.name_ch || "—"}
                </div>
                <div className="mb-3 rounded border border-zinc-200 bg-white p-2">
                  <div className="mb-1 text-xs font-medium text-zinc-700">锚点记录历史（最近 30 条）</div>
                  {anchorLoading ? (
                    <div className="text-xs text-zinc-500">加载中…</div>
                  ) : anchorRecords.length === 0 ? (
                    <div className="text-xs text-zinc-500">暂无记录</div>
                  ) : (
                    <div className="max-h-40 overflow-auto">
                      {anchorRecords.map((a) => (
                        <div key={a.id} className="mb-2 rounded border border-zinc-100 bg-zinc-50 p-2 last:mb-0">
                          <div className="mb-1 text-[11px] text-zinc-500">
                            #{a.id} · {formatBeijingTime(a.created_at)} · {a.updated_by || "unknown"}
                          </div>
                          <div className="grid grid-cols-1 gap-1 text-[11px]">
                            <div><span className="text-zinc-500">中文:</span> {a.name_ch || "—"}</div>
                            <div><span className="text-zinc-500">英文:</span> {a.name_en || "—"}</div>
                            <div><span className="text-zinc-500">法文:</span> {a.name_fr || "—"}</div>
                            <div dir="rtl"><span dir="ltr" className="text-zinc-500">阿拉伯文:</span> {a.name_ar || "—"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-zinc-700">英文译文</span>
                    <textarea
                      value={singleEdit.name_en}
                      onChange={(e) => setSingleEdit((s) => (s ? { ...s, name_en: e.target.value } : s))}
                      rows={5}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-zinc-700">法文译文</span>
                    <textarea
                      value={singleEdit.name_fr}
                      onChange={(e) => setSingleEdit((s) => (s ? { ...s, name_fr: e.target.value } : s))}
                      rows={5}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-zinc-700">阿拉伯文译文</span>
                    <textarea
                      value={singleEdit.name_ar}
                      onChange={(e) => setSingleEdit((s) => (s ? { ...s, name_ar: e.target.value } : s))}
                      rows={5}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                      dir="rtl"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void applySingle()}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    保存三语文案
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleEdit(null)}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
                  >
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">批量修改译文</h2>
        <p className="mt-1 text-xs text-zinc-500">
          在上方「筛选」与下列「作用范围 / 最大条数」内，对<strong className="font-medium">所选译文字段（英 / 法 / 阿）</strong>
          做查找替换；<strong className="font-medium">不会</strong>在中文名 <code className="rounded bg-zinc-100 px-0.5">name_ch</code>{" "}
          里查找。顶部筛选只决定拉哪些配件进候选集；是否计入匹配要看<strong className="font-medium">该译文字段里是否真有查找串</strong>
          （已做字面预检，避免仅因空格规范化误判）。请确认已重启后端以加载最新逻辑。
        </p>

        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="batchKind"
              checked={batchKind === "literal"}
              onChange={() => {
                setBatchKind("literal");
                setBatchRegexFlags("g");
              }}
            />
            <span>整词 / 短语替换（字面量，逐次匹配整段文字）</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="batchKind"
              checked={batchKind === "regex"}
              onChange={() => setBatchKind("regex")}
            />
            <span>占位 / 正则替换（高级，如温度：(-?\\d+)度 → $1°C）</span>
          </label>
        </div>

        {batchKind === "literal" && (
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={batchWholeWord}
              onChange={(e) => setBatchWholeWord(e.target.checked)}
            />
            仅英文等拉丁词使用整词边界（\b），中文短语请勿勾选
          </label>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-zinc-700">目标语种</span>
            <select
              value={batchLocale}
              onChange={(e) =>
                setBatchLocale(e.target.value as "name_en" | "name_fr" | "name_ar" | "all")
              }
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="name_en">仅英文 name_en</option>
              <option value="name_fr">仅法文 name_fr</option>
              <option value="name_ar">仅阿拉伯文 name_ar</option>
              <option value="all">三种译文分别处理</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-zinc-700">作用范围</span>
            <select
              value={batchScope}
              onChange={(e) => setBatchScope(e.target.value as "catalog" | "issues_only")}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="catalog">全表（筛选内，适用于大量配件）</option>
              <option value="issues_only">仅当前能检出翻译问题的行与对应语种</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-zinc-700">最大处理行数</span>
            <input
              type="number"
              min={1}
              max={500000}
              value={batchLimit}
              onChange={(e) => setBatchLimit(Number(e.target.value) || 200000)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          {batchKind === "regex" && (
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-zinc-700">正则 flags</span>
              <input
                value={batchRegexFlags}
                onChange={(e) => setBatchRegexFlags(e.target.value)}
                placeholder="g"
                className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-sm"
              />
            </label>
          )}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-zinc-700">
              {batchKind === "regex" ? "查找（正则）" : "查找文字"}
            </span>
            <textarea
              value={batchFind}
              onChange={(e) => setBatchFind(e.target.value)}
              rows={2}
              className="w-full rounded border border-zinc-300 px-2 py-1 font-mono text-sm"
              placeholder={batchKind === "regex" ? "例：(-?\\d+(?:\\.\\d+)?)度" : "例：防冻液"}
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-zinc-700">替换为</span>
            <textarea
              value={batchReplace}
              onChange={(e) => setBatchReplace(e.target.value)}
              rows={2}
              className="w-full rounded border border-zinc-300 px-2 py-1 font-mono text-sm"
              placeholder={batchKind === "regex" ? "例：$1°C" : "例：antifreeze"}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void previewBatchReplace()}
            disabled={!canRun || loading}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            预览匹配条数
          </button>
          <button
            type="button"
            onClick={() => void applyBatchReplace()}
            disabled={!canRun || loading}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            应用批量替换
          </button>
          {batchLastLogId != null && (
            <span className="self-center text-xs text-zinc-500">上次日志 ID：{batchLastLogId}（可配合回滚接口）</span>
          )}
        </div>

        {batchPreviewCount !== null && (
          <div className="mt-2 rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-blue-900">
            将修改的译文条数：{batchPreviewCount}（多语种分别计数；实际写入按配件合并）
          </div>
        )}

        {batchSamples.length > 0 && (
          <div className="mt-3 max-h-[min(70vh,36rem)] overflow-auto rounded border border-zinc-200 p-2 text-xs">
            <p className="mb-2 font-medium text-zinc-700">抽样预览（四语言当前内容；琥珀色底为本次替换列，命中片段已高亮）</p>
            {batchSamples.slice(0, 15).map((s, idx) => (
              <div
                key={`${s.part_no}-${s.locale_field}-${idx}`}
                className="mb-4 border-b border-zinc-100 pb-4 last:mb-0 last:border-b-0 last:pb-0"
              >
                <div className="mb-2 font-mono text-xs font-semibold text-zinc-900">
                  {s.part_no}
                  <span className="ml-2 font-normal text-zinc-500">本次替换：{prettyField(s.locale_field)}</span>
                </div>
                <BatchSampleLocaleBlock s={s} />
                <div className="mt-2 grid gap-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                  <div className="text-[10px] font-medium text-zinc-500">该列替换后</div>
                  <div className="break-all whitespace-pre-wrap text-[11px] text-zinc-900">{s.after}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
          <p className="font-medium">可选扩展类型（等你确认可再加）：</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 opacity-95">
            <li>多规则一键链式执行（同一批按顺序应用多条替换）</li>
            <li>仅改「品牌词表」命中行，或从 glossary 拉通货名映射</li>
            <li>大小写规范、空白与标点统一（trim、合并空格、全角半角）</li>
            <li>从 CSV 导入「查找列 / 替换列」做大批量术语对齐</li>
            <li>应用前导出受影响的 part_no 列表做审计</li>
          </ul>
        </div>
      </section>

      <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">翻译修改记录总表</h2>
            <p className="text-xs text-zinc-500">记录来源：单条编辑保存时写入的锚点历史</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={allAnchorsQuery}
              onChange={(e) => setAllAnchorsQuery(e.target.value)}
              placeholder="筛选（配件号 / 中文名 / 操作人）"
              className="rounded border border-zinc-300 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => void loadAllAnchors(0)}
              disabled={!canRun || allAnchorsLoading}
              className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
            >
              查询
            </button>
          </div>
        </div>

        <div className="mb-2 text-xs text-zinc-500">
          总记录：{allAnchorsTotal}，当前区间：{allAnchorsTotal === 0 ? 0 : allAnchorsOffset + 1}-
          {Math.min(allAnchorsOffset + allAnchors.length, allAnchorsTotal)}
        </div>
        <div className="max-h-[50vh] overflow-auto rounded border border-zinc-200">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-zinc-200 text-zinc-600">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">时间</th>
                <th className="px-2 py-2">操作人</th>
                <th className="px-2 py-2">配件号</th>
                <th className="px-2 py-2">中文</th>
                <th className="px-2 py-2">英文</th>
                <th className="px-2 py-2">法文</th>
                <th className="px-2 py-2">阿拉伯文</th>
              </tr>
            </thead>
            <tbody>
              {allAnchorsLoading ? (
                <tr>
                  <td className="px-2 py-3 text-zinc-500" colSpan={8}>
                    加载中…
                  </td>
                </tr>
              ) : allAnchors.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-zinc-500" colSpan={8}>
                    暂无记录
                  </td>
                </tr>
              ) : (
                allAnchors.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-100 align-top">
                    <td className="px-2 py-2 font-mono">{a.id}</td>
                    <td className="px-2 py-2">{formatBeijingTime(a.created_at)}</td>
                    <td className="px-2 py-2">{a.updated_by || "unknown"}</td>
                    <td className="px-2 py-2 font-mono">{a.part_no}</td>
                    <td className="px-2 py-2">{a.name_ch || "—"}</td>
                    <td className="px-2 py-2">{a.name_en || "—"}</td>
                    <td className="px-2 py-2">{a.name_fr || "—"}</td>
                    <td className="px-2 py-2" dir="rtl">
                      {a.name_ar || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void loadAllAnchors(Math.max(0, allAnchorsOffset - allAnchorsLimit))}
            disabled={!canRun || allAnchorsLoading || allAnchorsOffset <= 0}
            className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
          >
            上一页
          </button>
          <button
            type="button"
            onClick={() => void loadAllAnchors(allAnchorsOffset + allAnchorsLimit)}
            disabled={
              !canRun ||
              allAnchorsLoading ||
              allAnchorsOffset + allAnchors.length >= allAnchorsTotal
            }
            className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </section>
    </div>
  );
}

