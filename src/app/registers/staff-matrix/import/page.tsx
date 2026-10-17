// REQ-024 Session C (FR-13): the staff matrix takes a spreadsheet through the shared import page and form (REQ-020 FR-8).
import type { Metadata } from "next";
import { ImportPage } from "../../_components/import-page";

export const metadata: Metadata = { title: "Staff matrix: import" };

export default async function Page() {
  return <ImportPage register="staff_matrix" />;
}
