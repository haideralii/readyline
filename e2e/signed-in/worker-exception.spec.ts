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
 * REQ-024 Session A2, the owner's journey on all three projects (Test
 * expectations: "A2, the exception with its four lines"; D-2207 one journey
 * per session): a WA provider (the state the file verifies as allowing
 * pending work on both tests) with a cleared, database-verified supervisor
 * W-2, an adopted procedure version carrying the Division 3 plan and one
 * participant risk row, seeded as the registers and the job would write
 * them; the owner adds W-4 in WA, reads why the exception is not yet
 * available, records the application, reads the four lines, ticks the
 * declaration and starts the exception; the list reads "Items outstanding
 * (clearance pending, supervised)"; the owner ends it on the clearance
 * issued and the row's history shows it. Never "ready". Screenshots under
 * product/evidence/req-024/ with EVIDENCE=1. Needs a Supabase stack.
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

const PROCEDURE = "worker-screening-and-recruitment-procedure";

/**
 * After a save the page refreshes and the server's own state is what proves
 * it, not the panel's "Saved." line, which a refresh may take with it; when
 * the next state never comes, the panel's refusal is read into the assertion
 * so CI's log names it (PO 06:32).
 */
async function afterSave(page: Page, nextTestId: string, step: string) {
  const next = page.getByTestId(nextTestId);
  const message = page.getByTestId("exception-message");
  const reasons = page.getByTestId("exception-reasons");
  await expect(next.or(message).or(reasons)).toBeVisible({ timeout: 20_000 });
  if (await next.isVisible().catch(() => false)) return;
  if (await message.isVisible().catch(() => false))
    throw new Error(
      `${step}: the panel refused the save: ${(await message.textContent()) ?? "(no message)"}`,
    );
  // The third state (PO 07:05): the option absent, the gates named on the page.
  throw new Error(
    `${step}: the option is absent; the gates say: ${(await reasons.textContent()) ?? "(no reasons)"}`,
  );
}

test.describe("REQ-024 A2: the s 14 exception with its four lines", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ timeout: 180_000 });
  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `exception-${testInfo.project.name}`,
      tradingName: "Swan River Supports",
      answers,
    });
    const admin = tenant.admin;
    const ent = await admin
      .from("entitlements")
      .insert({ account_id: tenant.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    // The supervisor's row and clearance, verified in the database (gate i).
    const sup = await admin.from("staff_matrix").insert({
      account_id: tenant.accountId,
      worker_ref: "W-2",
      role_label: "team leader",
      role: "team-leader",
      risk_assessed: true,
      states: ["WA"],
    });
    if (sup.error) throw sup.error;
    const clearance = await admin.from("worker_clearances").insert({
      account_id: tenant.accountId,
      worker_ref: "W-2",
      role_label: "team leader",
      clearance_kind: "ndis-worker-screening",
      clearance_number: "NWS 7001",
      issued_on: "2025-02-01",
      expires_on: "2030-02-01",
      verified_in_database_on: "2025-02-03",
      state: "WA",
    });
    if (clearance.error) throw clearance.error;
    // One participant risk row, by code (FR-4a; the plan is complete only with rows).
    const risk = await admin.from("participant_risks").insert({
      account_id: tenant.accountId,
      participant_ref: "P-14",
      risk: "Tires in the afternoon and may fall.",
      controls: "Shorter outings after two o'clock.",
      review_on: "2027-03-01",
    });
    if (risk.error) throw risk.error;
    // The procedure's adopted version carrying the Division 3 plan, as the job and the adopt step leave it.
    const set = await admin
      .from("version_sets")
      .insert({
        account_id: tenant.accountId,
        created_by: tenant.userId,
        answers_snapshot_hash: "a2-e2e",
        // The shape `loadQuestionnaire` reads: the account's modules decide the W-7 items.
        derived_result: { documents: [], registers: [], modules: [] },
        status: "ready",
        document_count: 1,
        fallback_section_count: 0,
        generated_count: 0,
        storage_prefix: "",
      })
      .select("id")
      .single();
    if (set.error) throw set.error;
    const version = await admin.from("document_versions").insert({
      version_set_id: set.data.id,
      account_id: tenant.accountId,
      document_type_id: PROCEDURE,
      version: 3,
      status: "ready",
      storage_path: "a2-e2e/procedure.v3.docx",
      adopted_on: "2026-10-20",
      model: {
        typeId: PROCEDURE,
        title: "Worker screening and recruitment procedure",
        kind: "procedure",
        version: "1",
        generatedAt: "2026-10-01",
        reviewDueAt: "2027-10-01",
        facts: { tradingName: "Swan River Supports" },
        sections: [
          {
            id: "division-3-plan",
            number: "8",
            heading: "Risk management plan for workers awaiting clearance",
            mode: "fixed",
            status: "fixed",
            blocks: [],
          },
        ],
        footer: "",
      },
    });
    if (version.error) throw version.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the reasons, the application, the four lines, the start, the label and the end", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);

    // The worker in WA, risk assessed.
    await page.goto("/registers/staff-matrix/new");
    await page.locator("#worker_ref").fill("w-4");
    await page.locator("#role").selectOption("support-worker");
    await page.locator("#role_label").fill("support worker");
    await page.locator("#risk_assessed").check();
    await page.locator("#risk_paragraph").selectOption("b");
    await page.locator("#states-WA").check();
    await page.getByRole("button", { name: "Add a worker" }).click();
    await expect(page).toHaveURL(/\/registers\/staff-matrix\?saved=/);
    const list = page.getByTestId("staff-matrix-list");
    await list.getByRole("link", { name: /W-4/ }).click();
    await expect(page.getByTestId("worker-items")).toBeVisible();

    // Before the application: the option is absent and says to record it first.
    const panel = page.getByTestId("exception-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("exception-reasons")).toContainText(
      "record the application first",
    );
    await expect(page.locator("main")).not.toContainText(/\bready\b/i);
    await checkWidths(page, "exception panel, no application");
    await axeSerious(page, "exception panel, no application");
    await shot(page, "exception-reasons", project);

    // Record the application (FR-4, finding 109): the number, the state, the database check.
    await page.locator("#application-number").fill("WA-2026-0441");
    await page.locator("#application-state").selectOption("WA");
    await page.locator("#verified-on").fill("2026-10-30");
    await page.getByTestId("record-application").click();
    await afterSave(page, "start-exception-form", "record the application");

    // The four lines, verbatim in their shape (FR-4; AC-2).
    const start = page.getByTestId("start-exception-form");
    await expect(start).toBeVisible();
    const lines = page.getByTestId("exception-lines").locator("li");
    await expect(lines).toHaveCount(4);
    await expect(lines.nth(0)).toContainText(
      "we confirmed this application to the unit in the NDIS Worker Screening Database (s 15(3)(aa) and (4)) on <date>; the unit's written notice seen on <date>; application number WA-2026-0441 recorded in Readyline on <date>",
    );
    await expect(lines.nth(1)).toHaveText(
      "supervised by <worker code> (holds a current clearance)",
    );
    await expect(lines.nth(2)).toContainText(
      "our Division 3 risk management plan, version 3 adopted 20 October 2026, with the participant risk register current to",
    );
    await expect(lines.nth(3)).toContainText("applied in Western Australia:");
    await expect(lines.nth(3)).toContainText("works in WA: Western Australia:");
    await expect(page.locator("#supervisor-ref")).toHaveValue("W-2");
    await checkWidths(page, "exception start form");
    await axeSerious(page, "exception start form");
    await shot(page, "exception-start", project);

    // Without the tick the server refuses with the s 15(2)(a) and (b) line (AC-2).
    await page.locator("#notice-seen-on").fill("2026-10-29");
    await page.locator("#declaration-on").fill("2026-11-01");
    await page.getByTestId("start-exception").click();
    await expect(page.getByTestId("exception-message")).toContainText(
      "s 15(2)(a) and (b)",
    );
    await page.locator("#declaration").check();
    await page.getByTestId("start-exception").click();
    await expect(page.getByTestId("exception-running")).toBeVisible();
    await expect(page.getByTestId("exception-running")).toContainText(
      "Supervised by W-2 (holds a current clearance).",
    );
    await expect(page.getByTestId("exception-running")).toContainText(
      "version 3 adopted 20 October 2026",
    );
    // The derived state's label while the exception runs (AC-2, D-2411).
    await expect(page.getByTestId("worker-state")).toHaveText(
      "Items outstanding (clearance pending, supervised)",
    );
    await expect(page.locator("main")).not.toContainText(/\bready\b/i);
    await shot(page, "exception-running", project);

    // The staff list carries the same label.
    await page.goto("/registers/staff-matrix");
    await expect(page.getByTestId("staff-matrix-list")).toContainText(
      "Items outstanding (clearance pending, supervised)",
    );
    await page
      .getByTestId("staff-matrix-list")
      .getByRole("link", { name: /W-4/ })
      .click();

    // The end on the clearance issued (finding 168): the row's history and the plain label back.
    await page.locator("#end-code").selectOption("clearance-issued");
    await page.locator("#ended-on").fill("2026-11-10");
    await page.getByTestId("end-exception").click();
    await expect(page.getByTestId("exception-history")).toContainText(
      "2 November 2026 to 10 November 2026; the clearance was issued (s 15(1)); supervised by W-2",
    );
    await expect(page.getByTestId("worker-state")).toHaveText(
      "Items outstanding",
    );
    // The clearance row now carries its issue date; the worker checks register reads it.
    await page.goto("/registers/worker-checks");
    await expect(page.getByTestId("worker-checks-list")).toContainText("W-4");
    await shot(page, "exception-ended", project);
  });
});
