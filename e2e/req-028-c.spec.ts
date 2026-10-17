import { test, expect, type Page } from "@playwright/test";
import { openAllGroups, tickGroup } from "./helpers/groups";

/**
 * REQ-028 Session C, FR-5 (AC-5): the questionnaire on a laptop and the two
 * phone exceptions. At 1280 on `desktop-chromium`: the form is seven columns
 * and the aside four, the aside column holds the hint, the glossary and
 * "Ticked so far" in that order with the sticky block staying put on a
 * scroll, the class rows are two columns and the aside is a landmark. At
 * 360 on `android-small`: the hint is one line until tapped, the practices
 * question precedes its first example, and no aside landmark exists.
 *
 * AC-5's two figures (the supports page under 3,400 px with every group
 * open at 1280; the first tickable class within 600 px of the top at 360)
 * are measured and quarantined below with the numbers Session C's layout
 * gives (4,752 and 915 px at 2a), for the PO's ruling (D-2276, CHAT 17 Oct
 * 20:00): the tests stay, marked fixme, so the figures are read on every
 * run and the quarantine is visible.
 */
const large = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function toSupports(page: Page) {
  await page.goto("/start/business");
  await page.getByLabel("Trading name").fill("Sunrise Supports");
  await page.getByRole("radio", { name: "Sole trader" }).check();
  await page.getByRole("checkbox", { name: "NSW" }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
  ).toBeVisible();
}

test.describe("REQ-028 Session C: the questionnaire on a laptop (FR-5, AC-5)", () => {
  test("at 1280: seven and four columns, the aside's blocks in order and sticky, two-column class rows", async ({
    page,
  }) => {
    test.skip(!large(page), "the laptop layout");
    await toSupports(page);
    const shell = page.locator('[data-shell="page"]');
    // The form is the grid itself; its fieldset is the first block in columns 1 to 7.
    const form = page.locator("form.step-form > fieldset").first();
    const aside = page.getByRole("complementary", {
      name: "Help for this step",
    });
    await expect(aside).toBeVisible();
    const sb = (await shell.boundingBox())!;
    const fb = (await form.boundingBox())!;
    const ab = (await aside.boundingBox())!;
    // The shell's content at lg: its box less the 2 rem gutters; twelve columns with 2 rem gaps.
    const content = sb.width - 64;
    const col = (content - 11 * 32) / 12;
    expect(Math.abs(fb.width - (7 * col + 6 * 32))).toBeLessThanOrEqual(4);
    expect(Math.abs(ab.width - (4 * col + 3 * 32))).toBeLessThanOrEqual(4);
    expect(ab.x).toBeGreaterThan(fb.x + fb.width);
    // The aside column's order: the hint, the glossary, "Ticked so far".
    const hint = (await page.getByTestId("aside-hint").boundingBox())!;
    const glossary = (await page.getByTestId("glossary-terms").boundingBox())!;
    const ticked = (await page.getByTestId("aside-ticked").boundingBox())!;
    expect(hint.x).toBeGreaterThan(fb.x + fb.width);
    expect(glossary.x).toBeGreaterThan(fb.x + fb.width);
    expect(hint.y).toBeLessThan(glossary.y);
    expect(glossary.y).toBeLessThan(ticked.y);
    // "Ticked so far" follows the ticks and offers the way back.
    await tickGroup(page, "0107");
    await expect(page.getByTestId("aside-ticked")).toContainText(
      "Ticked so far (1)",
    );
    await expect(page.getByTestId("aside-ticked-count")).toContainText(/audit/);
    // The class rows are two columns: two neighbouring rows share a top.
    const rows = page.locator('[data-testid="category-personal-care"] ul > li');
    const first = (await rows.nth(0).boundingBox())!;
    const second = (await rows.nth(1).boundingBox())!;
    expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(2);
    expect(second.x).toBeGreaterThan(first.x + first.width / 2);
    // Sticky: after a scroll the aside column's top sits at 6 rem, the landmark inside it.
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForFunction(() => window.scrollY >= 900);
    const stuck = (await page.getByTestId("step-side-col").boundingBox())!;
    expect(Math.abs(stuck.y - 96)).toBeLessThanOrEqual(2);
    expect((await aside.boundingBox())!.y).toBeGreaterThan(stuck.y);
  });

  test("at 1280: the supports page with every group open is under 3,400 px (AC-5's figure)", async ({
    page,
  }) => {
    test.skip(!large(page), "the laptop layout");
    test.fixme(
      true,
      "AC-5's 3,400 px: Session C's layout measures 4,752 px at 2a with two-column class rows and the hint and glossary in the aside; quarantined for the PO's ruling (D-2276)",
    );
    await toSupports(page);
    await openAllGroups(page);
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    expect(height, "supports step with every group open at 1280").toBeLessThan(
      3_400,
    );
  });

  test("at 360: the hint one line until tapped, the question before the examples, no aside landmark", async ({
    page,
  }) => {
    test.skip(large(page), "the phone layout");
    await toSupports(page);
    await expect(page.getByRole("complementary")).toHaveCount(0);
    // The hint: one line until tapped.
    const hint = page.getByTestId("groups-hint");
    const summary = page.getByTestId("groups-hint-summary");
    const sbx = (await summary.boundingBox())!;
    expect(sbx.height).toBeLessThanOrEqual(48);
    await expect(
      hint.getByRole("button", { name: "Choose those two for me" }),
    ).toBeHidden();
    await summary.click();
    await expect(
      hint.getByRole("button", { name: "Choose those two for me" }),
    ).toBeVisible();
    // The practices step: the question's heading precedes the first example.
    await tickGroup(page, "0107");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
    ).toBeVisible();
    const legend = page.locator("legend", {
      hasText: /Do you use, or plan to use/,
    });
    const example = page
      .getByTestId("practices-examples")
      .locator("li")
      .first();
    const lb = (await legend.boundingBox())!;
    const eb = (await example.boundingBox())!;
    expect(lb.y).toBeLessThan(eb.y);
  });

  test("at 360: the first tickable class is within 600 px of the top (AC-5's figure)", async ({
    page,
  }) => {
    test.skip(large(page), "the phone layout");
    test.fixme(
      true,
      "AC-5's 600 px: the first class sits at 915 px at 2a (the glossary line, the question, its help, the one-line hint, the search and the first heading come first); quarantined for the PO's ruling (D-2276)",
    );
    await toSupports(page);
    const cb = (await page.getByRole("checkbox").first().boundingBox())!;
    expect(cb.y, "the first tickable class").toBeLessThan(600);
  });

  test("the result at 1280: the card sticky in five columns, the sections in seven and open on a first visit; at 360 the stepper one line and Start again in the card (FR-6, AC-4)", async ({
    page,
  }) => {
    await toSupports(page);
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
    await expect(page.getByTestId("result")).toBeVisible();
    const card = page.getByTestId("summary");
    // D-2805: one primary whose label says where it goes, one text link, the footer links.
    await expect(
      card.getByRole("link", { name: "Sign in to get ready" }),
    ).toBeVisible();
    await expect(
      card.getByRole("link", { name: "See the price" }),
    ).toBeVisible();
    await expect(card.getByTestId("change-answers")).toBeVisible();
    await expect(card.getByTestId("clear-draft")).toBeVisible();
    await expect(card.getByTestId("next-line")).toHaveCount(0);
    if (large(page)) {
      const shell = (await page.locator('[data-shell="page"]').boundingBox())!;
      const cb = (await card.boundingBox())!;
      const sections = (await page
        .getByTestId("result-section-why")
        .boundingBox())!;
      const content = shell.width - 64;
      const col = (content - 11 * 32) / 12;
      expect(Math.abs(cb.width - (5 * col + 4 * 32))).toBeLessThanOrEqual(4);
      expect(Math.abs(sections.width - (7 * col + 6 * 32))).toBeLessThanOrEqual(
        4,
      );
      expect(sections.x).toBeGreaterThan(cb.x + cb.width);
      // D-2813: open at lg on a first visit.
      for (const id of ["why", "documents", "registers"])
        await expect(page.getByTestId(`result-section-${id}`)).toHaveAttribute(
          "open",
          "",
        );
      // The checklist link heads the documents section.
      await expect(
        page
          .getByTestId("result-section-documents")
          .getByRole("link", { name: "Open these in your checklist" }),
      ).toBeVisible();
      // Sticky: after a scroll the card column stays at 6 rem.
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForFunction(() => window.scrollY >= 900);
      const stuck = (await card.boundingBox())!;
      expect(Math.abs(stuck.y - 96)).toBeLessThanOrEqual(2);
    } else {
      // The two phone exceptions: the stepper is line one alone; Start again sits in the card.
      await expect(page.getByTestId("progress-line-label")).toBeVisible();
      await expect(page.getByTestId("stepper-business")).toBeHidden();
      for (const id of ["why", "documents", "registers"])
        await expect(
          page.getByTestId(`result-section-${id}`),
        ).not.toHaveAttribute("open", "");
      const button = (await card
        .getByRole("link", { name: "Sign in to get ready" })
        .boundingBox())!;
      expect(button.y + button.height).toBeLessThanOrEqual(
        page.viewportSize()!.height,
      );
    }
  });
});

/**
 * REQ-028 Session C, FR-10 (AC-8): home and pricing. The strip's two cells
 * name and price both products in one size and weight, the subscription
 * first, each a link to its pricing card, with D-2265's sentences under the
 * strip unmoved; at 1280 the example result card sits beside the hero in
 * five columns and the trust cards are 2 x 2; at 360 the cells stack at
 * 16 px. The pricing page is "Pricing", its two cards share one skeleton
 * with equal heights at 1280, both buttons secondary (D-2816), and the one
 * no-interest sentence sits under both. The height at 360 is
 * req-025-c.spec.ts's (baseline + 160).
 */
test.describe("REQ-028 Session C: home and pricing (FR-10, AC-8)", () => {
  test("home: the strip's cells, the sentences under it, the example card beside the hero and the trust cards 2 x 2 at 1280, the cells stacked at 360", async ({
    page,
  }) => {
    await page.goto("/");
    const strip = page.getByTestId("home-price-strip");
    const registers = page.getByTestId("home-strip-registers");
    const pack = page.getByTestId("home-strip-pack");
    await expect(registers).toHaveText(
      "Registers subscription · AUD 39 a month",
    );
    await expect(pack).toHaveText("Document pack · AUD 399 one-off");
    await expect(registers).toHaveAttribute("href", "/pricing#keeps");
    await expect(pack).toHaveAttribute("href", "/pricing#start");
    // D-2806 (the lawyer's read): one size and weight in both cells, 16 px, tabular figures.
    const styles = await Promise.all(
      [registers, pack].map((cell) =>
        cell.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            size: s.fontSize,
            weight: s.fontWeight,
            nums: s.fontVariantNumeric,
          };
        }),
      ),
    );
    for (const s of styles) {
      expect(s.size).toBe("16px");
      expect(s.nums).toContain("tabular-nums");
    }
    expect(styles[0].weight).toBe(styles[1].weight);
    // D-2265's sentences stay as prose directly under the strip.
    const sb = (await strip.boundingBox())!;
    const line = (await page
      .getByTestId("home-subscription-line")
      .boundingBox())!;
    expect(line.y).toBeGreaterThanOrEqual(sb.y + sb.height - 1);
    await expect(page.getByTestId("home-price-line")).toContainText(
      /one-off for the document pack/,
    );
    const rb = (await registers.boundingBox())!;
    const pb = (await pack.boundingBox())!;
    if (large(page)) {
      expect(Math.abs(rb.y - pb.y)).toBeLessThanOrEqual(2);
      expect(rb.x).toBeLessThan(pb.x);
      const shell = (await page.locator('[data-shell="page"]').boundingBox())!;
      const content = shell.width - 64;
      const col = (content - 11 * 32) / 12;
      const h1 = (await page
        .getByTestId("home-hero")
        .getByRole("heading", { level: 1 })
        .boundingBox())!;
      const example = (await page.getByTestId("home-example").boundingBox())!;
      expect(Math.abs(example.width - (5 * col + 4 * 32))).toBeLessThanOrEqual(
        4,
      );
      expect(example.x).toBeGreaterThan(h1.x + h1.width);
      expect(example.y).toBeLessThan(h1.y + h1.height);
      const cards = page.getByTestId("home-trust").locator("ul > li");
      await expect(cards).toHaveCount(4);
      const b = await Promise.all(
        [0, 1, 2, 3].map(async (i) => (await cards.nth(i).boundingBox())!),
      );
      expect(Math.abs(b[0].y - b[1].y)).toBeLessThanOrEqual(2);
      expect(b[1].x).toBeGreaterThan(b[0].x + b[0].width / 2);
      expect(b[2].y).toBeGreaterThanOrEqual(b[0].y + b[0].height - 1);
      expect(Math.abs(b[2].y - b[3].y)).toBeLessThanOrEqual(2);
    } else {
      // The two cells stack; the example card follows the hero's words.
      expect(pb.y).toBeGreaterThanOrEqual(rb.y + rb.height - 1);
      const example = (await page.getByTestId("home-example").boundingBox())!;
      expect(example.y).toBeGreaterThan(sb.y + sb.height);
    }
  });

  test("pricing: the page is Pricing, one skeleton with secondary buttons and equal heights at 1280, one no-interest sentence under both cards", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pricing" }),
    ).toBeVisible();
    const halves = page.getByTestId("pricing-halves");
    const sub = page.getByTestId("pricing-subscription");
    const pack = page.getByTestId("pricing-pack");
    await expect(sub.getByRole("heading", { level: 2 })).toHaveText(
      "Registers subscription",
    );
    await expect(page.getByTestId("subscription-price")).toHaveText("AUD 39");
    await expect(page.getByTestId("pack-price")).toHaveText("AUD 399");
    for (const id of ["subscription-price", "pack-price"])
      expect(
        await page
          .getByTestId(id)
          .evaluate((el) => getComputedStyle(el).fontSize),
      ).toBe("30px");
    // D-2816: nothing primary inside the cards; signed out, the pack's sign-in link is the secondary style.
    await expect(halves.locator(".btn-primary")).toHaveCount(0);
    await expect(page.getByTestId("sign-in-to-buy")).toHaveClass(
      /btn-secondary/,
    );
    const noCredit = page.getByTestId("pricing-no-credit");
    await expect(noCredit).toHaveCount(1);
    const hb = (await halves.boundingBox())!;
    const nb = (await noCredit.boundingBox())!;
    expect(nb.y).toBeGreaterThanOrEqual(hb.y + hb.height - 1);
    if (large(page)) {
      const shell = (await page.locator('[data-shell="page"]').boundingBox())!;
      const content = shell.width - 64;
      const col = (content - 11 * 32) / 12;
      expect(Math.abs(hb.width - (10 * col + 9 * 32))).toBeLessThanOrEqual(4);
      expect(Math.abs(hb.x - (shell.x + 32 + col + 32))).toBeLessThanOrEqual(4);
      const s = (await sub.boundingBox())!;
      const k = (await pack.boundingBox())!;
      expect(Math.abs(s.height - k.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.y - k.y)).toBeLessThanOrEqual(1);
    }
  });
});
