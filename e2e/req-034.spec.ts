import { test, expect, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { PRICING_COPY } from "@/lib/payments/copy";
import { SAMPLE_FOOTER } from "@/lib/sample-document";
import { TRUST_ROWS, TRUST_TITLE } from "@/lib/trust/answers";
import { HOME_COPY } from "@/lib/home-copy";
import { axeSerious } from "./helpers/a11y";
import { pdfPageTexts } from "./helpers/pdf";
import { checkWidths } from "./helpers/width";

/**
 * REQ-034 AC-1, AC-3, AC-4, AC-5, AC-6 (D-2944 to D-2951): the trust page's
 * eight rows, each link opening the privacy policy at its section; the four
 * links to the page; the sample as PDF and Word with the footer on every
 * page and the line above the files; the two pack lists, counted; the three
 * plain lines under the pack's price. Public, desktop and Android.
 */
async function axeAt(page: Page, width: number, label: string) {
  await page.setViewportSize({ width, height: width < 800 ? 740 : 800 });
  expect(await axeSerious(page, `${label} at ${width}`)).toEqual([]);
  await checkWidths(page, `${label} at ${width}`);
}

test.describe("the trust page and the sample in both formats (REQ-034)", () => {
  test("AC-1: eight rows, each answered, each link opening the privacy policy at its section; axe at 360 and 1280", async ({
    page,
  }) => {
    await page.goto("/trust");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      TRUST_TITLE,
    );
    await expect(page.getByTestId("trust-reviewed")).toHaveText(
      /^Last reviewed \d{1,2} [A-Z][a-z]+ 20\d\d$/,
    );
    const rows = page.getByTestId("trust-row");
    await expect(rows).toHaveCount(8);
    expect(
      await page
        .getByTestId("trust-row")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-row"))),
    ).toEqual(TRUST_ROWS.map((r) => r.id));
    for (const r of TRUST_ROWS) {
      const row = page.locator(`[data-testid="trust-row"][data-row="${r.id}"]`);
      await expect(row.getByRole("heading", { level: 2 })).toHaveText(
        r.question,
      );
      await expect(row.getByTestId("trust-answer")).not.toBeEmpty();
      await expect(row.getByTestId("trust-source")).toHaveAttribute(
        "href",
        `/privacy#${r.anchor}`,
      );
    }
    // The token rendered, never shown raw.
    await expect(page.locator("body")).not.toContainText("{{");
    await axeAt(page, 1280, "trust");
    await axeAt(page, 360, "trust");
    // Every link lands on the policy with its heading in view.
    for (const anchor of new Set(TRUST_ROWS.map((r) => r.anchor))) {
      await page.goto("/trust");
      await page
        .locator(`[data-testid="trust-source"][href="/privacy#${anchor}"]`)
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`/privacy#${anchor}$`));
      await expect(page.locator(`h2#${anchor}`)).toBeInViewport();
    }
  });

  test("AC-3: the footer, the pricing card, the AI page and the home card link the page", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByTestId("footer-nav").getByRole("link", {
        name: "Where your data lives",
      }),
    ).toHaveAttribute("href", "/trust");
    await expect(page.getByTestId("home-trust-link")).toHaveAttribute(
      "href",
      "/trust",
    );
    await page.goto("/pricing");
    await expect(page.getByTestId("pack-trust-link")).toHaveText(
      PRICING_COPY.trustLink,
    );
    await expect(page.getByTestId("pack-trust-link")).toHaveAttribute(
      "href",
      "/trust",
    );
    await page.goto("/ai");
    const first = page.locator("article p").first();
    await expect(
      first.getByRole("link", { name: /where your data lives/i }),
    ).toHaveAttribute("href", "/trust");
  });

  test("AC-4, AC-5: the sample as PDF and Word with the footer on every page, the line above the files, and the two pack lists counted", async ({
    page,
  }) => {
    await page.goto("/sample");
    await expect(page.getByTestId("sample-files-line")).toHaveText(
      HOME_COPY.sampleFilesLine,
    );
    await expect(page.getByTestId("sample-files").locator("a")).toHaveCount(2);
    await expect(page.getByTestId("sample-download")).toHaveAttribute(
      "href",
      "/sample/complaints-policy.docx",
    );
    await expect(page.getByTestId("sample-download-pdf")).toHaveAttribute(
      "href",
      "/sample/complaints-policy.pdf",
    );
    const pdf = await page.request.get("/sample/complaints-policy.pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    const pages = await pdfPageTexts(new Uint8Array(await pdf.body()));
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((text, i) =>
      expect(text, `PDF page ${i + 1}`).toContain(SAMPLE_FOOTER),
    );
    const docx = await page.request.get("/sample/complaints-policy.docx");
    expect(docx.status()).toBe(200);
    const parts = unzipSync(new Uint8Array(await docx.body()));
    const footerParts = Object.keys(parts).filter((n) =>
      /^word\/footer\d*\.xml$/.test(n),
    );
    expect(footerParts.length).toBeGreaterThan(0);
    for (const n of footerParts)
      expect(strFromU8(parts[n]), n).toContain(SAMPLE_FOOTER);
    // AC-5: two lists, each summary counted, the count the list's length.
    const lists = page.getByTestId("sample-pack-list");
    await expect(lists).toHaveCount(2);
    for (const id of [
      "verification-sole-trader",
      "certification-personal-care",
    ]) {
      const summary = page.getByTestId(`sample-pack-summary-${id}`);
      await expect(summary).toHaveText(/: \d+ documents$/);
      const count = Number(
        (await summary.innerText()).match(/(\d+) documents$/)![1],
      );
      await summary.click();
      await expect(
        page.locator(`[data-testid="sample-pack-list"][data-case="${id}"] li`),
      ).toHaveCount(count);
    }
    await axeAt(page, 360, "sample");
  });

  test("AC-6: the three plain lines sit under the pack's price", async ({
    page,
  }) => {
    await page.goto("/pricing");
    const lines = page.getByTestId("pack-plain-lines").locator("li");
    await expect(lines).toHaveCount(3);
    await expect(lines).toHaveText(PRICING_COPY.plainLines);
    const price = (await page.getByTestId("pack-price").boundingBox())!;
    const first = (await lines.first().boundingBox())!;
    expect(first.y).toBeGreaterThan(price.y);
  });
});
