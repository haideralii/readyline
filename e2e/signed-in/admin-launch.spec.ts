import { test, expect } from "@playwright/test";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createAdminTenant,
  createTenant,
  deleteTenant,
  setPlatformAdmin,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-022 Session A, AC-1 and SR-1, SR-2 on the three projects: the launch
 * switchboard renders every row with a name, one of the four states and a
 * sentence; the page's HTML carries none of the environment's values; the
 * visit is audited; a signed-in customer who is not a platform admin gets
 * 404. The green-everywhere case needs a preview with every variable set
 * and is a manual step in the REQ's evidence.
 */
const enabled = hasSupabaseForE2e();
const STATES = ["set", "unset", "mismatched", "unverified"];

test.describe("the launch switchboard (REQ-022 FR-1)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  // The admin is raised through SQL on the local stack (D-2210); never against the hosted project.
  test.skip(
    !process.env.SUPABASE_DB_URL?.trim(),
    "needs SUPABASE_DB_URL (the local stack's database, exported by CI's Supabase job)",
  );

  let admin: TestTenant;
  let customer: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    admin = await createAdminTenant(testInfo.project.name);
    customer = await createTenant({
      label: `launch-customer-${testInfo.project.name}`,
      tradingName: "Not An Admin",
      answers: {},
      withAccount: false,
    });
  });

  test.afterAll(async () => {
    if (admin) {
      // Lowered the way it was raised, before the user goes.
      try {
        setPlatformAdmin(admin.userId, false);
      } catch {
        // The delete below removes the row either way.
      }
      await deleteTenant(admin);
    }
    if (customer) await deleteTenant(customer);
  });

  test("every row has a name, a state and a sentence; no value reaches the page; the visit is audited", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, admin, baseURL!);
    await page.goto("/admin/launch");
    await expect(
      page.getByRole("heading", { level: 1, name: "Launch" }),
    ).toBeVisible();
    await expect(page.getByTestId("launch-summary")).toContainText(
      /\d+ of \d+ set/,
    );
    const rows = page.locator("[data-testid^='launch-row-']");
    expect(await rows.count()).toBeGreaterThanOrEqual(20);
    for (let i = 0; i < (await rows.count()); i += 1) {
      const row = rows.nth(i);
      const state = await row.getAttribute("data-state");
      expect(STATES, `row ${i} state`).toContain(state);
      await expect(row.locator("span.font-medium")).not.toBeEmpty();
    }
    for (const group of [
      "identity",
      "payments",
      "generation",
      "email",
      "domain",
      "jobs",
      "admin",
      "legal",
    ])
      await expect(page.getByTestId(`launch-group-${group}`)).toBeVisible();
    // The CI stack has no Stripe key and no provider: those rows read as unset, never as errors.
    await expect(page.getByTestId("launch-row-email-provider")).toHaveAttribute(
      "data-state",
      "unset",
    );
    await expect(page.getByTestId("launch-row-supabase-urls")).toHaveAttribute(
      "data-state",
      "unverified",
    );
    // The admin who is looking has an authenticator, so that row is green here.
    await expect(page.getByTestId("launch-row-admin-totp")).toHaveAttribute(
      "data-state",
      "set",
    );

    // SR-1: none of the values this process holds appears in the HTML (compared, never printed).
    const html = await page.content();
    for (const name of [
      "SUPABASE_SECRET_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "CRON_SECRET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_PACK",
      "ANTHROPIC_API_KEY",
    ]) {
      const value = process.env[name]?.trim();
      if (value && value.length >= 8)
        expect(html.includes(value), name).toBe(false);
    }
    expect(html.includes(admin.email)).toBe(false);

    // SR-2: the view is in the audit log under the admin's id.
    const audit = await admin.admin
      .from("audit_log")
      .select("action, target")
      .eq("actor_user_id", admin.userId)
      .eq("action", "admin.launch.viewed");
    expect(audit.error).toBeNull();
    expect(audit.data?.length).toBeGreaterThanOrEqual(1);
  });

  test("the test send goes to the admin alone through the log provider, turns its row green and refuses a second press within a minute (REQ-022 FR-6, SR-2)", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, admin, baseURL!);
    await page.goto("/admin/launch");
    await expect(
      page.getByTestId("launch-row-email-test-send"),
    ).toHaveAttribute("data-state", "unset");
    await page.getByTestId("test-send-button").click();
    await expect(page.getByTestId("test-send-result")).toContainText(
      /Sent through the log-only provider/,
    );
    await page.getByTestId("test-send-button").click();
    await expect(page.getByTestId("test-send-result")).toContainText(
      /One test email a minute/,
    );
    await page.reload();
    await expect(
      page.getByTestId("launch-row-email-test-send"),
    ).toHaveAttribute("data-state", "set");
    expect((await page.content()).includes(admin.email)).toBe(false);
    const audit = await admin.admin
      .from("audit_log")
      .select("action, target")
      .eq("actor_user_id", admin.userId)
      .eq("action", "email.test-sent");
    expect(audit.data).toHaveLength(1);
    expect(audit.data?.[0]?.target).toBe("log-only");
  });

  test("a signed-in customer who is not a platform admin gets 404", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, customer, baseURL!);
    const response = await page.goto("/admin/launch");
    expect(response?.status()).toBe(404);
  });
});
