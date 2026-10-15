import { test, expect } from "@playwright/test";
import { checkWidths } from "./helpers/width";
import {
  chooseGroups,
  fillBusiness,
  fillFromWorkforce,
} from "./helpers/questionnaire";

/**
 * Batch 48 items 1 and 2 (D-2214): step 5 says the pack is always the full
 * set and "already have" only pre-ticks the checklist; the result's sentence
 * says the same when something is already had; and one stepper on every
 * step: done steps are links, the current step is marked, later steps are
 * not interactive, the line beneath names the step, nothing scrolls
 * sideways at 360 px, and "Start again" asks before clearing.
 */
async function toExisting(page: Parameters<typeof fillBusiness>[0]) {
  await page.goto("/start/business");
  await fillBusiness(page);
  await chooseGroups(page, ["0107"]);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.locator("#restrictivePractices-no").check();
}

test.describe("batch 48: what already have means, and one stepper", () => {
  test("step 5 says the pack stays the full set, and the result says what the checklist still shows", async ({
    page,
  }) => {
    await toExisting(page);
    await fillFromWorkforce(page, { have: ["policies", "incidentRegister"] });
    // The intro was read on the way through step 5; the sentence on the result carries the counts.
    const text =
      (await page.getByTestId("result-ready-line-text").textContent()) ?? "";
    const m =
      /You told us you already have (\d+) of these; the pack still drafts all (\d+) so they match each other, and your checklist shows the (\d+) still to prepare\./.exec(
        text,
      );
    expect(m, text).not.toBeNull();
    expect(Number(m![1])).toBe(2);
    expect(Number(m![3])).toBeGreaterThan(Number(m![2]) - 2);
    await page.goto("/start/existing");
    await expect(page.getByTestId("existing-intro")).toContainText(
      "This does not change which standards apply or what your pack contains: the pack drafts the full set so every document matches.",
    );
    await expect(page.getByTestId("existing-intro")).toContainText(
      "Not sure counts as no.",
    );
  });

  test("the stepper: done steps link back, the current step is marked, later steps are inert, and it fits a phone", async ({
    page,
  }) => {
    await toExisting(page);
    await fillFromWorkforce(page);
    const stepper = page.getByRole("navigation", {
      name: "Questionnaire steps",
    });
    await expect(stepper).toBeVisible();
    await expect(page.getByTestId("progress-line-label")).toHaveText(
      "Step 6 of 6: Result",
    );
    await expect(stepper.locator("[aria-current='step']")).toHaveAttribute(
      "aria-label",
      /Step 6, Result/,
    );
    await expect(stepper.getByRole("link")).toHaveCount(5);
    await expect(
      stepper.getByRole("link", { name: /Step 5, Already have: done/ }),
    ).toHaveAttribute("href", "/start/existing");
    const width = page.viewportSize()?.width ?? 1280;
    const label = stepper
      .getByTestId("stepper-business")
      .locator("span[aria-hidden]")
      .last();
    if (width < 640) await expect(label).toBeHidden();
    else await expect(label).toBeVisible();
    await checkWidths(page, "result with the stepper");

    // Tapping a done step is how an answer changes; step 5 keeps its state.
    await stepper
      .getByRole("link", { name: /Step 5, Already have: done/ })
      .click();
    await expect(page).toHaveURL(/\/start\/existing$/);
    await expect(page.getByTestId("progress-line-label")).toHaveText(
      "Step 5 of 6: Already have",
    );
    await expect(stepper.getByTestId("stepper-result")).toHaveAttribute(
      "data-state",
      "todo",
    );
    await page.getByRole("button", { name: "See my result" }).click();

    // "Start again" asks first; Keep leaves everything; Yes clears and goes to the first step.
    await expect(page.getByTestId("clear-draft")).toHaveText("Start again");
    await page.getByTestId("clear-draft").click();
    await expect(page.getByTestId("clear-draft-confirm")).toContainText(
      /Clear your answers and start again/,
    );
    await page.getByRole("button", { name: "Keep" }).click();
    await expect(page.getByTestId("result")).toBeVisible();
    await page.getByTestId("clear-draft").click();
    await page.getByTestId("clear-draft-yes").click();
    await expect(page).toHaveURL(/\/start(\/business)?$/);
  });
});
