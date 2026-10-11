import { test, expect, type Page } from "@playwright/test";

/**
 * REQ-003 end-to-end (both projects): happy path, back navigation, reload
 * restore, storage-throws path, ABN validation, SIL exclusion, result content
 * for the AC-1 and AC-2 reference cases.
 */

async function fillBusiness(
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

async function chooseGroups(page: Page, codes: string[]) {
  for (const code of codes) await page.locator(`#group-${code}`).check();
}

async function fillRest(
  page: Page,
  restrictive: "Yes" | "No" | "Not sure" = "No",
) {
  // practices
  const rp = { Yes: "yes", No: "no", "Not sure": "not-sure" }[restrictive];
  await page.locator(`#restrictivePractices-${rp}`).check();
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
    await page.locator(`#${key}-no`).check();
  }
  await page.getByRole("button", { name: "See my result" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Your result" }),
  ).toBeVisible();
  await expect(page.getByTestId("result")).toBeVisible();
}

test.describe("questionnaire", () => {
  test("happy path: [0120] alone is verification with the verification module and no mid-term audit (AC-1)", async ({
    page,
  }) => {
    await page.goto("/start");
    await page.getByRole("link", { name: "Start the questionnaire" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "About your business" }),
    ).toBeVisible();
    await fillBusiness(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
    ).toBeVisible();
    await chooseGroups(page, ["0120"]);
    await page.getByRole("button", { name: "Save and continue" }).click();
    await fillRest(page);

    await expect(
      page.getByRole("heading", { level: 2, name: /Your audit: verification/ }),
    ).toBeVisible();
    await expect(page.getByTestId("module-verification")).toBeVisible();
    await expect(page.getByTestId("module-core")).toHaveCount(0);
    await expect(page.getByTestId("mid-term")).toContainText("Does not apply");
    const reasons = page.getByTestId("reason");
    await expect(reasons.first()).toContainText("verification audit");
    await expect(reasons.first().getByRole("link")).toHaveAttribute(
      "href",
      /registration-groups-or-classes-support/,
    );
    await expect(page.getByTestId("result-notice")).toContainText(
      /general information/i,
    );
    await expect(page.getByTestId("draft-status")).toContainText(
      "Draft saved locally on this device",
    );
  });

  test("[0120, 0107] is certification with the core module and a mid-term audit (AC-2)", async ({
    page,
  }) => {
    await page.goto("/start/business");
    await fillBusiness(page);
    await chooseGroups(page, ["0120", "0107"]);
    await page.getByRole("button", { name: "Save and continue" }).click();
    await fillRest(page);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /Your audit: certification/,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("module-core")).toContainText("24 standards");
    await expect(page.getByTestId("module-verification")).toHaveCount(0);
    await expect(page.getByTestId("mid-term")).toContainText("18 months");
    await expect(page.getByTestId("mid-term")).toContainText(
      "governance and operational management",
    );
    // FR-7: the explain expander lists the standards by name.
    await page
      .getByTestId("module-core")
      .getByRole("group")
      .locator("summary")
      .click();
    await expect(page.getByTestId("module-core")).toContainText(
      "Person-centred supports",
    );
  });

  test("back navigation keeps answers and the result step is unreachable until steps are valid (FR-4)", async ({
    page,
  }) => {
    await page.goto("/start/result");
    await expect(page).toHaveURL(/\/start\/business$/);
    await fillBusiness(page);
    await expect(page).toHaveURL(/\/start\/supports$/);
    await page.goto("/start/existing");
    await expect(page).toHaveURL(/\/start\/supports$/);
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/start\/business$/);
    await expect(page.getByLabel("Trading name")).toHaveValue(
      "Sunrise Supports",
    );
    await expect(
      page.getByRole("radio", { name: "Sole trader" }),
    ).toBeChecked();
  });

  test("reload restores the same step and answers (AC-7)", async ({ page }) => {
    await page.goto("/start/business");
    await fillBusiness(page);
    await chooseGroups(page, ["0107"]);
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
    ).toBeVisible();
    await page.goto("/start");
    await page
      .getByRole("link", { name: "Continue where you left off" })
      .click();
    await expect(page).toHaveURL(/\/start\/practices$/);
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page.locator("#group-0107")).toBeChecked();
  });

  test("storage that throws does not break the flow and shows the note (AC-7)", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await page.goto("/start/business");
    await fillBusiness(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
    ).toBeVisible();
    await expect(page.getByTestId("draft-status")).toContainText(
      "Could not save a draft on this device",
    );
    await chooseGroups(page, ["0120"]);
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
    ).toBeVisible();
  });

  test("an invalid ABN shows an inline message and blocks until fixed or cleared (AC-8)", async ({
    page,
  }) => {
    await page.goto("/start/business");
    await fillBusiness(page, { abn: "12345678901" });
    await expect(page).toHaveURL(/\/start\/business$/);
    await expect(
      page.getByRole("alert").filter({ hasText: "Please fix" }),
    ).toContainText("ABN");
    await expect(page.locator("#abn-error")).toContainText("11-digit ABN");
    await expect(page.locator("#abn")).toHaveAttribute("aria-invalid", "true");
    await page.locator("#abn").fill("");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/\/start\/supports$/);
  });

  test("[0138] with an exclusion says the service is not SIL and removes the module (AC-6)", async ({
    page,
  }) => {
    await page.goto("/start/business");
    await fillBusiness(page);
    await chooseGroups(page, ["0138", "0107"]);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /Two questions about supported independent living/,
      }),
    ).toBeVisible();
    await page.locator("#silEligibility\\.fewHoursOnly-yes").check();
    await page
      .locator("#silEligibility\\.participantManagesOwnWorkers-no")
      .check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await fillRest(page);
    await expect(page.getByTestId("sil-excluded")).toContainText(
      "not supported independent living",
    );
    await expect(page.getByTestId("module-sil")).toHaveCount(0);
    await expect(
      page.getByTestId("reason").filter({ hasText: "class 0138 was left out" }),
    ).toHaveCount(1);
  });

  test("restrictive practices 'not sure' adds the implementing module and says it was assumed (AC-5)", async ({
    page,
  }) => {
    await page.goto("/start/business");
    await fillBusiness(page);
    await chooseGroups(page, ["0107"]);
    await page.getByRole("button", { name: "Save and continue" }).click();
    await fillRest(page, "Not sure");
    await expect(page.getByTestId("module-ibsp")).toBeVisible();
    await expect(page.getByText("we assumed yes")).toBeVisible();
  });

  test("participant-data detector warns on the services note without blocking (SR-2)", async ({
    page,
  }) => {
    await page.goto("/start/business");
    await fillBusiness(page);
    await page
      .getByLabel(/Anything else about your services/)
      .fill("We support Jane Doe at 12 Example Street");
    await expect(
      page.getByRole("status").filter({ hasText: "Check this note" }),
    ).toBeVisible();
    await chooseGroups(page, ["0120"]);
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
    ).toBeVisible();
  });

  test("keyboard: focus lands on the step heading after each step (AC-11)", async ({
    page,
  }) => {
    await page.goto("/start/business");
    await fillBusiness(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
    ).toBeFocused();
  });

  test("no horizontal overflow on any step", async ({ page }) => {
    await page.goto("/start/business");
    await fillBusiness(page);
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
