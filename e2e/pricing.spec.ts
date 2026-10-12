import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

/**
 * REQ-007 Session A, both projects: the pricing page works signed out with
 * the price from configuration, the refund promise, the AI disclosure, the
 * not-legal-advice line and the legal links, is axe clean and fits 360 px.
 * With EVIDENCE=1 a full-page screenshot goes to product/evidence/req-007/.
 */
const EVIDENCE_DIR = "product/evidence/req-007";

test.describe("pricing page (REQ-007 FR-1, AC-4)", () => {
  test("renders signed out with price, promise, disclosures and links", async ({
    page,
  }, testInfo) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your document pack" }),
    ).toBeVisible();
    // The e2e server runs with PACK_PRICE_AUD_CENTS=39900 and a GST line (playwright.config).
    await expect(page.getByTestId("pack-price")).toHaveText("AUD 399");
    await expect(page.getByTestId("gst-line")).toContainText(/GST/);
    await expect(page.getByTestId("refund-promise")).toContainText(
      "full refund within 14 days",
    );
    await expect(page.getByTestId("pricing-ai-disclosure")).toContainText(
      /generated with AI/,
    );
    await expect(page.getByTestId("pricing-notice")).toContainText(
      /not legal advice/,
    );
    await expect(page.getByTestId("subscription-coming")).toContainText(
      /Coming after the document pack/,
    );
    for (const [name, href] of [
      ["Terms of use", "/terms"],
      ["Privacy policy", "/privacy"],
      ["Refunds page", "/refunds"],
    ] as const) {
      await expect(page.getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
    await expect(page.getByTestId("sign-in-to-buy")).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fpricing",
    );
    await expect(
      page.getByTestId("pack-documents").locator("li").first(),
    ).toBeVisible();
    await expect(page.getByText(/limited time|only \d+ left/i)).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);

    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
    ).toEqual([]);

    if (process.env.EVIDENCE) {
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      await page.screenshot({
        path: `${EVIDENCE_DIR}/pricing-${testInfo.project.name}.jpg`,
        fullPage: true,
        type: "jpeg",
        quality: 40,
        scale: "css",
      });
    }
  });
});
