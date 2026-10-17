// REQ-023 FR-10 (Session D), on REQ-018 Session B's pattern (D-1904): one route file per page; the words and fields come from the register meta.
import type { Metadata } from "next";
import { AuditDayDetailPage } from "../../_components/audit-day-pages";

export const metadata: Metadata = { title: "Changes we told the Commission" };

export default async function Page({
  params,
}: PageProps<"/registers/commission-changes/[id]">) {
  const { id } = await params;
  return <AuditDayDetailPage slug="commission-changes" id={id} />;
}
