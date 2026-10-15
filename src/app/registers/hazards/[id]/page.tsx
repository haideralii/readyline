// REQ-020 FR-7, on REQ-018 Session B's pattern (D-1904): one route file per page; the words and fields come from the register meta.
import type { Metadata } from "next";
import { AuditDayDetailPage } from "../../_components/audit-day-pages";

export const metadata: Metadata = { title: "Hazard register" };

export default async function Page({
  params,
}: PageProps<"/registers/hazards/[id]">) {
  const { id } = await params;
  return <AuditDayDetailPage slug="hazards" id={id} />;
}
