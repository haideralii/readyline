// REQ-018 Session B (D-1904): one route file per page; the words and fields come from the register meta.
import type { Metadata } from "next";
import { AuditDayListPage } from "../_components/audit-day-pages";

export const metadata: Metadata = { title: "Insurances and vehicles register" };

export default async function Page({
  searchParams,
}: PageProps<"/registers/insurances">) {
  const sp = await searchParams;
  return (
    <AuditDayListPage
      slug="insurances"
      saved={typeof sp.saved === "string" ? sp.saved : undefined}
    />
  );
}
