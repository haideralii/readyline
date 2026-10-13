import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { e2eCronSecret, hasSupabaseForE2e } from "../helpers/env";
import { checkWidths } from "../helpers/width";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-007 AC-1 on both projects, in fake Stripe mode (D-709): a signed-in
 * owner with a complete questionnaire buys the pack, pays on the fake
 * Checkout page, sees "Preparing", and once the job has run (the webhook's
 * after() hook plus the job route, driven here with the cron secret) the
 * downloads, the receipt link and the refund link work; a fake refund then
 * closes the downloads. Needs a Supabase stack: the local one in CI's
 * Supabase job, or the values in .env.local on a developer machine. Skips
 * without one. No model call is made: the sole-trader set replays fixtures.
 */
const EVIDENCE_DIR = "product/evidence/req-007";
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

test.describe("purchase flow in fake Stripe mode (REQ-007 AC-1)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let tenant: TestTenant;
  let checkoutUrl = "";

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: testInfo.project.name,
      tradingName: "Sunrise Supports",
      answers,
    });
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  // Split in two so the first part runs against a project without the
  // payment tables (the hosted one until PR #15 merges); the second needs them.
  test("signed in: Buy on pricing and documents, the fake Checkout page, cancel", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);

    // Pricing page, signed in: the Buy form replaces the sign-in link.
    await page.goto("/pricing");
    await expect(page.getByTestId("buy-button")).toBeVisible();
    await expect(page.getByTestId("sign-in-to-buy")).toHaveCount(0);
    // REQ-009 Session C: in fake mode the registers subscription is offered.
    await expect(page.getByTestId("subscription-offer")).toContainText(
      "AUD 39 a month",
    );
    await expect(page.getByTestId("subscribe-button")).toBeVisible();
    await checkWidths(page, "pricing (signed in)");
    await shot(page, "pricing-signed-in", project);

    // Documents page before buying: price and Buy.
    await page.goto("/documents");
    await expect(page.getByTestId("purchase-none")).toBeVisible();
    await expect(page.getByTestId("pack-price")).toHaveText("AUD 399");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await checkWidths(page, "documents (signed in, before buying)");
    await shot(page, "documents-buy", project);

    // Buy: the server action creates the (fake) session and redirects to it.
    await page.getByTestId("buy-button").click();
    await expect(page).toHaveURL(/\/dev\/stripe-checkout\/cs_fake_/);
    await expect(page.getByTestId("fake-amount")).toHaveText("AUD 399");
    await expect(page.getByRole("textbox")).toHaveCount(0);
    checkoutUrl = page.url();
    await shot(page, "fake-checkout", project);

    // Cancel goes back to where the customer came from.
    await page.getByTestId("fake-cancel").click();
    await expect(page).toHaveURL(/\/documents$/);
  });

  test("pay, prepare, download, receipt, refund", async ({
    page,
    context,
    baseURL,
    request,
  }, testInfo) => {
    const project = testInfo.project.name;
    expect(checkoutUrl, "the first part produced a checkout URL").toBeTruthy();
    await signInContext(context, tenant, baseURL!);
    await page.goto(checkoutUrl);

    // Pay: a signed checkout.session.completed hits the real webhook; the
    // success URL lands on /documents in the preparing state.
    await page.getByTestId("fake-pay").click();
    await expect(page).toHaveURL(/\/documents\?purchase=success&session_id=/);
    await expect(page.getByTestId("purchase-preparing")).toBeVisible();
    await expect(page.getByTestId("purchase-thanks")).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "usually 10 to 20 minutes",
    );
    await shot(page, "documents-preparing", project);

    // Drive the job: the webhook's after() hook runs it, and the job route
    // (called here as the cron would) carries on if anything remains.
    const deadline = Date.now() + 180_000;
    let ready = false;
    while (Date.now() < deadline) {
      const run = await request.get("/api/jobs/generate", {
        headers: { authorization: `Bearer ${e2eCronSecret()}` },
      });
      expect(run.status()).toBe(200);
      await page.goto("/documents");
      if (await page.getByTestId("purchase-ready").isVisible()) {
        ready = true;
        break;
      }
      await expect(page.getByTestId("purchase-delayed")).toHaveCount(0);
      await page.waitForTimeout(2000);
    }
    expect(ready, "the set became ready").toBe(true);
    await expect(page.getByTestId("purchase-thanks")).toHaveCount(0);
    await checkWidths(page, "documents (ready)");
    await expect(page.getByTestId("receipt-link")).toHaveAttribute(
      "href",
      /\/dev\/stripe-checkout\/cs_fake_.*receipt=1/,
    );
    const refund = page.getByTestId("refund-link");
    if (process.env.CONTACT_EMAIL) {
      await expect(refund).toHaveAttribute(
        "href",
        /^mailto:.*Refund%20request%20/,
      );
    } else {
      await expect(page.getByText(/quote reference/)).toBeVisible();
    }
    await shot(page, "documents-ready", project);

    // Downloads: the route redirects to a short-lived signed URL.
    const setHref = await page.getByTestId("download-zip").getAttribute("href");
    expect(setHref).toMatch(
      /\/documents\/[0-9a-f-]{36}\/download\?file=set\.zip$/,
    );
    for (const file of ["set.zip", "readiness-summary.pdf"]) {
      // page.request shares the browser context's cookies; the bare request fixture has no session.
      const r = await page.request.get(setHref!.replace("set.zip", file), {
        maxRedirects: 0,
      });
      expect(r.status(), file).toBe(302);
      expect(r.headers()["location"]).toMatch(/token=/);
    }
    await page.getByTestId("open-set").click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Document set" }),
    ).toBeVisible();
    await expect(page.getByTestId("set-locked")).toHaveCount(0);

    // The account page lists the purchase with its receipt.
    await page.goto("/account");
    await expect(page.getByTestId("purchases")).toContainText("AUD 399");
    await checkWidths(page, "account (signed in)");
    await expect(
      page.getByRole("link", { name: "View receipt" }),
    ).toBeVisible();

    // Refund (fake charge.refunded): the entitlement is revoked, downloads close.
    await page.goto(checkoutUrl);
    await page.getByTestId("fake-refund").click();
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByTestId("purchase-refunded")).toBeVisible();
    await expect(page.getByTestId("buy-again-button")).toBeVisible();
    await shot(page, "documents-refunded", project);
    const closed = await page.request.get(setHref!, { maxRedirects: 0 });
    expect(closed.status()).toBe(404);
    await page.goto(setHref!.replace(/\/download\?file=set\.zip$/, ""));
    await expect(page.getByTestId("set-locked")).toBeVisible();

    // A replayed completed event grants nothing new (duplicate event id).
    await page.goto(checkoutUrl);
    await page.getByTestId("fake-pay").click();
    await expect(page).toHaveURL(/\/documents\?purchase=success/);
    await expect(page.getByTestId("purchase-refunded")).toBeVisible();
  });
});
