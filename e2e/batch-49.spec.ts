import { test, expect } from "@playwright/test";
import { axeSerious } from "./helpers/a11y";
import { checkWidths } from "./helpers/width";

/**
 * Batch 49 (the PO's phone walk of production at 360 px): the step heading
 * takes focus without drawing the ring (item 1); the subscription card is a
 * price line, a four-item list and the cancel line (item 2); on a phone a
 * two-line price strip sits above both cards, each line a link to its card,
 * and from 640 px it is not shown (item 3); the structure helper is one
 * plain sentence (item 4); every guide opens with a three-line short answer
 * and a jump list of its headings (item 5).
 */
test.describe("batch 49: five small things from a phone walk", () => {
  test("the step heading takes focus with no ring; the structure helper is one plain sentence", async ({
    page,
  }) => {
    await page.goto("/start/business");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeFocused();
    expect(await h1.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
      "none",
    );
    await expect(
      page.getByText("pick the one on your ABN record"),
    ).toBeVisible();
    await expect(page.getByText(/reduced scope/)).toHaveCount(0);
    // Keyboard users still have their ring everywhere else.
    await page.getByLabel("Trading name").focus();
    await page.keyboard.press("Tab");
    const ringed = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? getComputedStyle(el).outlineStyle : "";
    });
    expect(ringed).not.toBe("none");
  });

  test("the pricing page: the subscription card as a list, and the price strip on phones only", async ({
    page,
  }, testInfo) => {
    await page.goto("/pricing");
    const offer = page.getByTestId("subscription-offer");
    await expect(offer).toContainText(/AUD 39 a month for the registers/);
    const items = page.getByTestId("subscription-includes").locator("li");
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toHaveText("Incident register");
    await expect(items.nth(2)).toHaveText(
      "Worker checks, with expiry reminders",
    );
    await expect(offer).toContainText(
      "Cancel at any time; no notice period, no fee, no instalments, no interest.",
    );
    await expect(
      page.getByText(/improvement row|staff matrix row/),
    ).toHaveCount(0);
    const strip = page.getByTestId("pricing-strip");
    const phone = (page.viewportSize()?.width ?? 1280) < 640;
    if (phone) {
      await expect(strip).toBeVisible();
      await expect(page.getByTestId("pricing-strip-pack")).toHaveText(
        "Document pack: AUD 399, once",
      );
      await expect(page.getByTestId("pricing-strip-registers")).toHaveText(
        "Registers: AUD 39 a month, cancel any time",
      );
      await expect(page.getByTestId("pricing-strip-pack")).toHaveAttribute(
        "href",
        "#start",
      );
      await page.getByTestId("pricing-strip-pack").click();
      await expect(page).toHaveURL(/#start$/);
      await expect(page.getByTestId("pricing-pack")).toBeInViewport();
    } else {
      await expect(strip).toBeHidden();
    }
    await checkWidths(page, `pricing (${testInfo.project.name})`);
    expect(await axeSerious(page, "pricing")).toEqual([]);
  });

  test("every guide opens with a three-line short answer and a jump list that lands on its headings", async ({
    page,
  }) => {
    for (const slug of [
      "which-ndis-audit",
      "ndis-registration-cost",
      "what-happens-at-an-ndis-audit",
      "registers-an-auditor-asks-for",
    ]) {
      await page.goto(`/guides/${slug}`);
      const box = page.getByTestId("guide-short-answer");
      await expect(box.getByRole("heading", { level: 2 })).toHaveText(
        "Short answer",
      );
      await expect(box.locator("li")).toHaveCount(3);
      const jump = page.getByTestId("guide-jump-to");
      const links = jump.getByRole("link");
      expect(await links.count()).toBeGreaterThanOrEqual(5);
      await expect(
        jump.getByRole("link", { name: "Questions people ask" }),
      ).toHaveAttribute("href", "#faq-heading");
      // The first body heading's link lands on a heading with that id.
      const href = (await links.first().getAttribute("href")) ?? "";
      expect(href).toMatch(/^#[a-z0-9-]+$/);
      await expect(page.locator(href)).toHaveCount(1);
      await expect(page.locator(href)).toHaveRole("heading");
    }
    await checkWidths(page, "guide");
    expect(await axeSerious(page, "guide")).toEqual([]);
  });
});
