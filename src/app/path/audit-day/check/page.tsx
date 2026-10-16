import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auditDayAskList } from "@/lib/registers/audit-day-ask";
import { AUDIT_DAY_RECORDS } from "@/lib/registers/names";
import { selfCheckRecordIds } from "@/lib/registers/self-check";
import { getViewer } from "@/server/accounts/queries";
import { auditDayOverview } from "@/server/registers/audit-day-queries";
import { documentControlForAccount } from "@/server/registers/document-control-queries";
import { registerOverview } from "@/server/registers/queries";
import { hasActiveSubscription } from "@/server/registers/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { CheckWalk, type WalkRecord } from "./check-walk";

export const metadata: Metadata = { title: "Check my systems" };

function todaySydney(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The quarterly self-check walk (REQ-020 FR-9): one screen per record on the audit-day list. */
export default async function CheckPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fpath%2Faudit-day%2Fcheck");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const supabase = await createSupabaseServerClient();
  const canWrite = await hasActiveSubscription(supabase, viewer.account.id);
  if (!canWrite) redirect("/path/audit-day");
  const [registers, auditDay, documentControl] = await Promise.all([
    registerOverview(supabase, viewer.account.id),
    auditDayOverview(supabase, viewer.account.id),
    documentControlForAccount(supabase, viewer.account.id),
  ]);
  const asks = auditDayAskList({
    registers,
    auditDay,
    documentControl: documentControl.rows,
  });
  const names = new Map(AUDIT_DAY_RECORDS.map((r) => [r.id, r.name]));
  const records: WalkRecord[] = selfCheckRecordIds().map((id) => {
    const ask = asks.find((a) => a.id === id);
    return {
      id,
      name: names.get(id) ?? id,
      word: ask?.word ?? "",
      state: ask?.state ?? "missing",
      href: ask?.href ?? "/registers",
    };
  });
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm">
        <Link
          href="/path/audit-day"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Audit day
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Check my systems
      </h1>
      <p className="text-ink mt-3 leading-7">
        One question per record, yes or no. Every no becomes a row in your
        improvement register with a date 30 days out. About ten minutes.
      </p>
      <CheckWalk records={records} today={todaySydney()} />
    </div>
  );
}
