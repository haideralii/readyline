import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

/**
 * REQ-025 Session C, FR-12: the home page's height at 360 px, measured as
 * the document's scrollHeight (review decision 6), held under 5,000 px once
 * the sample has its own page. The phone project is the one that measures;
 * desktop records its figure only.
 *
 * REQ-028 AC-8 (first pass 5; second pass 41; third pass 47): the figure is
 * recorded under product/evidence/req-028/ with EVIDENCE=1 (EVIDENCE_TAG
 * names the set), and Session C's layout may raise it by the price strip's
 * two stacked cells and the h1's two pixels only: at 360 the height is held
 * to the baseline plus 160 px, the baseline being the file this spec's own
 * `EVIDENCE=1 EVIDENCE_TAG=before` run wrote from `next` in C's first
 * commit, with the 5,000 px cap still the ceiling.
 */
const DIR = "product/evidence/req-028";
const BASELINE = `${DIR}/home-height-before-android-small.json`;
const LIMIT = 5_000;
/** The strip's two stacked cells (two 16 px lines with their padding) and the h1's two pixels. */
const ALLOWANCE = 160;

test("the home page's height at 360 px stays under the limit and within the allowance over the baseline (FR-12, AC-8)", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.waitForFunction(() => document.title.length > 0);
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const width = page.viewportSize()?.width ?? 0;
  if (process.env.EVIDENCE) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(
      `${DIR}/home-height-${process.env.EVIDENCE_TAG ?? "after"}-${testInfo.project.name}.json`,
      JSON.stringify({ width, height, measuredAt: new Date().toISOString() }),
    );
  }
  if (width > 400 || process.env.EVIDENCE_TAG?.startsWith("before")) return;
  expect(height, `home at ${width} px`).toBeLessThan(LIMIT);
  if (existsSync(BASELINE)) {
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as {
      height: number;
    };
    expect(
      height,
      `home at ${width} px against the baseline ${baseline.height} from next`,
    ).toBeLessThanOrEqual(baseline.height + ALLOWANCE);
  }
});
