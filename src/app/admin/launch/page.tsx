import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  countByState,
  LAUNCH_GROUP_TITLES,
  LAUNCH_STATE_WORDS,
  launchRows,
  type LaunchGroup,
  type LaunchState,
} from "@/lib/ops/launch";
import { requireAdmin, writeAdminAudit } from "@/server/admin/access";
import { gatherLaunchFacts } from "@/server/ops/launch-facts";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const metadata: Metadata = {
  title: "Launch",
  robots: { index: false, follow: false },
};

/**
 * The launch switchboard (REQ-022 FR-1, SR-1, SR-2): every launch condition
 * as a row with a name, a state and one sentence on what to do, grouped as
 * product/ops/LAUNCH.md is. Behind requireAdmin() and the authenticator
 * step; every view is audited. The page never prints a value: the rows are
 * built from facts in src/lib/ops/launch.ts, whose strings are fixed.
 */
const MARK: Record<LaunchState, string> = {
  set: "✓",
  unset: "○",
  mismatched: "!",
  unverified: "?",
};

const ORDER: LaunchGroup[] = [
  "identity",
  "payments",
  "generation",
  "email",
  "domain",
  "jobs",
  "admin",
  "legal",
];

export default async function LaunchPage() {
  const ctx = await requireAdmin();
  const host = (await headers()).get("host");
  const facts = await gatherLaunchFacts({
    admin: createSupabaseAdminClient(),
    requestHost: host,
  });
  const rows = launchRows(facts);
  const counts = countByState(rows);
  await writeAdminAudit(ctx.user.id, "admin.launch.viewed", "/admin/launch");
  return (
    <PageShell kind="list">
      <h1 className="">Launch</h1>
      <p className="text-slate mt-2 text-sm">
        Every launch condition by name and state, never by value. The launch
        checklist in the repository uses the same names. This visit is in the
        audit log.
      </p>
      <p className="mt-4 leading-7" data-testid="launch-summary">
        {counts.set} of {rows.length} set; {counts.unset} not set;{" "}
        {counts.mismatched} mismatched; {counts.unverified} not verified here.
      </p>
      {ORDER.map((group) => {
        const inGroup = rows.filter((r) => r.group === group);
        if (!inGroup.length) return null;
        return (
          <section
            key={group}
            aria-labelledby={`launch-${group}`}
            className="mt-8"
            data-testid={`launch-group-${group}`}
          >
            <h2 id={`launch-${group}`} className="">
              {LAUNCH_GROUP_TITLES[group]}
            </h2>
            <ul className="divide-rule mt-3 divide-y">
              {inGroup.map((r) => (
                <li
                  key={r.id}
                  className="flex gap-3 py-3 leading-7"
                  data-testid={`launch-row-${r.id}`}
                  data-state={r.state}
                >
                  <span aria-hidden="true" className="w-5 shrink-0">
                    {MARK[r.state]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{r.name}</span>{" "}
                    <span
                      className="text-ink"
                      data-testid={`launch-state-${r.id}`}
                    >
                      {LAUNCH_STATE_WORDS[r.state]}.
                    </span>{" "}
                    <span className="text-ink">{r.sentence}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </PageShell>
  );
}
