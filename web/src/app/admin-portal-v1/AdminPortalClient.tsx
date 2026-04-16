"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Part } from "@/types/part";

const PLACEHOLDERS = [
  { brand: "SINOTRUK", src: "/logo/sinotruk.png" },
  { brand: "WEICHAI", src: "/logo/weichai.png" },
] as const;

const STORAGE_KEY = "admin_upload_key";
const PENDING_STORAGE_KEY = "admin_parts_pending_v1";
const UPLOAD_RECORDS_UI_KEY = "admin_upload_records_ui_v1";
const RECENT_UPLOAD_FAILURES_KEY = "admin_recent_upload_failures_v1";
const RECENT_FAILURES_CAP = 200;

/** Matches backend max (100); admin uses 50 per page for manageable batches. */
const PAGE_SIZE = 50;

export type PendingItem = {
  part_no: string;
  brand: string;
  name_ch: string;
  image_path?: string | null;
  status: "pending" | "done";
  /** 来自搜索加入，或来自上传记录失败行。 */
  queue_source?: "search" | "upload_failed";
  /** 来自上传失败时的服务端/客户端错误摘要（仅展示）。 */
  last_upload_error?: string | null;
  addedAt: string;
  processedAt?: string;
};

type UploadedItem = {
  part_no: string;
  brand: string;
  name_ch: string;
  image_path?: string | null;
  image_uploaded_at?: string | null;
  image_upload_failed_at?: string | null;
  image_upload_error?: string | null;
  record_status?: "success" | "failed";
  record_at?: string | null;
};

type UploadResultItem = {
  part_no: string;
  ok: boolean;
  error?: string;
};

/** DB stores UTC ISO via SQLite `strftime(..., 'now')` + literal `Z`. Show Asia/Shanghai (CST). */
function formatUploadedAt(ts?: string | null): string {
  if (!ts) return "—";
  const raw = ts.trim();
  let iso = raw.replace(" ", "T");
  const hasTz = /Z$/i.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso);
  if (!hasTz) {
    iso = `${iso}Z`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return raw.replace("T", " ").replace(/Z$/i, "").replace(/\.\d+$/, "");
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(/\//g, "-");
}

type UploadToast = {
  type: "success" | "error";
  message: string;
};

type EditPartForm = {
  part_no: string;
  brand: string;
  name_ch: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  price: string;
  image_path: string;
};

function loadQueue(): PendingItem[] {
  try {
    const raw = localStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is PendingItem =>
          Boolean(x) &&
          typeof (x as PendingItem).part_no === "string" &&
          ((x as PendingItem).status === "pending" ||
            (x as PendingItem).status === "done")
      )
      .map((x) => ({
        ...x,
        queue_source:
          x.queue_source === "upload_failed" ? "upload_failed" : "search",
      }));
  } catch {
    return [];
  }
}

function persistQueue(next: PendingItem[]) {
  try {
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function loadUploadRecordsUi(): {
  filter: "all" | "success" | "failed";
  page: number;
} {
  if (typeof window === "undefined") return { filter: "all", page: 1 };
  try {
    const raw = localStorage.getItem(UPLOAD_RECORDS_UI_KEY);
    if (!raw) return { filter: "all", page: 1 };
    const o = JSON.parse(raw) as { filter?: string; page?: unknown };
    const filter =
      o.filter === "success" || o.filter === "failed" || o.filter === "all"
        ? o.filter
        : "all";
    let page = Number(o.page);
    if (!Number.isFinite(page) || page < 1) page = 1;
    return { filter, page };
  } catch {
    return { filter: "all", page: 1 };
  }
}

function persistUploadRecordsUi(
  filter: "all" | "success" | "failed",
  page: number
) {
  try {
    localStorage.setItem(
      UPLOAD_RECORDS_UI_KEY,
      JSON.stringify({ filter, page })
    );
  } catch {
    /* ignore */
  }
}

type StoredUploadFailure = {
  part_no: string;
  error?: string;
  at: string;
};

function loadRecentFailuresFromStorage(): UploadResultItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_UPLOAD_FAILURES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x): x is StoredUploadFailure =>
          Boolean(x) && typeof (x as StoredUploadFailure).part_no === "string"
      )
      .map((x) => ({
        part_no: x.part_no,
        ok: false as const,
        error: x.error,
      }));
  } catch {
    return [];
  }
}

/** 上传成功后从「近期失败」中移除该零件号（与 DB 成功记录一致）。 */
function removeRecentFailuresForSuccessfulParts(partNos: string[]) {
  const set = new Set(
    partNos.map((p) => String(p).trim()).filter(Boolean)
  );
  if (set.size === 0) return;
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(RECENT_UPLOAD_FAILURES_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return;
    const next = arr.filter(
      (x): x is StoredUploadFailure =>
        Boolean(x) &&
        typeof (x as StoredUploadFailure).part_no === "string" &&
        !set.has((x as StoredUploadFailure).part_no)
    );
    localStorage.setItem(RECENT_UPLOAD_FAILURES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function persistRecentFailures(items: UploadResultItem[]) {
  const failed = items.filter((x) => !x.ok);
  if (failed.length === 0) return;
  try {
    const prev = loadRecentFailuresFromStorage();
    const merged: StoredUploadFailure[] = [
      ...failed.map((x) => ({
        part_no: x.part_no,
        error: x.error,
        at: new Date().toISOString(),
      })),
      ...prev.map((x) => ({
        part_no: x.part_no,
        error: x.error,
        at: "",
      })),
    ];
    const seen = new Set<string>();
    const deduped: StoredUploadFailure[] = [];
    for (const row of merged) {
      const k = `${row.part_no}|${row.error ?? ""}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push({
        part_no: row.part_no,
        error: row.error,
        at: row.at || new Date().toISOString(),
      });
      if (deduped.length >= RECENT_FAILURES_CAP) break;
    }
    localStorage.setItem(
      RECENT_UPLOAD_FAILURES_KEY,
      JSON.stringify(deduped)
    );
  } catch {
    /* ignore */
  }
}

function makePendingItem(p: Part): PendingItem {
  const no = p.partNumber || p.id;
  const hasImg = Boolean(p.imagePath || p.imageUrl);
  return {
    part_no: no,
    brand: p.brand,
    name_ch: p.name ?? p.nameEn ?? "",
    image_path: p.imagePath ?? p.imageUrl ?? null,
    status: hasImg ? "done" : "pending",
    queue_source: "search",
    addedAt: new Date().toISOString(),
    ...(hasImg ? { processedAt: new Date().toISOString() } : {}),
  };
}

function isPartNotFoundMessage(msg?: string | null): boolean {
  return /part\s+not\s+found/i.test(String(msg || ""));
}

function pendingItemFromFailedRecord(row: UploadedItem): PendingItem {
  const hasImg = Boolean(row.image_path);
  return {
    part_no: row.part_no,
    brand: row.brand || "",
    name_ch: row.name_ch || "",
    image_path: row.image_path ?? null,
    status: hasImg ? "done" : "pending",
    queue_source: "upload_failed",
    last_upload_error: row.image_upload_error ?? null,
    addedAt: new Date().toISOString(),
    ...(hasImg ? { processedAt: new Date().toISOString() } : {}),
  };
}

/** 本次上传返回的失败行（尚未写入上传记录列表时）也可加入队列。 */
function minimalFailedUploadedItem(
  part_no: string,
  error?: string | null
): UploadedItem {
  return {
    part_no,
    brand: "",
    name_ch: "",
    image_path: null,
    image_uploaded_at: null,
    image_upload_failed_at: null,
    image_upload_error: error ?? null,
    record_status: "failed",
  };
}

function escapeCsvCell(s: string): string {
  const x = String(s ?? "").replace(/"/g, '""');
  return `"${x}"`;
}

/** Match server `adminUpload.js` safePartFileStem + `.jpg` public path. */
function publicImagePathForPartNo(partNo: string): string {
  const safe = String(partNo)
    .trim()
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_");
  return `/images/parts/${safe}.jpg`;
}

export function AdminPortalClient() {
  const [adminKey, setAdminKey] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Part[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadToast, setUploadToast] = useState<UploadToast | null>(null);
  const [targetPartNo, setTargetPartNo] = useState<string | null>(null);
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [queueFilter, setQueueFilter] = useState<
    "all" | "pending" | "done" | "upload_failed"
  >("pending");
  const [uploadedItems, setUploadedItems] = useState<UploadedItem[]>([]);
  const [uploadedTotal, setUploadedTotal] = useState(0);
  const [uploadedPage, setUploadedPage] = useState(1);
  const [uploadedLoading, setUploadedLoading] = useState(false);
  const [uploadedFilter, setUploadedFilter] = useState<"all" | "success" | "failed">("all");
  const [uploadUiHydrated, setUploadUiHydrated] = useState(false);
  const [recentFailedItems, setRecentFailedItems] = useState<UploadResultItem[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "create" | "settings">(
    "upload"
  );
  const [usdCnyRateInput, setUsdCnyRateInput] = useState("7.2");
  const [usdCnyRateSavedAt, setUsdCnyRateSavedAt] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [editingPartNo, setEditingPartNo] = useState<string | null>(null);
  const [savingEditPart, setSavingEditPart] = useState(false);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editPartForm, setEditPartForm] = useState<EditPartForm>({
    part_no: "",
    brand: "",
    name_ch: "",
    name_en: "",
    name_fr: "",
    name_ar: "",
    price: "",
    image_path: "",
  });
  const [creatingPart, setCreatingPart] = useState(false);
  const [createForm, setCreateForm] = useState({
    part_no: "",
    brand: "",
    name_ch: "",
    name_en: "",
    name_fr: "",
    name_ar: "",
    price: "",
  });
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPartNo, setPreviewPartNo] = useState("");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const rowFileRef = useRef<HTMLInputElement>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);
  const queueBatchFileRef = useRef<HTMLInputElement>(null);
  const createImageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s) setAdminKey(s);
    } catch {
      /* ignore */
    }
    setQueue(loadQueue());
    setRecentFailedItems(loadRecentFailuresFromStorage());
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showUploadToast = useCallback((type: UploadToast["type"], message: string) => {
    setUploadToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setUploadToast(null);
    }, 2800);
  }, []);

  const persistKey = useCallback((k: string) => {
    setAdminKey(k);
    try {
      sessionStorage.setItem(STORAGE_KEY, k);
    } catch {
      /* ignore */
    }
  }, []);

  const loadCurrencySetting = useCallback(async () => {
    try {
      const headers: HeadersInit = { Accept: "application/json" };
      if (adminKey.trim()) headers["x-admin-upload-key"] = adminKey.trim();
      const res = await fetch("/api/admin/settings/currency", { headers });
      if (!res.ok) return;
      const data = (await res.json()) as {
        usd_cny_rate?: number;
        updated_at?: string | null;
      };
      const rate = Number(data.usd_cny_rate);
      if (Number.isFinite(rate) && rate > 0) {
        setUsdCnyRateInput(String(rate));
      }
      setUsdCnyRateSavedAt(data.updated_at ?? null);
    } catch {
      /* ignore */
    }
  }, [adminKey]);

  useEffect(() => {
    void loadCurrencySetting();
  }, [loadCurrencySetting]);

  const markUploadResultsInQueue = useCallback(
    (results: { part_no: string; ok: boolean }[] | undefined) => {
      if (!results?.length) return;
      const okSet = new Set(results.filter((r) => r.ok).map((r) => r.part_no));
      if (okSet.size === 0) return;
      setQueue((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          if (!okSet.has(item.part_no)) return item;
          changed = true;
          return {
            ...item,
            status: "done" as const,
            processedAt: new Date().toISOString(),
            image_path: publicImagePathForPartNo(item.part_no),
            last_upload_error: null,
          };
        });
        if (!changed) return prev;
        persistQueue(next);
        return next;
      });
    },
    []
  );

  const uploadImages = useCallback(
    async (
      files: File[],
      partNos: string[]
    ): Promise<{
      ok: boolean;
      results?: UploadResultItem[];
    }> => {
      const fd = new FormData();
      for (const f of files) fd.append("images", f);
      fd.append("part_nos", JSON.stringify(partNos));
      const headers: HeadersInit = {};
      if (adminKey.trim()) headers["x-admin-upload-key"] = adminKey.trim();

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers,
        body: fd,
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      if (!res.ok) {
        const msg = `上传失败（${res.status}）：${
          typeof json === "object" && json && "message" in json
            ? String((json as { message?: string }).message)
            : text
        }`;
        setStatus(
          `上传失败（${res.status}）：${typeof json === "object" && json && "message" in json ? String((json as { message?: string }).message) : text}`
        );
        setRecentFailedItems(loadRecentFailuresFromStorage());
        showUploadToast("error", msg);
        return { ok: false };
      }
      const summary = json as {
        count?: number;
        results?: UploadResultItem[];
      };
      const results = summary.results ?? [];
      const succeeded = results.filter((r) => r.ok).map((r) => r.part_no);
      if (succeeded.length) removeRecentFailuresForSuccessfulParts(succeeded);
      const failed = results.filter((r) => !r.ok);
      if (failed.length) persistRecentFailures(failed);
      setRecentFailedItems(loadRecentFailuresFromStorage());
      setStatus(
        `Uploaded OK: ${summary.count ?? 0} file(s).` +
          (failed.length ? ` Failed: ${failed.map((f) => f.part_no).join(", ")}` : "")
      );
      if (failed.length) {
        showUploadToast(
          "error",
          `上传完成：成功 ${summary.count ?? 0}，失败 ${failed.length}（${failed
            .map((f) => f.part_no)
            .join(", ")}）`
        );
      } else {
        showUploadToast("success", `上传成功：${summary.count ?? 0} 张图片`);
      }
      return { ok: true, results: summary.results };
    },
    [adminKey, showUploadToast]
  );

  const loadUploadedList = useCallback(
    async (
      targetPage = 1,
      statusOverride?: "all" | "success" | "failed"
    ) => {
      setUploadedLoading(true);
      try {
        const offset = (targetPage - 1) * PAGE_SIZE;
        const status = statusOverride ?? uploadedFilter;
        const headers: HeadersInit = { Accept: "application/json" };
        if (adminKey.trim()) headers["x-admin-upload-key"] = adminKey.trim();
        const res = await fetch(
          `/api/admin/uploads?limit=${PAGE_SIZE}&offset=${offset}&status=${status}`,
          { headers }
        );
        if (!res.ok) throw new Error("加载上传记录失败");
        const data = (await res.json()) as {
          items?: UploadedItem[];
          total?: number;
        };
        setUploadedItems(data.items ?? []);
        setUploadedTotal(Number(data.total ?? 0) || 0);
        setUploadedPage(targetPage);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "加载上传记录失败");
      } finally {
        setUploadedLoading(false);
      }
    },
    [adminKey, uploadedFilter]
  );

  const openUploadedPreview = useCallback(async (partNo: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewPartNo(partNo);
    setPreviewSrc(null);
    setPreviewError(null);
    try {
      const res = await fetch(
        `/api/parts/search?q=${encodeURIComponent(partNo)}&limit=1&offset=0`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`查询失败 (${res.status})`);
      const data = (await res.json()) as { items?: Part[] };
      const hit = (data.items ?? []).find((x) => (x.partNumber || x.id) === partNo) || data.items?.[0];
      const src = hit?.imagePath || hit?.imageUrl || null;
      if (!src) {
        setPreviewError("未找到可预览图片（image_path 为空）");
      } else {
        setPreviewSrc(src);
      }
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "加载图片失败");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    const s = loadUploadRecordsUi();
    setUploadedFilter(s.filter);
    setUploadedPage(s.page);
    setUploadUiHydrated(true);
  }, []);

  useEffect(() => {
    if (!uploadUiHydrated) return;
    persistUploadRecordsUi(uploadedFilter, uploadedPage);
  }, [uploadUiHydrated, uploadedFilter, uploadedPage]);

  useEffect(() => {
    if (!uploadUiHydrated) return;
    void loadUploadedList(uploadedPage);
  }, [uploadUiHydrated, loadUploadedList, uploadedPage]);

  const runSearch = useCallback(
    async (targetPage = 1) => {
      const q = query.trim();
      if (q.length < 2) {
        setStatus("请至少输入 2 个字符后再搜索。");
        setItems([]);
        setTotal(0);
        setPage(1);
        return;
      }
      setLoading(true);
      setStatus(null);
      try {
        const offset = (targetPage - 1) * PAGE_SIZE;
        const res = await fetch(
          `/api/parts/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${offset}`,
          { headers: { Accept: "application/json" } }
        );
        if (!res.ok) throw new Error("搜索失败");
        const data = (await res.json()) as {
          items?: Part[];
          total?: number;
        };
        const list = data.items ?? [];
        const tot = Number(data.total ?? 0) || 0;
        setItems(list);
        setTotal(tot);
        setPage(targetPage);
        const totalPages = Math.max(1, Math.ceil(tot / PAGE_SIZE));
        setStatus(
          `第 ${targetPage} / ${totalPages} 页 · 共 ${tot} 条匹配 · 本页 ${list.length} 条`
        );
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "搜索失败");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  const submitCreatePart = useCallback(async () => {
    const payload = {
      part_no: createForm.part_no.trim(),
      brand: createForm.brand.trim(),
      name_ch: createForm.name_ch.trim(),
      name_en: createForm.name_en.trim(),
      name_fr: createForm.name_fr.trim(),
      name_ar: createForm.name_ar.trim(),
      price: createForm.price.trim(),
    };
    const imageFile = createImageFile;
    if (!payload.part_no || !payload.brand || !payload.name_ch) {
      setStatus("新增失败：part_no、brand、name_ch 为必填项。");
      showUploadToast("error", "请填写 part_no、brand、name_ch");
      return;
    }
    try {
      setCreatingPart(true);
      const headers: HeadersInit = {
        Accept: "application/json",
        "content-type": "application/json",
      };
      if (adminKey.trim()) headers["x-admin-upload-key"] = adminKey.trim();
      const res = await fetch("/api/admin/parts", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      if (!res.ok) {
        const message =
          typeof json === "object" && json && "message" in json
            ? String((json as { message?: string }).message)
            : text;
        setStatus(`新增失败（${res.status}）：${message}`);
        showUploadToast("error", `新增失败：${message}`);
        return;
      }
      showUploadToast("success", `新增成功：${payload.part_no}`);
      if (imageFile) {
        const out = await uploadImages([imageFile], [payload.part_no]);
        if (out.ok) {
          markUploadResultsInQueue(out.results);
          const hasFailed = (out.results ?? []).some((r) => !r.ok);
          if (hasFailed) {
            setUploadedFilter("failed");
            setUploadedPage(1);
          }
        }
      } else {
        setStatus(`新增成功：${payload.part_no}，可直接上传图片。`);
      }
      setCreateImageFile(null);
      if (createImageInputRef.current) createImageInputRef.current.value = "";
      setCreateForm({
        part_no: "",
        brand: "",
        name_ch: "",
        name_en: "",
        name_fr: "",
        name_ar: "",
        price: "",
      });
      setActiveTab("upload");
      setQuery(payload.part_no);
      await runSearch(1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "新增失败";
      setStatus(msg);
      showUploadToast("error", `新增失败：${msg}`);
    } finally {
      setCreatingPart(false);
    }
  }, [
    adminKey,
    createForm,
    createImageFile,
    runSearch,
    showUploadToast,
    uploadImages,
    markUploadResultsInQueue,
  ]);

  const saveCurrencySetting = useCallback(async () => {
    const rate = Number.parseFloat(usdCnyRateInput);
    if (!Number.isFinite(rate) || rate <= 0) {
      setStatus("汇率保存失败：请输入大于 0 的数字。");
      showUploadToast("error", "请输入有效汇率（> 0）");
      return;
    }
    try {
      setSavingRate(true);
      const headers: HeadersInit = {
        Accept: "application/json",
        "content-type": "application/json",
      };
      if (adminKey.trim()) headers["x-admin-upload-key"] = adminKey.trim();
      const res = await fetch("/api/admin/settings/currency", {
        method: "POST",
        headers,
        body: JSON.stringify({ usd_cny_rate: rate }),
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      if (!res.ok) {
        const message =
          typeof json === "object" && json && "message" in json
            ? String((json as { message?: string }).message)
            : text;
        setStatus(`汇率保存失败（${res.status}）：${message}`);
        showUploadToast("error", `汇率保存失败：${message}`);
        return;
      }
      const data = json as { usd_cny_rate?: number; updated_at?: string | null };
      const saved = Number(data.usd_cny_rate);
      if (Number.isFinite(saved) && saved > 0) {
        setUsdCnyRateInput(String(saved));
      }
      setUsdCnyRateSavedAt(data.updated_at ?? null);
      setStatus("汇率已保存。非中文页面将自动按该汇率显示美元价格。");
      showUploadToast("success", "汇率已保存");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "汇率保存失败";
      setStatus(msg);
      showUploadToast("error", msg);
    } finally {
      setSavingRate(false);
    }
  }, [adminKey, showUploadToast, usdCnyRateInput]);

  const openEditPart = useCallback((p: Part) => {
    const no = (p.partNumber || p.id || "").trim();
    setEditingPartNo(no);
    setEditPartForm({
      part_no: no,
      brand: String(p.brand || "").trim(),
      name_ch: String(p.name || "").trim(),
      name_en: String(p.nameEn || "").trim(),
      name_fr: String(p.nameFr || "").trim(),
      name_ar: String(p.nameAr || "").trim(),
      price:
        Number.isFinite(Number(p.priceMinUsd)) && Number(p.priceMinUsd) !== 0
          ? String(p.priceMinUsd)
          : "",
      image_path: String(p.imagePath || p.imageUrl || "").trim(),
    });
    setEditImageFile(null);
    if (editImageInputRef.current) editImageInputRef.current.value = "";
  }, []);

  const closeEditPart = useCallback(() => {
    if (savingEditPart) return;
    setEditingPartNo(null);
  }, [savingEditPart]);

  const submitEditPart = useCallback(async () => {
    if (!editingPartNo) return;
    const payload = {
      part_no: editPartForm.part_no.trim(),
      brand: editPartForm.brand.trim(),
      name_ch: editPartForm.name_ch.trim(),
      name_en: editPartForm.name_en.trim(),
      name_fr: editPartForm.name_fr.trim(),
      name_ar: editPartForm.name_ar.trim(),
      price: editPartForm.price.trim(),
      image_path: editPartForm.image_path.trim(),
    };
    if (!payload.part_no || !payload.brand || !payload.name_ch) {
      showUploadToast("error", "part_no、brand、name_ch 为必填项");
      return;
    }
    try {
      setSavingEditPart(true);
      const headers: HeadersInit = {
        Accept: "application/json",
        "content-type": "application/json",
      };
      if (adminKey.trim()) headers["x-admin-upload-key"] = adminKey.trim();
      const res = await fetch(
        `/api/admin/parts/${encodeURIComponent(editingPartNo)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        }
      );
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      if (!res.ok) {
        const message =
          typeof json === "object" && json && "message" in json
            ? String((json as { message?: string }).message)
            : text;
        showUploadToast("error", `编辑失败：${message}`);
        setStatus(`编辑失败（${res.status}）：${message}`);
        return;
      }
      if (editImageFile) {
        const out = await uploadImages([editImageFile], [payload.part_no]);
        if (out.ok) {
          markUploadResultsInQueue(out.results);
        } else {
          showUploadToast(
            "error",
            `数据已保存，但图片上传失败：${payload.part_no}`
          );
        }
      }
      showUploadToast("success", `已更新配件：${payload.part_no}`);
      setEditingPartNo(null);
      setEditImageFile(null);
      if (editImageInputRef.current) editImageInputRef.current.value = "";
      setQuery(payload.part_no);
      await runSearch(1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "编辑失败";
      showUploadToast("error", msg);
      setStatus(msg);
    } finally {
      setSavingEditPart(false);
    }
  }, [
    adminKey,
    editImageFile,
    editPartForm,
    editingPartNo,
    markUploadResultsInQueue,
    runSearch,
    showUploadToast,
    uploadImages,
  ]);

  const handleAddPending = useCallback((p: Part) => {
    const no = p.partNumber || p.id;
    setQueue((prev) => {
      if (prev.some((x) => x.part_no === no)) {
        queueMicrotask(() =>
          setStatus(`已在待处理列表：${no}`)
        );
        return prev;
      }
      const item = makePendingItem(p);
      const next = [...prev, item];
      persistQueue(next);
      queueMicrotask(() => setStatus(`已加入待处理：${no}`));
      return next;
    });
  }, []);

  const addFailedRecordToQueue = useCallback(
    (row: UploadedItem) => {
      setQueue((prev) => {
        const idx = prev.findIndex((x) => x.part_no === row.part_no);
        const incoming = pendingItemFromFailedRecord(row);
        if (idx >= 0) {
          const next = [...prev];
          const cur = next[idx];
          next[idx] = {
            ...cur,
            queue_source: "upload_failed",
            last_upload_error:
              row.image_upload_error ?? cur.last_upload_error ?? null,
            brand: row.brand || cur.brand,
            name_ch: row.name_ch || cur.name_ch,
            image_path: row.image_path ?? cur.image_path,
          };
          persistQueue(next);
          queueMicrotask(() =>
            showUploadToast(
              "success",
              `已更新待处理（上传失败来源）：${row.part_no}`
            )
          );
          return next;
        }
        const next = [...prev, incoming];
        persistQueue(next);
        queueMicrotask(() =>
          showUploadToast("success", `已加入待处理（上传失败）：${row.part_no}`)
        );
        return next;
      });
    },
    [showUploadToast]
  );

  const openCreateFromFailed = useCallback(
    (
      partNo: string,
      meta?: { brand?: string; name_ch?: string; error?: string | null }
    ) => {
      setCreateForm({
        part_no: partNo.trim(),
        brand: (meta?.brand ?? "").trim(),
        name_ch: (meta?.name_ch ?? "").trim(),
        name_en: "",
        name_fr: "",
        name_ar: "",
        price: "",
      });
      setCreateImageFile(null);
      if (createImageInputRef.current) createImageInputRef.current.value = "";
      setActiveTab("create");
      const partNotFound = isPartNotFoundMessage(meta?.error);
      showUploadToast(
        "success",
        partNotFound
          ? `已打开新增配件：${partNo.trim()}（库中无此配件时请补全品牌与中文名）`
          : `已打开新增配件：${partNo.trim()}（补全后可继续上传）`
      );
    },
    [showUploadToast]
  );

  const removeQueueItem = useCallback((partNo: string) => {
    setQueue((prev) => {
      const next = prev.filter((x) => x.part_no !== partNo);
      persistQueue(next);
      return next;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => {
      const next = prev.filter((x) => x.status !== "done");
      persistQueue(next);
      return next;
    });
  }, []);

  const exportPendingCsv = useCallback(() => {
    const pending = queue.filter((x) => x.status === "pending");
    if (pending.length === 0) {
      setStatus("没有「待处理」项可导出。");
      return;
    }
    const header = "part_no,brand,name_ch";
    const lines = pending.map(
      (r) =>
        `${escapeCsvCell(r.part_no)},${escapeCsvCell(r.brand)},${escapeCsvCell(r.name_ch)}`
    );
    const bom = "\ufeff";
    const blob = new Blob([bom + [header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pending-parts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`已导出 ${pending.length} 条待处理零件（CSV）。`);
  }, [queue]);

  const onRowFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !targetPartNo) return;
    const out = await uploadImages(Array.from(files), [targetPartNo]);
    setTargetPartNo(null);
    e.target.value = "";
    if (out.ok) markUploadResultsInQueue(out.results);
    await runSearch(page);
    if (out.ok) {
      const hasFailed = (out.results ?? []).some((r) => !r.ok);
      if (hasFailed) {
        setUploadedFilter("failed");
        await loadUploadedList(1, "failed");
      } else {
        await loadUploadedList(1);
      }
    }
  };

  const onBatchFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files);
    const partNos = list.map((f) => {
      const name = f.name.replace(/\.[^.]+$/, "");
      return name.trim();
    });
    const out = await uploadImages(list, partNos);
    e.target.value = "";
    if (out.ok) markUploadResultsInQueue(out.results);
    await runSearch(page);
    if (out.ok) {
      const hasFailed = (out.results ?? []).some((r) => !r.ok);
      if (hasFailed) {
        setUploadedFilter("failed");
        await loadUploadedList(1, "failed");
      } else {
        await loadUploadedList(1);
      }
    }
  };

  const onQueueBatchFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files);
    const partNos = list.map((f) => {
      const name = f.name.replace(/\.[^.]+$/, "");
      return name.trim();
    });
    const out = await uploadImages(list, partNos);
    e.target.value = "";
    if (out.ok) markUploadResultsInQueue(out.results);
    await runSearch(page);
    if (out.ok) {
      const hasFailed = (out.results ?? []).some((r) => !r.ok);
      if (hasFailed) {
        setUploadedFilter("failed");
        await loadUploadedList(1, "failed");
      } else {
        await loadUploadedList(1);
      }
    }
  };

  const filteredQueue = queue.filter((item) => {
    if (queueFilter === "upload_failed") {
      return item.queue_source === "upload_failed";
    }
    if (queueFilter === "pending") return item.status === "pending";
    if (queueFilter === "done") return item.status === "done";
    return true;
  });

  const pendingCount = queue.filter((x) => x.status === "pending").length;
  const doneCount = queue.filter((x) => x.status === "done").length;
  const uploadFailedQueueCount = queue.filter(
    (x) => x.queue_source === "upload_failed"
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {uploadToast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-[70]">
          <div
            className={`max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${
              uploadToast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
            role="status"
            aria-live="polite"
          >
            {uploadToast.message}
          </div>
        </div>
      ) : null}
      {editingPartNo ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#002d54]">编辑配件</p>
                <p className="text-xs text-zinc-500">{editingPartNo}</p>
              </div>
              <button
                type="button"
                onClick={closeEditPart}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                关闭
              </button>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                零件号 (part_no) *
                <input
                  value={editPartForm.part_no}
                  onChange={(e) =>
                    setEditPartForm((prev) => ({ ...prev, part_no: e.target.value }))
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono text-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                品牌 *
                <input
                  value={editPartForm.brand}
                  onChange={(e) =>
                    setEditPartForm((prev) => ({ ...prev, brand: e.target.value }))
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 md:col-span-2">
                中文名 (name_ch) *
                <input
                  value={editPartForm.name_ch}
                  onChange={(e) =>
                    setEditPartForm((prev) => ({ ...prev, name_ch: e.target.value }))
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                英文名
                <input
                  value={editPartForm.name_en}
                  onChange={(e) =>
                    setEditPartForm((prev) => ({ ...prev, name_en: e.target.value }))
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                法文名
                <input
                  value={editPartForm.name_fr}
                  onChange={(e) =>
                    setEditPartForm((prev) => ({ ...prev, name_fr: e.target.value }))
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                阿拉伯文名
                <input
                  value={editPartForm.name_ar}
                  onChange={(e) =>
                    setEditPartForm((prev) => ({ ...prev, name_ar: e.target.value }))
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                价格
                <input
                  value={editPartForm.price}
                  onChange={(e) =>
                    setEditPartForm((prev) => ({ ...prev, price: e.target.value }))
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-zinc-600">配件图片（JPEG）</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                    {editPartForm.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={editPartForm.image_path}
                        alt={editPartForm.part_no}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                        无图
                      </span>
                    )}
                  </div>
                  <input
                    ref={editImageInputRef}
                    type="file"
                    accept="image/jpeg,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setEditImageFile(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => editImageInputRef.current?.click()}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    {editPartForm.image_path ? "替换图片" : "上传图片"}
                  </button>
                  <span className="text-xs text-zinc-500">
                    {editImageFile
                      ? `已选择：${editImageFile.name}`
                      : editPartForm.image_path
                        ? "当前已有图片，上传将覆盖"
                        : "当前无图片，上传将新增"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
              <button
                type="button"
                onClick={closeEditPart}
                disabled={savingEditPart}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitEditPart()}
                disabled={savingEditPart}
                className="rounded-lg bg-[#002d54] px-4 py-2 text-sm font-medium text-white hover:bg-[#003d6e] disabled:opacity-60"
              >
                {savingEditPart ? "保存中…" : "保存修改"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {previewOpen ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#002d54]">图片预览</p>
                <p className="text-xs text-zinc-500">{previewPartNo}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                关闭
              </button>
            </div>
            <div className="max-h-[70vh] min-h-[280px] overflow-auto p-4">
              {previewLoading ? (
                <p className="text-sm text-zinc-600">加载中…</p>
              ) : previewError ? (
                <p className="text-sm text-rose-700">{previewError}</p>
              ) : previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSrc}
                  alt={previewPartNo}
                  className="mx-auto max-h-[65vh] w-auto max-w-full rounded-lg border border-zinc-200 bg-zinc-50 object-contain"
                />
              ) : (
                <p className="text-sm text-zinc-500">暂无可预览图片</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[#002d54] md:text-3xl">
          配件图片管理
        </h1>
        <p className="mt-2 text-sm text-zinc-600 md:text-base">
          上传以零件号命名的 JPEG 图片（例如{" "}
          <span className="font-mono">1000645680.jpg</span>），文件会保存到{" "}
          <span className="font-mono text-zinc-800">/public/images/parts/</span>{" "}
          ，并同步更新数据库中的{" "}
          <span className="font-mono">image_path</span>。
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 md:p-6">
        <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
          访问密钥（可选）
        </h2>
        <p className="mt-1 text-xs text-zinc-600 md:text-sm">
          如果服务端设置了{" "}
          <span className="font-mono">ADMIN_UPLOAD_KEY</span>，请在此填写相同值。
          该值仅保存在当前浏览器会话中。
        </p>
        <input
          type="password"
          autoComplete="off"
          value={adminKey}
          onChange={(e) => persistKey(e.target.value)}
          className="mt-3 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          placeholder="ADMIN_UPLOAD_KEY"
        />
      </section>

      <section className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === "upload"
              ? "bg-[#002d54] text-white"
              : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          图片上传与记录
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("create")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === "create"
              ? "bg-[#002d54] text-white"
              : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          新增配件
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === "settings"
              ? "bg-[#002d54] text-white"
              : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          汇率配置
        </button>
      </section>

      {activeTab === "create" ? (
        <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
          <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
            新增配件数据
          </h2>
          <p className="mt-1 text-xs text-zinc-600 md:text-sm">
            新增后会自动回到「图片上传与记录」并按该 OEM No.
            搜索。可选 JPEG：创建成功后会立即按该零件号上传。
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={createForm.part_no}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, part_no: e.target.value }))
              }
              placeholder="零件号 (part_no) *"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
            />
            <input
              value={createForm.brand}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, brand: e.target.value }))
              }
              placeholder="品牌 *"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={createForm.name_ch}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name_ch: e.target.value }))
              }
              placeholder="中文名 (name_ch) *"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              value={createForm.name_en}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name_en: e.target.value }))
              }
              placeholder="英文名（可选）"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={createForm.name_fr}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name_fr: e.target.value }))
              }
              placeholder="法文名（可选）"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={createForm.name_ar}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name_ar: e.target.value }))
              }
              placeholder="阿拉伯文名（可选）"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={createForm.price}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, price: e.target.value }))
              }
              placeholder="价格（可选）"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="md:col-span-2">
              <input
                ref={createImageInputRef}
                type="file"
                accept="image/jpeg,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setCreateImageFile(f);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => createImageInputRef.current?.click()}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                >
                  选择配件图片（JPEG，可选）
                </button>
                <span className="text-xs text-zinc-500">
                  {createImageFile
                    ? createImageFile.name
                    : "未选择文件则仅创建数据"}
                </span>
                {createImageFile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateImageFile(null);
                      if (createImageInputRef.current)
                        createImageInputRef.current.value = "";
                    }}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    清除图片
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void submitCreatePart()}
              disabled={creatingPart}
              className="rounded-xl bg-[#002d54] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#003d6e] disabled:opacity-60"
            >
              {creatingPart
                ? "提交中…"
                : createImageFile
                  ? "新增并上传图片"
                  : "新增并进入上传流程"}
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === "settings" ? (
        <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
          <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
            汇率配置
          </h2>
          <p className="mt-1 text-xs text-zinc-600 md:text-sm">
            设置 1 USD = ? CNY。非中文语言下，配件价格将按该汇率自动换算并保留 2 位小数。
          </p>
          <div className="mt-4 grid gap-3 md:max-w-md">
            <label className="text-xs text-zinc-600">USD 汇率（1 USD = ? CNY）</label>
            <input
              value={usdCnyRateInput}
              onChange={(e) => setUsdCnyRateInput(e.target.value)}
              placeholder="例如：7.20"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void saveCurrencySetting()}
                disabled={savingRate}
                className="rounded-xl bg-[#002d54] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#003d6e] disabled:opacity-60"
              >
                {savingRate ? "保存中…" : "保存汇率"}
              </button>
              <button
                type="button"
                onClick={() => void loadCurrencySetting()}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                刷新
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              最后更新时间：{formatUploadedAt(usdCnyRateSavedAt)}
            </p>
          </div>
        </section>
      ) : null}

      {activeTab === "upload" ? (
      <>
      <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
              上传记录列表
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              筛选与页码会保存在本机（localStorage），刷新后保留。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadUploadedList(uploadedPage)}
            disabled={uploadedLoading}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadedLoading ? "刷新中…" : "刷新"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "全部"],
              ["success", "成功"],
              ["failed", "失败"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setUploadedFilter(key);
                setUploadedPage(1);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                uploadedFilter === key
                  ? "bg-[#002d54] text-white"
                  : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={uploadedLoading || uploadedPage <= 1}
            onClick={() => void loadUploadedList(uploadedPage - 1)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一页
          </button>
          <button
            type="button"
            disabled={uploadedLoading || uploadedPage * PAGE_SIZE >= uploadedTotal}
            onClick={() => void loadUploadedList(uploadedPage + 1)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
          </button>
          <span className="text-xs text-zinc-500">
            第 {uploadedPage} 页 · 共 {uploadedTotal} 条
          </span>
        </div>

        {recentFailedItems.length > 0 ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
            <p className="text-xs font-semibold text-rose-700">
              近期上传失败（已保存本机，{recentFailedItems.length}）
            </p>
            <p className="mt-0.5 text-[11px] text-rose-600/90">
              含历史批次；刷新页面后仍会显示（localStorage，最多 {RECENT_FAILURES_CAP}{" "}
              条）。
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-rose-200 text-rose-700">
                    <th className="px-2 py-1.5 font-medium">零件号</th>
                    <th className="px-2 py-1.5 font-medium">错误信息</th>
                    <th className="px-2 py-1.5 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFailedItems.map((row) => (
                    <tr key={`${row.part_no}-${row.error || ""}`} className="border-b border-rose-100 last:border-0">
                      <td className="px-2 py-1.5 font-mono">{row.part_no}</td>
                      <td className="px-2 py-1.5 text-zinc-700">{row.error || "未知错误"}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              addFailedRecordToQueue(
                                minimalFailedUploadedItem(row.part_no, row.error)
                              )
                            }
                            className="rounded border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-medium text-rose-800 hover:bg-rose-50"
                          >
                            加入待处理
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openCreateFromFailed(row.part_no, {
                                error: row.error,
                              })
                            }
                            className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                              isPartNotFoundMessage(row.error)
                                ? "border-[#002d54] bg-[#002d54]/10 text-[#002d54]"
                                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            新增配件
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 text-xs uppercase tracking-wide text-zinc-600">
                <th className="px-3 py-2 font-medium">记录时间</th>
                <th className="px-3 py-2 font-medium">零件号</th>
                <th className="px-3 py-2 font-medium">品牌</th>
                <th className="px-3 py-2 font-medium">零件名（中文）</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">错误信息</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {uploadedItems.map((row) => (
                <tr key={`${row.part_no}-${row.record_at || row.image_uploaded_at || ""}`} className="border-b border-zinc-100 last:border-0">
                  <td className="px-3 py-2 text-xs text-zinc-700">
                    {formatUploadedAt(row.record_at || row.image_upload_failed_at || row.image_uploaded_at)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-900">
                    {row.part_no}
                  </td>
                  <td className="px-3 py-2 text-zinc-800">{row.brand}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-zinc-700" title={row.name_ch}>
                    {row.name_ch}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        row.record_status === "failed"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {row.record_status === "failed" ? "失败" : "成功"}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-zinc-600" title={row.image_upload_error || ""}>
                    {row.image_upload_error || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.record_status === "failed" ? (
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => addFailedRecordToQueue(row)}
                          className="rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-1.5 text-xs font-medium text-rose-800 transition hover:bg-rose-100/80"
                        >
                          加入待处理
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openCreateFromFailed(row.part_no, {
                              brand: row.brand,
                              name_ch: row.name_ch,
                              error: row.image_upload_error,
                            })
                          }
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                            isPartNotFoundMessage(row.image_upload_error)
                              ? "border-[#002d54] bg-[#002d54]/10 text-[#002d54] hover:bg-[#002d54]/15"
                              : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                          }`}
                        >
                          新增配件
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void openUploadedPreview(row.part_no)}
                        className="rounded-lg border border-[#002d54]/30 bg-white px-2.5 py-1.5 text-xs font-medium text-[#002d54] transition hover:bg-[#002d54]/5"
                      >
                        查看
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {uploadedItems.length === 0 && !uploadedLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">
                    暂无上传记录。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
          批量上传
        </h2>
        <p className="mt-1 text-xs text-zinc-600 md:text-sm">
          可一次选择多张 JPEG 图片。系统会使用每个文件名（不含扩展名）作为零件号。
          也可通过接口直接传入{" "}
          <span className="font-mono">part_nos</span>。
        </p>
        <input
          ref={batchFileRef}
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={onBatchFileChange}
        />
        <button
          type="button"
          onClick={() => batchFileRef.current?.click()}
          className="mt-4 rounded-xl bg-[#002d54] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#003d6e]"
        >
          选择图片（JPEG）
        </button>
      </section>

      <section className="mb-10 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
              待处理列表
            </h2>
            <p className="mt-1 text-xs text-zinc-600 md:text-sm">
              保存在本机浏览器（localStorage），刷新不丢失。上传成功自动标为「已处理」。
              已有图片的行加入时会直接记为已处理。
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              待处理 {pendingCount} 条 · 已完成 {doneCount} 条 · 上传失败来源{" "}
              {uploadFailedQueueCount} 条 · 共 {queue.length} 条
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportPendingCsv}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
            >
              导出待处理 CSV
            </button>
            <button
              type="button"
              onClick={clearCompleted}
              disabled={doneCount === 0}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              清空已完成
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["pending", "待处理"],
              ["done", "已处理"],
              ["upload_failed", "上传失败"],
              ["all", "全部"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setQueueFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                queueFilter === key
                  ? "bg-[#002d54] text-white"
                  : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          ref={queueBatchFileRef}
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={onQueueBatchFileChange}
        />
        <button
          type="button"
          onClick={() => queueBatchFileRef.current?.click()}
          className="mt-3 rounded-lg border border-[#002d54]/40 bg-white px-3 py-2 text-sm font-medium text-[#002d54] transition hover:bg-[#002d54]/5"
        >
          批量上传（按文件名零件号，成功后同步队列状态）
        </button>

        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 text-xs uppercase tracking-wide text-zinc-600">
                <th className="px-3 py-2 font-medium">Thumb</th>
                <th className="px-3 py-2 font-medium">零件号</th>
                <th className="px-3 py-2 font-medium">品牌</th>
                <th className="px-3 py-2 font-medium">零件名（中文）</th>
                <th className="px-3 py-2 font-medium">来源</th>
                <th className="px-3 py-2 font-medium">最近失败</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.map((row) => {
                const src = row.image_path || undefined;
                return (
                  <tr
                    key={row.part_no}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-3 py-2">
                      <div className="relative h-12 w-12 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                        {src ? (
                          <Image
                            src={src}
                            alt=""
                            fill
                            className="object-contain"
                            sizes="48px"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-900">
                      {row.part_no}
                    </td>
                    <td className="px-3 py-2 text-zinc-800">{row.brand}</td>
                    <td
                      className="max-w-xs truncate text-zinc-700"
                      title={row.name_ch}
                    >
                      {row.name_ch}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.queue_source === "upload_failed"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-zinc-200/80 text-zinc-700"
                        }`}
                      >
                        {row.queue_source === "upload_failed"
                          ? "上传失败"
                          : "搜索"}
                      </span>
                    </td>
                    <td
                      className="max-w-[140px] truncate px-3 py-2 text-xs text-zinc-500"
                      title={row.last_upload_error || ""}
                    >
                      {row.last_upload_error || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.status === "done"
                            ? "text-emerald-700"
                            : "text-amber-800"
                        }
                      >
                        {row.status === "done" ? "已处理" : "待处理"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetPartNo(row.part_no);
                            rowFileRef.current?.click();
                          }}
                          className="rounded-lg border border-[#002d54]/30 bg-white px-2 py-1 text-xs font-medium text-[#002d54] transition hover:bg-[#002d54]/5"
                        >
                          {row.status === "done" ? "重新上传" : "上传"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQueueItem(row.part_no)}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-50"
                        >
                          移除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredQueue.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-sm text-zinc-500"
                  >
                    {queue.length === 0
                      ? "暂无条目。在下方搜索结果中点击「加入待处理」，或在上传记录失败行点击「加入待处理」。"
                      : queueFilter === "upload_failed"
                        ? "暂无「上传失败」来源条目。"
                        : "当前筛选下没有条目。"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
          搜索配件
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-medium text-zinc-700" htmlFor="q">
              关键词（至少 2 个字符）
            </label>
            <input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch(1)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
              placeholder="例如：WG9719230015 或 关键词"
            />
          </div>
          <button
            type="button"
            onClick={() => void runSearch(1)}
            disabled={loading}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {loading ? "搜索中…" : "搜索"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => void runSearch(page - 1)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一页
          </button>
          <button
            type="button"
            disabled={loading || page * PAGE_SIZE >= total}
            onClick={() => void runSearch(page + 1)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
          </button>
          <span className="text-xs text-zinc-500">
            每页 {PAGE_SIZE} 条（全库模糊匹配总数见上方状态）
          </span>
        </div>

        {status ? (
          <p className="mt-3 text-sm text-zinc-700" role="status">
            {status}
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 text-xs uppercase tracking-wide text-zinc-600">
                <th className="px-3 py-2 font-medium">缩略图</th>
                <th className="px-3 py-2 font-medium">零件号</th>
                <th className="px-3 py-2 font-medium">品牌</th>
                <th className="px-3 py-2 font-medium">零件名（中文）</th>
                <th className="px-3 py-2 font-medium">图片路径</th>
                <th className="px-3 py-2 font-medium">上传</th>
                <th className="px-3 py-2 font-medium">待处理</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const no = p.partNumber || p.id;
                const inQueue = queue.some((x) => x.part_no === no);
                const src = p.imageUrl || p.imagePath;
                return (
                  <tr
                    key={no}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-3 py-2">
                      <div className="relative h-12 w-12 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                        {src ? (
                          <Image
                            src={src}
                            alt=""
                            fill
                            className="object-contain"
                            sizes="48px"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-900">
                      {no}
                    </td>
                    <td className="px-3 py-2 text-zinc-800">{p.brand}</td>
                    <td className="max-w-xs truncate text-zinc-700" title={p.name}>
                      {p.name ?? p.nameEn}
                    </td>
                    <td className="max-w-[200px] truncate font-mono text-xs text-zinc-500">
                      {p.imagePath ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetPartNo(no);
                          rowFileRef.current?.click();
                        }}
                        className="rounded-lg border border-[#002d54]/30 bg-white px-2.5 py-1.5 text-xs font-medium text-[#002d54] transition hover:bg-[#002d54]/5"
                      >
                        上传 / 覆盖
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {inQueue ? (
                        <span className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-500">
                          已加入待处理
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddPending(p)}
                          className="rounded-lg border border-amber-600/35 bg-amber-50/80 px-2.5 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100/90"
                        >
                          加入待处理
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => openEditPart(p)}
                        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-sm text-zinc-500"
                  >
                    暂无数据，请先执行搜索。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <input
        ref={rowFileRef}
        type="file"
        accept="image/jpeg,.jpg,.jpeg"
        className="hidden"
        onChange={onRowFileChange}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
          品牌占位图预览
        </h2>
        <p className="mt-1 text-xs text-zinc-600 md:text-sm">
          站点其他位置使用的默认品牌占位图（非配件实拍图）。
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {PLACEHOLDERS.map(({ brand, src }) => (
            <div
              key={brand}
              className="flex flex-col items-center rounded-xl border border-zinc-100 bg-zinc-50/80 p-4"
            >
              <p className="mb-3 text-sm font-medium text-zinc-800">{brand}</p>
              <div className="relative h-24 w-40">
                <Image
                  src={src}
                  alt={`${brand} placeholder`}
                  fill
                  className="object-contain"
                  sizes="160px"
                />
              </div>
              <p className="mt-2 font-mono text-xs text-zinc-500">{src}</p>
            </div>
          ))}
        </div>
      </section>
      </>
      ) : null}
    </div>
  );
}
