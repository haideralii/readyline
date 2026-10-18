import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { glossaryOnPage } from "./helpers/glossary";
import { checkTables, checkWidths } from "./helpers/width";

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
    // REQ-025 FR-12: the sample has its own page; the hero button and the card point at it.
    await expect(page.getByTestId("home-cta-sample")).toHaveAttribute(
      "href",
      "/sample",
    );
    await expect(page.getByTestId("home-sample-card")).toContainText(
      /\d+ of \d+ sections drafted from the answers/,
    );
    await expect(page.getByTestId("home-sample-read")).toHaveAttribute(
      "href",
      "/sample",
    );
    await expect(page.getByTestId("sample-document")).toHaveCount(0);
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
    // smoke test asserts its absence on the deployed site. Batch 47 item 9:
    // against a deployment (an https base) the badge is absent by design.
    // REQ-028 FR-15 (audit 57): one badge is visible at a time, the header's
    // from lg and the footer's under it.
    if (/^https:/.test(process.env.PLAYWRIGHT_BASE_URL ?? "")) {
      await expect(page.getByTestId("dev-badge")).toHaveCount(0);
      await expect(page.getByTestId("dev-badge-footer")).toHaveCount(0);
    } else {
      const large = (page.viewportSize()?.width ?? 0) >= 1024;
      await expect(page.getByTestId("dev-badge")).toHaveText("In development");
      await expect(page.getByTestId("dev-badge")).toBeVisible({
        visible: large,
      });
      await expect(page.getByTestId("dev-badge-footer")).toBeVisible({
        visible: !large,
      });
    }
    await shot(page, "home-v2", testInfo.project.name);
  });

  test("sample: a real document with tailored sections marked and a Word download (item 2)", async ({
    page,
    request,
  }, testInfo) => {
    await page.goto("/");
    await page.getByTestId("home-cta-sample").click();
    await expect(page).toHaveURL(/\/sample$/);
    const sample = page.getByTestId("sample-document");
    await expect(sample).toBeVisible();
    // REQ-027 AC-3 (D-2715, D-2719): the one-term page, its bracket with the attribution title.
    await glossaryOnPage(page, { label: "sample" });
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
    // REQ-013 batch 36 item 1: tables stack on phones and never split a word.
    expect(await sample.getByTestId("data-table").count()).toBeGreaterThan(0);
    await checkTables(page, "sample document");
    await shot(page, "sample-table", testInfo.project.name);
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

  test("REQ-031 AC-8: the Start here sheet for the fictional sole trader sits under the sample, every line to do, with no link into an account", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await page.getByTestId("home-cta-sample").click();
    await expect(page).toHaveURL(/\/sample$/);
    const block = page.getByTestId("sample-start-here");
    await expect(block).toBeVisible();
    // D-2896: the line above the sheet names the fictional provider.
    await expect(page.getByTestId("sample-start-here-line")).toHaveText(
      "This is the sheet you get with your documents, shown for Sunrise Supports, a fictional sole trader.",
    );
    await expect(block).toContainText("Start here: Sunrise Supports");
    // Under the document and above "See which audit I need".
    const docBox = (await page.getByTestId("sample-document").boundingBox())!;
    const blockBox = (await block.boundingBox())!;
    const ctaBox = (await page.getByTestId("sample-cta").boundingBox())!;
    expect(blockBox.y).toBeGreaterThanOrEqual(docBox.y + docBox.height);
    expect(ctaBox.y).toBeGreaterThanOrEqual(blockBox.y + blockBox.height);
    // The REQ-026 page's headings, in order.
    expect(
      await block.getByRole("heading", { level: 3 }).allTextContents(),
    ).toEqual([
      "1. Your pack in one minute",
      "2. Do these first",
      "3. For each document",
      "4. Registers",
      "5. When you are done",
    ]);
    await expect(block.getByTestId("sheet-next").locator("li")).toHaveCount(3);
    await expect(block.getByTestId("sheet-next")).toContainText(
      "Check your systems before the audit",
    );
    // Every line to do, no tick, and no link into an account.
    const lines = block.locator("[data-done]");
    expect(await lines.count()).toBeGreaterThan(10);
    expect(await block.locator('[data-done="true"]').count()).toBe(0);
    await expect(block).not.toContainText("☑");
    expect(
      await block
        .locator(
          'a[href^="/documents"], a[href^="/checklist"], a[href^="/path"]',
        )
        .count(),
    ).toBe(0);
    expect(await block.getByTestId("start-here-download").count()).toBe(0);
    // The sheet's words are in the page's one disclosure (REQ-027 FR-3).
    await glossaryOnPage(page, { label: "sample with sheet" });
    await checkWidths(page, "sample with sheet");
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    await shot(page, "sample-start-here", testInfo.project.name);
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
