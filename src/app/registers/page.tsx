import type { Metadata } from "next";
import Link from "next/link";
import {
  AUDIT_DAY_META,
  AUDIT_DAY_SLUGS,
} from "@/lib/registers/audit-day-forms";
import { documentControlSentence } from "@/lib/registers/document-control";
import { auditDayOverview } from "@/server/registers/audit-day-queries";
import { documentControlForAccount } from "@/server/registers/document-control-queries";
import { registerOverview } from "@/server/registers/queries";
import { RegisterPage, registerContext } from "./_components/shell";

export const metadata: Metadata = { title: "Registers" };

/**
 * The registers with what needs attention (REQ-009 FR-5, batch 28 item 1;
 * REQ-018 Session B adds the nine audit-day registers): one row each, the
 * overdue counts in words, never colour alone.
 */
export default async function RegistersPage() {
  const ctx = await registerContext("/registers");
  const [o, a, dc] = await Promise.all([
    registerOverview(ctx.supabase, ctx.viewer.account.id),
    auditDayOverview(ctx.supabase, ctx.viewer.account.id),
    documentControlForAccount(ctx.supabase, ctx.viewer.account.id),
  ]);
  // REQ-018 FR-13: the document control register, generated from the pack, shown first.
  const documentControlRow = {
    href: "/registers/document-control",
    title: "Document control",
    total: dc.rows.length,
    attention: documentControlSentence(dc.rows).replace(/\.$/, ""),
    urgent: dc.rows.some((r) => r.state === "overdue"),
  };
  const auditDayRows = AUDIT_DAY_SLUGS.map((slug) => ({
    href: `/registers/${slug}`,
    title: AUDIT_DAY_META[slug].title,
    total: a[slug].total,
    attention: a[slug].attentionLabel,
    urgent: a[slug].attentionLabel.endsWith("overdue"),
  }));
  const rows = [
    {
      href: "/registers/incidents",
      title: "Incidents",
      total: o.incidents.total,
      attention:
        o.incidents.overdueNotification > 0
          ? `${o.incidents.overdueNotification} overdue to notify the Commission`
          : o.incidents.open > 0
            ? `${o.incidents.open} open`
            : "Nothing open",
      urgent: o.incidents.overdueNotification > 0,
    },
    {
      href: "/registers/complaints",
      title: "Complaints",
      total: o.complaints.total,
      attention:
        o.complaints.unresolved > 0
          ? `${o.complaints.unresolved} unresolved`
          : "Nothing open",
      urgent: false,
    },
    {
      href: "/registers/worker-checks",
      title: "Worker checks",
      total: o.workerChecks.total,
      attention:
        o.workerChecks.expired > 0
          ? `${o.workerChecks.expired} expired`
          : o.workerChecks.expiring > 0
            ? `${o.workerChecks.expiring} expiring within 90 days`
            : "All current",
      urgent: o.workerChecks.expired > 0,
    },
    {
      href: "/registers/policy-reviews",
      title: "Policy reviews",
      total: o.policyReviews.total,
      attention:
        o.policyReviews.overdue > 0
          ? `${o.policyReviews.overdue} overdue`
          : o.policyReviews.dueSoon > 0
            ? `${o.policyReviews.dueSoon} due within 60 days`
            : o.policyReviews.notAdopted > 0
              ? `${o.policyReviews.notAdopted} not adopted yet`
              : "All current",
      urgent: o.policyReviews.overdue > 0,
    },
  ];
  return (
    <RegisterPage
      title="Registers"
      intro="What an auditor samples at the mid-term audit and at renewal. Keep them as things happen; nothing here is sent to anyone."
      canWrite={ctx.canWrite}
    >
      <ul
        className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800"
        data-testid="registers-index"
      >
        {[documentControlRow, ...rows, ...auditDayRows].map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="flex min-h-14 items-center justify-between gap-3 py-3 underline-offset-4 hover:underline"
              data-testid={`register-${r.href.split("/").pop()}`}
            >
              <span>
                <span className="block text-lg font-medium">{r.title}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                  {r.total} {r.total === 1 ? "entry" : "entries"}. {r.attention}
                  .
                </span>
              </span>
              <span
                aria-hidden="true"
                className={r.urgent ? "text-signal" : "text-zinc-500"}
              >
                {r.urgent ? "!" : "›"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </RegisterPage>
  );
}
