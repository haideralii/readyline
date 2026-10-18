import { test, expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { mkdirSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { addMonths } from "@/lib/registers/status";
import {
  generateAuditorToken,
  hashAuditorToken,
} from "@/lib/registers/auditor-link";
import { hasSupabaseForE2e } from "../helpers/env";
import { addDays, todaySydney } from "../helpers/dates";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { checkWidths } from "../helpers/width";

/**
 * REQ-023 Session B on the three projects (D-2207 lifted for WebKit, PO 18 Oct 2026 12:20): the period filter on a
 * register, its export and the audit pack (AC-3), "what changed since the
 * last audit" on the screen and in the pack's sheet (AC-4), the proxy's 400
 * for a malformed period on a page and on the auditor link (AC-9), the
 * auditor link filtered by the period with the audit line carrying it
 * (SR-3), and a worker sent to their own home from the new screen (AC-8).
 * Dates follow the runner's Sydney day (D-2242). Needs a Supabase stack.
 */
const EVIDENCE_DIR = "product/evidence/req-023";
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;
const today = todaySydney();
const sydney = (days: number) => addDays(today, days);

// Seven months in, three years long (AC-1's shape); the last audit sixty days ago.
const starts = sydney(-213);
const ends = addMonths(starts, 36);
const lastAudit = sydney(-60);

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

/** The words of a pdf-lib document: its content streams inflated, the Tj and TJ operators decoded. */
function pdfText(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const raw = buf.toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const start = (m.index ?? 0) + m[0].indexOf(m[1]);
    const body = buf.subarray(start, start + m[1].length);
    try {
      parts.push(inflateSync(body).toString("latin1"));
    } catch {
      parts.push(m[1]);
    }
  }
  const text = parts.join("\n");
  const out: string[] = [];
  for (const m of text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g))
    out.push(Buffer.from(m[1], "hex").toString("latin1"));
  for (const m of text.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) out.push(m[1]);
  return out.join(" ");
}

function csvRows(bytes: Uint8Array): Record<string, string>[] {
  const lines = Buffer.from(bytes)
    .toString("utf8")
    .replace(/^﻿/, "")
    .trim()
    .split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

test.describe("the period filter and what changed (REQ-023 Session B)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let tenant: TestTenant;
  let sheet: Record<string, string>[] = [];

  test.beforeAll(async ({}, testInfo) => {
    // #99 run 1 (PO 01:10): the audit-day page sends an account with no
    // questionnaire result to the questionnaire, so the tenant carries answers.
    tenant = await createTenant({
      label: `req-023-b-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
    const admin = tenant.admin;
    const accountId = tenant.accountId;
    const ent = await admin
      .from("entitlements")
      .insert({ account_id: accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    const period = await admin.from("registration_periods").insert({
      account_id: accountId,
      period_starts_on: starts,
      period_ends_on: ends,
      audit_type: "certification",
      midterm_applies: true,
      last_audit_on: lastAudit,
    });
    if (period.error) throw period.error;
    // One incident on each side of the last-audit date (AC-3, AC-4), both inside the period.
    for (const [ref, on] of [
      ["P-001", sydney(-90)],
      ["P-002", sydney(-10)],
    ] as const) {
      const r = await admin.from("incidents").insert({
        account_id: accountId,
        occurred_on: on,
        reported_on: on,
        category: "near-miss",
        severity: "low",
        participant_ref: ref,
        summary: "Near miss in the kitchen; no harm.",
      });
      if (r.error) throw r.error;
    }
    // One worker check added in the period (AC-4).
    const check = await admin.from("worker_clearances").insert({
      account_id: accountId,
      worker_ref: "W-1",
      role_label: "support worker",
      clearance_kind: "ndis-worker-screening",
      issued_on: sydney(-20),
      expires_on: addMonths(sydney(-20), 60),
    });
    if (check.error) throw check.error;
    // Three documents reviewed in the period, one of them due before the
    // period ends (a 12-month cycle), and one not adopted at all (AC-4).
    const reviews = await admin.from("policy_reviews").insert([
      {
        account_id: accountId,
        document_type_id: "other",
        title: "Fire plan",
        adopted_on: sydney(-300),
        last_reviewed_on: sydney(-30),
        review_cycle_months: 12,
      },
      {
        account_id: accountId,
        document_type_id: "other",
        title: "Visitor policy",
        adopted_on: sydney(-300),
        last_reviewed_on: sydney(-20),
        review_cycle_months: 36,
      },
      {
        account_id: accountId,
        document_type_id: "other",
        title: "Vehicle policy",
        adopted_on: sydney(-300),
        last_reviewed_on: sydney(-5),
        review_cycle_months: 36,
      },
      {
        account_id: accountId,
        document_type_id: "other",
        title: "Pet policy",
        review_cycle_months: 12,
      },
    ]);
    if (reviews.error) throw reviews.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the register, its export and the pack filter by the period (AC-3)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("period-selector-line")).toContainText(
      "All entries",
    );
    await expect(page.getByTestId("incidents-list")).toContainText("P-001");
    await expect(page.getByTestId("incidents-list")).toContainText("P-002");

    await page.getByTestId("period-choice-since-last-audit").click();
    await expect(page).toHaveURL(/\?period=since-last-audit$/);
    await expect(page.getByTestId("period-selector-line")).toContainText(
      "Since the last audit",
    );
    await expect(page.getByTestId("incidents-list")).toContainText("P-002");
    await expect(page.getByTestId("incidents-list")).not.toContainText("P-001");
    await expect(page.getByTestId("register-export")).toHaveAttribute(
      "href",
      "/registers/incidents/export.zip?period=since-last-audit",
    );
    await checkWidths(page, "incidents with the period");
    await shot(page, "period-incidents", project);

    // The export: the file name carries the period and the rows are the later one.
    const zip = await page.request.get(
      "/registers/incidents/export.zip?period=since-last-audit",
    );
    expect(zip.status()).toBe(200);
    expect(zip.headers()["content-disposition"]).toMatch(
      new RegExp(
        `readyline-incidents-\\d{4}-\\d{2}-\\d{2}-since-audit-${lastAudit}\\.zip`,
      ),
    );
    const exported = unzipSync(new Uint8Array(await zip.body()));
    const exportedCsv = Buffer.from(
      exported[Object.keys(exported).find((n) => /^incidents-\d/.test(n))!],
    ).toString("utf8");
    expect(exportedCsv).toContain("P-002");
    expect(exportedCsv).not.toContain("P-001");

    // The pack with the period: the zip's name, the cover sheet and the register file.
    const pack = await page.request.get(
      "/registers/audit-pack.zip?period=since-last-audit",
    );
    expect(pack.status()).toBe(200);
    expect(pack.headers()["content-disposition"]).toMatch(
      new RegExp(
        `audit-pack-sunrise-supports-\\d{4}-\\d{2}-\\d{2}-since-audit-${lastAudit}\\.zip`,
      ),
    );
    const files = unzipSync(new Uint8Array(await pack.body()));
    const names = Object.keys(files);
    const packCsv = Buffer.from(
      files[names.find((n) => /^incidents-\d/.test(n))!],
    ).toString("utf8");
    expect(packCsv).toContain("P-002");
    expect(packCsv).not.toContain("P-001");
    const cover = pdfText(files["cover-sheet.pdf"]);
    expect(cover).toContain("Period shown: Since the last audit");
    expect(cover).toContain("each record's state is the whole register's");
    // FR-6: the sheet is in the pack; kept for the next test's comparison with the screen.
    expect(names).toContain("since-last-audit.csv");
    sheet = csvRows(files["since-last-audit.csv"]);

    // The pack with no selection shows the whole registration period (D-2305).
    const whole = await page.request.get("/registers/audit-pack.zip");
    expect(whole.status()).toBe(200);
    expect(whole.headers()["content-disposition"]).toContain(
      `-this-period-from-${starts}.zip`,
    );
    const wholeFiles = unzipSync(new Uint8Array(await whole.body()));
    const wholeCsv = Buffer.from(
      wholeFiles[Object.keys(wholeFiles).find((n) => /^incidents-\d/.test(n))!],
    ).toString("utf8");
    expect(wholeCsv).toContain("P-001");
    expect(wholeCsv).toContain("P-002");
    expect(pdfText(wholeFiles["cover-sheet.pdf"])).toContain(
      "Period shown: This registration period",
    );
  });

  test("what changed since the last audit, on the screen and in the sheet (AC-4)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-period-line")).toContainText(
      "This registration period",
    );
    await page.getByTestId("audit-day-what-changed").click();
    await expect(page).toHaveURL(/\/path\/audit-day\/what-changed$/);
    await expect(page.getByTestId("what-changed-title")).toHaveText(
      "What changed since the last audit",
    );
    await expect(
      page.getByTestId("what-changed-register-incidents"),
    ).toHaveAttribute("data-entries", "1");
    const documents = page.getByTestId("what-changed-document");
    await expect(documents).toHaveCount(3);
    await expect(documents.nth(0)).toContainText("Fire plan");
    await expect(documents.nth(1)).toContainText("Visitor policy");
    await expect(documents.nth(2)).toContainText("Vehicle policy");
    await expect(page.getByTestId("what-changed-documents")).not.toContainText(
      "Pet policy",
    );
    const due = page.getByTestId("what-changed-due-document");
    await expect(due).toHaveCount(1);
    await expect(due).toContainText("Fire plan");
    await expect(page.getByTestId("what-changed-worker-line")).toHaveText(
      "Checks 1 added (W-1).",
    );
    await expect(
      page.getByTestId("what-changed-register-incidents").getByRole("link"),
    ).toHaveAttribute("href", "/registers/incidents?period=since-last-audit");
    await checkWidths(page, "what changed");
    await shot(page, "what-changed", project);

    // The pack's sheet matches the screen.
    expect(sheet.length).toBeGreaterThan(0);
    expect(
      sheet.filter((r) => r.section === "documents").map((r) => r.item),
    ).toEqual(["Fire plan", "Visitor policy", "Vehicle policy"]);
    expect(
      sheet.filter((r) => r.section === "documents-due").map((r) => r.item),
    ).toEqual(["Fire plan"]);
    expect(
      sheet.find(
        (r) => r.section === "registers" && r.item === "Incident register",
      )?.detail,
    ).toBe("entries 1; open 1; overdue 0; notified 0");
    expect(
      sheet
        .filter((r) => r.section === "workers")
        .map((r) => [r.item, r.detail]),
    ).toEqual([["W-1", "ndis-worker-screening added"]]);
  });

  test("a malformed period answers 400 on a page, a route and the auditor link; the link filters and logs the period (AC-9, SR-3)", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    for (const query of [
      "period=custom&from=2020-01-01&to=2031-01-01",
      "period=custom&from=2027-06-30&to=2027-01-01",
      "period=custom&from=soon&to=2027-01-01",
      "period=bogus",
    ]) {
      const pageResponse = await page.request.get(
        `/registers/incidents?${query}`,
      );
      expect(pageResponse.status(), query).toBe(400);
      expect(await pageResponse.text(), query).toBe("Bad request");
      const routeResponse = await page.request.get(
        `/registers/incidents/export.zip?${query}`,
      );
      expect(routeResponse.status(), query).toBe(400);
      expect(await routeResponse.text(), query).toBe("Bad request");
    }

    // An auditor link, made directly (the account page's flow is REQ-020's spec).
    const token = generateAuditorToken();
    const link = await tenant.admin.from("auditor_links").insert({
      account_id: tenant.accountId,
      token_hash: hashAuditorToken(token),
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    if (link.error) throw link.error;
    const auditor = await browser.newContext();
    const view = await auditor.newPage();
    expect((await view.goto(`/auditor/${token}?period=bogus`))?.status()).toBe(
      400,
    );
    expect((await view.goto(`/auditor/${token}`))?.status()).toBe(200);
    await expect(view.getByTestId("auditor-period-line")).toContainText(
      "This registration period",
    );
    expect(
      (await view.goto(`/auditor/${token}?period=since-last-audit`))?.status(),
    ).toBe(200);
    await expect(view.getByTestId("auditor-period-line")).toContainText(
      "Since the last audit",
    );
    await expect(view.getByTestId("auditor-register-incidents")).toContainText(
      "P-002",
    );
    await expect(
      view.getByTestId("auditor-register-incidents"),
    ).not.toContainText("P-001");
    await expect(view.getByTestId("auditor-pack-link")).toHaveAttribute(
      "href",
      `/auditor/${token}/audit-pack.zip?period=since-last-audit`,
    );
    await auditor.close();
    const opened = await tenant.admin
      .from("audit_log")
      .select("target")
      .eq("account_id", tenant.accountId)
      .eq("action", "auditor_link.opened")
      .like("target", `% from:${lastAudit} to:-`);
    expect(opened.data?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  test("a worker opening the new screen lands on their own home (AC-8)", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const worker = await createTenant({
      label: `req-023-b-worker-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers: {},
      withAccount: false,
    });
    try {
      const membership = await tenant.admin.from("memberships").insert({
        user_id: worker.userId,
        account_id: tenant.accountId,
        role: "worker",
        worker_ref: "W-9",
      });
      if (membership.error) throw membership.error;
      const ctx = await browser.newContext();
      await signInContext(ctx, worker, baseURL!);
      const w = await ctx.newPage();
      await w.goto("/path/audit-day/what-changed");
      await expect(w).toHaveURL(/\/worker$/);
      await ctx.close();
    } finally {
      await deleteTenant(worker);
    }
  });
});
