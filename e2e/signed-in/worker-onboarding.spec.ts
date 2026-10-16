import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { axeSerious } from "../helpers/a11y";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { checkWidths } from "../helpers/width";

/**
 * REQ-024 Session A1, the owner's journey on all three projects (Test
 * expectations: "the owner adds a worker and walks the list to 'every item
 * recorded'"; D-2207 one journey per session): the owner adds a support
 * worker with a role, a state and the children flag; the staff list shows
 * the derived state in D-2411's words with the "from the dates you typed"
 * line; the worker's page shows the derived items with who, what counts,
 * the ask and the source, the state facts under W-1 and W-2; the owner
 * records items and the clearance with the database check date; the state
 * moves to "All before-first-shift items recorded" and the onboarding date
 * lands on the row. Screenshots under product/evidence/req-024/ with
 * EVIDENCE=1. Needs a Supabase stack; skips without one.
 */
const EVIDENCE_DIR = "product/evidence/req-024";
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/certification-personal-care.json",
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

const today = () => {
  const d = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

test.describe("REQ-024 A1: the owner adds a worker and walks the list", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ timeout: 180_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `onboarding-${testInfo.project.name}`,
      tradingName: "Harbour Care Services",
      answers,
    });
    const ent = await tenant.admin
      .from("entitlements")
      .insert({ account_id: tenant.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the derived list, the state in the allowed words, the clearance check and the record", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);

    // FR-1: the row with the closed role, one state and the children flag.
    await page.goto("/registers/staff-matrix/new");
    await page.locator("#worker_ref").fill("w-2");
    await page.locator("#role").selectOption("support-worker");
    await page.locator("#role_label").fill("support worker");
    await page.locator("#risk_assessed").check();
    await page.locator("#risk_paragraph").selectOption("b");
    await page.locator("#states-NSW").check();
    await page.locator("#works_with_children").check();
    await page.getByRole("button", { name: "Add a worker" }).click();
    await expect(page).toHaveURL(/\/registers\/staff-matrix\?saved=/);

    // FR-3: the list names the state in D-2411's words and carries the line; never "ready".
    const list = page.getByTestId("staff-matrix-list");
    await expect(list).toContainText("W-2");
    await expect(list).toContainText("Items outstanding");
    await expect(list).toContainText(/Next: /);
    await expect(page.getByTestId("from-the-dates-line")).toContainText(
      "From the dates you typed; the clearance itself is what the Commission's database shows.",
    );
    await expect(page.locator("main")).not.toContainText(/\bready\b/i);
    await checkWidths(page, "staff list");
    await axeSerious(page, "staff list");
    await shot(page, "staff-list", project);

    // The worker's page: the derived items with who, what counts, the ask, the source and the state facts.
    await list.getByRole("link", { name: /W-2/ }).click();
    await expect(page.getByTestId("worker-items")).toBeVisible();
    await expect(page.getByTestId("worker-state")).toHaveText(
      "Items outstanding",
    );
    const w1 = page.getByTestId("worker-item-w1-clearance");
    await expect(w1).toContainText("NDIS Worker Screening Database");
    await expect(w1).toContainText("The auditor asks:");
    await expect(w1).toContainText("Source:");
    await expect(w1).toContainText(/New South Wales:/);
    const w2 = page.getByTestId("worker-item-w2-children-check");
    await expect(w2).toContainText("two separate checks");
    await expect(w2).toContainText("New South Wales 5 years");
    // W-7 from the core module: first aid and CPR as "your call".
    await expect(page.getByTestId("worker-item-w7-first-aid")).toContainText(
      "your call",
    );
    await expect(page.getByTestId("worker-item-w7-cpr")).toBeVisible();
    await expect(page.getByTestId("worker-item-w8-supervision")).toBeVisible();
    await checkWidths(page, "worker page");
    await axeSerious(page, "worker page");
    await shot(page, "worker-page", project);

    // The owner records the before-first-shift items the owner can record alone.
    await page.locator("#ticked-by").fill("kp-1");
    for (const id of [
      "identity-and-agreement",
      "w3-code-of-conduct",
      "w4-orientation-module",
      "w5-induction",
      "w6-policies",
      "participant-plans-read",
      "emergency-plan-shown",
    ]) {
      await page.getByTestId(`record-${id}`).click();
      await expect(page.getByTestId(`worker-item-${id}`)).toHaveAttribute(
        "data-state",
        "recorded",
      );
    }
    // W-1 confirmed on the item alone is not enough: the database check must be dated on the row (finding 151).
    await page.getByTestId("record-w1-clearance").click();
    await expect(page.getByTestId("worker-item-w1-clearance")).toContainText(
      "confirmed",
    );
    await expect(page.getByTestId("worker-state")).toHaveText(
      "Items outstanding",
    );
    await expect(page.getByTestId("worker-next")).toContainText(
      "NDIS Worker Screening Database",
    );

    // FR-5: the clearance row with the number, the issue date and the database check; the children's check with its expiry.
    await page.goto("/registers/worker-checks/new");
    await page.locator("#workerRef").fill("w-2");
    await page.locator("#roleLabel").fill("support worker");
    await page.locator("#clearanceKind").selectOption("ndis-worker-screening");
    await page.locator("#clearanceNumber").fill("NWS 2026 0042");
    await page.locator("#issuedOn").fill("2026-01-10");
    await page.locator("#expiresOn").fill("2031-01-10");
    await page.locator("#verifiedInDatabaseOn").fill(today());
    await page.locator("#state").selectOption("NSW");
    await page.getByRole("button", { name: "Add the check" }).click();
    await expect(page).toHaveURL(/\/registers\/worker-checks\?saved=/);
    await page.goto("/registers/worker-checks/new");
    await page.locator("#workerRef").fill("w-2");
    await page.locator("#roleLabel").fill("support worker");
    await page.locator("#clearanceKind").selectOption("wwcc");
    await page.locator("#issuedOn").fill("2026-01-10");
    await page.locator("#expiresOn").fill("2031-01-10");
    await page.getByRole("button", { name: "Add the check" }).click();
    await expect(page).toHaveURL(/\/registers\/worker-checks\?saved=/);

    // Back on the worker's page: W-2 is recorded from the row's expiry once confirmed; the state turns.
    await page.goto("/registers/staff-matrix");
    await page
      .getByTestId("staff-matrix-list")
      .getByRole("link", { name: /W-2/ })
      .click();
    await expect(page.getByTestId("worker-clearances")).toContainText(
      "checked in the database",
    );
    await page.locator("#ticked-by").fill("kp-1");
    await page.getByTestId("record-w2-children-check").click();
    await expect(page.getByTestId("worker-state")).toHaveText(
      "All before-first-shift items recorded",
    );
    await expect(page.locator("main")).not.toContainText(/\bready\b/i);
    await shot(page, "worker-recorded", project);
    // The row's onboarding date landed (FR-2).
    await page.goto("/registers/staff-matrix");
    await expect(page.getByTestId("staff-matrix-list")).toContainText(
      "All before-first-shift items recorded",
    );
    const row = await tenant.admin
      .from("staff_matrix")
      .select("onboarding_signed_on, risk_assessed_from, role_ref")
      .eq("account_id", tenant.accountId)
      .eq("worker_ref", "W-2")
      .single();
    expect(row.data?.onboarding_signed_on).toBe(today());
    expect(row.data?.risk_assessed_from).toBe(today());
    expect(row.data?.role_ref).toBeTruthy();
  });
});
