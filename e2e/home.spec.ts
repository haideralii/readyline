import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("renders a heading and the general-information notice", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const notice = page.getByTestId("site-disclaimer");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/general information/i);
    await expect(notice).toContainText(/not legal advice/i);
  });

  test("first Tab lands on the skip link, which targets main content", async ({
    page,
  }) => {
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
