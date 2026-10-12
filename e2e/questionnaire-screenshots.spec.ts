import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tickGroup } from "./helpers/groups";

/**
 * Evidence capture for REQ-003: one screenshot per step on each project,
 * written to product/evidence/req-003/. Runs only when EVIDENCE=1 so the
 * normal suite stays fast and deterministic.
 */
const dir = "product/evidence/req-003";

test.describe("questionnaire screenshots", () => {
  test.skip(!process.env.EVIDENCE, "set EVIDENCE=1 to capture screenshots");

  test("every step at the project's viewport", async ({ page }, testInfo) => {
    mkdirSync(dir, { recursive: true });
    const shot = (name: string) =>
      page.screenshot({
        path: `${dir}/${name}-${testInfo.project.name}.jpg`,
        fullPage: true,
        type: "jpeg",
        quality: 40,
      });

    await page.goto("/start");
    await shot("0-intro");
    await page.getByRole("link", { name: "Start the questionnaire" }).click();
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.locator("#abn").fill("51 824 753 556");
    await shot("1-business");
    await next(page);
    await tickGroup(page, "0120");
    await tickGroup(page, "0107");
    await shot("2-supports");
    await next(page);
    await page.getByRole("radio", { name: "No", exact: true }).check();
    await shot("3-practices");
    await next(page);
    await page.getByLabel("Number of workers").fill("3");
    await page.getByLabel("Number of key personnel").fill("1");
    await page.locator("#hasRiskAssessedRoles-yes").check();
    await page.locator("#allRiskAssessedScreened-not-sure").check();
    await shot("4-workforce");
    await next(page);
    for (const key of [
      "policies",
      "incidentRegister",
      "complaintsRegister",
      "insuranceCertificate",
      "workerInductionRecords",
    ]) {
      await page
        .locator(`#${key}-${key === "insuranceCertificate" ? "yes" : "no"}`)
        .check();
    }
    await shot("5-existing");
    await page.getByRole("button", { name: "See my result" }).click();
    await expect(page.getByTestId("result")).toBeVisible();
    await page.getByTestId("module-core").locator("summary").click();
    await shot("6-result");
  });
});

async function next(page: Page) {
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL(
    /\/start\/(supports|practices|workforce|existing|result)$/,
  );
}
