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

/** Matches backend max (100); admin uses 50 per page for manageable batches. */
const PAGE_SIZE = 50;

export type PendingItem = {
  part_no: string;
  brand: string;
  name_ch: string;
  image_path?: string | null;
  status: "pending" | "done";
  addedAt: string;
  processedAt?: string;
};

function loadQueue(): PendingItem[] {
  try {
    const raw = localStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is PendingItem =>
        Boolean(x) &&
        typeof (x as PendingItem).part_no === "string" &&
        ((x as PendingItem).status === "pending" ||
          (x as PendingItem).status === "done")
    );
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

function makePendingItem(p: Part): PendingItem {
  const no = p.partNumber || p.id;
  const hasImg = Boolean(p.imagePath || p.imageUrl);
  return {
    part_no: no,
    brand: p.brand,
    name_ch: p.name ?? p.nameEn ?? "",
    image_path: p.imagePath ?? p.imageUrl ?? null,
    status: hasImg ? "done" : "pending",
    addedAt: new Date().toISOString(),
    ...(hasImg ? { processedAt: new Date().toISOString() } : {}),
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
  const [targetPartNo, setTargetPartNo] = useState<string | null>(null);
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [queueFilter, setQueueFilter] = useState<"all" | "pending" | "done">(
    "pending"
  );

  const rowFileRef = useRef<HTMLInputElement>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);
  const queueBatchFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s) setAdminKey(s);
    } catch {
      /* ignore */
    }
    setQueue(loadQueue());
  }, []);

  const persistKey = useCallback((k: string) => {
    setAdminKey(k);
    try {
      sessionStorage.setItem(STORAGE_KEY, k);
    } catch {
      /* ignore */
    }
  }, []);

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
      results?: { part_no: string; ok: boolean }[];
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
        setStatus(
          `Upload failed (${res.status}): ${typeof json === "object" && json && "message" in json ? String((json as { message?: string }).message) : text}`
        );
        return { ok: false };
      }
      const summary = json as {
        count?: number;
        results?: { part_no: string; ok: boolean; error?: string }[];
      };
      const failed = (summary.results ?? []).filter((r) => !r.ok);
      setStatus(
        `Uploaded OK: ${summary.count ?? 0} file(s).` +
          (failed.length ? ` Failed: ${failed.map((f) => f.part_no).join(", ")}` : "")
      );
      return { ok: true, results: summary.results };
    },
    [adminKey]
  );

  const runSearch = useCallback(
    async (targetPage = 1) => {
      const q = query.trim();
      if (q.length < 2) {
        setStatus("Enter at least 2 characters to search.");
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
        if (!res.ok) throw new Error("Search failed");
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
        setStatus(e instanceof Error ? e.message : "Search failed");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

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
  };

  const filteredQueue = queue.filter((item) => {
    if (queueFilter === "pending") return item.status === "pending";
    if (queueFilter === "done") return item.status === "done";
    return true;
  });

  const pendingCount = queue.filter((x) => x.status === "pending").length;
  const doneCount = queue.filter((x) => x.status === "done").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[#002d54] md:text-3xl">
          Part image admin
        </h1>
        <p className="mt-2 text-sm text-zinc-600 md:text-base">
          Upload JPEG images named as the OEM part number (e.g.{" "}
          <span className="font-mono">1000645680.jpg</span>). Files are stored
          under{" "}
          <span className="font-mono text-zinc-800">/public/images/parts/</span>{" "}
          and the database <span className="font-mono">image_path</span> is
          updated.
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 md:p-6">
        <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
          Access key (optional)
        </h2>
        <p className="mt-1 text-xs text-zinc-600 md:text-sm">
          If the server sets{" "}
          <span className="font-mono">ADMIN_UPLOAD_KEY</span>, paste the same
          value here. It is kept in session storage only on this browser.
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

      <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-[#002d54] md:text-base">
          Batch upload
        </h2>
        <p className="mt-1 text-xs text-zinc-600 md:text-sm">
          Select multiple JPEG files. Part numbers are taken from each filename
          (without extension). You can also use{" "}
          <span className="font-mono">part_nos</span> from the API directly.
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
          Choose images (JPEG)
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
              待处理 {pendingCount} 条 · 已完成 {doneCount} 条 · 共 {queue.length}{" "}
              条
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
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 text-xs uppercase tracking-wide text-zinc-600">
                <th className="px-3 py-2 font-medium">Thumb</th>
                <th className="px-3 py-2 font-medium">OEM No.</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">零件名（中文）</th>
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
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-zinc-500"
                  >
                    {queue.length === 0
                      ? "暂无条目。在下方搜索结果中点击「加入待处理」。"
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
          Search parts
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-medium text-zinc-700" htmlFor="q">
              Query (min 2 chars)
            </label>
            <input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch(1)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
              placeholder="WG9719230015 or keyword"
            />
          </div>
          <button
            type="button"
            onClick={() => void runSearch(1)}
            disabled={loading}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {loading ? "Searching…" : "Search"}
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
                <th className="px-3 py-2 font-medium">Thumb</th>
                <th className="px-3 py-2 font-medium">OEM No.</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">零件名（中文）</th>
                <th className="px-3 py-2 font-medium">Image path</th>
                <th className="px-3 py-2 font-medium">上传</th>
                <th className="px-3 py-2 font-medium">待处理</th>
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
                        Upload / replace
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
                  </tr>
                );
              })}
              {items.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-sm text-zinc-500"
                  >
                    No rows yet. Run a search.
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
          Brand placeholder previews
        </h2>
        <p className="mt-1 text-xs text-zinc-600 md:text-sm">
          Default brand marks used elsewhere on the site (not per-part images).
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
    </div>
  );
}
