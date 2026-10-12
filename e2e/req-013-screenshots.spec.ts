import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Evidence capture for REQ-013 P1: every changed step at the project's
 * viewport, written to product/evidence/req-013/. Runs only with EVIDENCE=1.
 */
const dir = "product/evidence/req-013";

test.describe("REQ-013 screenshots", () => {
  test.skip(!process.env.EVIDENCE, "set EVIDENCE=1 to capture screenshots");

  test("changed steps at the project's viewport", async ({
    page,
  }, testInfo) => {
    mkdirSync(dir, { recursive: true });
    const shot = (name: string) =>
      page.screenshot({
        path: `${dir}/${name}-${testInfo.project.name}.jpg`,
        fullPage: true,
        type: "jpeg",
        quality: 40,
      });

    await page.goto("/start/business");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Please fix" }),
    ).toBeVisible();
    await shot("1-business-plain-errors");
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
    ).toBeVisible();
    await shot("2-supports-everyday-groupings");
    await page.getByLabel(/Search by what you do/).fill("cleaning");
    await shot("2-supports-search-cleaning");
    await page.getByLabel(/Search by what you do/).fill("");
    await page.getByRole("button", { name: "Choose those two for me" }).click();
    await shot("2-supports-hint-applied");
    await next(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
    ).toBeVisible();
    await shot("3-practices-examples");
    await page.locator("#restrictivePractices-not-sure").check();
    await page.locator("#notSureHelper\\.locksOrBarriers-no").check();
    await page.locator("#notSureHelper\\.holdsOrRestraint-no").check();
    await page.locator("#notSureHelper\\.medicationForBehaviour-no").check();
    await shot("3-practices-not-sure-helper");
    await next(page);

    await page.getByLabel("Number of workers").fill("1");
    await page.getByLabel("Number of key personnel").fill("1");
    await page.locator("#hasRiskAssessedRoles-yes").check();
    await page.locator("#allRiskAssessedScreened-yes").check();
    await next(page);
    for (const key of [
      "policies",
      "incidentRegister",
      "complaintsRegister",
      "insuranceCertificate",
      "workerInductionRecords",
    ]) {
      await page.locator(`#${key}-no`).check();
    }
    await page.getByRole("button", { name: "See my result" }).click();
    await expect(page.getByTestId("summary")).toBeVisible();
    await shot("6-result-summary-and-groups");
  });
});

async function next(page: Page) {
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL(
    /\/start\/(supports|practices|workforce|existing|result)$/,
  );
}
