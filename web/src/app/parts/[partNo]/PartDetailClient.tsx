"use client";

import Link from "next/link";
import type { SqlitePartDetail } from "@/lib/partsApi";
import { useI18n } from "@/context/LocaleContext";

const DEFAULT_WA = "8618746232944";

function displayNameForPart(p: SqlitePartDetail, locale: string): string {
  if (locale === "zh") return p.name_ch || p.name_en;
  if (locale === "fr") return p.name_fr || p.name_en;
  if (locale === "ar") return p.name_ar || p.name_en;
  return p.name_en;
}

function buildWhatsAppHref(
  part: SqlitePartDetail,
  displayName: string
): string {
  const num = process.env.NEXT_PUBLIC_WHATSAPP_E164 || DEFAULT_WA;
  const text = `Hello Crealink, I would like a quote for part ${part.part_no} (${part.brand}). Name: ${displayName}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export function PartDetailClient({
  part,
  related = [],
  relatedNameFillCount = 0,
}: {
  part: SqlitePartDetail;
  related?: SqlitePartDetail[];
  /** API: rows from English name token fallback (not part-no prefix). */
  relatedNameFillCount?: number;
}) {
  const { t, locale } = useI18n();

  const displayName = displayNameForPart(part, locale);
  const wa = buildWhatsAppHref(part, displayName);
  const hasRelated = related.length > 0;

  const subtitle = (
    <p className="text-sm text-zinc-600 md:text-base">
      {part.brand} · {displayName}
    </p>
  );

  const structuredSection = (
    <section
      className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-5 md:px-6 md:py-6"
      aria-labelledby="part-overview-heading"
    >
      <div
        className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700 md:text-base"
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <p>
          {t("partDetail.structuredP1", {
            brand: part.brand,
            partNo: part.part_no,
            name: displayName,
          })}
        </p>
        <p>{t("partDetail.structuredP2")}</p>
        <p>{t("partDetail.structuredP3")}</p>
      </div>
    </section>
  );

  const specTable = (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
      <table className="w-full text-left text-sm md:text-base">
        <tbody>
          <tr className="border-b border-gray-100 bg-[#f8f9fa]">
            <th className="w-[32%] px-4 py-3 font-semibold text-[#002d54]">
              {t("partDetail.name")}
            </th>
            <td className="px-4 py-3 text-zinc-800">{displayName}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3 font-semibold text-[#002d54]">
              {t("partDetail.partNumber")}
            </th>
            <td className="px-4 py-3 font-mono text-sm text-zinc-900 break-all">
              {part.part_no}
            </td>
          </tr>
          <tr className="border-b border-gray-100 bg-[#f8f9fa]">
            <th className="px-4 py-3 font-semibold text-[#002d54]">
              {t("partDetail.brand")}
            </th>
            <td className="px-4 py-3 text-zinc-800">{part.brand}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3 font-semibold text-[#002d54]">
              {t("partDetail.category")}
            </th>
            <td className="px-4 py-3 text-zinc-800">
              {t("partDetail.categoryDefault")}
            </td>
          </tr>
          <tr className="bg-[#f8f9fa]">
            <th className="px-4 py-3 font-semibold text-[#002d54]">
              {t("partDetail.priceLabel")}
            </th>
            <td className="px-4 py-3 text-lg font-semibold text-zinc-900">
              ¥ {Number(part.price).toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const contactSection = (
    <section
      id="contact"
      className="rounded-2xl border border-gray-200 bg-gradient-to-br from-[#f0fdf4] to-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] md:p-8"
    >
      <h2 className="text-lg font-semibold text-[#002d54] md:text-xl">
        {t("partDetail.inquirySection")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 md:text-base">
        {t("partDetail.inquiryIntro")}
      </p>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#25D366] px-8 text-base font-bold text-white shadow-lg shadow-[#25D366]/25 transition hover:bg-[#1ebe57] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 focus:ring-offset-2 md:w-auto md:min-w-[280px]"
      >
        {t("partDetail.inquiryWhatsApp")}
      </a>
    </section>
  );

  const relatedAside = hasRelated ? (
    <aside
      className="mt-10 flex min-w-0 shrink-0 flex-col lg:mt-0"
      aria-label={t("partDetail.relatedTitle")}
    >
      <h2 className="shrink-0 text-sm font-semibold text-[#002d54] md:text-base">
        {t("partDetail.relatedTitle")}
      </h2>
      <div className="mt-3 md:mt-3.5">
        <ul className="space-y-0.5">
          {related.map((r, idx) => {
            const name = displayNameForPart(r, locale);
            const href = `/parts/${encodeURIComponent(r.part_no)}`;
            return (
              <li key={r.part_no} className="min-w-0">
                <Link
                  href={href}
                  title={`${name} (${r.part_no})`}
                  className="group block min-w-0 max-w-full truncate rounded-lg px-1 py-1.5 text-left text-xs text-zinc-700 transition-colors duration-200 hover:bg-amber-50/90 hover:text-amber-900 md:-mx-1 md:px-2 md:py-2 md:text-sm"
                >
                  <span className="tabular-nums text-zinc-500 transition-colors group-hover:text-amber-800">
                    {idx + 1}.
                  </span>{" "}
                  <span className="transition-colors group-hover:text-amber-900">
                    {name}
                  </span>{" "}
                  <span className="font-mono text-[0.8em] text-zinc-600 transition-colors group-hover:text-amber-800">
                    ({r.part_no})
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  ) : null;

  if (!hasRelated) {
    return (
      <div className="space-y-10">
        {subtitle}
        {structuredSection}
        {specTable}
        {contactSection}
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 md:mb-8">{subtitle}</div>
      <div className="lg:grid lg:grid-cols-[1fr_minmax(260px,320px)] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-10">
          {structuredSection}
          {specTable}
          {contactSection}
        </div>
        {relatedAside}
      </div>
    </>
  );
}
