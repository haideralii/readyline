import type { Metadata } from "next";
import Link from "next/link";
import {
  AUDIT_DAY_META,
  type AuditDaySlug,
} from "@/lib/registers/audit-day-forms";
import { documentControlSentence } from "@/lib/registers/document-control";
import {
  REGISTERS_LINKED_LINE,
  RENEWAL_SAVES_LINE,
} from "@/lib/registers/messages";
import { reportsToConfirmLine } from "@/lib/registers/worker";
import { formatLongDate } from "@/lib/registers/status";
import { auditDayOverview } from "@/server/registers/audit-day-queries";
import { documentControlForAccount } from "@/server/registers/document-control-queries";
import { registerOverview } from "@/server/registers/queries";
import { currentPeriod } from "@/server/registers/registration-queries";
import { countReportsToConfirm } from "@/server/registers/team-queries";
import { RegisterPage, registerContext } from "./_components/shell";

export const metadata: Metadata = { title: "Registers" };

type Row = {
  href: string;
  title: string;
  total: number;
  attention: string;
  urgent: boolean;
};

/** The REQ-018 registers you add to as things happen, in the order an auditor follows them. */
const AUDIT_DAY_AS_THINGS_HAPPEN: AuditDaySlug[] = [
  "improvements",
  "decisions",
  "onboarding",
];
/** The REQ-018 registers you keep current: a date changes, the row changes. */
const AUDIT_DAY_KEEP_CURRENT: AuditDaySlug[] = [
  "corporate-risks",
  // REQ-020 FR-7.
  "hazards",
  "participant-risks",
  "conflicts-of-interest",
  "delegations",
  "insurances",
  "staff-matrix",
];

/**
 * The registers with what needs attention (REQ-009 FR-5, batch 28 item 1):
 * one row each, the overdue counts in words, never colour alone. Batch 42
 * item 7 (D-549): two headings, the registers you add to as things happen
 * and the ones you keep current, and one "How codes work" panel that every
 * code hint links to. REQ-018 Session B adds the nine audit-day registers
 * to those two groups, and FR-13 puts the document control register, built
 * from the pack with nothing to type, first on the page (backlog 4 merge).
 */
export default async function RegistersPage() {
  const ctx = await registerContext("/registers");
  const [o, a, dc, toConfirm, period] = await Promise.all([
    registerOverview(ctx.supabase, ctx.viewer.account.id),
    auditDayOverview(ctx.supabase, ctx.viewer.account.id),
    documentControlForAccount(ctx.supabase, ctx.viewer.account.id),
    countReportsToConfirm(ctx.supabase, ctx.viewer.account.id),
    // REQ-023 FR-1: batch 45 item 8's "due around" line is now one link to the
    // timeline, so the two never disagree.
    currentPeriod(ctx.supabase, ctx.viewer.account.id),
  ]);
  const auditDayRow = (slug: AuditDaySlug): Row => ({
    href: `/registers/${slug}`,
    title: AUDIT_DAY_META[slug].title,
    total: a[slug].total,
    attention: a[slug].attentionLabel,
    urgent: a[slug].attentionLabel.endsWith("overdue"),
  });
  // REQ-018 FR-13: the document control register, generated from the pack, shown first.
  const fromYourPack: Row[] = [
    {
      href: "/registers/document-control",
      title: "Document control",
      total: dc.rows.length,
      attention: documentControlSentence(dc.rows).replace(/\.$/, ""),
      urgent: dc.rows.some((r) => r.state === "overdue"),
    },
  ];
  const asThingsHappen: Row[] = [
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
    ...AUDIT_DAY_AS_THINGS_HAPPEN.map(auditDayRow),
  ];
  const keepCurrent: Row[] = [
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
    ...AUDIT_DAY_KEEP_CURRENT.map(auditDayRow),
  ];
  const groups = [
    {
      id: "from-your-pack",
      heading: "From your pack",
      intro:
        "Built from the documents you adopt. Nothing to type; an auditor reads it for versions and review dates.",
      rows: fromYourPack,
    },
    {
      id: "as-things-happen",
      heading: "Keep as things happen",
      intro:
        "Add a row on the day. An auditor reads these for what you did next.",
      rows: asThingsHappen,
    },
    {
      id: "keep-current",
      heading: "Keep current",
      intro:
        "Update a row when a date changes. An auditor reads these for what is due.",
      rows: keepCurrent,
    },
  ];
  return (
    <RegisterPage
      title="Registers"
      intro={
        <>
          What an auditor samples at the mid-term audit (certification
          providers) and at renewal. Keep them as things happen; nothing here is
          sent to anyone.{" "}
          <span data-testid="registers-linked">{REGISTERS_LINKED_LINE}</span>{" "}
          {RENEWAL_SAVES_LINE}
        </>
      }
      canWrite={ctx.canWrite}
    >
      <div data-testid="registers-index">
        {reportsToConfirmLine(toConfirm) ? (
          // REQ-020 FR-5: a report through the link or by a worker waits here until the owner confirms it.
          <p
            className="border-signal mt-4 rounded-md border p-3 leading-7"
            data-testid="reports-to-confirm"
          >
            <Link
              href="/registers/incidents"
              className="font-medium underline underline-offset-4"
            >
              {reportsToConfirmLine(toConfirm)}
            </Link>
            . The 24 hours for a reportable incident run from the report, not
            from when you read it.
          </p>
        ) : null}
        {/* REQ-020 FR-1: one zip of every register, the document control register, the summary and the adopted documents. */}
        <p className="mt-2 text-sm">
          <a
            href="/registers/audit-pack.zip"
            className="underline underline-offset-2"
            data-testid="audit-pack-download"
          >
            Download my audit pack
          </a>
        </p>
        {period ? (
          <p
            className="text-ink mt-2 text-sm"
            data-testid="registration-timeline-link"
          >
            Your registration period ends on{" "}
            {formatLongDate(period.period_ends_on)}.{" "}
            <Link
              href="/account#registration-heading"
              className="underline underline-offset-2"
            >
              See your registration timeline
            </Link>
            .
          </p>
        ) : null}
        {groups.map((g) => (
          <section
            key={g.id}
            aria-labelledby={`${g.id}-heading`}
            className="mt-8"
            data-testid={`registers-${g.id}`}
          >
            <h2 id={`${g.id}-heading`} className="">
              {g.heading}
            </h2>
            <p className="text-slate mt-1 text-sm">{g.intro}</p>
            <ul
              className="divide-rule mt-2 divide-y"
              aria-labelledby={`${g.id}-heading`}
            >
              {g.rows.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="flex min-h-14 items-center justify-between gap-3 py-3 underline-offset-4 hover:underline"
                    data-testid={`register-${r.href.split("/").pop()}`}
                  >
                    <span>
                      <span className="block text-lg font-medium">
                        {r.title}
                      </span>
                      <span className="text-slate block text-sm">
                        {r.total} {r.total === 1 ? "entry" : "entries"}.{" "}
                        {r.attention}.
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={r.urgent ? "text-signal" : "text-slate"}
                    >
                      {r.urgent ? "!" : "›"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section
        id="codes"
        aria-labelledby="codes-heading"
        className="border-rule mt-10 rounded-md border p-4"
        data-testid="codes-panel"
      >
        <h2 id="codes-heading" className="">
          How codes work
        </h2>
        <p className="mt-2 leading-7">
          A register row never holds a name, a date of birth or a health detail.
          It holds a code you choose, and you keep the list of who each code
          means in your own records, away from this site.
        </p>
        <ul className="mt-2 list-disc pl-5 leading-7">
          <li>
            P-014 for a participant. Number them in the order you met them.
          </li>
          <li>W-003 for a worker, including yourself.</li>
          <li>
            FAM-2 for a family member, ADV-1 for an advocate, OTH-1 for anyone
            else.
          </li>
        </ul>
        <p className="text-slate mt-2 text-sm">
          The same code means the same person in every register, so an auditor
          can follow an incident to a complaint without a name.
        </p>
      </section>
    </RegisterPage>
  );
}
