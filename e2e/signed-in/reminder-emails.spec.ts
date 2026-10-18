import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { addMonths } from "@/lib/registers/status";
import { TIMELINE_FIXED_SENTENCE } from "@/lib/registers/timeline";
import { e2eCronSecret, hasSupabaseForE2e } from "../helpers/env";
import { addDays, todaySydney } from "../helpers/dates";
import {
  createTenant,
  deleteTenant,
  type TestTenant,
} from "../helpers/session";

/**
 * QA live b340ee3, batch C (3) and (4) (report D flows 14, 24 and 40): the
 * nightly reminder email and the unsubscribe click, end to end. The job is
 * fired as the cron would, with the secret; the log provider's test-only
 * outbox (EMAIL_OUTBOX_FILE, set by the e2e web server) holds what a real
 * provider would have sent, one JSON line a message. Then the unsubscribe
 * link the email carries is opened cold, the job runs again and sends
 * nothing for the account, and a second click is the confirmation or a 404,
 * never an error. Needs a Supabase stack; desktop and Android.
 */
const OUTBOX = ".e2e-outbox.ndjson";
const enabled = hasSupabaseForE2e();
const today = todaySydney();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;

type Captured = {
  at: string;
  to: string;
  subject: string;
  text: string;
  template?: string;
  accountId?: string | null;
};

function captured(accountId: string): Captured[] {
  if (!existsSync(OUTBOX)) return [];
  return readFileSync(OUTBOX, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Captured)
    .filter((m) => m.accountId === accountId);
}

test.describe("the reminder email and the unsubscribe click (REQ-009 FR-3, REQ-023 FR-3, REQ-022 FR-7)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let tenant: TestTenant;
  let unsubscribeLink = "";

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `reminder-emails-${testInfo.project.name}`,
      tradingName: "Riverbend Care",
      answers,
    });
    const admin = tenant.admin;
    const accountId = tenant.accountId;
    const ent = await admin
      .from("entitlements")
      .insert({ account_id: accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    // REQ-023 FR-3: a certification period that began 12 months ago, so the prepare reminder
    // (start plus 12 months, about the must-start-by date at 18) fires today.
    const period = await admin.from("registration_periods").insert({
      account_id: accountId,
      period_starts_on: addMonths(today, -12),
      period_ends_on: addMonths(today, 24),
      audit_type: "certification",
      midterm_applies: true,
    });
    if (period.error) throw period.error;
    // REQ-009 FR-3: a worker check expiring in seven days (the 7-day reminder fires today).
    const check = await admin.from("worker_clearances").insert({
      account_id: accountId,
      worker_ref: "W-001",
      role_label: "support worker",
      clearance_kind: "wwcc",
      issued_on: "2021-10-20",
      expires_on: addDays(today, 7),
    });
    if (check.error) throw check.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the nightly job sends one email with the clearance line as a code, the prepare line, the fixed sentence once, the footer and the unsubscribe line (flows 14 and 24)", async ({
    request,
  }) => {
    const run = await request.get("/api/jobs/reminders", {
      headers: { authorization: `Bearer ${e2eCronSecret()}` },
    });
    expect(run.status()).toBe(200);
    const report = (await run.json()) as { emailed: number; errors: string[] };
    expect(report.errors).toEqual([]);
    const mine = captured(tenant.accountId);
    expect(mine, "one email for the account").toHaveLength(1);
    const email = mine[0];
    expect(email.to).toBe(tenant.email);
    expect(email.template).toBe("reminders");
    expect(email.subject).toMatch(/^Readyline: 2 register reminders$/);
    const text = email.text;
    expect(text).toContain("Reminders for Riverbend Care:");
    // SR-4: the worker by code, never a name.
    expect(text).toMatch(/^- Worker check W-001 expires on /m);
    expect(text).not.toMatch(/support worker/);
    // REQ-023 FR-3: the prepare line with its source word.
    expect(text).toMatch(
      /^- Start preparing for your mid-term audit; it must start by \d{1,2} [A-Z][a-z]+ \d{4} \(Rules s 13B\)\.$/m,
    );
    // Finding 56: the fixed certificate sentence once, then the account-page pointer.
    expect(text.split(TIMELINE_FIXED_SENTENCE).length - 1).toBe(1);
    expect(text).toContain(
      "Your registration timeline is on your account page.",
    );
    // The footer and the unsubscribe line (REQ-022 FR-7, SR-6).
    expect(text).toMatch(
      /Readyline provides general information and document templates for your own review; it is not legal advice\./,
    );
    const link = /To stop these reminder emails: (\S+)/.exec(text);
    expect(link, "the unsubscribe line").not.toBeNull();
    unsubscribeLink = link![1];
    expect(new URL(unsubscribeLink).pathname).toMatch(
      /^\/email\/unsubscribe\/[0-9a-f]{64}$/,
    );
    expect(unsubscribeLink).not.toContain(tenant.accountId);
    // The timeline line leaves its audit line (REQ-023 FR-3).
    const audit = await tenant.admin
      .from("audit_log")
      .select("action")
      .eq("account_id", tenant.accountId)
      .eq("action", "reminder.midterm-prepare.sent");
    expect(audit.data).toHaveLength(1);
  });

  test("the unsubscribe link opens cold to the confirmation, the next run sends nothing for the account, and a second click is the confirmation or a 404 (flow 40)", async ({
    browser,
    request,
  }) => {
    expect(unsubscribeLink, "the link from the captured email").toBeTruthy();
    const cold = await browser.newContext();
    try {
      const page = await cold.newPage();
      const first = await page.goto(unsubscribeLink);
      expect(first?.status()).toBe(200);
      await expect(page.getByTestId("unsubscribe-line")).toContainText(
        "You will get no more reminder emails from Readyline for Riverbend Care.",
      );
      expect(page.url()).not.toContain(tenant.accountId);
      // The next night: the 7-day check is on its day, a reminder is due, and nothing is sent.
      const before = captured(tenant.accountId).length;
      const again = await request.get(
        `/api/jobs/reminders?today=${addDays(today, 7)}`,
        { headers: { authorization: `Bearer ${e2eCronSecret()}` } },
      );
      expect(again.status()).toBe(200);
      const report = (await again.json()) as {
        suppressed: number;
        errors: string[];
      };
      expect(report.errors).toEqual([]);
      expect(report.suppressed).toBeGreaterThanOrEqual(1);
      expect(captured(tenant.accountId)).toHaveLength(before);
      const settings = await tenant.admin
        .from("reminder_settings")
        .select("do_not_send")
        .eq("account_id", tenant.accountId)
        .single();
      expect(settings.data?.do_not_send).toBe(true);
      // A second click: the same confirmation or a plain 404, never an error page.
      const second = await page.goto(unsubscribeLink);
      expect([200, 404]).toContain(second?.status());
      if (second?.status() === 200)
        await expect(page.getByTestId("unsubscribe-line")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(
        /Application error|Internal Server Error/,
      );
    } finally {
      await cold.close();
    }
  });
});
