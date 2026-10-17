// REQ-023 FR-10 (Session D), REQ-020 FR-8 and FR-12: one route file per importable register; the page and the form are shared.
import type { Metadata } from "next";
import { ImportPage } from "../../_components/import-page";

export const metadata: Metadata = {
  title: "Changes we told the Commission: import",
};

export default async function Page() {
  return <ImportPage register="commission_changes" />;
}
