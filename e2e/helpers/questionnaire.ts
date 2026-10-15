/**
 * The questionnaire fill helpers (batch 47 item 1 moved them here from
 * questionnaire.spec.ts so the subscription specs can reach the result page
 * the same way the questionnaire spec does).
 */
import { expect, type Page } from "@playwright/test";
import { tickGroup } from "./groups";
import { openResultSections } from "./result";

export async function fillBusiness(
  page: Page,
  opts: { abn?: string; structure?: string } = {},
) {
  await page.getByLabel("Trading name").fill("Sunrise Supports");
  await page
    .getByRole("radio", { name: opts.structure ?? "Sole trader" })
    .check();
  await page.getByRole("checkbox", { name: "NSW" }).check();
  if (opts.abn !== undefined) await page.locator("#abn").fill(opts.abn);
  await page.getByRole("button", { name: "Save and continue" }).click();
}

export async function chooseGroups(page: Page, codes: string[]) {
  for (const code of codes) await tickGroup(page, code);
}

export async function fillRest(
  page: Page,
  restrictive: "Yes" | "No" | "Not sure" = "No",
) {
  // practices
  const rp = { Yes: "yes", No: "no", "Not sure": "not-sure" }[restrictive];
  await page.locator(`#restrictivePractices-${rp}`).check();
  if (restrictive === "Not sure") {
    // REQ-013 FR-4: the helper resolves 'not sure'; one 'yes' keeps the assumed path.
    await page.locator("#notSureHelper\\.locksOrBarriers-yes").check();
    await page.locator("#notSureHelper\\.holdsOrRestraint-no").check();
    await page.locator("#notSureHelper\\.medicationForBehaviour-no").check();
  }
  await fillFromWorkforce(page);
}

/** Saves the practices step and completes workforce and existing through to the result. */
export async function fillFromWorkforce(
  page: Page,
  opts: { have?: string[] } = {},
) {
  await page.getByRole("button", { name: "Save and continue" }).click();
  // workforce
  await expect(
    page.getByRole("heading", { level: 1, name: "Your workforce" }),
  ).toBeVisible();
  await page.getByLabel("Number of workers").fill("2");
  await page.getByLabel("Number of key personnel").fill("1");
  await page.locator("#hasRiskAssessedRoles-yes").check();
  await page.locator("#allRiskAssessedScreened-yes").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  // existing
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
    // Batch 48 item 1: "yes" for the items named in `have`, "no" for the rest.
    await page
      .locator(`#${key}-${opts.have?.includes(key) ? "yes" : "no"}`)
      .check();
  }
  await page.getByRole("button", { name: "See my result" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Your result" }),
  ).toBeVisible();
  await expect(page.getByTestId("result")).toBeVisible();
  // REQ-015 Section B: the detail sits in closed disclosures; open them for the assertions below.
  await openResultSections(page);
}

/** Fills every step with a sole-trader daily-living answer set and lands on the result page. */
export async function reachResult(page: Page) {
  await page.goto("/start/business");
  await fillBusiness(page);
  await chooseGroups(page, ["0107"]);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await fillRest(page);
}
