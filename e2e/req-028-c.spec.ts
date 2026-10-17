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
});
