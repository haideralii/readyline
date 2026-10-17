import { test, expect } from "@playwright/test";
import { glossaryOnPage } from "./helpers/glossary";

test.describe("home page", () => {
  test("renders a heading and the general-information notice", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // REQ-027 AC-3: every glossary word on the page has its meaning on the page.
    await glossaryOnPage(page, { label: "home" });
    const notice = page.getByTestId("site-disclaimer");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/general information/i);
    await expect(notice).toContainText(/not legal advice/i);
  });

  test("first Tab lands on the skip link, which targets main content", async ({
    page,
    browserName,
  }) => {
    // Headless WebKit does not move keyboard focus onto links at all (Safari's
    // "Press Tab to highlight each item" is off); the skip link is checked on Chromium.
    test.skip(browserName === "webkit", "WebKit does not tab to links");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: /skip to main content/i });
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute("href", "#main-content");
    await expect(page.locator("#main-content")).toHaveCount(1);
  });

  test("does not overflow horizontally", async ({ page }) => {
    await page.goto("/");
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
