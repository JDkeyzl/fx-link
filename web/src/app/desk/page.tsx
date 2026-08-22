import type { Metadata } from "next";
import DeskPageClient from "./DeskPageClient";

export const metadata: Metadata = {
  title: "CreaLink Chat – CreaLink",
  description:
    "Talk with CreaLink Chat to clarify RFQ needs and look up catalogue reference prices.",
};

export default function DeskPage() {
  return <DeskPageClient />;
}
