import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { addMonths, formatLongDate } from "@/lib/registers/status";
import { hasSupabaseForE2e } from "../helpers/env";
import { addDays, todaySydney } from "../helpers/dates";
import { seedIncidents } from "../helpers/registers-seed";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-031 Session B, AC-10 (FR-5; D-2890): with a period whose reading is
 * null the renewal step reads "to read"; opening "What changed since the
 * last audit" records the reading, and the step and the audit-day link read
 * "Read on <today>"; an incident logged after that makes the step "to read"
 * again. The member's branch is the integration test (RLS). Needs a
 * Supabase stack.
 */
const enabled = hasSupabaseForE2e();
const today = todaySydney();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/certification-personal-care.json",
    "utf8",
  ),
) as Record<string, unknown>;
const ends = addDays(today, 175);
const starts = addMonths(ends, -36);

test.describe("the what-changed reading mark (REQ-031 Session B)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `req-031-b-${testInfo.project.name}`,
      tradingName: "Harbour Care",
      answers,
    });
    const ent = await tenant.admin
      .from("entitlements")
      .insert({ account_id: tenant.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    const period = await tenant.admin.from("registration_periods").insert({
      account_id: tenant.accountId,
      period_starts_on: starts,
      period_ends_on: ends,
      audit_type: "certification",
      midterm_applies: true,
      last_audit_on: starts,
    });
    if (period.error) throw period.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("AC-10: to read, then Read on today after the page is opened, then to read again after an incident", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/path/renewal");
    const state = page.getByTestId("renewal-state-what-changed");
    await expect(state).toHaveText("(to read)");
    await expect(page.getByTestId("renewal-step-what-changed")).toHaveAttribute(
      "data-done",
      "false",
    );
    await expect(page.getByTestId("renewal-next")).toHaveText("Read it");

    // Opening the page records the reading once it has rendered.
    await page.goto("/path/audit-day/what-changed");
    await expect(page.getByTestId("what-changed-title")).toHaveText(
      "What changed since the last audit",
    );
    await expect
      .poll(
        async () => {
          const r = await tenant.admin
            .from("registration_periods")
            .select("what_changed_read_at")
            .eq("account_id", tenant.accountId)
            .maybeSingle();
          return r.data?.what_changed_read_at ?? null;
        },
        { timeout: 20_000 },
      )
      .not.toBeNull();

    const readLine = `(Read on ${formatLongDate(today)})`;
    await page.goto("/path/renewal");
    await expect(state).toHaveText(readLine);
    await expect(page.getByTestId("renewal-step-what-changed")).toHaveAttribute(
      "data-done",
      "true",
    );
    await expect(page.getByTestId("renewal-next")).not.toHaveText("Read it");
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-what-changed")).toContainText(
      readLine,
    );

    // A change logged after the reading, whatever day it is dated for.
    await seedIncidents(tenant, 1);
    await page.goto("/path/renewal");
    await expect(state).toHaveText("(to read)");
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-what-changed")).toContainText(
      "(to read)",
    );
  });
});
