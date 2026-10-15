import type { Metadata } from "next";
import Link from "next/link";
import {
  AUDIT_DAY_META,
  type AuditDaySlug,
} from "@/lib/registers/audit-day-forms";
import { documentControlSentence } from "@/lib/registers/document-control";
import { MID_TERM_DUE_MONTHS, addMonths } from "@/lib/registers/reminders";
import { auditDayOverview } from "@/server/registers/audit-day-queries";
import { documentControlForAccount } from "@/server/registers/document-control-queries";
import { registerOverview } from "@/server/registers/queries";
import { RegisterPage, registerContext } from "./_components/shell";

export const metadata: Metadata = { title: "Registers" };

/** "15 April 2028", the way the reminder emails say a date. */
function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

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
  const [o, a, dc, reg] = await Promise.all([
    registerOverview(ctx.supabase, ctx.viewer.account.id),
    auditDayOverview(ctx.supabase, ctx.viewer.account.id),
    documentControlForAccount(ctx.supabase, ctx.viewer.account.id),
    ctx.supabase
      .from("accounts")
      .select("registration_date, registration_kind")
      .eq("id", ctx.viewer.account.id)
      .maybeSingle(),
  ]);
  // Batch 45 item 8: a certification provider with a registration date is told
  // when the mid-term audit falls, from REQ-009's column (18 months in).
  const registration = reg.data as {
    registration_date: string | null;
    registration_kind: "certification" | "verification" | null;
  } | null;
  const midTermDue =
    registration?.registration_date &&
    registration.registration_kind === "certification"
      ? addMonths(registration.registration_date, MID_TERM_DUE_MONTHS)
      : null;
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
      intro="What an auditor samples at the mid-term audit (certification providers) and at renewal. Keep them as things happen; nothing here is sent to anyone."
      canWrite={ctx.canWrite}
    >
      <div data-testid="registers-index">
        {midTermDue ? (
          <p
            className="mt-2 text-sm text-zinc-700 dark:text-zinc-300"
            data-testid="mid-term-due"
          >
            Your mid-term audit is due around {formatLongDate(midTermDue)}.
          </p>
        ) : null}
        {groups.map((g) => (
          <section
            key={g.id}
            aria-labelledby={`${g.id}-heading`}
            className="mt-8"
            data-testid={`registers-${g.id}`}
          >
            <h2 id={`${g.id}-heading`} className="text-xl font-semibold">
              {g.heading}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {g.intro}
            </p>
            <ul
              className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800"
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
                      <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                        {r.total} {r.total === 1 ? "entry" : "entries"}.{" "}
                        {r.attention}.
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
          </section>
        ))}
      </div>
      <section
        id="codes"
        aria-labelledby="codes-heading"
        className="mt-10 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
        data-testid="codes-panel"
      >
        <h2 id="codes-heading" className="text-lg font-semibold">
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
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          The same code means the same person in every register, so an auditor
          can follow an incident to a complaint without a name.
        </p>
      </section>
    </RegisterPage>
  );
}
