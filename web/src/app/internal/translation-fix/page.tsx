import type { Metadata } from "next";
import TranslationFixClient from "@/components/admin/TranslationFixClient";

export const metadata: Metadata = {
  title: "译文纠错台",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function TranslationFixPage() {
  return <TranslationFixClient />;
}

