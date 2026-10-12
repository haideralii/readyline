import { expect, type Page } from "@playwright/test";

/**
 * Ticks a registration-group checkbox on the supports step. Since REQ-013
 * FR-11 the everyday headings are collapsible (a React-controlled button
 * disclosure) and start closed on phones, so the heading is opened first
 * when it is shut. A tap before hydration does nothing, so the tap is
 * repeated until the heading reports open.
 */
/** Opens every collapsed heading so every class checkbox is in the DOM (used by the accessibility-tree audit). */
export async function openAllGroups(page: Page) {
  const closed = page.locator('[data-open="false"][data-codes]');
  for (let attempt = 0; attempt < 10 && (await closed.count()) > 0; attempt++) {
    await closed.first().getByRole("button").first().click();
    await page.waitForTimeout(100);
  }
  await expect(closed).toHaveCount(0);
}

export async function tickGroup(page: Page, code: string, on = true) {
  const box = page.locator(`#group-${code}`);
  const heading = page.locator(`[data-open][data-codes~="${code}"]`);
  await expect(heading).toHaveCount(1);
  for (let attempt = 0; attempt < 5; attempt++) {
    if ((await heading.getAttribute("data-open")) === "true") break;
    await heading.getByRole("button").first().click();
    try {
      await expect(heading).toHaveAttribute("data-open", "true", {
        timeout: 1500,
      });
    } catch {
      // Before hydration the tap is a no-op; try again.
    }
  }
  await expect(heading).toHaveAttribute("data-open", "true");
  if (on) await box.check();
  else await box.uncheck();
}
