// REQ-020 FR-8: one route file per importable register; the page and the form are shared.
import type { Metadata } from "next";
import { ImportPage } from "../../_components/import-page";

export const metadata: Metadata = { title: "Complaints: import" };

export default async function Page() {
  return <ImportPage register="complaints" />;
}
