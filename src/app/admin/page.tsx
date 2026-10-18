import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import { unverifiedChecklistItems } from "@/lib/checklist/confidence";
import {
  readAdminContext,
  requireAdmin,
  writeAdminAudit,
} from "@/server/admin/access";
import { notFoundMetadata } from "@/lib/page-titles";
import { RETENTION_DAYS } from "@/server/accounts/purge";
import { COUNTER_EVENTS, COUNTER_LABELS } from "@/lib/metrics/counters";
import { countersLast30Days } from "@/server/metrics/counters";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

/** QA live b340ee3, B #57: signed out (or not an admin) the page is the 404 and so is its title. */
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await readAdminContext();
  return ctx
    ? { title: "Admin", robots: { index: false, follow: false } }
    : notFoundMetadata;
}

export default async function AdminPage() {
  const ctx = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const [live, deleted, users, recent] = await Promise.all([
    admin
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    admin
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    admin.from("users").select("id", { count: "exact", head: true }),
    admin
      .from("audit_log")
      .select("id, account_id, actor_user_id, action, target, at")
      .order("at", { ascending: false })
      .limit(25),
  ]);
  await writeAdminAudit(ctx.user.id, "admin.viewed", "/admin");
  // Batch 45 item 12 (D-2002): the five first-party counters, last 30 days.
  const counters = await countersLast30Days(admin);

  // REQ-016 FR-0c: generator failures are an admin line, never a customer count.
  const sets = await admin
    .from("version_sets")
    .select("fallback_section_count")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(500);
  const genericSections = (
    (sets.data as { fallback_section_count: number }[] | null) ?? []
  ).reduce((n, s) => n + (s.fallback_section_count ?? 0), 0);

  const rows: { label: string; value: number | null }[] = [
    { label: "Live accounts", value: live.count },
    {
      label: `Deleted, awaiting purge (${RETENTION_DAYS} days)`,
      value: deleted.count,
    },
    { label: "Users", value: users.count },
    {
      label: "Generic sections across ready sets (generator failures)",
      value: sets.error ? null : genericSections,
    },
  ];

  return (
    <PageShell kind="list">
      <h1 className="">Admin</h1>
      <p className="text-slate mt-2 text-sm">
        Signed in with a verified authenticator. Every visit and action here is
        written to the audit log.
      </p>

      <section aria-labelledby="counts-heading" className="mt-8">
        <h2 id="counts-heading" className="">
          Counts
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="border-rule rounded-md border p-4">
              <dt className="text-slate text-sm">{r.label}</dt>
              <dd className="mt-1 text-2xl font-semibold">{r.value ?? "–"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="counters-heading"
        className="mt-10"
        data-testid="admin-counters"
      >
        <h2 id="counters-heading" className="">
          Last 30 days
        </h2>
        <p className="text-slate mt-1 text-sm">
          First-party counts by day: no cookies, no third party, nothing per
          person.
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {COUNTER_EVENTS.map((e) => (
            <div key={e} className="border-rule rounded-md border p-4">
              <dt className="text-slate text-sm">{COUNTER_LABELS[e]}</dt>
              <dd
                className="mt-1 text-2xl font-semibold"
                data-testid={`counter-${e}`}
              >
                {counters ? counters[e] : "–"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* REQ-013 batch 36 item 2: the evidence-confidence flag lives here and in the evidence files, never on a customer page. */}
      <section aria-labelledby="confidence-heading" className="mt-10">
        <h2 id="confidence-heading" className="">
          Evidence confidence: checklist items the Commission&apos;s text does
          not state
        </h2>
        <p className="text-slate mt-2 text-sm">
          Readyline&apos;s own evidence items across the three reference cases.
          The customer sees a plain &quot;check this&quot; sentence with the
          source link instead of this flag.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm leading-6">
          {unverifiedChecklistItems().map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="audit-heading" className="mt-10">
        <h2 id="audit-heading" className="">
          Recent audit log
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recent audit log</caption>
            <thead>
              <tr className="border-rule border-b">
                <th scope="col" className="py-2 pr-3">
                  When (UTC)
                </th>
                <th scope="col" className="py-2 pr-3">
                  Action
                </th>
                <th scope="col" className="py-2 pr-3">
                  Account
                </th>
                <th scope="col" className="py-2">
                  Actor
                </th>
              </tr>
            </thead>
            <tbody>
              {(recent.data ?? []).map((e) => (
                <tr key={e.id} className="border-rule border-b">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {new Date(e.at)
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 19)}
                  </td>
                  <td className="py-2 pr-3">{e.action}</td>
                  <td className="py-2 pr-3 font-mono text-sm">
                    {e.account_id ?? "–"}
                  </td>
                  <td className="py-2 font-mono text-sm">
                    {e.actor_user_id ?? "system"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-slate mt-10 text-sm">
        The purge job runs daily from Vercel Cron; to run it by hand call the
        purge route with the cron secret and{" "}
        <code className="mx-1">?dryRun=1</code> first.
      </p>
    </PageShell>
  );
}
