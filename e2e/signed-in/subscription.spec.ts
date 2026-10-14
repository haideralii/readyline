import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-009 Session C in fake Stripe mode (D-709): a signed-in owner
 * subscribes from the pricing page, the fake page posts the
 * subscription-mode completion to the real webhook, the registers open for
 * writing, the account page shows the subscription and the billing portal
 * button; a failed payment keeps writes; cancelling freezes them with the
 * one-line message; renewing restores them. Needs a Supabase stack.
 */
const EVIDENCE_DIR = "product/evidence/req-009";
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;

async function shot(page: Page, name: string, project: string) {
  if (!process.env.EVIDENCE) return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${name}-${project}.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 40,
    scale: "css",
  });
}

test.describe("registers subscription in fake Stripe mode (REQ-009 Session C)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let tenant: TestTenant;
  let portalUrl = "";

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `subscription-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("subscribe from pricing: the fake page, the webhook, writes open", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers");
    await expect(page.getByTestId("register-lapsed")).toBeVisible();
    await page.goto("/pricing");
    await expect(page.getByTestId("subscription-offer")).toContainText(
      /cancel at any time/i,
    );
    // No pay-later, no trial wording (CLAUDE.md 5); "no instalments" is the promise itself.
    await expect(page.getByTestId("subscription-offer")).not.toContainText(
      /pay later|afterpay|free trial/i,
    );
    await page.getByTestId("subscribe-button").click();
    await expect(page).toHaveURL(/\/dev\/stripe-checkout\/cs_fake_/);
    await expect(page.getByTestId("fake-amount")).toContainText(
      "AUD 39 a month",
    );
    await expect(page.getByRole("textbox")).toHaveCount(0);
    portalUrl = page.url();
    await shot(page, "subscription-fake-checkout", project);
    await page.getByTestId("fake-subscribe").click();
    await expect(page).toHaveURL(/\/registers\?subscribed=1/);
    await expect(page.getByTestId("register-lapsed")).toHaveCount(0);
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("register-add")).toBeVisible();
    await page.goto("/account");
    await expect(page.getByTestId("subscription-status")).toContainText(
      /^Active/,
    );
    await expect(page.getByTestId("billing-portal-button")).toBeVisible();
    await shot(page, "subscription-account", project);
  });

  test("a failed payment keeps writes open; cancelling freezes them; renewing restores them", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    expect(portalUrl).toBeTruthy();
    await signInContext(context, tenant, baseURL!);
    // The billing portal button opens the fake portal (the same page, portal view).
    await page.goto("/account");
    await page.getByTestId("billing-portal-button").click();
    await expect(page).toHaveURL(/\/dev\/stripe-checkout\/.*portal=1/);
    // The portal page must render its controls; a missing one fails here in
    // a minute rather than at the test's own cap (batch 43).
    await expect(page.getByTestId("fake-payment-failed")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByTestId("fake-payment-failed").click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId("subscription-status")).toContainText(
      /retrying/,
    );
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("register-add")).toBeVisible();

    await page.goto(portalUrl.replace(/\?.*$/, "") + "?portal=1");
    await page.getByTestId("fake-cancel-subscription").click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId("subscription-status")).toContainText(
      /lapsed/,
    );
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("register-lapsed")).toContainText(
      /read-only/,
    );
    await expect(page.getByTestId("register-add")).toHaveCount(0);
    await shot(page, "subscription-lapsed", project);

    await page.goto(portalUrl.replace(/\?.*$/, "") + "?portal=1");
    await page.getByTestId("fake-renew").click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId("subscription-status")).toContainText(
      /^Active/,
    );
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("register-add")).toBeVisible();
  });
});
