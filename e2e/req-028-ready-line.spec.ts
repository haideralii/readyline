import { test, expect, type Page } from "@playwright/test";
import { reachResult } from "./helpers/questionnaire";

/**
 * REQ-028 AC-4's ready-line half (FR-4, D-2803 as amended), on
 * `desktop-chromium` and `android-small`: a result with nothing in place
 * shows a full ochre line and no moss, and the sentence under it is still
 * REQ-025 FR-3's pack sentence. FR-6's two phone exceptions in AC-4 are
 * Session C's; REQ-015 FR-4's fold check keeps its own spec.
 */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(n)
      .trim();
    const el = document.createElement("div");
    el.style.color = v;
    document.body.appendChild(el);
    const rgb = getComputedStyle(el).color;
    el.remove();
    return rgb;
  }, name);
}

test("a result with nothing in place draws a full ochre line under the pack sentence", async ({
  page,
}) => {
  test.slow();
  await reachResult(page);
  await expect(page.getByTestId("result")).toBeVisible();
  const line = page.getByTestId("result-ready-line");
  await expect(line).toBeVisible();
  const ochre = await token(page, "--ochre");
  const todo = page.getByTestId("result-ready-line-todo");
  await expect(todo).toBeAttached();
  expect(await todo.evaluate((el) => getComputedStyle(el).fill)).toBe(ochre);
  expect(await todo.getAttribute("height")).toBe("8");
  // Nothing was answered as already in place, so no moss segment is drawn and the track is not shown.
  await expect(page.getByTestId("result-ready-line-done")).toHaveCount(0);
  await expect(page.getByTestId("result-ready-line-track")).toHaveCount(0);
  await expect(page.getByTestId("result-ready-line-text")).toContainText(
    "Your pack drafts every document below.",
  );
});
