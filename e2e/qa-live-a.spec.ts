import { test, expect, type Page } from "@playwright/test";
import { reachResult } from "./helpers/questionnaire";

/**
 * Live QA pass of release b340ee3 (product/qa/live-tests/2026-10-18-b340ee3,
 * report C), the keyboard and focus defects and the copy items on the
 * questionnaire and the result, on the three projects. Public: nothing here
 * signs in.
 */
async function formLive(page: Page) {
  // The step's form is in the first HTML inside a disabled fieldset until the draft is read (D-1012).
  await expect(page.locator("fieldset[aria-busy='true']")).toHaveCount(0);
  await expect(page.getByLabel("Trading name")).toBeEnabled();
}

test.describe("live QA b340ee3: the questionnaire's focus and words", () => {
  test("D1: after an empty submit the summary takes focus once, and typing into a field keeps the field and the whole value", async ({
    page,
  }) => {
    await page.goto("/start/business");
    await formLive(page);
    await page.getByRole("button", { name: "Save and continue" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "Please fix" });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    // Enter on the summary's first link lands in the field (the row C-keyboard 66 drove).
    await alert.getByRole("link", { name: /Trading name/ }).click();
    const field = page.getByLabel("Trading name");
    await expect(field).toBeFocused();
    // A tap on the field as well (report C's mouse case): WebKit's phone emulation drops keystrokes into a field
    // that only a fragment navigation focused, and the point here is what happens while typing.
    await field.click();
    await field.pressSequentially("Sunrise Supports", { delay: 40 });
    await expect(field).toHaveValue("Sunrise Supports");
    await expect(field).toBeFocused();
    // The summary lost that entry and did not take focus back.
    await expect(alert.getByRole("link", { name: /Trading name/ })).toHaveCount(
      0,
    );
    // A radio arrow does not move focus either (row 68).
    const partnership = page.getByRole("radio", { name: /Partnership/ });
    await page.getByRole("radio", { name: /Sole trader/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(partnership).toBeChecked();
    await expect(partnership).toBeFocused();
    // A second empty-field submit focuses the summary again: it is the submit, not the count, that moves focus.
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(alert).toBeFocused();
  });

  test("D2: Start again, then Keep, and focus is back on the Start again button", async ({
    page,
  }) => {
    await reachResult(page);
    const startAgain = page.getByTestId("clear-draft");
    await startAgain.focus();
    await page.keyboard.press("Enter");
    const keep = page.getByRole("button", { name: "Keep" });
    await expect(keep).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("clear-draft")).toBeFocused();
    await expect(page.getByTestId("clear-draft-confirm")).toHaveCount(0);
  });

  test("D7: every source link on the result says it opens a new tab, in its own name", async ({
    page,
  }) => {
    await reachResult(page);
    // reachResult opens every result section, at every width.
    const why = page.getByTestId("result-section-why");
    const links = why.getByTestId("reason").getByRole("link");
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) {
      await expect(link).toContainText("(opens in a new tab)");
      await expect(link).toHaveAttribute("target", "_blank");
    }
  });

  test("the result's pack sentence, the way back from a step, the cleared open-sections key, and the pack card's heading", async ({
    page,
  }) => {
    await reachResult(page);
    const whatNext = page.getByTestId("what-next");
    await expect(whatNext).toContainText("if you already bought the pack");
    await expect(whatNext).not.toContainText("already have one");
    // The way back to the result from a step while one exists.
    await page.getByTestId("change-answers").click();
    await expect(page).toHaveURL(/\/start\/business$/);
    const back = page.getByTestId("back-to-result");
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/start\/result$/);
    // "Start again" clears the open-sections memory with the draft.
    await page.evaluate(() =>
      localStorage.setItem("readyline.result.open", JSON.stringify(["why"])),
    );
    await page.getByTestId("clear-draft").click();
    await page.getByTestId("clear-draft-yes").click();
    await expect(page).toHaveURL(/\/start$/);
    expect(
      await page.evaluate(() => localStorage.getItem("readyline.result.open")),
    ).toBeNull();
    // A fresh visitor with no result sees no way back.
    await page.goto("/start/business");
    await formLive(page);
    await expect(page.getByTestId("back-to-result")).toHaveCount(0);
    // The pack card is named for what it is.
    await page.goto("/pricing");
    await expect(
      page.getByTestId("pricing-pack").getByRole("heading", { level: 2 }),
    ).toHaveText("Document pack");
  });
});
