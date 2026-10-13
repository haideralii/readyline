import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { checkWidths } from "./helpers/width";

/**
 * REQ-011 batch 29 on all three projects: the guides index, both guides
 * with their reviewed line, generated table, FAQ with FAQPage structured
 * data, sources and the questionnaire CTA; the cost calculator gives the
 * audit type and the price; sitemap and robots answer; axe clean and no
 * sideways scroll. Screenshots under product/evidence/req-011/ with
 * EVIDENCE=1.
 */
const dir = "product/evidence/req-011";

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

async function axeClean(page: Page, label: string) {
  await page.waitForFunction(() => document.title.length > 0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
    label,
  ).toEqual([]);
}

test.describe("guides (REQ-011)", () => {
  test("index lists both guides with their reviewed dates", async ({
    page,
  }, testInfo) => {
    await page.goto("/guides");
    const list = page.getByTestId("guides-list");
    await expect(list).toContainText("Verification or certification");
    await expect(list).toContainText("NDIS registration cost");
    await expect(list).toContainText(/Last reviewed \d+ \w+ 2026/);
    await checkWidths(page, "guides index");
    await axeClean(page, "guides index");
    await shot(page, "guides-index", testInfo.project.name);
  });

  test("which-audit guide: generated table, FAQ structured data, sources, CTA", async ({
    page,
  }, testInfo) => {
    await page.goto("/guides/which-ndis-audit");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "which NDIS audit",
    );
    await expect(page.getByTestId("guide-reviewed")).toContainText(
      /Last reviewed/,
    );
    // The table comes from standards.json: 38 groups, household tasks is verification, personal care certification.
    const table = page.getByRole("table");
    await expect(table).toContainText("0120");
    await expect(table.getByRole("row", { name: /0120/ })).toContainText(
      "Verification",
    );
    await expect(table.getByRole("row", { name: /0107/ })).toContainText(
      "Certification",
    );
    await expect(page.getByText(/38 groups:/)).toBeVisible();
    const faq = page.getByTestId("guide-faq");
    expect(await faq.locator("details").count()).toBe(6);
    const ld = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const faqLd = ld
      .map((t) => JSON.parse(t))
      .flat()
      .find((d: { "@type"?: string }) => d["@type"] === "FAQPage");
    expect(faqLd?.mainEntity).toHaveLength(6);
    await expect(
      page.getByTestId("guide-sources").getByRole("link").first(),
    ).toHaveAttribute("href", /ndiscommission\.gov\.au/);
    await expect(
      page
        .getByTestId("guide-cta")
        .getByRole("link", { name: "See which audit I need" }),
    ).toHaveAttribute("href", "/start");
    expect(await page.locator("body").textContent()).not.toMatch(
      /data\/|\.json/,
    );
    await checkWidths(page, "which-audit guide");
    await axeClean(page, "which-audit guide");
    await shot(page, "which-audit", testInfo.project.name);
  });

  test("cost guide: the price from config and the calculator's audit rule", async ({
    page,
  }, testInfo) => {
    await page.goto("/guides/ndis-registration-cost");
    await expect(page.getByRole("table").first()).toContainText("AUD 399");
    const calc = page.getByTestId("cost-calculator");
    await calc.getByLabel("Find your support types").fill("household");
    // Names carry the code, so the code is the stable handle.
    await calc.getByRole("checkbox", { name: /\b0120\b/ }).check();
    await expect(page.getByTestId("calculator-result")).toContainText(
      "Your audit: verification",
    );
    await expect(page.getByTestId("calculator-result")).toContainText(
      "AUD 399",
    );
    await calc.getByLabel("Find your support types").fill("personal");
    await calc.getByRole("checkbox", { name: /\b0107\b/ }).check();
    await expect(page.getByTestId("calculator-result")).toContainText(
      "Your audit: certification",
    );
    await checkWidths(page, "cost guide");
    await axeClean(page, "cost guide");
    await shot(page, "cost", testInfo.project.name);
  });

  // REQ-011 batch 31: the 38 generated registration-group pages.
  test("registration groups index: everyday headings, synonym search, links to every group", async ({
    page,
  }, testInfo) => {
    await page.goto("/guides/registration-groups");
    await expect(page.getByTestId("groups-count")).toHaveText(
      "38 registration groups.",
    );
    await expect(
      page.getByTestId("groups-category-personal-care"),
    ).toBeVisible();
    expect(
      await page.getByRole("link", { name: /\(class|^[A-Z]/ }).count(),
    ).toBeGreaterThan(30);
    await page.getByLabel(/Search by what you do/).fill("cleaning");
    await expect(page.getByTestId("groups-count")).toContainText(/of 38/);
    await expect(
      page.getByRole("link", { name: "Household tasks", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("groups-category-personal-care")).toHaveCount(
      0,
    );
    await checkWidths(page, "registration groups index");
    await axeClean(page, "registration groups index");
    await shot(page, "groups-index", testInfo.project.name);
  });

  test("a group page: audit with its rule and source, modules, documents, price, FAQ data, CTA with the group ticked", async ({
    page,
  }, testInfo) => {
    await page.goto("/guides/registration-groups/household-tasks");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Household tasks",
    );
    await expect(page.getByTestId("group-audit")).toContainText(
      "Your audit: verification",
    );
    await expect(
      page
        .getByTestId("group-audit")
        .getByRole("link", { name: /Source:/ })
        .first(),
    ).toHaveAttribute("href", /ndiscommission\.gov\.au/);
    await expect(page.getByTestId("group-modules")).toContainText(
      "Verification module",
    );
    expect(
      await page.getByTestId("group-documents").getByRole("listitem").count(),
    ).toBeGreaterThan(12);
    await expect(page.getByTestId("group-price")).toContainText("AUD 399");
    await expect(page.getByTestId("group-cta")).toHaveAttribute(
      "href",
      "/start?group=0120",
    );
    expect(await page.getByTestId("group-faq").locator("details").count()).toBe(
      4,
    );
    const ld = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    )
      .map((t) => JSON.parse(t))
      .flat();
    expect(
      ld.find((d: { "@type"?: string }) => d["@type"] === "FAQPage")
        ?.mainEntity,
    ).toHaveLength(4);
    await expect(
      page.getByTestId("group-sources").getByRole("link").first(),
    ).toHaveAttribute("href", /gov\.au/);
    expect(await page.locator("body").textContent()).not.toMatch(
      /data\/|\.json|Never restate/,
    );
    await checkWidths(page, "group page");
    await axeClean(page, "group page");
    await shot(page, "group-page", testInfo.project.name);

    // The SDA-only note comes from the rules, with its source.
    await page.goto(
      "/guides/registration-groups/specialist-disability-accommodation",
    );
    await expect(page.getByTestId("group-note").first()).toContainText(
      "without the core module",
    );
    await expect(page.getByTestId("group-modules")).not.toContainText(
      "Core module",
    );
  });

  test("the CTA pre-selects the group in the questionnaire", async ({
    page,
  }) => {
    await page.goto("/start?group=0120");
    await expect(page.getByTestId("start-preselect")).toContainText(
      "household tasks (class 0120)",
    );
    await page.getByRole("link", { name: "Start the questionnaire" }).click();
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByTestId("groups-chosen")).toContainText(
      "1 chosen: Household tasks",
    );
    await expect(page.locator("#group-0120")).toBeChecked();
  });

  test("sitemap and robots", async ({ request }) => {
    const sm = await request.get("/sitemap.xml");
    expect(sm.status()).toBe(200);
    const xml = await sm.text();
    expect(xml).toContain("/guides/which-ndis-audit");
    expect(xml).toContain("/guides/ndis-registration-cost");
    expect(xml).toContain("/guides/registration-groups</loc>");
    expect(xml).toContain("/guides/registration-groups/household-tasks");
    expect(
      xml.match(/\/guides\/registration-groups\/[a-z0-9-]+<\/loc>/g),
    ).toHaveLength(38);
    expect(xml).toContain("/pricing");
    const rb = await request.get("/robots.txt");
    expect(rb.status()).toBe(200);
    const txt = await rb.text();
    expect(txt).toContain("Disallow: /account");
    expect(txt).toContain("sitemap.xml");
  });
});
