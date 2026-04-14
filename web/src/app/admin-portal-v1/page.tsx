import type { Metadata } from "next";
import { AdminPortalClient } from "./AdminPortalClient";

export const metadata: Metadata = {
  title: "Admin – Part images",
  robots: { index: false, follow: false },
};

export default function AdminPortalPage() {
  return <AdminPortalClient />;
}
