import { test, expect, type Page } from "@playwright/test";
import { axeSerious } from "./helpers/a11y";
import { checkWidths } from "./helpers/width";
import {
  chooseGroups,
  fillBusiness,
  fillFromWorkforce,
} from "./helpers/questionnaire";

/**
 * REQ-025 Session B on the three projects (FR-6 to FR-9, AC-4 to AC-6;
 * D-2217): one stepper on every step: line one "Step N of 6: name" first
 * and always visible, a row of six circles beneath, done steps as plain
 * links, the current step marked, later steps inert and not focusable; on
 * a phone no labels under the circles and a "Show steps" disclosure beside
 * line one with the names and the same links; no sideways scroll; 44 px
 * targets; "Start again" asks before clearing. Step 5's lines and the
 * result's pack line are Session A's.
 */
async function toExisting(page: Page) {
  await page.goto("/start/business");
  await fillBusiness(page);
  await chooseGroups(page, ["0107"]);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.locator("#restrictivePractices-no").check();
}

test.describe("REQ-025 Session B: one stepper", () => {
  test("step 5 says what the answers do, and the result's line is the pack line (Session A on this branch)", async ({
    page,
  }) => {
    await toExisting(page);
    await fillFromWorkforce(page, { have: ["policies", "incidentRegister"] });
    await expect(page.getByTestId("result-ready-line-text")).toContainText(
      /The pack drafts all \d+ so they match; your checklist shows which to compare with what you have\./,
    );
    await expect(page.getByTestId("summary-documents")).toContainText(
      /you said you have \d+/,
    );
    await page.goto("/start/existing");
    const intro = page.getByTestId("existing-intro");
    await expect(intro).toContainText(
      "Your answers here pre-tick your readiness checklist, so you can see what is missing today.",
    );
    await expect(intro).toContainText("Not sure counts as no.");
  });

  test("the stepper: line one first, done steps link back, the current step is marked, later steps are inert, the phone disclosure lists the names, and Start again asks", async ({
    page,
  }, testInfo) => {
    await toExisting(page);
    await fillFromWorkforce(page);
    const stepper = page.getByRole("navigation", {
      name: "Questionnaire steps",
    });
    await expect(stepper).toBeVisible();
    // FR-6: line one is the first thing in the nav and names the step.
    const label = page.getByTestId("progress-line-label");
    await expect(label).toHaveText("Step 6 of 6: Result");
    await expect(label).toBeVisible();
    expect(
      await stepper.evaluate((nav) => {
        const line = nav.querySelector('[data-testid="progress-line-label"]');
        const row = nav.querySelector('ol[class*="mt-2"]');
        return Boolean(
          line &&
          row &&
          line.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }),
      "line one precedes the row",
    ).toBe(true);
    // AC-4: one nav, six items, the current step marked, done steps links, future steps not focusable.
    const row = stepper.locator("ol").last();
    await expect(row.locator("> li")).toHaveCount(6);
    await expect(row.locator("[aria-current='step']")).toHaveAttribute(
      "aria-label",
      /Step 6, Result/,
    );
    await expect(row.getByRole("link")).toHaveCount(5);
    await expect(
      row.getByRole("link", { name: /Step 5, Already have: done/ }),
    ).toHaveAttribute("href", "/start/existing");
    // A done circle is a plain link (FR-8: nothing nests inside the row).
    for (const link of await row.getByRole("link").all())
      expect(await link.locator("button, a, details").count()).toBe(0);
    await page.goto("/start/supports");
    const rowSupports = stepper.locator("ol").last();
    const inert = rowSupports.locator("[aria-disabled='true']");
    await expect(inert).toHaveCount(4);
    for (const el of await inert.all()) {
      expect(await el.evaluate((e) => e.tagName)).toBe("SPAN");
      expect(await el.getAttribute("tabindex")).toBeNull();
    }
    // AC-5 and FR-7: 44 px targets; at a phone width no labels under the circles and no sideways scroll.
    const phone = (page.viewportSize()?.width ?? 1280) < 640;
    for (const li of await rowSupports.locator("> li").all()) {
      const box = await li.locator("> a, > span[aria-label]").boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    const underLabel = rowSupports
      .getByTestId("stepper-business")
      .locator("span[aria-hidden]")
      .last();
    const steps = page.getByTestId("stepper-steps");
    if (phone) {
      await expect(underLabel).toBeHidden();
      // FR-8: the names sit behind "Show steps" beside line one, with the same links.
      await expect(steps).toBeVisible();
      await expect(steps.locator("> summary")).toHaveText("Show steps");
      await steps.locator("> summary").click();
      const list = page.getByTestId("stepper-steps-list");
      await expect(list.locator("> li")).toHaveCount(6);
      await expect(list.getByRole("link")).toHaveCount(1);
      await expect(
        list.getByRole("link", { name: /1\. Business/ }),
      ).toHaveAttribute("href", "/start/business");
      // One current step per navigation: the circle carries aria-current; the
      // list marks its current item by state and the sr-only ": current".
      await expect(list.locator("[aria-current='step']")).toHaveCount(0);
      await expect(list.locator("[data-state='current']")).toContainText(
        "2. Supports",
      );
      await expect(list.locator("> li").nth(5)).toHaveAttribute(
        "data-state",
        "todo",
      );
    } else {
      await expect(underLabel).toBeVisible();
      await expect(steps).toBeHidden();
    }
    await checkWidths(
      page,
      `supports with the stepper (${testInfo.project.name})`,
    );
    expect(await axeSerious(page, "supports with the stepper")).toEqual([]);

    // Tapping a done step is how an answer changes; later steps stay done while still valid.
    await page.goto("/start/result");
    await expect(page.getByTestId("result")).toBeVisible();
    await stepper
      .getByRole("link", { name: /Step 5, Already have: done/ })
      .click();
    await expect(page).toHaveURL(/\/start\/existing$/);
    await expect(label).toHaveText("Step 5 of 6: Already have");
    await expect(stepper.getByTestId("stepper-result")).toHaveAttribute(
      "data-state",
      "todo",
    );
    await page.getByRole("button", { name: "See my result" }).click();
    await expect(page.getByTestId("result")).toBeVisible();
    await expect(page.getByText("Change my answers")).toHaveCount(0);
    await expect(page.getByText("Back to:")).toHaveCount(0);
    expect(await axeSerious(page, "result with the stepper")).toEqual([]);

    // AC-6: "Start again" asks first; Keep leaves everything; Yes clears and goes to the intro.
    await expect(page.getByTestId("clear-draft")).toHaveText("Start again");
    await page.getByTestId("clear-draft").click();
    await expect(page.getByTestId("clear-draft-confirm")).toContainText(
      /Clear your answers and start again/,
    );
    await page.getByRole("button", { name: "Keep" }).click();
    await expect(page.getByTestId("result")).toBeVisible();
    await page.getByTestId("clear-draft").click();
    await page.getByTestId("clear-draft-yes").click();
    // QA pass F7 (D-2269): the intro is where "Start again" lands, not step 1.
    await expect(page).toHaveURL(/\/start$/);
    await page.goto("/start/business");
    await expect(page.getByLabel("Trading name")).toHaveValue("");
    await expect(page.getByTestId("stepper-supports")).toHaveAttribute(
      "data-state",
      "todo",
    );
  });
});
