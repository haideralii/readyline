// REQ-018 Session B (D-1904): one route file per page; the words and fields come from the register meta.
import type { Metadata } from "next";
import { AuditDayDetailPage } from "../../_components/audit-day-pages";

export const metadata: Metadata = { title: "Record of decisions" };

export default async function Page({
  params,
}: PageProps<"/registers/decisions/[id]">) {
  const { id } = await params;
  return <AuditDayDetailPage slug="decisions" id={id} />;
}
