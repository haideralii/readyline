import { test, expect, type Page } from "@playwright/test";

/**
 * REQ-028 AC-1 (FR-1): one container for the header, the strip, `main` and
 * the footer, so on a laptop their left edges agree and their widths are the
 * shell's; the h1 sits at the same x on the home page and the pricing page.
 * Measured at 1280 and, by `setViewportSize`, at 1536 on `desktop-chromium`;
 * the Android project is one column and measures nothing here.
 */
async function edges(page: Page) {
  const boxes = await page.evaluate(() => {
    const out: Record<string, { left: number; width: number }> = {};
    for (const el of document.querySelectorAll<HTMLElement>("[data-shell]")) {
      const r = el.getBoundingClientRect();
      const name = el.dataset.shell!;
      if (!(name in out)) out[name] = { left: r.left, width: r.width };
    }
    return out;
  });
  return boxes;
}

test.describe("REQ-028 AC-1: the shell", () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 1024,
    "the shell's columns begin at lg",
  );

  for (const width of [1280, 1536]) {
    test(`at ${width}: the header, main and the footer share a left edge and a width`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/pricing");
      const boxes = await edges(page);
      expect(Object.keys(boxes).sort()).toEqual(
        expect.arrayContaining(["footer", "header", "page"]),
      );
      const names = Object.keys(boxes);
      const lefts = new Set(names.map((n) => Math.round(boxes[n].left)));
      const widths = new Set(names.map((n) => Math.round(boxes[n].width)));
      expect([...lefts], `left edges ${JSON.stringify(boxes)}`).toHaveLength(1);
      expect([...widths], `widths ${JSON.stringify(boxes)}`).toHaveLength(1);
      // 1152 px of content at 1216 px and above: max-w-6xl less the lg padding.
      expect(boxes.page.width).toBeLessThanOrEqual(1152 + 64);
    });
  }

  test("the h1 sits at the same x on the home page and the pricing page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const x = async (path: string) => {
      await page.goto(path);
      return Math.round(
        (await page.getByRole("heading", { level: 1 }).first().boundingBox())
          ?.x ?? -1,
      );
    };
    const home = await x("/");
    const pricing = await x("/pricing");
    expect(home).toBeGreaterThan(0);
    expect(pricing).toBe(home);
  });
});
