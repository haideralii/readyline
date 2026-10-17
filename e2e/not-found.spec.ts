import { test, expect } from "@playwright/test";

/**
 * Batch 47 item 8: an unknown path answers 404 inside the site shell, says
 * one sentence, and offers the two places a visitor most likely wanted; the
 * footer with the legal links is there as everywhere.
 */
test.describe("the 404 page", () => {
  test("an unknown path is a 404 with the shell, the sentence and the two links", async ({
    page,
  }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    // QA pass F9 (WCAG 2.4.2): its own title, through the layout's template.
    await expect(page).toHaveTitle(/^Page not found \| /);
    await expect(
      page.getByRole("heading", { level: 1, name: "That page is not here." }),
    ).toBeVisible();
    const links = page.getByTestId("not-found-links");
    await expect(
      links.getByRole("link", { name: "Start the questions" }),
    ).toHaveAttribute("href", "/start");
    await expect(
      links.getByRole("link", { name: "Read the guides" }),
    ).toHaveAttribute("href", "/guides");
    await expect(page.getByTestId("footer-nav")).toBeVisible();
    await expect(page.getByTestId("site-disclaimer")).toContainText(
      /not legal advice/i,
    );
  });
});
