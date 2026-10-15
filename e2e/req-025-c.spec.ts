import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * REQ-025 Session C, FR-12: the home page's height at 360 px, measured as
 * the document's scrollHeight (review decision 6), recorded under
 * product/evidence/req-025/ with EVIDENCE=1 (EVIDENCE_TAG names the set),
 * and held under 5,000 px once the sample has its own page. The phone
 * project is the one that measures; desktop records its figure only.
 */
const DIR = "product/evidence/req-025";
const LIMIT = 5_000;

test("the home page's height at 360 px stays under the limit (FR-12)", async ({
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
  if (width <= 400 && !process.env.EVIDENCE_TAG?.startsWith("before"))
    expect(height, `home at ${width} px`).toBeLessThan(LIMIT);
});
