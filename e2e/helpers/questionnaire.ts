/**
 * The questionnaire fill helpers (batch 47 item 1 moved them here from
 * questionnaire.spec.ts so the subscription specs can reach the result page
 * the same way the questionnaire spec does).
 */
import { expect, type Page } from "@playwright/test";
import { glossaryOnPage } from "./glossary";
import { tickGroup } from "./groups";
import { openResultSections } from "./result";

/**
 * REQ-027 AC-3 (D-2721, D-2267): the render check once per step after it renders, inside the
 * helpers every questionnaire spec calls, so no spec loads a step again for it. axe is not run
 * here: the accessibility pass (req-015-a11y) runs it on every step on all three projects, and
 * D-2207 keeps the minutes.
 */
export async function fillBusiness(
  page: Page,
  opts: { abn?: string; structure?: string } = {},
) {
  await expect(
    page.getByRole("heading", { level: 1, name: "About your business" }),
  ).toBeVisible();
  await glossaryOnPage(page, { label: "step 1", axe: false });
  await page.getByLabel("Trading name").fill("Sunrise Supports");
  await page
    .getByRole("radio", { name: opts.structure ?? "Sole trader" })
    .check();
  await page.getByRole("checkbox", { name: "NSW" }).check();
  if (opts.abn !== undefined) await page.locator("#abn").fill(opts.abn);
  await page.getByRole("button", { name: "Save and continue" }).click();
}

export async function chooseGroups(page: Page, codes: string[]) {
  await expect(
    page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
  ).toBeVisible();
  await glossaryOnPage(page, { label: "step 2", axe: false });
  for (const code of codes) await tickGroup(page, code);
}

export async function fillRest(
  page: Page,
  restrictive: "Yes" | "No" | "Not sure" = "No",
) {
  // practices
  await expect(
    page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
  ).toBeVisible();
  await glossaryOnPage(page, { label: "step 3", axe: false });
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
  await glossaryOnPage(page, { label: "step 4", axe: false });
  await page.getByLabel("Number of workers").fill("2");
  await page.getByLabel("Number of key personnel").fill("1");
  await page.locator("#hasRiskAssessedRoles-yes").check();
  await page.locator("#allRiskAssessedScreened-yes").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  // existing
  await expect(
    page.getByRole("heading", { level: 1, name: "What you already have" }),
  ).toBeVisible();
  await glossaryOnPage(page, { label: "step 5", axe: false });
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
  // REQ-027 D-2711: the result page's inline first term is its audit kind; the disclosure counts the rest.
  await glossaryOnPage(page, {
    label: "result",
    inline: await resultInlineTerm(page),
    axe: false,
  });
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

/** The result page's audit kind, `verification-audit` or `certification-audit`, read from its heading. */
export async function resultInlineTerm(page: Page): Promise<string> {
  const heading = await page
    .getByTestId("summary")
    .getByRole("heading", { level: 2 })
    .textContent();
  const kind = heading?.match(/Your audit: (w+)/)?.[1];
  if (!kind) throw new Error(`no audit kind in the result heading: ${heading}`);
  return `${kind}-audit`;
}
