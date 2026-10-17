// REQ-023 FR-10 (Session D), on REQ-018 Session B's pattern (D-1904): one route file per page; the words and fields come from the register meta.
import type { Metadata } from "next";
import { AuditDayNewPage } from "../../_components/audit-day-pages";

export const metadata: Metadata = { title: "Changes we told the Commission" };

/** The two add links on the list start the form with the kind chosen; the change type follows on the form. */
export default async function Page({
  searchParams,
}: PageProps<"/registers/commission-changes/new">) {
  const sp = await searchParams;
  return (
    <AuditDayNewPage
      slug="commission-changes"
      prefill={{
        kind: typeof sp.kind === "string" ? sp.kind : undefined,
        change_type:
          typeof sp.change_type === "string" ? sp.change_type : undefined,
      }}
    />
  );
}
