// REQ-033 FR-1, FR-3 (D-1904's shape): one route file per page; the words and fields come from the register meta.
import type { Metadata } from "next";
import { AuditDayListPage } from "../_components/audit-day-pages";

export const metadata: Metadata = { title: "Audit findings register" };

export default async function Page({
  searchParams,
}: PageProps<"/registers/findings">) {
  const sp = await searchParams;
  return (
    <AuditDayListPage
      slug="findings"
      saved={typeof sp.saved === "string" ? sp.saved : undefined}
    />
  );
}
