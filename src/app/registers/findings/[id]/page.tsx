// REQ-033 FR-3, FR-4 (D-1904's shape): one route file per page; the words and fields come from the
// register meta, and the detail page adds where the pack answers the finding.
import type { Metadata } from "next";
import { AuditDayDetailPage } from "../../_components/audit-day-pages";

export const metadata: Metadata = { title: "Audit findings register" };

export default async function Page({
  params,
}: PageProps<"/registers/findings/[id]">) {
  const { id } = await params;
  return <AuditDayDetailPage slug="findings" id={id} />;
}
