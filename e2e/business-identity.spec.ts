import { test, expect, type Page } from "@playwright/test";

/**
 * REQ-022 FR-13 (AC-7), three projects: with BUSINESS_NAME and BUSINESS_ABN
 * set, the same registered name and ABN show on every surface that carries
 * them (the home page's mission sentence, the footer on every page, the
 * About, Terms and Privacy pages' party sentence, and the home page's
 * Organization structured data); with them unset, none of those surfaces
 * shows a placeholder or a half sentence. The two halves live in one file
 * and choose by the environment: CI's full run has the variables unset, and
 * one more step runs this spec with the fixture values (D-2289). Locally,
 * export the two variables before `npx playwright test e2e/business-identity.spec.ts`
 * for the set half.
 */
const NAME = process.env.BUSINESS_NAME?.trim() || null;
const ABN_DIGITS = (process.env.BUSINESS_ABN ?? "").replace(/\s+/g, "");
const ABN = /^\d{11}$/.test(ABN_DIGITS)
  ? `${ABN_DIGITS.slice(0, 2)} ${ABN_DIGITS.slice(2, 5)} ${ABN_DIGITS.slice(5, 8)} ${ABN_DIGITS.slice(8)}`
  : null;
const SET = Boolean(NAME && ABN);

/** The pages whose markdown carries the {{business-line}} token (product/legal/about.md, terms.md, privacy.md). */
const PARTY_PAGES = ["/about", "/terms", "/privacy"];
/** Every public page the footer is checked on. */
const PAGES = [
  "/",
  "/pricing",
  "/sign-in",
  "/about",
  "/terms",
  "/privacy",
  "/refunds",
  "/ai",
];

const footerBrand = (page: Page) => page.getByTestId("footer-brand");

test.describe("business identity (REQ-022 FR-13)", () => {
  test("with BUSINESS_NAME and BUSINESS_ABN set: the same name and ABN on every surface (AC-7)", async ({
    page,
  }) => {
    test.skip(
      !SET,
      "needs BUSINESS_NAME and an 11-digit BUSINESS_ABN in the environment",
    );
    const sentence = `It is registered as ${NAME}, ABN ${ABN}.`;

    await test.step("the home page's mission sentence and structured data", async () => {
      await page.goto("/");
      await expect(page.getByTestId("home-mission")).toContainText(sentence);
      const ld = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
      const org = ld.find((t) => t.includes('"Organization"'));
      expect(org, "the Organization structured data").toBeTruthy();
      expect(org).toContain('"propertyID":"ABN"');
      expect(org).toContain(`"value":"${ABN}"`);
    });

    for (const path of PARTY_PAGES) {
      await test.step(`the party sentence on ${path}`, async () => {
        await page.goto(path);
        await expect(page.getByRole("main")).toContainText(sentence);
        await expect(page.getByRole("main")).not.toContainText("{{");
      });
    }

    for (const path of PAGES) {
      await test.step(`the footer's ABN on ${path}`, async () => {
        await page.goto(path);
        await expect(footerBrand(page)).toContainText(`(ABN ${ABN}).`);
      });
    }
  });

  test("with them unset: no placeholder and no half sentence on any surface (AC-7)", async ({
    page,
  }) => {
    test.skip(SET, "runs with BUSINESS_NAME and BUSINESS_ABN unset");

    await page.goto("/");
    const mission = page.getByTestId("home-mission");
    await expect(mission).toBeVisible();
    await expect(mission).not.toContainText(/registered as/);
    await expect(mission).not.toContainText(/ABN/);
    const ld = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    for (const t of ld) expect(t).not.toContain('"ABN"');

    for (const path of PARTY_PAGES) {
      await page.goto(path);
      const main = page.getByRole("main");
      await expect(main).not.toContainText(/registered as/);
      await expect(main).not.toContainText(/\{\{|\}\}|\[insert/);
    }

    for (const path of PAGES) {
      await page.goto(path);
      const brand = footerBrand(page);
      await expect(brand).toBeVisible();
      await expect(brand).not.toContainText(/ABN|\(\)|\{\{/);
    }
  });
});
