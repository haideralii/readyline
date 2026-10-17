import { test, expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { mkdirSync, readFileSync } from "node:fs";
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
 * REQ-023 Session D on desktop and Android (D-2207), AC-6: the result page's
 * two prompts (the groups changed, a state added) for an owner with a ready
 * set, with no row written; the changes register's states as the view
 * computes them (overdue, to notify, notified, told, form not confirmed) through
 * the form and the row page; the kind chips; the change-of-ownership row on
 * the timeline and the dated checklist item; the register in the pack and on
 * the auditor link. Dates follow the runner's Sydney day (D-2242). Needs a
 * Supabase stack.
 */
const EVIDENCE_DIR = "product/evidence/req-023";
const enabled = hasSupabaseForE2e();
const today = todaySydney();
const sydney = (days: number) => addDays(today, days);
const fixture = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown> & {
  business: Record<string, unknown>;
  supports: Record<string, unknown>;
};
// AC-6: the groups gain one and the states gain Queensland, against a set with the fixture's one group and an account in NSW.
const answers = {
  ...fixture,
  business: { ...fixture.business, states: ["NSW", "QLD"] },
  supports: { ...fixture.supports, groups: ["0120", "0115"] },
};

const starts = sydney(-213);
const ends = addMonths(starts, 36);
const ownershipOn = sydney(-10);

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

test.describe("the changes register and the result's prompts (REQ-023 Session D)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `req-023-d-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
    const admin = tenant.admin;
    const accountId = tenant.accountId;
    const ent = await admin
      .from("entitlements")
      .insert({ account_id: accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    // The latest completed assessment: a ready set whose result held the fixture's one group.
    const set = await admin.from("version_sets").insert({
      account_id: accountId,
      created_by: tenant.userId,
      answers_snapshot_hash: "req-023-d",
      derived_result: {
        groups: [
          { code: "0120", name: "Household tasks", auditType: "verification" },
        ],
        documents: [],
        registers: [],
        modules: [],
      },
      status: "ready",
      document_count: 0,
      fallback_section_count: 0,
      generated_count: 0,
      storage_prefix: "",
    });
    if (set.error) throw set.error;
    // A certification period (AC-1's shape) for the change-of-ownership row.
    const period = await admin.from("registration_periods").insert({
      account_id: accountId,
      period_starts_on: starts,
      period_ends_on: ends,
      audit_type: "certification",
      midterm_applies: true,
    });
    if (period.error) throw period.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the result page prompts on the groups and the added state, and writes no row (AC-6, FR-11)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/start/result");
    const changes = page.getByTestId("result-changes");
    await expect(changes).toBeVisible();
    await expect(page.getByTestId("result-changes-groups")).toContainText(
      "you apply to vary it (NDIS Act s 73M)",
    );
    await expect(
      page.getByTestId("result-changes-variation-link"),
    ).toHaveAttribute(
      "href",
      "/registers/commission-changes/new?kind=variation&change_type=supports-registered",
    );
    const qld = page.getByTestId("result-changes-state-QLD");
    await expect(qld).toContainText(
      "If you now deliver supports in Queensland, tell the Commission (Rules s 13)",
    );
    await expect(qld).toContainText("Blue Card");
    await expect(qld).toContainText("Restrictive practices");
    await expect(changes).not.toContainText(/you must/i);
    await shot(page, "result-changes", testInfo.project.name);
    const rows = await tenant.admin
      .from("commission_changes")
      .select("id", { count: "exact", head: true })
      .eq("account_id", tenant.accountId);
    expect(rows.count ?? 0).toBe(0);
  });

  test("the register's states: overdue for a s 13A event, to notify for a s 13 change, notified in the approved form, told but not confirmed (AC-6, FR-10)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers/commission-changes");
    await expect(
      page.getByTestId("commission-changes-list-empty"),
    ).toBeVisible();
    await page.getByTestId("register-add").click();
    await expect(page).toHaveURL(/\/registers\/commission-changes\/new/);
    // A key-personnel change known ten days ago that happened yesterday: notify-by ten days ago, overdue.
    await page.locator("#kind").selectOption("notification");
    await page.locator("#change_type").selectOption("key-personnel-change");
    await page.locator("#happened_on").fill(sydney(-1));
    await page.locator("#aware_on").fill(sydney(-10));
    await checkWidths(page, "changes form");
    await shot(page, "changes-form", project);
    await page.getByRole("button", { name: "Record a change" }).click();
    await expect(page).toHaveURL(/\/registers\/commission-changes\?saved=/);
    await expect(page.getByTestId("register-saved")).toBeVisible();
    const list = page.getByTestId("commission-changes-list");
    await expect(list).toContainText("CHG-0001");
    await expect(list).toContainText("Overdue to notify");

    // A contact-details change ten days ago: no notify-by, to notify, never overdue.
    await page.goto(
      "/registers/commission-changes/new?kind=notification&change_type=contact-details",
    );
    await page.locator("#happened_on").fill(sydney(-10));
    await page.getByRole("button", { name: "Record a change" }).click();
    await expect(page).toHaveURL(/\/registers\/commission-changes\?saved=/);
    await expect(list).toContainText("CHG-0002");
    await expect(list).toContainText("To notify, as soon as practicable");
    await checkWidths(page, "changes list");
    await shot(page, "changes-list", project);

    // The row page: the Rule's words, then the notice recorded in the approved form.
    await page
      .getByRole("link", { name: /CHG-0002/ })
      .first()
      .click();
    await expect(page).toHaveURL(
      /\/registers\/commission-changes\/[0-9a-f-]{36}/,
    );
    await expect(page.getByTestId("row-note")).toContainText(
      "Rules s 13(2)(b)",
    );
    await page.getByTestId("row-edit").locator("summary").click();
    await page.locator("#notified_on").fill(today);
    await page.locator("#channel").selectOption("portal");
    await page.locator("#approved_form").selectOption("yes");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/registers\/commission-changes\?saved=/);
    await expect(list).toContainText("Notified");

    // Told, form not confirmed: the same row with "not sure", through the service key for speed.
    const row = await tenant.admin
      .from("commission_changes")
      .update({ approved_form: "unsure" })
      .eq("account_id", tenant.accountId)
      .eq("reference", "CHG-0002")
      .select("id");
    expect(row.error).toBeNull();
    await page.reload();
    await expect(list).toContainText("told, form not confirmed");

    // The kind chip: a variation added directly, then the two chips filter the list.
    const variation = await tenant.admin.from("commission_changes").insert({
      account_id: tenant.accountId,
      kind: "variation",
      change_type: "supports-registered",
      happened_on: sydney(30),
    });
    expect(variation.error).toBeNull();
    await page.goto("/registers/commission-changes?kind=variation");
    await expect(list).toContainText("CHG-0003");
    await expect(list).not.toContainText("CHG-0001");
    await expect(list).toContainText("To apply");
    await page.getByTestId("kind-chip-notification").click();
    await expect(list).toContainText("CHG-0001");
    await expect(list).not.toContainText("CHG-0003");
  });

  test("a change of ownership adds the timeline row and the dated checklist item (AC-6, FR-2, FR-4)", async ({
    page,
    context,
    baseURL,
  }) => {
    const ins = await tenant.admin.from("commission_changes").insert({
      account_id: tenant.accountId,
      kind: "notification",
      change_type: "change-of-ownership",
      happened_on: ownershipOn,
      aware_on: sydney(-20),
    });
    expect(ins.error).toBeNull();
    await signInContext(context, tenant, baseURL!);
    await page.goto("/account");
    const row = page.getByTestId("timeline-row-ownership-audit-start-by");
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("data-date", addMonths(ownershipOn, 3));
    await expect(row).toHaveAttribute("data-source", "Rules s 13BA");
    await expect(row).toContainText("Change-of-ownership audit must start by");
    // The audit-day page shows the legal rows; this is one.
    await page.goto("/path/audit-day");
    await expect(
      page
        .getByTestId("audit-day-timeline")
        .getByTestId("timeline-row-ownership-audit-start-by"),
    ).toBeVisible();
    await page.goto("/checklist");
    await page.getByTestId("checklist-group-audit").locator("summary").click();
    await expect(
      page.getByTestId(
        "checklist-item-audit-change-of-ownership-audit-started",
      ),
    ).toBeVisible();
  });

  test("the register is in the pack and on the auditor link (FR-10)", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    const pack = await page.request.get("/registers/audit-pack.zip");
    expect(pack.status()).toBe(200);
    const files = unzipSync(new Uint8Array(await pack.body()));
    const name = Object.keys(files).find((n) =>
      /^commission-changes-\d{4}-\d{2}-\d{2}\.csv$/.test(n),
    );
    expect(name).toBeDefined();
    const csv = Buffer.from(files[name!]).toString("utf8");
    expect(csv).toContain("CHG-0001");
    expect(csv).toContain("key-personnel-change");
    expect(csv).not.toMatch(/created_by/);

    const token = generateAuditorToken();
    const link = await tenant.admin.from("auditor_links").insert({
      account_id: tenant.accountId,
      token_hash: hashAuditorToken(token),
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    if (link.error) throw link.error;
    const auditor = await browser.newContext();
    const view = await auditor.newPage();
    expect((await view.goto(`/auditor/${token}`))?.status()).toBe(200);
    await expect(
      view.getByTestId("auditor-register-commission-changes"),
    ).toContainText("CHG-0001");
    await expect(view.getByTestId("auditor-records")).toContainText(
      "Changes we told the Commission",
    );
    await auditor.close();
  });
});
