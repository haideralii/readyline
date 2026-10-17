import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import { documentTitle } from "@/lib/questionnaire/content";
import { auditorVisibleIncidents } from "@/lib/registers/audit-pack";
import { periodShownLine } from "@/lib/registers/period";
import { formatLongDate } from "@/lib/registers/status";
import {
  WHAT_CHANGED_TITLE,
  whatChanged,
  whatChangedFileName,
  workerSummaryLine,
} from "@/lib/registers/what-changed";
import { getViewer } from "@/server/accounts/queries";
import {
  listComplaints,
  listIncidents,
  listPolicyReviews,
  listWorkerChecks,
} from "@/server/registers/queries";
import { currentPeriod } from "@/server/registers/registration-queries";
import { todaySydney } from "@/server/registers/worker-onboarding";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: WHAT_CHANGED_TITLE };

/**
 * "What changed since the last audit" (REQ-023 FR-6; D-2340): one screen
 * reached from the audit-day page, the same object the pack writes as
 * `since-last-audit.csv` (AC-4): counts per register for the period, the
 * documents adopted or reviewed in it, the documents due for review before
 * the registration period ends, and the workers whose checks were added,
 * renewed or expired, as codes and counts. Every line links to the register
 * with the period set. With no last-audit date it covers the whole
 * registration period and says why; with no period it asks for the dates.
 * A worker is sent to their own home (SR-5).
 */
const dash = (n: number | null) => (n === null ? "—" : String(n));

export default async function WhatChangedPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fpath%2Faudit-day%2Fwhat-changed");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect(viewer.worker ? "/worker" : "/account/setup");
  const supabase = await createSupabaseServerClient();
  const accountId = viewer.account.id;
  const period = await currentPeriod(supabase, accountId);
  if (!period)
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
        <h1 className="">{WHAT_CHANGED_TITLE}</h1>
        <p className="mt-3 leading-7" data-testid="what-changed-no-period">
          This page reads your registration dates. Enter them on the account
          page first, with the date of your last audit if you have had one.
        </p>
        <p className="mt-4">
          <Link href="/account" className="underline underline-offset-4">
            Go to the account page
          </Link>
        </p>
      </PageShell>
    );
  const summaryPeriod = period.last_audit_on
    ? {
        kind: "since-last-audit" as const,
        from: period.last_audit_on,
        to: null,
      }
    : { kind: "period" as const, from: period.period_starts_on, to: null };
  const [incidents, complaints, checks, reviews] = await Promise.all([
    listIncidents(supabase, accountId),
    listComplaints(supabase, accountId),
    listWorkerChecks(supabase, accountId),
    listPolicyReviews(supabase, accountId),
  ]);
  const w = whatChanged({
    period: summaryPeriod,
    periodStartsOn: period.period_starts_on,
    periodEndsOn: period.period_ends_on,
    lastAuditOn: period.last_audit_on,
    today: todaySydney(),
    incidents: auditorVisibleIncidents(incidents),
    complaints,
    checks,
    reviews,
    titleOf: (typeId, title) =>
      typeId === "other" ? title : documentTitle(typeId) || title || typeId,
  });
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
      <h1 className="" data-testid="what-changed-title">
        {w.title}
      </h1>
      {w.why ? (
        <p className="mt-3 leading-7" data-testid="what-changed-why">
          {w.why}
        </p>
      ) : null}
      <p className="mt-3 text-sm" data-testid="what-changed-period">
        {periodShownLine(w.period)} The same summary is in your audit pack as{" "}
        {whatChangedFileName(Boolean(period.last_audit_on))}; the registration
        period ends on {formatLongDate(period.period_ends_on)}.
      </p>

      <section
        aria-labelledby="wc-registers"
        className="mt-8"
        data-testid="what-changed-registers"
      >
        <h2 id="wc-registers" className="">
          The registers in this period
        </h2>
        <ul className="divide-rule mt-3 divide-y">
          {w.registers.map((r) => (
            <li
              key={r.id}
              className="py-3 leading-7"
              data-testid={`what-changed-register-${r.id}`}
              data-entries={r.entries}
            >
              <Link
                href={r.href}
                className="font-medium underline underline-offset-4"
              >
                {r.name}
              </Link>
              <span className="text-ink block text-sm">
                Entries {r.entries}; open {dash(r.open)}; overdue{" "}
                {dash(r.overdue)}; notified {dash(r.notified)}.
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="wc-documents"
        className="mt-8"
        data-testid="what-changed-documents"
      >
        <h2 id="wc-documents" className="">
          Documents adopted or reviewed in this period
        </h2>
        {w.documents.length ? (
          <ul className="divide-rule mt-3 divide-y">
            {w.documents.map((d) => (
              <li
                key={`${d.typeId}-${d.title}`}
                className="py-3 leading-7"
                data-testid="what-changed-document"
              >
                <Link href={d.href} className="underline underline-offset-4">
                  {d.title}
                </Link>
                <span className="text-ink block text-sm">
                  {d.event === "reviewed" ? "Reviewed" : "Adopted"}{" "}
                  {formatLongDate(d.date)}
                  {d.nextReviewOn
                    ? `; next review ${formatLongDate(d.nextReviewOn)}`
                    : ""}
                  .
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate mt-2 text-sm">
            No document was adopted or reviewed in this period.
          </p>
        )}
      </section>

      <section
        aria-labelledby="wc-due"
        className="mt-8"
        data-testid="what-changed-due"
      >
        <h2 id="wc-due" className="">
          Documents due for review before the period ends
        </h2>
        {w.due.length ? (
          <ul className="divide-rule mt-3 divide-y">
            {w.due.map((d) => (
              <li
                key={`${d.typeId}-${d.title}`}
                className="py-3 leading-7"
                data-testid="what-changed-due-document"
              >
                <Link href={d.href} className="underline underline-offset-4">
                  {d.title}
                </Link>
                <span className="text-ink block text-sm">
                  Due {formatLongDate(d.nextReviewOn)}.
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate mt-2 text-sm">
            No document is due for review before the period ends.
          </p>
        )}
      </section>

      <section
        aria-labelledby="wc-workers"
        className="mt-8"
        data-testid="what-changed-workers"
      >
        <h2 id="wc-workers" className="">
          Worker checks in this period
        </h2>
        <p
          className="mt-2 text-sm leading-6"
          data-testid="what-changed-worker-line"
        >
          {workerSummaryLine(w)}
        </p>
        {w.workers.length ? (
          <ul className="divide-rule mt-3 divide-y">
            {w.workers.map((x, i) => (
              <li
                key={`${x.code}-${x.kind}-${x.event}-${i}`}
                className="py-3 leading-7"
                data-testid="what-changed-worker"
              >
                <Link href={x.href} className="underline underline-offset-4">
                  {x.code}
                </Link>
                <span className="text-ink block text-sm">
                  {x.kind} {x.event} {formatLongDate(x.date)}.
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="text-slate mt-10 text-sm">
        {GENERAL_INFORMATION_STATEMENT}
      </p>
    </PageShell>
  );
}
