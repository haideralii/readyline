import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoSettled } from "./helpers/a11y";
import { setTextZoom } from "./helpers/width";
import {
  A11Y_RULINGS,
  A11Y_TAGS,
  A11Y_WIDTHS,
  SCHEMES,
  violationLines,
} from "./helpers/launch-review-a11y";

/**
 * REQ-012 FR-3a (AC-7; D-2912): axe at WCAG 2.2 AA over every public route,
 * at 360, 768 and 1280 px, at 200 % text, in both colour schemes: zero
 * violations of any impact, or each ruled by rule id in A11Y_RULINGS with a
 * reason. The routes come from the site's own sitemap so a new page is in
 * the sweep the day it is published; the 38 registration-group pages share
 * one template, so two of them take the full matrix and the rest one pass
 * at 360 px (the phone, where a template breaks first). On the phone
 * projects the matrix is the project's own width, both schemes and 200 %
 * text; the desktop project carries the three widths. Every violation of
 * the whole sweep is collected and reported once at the end, so one run
 * reads as the full list; the list is attached whatever the outcome. The
 * signed-in routes are in e2e/signed-in/launch-review-a11y.spec.ts.
 */

async function sitemapPaths(page: Page): Promise<string[]> {
  const res = await page.request.get("/sitemap.xml");
  expect(res.status(), "/sitemap.xml").toBe(200);
  const xml = await res.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1]).pathname.replace(/\/$/, "") || "/",
  );
  expect(paths.length).toBeGreaterThan(40);
  return [...new Set(paths)];
}

/** The public pages the sitemap leaves out on purpose but a visitor can reach. */
const ALSO = ["/sign-in", "/about", "/privacy", "/terms", "/refunds", "/ai"];

/** The 404 page is a public page too; it answers 404 by design. */
const NOT_FOUND = "/this-page-does-not-exist";

type Sweep = { lines: string[]; problems: string[] };

async function visit(page: Page, path: string) {
  if (path === NOT_FOUND) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await page.waitForLoadState("domcontentloaded");
    return;
  }
  await gotoSettled(page, path);
}

async function axe(page: Page, label: string, sweep: Sweep) {
  const results = await new AxeBuilder({ page })
    .withTags([...A11Y_TAGS])
    .analyze();
  const unruled = results.violations.filter((v) => !(v.id in A11Y_RULINGS));
  for (const line of violationLines(unruled))
    sweep.problems.push(`${label}: ${line}`);
  const ids = results.violations.map((v) => v.id);
  sweep.lines.push(`${label}: ${ids.length ? ids.join(",") : "clean"}`);
}

async function matrix(
  page: Page,
  path: string,
  widths: readonly number[],
  sweep: Sweep,
) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page, path);
      await axe(page, `${path} @${width} ${scheme}`, sweep);
      if (width === widths[0]) {
        await setTextZoom(page, 200);
        await axe(page, `${path} @${width} ${scheme} text 200%`, sweep);
        await setTextZoom(page, null);
      }
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
}

test.describe("launch review: axe at WCAG 2.2 AA on every public route (REQ-012 FR-3a, AC-7)", () => {
  test.describe.configure({ timeout: 900_000 });

  test("every public route, three widths, both schemes, 200 % text", async ({
    page,
  }, testInfo) => {
    const sweep: Sweep = { lines: [], problems: [] };
    const projectWidth = testInfo.project.use.viewport?.width ?? 1280;
    const widths =
      testInfo.project.name === "desktop-chromium"
        ? A11Y_WIDTHS
        : [projectWidth];
    const header: string[] = [];
    try {
      const fromSitemap = await sitemapPaths(page);
      const groupPages = fromSitemap.filter((p) =>
        /^\/guides\/registration-groups\/.+/.test(p),
      );
      const full = [
        ...fromSitemap.filter((p) => !groupPages.includes(p)),
        ...groupPages.slice(0, 2),
        ...ALSO,
        NOT_FOUND,
      ];
      header.push(
        `WCAG 2.2 AA (tags ${A11Y_TAGS.join(", ")}); project ${testInfo.project.name}; widths ${widths.join("/")}`,
        `routes in the full matrix: ${full.length}; group pages at 360 px only: ${groupPages.slice(2).length}`,
        `rulings: ${
          Object.keys(A11Y_RULINGS).length
            ? Object.entries(A11Y_RULINGS)
                .map(([k, v]) => `${k} (${v})`)
                .join("; ")
            : "none"
        }`,
      );
      for (const path of full) await matrix(page, path, widths, sweep);

      // The other group pages: one pass each at the phone width, light scheme.
      await page.setViewportSize({ width: 360, height: 800 });
      for (const path of groupPages.slice(2)) {
        await visit(page, path);
        await axe(page, `${path} @360 light`, sweep);
      }
    } finally {
      await testInfo.attach("axe-public.txt", {
        body: [...header, ...sweep.lines, "", ...sweep.problems].join("\n"),
        contentType: "text/plain",
      });
    }
    expect(
      sweep.problems,
      "axe violations at WCAG 2.2 AA not ruled by rule id (route @width scheme: impact: rule help (targets))",
    ).toEqual([]);
  });
});
