import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  localeFromAcceptLanguage,
  partDisplayName,
  tLocale,
} from "@/lib/i18n";
import {
  fetchPartByPartNo,
  fetchRelatedParts,
  getSiteOrigin,
  normalizePartNoFromRouteParam,
  type SqlitePartDetail,
} from "@/lib/partsApi";
import { PartDetailClient } from "./PartDetailClient";

/** Avoid caching a mistaken 404 if encoding or data was fixed later. */
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ partNo: string }>;
};

function productJsonLd(
  part: SqlitePartDetail,
  canonicalUrl: string,
  seoLocale: ReturnType<typeof localeFromAcceptLanguage>
) {
  const price = Number(part.price).toFixed(2);
  const name = partDisplayName(part, seoLocale);
  const description = tLocale(seoLocale, "partDetail.seo.schemaDescription", {
    brand: part.brand,
    partNo: part.part_no,
    name,
    price,
  });
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${part.brand} ${part.part_no}`,
    description,
    sku: part.part_no,
    brand: {
      "@type": "Brand",
      name: part.brand,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "CNY",
      price: String(part.price),
      availability: "https://schema.org/InStock",
      url: canonicalUrl,
    },
  };
  return JSON.stringify(schema);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { partNo: rawPartNo } = await params;
  const partNo = normalizePartNoFromRouteParam(rawPartNo);
  const site = getSiteOrigin();
  const canonicalUrl = `${site}/parts/${encodeURIComponent(partNo)}`;

  try {
    const part = await fetchPartByPartNo(partNo);
    if (!part) {
      return {
        title: "Part not found | Crealink",
        robots: { index: false, follow: true },
      };
    }
    const h = await headers();
    const seoLocale = localeFromAcceptLanguage(h.get("accept-language"));
    const price = Number(part.price).toFixed(2);
    const name = partDisplayName(part, seoLocale);
    const title = `${part.part_no} – ${part.brand} | Crealink`;
    const description = tLocale(seoLocale, "partDetail.seo.metaDescription", {
      brand: part.brand,
      partNo: part.part_no,
      name,
      price,
    });
    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        siteName: "Crealink",
        type: "website",
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return { title: "Part | Crealink" };
  }
}

/**
 * SEO: Next.js App Router uses `generateMetadata` + JSON-LD for crawlers (SSR).
 * This replaces react-helmet for correct first-byte meta tags.
 */
export default async function PartDetailPage({ params }: PageProps) {
  const { partNo: rawPartNo } = await params;
  const partNo = normalizePartNoFromRouteParam(rawPartNo);
  const site = getSiteOrigin();
  const canonicalUrl = `${site}/parts/${encodeURIComponent(partNo)}`;

  let part: SqlitePartDetail | null;
  try {
    part = await fetchPartByPartNo(partNo);
  } catch {
    throw new Error("Parts API unavailable. Is the backend running on 3001?");
  }
  if (!part) notFound();

  const h = await headers();
  const seoLocale = localeFromAcceptLanguage(h.get("accept-language"));
  const jsonLd = productJsonLd(part, canonicalUrl, seoLocale);

  let related: SqlitePartDetail[] = [];
  let relatedNameFillCount = 0;
  try {
    const rel = await fetchRelatedParts(part);
    related = rel.items;
    relatedNameFillCount = rel.nameFillCount;
  } catch {
    related = [];
    relatedNameFillCount = 0;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/" className="text-[#002d54] hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">{part.part_no}</span>
      </nav>
      <h1 className="mb-2 text-2xl font-bold text-[#002d54] md:text-3xl">
        {part.part_no}
      </h1>
      <PartDetailClient
        part={part}
        related={related}
        relatedNameFillCount={relatedNameFillCount}
      />
    </div>
  );
}
