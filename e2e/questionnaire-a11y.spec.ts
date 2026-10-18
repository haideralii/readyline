import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { tickGroup } from "./helpers/groups";
import { openResultSections } from "./helpers/result";

/**
 * REQ-003 AC-9 / AC-11 support: automated accessibility scan (axe, WCAG 2.2 A
 * and AA rules) on every step of the questionnaire on both projects. Zero
 * serious or critical violations allowed. Lighthouse cannot reach steps behind
 * the draft gate on a fresh load, so this is the per-step evidence; Lighthouse
 * covers the pages reachable without a draft.
 */
async function scan(page: Page, label: string, heading: string) {
  // On a client navigation Next streams a dynamic page's metadata after its
  // content, so for about ten milliseconds the old <title> is gone and the
  // new one not yet there (measured on the Android project; axe's
  // document-title rule saw that moment on the business step, CI run 571,
  // once the step's form rendered at first paint). Waiting for any title
  // passed on the previous page's, so wait for this page's heading and the
  // title it gives itself; the new title arrives once and stays.
  await expect(
    page.getByRole("heading", { level: 1, name: heading }),
  ).toBeVisible();
  await page.waitForFunction((h) => document.title.includes(h), heading);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
    `${label}: serious or critical axe violations`,
  ).toEqual([]);
  return results.violations.map((v) => `${v.impact}:${v.id}`);
}

test("every questionnaire step has no serious or critical accessibility violations", async ({
  page,
}) => {
  // QA pass N2: six axe passes in one test need about eleven seconds alone and
  // more beside other workers; CI runs one worker, a local run several.
  test.slow();
  const summary: Record<string, string[]> = {};
  await page.goto("/start");
  summary.intro = await scan(
    page,
    "intro",
    "Find out what registration needs from you",
  );

  await page.getByRole("link", { name: "Start the questionnaire" }).click();
  summary.business = await scan(
    page,
    "business (empty)",
    "About your business",
  );
  await page.getByRole("button", { name: "Save and continue" }).click();
  summary["business-errors"] = await scan(
    page,
    "business (with validation errors)",
    "About your business",
  );
  await page.getByLabel("Trading name").fill("Sunrise Supports");
  await page.getByRole("radio", { name: "Sole trader" }).check();
  await page.getByRole("checkbox", { name: "NSW" }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
  ).toBeVisible();
  await tickGroup(page, "0138");
  await tickGroup(page, "0107");
  summary.supports = await scan(
    page,
    "supports (with SIL questions)",
    "The supports you deliver",
  );
  await page.locator("#silEligibility\\.fewHoursOnly-no").check();
  await page
    .locator("#silEligibility\\.participantManagesOwnWorkers-no")
    .check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
  ).toBeVisible();
  summary.practices = await scan(page, "practices", "Restrictive practices");
  await page.locator("#restrictivePractices-not-sure").check();
  summary["practices-helper"] = await scan(
    page,
    "practices (not-sure helper open)",
    "Restrictive practices",
  );
  await page.locator("#notSureHelper\\.locksOrBarriers-yes").check();
  await page.locator("#notSureHelper\\.holdsOrRestraint-no").check();
  await page.locator("#notSureHelper\\.medicationForBehaviour-no").check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Your workforce" }),
  ).toBeVisible();
  await page.getByLabel("Number of workers").fill("30");
  await page.getByLabel("Number of key personnel").fill("2");
  await page.locator("#hasRiskAssessedRoles-yes").check();
  await page.locator("#allRiskAssessedScreened-no").check();
  summary.workforce = await scan(
    page,
    "workforce (with large-provider note)",
    "Your workforce",
  );
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "What you already have" }),
  ).toBeVisible();
  for (const key of [
    "policies",
    "incidentRegister",
    "complaintsRegister",
    "insuranceCertificate",
    "workerInductionRecords",
  ]) {
    await page.locator(`#${key}-not-sure`).check();
  }
  summary.existing = await scan(page, "existing", "What you already have");
  await page.getByRole("button", { name: "See my result" }).click();

  await expect(page.getByTestId("result")).toBeVisible();
  summary["result-card"] = await scan(
    page,
    "result (card only)",
    "Your result",
  );
  await openResultSections(page);
  summary.result = await scan(
    page,
    "result (every disclosure open)",
    "Your result",
  );

  test.info().annotations.push({
    type: "axe-summary",
    description: JSON.stringify(summary),
  });
});
