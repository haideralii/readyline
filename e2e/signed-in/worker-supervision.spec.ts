import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { checkWidths } from "../helpers/width";

/**
 * REQ-024 Session C (FR-10, FR-11, FR-12, FR-13; AC-5's two audiences,
 * AC-9, AC-10) on `desktop-chromium` and `android-small`: the owner records
 * a supervision session and a probation review on a worker's row and reads
 * the history; the audit-day page, the checklist and the self-check read
 * the derived states in one line; a spreadsheet adds workers with their
 * checklists derived and a participant's name refused; ending a worker
 * moves the row under "Past workers", sends the worker's session back and
 * keeps the worker in the pack and on the screening list; the owner's pack
 * and the auditor link's pack carry the same worker file with the entries
 * and no fill column; a period filters the entries and sets the list's
 * "as at". Needs a Supabase stack.
 */
const EVIDENCE_DIR = "product/evidence/req-024";
const enabled = hasSupabaseForE2e();
// The checklist and the audit-day page derive from the questionnaire, so the owner needs a saved result (#104 run 1).
const personalCare = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/certification-personal-care.json",
    "utf8",
  ),
) as Record<string, unknown>;

async function shot(page: Page, name: string, project: string) {
  if (!process.env.EVIDENCE) return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${name}-c-${project}.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 40,
    scale: "css",
  });
}

const todaySydney = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const daysAgo = (n: number) => {
  const d = new Date(`${todaySydney()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

test.describe("REQ-024 C: supervision, the derived states, the import and ending a worker", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  let owner: TestTenant;
  let worker: TestTenant;
  let rowId: string;

  test.beforeAll(async ({}, testInfo) => {
    owner = await createTenant({
      label: `supervision-owner-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers: personalCare,
    });
    const ent = await owner.admin
      .from("entitlements")
      .insert({ account_id: owner.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    worker = await createTenant({
      label: `supervision-worker-${testInfo.project.name}`,
      tradingName: "",
      answers: {},
      withAccount: false,
    });
    // The worker's membership seeded directly (D-2340's rule for a worker session), not through the invitation flow.
    const m = await owner.admin.from("memberships").insert({
      user_id: worker.userId,
      account_id: owner.accountId,
      role: "worker",
      worker_ref: "W-003",
    });
    if (m.error) throw m.error;
    const row = await owner.admin
      .from("staff_matrix")
      .insert({
        account_id: owner.accountId,
        worker_ref: "W-003",
        role_label: "support worker",
        role: "support-worker",
        states: ["NSW"],
        risk_assessed: true,
        risk_paragraph: "a",
        started_on: "2026-02-01",
        risk_assessed_from: "2026-02-01",
      })
      .select("id")
      .single();
    if (row.error) throw row.error;
    rowId = row.data.id as string;
  });

  test.afterAll(async () => {
    if (worker) await deleteTenant(worker);
    if (owner) await deleteTenant(owner);
  });

  test("the owner records a session and a probation review; the audit-day page, the checklist and the self-check read the states (FR-10, FR-11, AC-9)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, owner, baseURL!);
    await page.goto(`/registers/staff-matrix/${rowId}`);
    const panel = page.getByTestId("supervision-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("supervision-last")).toContainText(
      "No supervision recorded yet",
    );
    await expect(page.getByTestId("supervision-none")).toBeVisible();

    // A supervision session with a note.
    await page.locator("#supervision-held-on").fill(daysAgo(10));
    await page.locator("#supervision-by-ref").fill("kp-1");
    await page
      .locator("#supervision-note")
      .fill("Covered the incident procedure and the roster.");
    await page.getByTestId("supervision-save").click();
    await expect(page.getByTestId("supervision-saved")).toBeVisible();
    const history = page.getByTestId("supervision-history");
    await expect(history).toContainText("Supervision session on");
    await expect(history).toContainText("with KP-1");
    await expect(page.getByTestId("supervision-last")).toContainText(
      "Last supervision contact",
    );
    // The staff row's fact reads the same date through the trigger.
    await expect(page.getByTestId("row-facts")).toContainText(daysAgo(10));

    // A probation review: an outcome and no note; the later day moves the row's date.
    await page.locator("#supervision-kind").selectOption("probation-review");
    await expect(page.locator("#supervision-note")).toHaveCount(0);
    await page.locator("#supervision-held-on").fill(daysAgo(2));
    await page.locator("#supervision-by-ref").fill("W-002");
    await page.locator("#supervision-outcome").selectOption("continued");
    await page.getByTestId("supervision-save").click();
    await expect(page.getByTestId("supervision-saved")).toBeVisible();
    await expect(history.locator("li")).toHaveCount(2);
    await expect(history.locator("li").first()).toContainText(
      "Probation review on",
    );
    await expect(history.locator("li").first()).toContainText(
      "probation continued",
    );
    await expect(page.getByTestId("row-facts")).toContainText(daysAgo(2));
    await expect(page.locator("main")).not.toContainText(/\bready\b/i);
    await checkWidths(page, `supervision panel (${project})`);
    await shot(page, "supervision", project);

    // A future day is kept out by the picker (max today) and refused by the action (unit-tested); not driven here, since a browser blocks the submit on the constraint before the action runs.
    // FR-10: the audit-day page's people line, the checklist's derived line, the self-check's question.
    await page.goto("/path/audit-day");
    const line = page.getByTestId("audit-day-people-line");
    await expect(line).toContainText(
      "From your staff list: 1 worker with items outstanding",
    );
    // D-2411 is a rule for the worker's words; the page's own summary says "N of M things ready" (REQ-017), so the check is on the line.
    await expect(line).not.toContainText("ready");
    await shot(page, "audit-day-people", project);
    await page.goto("/checklist");
    await expect(
      page.getByTestId("checklist-derived-people-worker-screening-clearances"),
    ).toContainText("From your staff list: 1 worker with items outstanding");
    await page.goto("/path/audit-day/check");
    await expect(page.locator("main")).toContainText("Check my systems");
  });

  test("a spreadsheet adds workers with their checklists derived; a participant's name fails its row (FR-13)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, owner, baseURL!);
    await page.goto("/registers/staff-matrix");
    await page.getByRole("link", { name: "Import from a spreadsheet" }).click();
    await expect(page).toHaveURL(/\/registers\/staff-matrix\/import$/);
    const template = await page.request.get(
      "/registers/staff-matrix/import-template.csv",
    );
    expect(template.status()).toBe(200);
    const header = (await template.text()).replace(/^﻿/, "").trim();
    expect(header.startsWith("worker_ref,")).toBe(true);
    const cols = header.split(",");
    const row = (over: Record<string, string>) =>
      cols
        .map(
          (c) =>
            ({
              worker_ref: "W-005",
              role: "support-worker",
              role_label: "Support worker",
              states: "NSW;VIC",
              risk_assessed: "yes",
              risk_paragraph: "b",
              works_with_children: "no",
              may_use_restrictive_practice: "no",
              started_on: "2026-03-01",
              qualifications: "Cert III",
              note: "",
              ...over,
            })[c] ?? "",
        )
        .join(",");
    const csv = `${header}\n${row({})}\n${row({
      worker_ref: "W-006",
      note: "Jane Citizen lives at 12 High Street",
    })}\n`;
    await page.getByTestId("import-file").setInputFiles({
      name: "staff.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await expect(page.getByTestId("import-counts")).toContainText(
      "1 of 2 rows pass",
    );
    await expect(page.getByTestId("import-failure")).toContainText(
      "looks like a name",
    );
    await checkWidths(page, `staff import (${project})`);
    await shot(page, "staff-import", project);
    await page.getByTestId("import-commit").click();
    await expect(page).toHaveURL(/\/registers\/staff-matrix\?imported=1$/);
    const list = page.getByTestId("staff-matrix-list");
    await expect(list).toContainText("W-005");
    await expect(list).not.toContainText("W-006");
    // The derived checklist exists for the imported worker and nothing was imported into it.
    const checklist = await owner.admin
      .from("onboarding_checklists")
      .select("id")
      .eq("account_id", owner.accountId)
      .eq("kind", "worker")
      .eq("subject_ref", "W-005");
    expect(checklist.data?.length).toBe(1);
    const items = await owner.admin
      .from("onboarding_items")
      .select("item_id, done_on, confirmed_on")
      .eq("checklist_id", checklist.data![0].id as string);
    expect(items.data?.length).toBeGreaterThan(3);
    expect(items.data?.every((i) => !i.done_on && !i.confirmed_on)).toBe(true);
    const imported = await owner.admin
      .from("register_events")
      .select("kind")
      .eq("account_id", owner.accountId)
      .eq("register", "staff_matrix")
      .eq("kind", "imported");
    expect(imported.data?.length).toBe(1);
    await list.getByRole("link", { name: /W-005/ }).click();
    await expect(page.getByTestId("worker-items")).toBeVisible();
    await expect(page.getByTestId("row-facts")).toContainText("NSW");
  });

  test("ending a worker: past workers, the session sent back, the pack's two audiences and the period (FR-12, AC-5, AC-10)", async ({
    page,
    context,
    browser,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    // The worker reaches their home while the membership stands.
    const workerContext = await browser.newContext();
    await signInContext(workerContext, worker, baseURL!);
    const w = await workerContext.newPage();
    await w.goto("/worker");
    await expect(w).toHaveURL(/\/worker$/);

    await signInContext(context, owner, baseURL!);
    await page.goto(`/registers/staff-matrix/${rowId}`);
    await page.getByTestId("row-edit").locator("summary").click();
    await page.locator("#ended_on").fill(todaySydney());
    await page
      .getByTestId("audit-day-form-staff-matrix")
      .locator('button[type="submit"]')
      .click();
    await expect(page).toHaveURL(/\/registers\/staff-matrix\?saved=/);
    const past = page.getByTestId("staff-matrix-past");
    await expect(past).toBeVisible();
    await expect(past).toContainText("W-003");
    await expect(page.getByTestId("staff-matrix-list")).not.toContainText(
      "W-003",
    );
    await checkWidths(page, `past workers (${project})`);
    await shot(page, "past-workers", project);

    // The membership is gone; the worker's next request is sent back.
    const membership = await owner.admin
      .from("memberships")
      .select("user_id")
      .eq("account_id", owner.accountId)
      .eq("user_id", worker.userId);
    expect(membership.data ?? []).toEqual([]);
    await w.goto("/worker");
    await expect(w).not.toHaveURL(/\/worker$/);
    await workerContext.close();
    const ended = await owner.admin
      .from("register_events")
      .select("kind, note")
      .eq("account_id", owner.accountId)
      .eq("register", "staff_matrix")
      .eq("row_id", rowId)
      .eq("kind", "ended");
    expect(ended.data?.length).toBe(1);

    // The owner's pack: the file carries both entries; the index has the worker under past; the screening list keeps them with the end date.
    const res = await page.request.get("/registers/audit-pack.zip");
    expect(res.status()).toBe(200);
    const files = unzipSync(new Uint8Array(await res.body()));
    const names = Object.keys(files);
    expect(names).toContain("workers/W-003.csv");
    const file = Buffer.from(files["workers/W-003.csv"]).toString("utf8");
    expect(file).toContain("supervision,supervision,");
    expect(file).toContain("supervision,probation-review,");
    expect(file).toContain("KP-1");
    expect(file).not.toMatch(/full_name|date_of_birth|address/);
    const header = file.split("\r\n")[0].replace(/^﻿/, "");
    const index = Buffer.from(files["workers/index.csv"]).toString("utf8");
    expect(index).toContain("past,W-003");
    const listName = names.find((n) => /^screening-list-/.test(n))!;
    const list = Buffer.from(files[listName]).toString("utf8");
    expect(list).toContain(`W-003`);
    expect(list).toContain(todaySydney());

    // The auditor link's pack: the same file, the same columns, no fill column (D-2407).
    await page.goto("/account");
    await page.getByTestId("auditor-link-create").click();
    const url = await page.getByTestId("auditor-link-url").inputValue();
    const auditor = await browser.newContext();
    const viaLink = await auditor.request.get(`${url}/audit-pack.zip`);
    expect(viaLink.status()).toBe(200);
    const linked = unzipSync(new Uint8Array(await viaLink.body()));
    const linkedFile = Buffer.from(linked["workers/W-003.csv"]).toString(
      "utf8",
    );
    expect(linkedFile.split("\r\n")[0].replace(/^﻿/, "")).toBe(header);
    expect(linkedFile).toContain("supervision,probation-review,");
    expect(linkedFile).not.toMatch(/full_name|date_of_birth|address/);
    await auditor.close();

    // A custom period to three days ago: the review (two days ago) is out, the session (ten days ago) in, and the list speaks as at the period's end (D-2832).
    const to = daysAgo(3);
    const filtered = await page.request.get(
      `/registers/audit-pack.zip?period=custom&from=${daysAgo(30)}&to=${to}`,
    );
    expect(filtered.status()).toBe(200);
    const f2 = unzipSync(new Uint8Array(await filtered.body()));
    const file2 = Buffer.from(f2["workers/W-003.csv"]).toString("utf8");
    expect(file2).toContain("supervision,supervision,");
    expect(file2).not.toContain("supervision,probation-review,");
    const list2Name = Object.keys(f2).find((n) => /^screening-list-/.test(n))!;
    expect(Buffer.from(f2[list2Name]).toString("utf8")).toContain(
      `as at ${to}`,
    );
  });
});
