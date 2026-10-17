import { test, expect, type Page } from "@playwright/test";

/**
 * REQ-028 AC-3 (FR-3) on step 1 of the questionnaire, at 360 on
 * `android-small` and 1280 on `desktop-chromium`: a checked radio and
 * checkbox read the ochre `accent-color` and their row's background is
 * sky; an input focused by keyboard shows the ochre ring; a field's error,
 * its summary entry and `aria-invalid` are gone once the field is
 * corrected, before the next submit. Colours are read from the tokens on
 * `:root`, never typed into the test.
 */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(n)
      .trim();
    // Normalise a hex token to the rgb() form computed styles report.
    const el = document.createElement("div");
    el.style.color = v;
    document.body.appendChild(el);
    const rgb = getComputedStyle(el).color;
    el.remove();
    return rgb;
  }, name);
}

test.describe("REQ-028 AC-3: the form controls", () => {
  test("a checked choice reads the ochre accent on a sky row; focus shows the ochre ring", async ({
    page,
  }) => {
    await page.goto("/start/business");
    await expect(
      page.getByRole("heading", { level: 1, name: "About your business" }),
    ).toBeVisible();
    const ochre = await token(page, "--ochre");
    const sky = await token(page, "--sky");

    const radio = page.getByRole("radio", { name: "Sole trader" });
    await radio.check();
    expect(await radio.evaluate((el) => getComputedStyle(el).accentColor)).toBe(
      ochre,
    );
    const radioRow = radio.locator("xpath=ancestor::label[1]");
    expect(
      await radioRow.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(sky);

    const nsw = page.getByRole("checkbox", { name: "NSW" });
    await nsw.check();
    expect(await nsw.evaluate((el) => getComputedStyle(el).accentColor)).toBe(
      ochre,
    );
    const nswRow = nsw.locator("xpath=ancestor::label[1]");
    expect(
      await nswRow.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(sky);
    const vic = page.getByRole("checkbox", { name: "VIC" });
    expect(
      await vic
        .locator("xpath=ancestor::label[1]")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).not.toBe(sky);

    // Keyboard focus: the global ring, in ochre, on a text input.
    const name = page.getByLabel("Trading name");
    await name.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(name).toBeFocused();
    const outline = await name.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        color: s.outlineColor,
        style: s.outlineStyle,
        width: s.outlineWidth,
      };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
    expect(outline.color).toBe(ochre);
  });

  test("a corrected field's message, summary entry and aria-invalid are gone before the next submit", async ({
    page,
  }) => {
    await page.goto("/start/business");
    const name = page.getByLabel("Trading name");
    await expect(name).toBeVisible();
    await page.getByRole("button", { name: "Save and continue" }).click();
    // The page carries a second live region (the participant-data warning), so the summary is the alert with its heading.
    const summary = page
      .getByRole("alert")
      .filter({ hasText: "Please fix the following" });
    await expect(summary).toContainText("Trading name");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#tradingName-error")).toBeVisible();

    await name.fill("Sunrise Supports");
    await expect(name).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#tradingName-error")).toHaveCount(0);
    await expect(summary).not.toContainText("Trading name");
    // The other errors stay until their fields are corrected.
    await expect(summary).toContainText("States and territories");
  });
});
