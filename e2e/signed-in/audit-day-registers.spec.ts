import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { checkWidths, expectNoBrokenWords } from "../helpers/width";

/**
 * REQ-018 Session B on all three projects: a subscribed owner opens the
 * corporate risk register and finds the nine starter rows (FR-1, AC-1),
 * edits one, adds a participant risk, a delegation, an insurance item, a
 * decision and a staff-matrix row, starts a worker onboarding checklist
 * and ticks an item (FR-9), closes a reportable incident and takes the
 * one-tap improvement row (FR-6, AC-2), and sees every new register on the
 * index. Every page is checked for sideways scroll and axe serious issues
 * (AC-1). Screenshots under product/evidence/req-018/ with EVIDENCE=1.
 * Needs a Supabase stack with this branch's migrations (CI's Supabase job).
 */
const EVIDENCE_DIR = "product/evidence/req-018";
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
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

async function axeClean(page: Page, label: string) {
  await page.waitForFunction(() => document.title.length > 0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
    label,
  ).toEqual([]);
}

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * AC-1 "no letter-by-letter table wrapping" (retro review of REQ-018,
 * finding 1): at 360 px no word inside the register's list or a row's facts
 * is painted across two lines, and no table cell is squeezed under 48 px.
 * Every project sets the width, so the desktop run checks the phone layout too.
 */
async function noLetterWrap(page: Page, testId: string, label: string) {
  const original = page.viewportSize();
  await page.setViewportSize({ width: 360, height: original?.height ?? 740 });
  const root = `[data-testid="${testId}"]`;
  await expect(page.locator(root)).toBeVisible();
  await expectNoBrokenWords(page, `${label} @360`, root);
  const narrow = await page
    .locator(`${root} td`)
    .evaluateAll((cells) =>
      cells
        .map((c) => Math.round(c.getBoundingClientRect().width))
        .filter((w) => w > 0 && w < 48),
    );
  expect(narrow, `${label}: table cells narrower than 48 px`).toEqual([]);
  if (original) await page.setViewportSize(original);
}

const AUDIT_DAY_SLUGS = [
  "corporate-risks",
  "participant-risks",
  "conflicts-of-interest",
  "delegations",
  "insurances",
  "improvements",
  "decisions",
  "staff-matrix",
  "onboarding",
] as const;

test.describe("audit-day registers (REQ-018 Session B)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `audit-day-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
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

  test("the corporate risk register opens with nine starter rows and one can be changed", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers/corporate-risks");
    const list = page.getByTestId("corporate-risks-list");
    await expect(list.locator("li")).toHaveCount(9);
    await expect(list).toContainText("Starter row: check this and change it");
    await checkWidths(page, "corporate risks list");
    await noLetterWrap(page, "corporate-risks-list", "corporate risks list");
    await axeClean(page, "corporate risks list");
    await shot(page, "corporate-risks", project);

    await list.locator("li a").first().click();
    await expect(page.getByTestId("starter-note")).toBeVisible();
    // AC-1 on a row's facts too (the stacked definition list).
    await noLetterWrap(page, "row-facts", "corporate risk row");
    await page.getByTestId("row-edit").locator("summary").click();
    await page
      .locator("#controls")
      .fill("We keep a generator and a list of who to call.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/registers\/corporate-risks\?saved=/);
    await expect(page.getByTestId("register-saved")).toBeVisible();
    // The edited row is the provider's now (no starter mark on it).
    await expect(
      page.getByTestId("corporate-risks-list").locator("li", {
        hasText: "Starter row: check this and change it",
      }),
    ).toHaveCount(8);
  });

  test("participant risk, delegation, insurance, decision and staff matrix rows are added in plain forms", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);

    await page.goto("/registers/participant-risks/new");
    await checkWidths(page, "participant risk form");
    await axeClean(page, "participant risk form");
    await page.locator("#participant_ref").fill("p-14");
    await page.locator("#risk").fill("Tires in the afternoon and may fall.");
    await page.locator("#controls").fill("Shorter outings after two o'clock.");
    await page.locator("#review_on").fill(future(60));
    await page.locator("#support_plan_review_on").fill(future(120));
    await page.getByRole("button", { name: "Add a participant" }).click();
    await expect(page).toHaveURL(/\/registers\/participant-risks\?saved=/);
    await expect(page.getByTestId("participant-risks-list")).toContainText(
      "P-14",
    );
    await shot(page, "participant-risks", project);

    await page.goto("/registers/delegations/new");
    await page.locator("#role").selectOption("incident-reporter");
    await page.locator("#holder_ref").fill("kp-1");
    await page.locator("#backup_ref").fill("w-2");
    await page
      .locator("#backup_may")
      .fill("Report to the Commission when I am away.");
    await page.getByRole("button", { name: "Add a role" }).click();
    await expect(page.getByTestId("delegations-list")).toContainText(
      "Incident reporter",
    );

    await page.goto("/registers/insurances/new");
    await page.locator("#kind").selectOption("public-liability");
    await page.locator("#label").fill("Insurer A");
    await page.locator("#expires_on").fill(future(20));
    await page.getByRole("button", { name: "Add an item" }).click();
    await expect(page.getByTestId("insurances-list")).toContainText("Expires");

    await page.goto("/registers/decisions/new");
    await page.locator("#decided_on").fill(future(0));
    await page.locator("#decision").fill("Adopted the policy pack.");
    await page.locator("#decided_by").fill("KP-1");
    await page.getByRole("button", { name: "Add a decision" }).click();
    await expect(page.getByTestId("decisions-list")).toContainText(
      "Adopted the policy pack.",
    );
    await page.getByTestId("decisions-list").locator("li a").first().click();
    await expect(page.getByText("A decision is never edited.")).toBeVisible();

    await page.goto("/registers/staff-matrix/new");
    await page.locator("#worker_ref").fill("w-1");
    await page.locator("#role_label").fill("support worker");
    await page.locator("#risk_assessed").check();
    // REQ-024 A1 (FR-2a, finding 81): the states a worker works in come first.
    await page.locator("#states-NSW").check();
    await page.locator("#last_supervision_on").fill(future(-40));
    await page.getByRole("button", { name: "Add a worker" }).click();
    // REQ-024 A1 (FR-3, D-2411; #82 run 38924374914): the list shows the
    // derived state, not the supervision status. A new worker with no
    // clearance or induction recorded has before-first-shift items
    // outstanding, which outrank a supervision date on the row's tag, so the
    // tag reads "Items outstanding" and the next line is an item's ask, not
    // "type the states" now that NSW is given. The supervision date still
    // feeds W-8 on the worker's own page.
    const staffList = page.getByTestId("staff-matrix-list");
    await expect(staffList).toContainText("W-1: support worker");
    await expect(staffList).toContainText("Items outstanding");
    await expect(staffList).toContainText(/Next: Show me/);
    await expect(staffList).not.toContainText("type the states");
    await checkWidths(page, "staff matrix list");
    await shot(page, "staff-matrix", project);
  });

  test("a worker onboarding checklist is ticked item by item with the date and who ticked it", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    // REQ-024 A1 (FR-2): a worker's list is derived from the staff matrix row,
    // so the row comes first (the earlier test adds W-1 when it ran before this one).
    await page.goto("/registers/staff-matrix");
    if (
      !(await page.getByTestId("staff-matrix-list").textContent())?.includes(
        "W-1",
      )
    ) {
      await page.goto("/registers/staff-matrix/new");
      await page.locator("#worker_ref").fill("w-1");
      await page.locator("#role_label").fill("support worker");
      await page.locator("#risk_assessed").check();
      await page.getByRole("button", { name: "Add a worker" }).click();
      await expect(page).toHaveURL(/\/registers\/staff-matrix\?saved=/);
    }
    await page.goto("/registers/onboarding/new");
    await page.locator("#kind").selectOption("worker");
    await page.locator("#subject_ref").fill("w-1");
    await page.locator("#started_on").fill(future(0));
    await page.getByRole("button", { name: "Start a checklist" }).click();
    // The row's own page may have created the checklist already: either way the list shows one for W-1.
    await page.goto("/registers/onboarding");
    await page
      .getByTestId("onboarding-list")
      .getByRole("link", { name: /New worker W-1/ })
      .first()
      .click();
    await expect(page.getByTestId("worker-items")).toBeVisible();
    await expect(page.getByTestId("worker-state")).toHaveText(
      "Items outstanding",
    );
    await expect(page.getByTestId("from-the-dates-line")).toContainText(
      "From the dates you typed",
    );
    await checkWidths(page, "onboarding checklist");
    await axeClean(page, "onboarding checklist");
    await page.locator("#ticked-by").fill("kp-1");
    await page.getByTestId("record-identity-and-agreement").click();
    await expect(
      page.getByTestId("worker-item-identity-and-agreement"),
    ).toContainText("by KP-1");
    await expect(
      page.getByTestId("worker-item-identity-and-agreement"),
    ).toHaveAttribute("data-state", "recorded");
    await shot(page, "onboarding", project);
  });

  test("closing a reportable incident offers the one-tap improvement row, which lands in the register with its source", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    const ins = await tenant.admin
      .from("incidents")
      .insert({
        account_id: tenant.accountId,
        occurred_on: future(-3),
        reported_on: future(-3),
        category: "serious-injury",
        severity: "high",
        summary: "Fall in the kitchen.",
        reportable: true,
        reportable_notified_on: future(-2),
        status: "closed",
        closed_on: future(-1),
      })
      .select("id, reference")
      .single();
    if (ins.error) throw ins.error;
    await page.goto(`/registers/incidents/${ins.data.id}`);
    await expect(page.getByTestId("improvement-offer")).toBeVisible();
    await page.getByTestId("improvement-link").click();
    await expect(page).toHaveURL(/\/registers\/improvements\/new\?/);
    await expect(page.locator("#source_ref")).toHaveValue(ins.data.reference);
    await page.locator("#learned").fill("The floor was wet after mopping.");
    await page.locator("#changed").fill("Mop at the end of the visit.");
    await page.locator("#owner_role").fill("Owner");
    await page.locator("#due_on").fill(future(14));
    await page.getByRole("button", { name: "Add an improvement" }).click();
    await expect(page.getByTestId("improvements-list")).toContainText(
      `An incident ${ins.data.reference}`,
    );
    await shot(page, "improvements", project);

    await page.goto("/registers");
    for (const slug of AUDIT_DAY_SLUGS)
      await expect(page.getByTestId(`register-${slug}`)).toBeVisible();
    await checkWidths(page, "registers index");
    await shot(page, "registers-index", project);
  });

  test("AC-1: no register list wraps a word letter by letter at 360 px", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    // Every list has rows by now (the starter rows and the rows the earlier
    // tests added); the conflicts register may be empty, which is its empty
    // state, also a list.
    for (const slug of AUDIT_DAY_SLUGS) {
      await page.goto(`/registers/${slug}`);
      await noLetterWrap(page, `${slug}-list`, `${slug} list`);
    }
  });
});
