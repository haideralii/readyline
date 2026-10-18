import { test, expect, type Page } from "@playwright/test";
import { axeSerious } from "./helpers/a11y";
import { glossaryOnPage } from "./helpers/glossary";
import { checkWidths } from "./helpers/width";

/**
 * REQ-025 Session A on the three projects: step 5's two lines (AC-1); the
 * summary as a list whose numbers are derived on the page, never literals
 * (AC-2, FR-3); the one badge vocabulary (FR-4a); the reasons with the
 * source as the link text and "new tab" said once (FR-5); the glossary
 * meanings on the page (FR-13); axe and the width check on both screens.
 * The answers are the AC-2 fixture: personal care (certification), two
 * "Yes" and one "Not sure" on step 5.
 */
const LINE_ONE =
  "Your answers here pre-tick your readiness checklist, so you can see what is missing today.";
const LINE_TWO =
  "They do not change which standards apply or what your pack contains: the pack drafts the full set so every document matches. Not sure counts as no.";

// REQ-027 AC-3 (D-2721): the render check once per step after it renders, no new load; axe is
// the accessibility pass's on every step (req-015-a11y), so it is not run again here (D-2267).
async function reachStepFive(page: Page) {
  await page.goto("/start/business");
  await expect(
    page.getByRole("heading", { level: 1, name: "About your business" }),
  ).toBeVisible();
  await glossaryOnPage(page, { label: "step 1", axe: false });
  await page.getByLabel("Trading name").fill("Sunrise Supports");
  await page.getByRole("radio", { name: "Sole trader" }).check();
  await page.getByRole("checkbox", { name: "NSW" }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
  ).toBeVisible();
  await glossaryOnPage(page, { label: "step 2", axe: false });
  await page.locator("#group-0107").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
  ).toBeVisible();
  await glossaryOnPage(page, { label: "step 3", axe: false });
  await page.locator("#restrictivePractices-no").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Your workforce" }),
  ).toBeVisible();
  await glossaryOnPage(page, { label: "step 4", axe: false });
  await page.getByLabel("Number of workers").fill("3");
  await page.locator("#allRiskAssessedScreened-yes").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "What you already have" }),
  ).toBeVisible();
  await glossaryOnPage(page, { label: "step 5", axe: false });
}

const count = (s: string | null, re: RegExp) => Number(s?.match(re)?.[1]);

test.describe("REQ-025 Session A", () => {
  test("step 5 says what the answers do; the result is a list over derived counts with one badge vocabulary and the meanings on the page", async ({
    page,
  }) => {
    await reachStepFive(page);
    // AC-1: the two lines, verbatim.
    const intro = page.getByTestId("existing-intro");
    await expect(intro).toContainText(LINE_ONE);
    await expect(intro).toContainText(LINE_TWO);
    await checkWidths(page, "step 5");
    expect(await axeSerious(page, "step 5")).toEqual([]);

    for (const [key, value] of [
      ["policies", "yes"],
      ["incidentRegister", "yes"],
      ["complaintsRegister", "no"],
      ["insuranceCertificate", "no"],
      ["workerInductionRecords", "not-sure"],
    ])
      await page.locator(`#${key}-${value}`).check();
    await page.getByRole("button", { name: "See my result" }).click();
    await expect(page.getByTestId("result")).toBeVisible();

    // FR-13: the audit kind's meaning under the heading, from the glossary.
    const card = page.getByTestId("summary");
    await expect(card).toContainText("Your audit: certification");
    await expect(card.getByTestId("audit-kind")).toHaveText(
      "The fuller audit: the auditor visits and talks to you, your workers and participants.",
    );

    // AC-2, FR-3: the list's numbers equal what the page shows elsewhere.
    const documents = await page.getByTestId("summary-documents").textContent();
    const registers = await page.getByTestId("summary-registers").textContent();
    const checklist = await page
      .getByTestId("checklist-count-line")
      .textContent();
    const docTotal = count(documents, /^Documents: (\d+)/);
    const docHave = count(documents, /you said you have (\d+)/);
    const regTotal = count(registers, /^Registers: (\d+)/);
    expect(registers).toMatch(/you keep these as you go$/);
    expect(docTotal).toBeGreaterThan(0);
    expect(docHave).toBeGreaterThan(0);
    const c = checklist!.match(
      /^Checklist: (\d+) items \((\d+) above plus (\d+) about your workers, insurance and the audit\)/,
    )!;
    expect(Number(c[2])).toBe(docTotal + regTotal);
    expect(Number(c[2]) + Number(c[3])).toBe(Number(c[1]));
    await expect(page.getByTestId("result-ready-line-text")).toHaveText(
      `The pack drafts all ${docTotal} so they match; your checklist shows which to compare with what you have.`,
    );
    // The disclosures' counts and tags agree with the list.
    const docs = page.getByTestId("result-section-documents");
    await expect(docs.locator("> summary")).toContainText(
      `Documents you will need (${docTotal})`,
    );
    if ((await docs.getAttribute("open")) === null)
      await docs.locator("> summary").click();
    // REQ-028 FR-6, D-2805: the checklist link heads the documents section.
    await expect(
      docs.getByRole("link", { name: "Open these in your checklist" }),
    ).toBeVisible();
    for (const g of await page.locator('[data-testid^="doc-group-"]').all())
      if ((await g.getAttribute("open")) === null) {
        const s = g.locator("> summary");
        if ((await s.count()) > 0) await s.click();
      }
    // REQ-027 FR-3b (D-2718, finding 143): the legend's first sentence and the tag words are the reader's.
    await expect(docs.getByTestId("have-legend")).toContainText(
      "Your pack drafts every document below.",
    );
    expect(
      await docs
        .getByTestId("have-tag")
        .filter({ hasText: "You have one" })
        .count(),
    ).toBe(docHave);
    const regs = page.getByTestId("result-section-registers");
    await regs.locator("> summary").click();
    await expect(regs.getByTestId("registers-legend")).toContainText(
      "Your pack includes a template for every register below",
    );
    const regHave = registers?.match(/you said you have (\d+)/)?.[1];
    expect(
      await regs
        .getByTestId("have-tag")
        .filter({ hasText: "You have one" })
        .count(),
    ).toBe(regHave ? Number(regHave) : 0);
    // FR-4a as REQ-027 D-2718 amends it: one vocabulary, nothing else; an unasked row carries no tag
    // (req-027.spec counts the tags against the asked rows).
    for (const tag of await page.getByTestId("have-tag").allTextContents())
      expect(tag.trim()).toMatch(
        /^.(You have one|You need one|You said not sure)$/,
      );
    await expect(
      page.getByText(
        /drafts this|You said you don't|You said: not sure|Not asked|To prepare|You have this/,
      ),
    ).toHaveCount(0);

    // FR-5: each reason links to its source by title; live QA D7: the link's own name says it opens a new tab.
    const why = page.getByTestId("result-section-why");
    // REQ-028 D-2813: open at lg on a first visit, closed under it.
    if ((page.viewportSize()?.width ?? 0) >= 1024)
      await expect(why).toHaveAttribute("open", "");
    else await why.locator("> summary").click();
    await expect(why.getByTestId("reasons-intro")).toContainText(
      "open in a new tab",
    );
    const reasons = why.getByTestId("reason");
    expect(await reasons.count()).toBeGreaterThan(0);
    for (const reason of await reasons.all()) {
      const links = reason.getByRole("link");
      await expect(links).toHaveCount(1);
      await expect(links).not.toContainText(/Source:/);
      await expect(links).toContainText("(opens in a new tab)");
      await expect(links).toHaveAttribute("target", "_blank");
    }
    // FR-13: the words on this page, each with its meaning. REQ-027 D-2701 moved the disclosure
    // under the card, and its count is the render-time count req-027.spec proves (finding 81).
    const glossary = page.getByTestId("glossary-terms");
    await expect(glossary.locator("> summary")).toHaveText(
      /^What these words mean \(\d+\)$/,
    );
    await glossary.locator("> summary").click();
    // REQ-027 A1 (D-2709, D-2713): the shared component renders the meaning as a sentence, then `more`.
    const midTerm = glossary.getByTestId("glossary-mid-term-audit");
    await expect(midTerm).toContainText("mid-term audit");
    await expect(midTerm).toContainText(
      "A second audit that most certification providers must have.",
    );
    await expect(midTerm).toContainText(
      "The Rules say it must begin within 18 months of your registration starting",
    );
    await expect(
      glossary.getByTestId("glossary-practice-standards"),
    ).toContainText("The quality rules in the law for registered providers.");
    await checkWidths(page, "result (open)");
    expect(await axeSerious(page, "result (open)")).toEqual([]);
  });
});
