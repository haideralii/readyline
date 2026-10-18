import { test, expect } from "@playwright/test";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import { RESULT_SCOPE_SENTENCE } from "@/lib/questionnaire/result-text";
import { openResultSections } from "./helpers/result";
import { reachResult } from "./helpers/questionnaire";

/**
 * REQ-031 FR-2 (AC-5, AC-6; D-2887, D-2895): "Print or save as PDF" calls the
 * browser's print once; in print the result is one A4 page carrying the
 * audit kind, the scope sentence, the groups, the counts, the modules, the
 * reasons' short source names, the general-information line and the closing
 * line with today's date, with the stepper, every button and link, the
 * header, the nav and the footer hidden, and every text node of the print
 * view also on the screen. The measurement and the page count run on
 * desktop (question 3 (b) and (c)); the hidden shell is checked on both.
 */
const A4_HEIGHT_PX = 1123;
const MARGIN_PX = 38; // 10 mm at 96 dpi, top and bottom (question 3 (b)).

test.describe("REQ-031: print or save as PDF", () => {
  test("AC-6: the print button runs the browser's print once", async ({
    page,
  }) => {
    await reachResult(page);
    await page.evaluate(() => {
      const w = window as unknown as { __prints: number; print: () => void };
      w.__prints = 0;
      w.print = () => {
        w.__prints += 1;
      };
    });
    await page.getByTestId("result-print-button").click();
    expect(
      await page.evaluate(
        () => (window as unknown as { __prints: number }).__prints,
      ),
    ).toBe(1);
  });

  test("AC-5: in print the result is one page of the screen's own words, with the shell hidden", async ({
    page,
  }, testInfo) => {
    await reachResult(page);
    await openResultSections(page);
    const screenText = (await page.getByTestId("result").innerText()).replace(
      /\s+/g,
      " ",
    );
    const today = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

    if (testInfo.project.name === "desktop-chromium")
      await page.setViewportSize({ width: 794, height: 1123 });
    await page.emulateMedia({ media: "print" });
    const print = page.getByTestId("result-print");
    await expect(print).toBeVisible();
    // The shell: the stepper, the header, the nav, the footer, every button and link.
    await expect(page.locator("header")).toBeHidden();
    await expect(page.locator("footer")).toBeHidden();
    await expect(page.getByTestId("summary")).toBeHidden();
    await expect(page.getByTestId("result-email-form")).toBeHidden();
    expect(await page.locator("nav:visible").count()).toBe(0);
    expect(await page.locator("a:visible, button:visible").count()).toBe(0);
    // The words.
    const printText = (await print.innerText()).replace(/\s+/g, " ");
    expect(printText).toMatch(/Your audit: (verification|certification)/);
    expect(printText).toContain(RESULT_SCOPE_SENTENCE);
    expect(printText).toMatch(/Documents: \d+/);
    expect(printText).toMatch(/Registers: \d+/);
    expect(printText).toMatch(/Checklist: \d+ items/);
    expect(printText).toContain("Practice Standards modules that apply");
    expect(printText).toContain("Mid-term audit");
    expect(printText).toContain("Why this result");
    expect(printText).toContain(GENERAL_INFORMATION_STATEMENT);
    expect(printText).toContain(
      `Prepared by Readyline from your answers on ${today}`,
    );
    // D-2887: every text node of the print view is on the screen.
    const nodes = await print.evaluate((el) => {
      const out: string[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const s = (n.textContent ?? "").replace(/\s+/g, " ").trim();
        if (s) out.push(s);
      }
      return out;
    });
    expect(nodes.length).toBeGreaterThan(10);
    for (const node of nodes) expect(screenText, node).toContain(node);

    if (testInfo.project.name === "desktop-chromium") {
      // Question 3 (b): within one A4 page at 96 dpi with 10 mm top and bottom margins.
      const height = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      expect(height).toBeLessThanOrEqual(A4_HEIGHT_PX - 2 * MARGIN_PX);
      // Question 3 (c): the PDF the browser makes has one page.
      const pdf = await page.pdf({ format: "A4" });
      const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [])
        .length;
      expect(pages).toBe(1);
      testInfo.annotations.push({
        type: "print",
        description: `height ${height} px, ${pages} page`,
      });
    }
  });
});
