import type { Metadata } from "next";
import DeskReviewClient from "./DeskReviewClient";

export const metadata: Metadata = {
  title: "CreaLink Chat Review – CreaLink",
  description: "Sales review of CreaLink Chat contacts and quote drafts.",
  robots: { index: false, follow: false },
};

export default function DeskReviewPage() {
  return <DeskReviewClient />;
}
