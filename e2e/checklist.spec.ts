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
    // Batch 45 item 6: the one sentence that adds up ("Checklist: N items: the X
    // above plus Y about your workers, insurance and the audit"), the line a
    // provider screenshots for a partner; its numbers must agree. REQ-028
    // D-2805 moved the link into the documents section, so the count is read
    // from the summary list's third item alone.
    const line = page.getByTestId("checklist-count-line");
    const things = Number(
      ((await line.textContent()) ?? "").match(/Checklist: (\d+) items/)?.[1],
    );
    await expect(line).toContainText(
      /Checklist: \d+ items \(\d+ above plus \d+ about your workers, insurance and the audit\)/,
    );
    const m = ((await line.textContent()) ?? "").match(
      /Checklist: (\d+) items \((\d+) above plus (\d+)/,
    )!;
    expect(Number(m[1])).toBe(things);
    expect(Number(m[2]) + Number(m[3])).toBe(Number(m[1]));
    // REQ-028 FR-6, D-2805: the link is at the head of the documents section, in its words.
    const docs = page.getByTestId("result-section-documents");
    if ((await docs.getAttribute("open")) === null)
      await docs.locator("> summary").click();
    await expect(page.getByTestId("checklist-sign-in")).toHaveText(
      "Open these in your checklist",
    );
    await expect(page.getByTestId("checklist-sign-in")).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fchecklist",
    );
    await expect(page.getByTestId("checklist-link")).toHaveCount(0);
  });
});
