import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auditDayAskList } from "@/lib/registers/audit-day-ask";
import { AUDIT_DAY_RECORDS } from "@/lib/registers/names";
import {
  CORRECTIVE_ACTION_ID,
  CORRECTIVE_ACTION_NAME,
  rehearsalRecordIds,
  selfCheckRecordIds,
  type RehearsalVariant,
} from "@/lib/registers/self-check";
import { renewalWindowOpens } from "@/lib/registers/timeline";
import { getViewer } from "@/server/accounts/queries";
import { currentPeriod } from "@/server/registers/registration-queries";
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

/**
 * The quarterly self-check walk (REQ-020 FR-9): one screen per record on the
 * audit-day list. REQ-023 FR-8 (Session C): `?mode=rehearsal` runs the same
 * walk as a rehearsal over the period since the last audit (or the whole
 * registration period), writing no improvement row; the mid-term variant,
 * when the current period's mid-term audit is the next audit, leads with
 * the governance records and opens with the corrective-action question.
 */
export default async function CheckPage({
  searchParams,
}: PageProps<"/path/audit-day/check">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fpath%2Faudit-day%2Fcheck");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect(viewer.worker ? "/worker" : "/account/setup");
  const sp = await searchParams;
  const mode = sp.mode === "rehearsal" ? "rehearsal" : "walk";
  const supabase = await createSupabaseServerClient();
  const canWrite = await hasActiveSubscription(supabase, viewer.account.id);
  if (!canWrite) redirect("/path/audit-day");
  const [registers, auditDay, documentControl, period] = await Promise.all([
    registerOverview(supabase, viewer.account.id),
    auditDayOverview(supabase, viewer.account.id),
    documentControlForAccount(supabase, viewer.account.id),
    currentPeriod(supabase, viewer.account.id),
  ]);
  // A rehearsal reads a period; without one the page says so in plain words (FR-8: a rehearsal
  // can be opened at any time, so "no period" is a message, not a refusal; PO 18 Oct 09:05).
  const noPeriod = mode === "rehearsal" && !period;
  const today = todaySydney();
  const variant: RehearsalVariant =
    period &&
    period.midterm_applies &&
    !period.midterm_audit_on &&
    today < renewalWindowOpens(period)
      ? "mid-term"
      : "renewal";
  const rehearsalPeriod =
    mode === "rehearsal" && period
      ? {
          from: period.last_audit_on ?? period.period_starts_on,
          to: today,
        }
      : undefined;
  const asks = auditDayAskList({
    registers,
    auditDay,
    documentControl: documentControl.rows,
  });
  const names = new Map(AUDIT_DAY_RECORDS.map((r) => [r.id, r.name]));
  const ids =
    mode === "rehearsal" ? rehearsalRecordIds(variant) : selfCheckRecordIds();
  const records: WalkRecord[] = ids.map((id) => {
    if (id === CORRECTIVE_ACTION_ID)
      return {
        id,
        name: CORRECTIVE_ACTION_NAME,
        word: "The mid-term audit assesses the standards under a corrective action plan from your last audit and any the Commissioner names (Rules s 13B(5)).",
        state: "missing" as const,
        href: "/path/audit-day",
      };
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
    <PageShell kind="form">
      <p className="text-sm">
        <Link
          href={mode === "rehearsal" ? "/path/renewal" : "/path/audit-day"}
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          {mode === "rehearsal" ? "‹ Your renewal path" : "‹ Audit day"}
        </Link>
      </p>
      <h1 className="mt-2">
        {mode === "rehearsal"
          ? "Check my systems: a rehearsal"
          : "Check my systems"}
      </h1>
      {noPeriod ? (
        <>
          <p className="text-ink mt-3 leading-7" data-testid="check-no-period">
            A rehearsal reads the period since your last audit, so it needs your
            registration dates first. Type them from your certificate on the
            account page and come back; the quarterly walk works without them.
          </p>
          <p className="mt-4">
            <Link href="/account#registration-heading" className="btn-primary">
              Type your registration dates
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="text-ink mt-3 leading-7" data-testid="check-intro">
            {mode === "rehearsal"
              ? `One question per record, yes or no, read over the period since ${rehearsalPeriod ? rehearsalPeriod.from : "your last audit"}. Nothing goes to your improvement register; the walk ends with a dated working note of what is missing, in your own audit pack.`
              : "One question per record, yes or no. Every no becomes a row in your improvement register with a date 30 days out. About ten minutes."}
          </p>
          <CheckWalk
            records={records}
            today={today}
            mode={mode}
            period={rehearsalPeriod}
            variant={variant}
          />
        </>
      )}
    </PageShell>
  );
}
