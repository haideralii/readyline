import { test, expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { CSV_COLUMNS } from "@/lib/registers/csv";
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
    // Retro review of REQ-020, finding 30: an unconfirmed report (a draft)
    // and a rejected one are not in the register, so neither reaches the
    // auditor's view or the pack.
    for (const [status, ref] of [
      ["draft", "P-098"],
      ["rejected", "P-099"],
    ] as const) {
      const r = await tenant.admin.from("incidents").insert({
        account_id: tenant.accountId,
        occurred_on: "2026-10-10",
        reported_on: "2026-10-10",
        category: "near-miss",
        severity: "low",
        participant_ref: ref,
        summary: `A ${status} report; not in the register.`,
        status,
        reported_via: "link",
        logged_by_ref: "support worker",
      });
      if (r.error) throw r.error;
    }
    // Retro finding 62 (D-2244): a rejected report in a reportable category
    // is an alleged reportable incident; the auditor sees it as received,
    // not recorded, with its status read so.
    const alleged = await tenant.admin.from("incidents").insert({
      account_id: tenant.accountId,
      occurred_on: "2026-10-10",
      reported_on: "2026-10-10",
      category: "abuse-or-neglect",
      severity: "medium",
      participant_ref: "P-097",
      summary: "An alleged report the owner rejected; still reportable.",
      status: "rejected",
      reportable: true,
      rejected_reason: "Not one of our participants.",
      reported_via: "link",
      logged_by_ref: "support worker",
    });
    if (alleged.error) throw alleged.error;
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
    // Finding 30: the draft and the rejected report are not in the register.
    const html = await view.content();
    expect(html.includes("P-098")).toBe(false);
    expect(html.includes("P-099")).toBe(false);
    // Finding 62: the rejected report that is still reportable is, as received, not recorded.
    await expect(view.getByTestId("auditor-register-incidents")).toContainText(
      "P-097",
    );
    await expect(view.getByTestId("auditor-register-incidents")).toContainText(
      "received, not recorded",
    );
    expect(html.includes(tenant.email)).toBe(false);
    expect(html.includes(tenant.userId)).toBe(false);
    expect(html.includes(tenant.accountId)).toBe(false);
    expect(
      await view.locator('meta[name="robots"]').getAttribute("content"),
    ).toMatch(/noindex/);
    await shot(view, "auditor-view", project);

    const packViaLink = await auditor.request.get(`${url}/audit-pack.zip`);
    expect(packViaLink.status()).toBe(200);
    const unzipped = unzipSync(new Uint8Array(await packViaLink.body()));
    const names = Object.keys(unzipped);
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
        // Finding 25: the audit-day registers' shared event trail is a file too.
        expect.stringMatching(/^register-events-\d{4}-\d{2}-\d{2}\.csv$/),
      ]),
    );
    // REQ-024 A3 (FR-6, FR-6a, AC-5; D-2407 as amended): the workers folder
    // and the two Rules lists are in the link's pack as in the owner's, with
    // codes and numbers and no column that is a name, a date of birth or an
    // address, and no column outside csv.ts's lists (finding 114).
    expect(names).toContain("workers/index.csv");
    const listNames = names.filter((n) =>
      /^(screening-list|risk-assessed-roles)-\d{4}-\d{2}-\d{2}\.csv$/.test(n),
    );
    expect(listNames).toHaveLength(2);
    const allowed = new Set(Object.values(CSV_COLUMNS).flat() as string[]);
    for (const n of ["workers/index.csv", ...listNames]) {
      const lines = Buffer.from(unzipped[n])
        .toString("utf8")
        .replace(/^\uFEFF/, "")
        .split("\r\n");
      const header = (n === "workers/index.csv" ? lines[0] : lines[1]).split(
        ",",
      );
      for (const h of header) {
        expect(allowed, `${n}: ${h}`).toContain(h);
        expect(h, n).not.toMatch(/name|birth|address/);
      }
      if (n !== "workers/index.csv")
        expect(lines[0]).toContain("This is a draft of the information");
    }
    // Finding 30 again, on the file: the register's CSV holds the confirmed row only.
    const incidentsCsv = Buffer.from(
      unzipped[names.find((n) => /^incidents-\d/.test(n))!],
    ).toString("utf8");
    expect(incidentsCsv).toContain("P-014");
    expect(incidentsCsv).not.toContain("P-098");
    expect(incidentsCsv).not.toContain("P-099");
    expect(incidentsCsv).toContain("P-097");
    expect(incidentsCsv).toContain("received, not recorded");
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

  // Retro review of REQ-020, finding 21: every open of the signed-out page
  // writes a row, so one viewer address gets sixty opens of a link an hour.
  // The first open happens for real; the next fifty-nine are counted through
  // the limiter's own statement under the key the server builds (the link id
  // and the address hash the audit line carries), so the test does not spend
  // a minute rendering the page sixty times. The sixty-first open is refused
  // in plain words and writes nothing; the pack route answers 429.
  test("the sixty-first open of a link from one address in an hour is refused", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/account");
    await page.getByTestId("auditor-link-create").click();
    const url = await page.getByTestId("auditor-link-url").inputValue();
    expect(url).toMatch(/\/auditor\/[A-Za-z0-9_-]{43}$/);

    const auditor = await browser.newContext();
    const view = await auditor.newPage();
    expect((await view.goto(url))?.status()).toBe(200);
    await expect(view.getByTestId("auditor-records")).toBeVisible();

    const live = await tenant.admin
      .from("auditor_links")
      .select("id")
      .eq("account_id", tenant.accountId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (live.error) throw live.error;
    const opened = await tenant.admin
      .from("audit_log")
      .select("target")
      .eq("account_id", tenant.accountId)
      .eq("action", "auditor_link.opened")
      .like("target", `${live.data.id} viewer:%`)
      .order("at", { ascending: false })
      .limit(1)
      .single();
    if (opened.error) throw opened.error;
    // REQ-023 SR-3: the line ends with the period shown (` from:- to:-` here), so no end anchor.
    const viewer = /viewer:([0-9a-f]{16}|unknown)\b/.exec(
      opened.data.target as string,
    )?.[1];
    expect(viewer).toBeTruthy();
    const key = `auditor-open:${live.data.id}:${viewer}`;
    for (let i = 0; i < 59; i += 1) {
      const hit = await tenant.admin.rpc("auth_rate_limit_hit", {
        p_key: key,
        p_limit: 60,
        p_window_seconds: 3600,
      });
      if (hit.error) throw hit.error;
    }
    const before = await tenant.admin
      .from("auditor_links")
      .select("opened_count")
      .eq("id", live.data.id)
      .single();

    const refused = await view.goto(url);
    expect(refused?.status()).toBe(200);
    await expect(view.getByTestId("auditor-limited")).toContainText(
      "opened many times from your connection",
    );
    await expect(view.getByTestId("auditor-records")).toHaveCount(0);
    const pack = await auditor.request.get(`${url}/audit-pack.zip`);
    expect(pack.status()).toBe(429);
    expect(await pack.text()).toContain("opened many times");
    await auditor.close();

    // Nothing was written by the refused open.
    const after = await tenant.admin
      .from("auditor_links")
      .select("opened_count")
      .eq("id", live.data.id)
      .single();
    expect(after.data?.opened_count).toBe(before.data?.opened_count);

    await page.goto("/account");
    await page.getByTestId("auditor-link-revoke").click();
    await expect(page.getByTestId("auditor-link-state")).toHaveCount(0);
  });
});
