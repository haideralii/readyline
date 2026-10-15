import { test, expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { mkdirSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-020 Session A, AC-1 and AC-2 on the three projects: the owner's audit
 * pack (every register as CSV, the document control register, the cover
 * sheet; the summary and the documents when a set exists), the export limit
 * on the sixth download, the auditor link created on the account page and
 * opened in a fresh signed-out context (banner, records table, codes only,
 * no email in the HTML, the pack), 404 after revocation, and the audit-log
 * lines for each step. Needs a Supabase stack; skips without one.
 */
const EVIDENCE_DIR = "product/evidence/req-020";
const enabled = hasSupabaseForE2e();

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

test.describe("the audit pack and the auditor link (REQ-020 Session A)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `audit-pack-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers: {},
    });
    // One incident with a participant code, through the service key (RLS asks for a subscription).
    const ins = await tenant.admin.from("incidents").insert({
      account_id: tenant.accountId,
      occurred_on: "2026-10-09",
      reported_on: "2026-10-09",
      category: "near-miss",
      severity: "low",
      participant_ref: "P-014",
      summary: "Near miss in the kitchen; no harm.",
    });
    if (ins.error) throw ins.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the owner shares a link, the auditor reads codes only and downloads the pack, the owner revokes it", async ({
    page,
    context,
    browser,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/account");
    await expect(page.getByTestId("account-auditor-link")).toBeVisible();
    await page.getByLabel("How long the link should work").selectOption("48");
    await page.getByTestId("auditor-link-create").click();
    const urlField = page.getByTestId("auditor-link-url");
    await expect(urlField).toBeVisible();
    const url = await urlField.inputValue();
    expect(url).toMatch(/\/auditor\/[A-Za-z0-9_-]{43}$/);
    await expect(page.getByTestId("auditor-link-state")).toContainText(
      "A link is live until",
    );
    await shot(page, "auditor-link-created", project);

    // A fresh, signed-out context: the auditor.
    const auditor = await browser.newContext();
    const view = await auditor.newPage();
    const open = await view.goto(url);
    expect(open?.status()).toBe(200);
    await expect(view.getByTestId("auditor-banner")).toContainText(
      /Read-only view shared by Sunrise Supports for its audit; it expires on/,
    );
    await expect(view.getByTestId("auditor-records")).toContainText(
      "Incident register",
    );
    await expect(view.getByTestId("auditor-register-incidents")).toContainText(
      "P-014",
    );
    const html = await view.content();
    expect(html.includes(tenant.email)).toBe(false);
    expect(html.includes(tenant.userId)).toBe(false);
    expect(html.includes(tenant.accountId)).toBe(false);
    expect(
      await view.locator('meta[name="robots"]').getAttribute("content"),
    ).toMatch(/noindex/);
    await shot(view, "auditor-view", project);

    const packViaLink = await auditor.request.get(`${url}/audit-pack.zip`);
    expect(packViaLink.status()).toBe(200);
    const names = Object.keys(
      unzipSync(new Uint8Array(await packViaLink.body())),
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "cover-sheet.pdf",
        expect.stringMatching(/^incidents-\d{4}-\d{2}-\d{2}\.csv$/),
        expect.stringMatching(/^incidents-events-\d{4}-\d{2}-\d{2}\.csv$/),
        expect.stringMatching(/^complaints-\d{4}-\d{2}-\d{2}\.csv$/),
        expect.stringMatching(/^worker-checks-\d{4}-\d{2}-\d{2}\.csv$/),
        expect.stringMatching(/^policy-reviews-\d{4}-\d{2}-\d{2}\.csv$/),
        expect.stringMatching(/^document-control-\d{4}-\d{2}-\d{2}\.csv$/),
        expect.stringMatching(/^corporate-risks-\d{4}-\d{2}-\d{2}\.csv$/),
      ]),
    );
    await auditor.close();

    // The owner revokes; the link is a plain 404 after that.
    await page.goto("/account");
    await page.getByTestId("auditor-link-revoke").click();
    await expect(page.getByTestId("auditor-link-state")).toHaveCount(0);
    const dead = await browser.newContext();
    const deadPage = await dead.newPage();
    expect((await deadPage.goto(url))?.status()).toBe(404);
    expect((await dead.request.get(`${url}/audit-pack.zip`)).status()).toBe(
      404,
    );
    await dead.close();

    const audit = await tenant.admin
      .from("audit_log")
      .select("action")
      .eq("account_id", tenant.accountId);
    const actions = (audit.data ?? []).map((r) => r.action as string);
    for (const a of [
      "auditor_link.created",
      "auditor_link.opened",
      "auditor_link.pack-downloaded",
      "auditor_link.revoked",
    ])
      expect(actions, a).toContain(a);
  });

  test("the owner downloads the pack from the audit-day page, and the sixth download in an hour is refused", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    const first = await page.request.get("/registers/audit-pack.zip");
    expect(first.status()).toBe(200);
    expect(first.headers()["content-disposition"]).toMatch(
      /audit-pack-sunrise-supports-\d{4}-\d{2}-\d{2}\.zip/,
    );
    const names = Object.keys(unzipSync(new Uint8Array(await first.body())));
    expect(names).toContain("cover-sheet.pdf");
    expect(names.some((n) => /^incidents-/.test(n))).toBe(true);
    // The link's one download plus this one make two; three more reach the limit of five.
    for (let i = 0; i < 3; i += 1)
      expect(
        (await page.request.get("/registers/audit-pack.zip")).status(),
      ).toBe(200);
    const sixth = await page.request.get("/registers/audit-pack.zip");
    expect(sixth.status()).toBe(429);
    const audit = await tenant.admin
      .from("audit_log")
      .select("action")
      .eq("account_id", tenant.accountId)
      .eq("action", "audit_pack.downloaded");
    expect(audit.data?.length).toBeGreaterThanOrEqual(4);
  });
});
