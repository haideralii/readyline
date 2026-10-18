import { test, expect, type Page } from "@playwright/test";
import { fillBusiness } from "./helpers/questionnaire";

/**
 * Live QA pass of release b340ee3, report C, D3 to D6: at 200 % text on a
 * 360 px and a 320 px screen the pricing cards, the stepper's circles, the
 * questionnaire's fieldsets and the supports step's category headings must
 * stay inside the viewport (WCAG 1.4.4 and 1.4.10). A viewport and a root
 * font size, not a device, so one project carries it (D-2825's reasoning).
 */
test.describe("live QA b340ee3: 200 % text on narrow screens", () => {
  test.skip(
    ({ browserName }, testInfo) =>
      testInfo.project.name !== "desktop-chromium" ||
      browserName !== "chromium",
    "one project is enough for a viewport check",
  );

  async function zoomed(page: Page, width: number, path: string) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 740 });
    await page.goto(path);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    // Let layout settle after the font change.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => r(null))),
    );
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth, `${path} at ${width} and 200 %`).toBeLessThanOrEqual(
      width,
    );
  }

  for (const width of [360, 320]) {
    test(`D3: /pricing fits ${width} px at 200 % text`, async ({ page }) => {
      await zoomed(page, width, "/pricing");
      const cards = page.locator(
        "[data-testid='pricing-pack'], [data-testid='pricing-subscription']",
      );
      for (const card of await cards.all()) {
        const box = (await card.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    });

    test(`D4 and D5: /start/business fits ${width} px at 200 % text and the six circles do not overlap`, async ({
      page,
    }) => {
      await zoomed(page, width, "/start/business");
      const circles = page
        .getByTestId("stepper")
        .locator("ol")
        .last()
        .locator("li > a, li > span[aria-current], li > span[aria-disabled]");
      await expect(circles).toHaveCount(6);
      let lastRight = 0;
      for (const c of await circles.all()) {
        const box = (await c.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(lastRight - 1);
        expect(box.width).toBeGreaterThanOrEqual(44);
        lastRight = box.x + box.width;
      }
      expect(lastRight).toBeLessThanOrEqual(width);
    });

    test(`D6: /start/supports fits ${width} px at 200 % text`, async ({
      page,
    }) => {
      // The supports step opens only after a valid business step.
      await page.goto("/start/business");
      await expect(page.locator("fieldset[aria-busy='true']")).toHaveCount(0);
      await fillBusiness(page);
      await expect(page).toHaveURL(/supports$/);
      await zoomed(page, width, "/start/supports");
    });
  }
});
