import { test, expect, type Page } from "@playwright/test";

/**
 * REQ-006 FR-5 on both projects, signed out: the checklist page needs a
 * session, and the result page shows the teaser with the item count and the
 * sign-in link; nothing is stored. The signed-in checklist runs in
 * e2e/signed-in/checklist.spec.ts (CI's Supabase job).
 */
async function fillToResult(page: Page) {
  await page.goto("/start");
  await page.getByRole("link", { name: "Start the questionnaire" }).click();
  await page.getByLabel("Trading name").fill("Sunrise Supports");
  await page.getByRole("radio", { name: "Sole trader" }).check();
  await page.getByRole("checkbox", { name: "NSW" }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.locator("#group-0120").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.locator("#restrictivePractices-no").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByLabel("Number of workers").fill("1");
  await page.getByLabel("Number of key personnel").fill("1");
  await page.locator("#hasRiskAssessedRoles-yes").check();
  await page.locator("#allRiskAssessedScreened-yes").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
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
}

test.describe("readiness checklist, signed out (REQ-006 FR-5)", () => {
  test("the checklist page redirects to sign-in", async ({ page }) => {
    await page.goto("/checklist");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fchecklist$/);
  });

  test("the result page shows the teaser with the item count and the sign-in link", async ({
    page,
  }) => {
    await fillToResult(page);
    const teaser = page.getByTestId("checklist-teaser");
    // REQ-013 batch 36 item 3: the link says what it opens. Batch 45 item 6
    // adds the one sentence that adds up ("Your checklist has N items: the X
    // above plus Y about your workers, insurance and the audit"), the line a
    // provider screenshots for a partner; its numbers must agree.
    await expect(teaser).toContainText(/Open your checklist \((\d+) things\)/);
    const things = Number(
      ((await teaser.textContent()) ?? "").match(
        /Open your checklist \((\d+) things\)/,
      )?.[1],
    );
    // REQ-025 FR-3: the checklist line is the summary list's third item.
    const line = page.getByTestId("checklist-count-line");
    await expect(line).toContainText(
      /Checklist: \d+ items \(\d+ above plus \d+ about your workers, insurance and the audit\)/,
    );
    const m = ((await line.textContent()) ?? "").match(
      /Checklist: (\d+) items \((\d+) above plus (\d+)/,
    )!;
    expect(Number(m[1])).toBe(things);
    expect(Number(m[2]) + Number(m[3])).toBe(Number(m[1]));
    await expect(page.getByTestId("checklist-sign-in")).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fchecklist",
    );
    await expect(page.getByTestId("checklist-link")).toHaveCount(0);
  });
});
