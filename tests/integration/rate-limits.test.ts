/**
 * REQ-012 FR-1e, AC-3: every database-backed limit at its own constant,
 * against the real `auth_rate_limit_hit` on the local stack: hit n-1 and
 * hit n allowed, hit n+1 refused, a sibling key untouched, the function the
 * service key's alone. The keys are fresh per run (a fixed key would come
 * back with a restored stack, as the restore rehearsal showed on 18 Oct).
 * The constants are imported from the modules the actions use and pinned
 * to the numbers the REQ lists, so a change to a limit is a change here.
 * The per-instance limiters (D-424) are unit-tested in
 * src/lib/ops/memory-limits.test.ts. Skips itself without the Supabase
 * variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { RESULT_EMAIL_LIMITS } from "@/lib/path/result-email";
import { IMPORT_LIMITS } from "@/lib/registers/import";
import { REPORT_ACCOUNT_LIMIT, REPORT_LIMIT } from "@/lib/registers/worker";
import {
  AUDITOR_OPEN_LIMIT,
  CHECKOUT_LIMIT,
  EXPORT_LIMIT,
  FILL_LIMIT,
  MAGIC_LINK_LIMITS,
  REDRAFT_LIMIT,
  REGISTER_EXPORT_LIMIT,
  REGISTER_WRITE_LIMIT,
} from "@/server/auth/rate-limit";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

type Limit = { limit: number; windowSeconds: number };

/** The table: each limited key as the code builds it, with the numbers the REQ lists. */
export const LIMITS: ReadonlyArray<{
  name: string;
  prefix: string;
  value: Limit;
  expected: Limit;
}> = [
  {
    name: "magic link per email",
    prefix: "email",
    value: MAGIC_LINK_LIMITS.perEmail,
    expected: { limit: 5, windowSeconds: 3600 },
  },
  {
    name: "magic link per address",
    prefix: "ip",
    value: MAGIC_LINK_LIMITS.perIp,
    expected: { limit: 20, windowSeconds: 3600 },
  },
  {
    name: "account export",
    prefix: "export",
    value: EXPORT_LIMIT,
    expected: { limit: 5, windowSeconds: 3600 },
  },
  {
    name: "register export and audit pack",
    prefix: "register-export",
    value: REGISTER_EXPORT_LIMIT,
    expected: { limit: 5, windowSeconds: 3600 },
  },
  {
    name: "checkout",
    prefix: "checkout",
    value: CHECKOUT_LIMIT,
    expected: { limit: 5, windowSeconds: 3600 },
  },
  {
    name: "spreadsheet import",
    prefix: "import",
    value: { limit: IMPORT_LIMITS.perHour, windowSeconds: 3600 },
    expected: { limit: 5, windowSeconds: 3600 },
  },
  {
    name: "register write",
    prefix: "register-write",
    value: REGISTER_WRITE_LIMIT,
    expected: { limit: 60, windowSeconds: 60 },
  },
  {
    name: "one-time fill",
    prefix: "fill",
    value: FILL_LIMIT,
    expected: { limit: 10, windowSeconds: 3600 },
  },
  {
    // REQ-033 Session B SR-B3: ten section redrafts an hour per account.
    name: "section redraft",
    prefix: "redraft",
    value: REDRAFT_LIMIT,
    expected: { limit: 10, windowSeconds: 3600 },
  },
  {
    name: "auditor link open",
    prefix: "auditor-open",
    value: AUDITOR_OPEN_LIMIT,
    expected: { limit: 60, windowSeconds: 3600 },
  },
  {
    name: "incident report per address",
    prefix: "report",
    value: REPORT_LIMIT,
    expected: { limit: 10, windowSeconds: 3600 },
  },
  {
    name: "incident report per account",
    prefix: "report-account",
    value: REPORT_ACCOUNT_LIMIT,
    expected: { limit: 50, windowSeconds: 86_400 },
  },
  {
    name: "result email per address (REQ-031)",
    prefix: "result-email",
    value: RESULT_EMAIL_LIMITS.perAddress,
    expected: { limit: 1, windowSeconds: 3600 },
  },
  {
    name: "result email per connection (REQ-031)",
    prefix: "result-email-ip",
    value: RESULT_EMAIL_LIMITS.perIp,
    expected: { limit: 5, windowSeconds: 3600 },
  },
];

describe("the limits are the numbers the REQ lists (FR-1e)", () => {
  for (const l of LIMITS)
    it(`${l.name}: ${l.expected.limit} in ${l.expected.windowSeconds} seconds`, () => {
      expect(l.value).toEqual(l.expected);
    });
});

describe.skipIf(!enabled)(
  "rate limits on the local stack (REQ-012 FR-1e, AC-3)",
  () => {
    let admin: SupabaseClient;
    let anon: SupabaseClient;

    beforeAll(() => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      anon = createClient(
        env.url,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
    });

    async function hit(key: string, limit: Limit): Promise<boolean> {
      const r = await admin.rpc("auth_rate_limit_hit", {
        p_key: key,
        p_limit: limit.limit,
        p_window_seconds: limit.windowSeconds,
      });
      if (r.error) throw r.error;
      return r.data !== false;
    }

    for (const l of LIMITS) {
      it(`${l.name}: hit ${l.value.limit} allowed, hit ${l.value.limit + 1} refused, a sibling key untouched`, async () => {
        const key = `${l.prefix}:${randomUUID()}`;
        for (let i = 1; i <= l.value.limit; i++)
          expect(await hit(key, l.value), `${l.name} hit ${i}`).toBe(true);
        expect(
          await hit(key, l.value),
          `${l.name} hit ${l.value.limit + 1}`,
        ).toBe(false);
        expect(
          await hit(key, l.value),
          `${l.name} hit ${l.value.limit + 2}`,
        ).toBe(false);
        expect(
          await hit(`${l.prefix}:${randomUUID()}`, l.value),
          `${l.name} sibling`,
        ).toBe(true);
      });
    }

    it("the counter is the service key's alone: the anon key is refused", async () => {
      const r = await anon.rpc("auth_rate_limit_hit", {
        p_key: `anon:${randomUUID()}`,
        p_limit: 5,
        p_window_seconds: 60,
      });
      expect(r.error?.code).toBe("42501");
    });
  },
);
