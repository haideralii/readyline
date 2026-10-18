// REQ-033 FR-3 (D-1904's shape): one finding typed by hand; "Add findings" from a report is the import page.
import type { Metadata } from "next";
import { AuditDayNewPage } from "../../_components/audit-day-pages";

export const metadata: Metadata = { title: "Audit findings register: add" };

export default async function Page({
  searchParams,
}: PageProps<"/registers/findings/new">) {
  const sp = await searchParams;
  const prefill = Object.fromEntries(
    Object.entries(sp).filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  return <AuditDayNewPage slug="findings" prefill={prefill} />;
}
