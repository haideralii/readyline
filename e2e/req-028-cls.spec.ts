import { test, expect, type Page } from "@playwright/test";
import { tickGroup } from "./helpers/groups";

/**
 * REQ-028 AC-10, the result page's CLS (D-2821's note; the `req-028-cls`
 * branch): the result view mounts on the client after the draft is read,
 * and before this branch the footer moved down when the page's content
 * appeared (0.51 before Session C, 0.54 after, measured by this probe).
 * The loading state now reserves a viewport's height, so nothing visible
 * moves when the view arrives. The cumulative layout shift over the first
 * two seconds after load is read from the browser's layout-shift entries
 * and held under 0.1 on the result, the supports step and the home page,
 * at 1280 on `desktop-chromium` and 360 on `android-small`.
 */
async function cls(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let sum = 0;
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          })[])
            if (!e.hadRecentInput) sum += e.value ?? 0;
        });
        obs.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          obs.disconnect();
          resolve(Math.round(sum * 1000) / 1000);
        }, 2000);
      }),
  );
}

test.describe("REQ-028 AC-10: the result page's cumulative layout shift", () => {
  test("the result, the supports step and the home page shift by less than 0.1 after load", async ({
    page,
  }) => {
    await page.goto("/start/business");
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.waitForURL(/\/start\/supports$/);
    await page.reload();
    const supports = await cls(page);
    await tickGroup(page, "0107");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.locator("#restrictivePractices-no").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.getByLabel("Number of workers").fill("3");
    await page.locator("#allRiskAssessedScreened-yes").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    for (const key of [
      "policies",
      "incidentRegister",
      "complaintsRegister",
      "insuranceCertificate",
      "workerInductionRecords",
    ])
      await page.locator(`#${key}-no`).check();
    await page.getByRole("button", { name: "See my result" }).click();
    await page.waitForURL(/\/start\/result$/);
    await page.reload();
    await page.getByTestId("result").waitFor();
    const result = await cls(page);
    await page.goto("/");
    const home = await cls(page);
    expect(result, "the result page").toBeLessThan(0.1);
    expect(supports, "the supports step").toBeLessThan(0.1);
    expect(home, "the home page").toBeLessThan(0.1);
  });
});
