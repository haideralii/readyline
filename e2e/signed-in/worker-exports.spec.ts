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
 * REQ-024 Session A3, the owner's journey on all three projects (D-2207):
 * from the staff matrix to the export screen; the unfilled screening list
 * carries codes, numbers and bracket text; the fill refused without the
 * told line, then built with the typed value in the file; nothing stored
 * afterwards (SR-7); the printable notice; the pack's workers folder.
 * Screenshots under product/evidence/req-024/ with EVIDENCE=1. Needs a
 * Supabase stack; skips without one.
 */
const EVIDENCE_DIR = "product/evidence/req-024";
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/certification-personal-care.json",
    "utf8",
  ),
) as Record<string, unknown>;

const MARK = "Zq Marked Value Xy";

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

test.describe("REQ-024 A3: the worker files, the two lists and the one-time fill", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ timeout: 180_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `exports-${testInfo.project.name}`,
      tradingName: "Harbour Care Services",
      answers,
    });
    const ent = await tenant.admin
      .from("entitlements")
      .insert({ account_id: tenant.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    // Two workers: one current and risk assessed with a numbered clearance,
    // one ended in March; a third never risk assessed (AC-5, AC-10).
    const rows = await tenant.admin.from("staff_matrix").insert([
      {
        account_id: tenant.accountId,
        worker_ref: "W-001",
        role_label: "Support worker",
        role: "support-worker",
        states: ["NSW"],
        risk_assessed: true,
        started_on: "2026-01-05",
        risk_assessed_from: "2026-01-05",
      },
      {
        account_id: tenant.accountId,
        worker_ref: "W-002",
        role_label: "Support worker",
        role: "support-worker",
        states: ["NSW"],
        risk_assessed: true,
        started_on: "2025-02-01",
        risk_assessed_from: "2025-02-01",
        ended_on: "2026-03-31",
      },
      {
        account_id: tenant.accountId,
        worker_ref: "W-004",
        role_label: "Admin",
        role: "admin",
        states: ["NSW"],
        risk_assessed: false,
        started_on: "2026-02-01",
      },
    ]);
    if (rows.error) throw rows.error;
    const check = await tenant.admin.from("worker_clearances").insert({
      account_id: tenant.accountId,
      worker_ref: "W-001",
      role_label: "Support worker",
      clearance_kind: "ndis-worker-screening",
      clearance_number: "WWC7654321",
      application_number: "APP-2026-001",
      issued_on: "2026-01-10",
      expires_on: "2031-01-09",
      verified_in_database_on: "2026-01-11",
      state: "NSW",
    });
    if (check.error) throw check.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the export screen, the unfilled list, the refused and the filled fill, the notice and the pack", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);

    // From the staff matrix to the screen.
    await page.goto("/registers/staff-matrix");
    await page.getByTestId("register-export").click();
    await expect(page).toHaveURL(/\/registers\/staff-matrix\/export$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Worker files and the two Rules lists",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("fill-checkbox")).not.toBeChecked();
    await expect(page.getByTestId("fill-fields")).toBeHidden();
    await expect(page.getByTestId("fill-owner-notice")).toContainText(
      "asking every worker for one file is impracticable",
    );
    await checkWidths(page, "export screen");
    expect(await axeSerious(page, "export screen")).toEqual([]);
    await shot(page, "export-screen", project);

    // Unticked: codes and numbers, bracket text, no name (AC-12).
    const origin = new URL(baseURL!).origin;
    const headers = {
      origin,
      referer: `${origin}/registers/staff-matrix/export`,
    };
    const unfilled = await page.request.post(
      "/registers/staff/export/screening-list",
      { multipart: { as_at: "" }, headers },
    );
    expect(unfilled.status()).toBe(200);
    expect(unfilled.headers()["cache-control"]).toBe("no-store");
    expect(unfilled.headers()["content-disposition"]).toMatch(
      /^attachment; filename="screening-list-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const csv = await unfilled.text();
    expect(csv).toContain("This is a draft of the information");
    expect(csv).toContain("W-001");
    expect(csv).not.toContain("W-004");
    expect(csv).toContain("WWC7654321");
    expect(csv).toContain("APP-2026-001");
    expect(csv).toContain("[Full name]");
    expect(csv).toContain("[Date of birth]");
    expect(csv).toContain("[Address]");

    // A post from another page is refused (SR-8(a)).
    const elsewhere = await page.request.post(
      "/registers/staff/export/screening-list",
      { multipart: {}, headers: { origin, referer: `${origin}/registers` } },
    );
    expect(elsewhere.status()).toBe(403);

    // Ticked without the told line: the form comes back with the value (AC-16).
    await page.getByTestId("fill-checkbox").check();
    await expect(page.getByTestId("fill-fields")).toBeVisible();
    await expect(page.getByTestId("fill-workers-only")).toContainText(
      "Workers only. Never a participant's details.",
    );
    await expect(page.getByTestId("fill-row-W-002")).toContainText(
      "past worker",
    );
    await page.locator('input[name="name:W-001"]').fill(MARK);
    await page.locator('input[name="dob:W-001"]').fill("1990-01-02");
    await shot(page, "export-screen-fill", project);
    // The browser's own required check would stop the post; the handler's
    // refusal is what AC-16 names, so the tick's requirement is lifted here.
    await page
      .getByTestId("fill-told")
      .evaluate((el) => ((el as HTMLInputElement).required = false));
    await page.getByTestId("fill-download-screening-list").click();
    await expect(page.getByTestId("fill-message")).toContainText(
      "Tick the line about telling your workers",
    );
    await expect(page.locator('input[name="name:W-001"]')).toHaveValue(MARK);
    await shot(page, "export-screen-refused", project);

    // Told: the filled list is a download with the value in it.
    await page.getByTestId("fill-told").check();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("fill-download-screening-list").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^screening-list-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const filled = readFileSync(await download.path(), "utf8");
    expect(filled).toContain(MARK);
    expect(filled).toContain("1990-01-02");
    expect(filled).toContain("[Address]");

    // SR-7: nothing holds the value afterwards; the audit line is count-only.
    const audit = await tenant.admin
      .from("audit_log")
      .select("action, target")
      .eq("account_id", tenant.accountId);
    const actions = (audit.data ?? []).map((r) => r.action as string);
    expect(actions).toContain("exports.screening-list.unfilled");
    expect(actions).toContain("exports.screening-list.refused");
    expect(actions).toContain("exports.screening-list.filled");
    expect(JSON.stringify(audit.data)).not.toContain(MARK);
    for (const table of [
      "staff_matrix",
      "worker_clearances",
      "onboarding_items",
      "account_facts",
      "register_events",
    ]) {
      const rows = await tenant.admin
        .from(table)
        .select("*")
        .eq("account_id", tenant.accountId);
      expect(JSON.stringify(rows.data), table).not.toContain(MARK);
    }

    // The printable notice: fixed text, the policy address and its date, no code.
    await page.goto("/registers/staff-matrix/export/notice");
    const notice = page.getByTestId("worker-notice");
    await expect(notice).toContainText("the provider you work for");
    await expect(notice).toContainText("/legal/privacy");
    await expect(notice).not.toContainText("W-001");
    await expect(notice).not.toContainText("employer");
    expect(await axeSerious(page, "worker notice")).toEqual([]);
    await shot(page, "worker-notice-print", project);
  });

  test("the pack's workers folder and the two lists carry codes and numbers and no fill column (AC-5)", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    const res = await page.request.get("/registers/audit-pack.zip");
    expect(res.status()).toBe(200);
    const { unzipSync } = await import("fflate");
    const files = unzipSync(new Uint8Array(await res.body()));
    const names = Object.keys(files);
    expect(names).toContain("workers/index.csv");
    expect(names).toContain("workers/W-001.csv");
    expect(names).toContain("workers/W-002.csv");
    const index = Buffer.from(files["workers/index.csv"]).toString("utf8");
    expect(index).toContain("current,W-001");
    expect(index).toContain("past,W-002");
    const list = names.find((n) => /^screening-list-/.test(n))!;
    const text = Buffer.from(files[list]).toString("utf8");
    expect(text).toContain("WWC7654321");
    expect(text).not.toContain("W-004");
    expect(text).not.toMatch(/full_name|date_of_birth|address/);
    const roles = names.find((n) => /^risk-assessed-roles-/.test(n))!;
    expect(Buffer.from(files[roles]).toString("utf8")).toContain(
      "This is a draft of the information",
    );
  });
});
