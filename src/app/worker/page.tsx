import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CATEGORY_LABELS, CHANNEL_LABELS } from "@/lib/registers/labels";
import { WORKER_HOME_LINE } from "@/lib/registers/worker";
import { getViewer } from "@/server/accounts/queries";
import { signOut } from "@/server/auth/actions";
import { listComplaints, listIncidents } from "@/server/registers/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = {
  title: "Your entries",
  robots: { index: false, follow: false },
};

/**
 * The worker's home (REQ-020 FR-4, FR-11): one line on what they can and
 * cannot see, two actions, and the list of what they logged. RLS gives a
 * worker their own incident and complaint rows and nothing else, so the
 * two list queries return exactly their entries.
 */
export default async function WorkerHome() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fworker");
  if (viewer.deleted) redirect("/account/deleted");
  if (viewer.account) redirect("/registers");
  if (!viewer.worker) redirect("/account/setup");
  const supabase = await createSupabaseServerClient();
  const [incidents, complaints] = await Promise.all([
    listIncidents(supabase, viewer.worker.id),
    listComplaints(supabase, viewer.worker.id),
  ]);
  return (
    <PageShell kind="list">
      <h1 className="text-3xl font-semibold tracking-tight">
        Your entries for {viewer.worker.trading_name}
      </h1>
      <p className="mt-3 leading-7" data-testid="worker-home-line">
        {WORKER_HOME_LINE}
        {viewer.worker.worker_ref
          ? ` Your code is ${viewer.worker.worker_ref}.`
          : ""}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/worker/incidents/new"
          className="btn-primary"
          data-testid="worker-log-incident"
        >
          Log an incident
        </Link>
        <Link
          href="/worker/complaints/new"
          className="btn-secondary"
          data-testid="worker-log-complaint"
        >
          Log a complaint
        </Link>
      </div>

      <section
        aria-labelledby="mine-heading"
        className="mt-10"
        data-testid="worker-entries"
      >
        <h2 id="mine-heading" className="text-xl font-semibold">
          What you logged
        </h2>
        {incidents.length === 0 && complaints.length === 0 ? (
          <p className="text-slate mt-2 text-sm">Nothing yet.</p>
        ) : (
          <ul className="divide-rule mt-3 divide-y">
            {incidents.map((r) => (
              <li
                key={r.id}
                className="py-3 leading-7"
                data-testid="worker-entry"
              >
                <span className="font-medium">
                  {r.reference}: {CATEGORY_LABELS[r.category]}
                </span>{" "}
                <span className="text-ink">
                  {r.occurred_on}
                  {r.participant_ref ? `, ${r.participant_ref}` : ""}.{" "}
                  {r.summary.slice(0, 80)}
                  {r.summary.length > 80 ? "…" : ""}
                </span>
              </li>
            ))}
            {complaints.map((r) => (
              <li
                key={r.id}
                className="py-3 leading-7"
                data-testid="worker-entry"
              >
                <span className="font-medium">
                  {r.reference}: complaint by {CHANNEL_LABELS[r.channel]}
                </span>{" "}
                <span className="text-ink">
                  {r.received_on}. {r.summary.slice(0, 80)}
                  {r.summary.length > 80 ? "…" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={signOut} className="mt-10">
        <button
          type="submit"
          className="btn-secondary"
          data-testid="worker-sign-out"
        >
          Sign out
        </button>
      </form>
    </PageShell>
  );
}
