// REQ-018 Session B (D-1904): one route file per page; the words and fields come from the register meta.
import type { Metadata } from "next";
import { AuditDayNewPage } from "../../_components/audit-day-pages";

export const metadata: Metadata = { title: "Onboarding checklists: add" };

export default async function Page({
  searchParams,
}: PageProps<"/registers/onboarding/new">) {
  const sp = await searchParams;
  const prefill = Object.fromEntries(
    Object.entries(sp).filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  return <AuditDayNewPage slug="onboarding" prefill={prefill} />;
}
