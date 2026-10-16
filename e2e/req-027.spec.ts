import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import {
  NEXT_LINE,
  HAVE_TAG,
  SOLE_TRADER_LINE,
  SOLE_TRADER_SOURCE,
  UNCONFIRMED_SOURCE_HEDGE,
  haveLegend,
} from "@/app/start/_components/steps/result-copy";
import { glossaryOnPage } from "./helpers/glossary";
import { fillBusiness, resultInlineTerm } from "./helpers/questionnaire";
import { openResultSections } from "./helpers/result";
import { checkWidths } from "./helpers/width";

/**
 * REQ-027 A2 on the result page, all three projects: the "What these words
 * mean" count is the render-time count (AC-3, D-2711); the "Next:" line sits
 * under the primary action with FR-3a's words and names the screen a new
 * account is sent to (AC-4, D-2707); the two offers sit below the
 * disclosures (FR-4); the tags, the group summaries, the legend and the
 * sole-trader pair read as D-2716, D-2718, D-2722, D-2723 and D-2725 say
 * for the REQ-025 AC-2 fixture, and the Company fixture carries no pair
 * (AC-7). Screenshots under product/evidence/req-027/ with EVIDENCE=1.
 */
const dir = "product/evidence/req-027";

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

/** The REQ-025 AC-2 fixture (`req-025.spec.ts`): group 0107, three workers, step 5 yes / yes / no / no / not sure. */
async function reachResult(page: Page, structure: "Sole trader" | "Company") {
  await page.goto("/start/business");
  await fillBusiness(page, { structure });
  await page.locator("#group-0107").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.locator("#restrictivePractices-no").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByLabel("Number of workers").fill("3");
  // A company names its key personnel; the sole-trader fixture leaves the field as req-025.spec does.
  if (structure === "Company") {
    await page.getByLabel("Number of key personnel").fill("1");
    await page.locator("#hasRiskAssessedRoles-yes").check();
  }
  await page.locator("#allRiskAssessedScreened-yes").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "What you already have" }),
  ).toBeVisible();
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
}

const LABELS = Object.values(HAVE_TAG)
  .map((t) => t!.label)
  .sort();

test.describe("REQ-027 A2: the result page", () => {
  test("the words' count is the render-time count, the Next line names the new account's screen, the offers sit below the disclosures (AC-3, AC-4, FR-4)", async ({
    page,
  }, testInfo) => {
    await reachResult(page, "Sole trader");
    // AC-3, D-2711: every term present has its meaning; the summary counts the terms present minus the audit kind.
    const present = await glossaryOnPage(page, {
      label: "result",
      inline: await resultInlineTerm(page),
    });
    expect(present.length).toBeGreaterThan(1);
    // D-2701: directly under the card, inside no other disclosure.
    await expect(
      page.locator('[data-testid="summary"] + [data-testid="glossary-terms"]'),
    ).toHaveCount(1);

    // AC-4, D-2707: the line's words, under the primary action, naming the heading auth/callback sends a new account to.
    const card = page.getByTestId("summary");
    const nextLine = card.getByTestId("next-line");
    await expect(nextLine).toHaveText(NEXT_LINE);
    const setup = readFileSync("src/app/account/setup/page.tsx", "utf8");
    const heading = setup.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/)?.[1];
    expect(heading, "account/setup/page.tsx has an h1").toBeTruthy();
    expect(NEXT_LINE).toContain(`'${heading}'`);
    const button = await card
      .getByRole("link", { name: "Start getting ready" })
      .boundingBox();
    const line = await nextLine.boundingBox();
    expect(line!.y).toBeGreaterThanOrEqual(button!.y + button!.height);
    // Finding 33: one sign-in clause on the card, the "Next:" line's.
    expect(((await card.textContent()) ?? "").match(/sign in/gi)?.length).toBe(
      1,
    );

    // FR-4: the two offers after the three disclosures and before "What happens next".
    await expect(
      page.locator(
        '[data-testid="result-section-registers"] ~ [data-testid="result-two-halves"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-testid="result-two-halves"] + [data-testid="what-next"]',
      ),
    ).toHaveCount(1);
    await expect(card.locator('[data-testid="result-two-halves"]')).toHaveCount(
      0,
    );
    await shot(page, "result", testInfo.project.name);
  });

  test("the tags are the three answers, the summaries count them, the legend is the five sentences, the sole trader's pair opens 'Your workers' (AC-7)", async ({
    page,
  }, testInfo) => {
    await reachResult(page, "Sole trader");
    await openResultSections(page);

    // D-2716, D-2718: exactly the three asked rows carry a tag on each list, one of each label.
    const docs = page.getByTestId("result-section-documents");
    const regs = page.getByTestId("result-section-registers");
    for (const [list, name] of [
      [docs, "documents"],
      [regs, "registers"],
    ] as const) {
      const tags = (await list.getByTestId("have-tag").allTextContents()).map(
        (t) => t.trim().replace(/^.\s*/, ""),
      );
      expect(tags.sort(), `${name}: one tag per asked row`).toEqual(LABELS);
    }

    // D-2725: the group summaries, parts in order, empty parts dropped; a group with no asked row shows its count alone.
    await expect(
      page
        .getByTestId("result-section-doc-group-running-the-business")
        .locator("> summary"),
    ).toHaveText("Running the business (10: 1 you have, 1 you need)");
    await expect(
      page
        .getByTestId("result-section-doc-group-your-workers")
        .locator("> summary"),
    ).toHaveText("Your workers (3: 1 not sure)");
    const summaries = await page
      .locator('[data-testid^="result-section-doc-group-"] > summary')
      .allTextContents();
    expect(summaries).toHaveLength(4);
    expect(
      summaries.filter((s) => /\(\d+\)$/.test(s.trim())),
      "the two other groups carry a count and no parts",
    ).toHaveLength(2);

    // D-2718, D-2722: the five sentences; "3" is askedDocumentCount for the fixture's set (document-set.test.ts).
    await expect(page.getByTestId("have-legend")).toHaveText(haveLegend(3));

    // D-2723: the pair as the first child of the "Your workers" body, in the reasons' convention, the link in the same tab.
    const body = page
      .getByTestId("result-section-doc-group-your-workers")
      .locator("> summary + div");
    const pair = body.locator("> *").first();
    await expect(pair).toHaveAttribute("data-testid", "sole-trader-line");
    await expect(pair.locator("p").first()).toHaveText(SOLE_TRADER_LINE);
    await expect(pair.locator("p").nth(1)).toHaveText(
      `${UNCONFIRMED_SOURCE_HEDGE} ${SOLE_TRADER_SOURCE.text} ${SOLE_TRADER_SOURCE.source.title}`,
    );
    const link = pair.getByTestId("sole-trader-source");
    await expect(link).toHaveText(SOLE_TRADER_SOURCE.source.title);
    await expect(link).toHaveAttribute("href", SOLE_TRADER_SOURCE.source.url);
    expect(await link.getAttribute("target")).toBeNull();
    await checkWidths(page, "result (open)");
    await shot(page, "result-open", testInfo.project.name);
  });

  test("a company carries no sole-trader line (AC-7, decision 2)", async ({
    page,
  }) => {
    await reachResult(page, "Company");
    await openResultSections(page);
    await expect(
      page.getByTestId("result-section-doc-group-your-workers"),
    ).toHaveAttribute("open", "");
    await expect(page.getByTestId("sole-trader-line")).toHaveCount(0);
    await expect(page.getByTestId("have-legend")).toHaveText(haveLegend(3));
  });
});
