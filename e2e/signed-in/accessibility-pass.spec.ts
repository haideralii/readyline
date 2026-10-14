import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  gotoSettled,
  pagePass,
  pickOption,
  resetFocusTrail,
  tabUntil,
  type KeyboardWalk,
} from "../helpers/a11y";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-015 Section E, the accessibility pass on the signed-in pages
 * (standing backlog 1, D-1508), on all three projects: a subscribed owner's
 * result, checklist, documents, account, the registers index, every
 * register list and form, the before-you-buy and audit-day screens pass
 * axe (serious and critical), have every control named and every list
 * labelled, honour reduced motion and hold 200 % text without sideways
 * scroll; then the incident form is filled and saved with the keyboard
 * only, and its detail and edit pages pass too. Finish your pack and Adopt
 * are checked in the guided-path spec, which has a purchased set. Needs a
 * Supabase stack; skips without one.
 */
const EVIDENCE_DIR = "product/evidence/req-015";
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;

const PAGES = [
  "/start/result",
  "/checklist",
  "/documents",
  "/account",
  "/registers",
  "/registers/incidents",
  "/registers/incidents/new",
  "/registers/complaints",
  "/registers/complaints/new",
  "/registers/worker-checks",
  "/registers/worker-checks/new",
  "/registers/policy-reviews",
  "/registers/policy-reviews/new",
  "/path/before-you-buy",
  "/path/audit-day",
];

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

test.describe("accessibility pass, signed in (REQ-015 Section E, backlog 1)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `a11y-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
    const ent = await tenant.admin
      .from("entitlements")
      .insert({ account_id: tenant.accountId, kind: "subscription" })
      .select("id")
      .single();
    if (ent.error) throw ent.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("every signed-in page passes the page checks", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await signInContext(context, tenant, baseURL!);
    const summary: Record<string, string[]> = {};
    for (const path of PAGES) {
      await gotoSettled(page, path);
      summary[path] = await pagePass(page, path);
    }
    testInfo.annotations.push({
      type: "axe-summary",
      description: JSON.stringify(summary),
    });
    await page.goto("/registers");
    await shot(page, "a11y-registers", testInfo.project.name);
  });

  test("the incident form by keyboard only, then its detail and edit pages", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await signInContext(context, tenant, baseURL!);
    const walk: KeyboardWalk = { steps: [] };
    await page.goto("/registers/incidents/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "Add an incident" }),
    ).toBeVisible();
    await resetFocusTrail(page);
    const label = "incident form";
    // The two dates are pre-filled with today; Tab passes through them (segments allowed).
    await tabUntil(page, page.locator("#occurredOn"), walk, { label });
    await tabUntil(page, page.locator("#category"), walk, { label });
    await pickOption(
      page,
      "category",
      "restrictive-practice-unauthorised",
      label,
    );
    await tabUntil(page, page.locator("#severity"), walk, { label });
    await pickOption(page, "severity", "low", label);
    await tabUntil(page, page.locator("#participantRef"), walk, { label });
    await page.keyboard.type("p-014");
    await expect(page.locator("#participantRef")).toHaveValue("P-014");
    await tabUntil(page, page.locator("#summary"), walk, { label });
    await page.keyboard.type(
      "Door locked for ten minutes without a plan in place.",
    );
    await tabUntil(page, page.locator("#reportable"), walk, { label });
    await page.keyboard.press("Space");
    await expect(page.locator("#reportable")).toBeChecked();
    await expect(page.getByTestId("notify-by")).toBeVisible();
    await shot(page, "keyboard-incident", testInfo.project.name);
    await tabUntil(page, page.getByTestId("register-submit"), walk, { label });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      /\/registers\/incidents\/[0-9a-f-]{36}\?saved=1$/,
    );
    await expect(page.getByTestId("register-saved")).toBeVisible();
    testInfo.annotations.push({
      type: "keyboard-stops",
      description: String(walk.steps.length),
    });

    const detail = page.url().replace(/\?saved=1$/, "");
    await page.goto(detail);
    await pagePass(page, "incident detail");
    await page.goto(`${detail}/edit`);
    await pagePass(page, "incident edit");
    await page.goto("/registers/incidents");
    await pagePass(page, "incidents list with a row");
  });
});
