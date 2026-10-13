import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

/**
 * REQ-013 P2 (FR-6 to FR-12) on both projects: the home page says what it
 * is and what you can count on; the step indicator is one line with "Step
 * n of 6"; supports groups collapse on phones and open on search, the hint
 * or a tap, with ticked classes still visible; a sole trader's workforce
 * step starts with the usual answers; the result has one audit heading and
 * a way to ask a question. With EVIDENCE=1, screenshots go to
 * product/evidence/req-013/.
 */
const dir = "product/evidence/req-013";

async function shot(page: Page, name: string, project: string) {
  if (!process.env.EVIDENCE) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}/${name}-${project}.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 40,
    scale: "css",
  });
}

async function axeClean(page: Page) {
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
  ).toEqual([]);
}

test.describe("REQ-013 P2", () => {
  test("home page: value proposition, free line, trust cues, example result, no 'is being built' (FR-8)", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    // Batch 24 (home v2): the headline asks the audit question.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /which NDIS audit/,
    );
    await expect(page.getByText(/is being built/)).toHaveCount(0);
    await expect(page.getByTestId("home-free-line")).toContainText(
      /Free, about ten minutes/,
    );
    const trust = page.getByTestId("home-trust");
    for (const cue of [
      "Sourced to the Commission",
      "Hosted in Australia",
      "No participant data",
      "Independent",
    ])
      await expect(trust).toContainText(cue);
    await expect(page.getByTestId("home-example")).toContainText(
      /Your audit: verification/,
    );
    await shot(page, "p2-home", testInfo.project.name);
    await axeClean(page);
  });

  test("step indicator is one line with the step label; completed steps stay linked (FR-7)", async ({
    page,
  }, testInfo) => {
    await page.goto("/start/business");
    await expect(page.getByTestId("progress-line-label")).toHaveText(
      "Step 1 of 6: Business",
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByTestId("progress-line-label")).toHaveText(
      "Step 2 of 6: Supports",
    );
    const completed = page.getByRole("navigation", { name: "Completed steps" });
    await expect(completed).toContainText("Back to:");
    await expect(
      completed.getByRole("link", { name: "Business" }),
    ).toHaveAttribute("href", "/start/business");
    // No wrapped list of six step names any more.
    await expect(
      page.getByRole("navigation", { name: "Questionnaire steps" }),
    ).toHaveCount(0);
    await shot(page, "p2-step-indicator", testInfo.project.name);
  });

  test("supports groups: the two common headings open, the rest collapsed on phones; search, hint and ticks behave (FR-11)", async ({
    page,
  }, testInfo) => {
    await page.goto("/start/business");
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    const personal = page.getByTestId("category-personal-care");
    const housing = page.getByTestId("category-housing");
    await expect(personal).toHaveAttribute("data-open", "true");
    await expect(personal).toContainText(/3 classes/);
    // Any phone-width project (Android or the WebKit iPhone) starts with the headings collapsed.
    const phone = (page.viewportSize()?.width ?? 1280) < 640;
    if (phone) {
      await expect(housing).toHaveAttribute("data-open", "false");
      await expect(page.locator("#group-0138")).toBeHidden();
    } else {
      await expect(housing).toHaveAttribute("data-open", "true");
    }
    await shot(page, "p2-supports-collapsed", testInfo.project.name);

    // A tap opens a heading; a tick inside it stays visible once it is closed again.
    if (phone) {
      await housing.getByRole("button", { name: /Housing and living/ }).click();
      await expect(housing).toHaveAttribute("data-open", "true");
    }
    await page.locator("#group-0138").check();
    if (phone) {
      await housing.getByRole("button", { name: /Housing and living/ }).click();
      await expect(housing).toHaveAttribute("data-open", "false");
      await expect(page.getByTestId("category-housing-ticked")).toBeVisible();
      await expect(page.locator("#group-0138-ticked")).toBeChecked();
      await expect(housing).toContainText(/1 ticked/);
      await shot(page, "p2-supports-ticked-collapsed", testInfo.project.name);
      // Unticking from the visible row works too (the row then goes, so a plain click, not uncheck).
      await page.locator("#group-0138-ticked").click();
      await expect(page.getByTestId("category-housing-ticked")).toHaveCount(0);
      await housing.getByRole("button", { name: /Housing and living/ }).click();
      await page.locator("#group-0138").check();
    }

    // A search opens the headings that match.
    await page.getByLabel(/Search by what you do/).fill("SIL");
    await expect(housing).toHaveAttribute("data-open", "true");
    await expect(page.locator("#group-0138")).toBeVisible();
    await page.getByLabel(/Search by what you do/).fill("");

    // The hint ticks 0107 and 0120 and leaves their headings open.
    await page.getByRole("button", { name: "Choose those two for me" }).click();
    await expect(page.locator("#group-0107")).toBeChecked();
    await expect(page.locator("#group-0120")).toBeChecked();
    await expect(page.getByTestId("category-around-the-house")).toHaveAttribute(
      "data-open",
      "true",
    );
    await axeClean(page);
  });

  test("a sole trader's workforce step starts with the usual answers and examples under the labels (FR-6, FR-10)", async ({
    page,
  }, testInfo) => {
    await page.goto("/start/business");
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.locator("#group-0120").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.locator("#restrictivePractices-no").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByTestId("workforce-defaults-note")).toBeVisible();
    const workers = page.getByLabel("Number of workers");
    await expect(workers).toHaveValue("1");
    await expect(workers).toHaveAttribute("inputmode", "numeric");
    await expect(page.getByLabel("Number of key personnel")).toHaveValue("1");
    await expect(page.locator("#hasRiskAssessedRoles-yes")).toBeChecked();
    await expect(
      page.getByText(/Examples: the owner, a director/),
    ).toBeVisible();
    await expect(
      page.getByText(/Examples: a support worker who helps someone shower/),
    ).toBeVisible();
    // They can change the defaults.
    await workers.fill("3");
    await expect(workers).toHaveValue("3");
    await shot(page, "p2-workforce-defaults", testInfo.project.name);
    await axeClean(page);

    // Finish to the result: one audit heading, the explanation inside the summary, a way to ask (FR-9, FR-12).
    await workers.fill("1");
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
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /^Your audit: verification/,
      }),
    ).toHaveCount(1);
    await expect(page.getByTestId("summary")).toContainText(
      /You will need \d+ documents/,
    );
    await expect(
      page.getByTestId("summary").getByTestId("pathway-description"),
    ).toBeVisible();
    await expect(page.getByTestId("result-contact")).toContainText(
      /Questions about your result/,
    );
    await expect(page.getByText("In short")).toHaveCount(0);
    await shot(page, "p2-result-summary", testInfo.project.name);
    await axeClean(page);
  });
});
