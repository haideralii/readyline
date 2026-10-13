import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

/**
 * Home page v2 (batch 24) on both projects: the hero asks the audit question
 * and states the price and the refund promise, the two CTAs lead to the
 * questionnaire and the sample, the sample is a real document with its
 * tailored sections marked and a Word download, no counter or testimonial
 * is shown while the trust file is empty, the mission is there, and axe is
 * clean. With EVIDENCE=1, screenshots go to product/evidence/req-013/.
 */
const dir = "product/evidence/req-013";

async function shot(page: Page, name: string, project: string) {
  if (!process.env.EVIDENCE) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}/${name}-${project}.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 40,
    scale: "css",
  });
}

test.describe("home page v2 (batch 24)", () => {
  test("hero: audit question, price, refund promise, two CTAs (item 1)", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toContainText(/which NDIS audit you'll face/);
    // The e2e server runs with PACK_PRICE_AUD_CENTS=39900.
    await expect(h1).toContainText("AUD 399");
    await expect(page.getByTestId("home-cta")).toHaveText(
      "See which audit I need",
    );
    await expect(page.getByTestId("home-cta")).toHaveAttribute(
      "href",
      "/start",
    );
    await expect(page.getByTestId("home-cta-sample")).toHaveAttribute(
      "href",
      "#sample",
    );
    await expect(page.getByTestId("home-price-line")).toContainText(
      /No subscription needed, no instalments, no interest/,
    );
    await expect(page.getByTestId("home-price-line")).toContainText(
      /Full refund within 14 days/,
    );
    await expect(page.getByTestId("home-free-line")).toContainText(/Free/);
    // Batch 26 item 5: the three-line hero paragraph.
    await expect(page.getByTestId("home-hero")).toContainText(
      /which audit you face, with the Commission's text behind it/,
    );
    // Batch 26 item 6: the badge shows off production (every e2e run); the
    // smoke test asserts its absence on the deployed site.
    await expect(page.getByTestId("dev-badge")).toHaveText("In development");
    await shot(page, "home-v2", testInfo.project.name);
  });

  test("sample: a real document with tailored sections marked and a Word download (item 2)", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await page.getByTestId("home-cta-sample").click();
    const sample = page.getByTestId("sample-document");
    await expect(sample).toBeVisible();
    await expect(sample).toContainText("Example Supports");
    await expect(sample).not.toContainText("Sunrise Supports");
    const tailored = sample.locator('[data-mode="tailored"]');
    expect(await tailored.count()).toBeGreaterThanOrEqual(4);
    await expect(tailored.first()).toBeVisible();
    await expect(tailored.first()).toContainText("Drafted from the answers");
    expect(await sample.locator('[data-mode="fixed"]').count()).toBeGreaterThan(
      0,
    );
    // The later sections are folded until asked for, so the page stays short on a phone.
    const procedure = sample.getByTestId("sample-section-procedure");
    await expect(procedure).toBeHidden();
    await page.getByTestId("sample-more").click();
    await expect(procedure).toBeVisible();
    const docx = await request.get("/sample/complaints-policy.docx");
    expect(docx.status()).toBe(200);
    expect(docx.headers()["content-type"]).toContain("wordprocessingml");
    expect(docx.headers()["content-disposition"]).toContain(".docx");
    const bytes = await docx.body();
    // A .docx is a zip: "PK" at the start.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.length).toBeGreaterThan(5_000);
    const bad = await request.get("/sample/complaints-policy.docx?x=1");
    expect(bad.status()).toBe(400);
  });

  test("mission present; no counter or testimonial while the trust file is empty (items 3, 4); axe clean", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-mission")).toContainText(
      /one person in Sydney/,
    );
    await expect(page.getByTestId("trust-counters")).toHaveCount(0);
    await expect(page.getByTestId("testimonials")).toHaveCount(0);
    await expect(page.getByText(/providers helped/)).toHaveCount(0);
    await page.waitForFunction(() => document.title.length > 0);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
    ).toEqual([]);
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
