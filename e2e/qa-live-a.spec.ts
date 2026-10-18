import { test, expect, type Page } from "@playwright/test";

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
});
