import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { e2eCronSecret, hasSupabaseForE2e } from "../helpers/env";
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

async function expectStep(page: Page, id: string) {
  await expect(page.getByTestId("next-step")).toHaveAttribute("data-step", id);
  await expect(page.getByTestId("next-step-button")).toHaveCount(1);
}

test.describe("the guided path, result to audit day (REQ-017)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  // One journey, serial, with no retry (batch 45b item 2): a red costs one
  // run, and every slow step has its own wait below, so a stall is reported
  // at the step that stalled rather than at the end of the budget. The
  // budget fits the whole journey on a shared runner: the generation wait,
  // the finish re-render of the whole set, and adopt.
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

    // Step 3: while we draft.
    await expect(page).toHaveURL(/\/documents\?purchase=success/);
    await expectStep(page, "wait");
    await expect(page.getByRole("status")).toContainText(
      "You can close this page",
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

    // Step 4: finish your pack, one question at a time on a phone, grouped on desktop.
    await expectStep(page, "finish");
    await page.getByTestId("next-step-button").click();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}\/finish$/);
    await expect(page.getByTestId("finish-form")).toBeVisible();
    await checkWidths(page, "finish your pack");
    await shot(page, "finish-pack", project);
    const answersByKey: Record<string, string> = {
      name: "Jane Citizen",
      role: "Owner",
      "phone-or-email": "0400 000 000",
      date: "14 October 2026",
      period: "7 years",
    };
    // Each click saves one fact on a phone, or every fact on a wider screen,
    // and on the last question re-renders the whole set; the page then
    // refreshes to "Every blank is filled in" with no form. So after each
    // click, wait for that click's end: the next question, the done line, or
    // the refreshed page; never a fixed pause, and never a click on a busy
    // button (batch 45b item 2: run 595 spent its whole budget there).
    const finishStart = Date.now();
    const summary = page.getByTestId("finish-summary");
    const finished = async () =>
      /Every blank is filled in/.test((await summary.textContent()) ?? "") ||
      (await page.getByTestId("finish-done").isVisible());
    for (let i = 0; i < 40; i += 1) {
      if (await finished()) break;
      const next = page.getByTestId("finish-next");
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
      await expect
        .poll(
          async () =>
            (await finished())
              ? "done"
              : (await next.isEnabled().catch(() => false))
                ? "next"
                : "busy",
          { timeout: 120_000, intervals: [250, 500, 1000] },
        )
        .not.toBe("busy");
    }
    await expect(summary).toContainText(
      /Every blank is filled in\. Your \d+ documents are complete\./,
      { timeout: 60_000 },
    );
    testInfo.annotations.push({
      type: "timing",
      description: `finish step ${Math.round((Date.now() - finishStart) / 1000)} s`,
    });
    await shot(page, "finish-done", project);

    // AC-2: the set shows no blanks and the re-rendered document carries the answers.
    await page.goto("/documents");
    await page.getByTestId("open-set").click();
    await expect(page.getByTestId("set-summary")).toContainText(
      "No blanks to fill in",
    );
    await page.getByTestId("set-list").getByRole("link").first().click();
    await expect(page.getByText("Jane Citizen").first()).toBeVisible();

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
        await checkWidths(page, "adopt a group");
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

    // Step 6: the checklist, and the strip now points at it.
    await expectStep(page, "checklist");
    await shot(page, "checklist", project);

    // Step 7: the audit-day page, printable, with the pack download.
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-summary")).toContainText(/ready/);
    await expect(page.getByTestId("audit-day-group").first()).toBeVisible();
    await expect(page.getByTestId("audit-day-download")).toHaveAttribute(
      "href",
      /download\?file=set\.zip$/,
    );
    await expect(page.getByTestId("audit-day-pack")).toContainText("(adopted)");
    // REQ-018 FR-11, AC-4: the twelve records with live states, and the five audit kinds in plain words.
    await expect(
      page.getByTestId("audit-day-ask").getByRole("listitem"),
    ).toHaveCount(12);
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
    await checkWidths(page, "document control");
    await page.goto("/path/audit-day");
    await checkWidths(page, "audit day");
    await shot(page, "audit-day", project);
  });
});
