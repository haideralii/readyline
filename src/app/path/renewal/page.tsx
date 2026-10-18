import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import { renewalNext, renewalSteps } from "@/lib/path/renewal";
import { formatLongDate } from "@/lib/registers/status";
import {
  TIMELINE_FIXED_SENTENCE,
  renewalWindowOpens,
} from "@/lib/registers/timeline";
import { getViewer } from "@/server/accounts/queries";
import { listPolicyReviews } from "@/server/registers/queries";
import { currentPeriod } from "@/server/registers/registration-queries";
import { lastRehearsal } from "@/server/registers/self-check-queries";
import { latestRegisterChangeAt } from "@/server/registers/what-changed-queries";
import { todaySydney } from "@/server/registers/worker-onboarding";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Your renewal path" };

/**
 * The renewal path (REQ-023 Session C, FR-7, FR-9; D-2342): the ten steps in
 * the Commission's order, each with its live state and one action, and one
 * primary button, the next undone step's (REQ-017 FR-5). The dates come from
 * the period row the account page keeps; the page never books, names or
 * recommends an auditor (D-2303). A worker is sent to their own home (SR-5).
 */
export default async function RenewalPage({
  searchParams,
}: PageProps<"/path/renewal">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fpath%2Frenewal");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect(viewer.worker ? "/worker" : "/account/setup");
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const accountId = viewer.account.id;
  const today = todaySydney();
  const [period, reviews, rehearsal, latestChangeAt] = await Promise.all([
    currentPeriod(supabase, accountId),
    listPolicyReviews(supabase, accountId),
    lastRehearsal(supabase, accountId),
    // REQ-031 FR-5 (D-2890): the newest register change, against the period's reading.
    latestRegisterChangeAt(supabase, accountId),
  ]);
  const documentsDue = period
    ? reviews.filter(
        (r) => r.next_review_on && r.next_review_on <= period.period_ends_on,
      ).length
    : 0;
  const rehearsedOn =
    period && rehearsal && rehearsal.walked_on >= period.period_starts_on
      ? rehearsal.walked_on
      : null;
  const steps = renewalSteps({
    period,
    documentsDue,
    rehearsedOn,
    today,
    whatChangedReadAt: period?.what_changed_read_at ?? null,
    latestChangeAt,
  });
  const next = renewalNext(steps);
  const windowOpen = period ? today >= renewalWindowOpens(period) : false;
  return (
    <PageShell kind="list">
      <p className="text-sm">
        <Link
          href="/path/audit-day"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Audit day
        </Link>
      </p>
      <h1 className="mt-2">Your renewal path</h1>
      <p className="mt-3 leading-7" data-testid="renewal-intro">
        {period
          ? windowOpen
            ? `Your registration period ends ${formatLongDate(period.period_ends_on)} and the renewal window is open. Ten steps, in the Commission's order; the next one is first.`
            : `Your registration period ends ${formatLongDate(period.period_ends_on)}; the renewal window opens ${formatLongDate(renewalWindowOpens(period))}. Ten steps, in the Commission's order, ready for then.`
          : "Ten steps, in the Commission's order. Type the dates from your certificate first; every step reads them."}
      </p>
      {typeof sp.saved === "string" ? (
        <p
          role="status"
          className="text-moss mt-3 text-sm"
          data-testid="renewal-saved"
        >
          ✓ Saved.
        </p>
      ) : null}
      <p className="mt-4">
        <Link
          href={next.href}
          className="btn-primary"
          data-testid="renewal-next"
        >
          {next.action}
        </Link>
      </p>
      <ol className="divide-rule mt-6 divide-y" data-testid="renewal-steps">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className="flex gap-3 py-3 leading-7"
            data-testid={`renewal-step-${s.id}`}
            data-state={s.state}
            data-done={s.done ? "true" : "false"}
          >
            <span aria-hidden="true" className="w-6 shrink-0 text-right">
              {i + 1}.
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{s.title}</span>{" "}
              <span className="text-ink" data-testid={`renewal-state-${s.id}`}>
                ({s.state})
              </span>
              {s.plain ? (
                <span className="text-slate block text-sm leading-6">
                  {s.plain}
                </span>
              ) : null}
              <Link
                href={s.href}
                className="mt-1 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                data-testid={`renewal-action-${s.id}`}
              >
                {s.action}
              </Link>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-slate mt-6 text-sm leading-6">
        {TIMELINE_FIXED_SENTENCE}
      </p>
      <p className="text-slate mt-6 text-sm">{GENERAL_INFORMATION_STATEMENT}</p>
    </PageShell>
  );
}
