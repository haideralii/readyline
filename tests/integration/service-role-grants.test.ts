/**
 * REQ-005 R-11 / D-538 against a real Supabase stack: every function the
 * server calls with the secret key is executable by service_role, through a
 * client built with that key (not the database owner), and stays closed to
 * the publishable key. Skips without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

/** Every secret-key function, with arguments that are safe to call repeatedly. */
const SECRET_KEY_FUNCTIONS: ReadonlyArray<{
  name: string;
  args: () => Record<string, unknown>;
}> = [
  {
    name: "auth_rate_limit_hit",
    args: () => ({
      p_key: `grant-check:${randomUUID()}`,
      p_limit: 5,
      p_window_seconds: 60,
    }),
  },
  {
    name: "generation_quota_hit",
    args: () => ({ p_account: "00000000-0000-4000-8000-000000000000" }),
  },
  {
    // REQ-007 Session C: returns a set of rows (empty when nothing is queued).
    name: "claim_generation_job",
    args: () => ({ p_lease_seconds: 60 }),
  },
];

describe.skipIf(!enabled)("service_role execute grants (R-11, D-538)", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  const userIds: string[] = [];

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    service = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterAll(async () => {
    for (const id of userIds) await service.auth.admin.deleteUser(id);
  });

  for (const fn of SECRET_KEY_FUNCTIONS) {
    it(`${fn.name} runs through a service-role client`, async () => {
      const r = await service.rpc(fn.name, fn.args());
      expect(
        r.error,
        `${fn.name}: ${r.error?.code} ${r.error?.message}`,
      ).toBeNull();
      expect(["boolean", "object"]).toContain(typeof r.data);
    });

    it(`${fn.name} is refused for the publishable key, signed out and signed in`, async () => {
      const out = await anon.rpc(fn.name, fn.args());
      expect(out.error?.code, `${fn.name} signed out`).toBe("42501");
      const email = `grants-${randomUUID()}@example.test`;
      const password = `Pw-${randomUUID()}`;
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw created.error ?? new Error("createUser failed");
      userIds.push(created.data.user.id);
      const env = readSupabaseAdminEnv();
      const signedIn = createClient(env.url, env.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signed = await signedIn.auth.signInWithPassword({
        email,
        password,
      });
      if (signed.error) throw signed.error;
      const inn = await signedIn.rpc(fn.name, fn.args());
      expect(inn.error?.code, `${fn.name} signed in`).toBe("42501");
    });
  }
});

/** Every table the server touches with the secret key (D-711); a read is enough to prove the grant. */
const SECRET_KEY_TABLES = [
  "accounts",
  "memberships",
  "questionnaire_drafts",
  "version_sets",
  "document_versions",
  "generation_log",
  "audit_log",
  "auth_rate_limits",
  "purchases",
  "entitlements",
  "generation_jobs",
  "stripe_events",
  "reminder_settings",
] as const;

describe.skipIf(!enabled)("service_role table grants (D-711)", () => {
  let service: SupabaseClient;

  beforeAll(() => {
    const env = readSupabaseAdminEnv();
    service = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  for (const table of SECRET_KEY_TABLES) {
    it(`${table} is readable through a service-role client`, async () => {
      const r = await service.from(table).select("*").limit(1);
      expect(r.error, `${table}: ${r.error?.code} ${r.error?.message}`).toBe(
        null,
      );
    });
  }
});

/**
 * D-2245: what `authenticated` may do on every relation in `public`, per
 * verb, as `20261016030000_grants_per_verb.sql` states it. A relation with an
 * empty list is server-only. Column-level grants (`imports.undone_at`) are
 * not table grants and are asserted on their own; `anon` holds nothing.
 */
const AUTHENTICATED_TABLE_GRANTS: Record<string, readonly string[]> = {
  // Accounts and the questionnaire (D-422).
  users: ["SELECT", "UPDATE"],
  accounts: ["SELECT", "UPDATE"],
  memberships: ["DELETE", "SELECT"],
  questionnaire_drafts: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  // The member's own-account insert policy needs the verb (#76's run 38875536646).
  audit_log: ["INSERT", "SELECT"],
  account_facts: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  // Documents, payments and the subscription.
  version_sets: ["SELECT"],
  document_versions: ["SELECT"],
  purchases: ["SELECT"],
  entitlements: ["SELECT"],
  generation_jobs: ["SELECT"],
  subscriptions: ["SELECT"],
  checklist_items: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  // The registers.
  incidents: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  complaints: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  worker_clearances: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  policy_reviews: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  incident_events: ["DELETE", "INSERT", "SELECT"],
  complaint_events: ["DELETE", "INSERT", "SELECT"],
  reminders: ["SELECT"],
  corporate_risks: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  participant_risks: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  conflicts_of_interest: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  delegations: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  insurance_items: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  improvements: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  // REQ-033 FR-3 (D-2932): the audit findings register and its view.
  findings: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  staff_matrix: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  onboarding_checklists: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  hazards: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  // REQ-024 A1 (D-2416, Data): the s 17 roles, owner-only through RLS; the items, derived and never removed.
  risk_assessed_roles: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  onboarding_items: ["INSERT", "SELECT", "UPDATE"],
  // REQ-024 Session B (Data, finding 175): the acknowledgements, append-only for clients; the worker's documents view.
  policy_acknowledgements: ["INSERT", "SELECT"],
  document_versions_worker: ["SELECT"],
  // REQ-024 Session C (Data, finding 175): the supervision history, a register like the others.
  supervision_entries: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  // REQ-022 Session B (D-2823): the reminder settings; members read, the owner writes, nobody deletes through the API.
  reminder_settings: ["INSERT", "SELECT", "UPDATE"],
  // REQ-024 A2 (D-2434): the s 14 exception, ended and never removed, so no delete.
  screening_exceptions: ["INSERT", "SELECT", "UPDATE"],
  decisions: ["DELETE", "INSERT", "SELECT"],
  onboarding_ticks: ["DELETE", "INSERT", "SELECT"],
  register_events: ["DELETE", "INSERT", "SELECT"],
  policy_circulations: ["DELETE", "INSERT", "SELECT"],
  document_change_reviews: ["DELETE", "INSERT", "SELECT"],
  self_checks: ["DELETE", "INSERT", "SELECT"],
  imports: ["INSERT", "SELECT"],
  auditor_links: ["INSERT", "SELECT", "UPDATE"],
  invitations: ["INSERT", "SELECT", "UPDATE"],
  report_links: ["INSERT", "SELECT", "UPDATE"],
  registration_periods: ["INSERT", "SELECT", "UPDATE"],
  // REQ-023 Session D (D-2341): the changes register; members read, subscribed members insert and update, nobody deletes.
  commission_changes: ["INSERT", "SELECT", "UPDATE"],
  // The status views.
  incidents_status: ["SELECT"],
  worker_clearances_status: ["SELECT"],
  policy_reviews_status: ["SELECT"],
  corporate_risks_status: ["SELECT"],
  participant_risks_status: ["SELECT"],
  conflicts_of_interest_status: ["SELECT"],
  insurance_items_status: ["SELECT"],
  improvements_status: ["SELECT"],
  findings_status: ["SELECT"],
  staff_matrix_status: ["SELECT"],
  onboarding_checklists_status: ["SELECT"],
  hazards_status: ["SELECT"],
  commission_changes_status: ["SELECT"],
  // REQ-024 A1 (D-2429): the worker's two views without `note`.
  staff_matrix_worker: ["SELECT"],
  worker_clearances_worker: ["SELECT"],
  // Server-only.
  auth_rate_limits: [],
  generation_quota: [],
  generation_log: [],
  stripe_events: [],
  register_sequences: [],
  daily_counters: [],
};

describe.skipIf(!enabled)(
  "the client roles' table grants are per verb (D-2245)",
  () => {
    const dbUrl = process.env.SUPABASE_DB_URL?.trim();
    const sql = (text: string) =>
      execFileSync(
        "psql",
        [dbUrl!, "-v", "ON_ERROR_STOP=1", "-At", "-F", "|", "-c", text],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      )
        .split("\n")
        .filter(Boolean);

    it("has the database URL in CI (the grant checks never skip there)", () => {
      if (!dbUrl)
        expect(process.env.CI, "SUPABASE_DB_URL is not set").toBeFalsy();
    });

    it("every relation in public is listed, and authenticated holds exactly the verbs stated", () => {
      if (!dbUrl) return;
      const relations = sql(
        "select table_name from information_schema.tables where table_schema = 'public' order by 1",
      );
      expect(relations.sort()).toEqual(
        Object.keys(AUTHENTICATED_TABLE_GRANTS).sort(),
      );
      const held: Record<string, string[]> = Object.fromEntries(
        relations.map((r) => [r, [] as string[]]),
      );
      for (const line of sql(
        "select table_name, privilege_type from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' order by 1, 2",
      )) {
        const [table, verb] = line.split("|");
        held[table]?.push(verb);
      }
      for (const [table, verbs] of Object.entries(AUTHENTICATED_TABLE_GRANTS))
        expect(held[table] ?? [], table).toEqual([...verbs]);
    });

    // PO 16 Oct 2026 19:47 (#76's run): a row policy for a write verb that no
    // table grant backs is reachable only through the CLI stack's default
    // privileges and refused on the hosted project, so each such policy must
    // name a table whose grant holds its verb. Policies `for all` are left to
    // the per-verb map above, since a narrower grant under one is by design.
    it("every insert, update or delete policy for authenticated has the table grant behind it", () => {
      if (!dbUrl) return;
      const held = new Map<string, Set<string>>();
      for (const line of sql(
        "select table_name, privilege_type from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' order by 1, 2",
      )) {
        const [table, verb] = line.split("|");
        if (!held.has(table)) held.set(table, new Set());
        held.get(table)!.add(verb);
      }
      const unbacked: string[] = [];
      for (const line of sql(
        "select tablename, policyname, cmd from pg_policies where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE') and ('authenticated' = any(roles) or 'public' = any(roles)) order by 1, 2",
      )) {
        const [table, policy, cmd] = line.split("|");
        const verbs = held.get(table) ?? new Set<string>();
        const column =
          cmd === "UPDATE" &&
          sql(
            `select count(*) from information_schema.column_privileges where grantee = 'authenticated' and table_schema = 'public' and table_name = '${table}' and privilege_type = 'UPDATE'`,
          )[0] !== "0";
        if (!verbs.has(cmd) && !column)
          unbacked.push(`${table}.${policy} (${cmd})`);
      }
      expect(unbacked, "policies without their table grant").toEqual([]);
    });

    it("authenticated may update one column of imports, and anon holds nothing anywhere", () => {
      if (!dbUrl) return;
      expect(
        sql(
          "select column_name from information_schema.column_privileges where grantee = 'authenticated' and table_schema = 'public' and table_name = 'imports' and privilege_type = 'UPDATE' order by 1",
        ),
      ).toEqual(["undone_at"]);
      expect(
        sql(
          "select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' order by 1, 2",
        ),
      ).toEqual([]);
    });
  },
);

describe.skipIf(enabled)("service_role execute grants (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});
