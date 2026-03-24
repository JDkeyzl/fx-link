"use client";

import type { SqlitePartDetail } from "@/lib/partsApi";
import { useI18n } from "@/context/LocaleContext";

const DEFAULT_WA = "8618746232944";

function buildWhatsAppHref(part: SqlitePartDetail): string {
  const num = process.env.NEXT_PUBLIC_WHATSAPP_E164 || DEFAULT_WA;
  const text = `Hello Crealink, I would like a quote for part ${part.part_no} (${part.brand}). Name: ${part.name_en}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export function PartDetailClient({ part }: { part: SqlitePartDetail }) {
  const { t } = useI18n();
  const wa = buildWhatsAppHref(part);

  return (
    <div className="space-y-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <table className="w-full text-left text-sm md:text-base">
          <tbody>
            <tr className="border-b border-gray-100 bg-[#f8f9fa]">
              <th className="w-[32%] px-4 py-3 font-semibold text-[#002d54]">
                {t("partDetail.name")}
              </th>
              <td className="px-4 py-3 text-zinc-800">{part.name_en}</td>
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
    </div>
  );
}
