import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * REQ-003 AC-9 / AC-11 support: automated accessibility scan (axe, WCAG 2.1 A
 * and AA rules) on every step of the questionnaire on both projects. Zero
 * serious or critical violations allowed. Lighthouse cannot reach steps behind
 * the draft gate on a fresh load, so this is the per-step evidence; Lighthouse
 * covers the pages reachable without a draft.
 */
async function scan(page: Page, label: string) {
  // Client navigation can update <title> a tick after the heading renders.
  await page.waitForFunction(() => document.title.length > 0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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
  const summary: Record<string, string[]> = {};
  await page.goto("/start");
  summary.intro = await scan(page, "intro");

  await page.getByRole("link", { name: "Start the questionnaire" }).click();
  summary.business = await scan(page, "business (empty)");
  await page.getByRole("button", { name: "Save and continue" }).click();
  summary["business-errors"] = await scan(
    page,
    "business (with validation errors)",
  );
  await page.getByLabel("Trading name").fill("Sunrise Supports");
  await page.getByRole("radio", { name: "Sole trader" }).check();
  await page.getByRole("checkbox", { name: "NSW" }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
  ).toBeVisible();
  await page.locator("#group-0138").check();
  await page.locator("#group-0107").check();
  summary.supports = await scan(page, "supports (with SIL questions)");
  await page.locator("#silEligibility\\.fewHoursOnly-no").check();
  await page
    .locator("#silEligibility\\.participantManagesOwnWorkers-no")
    .check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
  ).toBeVisible();
  summary.practices = await scan(page, "practices");
  await page.locator("#restrictivePractices-not-sure").check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Your workforce" }),
  ).toBeVisible();
  await page.getByLabel("Number of workers").fill("30");
  await page.getByLabel("Number of key personnel").fill("2");
  await page.locator("#hasRiskAssessedRoles-yes").check();
  await page.locator("#allRiskAssessedScreened-no").check();
  summary.workforce = await scan(page, "workforce (with large-provider note)");
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
  summary.existing = await scan(page, "existing");
  await page.getByRole("button", { name: "See my result" }).click();

  await expect(page.getByTestId("result")).toBeVisible();
  await page.getByTestId("module-core").locator("summary").click();
  summary.result = await scan(page, "result (expander open)");

  test.info().annotations.push({
    type: "axe-summary",
    description: JSON.stringify(summary),
  });
});
