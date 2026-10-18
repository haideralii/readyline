/**
 * REQ-012 FR-1f, AC-4: the three row-level security cases for the tables
 * the coverage map found without one (src/lib/ops/rls-coverage.test.ts,
 * first run 18 Oct 2026): a cross-tenant read returns nothing, a forged
 * insert is refused, a cross-tenant update writes nothing. Each table has
 * its own `it` naming it, through `threeCases("<table>", …)`, which the
 * map reads as the three cases for that table; the rows satisfy every
 * CHECK, so what refuses them is the policy or the missing grant and not a
 * constraint. Server-only tables (the generation queue and log, the quota,
 * Stripe's subscriptions, the version sets) refuse the owner too, which is
 * the point of their having no insert or update grant. Throwaway tenants on
 * the local stack (SR-2). Skips itself without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

type Tenant = { client: SupabaseClient; accountId: string; userId: string };

async function signUpTenant(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Tenant> {
  const email = `rls-cov-${label}-${randomUUID()}@example.test`;
  const password = `Pw-${randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw created.error ?? new Error("createUser failed");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  const rpc = await client.rpc("create_account", {
    p_trading_name: `Coverage ${label}`,
    p_business_structure: "sole-trader",
    p_states: ["NSW"],
    p_abn: null,
  });
  if (rpc.error) throw rpc.error;
  return {
    client,
    accountId: rpc.data as string,
    userId: created.data.user.id,
  };
}

/** A refused write: the policy's 42501, or no row visible to write. */
function refused(r: { error: { code?: string } | null; data: unknown }) {
  return (
    r.error !== null ||
    (Array.isArray(r.data) && r.data.length === 0) ||
    r.data === null
  );
}

type Spec = {
  /** A's row through the service role; null when the account already has one. */
  seed: Record<string, unknown> | null;
  /** B's forged row for A's account; the string fields are looked for afterwards. */
  forged: Record<string, unknown>;
  /** B's change to A's rows. */
  change: Record<string, unknown>;
  /** The owner has no insert or update grant either. */
  serverOnly?: boolean;
};

const ALL_TABLES: string[] = [];
let admin: SupabaseClient;
let a: Tenant;
let b: Tenant;

/** The three cases for one table, as the map reads them (src/lib/ops/rls-coverage.ts). */
async function threeCases(table: string, spec: Spec) {
  if (spec.seed) {
    const seeded = await admin
      .from(table)
      .insert({ account_id: a.accountId, ...spec.seed });
    expect(seeded.error, `${table} seed`).toBeNull();
  }
  const theirs = await b.client
    .from(table)
    .select("account_id")
    .eq("account_id", a.accountId);
  expect(theirs.data ?? [], `${table} cross-tenant read`).toEqual([]);

  const forged = await b.client
    .from(table)
    .insert({ account_id: a.accountId, ...spec.forged })
    .select("account_id");
  expect(
    refused(forged),
    `${table} forged insert: ${JSON.stringify(forged.error)}`,
  ).toBe(true);
  const strings = Object.fromEntries(
    Object.entries(spec.forged).filter(([, v]) => typeof v === "string"),
  );
  if (Object.keys(strings).length > 0) {
    const landed = await admin
      .from(table)
      .select("account_id")
      .eq("account_id", a.accountId)
      .match(strings);
    expect(landed.data ?? [], `${table} forged row absent`).toEqual([]);
  }

  const changed = await b.client
    .from(table)
    .update(spec.change)
    .eq("account_id", a.accountId)
    .select("account_id");
  expect(
    refused(changed),
    `${table} cross-tenant update: ${JSON.stringify(changed.error)}`,
  ).toBe(true);

  if (spec.serverOnly) {
    const own = await a.client
      .from(table)
      .insert({ account_id: a.accountId, ...spec.forged })
      .select("account_id");
    expect(own.error?.code, `${table} owner insert`).toBe("42501");
    const ownChange = await a.client
      .from(table)
      .update(spec.change)
      .eq("account_id", a.accountId)
      .select("account_id");
    expect(refused(ownChange), `${table} owner update`).toBe(true);
  }
  ALL_TABLES.push(table);
}

const TITLE =
  "another tenant reads nothing, cannot forge a row and changes nothing";
const SERVER_ONLY = `${TITLE}; the owner cannot write it either`;

describe.skipIf(!enabled)(
  "row-level security cases for the tables the map found short (REQ-012 FR-1f, AC-4)",
  () => {
    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
      a = await signUpTenant(admin, env.url, key, "a");
      b = await signUpTenant(admin, env.url, key, "b");
    });

    it(`account_facts: ${TITLE}`, () =>
      threeCases("account_facts", {
        seed: { key: "owner-role", value: "Director" },
        forged: { key: "forged-key", value: "x" },
        change: { value: "changed" },
      }));

    it(`conflicts_of_interest: ${TITLE}`, () =>
      threeCases("conflicts_of_interest", {
        seed: {
          who_ref: "KP-1",
          conflict: "Related party supplier",
          managed_by: "Declared and excluded from the decision",
          declared_on: "2026-01-05",
          review_on: "2026-07-05",
        },
        forged: {
          who_ref: "KP-2",
          conflict: "Forged",
          managed_by: "Forged",
          declared_on: "2026-01-05",
          review_on: "2026-07-05",
        },
        change: { conflict: "Changed by another tenant" },
      }));

    it(`delegations: ${TITLE}`, () =>
      threeCases("delegations", {
        seed: { role: "owner-or-director", holder_ref: "KP-1" },
        forged: { role: "finance-approver", holder_ref: "KP-2" },
        change: { holder_ref: "KP-9" },
      }));

    it(`generation_jobs: ${SERVER_ONLY}`, () =>
      threeCases("generation_jobs", {
        seed: {},
        forged: {},
        change: { attempts: 9 },
        serverOnly: true,
      }));

    it(`generation_log: ${SERVER_ONLY}`, () =>
      threeCases("generation_log", {
        seed: {
          document_type_id: "code-of-conduct",
          section_id: "purpose",
          prompt_version: "test",
          model: "fixture",
          request_hash: "h",
          status: "generated",
          attempts: 1,
        },
        forged: {
          document_type_id: "code-of-conduct",
          section_id: "purpose",
          prompt_version: "test",
          model: "fixture",
          request_hash: "h2",
          status: "generated",
          attempts: 1,
        },
        change: { attempts: 9 },
        serverOnly: true,
      }));

    it(`generation_quota: ${SERVER_ONLY}`, () =>
      threeCases("generation_quota", {
        seed: { day: "2026-01-05" },
        forged: { day: "2026-01-06" },
        change: { count: 99 },
        serverOnly: true,
      }));

    it(`insurance_items: ${TITLE}`, () =>
      threeCases("insurance_items", {
        seed: {
          kind: "public-liability",
          label: "Insurer A",
          expires_on: "2027-01-05",
        },
        forged: {
          kind: "public-liability",
          label: "Forged",
          expires_on: "2027-01-05",
        },
        change: { label: "Changed" },
      }));

    it(`participant_risks: ${TITLE}`, () =>
      threeCases("participant_risks", {
        seed: {
          participant_ref: "P-1",
          risk: "Falls when transferring",
          controls: "Two workers for transfers",
          review_on: "2026-07-05",
        },
        forged: {
          participant_ref: "P-2",
          risk: "Forged",
          controls: "Forged",
          review_on: "2026-07-05",
        },
        change: { risk: "Changed" },
      }));

    it(`policy_circulations: ${TITLE}`, () =>
      threeCases("policy_circulations", {
        seed: {
          document_type_id: "code-of-conduct",
          circulated_on: "2026-01-05",
          worker_refs: "W-1",
        },
        forged: {
          document_type_id: "code-of-conduct",
          circulated_on: "2026-01-06",
          worker_refs: "W-2",
        },
        change: { how: "Changed" },
      }));

    it(`questionnaire_drafts: ${TITLE}`, () =>
      threeCases("questionnaire_drafts", {
        // create_account wrote A's draft; the primary key is the account.
        seed: null,
        forged: {
          answers: { forged: true },
          answers_version: 1,
          current_step: "business",
        },
        change: { current_step: "result" },
      }));

    it(`reminder_settings: ${TITLE}`, () =>
      threeCases("reminder_settings", {
        seed: {},
        forged: {},
        change: { do_not_send: false },
      }));

    it(`risk_assessed_roles: ${TITLE}`, () =>
      threeCases("risk_assessed_roles", {
        seed: { title: "Support worker" },
        forged: { title: "Forged role" },
        change: { title: "Changed" },
      }));

    it(`subscriptions: ${SERVER_ONLY}`, () =>
      threeCases("subscriptions", {
        seed: {
          stripe_subscription_id: `sub_cov_${randomUUID()}`,
          status: "active",
        },
        forged: {
          stripe_subscription_id: `sub_forged_${randomUUID()}`,
          status: "active",
        },
        change: { status: "canceled" },
        serverOnly: true,
      }));

    it(`version_sets: ${SERVER_ONLY}`, () =>
      threeCases("version_sets", {
        seed: {
          answers_snapshot_hash: "h",
          derived_result: {},
          status: "ready",
          storage_prefix: "cov/a",
        },
        forged: {
          answers_snapshot_hash: "h",
          derived_result: {},
          status: "ready",
          storage_prefix: "cov/forged",
        },
        change: { status: "failed" },
        serverOnly: true,
      }));

    it("the anonymous key reads none of these tables", async () => {
      const env = readSupabaseAdminEnv();
      const anon = createClient(
        env.url,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      expect(ALL_TABLES).toHaveLength(14);
      for (const table of ALL_TABLES) {
        const r = await anon
          .from(table)
          .select("account_id")
          .eq("account_id", a.accountId);
        expect(r.data ?? [], table).toEqual([]);
      }
    });
  },
);
