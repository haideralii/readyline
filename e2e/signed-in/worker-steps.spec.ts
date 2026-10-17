import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { checkWidths } from "../helpers/width";

/**
 * REQ-024 Session B (FR-7, FR-8, FR-9; AC-3, AC-6's page half) on
 * `desktop-chromium` and `android-small`: the owner invites a worker who
 * has a staff row and a pending screening row; the worker accepts, sees the
 * collection notice once, then their steps first; types the check number
 * and the expiry and reads "Waiting for your manager to confirm"; the owner
 * confirms on the worker's page and the worker's home reads "Confirmed";
 * the acknowledgement list says what is not adopted yet; a worker opening
 * the registers or the account is sent back. Needs a Supabase stack.
 */
const EVIDENCE_DIR = "product/evidence/req-024";
const enabled = hasSupabaseForE2e();

async function shot(page: Page, name: string, project: string) {
  if (!process.env.EVIDENCE) return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${name}-b-${project}.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 40,
    scale: "css",
  });
}

test.describe("REQ-024 B: the worker's own steps", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let owner: TestTenant;
  let worker: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    owner = await createTenant({
      label: `steps-owner-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers: {},
    });
    const ent = await owner.admin
      .from("entitlements")
      .insert({ account_id: owner.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    worker = await createTenant({
      label: `steps-worker-${testInfo.project.name}`,
      tradingName: "",
      answers: {},
      withAccount: false,
    });
    const row = await owner.admin.from("staff_matrix").insert({
      account_id: owner.accountId,
      worker_ref: "W-003",
      role_label: "support worker",
      role: "support-worker",
      states: ["NSW"],
      risk_assessed: true,
      risk_paragraph: "a",
    });
    if (row.error) throw row.error;
    const pending = await owner.admin.from("worker_clearances").insert({
      account_id: owner.accountId,
      worker_ref: "W-003",
      role_label: "support worker",
      clearance_kind: "ndis-worker-screening",
      application_number: "APP 2026 0003",
      state: "NSW",
    });
    if (pending.error) throw pending.error;
  });

  test.afterAll(async () => {
    if (worker) await deleteTenant(worker);
    if (owner) await deleteTenant(owner);
  });

  test("the worker's steps come first; the three fields wait for the manager; the owner confirms; the registers are not the worker's", async ({
    page,
    context,
    browser,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    // The owner invites.
    await signInContext(context, owner, baseURL!);
    await page.goto("/account");
    await expect(page.getByTestId("team-panel")).toContainText(
      "complete their onboarding",
    );
    await page.getByLabel("Their email address").fill(worker.email);
    await page.getByLabel("Their worker code").fill("w-003");
    await page.getByTestId("team-invite-submit").click();
    const inviteUrl = await page.getByTestId("team-invite-url").inputValue();

    // The worker accepts, sees the notice once, then their steps first.
    const workerContext = await browser.newContext();
    await signInContext(workerContext, worker, baseURL!);
    const w = await workerContext.newPage();
    await w.goto(inviteUrl);
    await w.getByTestId("invite-accept").click();
    await expect(w).toHaveURL(/\/worker$/);
    await w.getByTestId("worker-notice-continue").click();
    await expect(w.getByTestId("worker-home-line")).toContainText(
      "complete your onboarding",
    );
    const steps = w.getByTestId("worker-steps");
    await expect(steps).toBeVisible();
    const stepsBox = (await steps.boundingBox())!;
    const entriesBox = (await w.getByTestId("worker-entries").boundingBox())!;
    expect(stepsBox.y).toBeLessThan(entriesBox.y);
    await expect(w.getByTestId("worker-step-state-w1-clearance")).toContainText(
      "To do",
    );
    // The acknowledgement items say nothing is adopted yet.
    await expect(w.getByTestId("worker-ack-w6-policies")).toContainText(
      "not adopted by your manager yet",
    );
    await checkWidths(w, `worker steps (${project})`);
    await shot(w, "worker-steps", project);

    // W-1: the check number and the expiry on the worker's own row.
    await w.getByLabel("Check number (optional)").fill("WC 2026 0003");
    await w.getByLabel("Expiry (optional)").fill("2031-11-01");
    await w.getByTestId("worker-clearance-save").click();
    await expect(w.getByTestId("worker-step-state-w1-clearance")).toContainText(
      "Waiting for your manager to confirm",
    );
    await shot(w, "worker-steps-waiting", project);

    // W-4: a date the worker records.
    await w.getByTestId("worker-done-w4-orientation-module").click();
    await expect(
      w.getByTestId("worker-step-state-w4-orientation-module"),
    ).toContainText("Waiting for your manager to confirm");

    // AC-6's page half: the registers and the account are not the worker's.
    await w.goto("/registers");
    await expect(w).not.toHaveURL(/\/registers$/);
    await w.goto("/account");
    await expect(w).not.toHaveURL(/\/account$/);

    // The owner confirms W-4 on the worker's page; the worker's home reads it.
    await page.goto("/registers/staff-matrix");
    await page
      .getByTestId("staff-matrix-list")
      .getByRole("link", { name: /W-003/ })
      .first()
      .click();
    await expect(page.getByTestId("worker-items")).toBeVisible();
    await page.locator("#ticked-by").fill("kp-1");
    await page.getByTestId("record-w4-orientation-module").click();
    await expect(
      page.getByTestId("worker-item-w4-orientation-module"),
    ).toContainText(/confirmed .* by KP-1 \(owner\)/);
    await w.goto("/worker");
    await expect(
      w.getByTestId("worker-step-state-w4-orientation-module"),
    ).toContainText("Confirmed");
    await shot(w, "worker-steps-confirmed", project);
    await workerContext.close();
  });
});
