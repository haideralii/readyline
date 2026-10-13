import type { Page } from "@playwright/test";

/**
 * REQ-015 Section B folded the result page: everything below the answer
 * card sits in closed disclosures. Specs that assert on modules, reasons,
 * document groups or registers open them first.
 */
export async function openResultSections(page: Page) {
  const result = page.getByTestId("result");
  for (let pass = 0; pass < 3; pass += 1) {
    const closed = result.locator("details:not([open]) > summary");
    const count = await closed.count();
    if (count === 0) return;
    for (let i = 0; i < count; i += 1) {
      const s = result.locator("details:not([open]) > summary").first();
      if ((await s.count()) === 0) break;
      await s.click();
    }
  }
}
