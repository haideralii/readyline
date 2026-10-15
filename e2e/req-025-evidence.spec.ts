import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * REQ-025 evidence: step 5 and the result page at 360 px and desktop,
 * before and after Session A (the REQ asks for both). Runs only with
 * EVIDENCE=1; EVIDENCE_TAG names the set ("before" or "after"). The answers
 * are the AC-2 fixture: personal care (certification) with two "Yes" on
 * step 5, so the "you said you have" clause is on the page.
 */
const DIR = "product/evidence/req-025";
const tag = process.env.EVIDENCE_TAG ?? "after";

async function shot(page: Page, name: string, project: string) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({
    path: `${DIR}/${name}-${tag}-${project}.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 45,
    scale: "css",
  });
}

test.describe("REQ-025 evidence screenshots", () => {
  test.skip(!process.env.EVIDENCE, "set EVIDENCE=1 to record the screenshots");

  test(`step 5 and the result (${tag})`, async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    await page.goto("/start/business");
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.locator("#group-0107").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.locator("#restrictivePractices-no").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.getByLabel("Number of workers").fill("3");
    await page.locator("#allRiskAssessedScreened-yes").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "What you already have" }),
    ).toBeVisible();
    await shot(page, "step-5", project);
    for (const [key, value] of [
      ["policies", "yes"],
      ["incidentRegister", "yes"],
      ["complaintsRegister", "no"],
      ["insuranceCertificate", "no"],
      ["workerInductionRecords", "not-sure"],
    ])
      await page.locator(`#${key}-${value}`).check();
    await page.getByRole("button", { name: "See my result" }).click();
    await expect(page.getByTestId("result")).toBeVisible();
    await shot(page, "result", project);
    // The three disclosures open, so the lists and the reasons are in the picture too.
    for (const id of ["why", "documents", "registers"]) {
      const d = page.getByTestId(`result-section-${id}`);
      if (!(await d.getAttribute("open"))) await d.locator("> summary").click();
    }
    await shot(page, "result-open", project);
  });
});
