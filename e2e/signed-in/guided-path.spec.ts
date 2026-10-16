import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import {
  pagePass,
  resetFocusTrail,
  tabUntil,
  type KeyboardWalk,
} from "../helpers/a11y";
import { e2eCronSecret, hasSupabaseForE2e } from "../helpers/env";
import { glossaryOnPage } from "../helpers/glossary";
import { checkWidths } from "../helpers/width";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-017 on the three projects: a fresh account walks the guided path from
 * the result to the audit-day page without a question. The "Your next step"
 * strip says the right thing at every stage (FR-1); the result's one button
 * leads to the before-you-buy screen; the fake Checkout pays; the pack is
 * drafted (driven as the kicker would); the finish form fills every blank
 * and the documents are re-rendered (FR-2); each group is adopted (FR-3);
 * the checklist and the audit-day page close the walk. Screenshots under
 * product/evidence/req-017/ with EVIDENCE=1. Needs a Supabase stack with
 * this branch's migrations (CI's Supabase job).
 */
const EVIDENCE_DIR = "product/evidence/req-017";
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;

async function shot(page: Page, name: string, project: string) {
  if (!process.env.EVIDENCE) return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${name}-${project}.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 40,
    scale: "css",
  });
}

async function expectStep(page: Page, id: string, timeout?: number) {
  await expect(page.getByTestId("next-step")).toHaveAttribute(
    "data-step",
    id,
    timeout ? { timeout } : undefined,
  );
  await expect(page.getByTestId("next-step-button")).toHaveCount(1);
}

test.describe("the guided path, result to audit day (REQ-017)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  // One journey, serial, with no retry (batch 45b item 2, replacing backlog
  // 4's one CI retry for the webhook race, which the fake Checkout's full
  // page return has closed): a red costs one run, and every slow step has
  // its own wait below, so a stall is reported at the step that stalled
  // rather than at the end of the budget. The budget fits the whole journey
  // on a shared runner: the generation wait, the finish re-render of the
  // whole set, and adopt.
  test.describe.configure({ mode: "serial", timeout: 480_000, retries: 0 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `path-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("result, before you buy, pay, draft, finish, adopt, checklist, audit day", async ({
    page,
    context,
    baseURL,
    request,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);

    // Step 1: the result's one button, and the strip says "buy".
    await page.goto("/start/result");
    await expectStep(page, "buy");
    await page.getByTestId("start-getting-ready").click();
    await expect(page).toHaveURL(/\/path\/before-you-buy$/);

    // Step 2: three lines and one button.
    await expect(page.getByTestId("buy-line-what")).toContainText("documents");
    await expect(page.getByTestId("buy-line-price")).toContainText("AUD 399");
    await expect(page.getByTestId("buy-line-refund")).not.toBeEmpty();
    await expect(page.locator(".btn-primary")).toHaveCount(2); // the strip's and the screen's
    await checkWidths(page, "before you buy");
    await shot(page, "before-you-buy", project);
    await page.getByTestId("path-buy-button").click();
    await expect(page).toHaveURL(/\/dev\/stripe-checkout\/cs_fake_/);
    await page.getByTestId("fake-pay").click();

    // Step 3: while we draft. The purchase is written by the webhook after
    // the fake checkout's response (D-053), so the strip may lag the landing
    // by a few seconds; a dev server compiling the webhook route lags more.
    await expect(page).toHaveURL(/\/documents\?purchase=success/);
    await page.reload();
    await expectStep(page, "wait", 30_000);
    await expect(page.getByRole("status")).toContainText(
      "You can close this page",
    );
    // REQ-021 S1 through the real job: the indicator reads the job row and names a real phase.
    await expect(page.getByTestId("writing-indicator")).toHaveAttribute(
      "data-phase",
      /preparing|writing|checking|assembling|ready/,
    );
    await shot(page, "while-we-draft", project);
    const generationStart = Date.now();
    const deadline = Date.now() + 240_000;
    let ready = false;
    while (Date.now() < deadline) {
      const run = await request.get("/api/jobs/generate?kick=kicker", {
        headers: { authorization: `Bearer ${e2eCronSecret()}` },
      });
      expect(run.status()).toBe(200);
      await page.goto("/documents");
      if (await page.getByTestId("purchase-ready").isVisible()) {
        ready = true;
        break;
      }
      await page.waitForTimeout(2000);
    }
    expect(ready, "the set became ready").toBe(true);
    testInfo.annotations.push({
      type: "timing",
      description: `generation ready after ${Math.round((Date.now() - generationStart) / 1000)} s`,
    });

    // D-541 as amended (batch 37): the owner's name and role are account
    // facts the documents fill in; the finish form never asks for them.
    await page.goto("/account");
    await page.locator("#ownerName").fill("Jane Citizen");
    await page.locator("#ownerRole").fill("Owner");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Saved." }),
    ).toBeVisible();
    await page.goto("/documents");

    // REQ-026 AC-2: the Start here sheet sits first on the set's page; before
    // Finish its "Fill in" lines are open and the count says so.
    await page.getByTestId("open-set").click();
    await expect(page.getByTestId("start-here")).toBeVisible();
    await page.getByTestId("start-here-link").click();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}\/start-here$/);
    await expect(page.getByTestId("start-here-counts")).toContainText(
      /^You have \d+ things? to fill in across \d+ documents?\.$/,
    );
    const fillLines = page.getByTestId("sheet-fill");
    expect(await fillLines.count()).toBeGreaterThan(0);
    await expect(fillLines.first()).toHaveAttribute("data-done", "false");
    await expect(
      page
        .getByTestId("sheet-document-privacy-and-information-management-policy")
        .getByTestId("sheet-fill"),
    ).toHaveCount(3);
    expect(
      await page.getByTestId("sheet-documents").locator("> li").count(),
    ).toBeGreaterThanOrEqual(10);
    await expect(
      page.getByTestId("sheet-first").locator("li").first(),
    ).toBeVisible();
    await checkWidths(page, "start here");
    await pagePass(page, "start here");
    await shot(page, "start-here-before", project);
    const sheetDownload = await page.request.get(
      (await page.getByTestId("start-here-download").getAttribute("href"))!,
    );
    expect(sheetDownload.status()).toBe(200);
    expect(sheetDownload.headers()["content-disposition"]).toContain(
      "00-start-here.docx",
    );
    await page.goto("/documents");

    // Step 4: finish your pack, one question at a time on a phone, grouped on desktop.
    await expectStep(page, "finish");
    await page.getByTestId("next-step-button").click();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}\/finish$/);
    await expect(page.getByTestId("finish-form")).toBeVisible();
    await checkWidths(page, "finish your pack");
    await pagePass(page, "finish your pack");
    await shot(page, "finish-pack", project);
    // The owner's name, role and the approval date are account facts (D-541
    // as amended, batch 37), so the form never asks for them; the keys stay
    // here only so an older page would still be answered.
    const answersByKey: Record<string, string> = {
      name: "Jane Citizen",
      role: "Owner",
      "phone-or-email": "0400 000 000",
      date: "14 October 2026",
      period: "7 years",
    };
    // Each click saves one fact on a phone, or every fact on a wider screen,
    // and on the last question re-renders the whole set; the page then
    // refreshes to the summary with no form. So after each click, wait for
    // that click's end: the next question, the done line, or the refreshed
    // page; never a fixed pause, and never a click on a busy button (batch
    // 45b item 2: run 595 spent its whole budget there). With the approval
    // date left for adoption, the summary reads "Nothing else to answer
    // here." rather than "Every blank is filled in." (run 794 waited 120 s
    // for the second wording).
    const finishStart = Date.now();
    const summary = page.getByTestId("finish-summary");
    const SUMMARY = /(Every blank is filled in|Nothing else to answer here)\./;
    const finished = async () =>
      SUMMARY.test((await summary.textContent().catch(() => "")) ?? "") ||
      (await page
        .getByTestId("finish-done")
        .isVisible()
        .catch(() => false));
    const next = page.getByTestId("finish-next");
    // After the last save the client replaces the page (the done line, then
    // the refreshed summary), and for a moment neither the form nor the done
    // line is in the DOM; a sample taken then reads "not finished" and the
    // loop waits 120 s for a form that never comes back (run 38606911755,
    // desktop, where the whole-set re-render and the refresh follow one
    // click). So the loop waits for one of the two states before deciding.
    const either = next
      .or(page.getByTestId("finish-done"))
      .or(summary.filter({ hasText: SUMMARY }));
    const state = async (): Promise<"done" | "form"> => {
      for (;;) {
        if (await finished()) return "done";
        if (await next.isVisible().catch(() => false)) return "form";
        await either.first().waitFor({ state: "visible", timeout: 120_000 });
      }
    };
    // The server's own word (run 38665790472, android only: the last click
    // stayed busy for 120 s while desktop and iPhone passed the same step,
    // and no trace exists at retries 0). The finish page re-fetched with
    // this context's cookies says "Your N documents are complete." once the
    // re-render is stored, whether or not this tab's action call came back;
    // asked at most every five seconds so the poll adds no load while the
    // server renders. If the server is done and the tab is not, the page is
    // reloaded and the run goes on; a set the server never finishes still
    // fails here.
    const finishUrl = page.url();
    let lastServerAsk = 0;
    const serverFinished = async (): Promise<boolean> => {
      if (Date.now() - lastServerAsk < 5_000) return false;
      lastServerAsk = Date.now();
      const r = await page.request.get(finishUrl).catch(() => null);
      if (!r || !r.ok()) return false;
      return /Your \d+ documents are complete\./.test(await r.text());
    };
    const clickEnd = async () => {
      let seen = "busy";
      await expect
        .poll(
          async () => {
            seen = (await finished())
              ? "done"
              : (await next.isEnabled().catch(() => false))
                ? "next"
                : (await serverFinished())
                  ? "server-done"
                  : "busy";
            return seen;
          },
          // Runs 38665790472 and 38826340580, android-small alone, the last
          // click busy for the whole 120 s while the other two projects passed
          // the same step: the whole-set re-render of 22 documents runs on the
          // shared runner beside the other projects' finish steps, so the wait
          // is the re-render's worst case and not a round number; the
          // server-side `path.finish.rerendered` line now carries `ms`.
          { timeout: 240_000, intervals: [250, 500, 1000] },
        )
        .not.toBe("busy");
      if (seen === "server-done") {
        testInfo.annotations.push({
          type: "finish",
          description:
            "the server had finished the set while this tab's button stayed busy; the page was reloaded",
        });
        await page.reload();
      }
    };
    // Backlog 1 (D-1508): the first screen is answered with the keyboard only
    // (one question on a phone, every question of the topic groups on a
    // wider screen): Tab to each field, type, Tab to the button, Enter.
    {
      const walk: KeyboardWalk = { steps: [] };
      await resetFocusTrail(page);
      const inputs = page
        .getByTestId("finish-form")
        .locator("input[type=text]");
      const n = await inputs.count();
      for (let k = 0; k < n; k += 1) {
        const input = inputs.nth(k);
        if (!(await input.evaluate((el) => el === document.activeElement)))
          await tabUntil(page, input, walk, { label: "finish your pack" });
        const key = (await input.getAttribute("name")) ?? "";
        if (!(await input.inputValue()).trim())
          await page.keyboard.type(answersByKey[key] ?? "Example");
      }
      await tabUntil(page, page.getByTestId("finish-next"), walk, {
        label: "finish your pack",
      });
      await page.keyboard.press("Enter");
      await clickEnd();
    }
    for (let i = 0; i < 40; i += 1) {
      if ((await state()) === "done") break;
      await expect(next).toBeEnabled({ timeout: 120_000 });
      const inputs = page
        .getByTestId("finish-form")
        .locator("input[type=text]");
      const n = await inputs.count();
      for (let k = 0; k < n; k += 1) {
        const input = inputs.nth(k);
        const key = (await input.getAttribute("name")) ?? "";
        if ((await input.inputValue()).trim()) continue;
        await input.fill(answersByKey[key] ?? "Example");
      }
      await next.click();
      await clickEnd();
    }
    await expect(summary).toContainText(
      /(Every blank is filled in|Nothing else to answer here)\. Your \d+ documents are complete\./,
      { timeout: 60_000 },
    );
    // The date is the one blank left, and the page says where it fills in.
    await expect(page.getByTestId("finish-date")).toBeVisible();
    testInfo.annotations.push({
      type: "timing",
      description: `finish step ${Math.round((Date.now() - finishStart) / 1000)} s`,
    });
    await shot(page, "finish-done", project);

    // AC-2: the re-rendered document carries the answers and the owner's name
    // from the account; the approval date fills in on adoption (D-541), so the
    // "no blanks" check comes after step 5.
    await page.goto("/documents");
    await page.getByTestId("open-set").click();
    await page.getByTestId("set-list").getByRole("link").first().click();
    // The control table renders twice (batch 36's data table: cards on a
    // phone, a table from sm up) and the hidden copy comes first in the DOM,
    // so the assertion takes the copy this viewport shows.
    await expect(
      page.getByText("Jane Citizen").filter({ visible: true }).first(),
    ).toBeVisible();

    // REQ-026 AC-2: after Finish every "Fill in" line reads done and the count
    // says so; the adopt lines wait for step 5.
    await page.goto("/documents");
    await page.getByTestId("open-set").click();
    await page.getByTestId("start-here-link").click();
    await expect(page.getByTestId("start-here-counts")).toContainText(
      /^All \d+ things to fill in are done\.$/,
    );
    for (const line of await page.getByTestId("sheet-fill").all())
      await expect(line).toHaveAttribute("data-done", "true");
    await expect(page.getByTestId("sheet-adopt").first()).toHaveAttribute(
      "data-done",
      "false",
    );
    await shot(page, "start-here-finished", project);

    // Step 5: adopt, one group per screen.
    await page.goto("/documents");
    await expectStep(page, "adopt");
    await page.getByTestId("next-step-button").click();
    await expect(page).toHaveURL(/\/path\/adopt\//);
    // Four content groups, "Other" and the self-assessment at most. On
    // success the button moves to the next group (its page has its own
    // button) or, after the last, to the checklist; "Adopted" with a link
    // shows only on a revisit. So each turn waits to leave the group it is
    // on, and a group that is somehow already adopted is passed by its link.
    const adoptStart = Date.now();
    for (let i = 0; i < 8; i += 1) {
      await expect(page.getByTestId("adopt-list")).toBeVisible();
      if (i === 0) {
        // REQ-027 AC-3: the bracket after the paragraph, with the attribution title; axe is pagePass below.
        await glossaryOnPage(page, { label: "adopt a group", axe: false });
        await checkWidths(page, "adopt a group");
        await pagePass(page, "adopt a group");
        await shot(page, "adopt-group", project);
      }
      const here = page.url();
      if (
        await page
          .getByTestId("adopt-done")
          .isVisible()
          .catch(() => false)
      ) {
        await page.getByTestId("adopt-done").getByRole("link").click();
      } else if (i === 0) {
        // Backlog 1 (D-1508): the first group is adopted with the keyboard
        // only; the button enables on hydration (D-1706), so the walk waits.
        await expect(page.getByTestId("adopt-group")).toBeEnabled();
        const walk: KeyboardWalk = { steps: [] };
        await resetFocusTrail(page);
        await tabUntil(page, page.getByTestId("adopt-group"), walk, {
          label: "adopt a group",
        });
        await page.keyboard.press("Enter");
      } else {
        await page.getByTestId("adopt-group").click();
      }
      await expect
        .poll(() => page.url(), {
          message: `leaving ${here} after adopting group ${i + 1}`,
          timeout: 60_000,
        })
        .not.toBe(here);
      if (!/\/path\/adopt\//.test(page.url())) break;
    }
    testInfo.annotations.push({
      type: "timing",
      description: `adopt done after ${Math.round((Date.now() - adoptStart) / 1000)} s`,
    });
    await expect(page).toHaveURL(/\/checklist$/);

    // Step 6: the checklist, and the strip now points at it; each item is an
    // instruction with one tap to do it where the app can (batch 37).
    await expectStep(page, "checklist");
    await expect(
      page.getByTestId("checklist-next").getByRole("listitem").first(),
    ).toHaveText(/^(Ask|Get|Read|Start|Type|Book|Choose|Tell|Put)\b/);
    const registersGroup = page.getByTestId("checklist-group-registers");
    if (!(await registersGroup.evaluate((e) => (e as HTMLDetailsElement).open)))
      await registersGroup.locator("summary").click();
    await page.getByTestId("checklist-row-registers-incidents").click();
    await expect(
      page.getByTestId("checklist-action-registers-incidents"),
    ).toHaveAttribute("href", "/registers/incidents");
    await shot(page, "checklist", project);

    // AC-2 (D-541): adoption filled the approval date, so the set has no blanks left.
    await page.goto("/documents");
    await page.getByTestId("open-set").click();
    await expect(page.getByTestId("set-summary")).toContainText(
      "No blanks to fill in",
    );
    // REQ-026 FR-4: adoption ticks every document's Adopt line on the sheet.
    await page.getByTestId("start-here-link").click();
    for (const line of await page.getByTestId("sheet-adopt").all())
      await expect(line).toHaveAttribute("data-done", "true");

    // Step 7: the audit-day page, printable, with the pack download.
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-summary")).toContainText(/ready/);
    await expect(page.getByTestId("audit-day-group").first()).toBeVisible();
    // Batch 45 items 3 and 4: the groups in the order the auditor asks, and
    // every quoted line is what the auditor says, never the provider's instruction.
    await expect(
      page.getByTestId("audit-day-group").getByRole("heading", { level: 2 }),
    ).toHaveText([
      "First they check who you are",
      "Then they ask to see your policies",
      "Then they ask for your records",
      "Then they ask about your workers",
      "Then they talk about the audit itself",
    ]);
    const asks = await page
      .getByTestId("audit-day-group")
      .locator("li > span > span.font-medium")
      .allTextContents();
    expect(asks.length).toBeGreaterThan(10);
    for (const ask of asks)
      expect(
        ask,
        `an instruction leaked into the auditor's words: ${ask}`,
      ).not.toMatch(
        /Read your|Start your|adopt it|Ask your|Get |Book your|Choose an|Tell your|Put your/,
      );
    await expect(page.getByTestId("audit-day-download")).toHaveAttribute(
      "href",
      /download\?file=set\.zip$/,
    );
    await expect(page.getByTestId("audit-day-pack")).toContainText("(adopted)");
    // REQ-018 FR-11, AC-4: the twelve records with live states, and the five audit kinds in plain words; REQ-020 FR-7 adds the hazard register.
    await expect(
      page.getByTestId("audit-day-ask").getByRole("listitem"),
    ).toHaveCount(13);
    await expect(page.getByTestId("ask-document-control")).toHaveAttribute(
      "data-state",
      /filled|missing|overdue/,
    );
    await expect(page.getByTestId("ask-link-corporate-risks")).toHaveAttribute(
      "href",
      "/registers/corporate-risks",
    );
    await expect(page.getByTestId("audit-kinds").locator("dt")).toHaveCount(5);
    // REQ-018 FR-13, AC-5: the document control register is complete once the pack is adopted.
    await page.goto("/registers/document-control");
    await expect(page.getByTestId("document-control-sentence")).toContainText(
      /^\d+ of \d+ adopted/,
    );
    await expect(
      page
        .getByTestId("document-control-list")
        .locator("li[data-state='not-adopted']"),
    ).toHaveCount(0);
    // REQ-024 A0 (D-2433, AC-17): adoption is per version, the adopt button
    // re-renders first and adopts what it leaves newest, so every row reads
    // adopted straight after the button and none "new version to adopt".
    const controlRows = await page
      .getByTestId("document-control-list")
      .getByRole("listitem")
      .count();
    expect(controlRows).toBeGreaterThan(0);
    await expect(
      page
        .getByTestId("document-control-list")
        .locator("li[data-state='adopted']"),
    ).toHaveCount(controlRows);
    await checkWidths(page, "document control");
    // REQ-024 A0 (D-2435; #77's run 38892064423, PO 22:50): after the adopt
    // step every catalogue type carries its mirror row, so the new-row page has
    // no catalogue type left to offer; the register's own list is where the
    // pack's day shows, read-only, with nothing to type. The complaints row
    // reads the adopted day the adopt step wrote (D-2448, D-2449).
    await page.goto("/registers/policy-reviews");
    const complaintsRow = page
      .getByTestId("policy-reviews-list")
      .locator('[data-testid^="row-"]')
      .filter({ hasText: /^Complaints management/ });
    await expect(complaintsRow).toHaveCount(1);
    await expect(complaintsRow).toContainText(
      /Adopted \d{4}-\d{2}-\d{2}; every \d+ months\./,
    );
    await expect(complaintsRow).not.toContainText(/Not adopted/);
    await expect(page.getByLabel(/Date adopted/)).toHaveCount(0);
    await page.goto("/path/audit-day");
    await checkWidths(page, "audit day");
    await pagePass(page, "audit day with a pack");
    await shot(page, "audit-day", project);
    // Backlog 1 (D-1508): the documents page with a ready set and the checklist after adoption.
    await page.goto("/documents");
    await pagePass(page, "documents with a ready set");
    await page.goto("/checklist");
    await pagePass(page, "checklist after adoption");
  });
});
