import { test, expect, type Page } from "@playwright/test";
import { zoom200NoSidewaysScroll } from "./helpers/a11y";

/**
 * REQ-028 AC-9 (FR-12, D-2811) over the rendered public pages at 360 on
 * `android-small` and 1280 on `desktop-chromium`: no body text in the serif
 * (the serif is h1 to h3 and the wordmark), no readable text under 14 px (a
 * table's `<th>` from `sm` excepted at 12), and every h1, h2 and h3 at the
 * scale's size for the width. Then, at the same width, 200 % text on every
 * page must not scroll sideways (#87 run 1: a long heading word at 64 px
 * widened the registration-groups guide by 2 px); the signed-in pages
 * meet the same check in their own specs on the Supabase job.
 */
const PAGES = [
  "/",
  "/pricing",
  "/start",
  "/sample",
  "/guides",
  "/guides/which-ndis-audit",
  "/guides/registration-groups",
  "/sign-in",
  "/about",
  "/terms",
];

type Finding = { page: string; kind: string; detail: string };

async function readType(page: Page, path: string, lg: boolean) {
  await page.goto(path);
  return page.evaluate(
    ({ path, lg }) => {
      const out: { kind: string; detail: string }[] = [];
      const scale = lg
        ? { H1: 44, H2: 28, H3: 20 }
        : { H1: 32, H2: 24, H3: 19 };
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          cs.visibility !== "hidden" &&
          cs.display !== "none"
        );
      };
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      const seen = new Set<Element>();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent || !n.textContent.trim()) continue;
        const el = n.parentElement;
        if (!el || seen.has(el) || !visible(el)) continue;
        seen.add(el);
        if (el.closest("script, style, noscript, [aria-hidden='true']"))
          continue;
        const cs = getComputedStyle(el);
        const size = parseFloat(cs.fontSize);
        const heading = el.closest("h1, h2, h3");
        const inTable = el.closest("th");
        if (
          /fraunces/i.test(cs.fontFamily) &&
          !heading &&
          !el.closest(".wordmark")
        )
          out.push({
            kind: "serif body text",
            detail: `${el.tagName.toLowerCase()} "${n.textContent.trim().slice(0, 40)}"`,
          });
        const floor = inTable && lg ? 12 : inTable ? 12 : 14;
        if (size < floor - 0.1)
          out.push({
            kind: `text under ${floor} px`,
            detail: `${el.tagName.toLowerCase()} ${size}px "${n.textContent.trim().slice(0, 40)}"`,
          });
      }
      for (const h of document.querySelectorAll<HTMLElement>("h1, h2, h3")) {
        if (!visible(h)) continue;
        const size = parseFloat(getComputedStyle(h).fontSize);
        const want = scale[h.tagName as "H1" | "H2" | "H3"];
        if (Math.abs(size - want) > 0.5)
          out.push({
            kind: `${h.tagName.toLowerCase()} off the scale`,
            detail: `${size}px, the scale says ${want}px: "${h.textContent?.trim().slice(0, 40)}"`,
          });
      }
      return out.map((f) => ({ page: path, ...f }));
    },
    { path, lg },
  );
}

test.describe("REQ-028 AC-9: the type rules", () => {
  test("no serif body text, no readable text under the floor, every heading on the scale", async ({
    page,
  }) => {
    test.slow();
    const lg = (page.viewportSize()?.width ?? 0) >= 1024;
    const findings: Finding[] = [];
    for (const path of PAGES)
      findings.push(...(await readType(page, path, lg)));
    expect(findings.map((f) => `${f.page}: ${f.kind}: ${f.detail}`)).toEqual(
      [],
    );
  });

  test("200% text on every page: no sideways scroll", async ({ page }) => {
    test.slow();
    for (const path of PAGES) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
      await zoom200NoSidewaysScroll(page, path);
    }
  });
});
