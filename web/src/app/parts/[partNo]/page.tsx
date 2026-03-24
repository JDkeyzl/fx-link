import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchPartByPartNo,
  getSiteOrigin,
  type SqlitePartDetail,
} from "@/lib/partsApi";
import { PartDetailClient } from "./PartDetailClient";

type PageProps = {
  params: Promise<{ partNo: string }>;
};

function productJsonLd(part: SqlitePartDetail, canonicalUrl: string) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${part.brand} ${part.part_no}`,
    description: part.name_en,
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
  const { partNo } = await params;
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
    const title = `${part.part_no} – ${part.brand} | Crealink`;
    const description = `${part.brand} truck spare part ${part.part_no}. ${part.name_en}. Reference price ¥${Number(part.price).toFixed(2)} CNY.`;
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
  const { partNo } = await params;
  const site = getSiteOrigin();
  const canonicalUrl = `${site}/parts/${encodeURIComponent(partNo)}`;

  let part: SqlitePartDetail | null;
  try {
    part = await fetchPartByPartNo(partNo);
  } catch {
    throw new Error("Parts API unavailable. Is the backend running on 3001?");
  }
  if (!part) notFound();

  const jsonLd = productJsonLd(part, canonicalUrl);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
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
      <p className="mb-8 text-sm text-zinc-600 md:text-base">
        {part.brand} · {part.name_en}
      </p>
      <PartDetailClient part={part} />
    </div>
  );
}
