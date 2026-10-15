import { test, expect } from "@playwright/test";
import { openResultSections } from "./helpers/result";
import { checkWidths } from "./helpers/width";

/**
 * REQ-015 FR-16a on every public page and every questionnaire step, on each
 * project: no sideways scroll at the project's width, at 375 px and at 360 px
 * with larger text. The signed-in pages (checklist, documents, purchase) run
 * the same check inside their own specs under e2e/signed-in/.
 */
const PUBLIC_PAGES = [
  "/",
  "/start",
  "/pricing",
  "/sample",
  "/sign-in",
  "/about",
  "/privacy",
  "/terms",
  "/refunds",
  "/ai",
  "/documents",
  "/checklist",
  "/account",
];

test.describe("no sideways movement (REQ-015 FR-16a)", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} fits the screen`, async ({ page }) => {
      await page.goto(path);
      // A signed-out page may redirect to sign-in; let the final document settle (WebKit resolves goto early).
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => document.title.length > 0);
      // The home sample's later sections are folded; open them so their tables are checked too.
      const more = page.getByTestId("sample-more");
      if (await more.count()) await more.click();
      await checkWidths(page, path);
    });
  }

  test("every questionnaire step and the result fit the screen", async ({
    page,
  }) => {
    // Six steps, three widths each on a phone, plus the result twice.
    test.setTimeout(90_000);
    await page.goto("/start/business");
    await checkWidths(page, "business (empty)");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await checkWidths(page, "business (errors)");
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
    ).toBeVisible();
    await checkWidths(page, "supports");
    await page.locator("#group-0120").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
    ).toBeVisible();
    await page.locator("#restrictivePractices-not-sure").check();
    await checkWidths(page, "practices (helper open)");
    await page.locator("#restrictivePractices-no").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Your workforce" }),
    ).toBeVisible();
    await checkWidths(page, "workforce");
    await page.getByLabel("Number of workers").fill("1");
    await page.locator("#allRiskAssessedScreened-yes").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "What you already have" }),
    ).toBeVisible();
    await checkWidths(page, "existing");
    for (const key of [
      "policies",
      "incidentRegister",
      "complaintsRegister",
      "insuranceCertificate",
      "workerInductionRecords",
    ])
      await page.locator(`#${key}-no`).check();
    await page.getByRole("button", { name: "See my result" }).click();
    await expect(page.getByTestId("result")).toBeVisible();
    await checkWidths(page, "result (card)");
    // Open every disclosure on the result so folded content is measured too.
    await openResultSections(page);
    await checkWidths(page, "result (all open)");
  });
});
