import type { Metadata } from "next";
import Link from "next/link";
import { registerOverview } from "@/server/registers/queries";
import { RegisterPage, registerContext } from "./_components/shell";

export const metadata: Metadata = { title: "Registers" };

type Row = {
  href: string;
  title: string;
  total: number;
  attention: string;
  urgent: boolean;
};

/**
 * The registers with what needs attention (REQ-009 FR-5, batch 28 item 1):
 * one row each, the overdue counts in words, never colour alone. Batch 42
 * item 7 (D-549): two headings, the registers you add to as things happen
 * and the ones you keep current, and one "How codes work" panel that every
 * code hint links to.
 */
export default async function RegistersPage() {
  const ctx = await registerContext("/registers");
  const o = await registerOverview(ctx.supabase, ctx.viewer.account.id);
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
  ];
  const groups = [
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
      intro="What an auditor samples at the mid-term audit and at renewal. Keep them as things happen; nothing here is sent to anyone."
      canWrite={ctx.canWrite}
    >
      <div data-testid="registers-index">
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
