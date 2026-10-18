import { test, expect } from "@playwright/test";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * Live QA of b340ee3, the acceptance read of REQ-022 B (D-2836): the account
 * page carries the control the unsubscribe page promises. Needs a Supabase
 * stack; one case on desktop-chromium and android-small.
 */
const enabled = hasSupabaseForE2e();

test.describe("live QA b340ee3: reminder emails on the account page", () => {
  test.skip(!enabled, "needs the Supabase variables");
  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `reminders-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers: {},
    });
    const row = await tenant.admin.from("reminder_settings").insert({
      account_id: tenant.accountId,
      do_not_send: true,
      do_not_send_reason: "unsubscribed",
      do_not_send_at: "2026-10-10T03:00:00Z",
    });
    if (row.error) throw row.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("off since the day they stopped them, one button turns them back on, and the line then reads on", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/account");
    const line = page.getByTestId("reminder-emails-line");
    await expect(line).toContainText(
      "Reminder emails: off since 10 October 2026.",
    );
    await page.getByTestId("reminder-emails-resume").click();
    await expect(page.getByTestId("reminder-emails-line")).toHaveText(
      "Reminder emails: on.",
    );
    await expect(page.getByTestId("reminder-emails-resume")).toHaveCount(0);
    const row = await tenant.admin
      .from("reminder_settings")
      .select("do_not_send, do_not_send_at")
      .eq("account_id", tenant.accountId)
      .single();
    expect(row.data).toEqual({ do_not_send: false, do_not_send_at: null });
    const audit = await tenant.admin
      .from("audit_log")
      .select("action")
      .eq("account_id", tenant.accountId)
      .eq("action", "email.reminders-resumed");
    expect(audit.data?.length).toBe(1);
  });
});
