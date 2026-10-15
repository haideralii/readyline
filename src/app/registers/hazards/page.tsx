// REQ-020 FR-7, on REQ-018 Session B's pattern (D-1904): one route file per page; the words and fields come from the register meta.
import type { Metadata } from "next";
import { AuditDayListPage } from "../_components/audit-day-pages";

export const metadata: Metadata = { title: "Hazard register" };

export default async function Page({
  searchParams,
}: PageProps<"/registers/hazards">) {
  const sp = await searchParams;
  return (
    <AuditDayListPage
      slug="hazards"
      saved={typeof sp.saved === "string" ? sp.saved : undefined}
    />
  );
}
