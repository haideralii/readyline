import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import { checkWidths } from "../helpers/width";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-006 AC-2 on both projects: a signed-in owner's checklist is pre-filled
 * from the "already have" answers, a status change and a note persist across
 * a reload, the progress line updates, the print rendering lists every item,
 * and the page is axe clean. Needs a Supabase stack (CI's Supabase job, or
 * .env.local on a developer machine); skips without one. Screenshots of the
 * sole-trader and the certification case at both viewports with EVIDENCE=1.
 */
const EVIDENCE_DIR = "product/evidence/req-006";
const enabled = hasSupabaseForE2e();
const soleTrader = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;
const personalCare = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/certification-personal-care.json",
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

async function axeClean(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
  ).toEqual([]);
}

test.describe("readiness checklist, signed in (REQ-006 AC-2)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  // A hosted Supabase link from a developer machine adds a second to every write.
  test.describe.configure({ timeout: 120_000 });

  let sole: TestTenant;
  let cert: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    const label = testInfo.project.name;
    sole = await createTenant({
      label: `sole-${label}`,
      tradingName: "Sunrise Supports",
      answers: soleTrader,
    });
    cert = await createTenant({
      label: `cert-${label}`,
      tradingName: "Harbour Care Services",
      answers: personalCare,
    });
  });

  test.afterAll(async () => {
    for (const t of [sole, cert]) if (t) await deleteTenant(t);
  });

  test("sole trader: pre-fill, persistence, progress, print view, axe", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, sole, baseURL!);
    await page.goto("/checklist");
    await expect(
      page.getByRole("heading", { level: 1, name: "Readiness checklist" }),
    ).toBeVisible();
    // REQ-015 FR-16a: the signed-in header and the checklist fit the screen.
    await checkWidths(page, "checklist (signed in)");
    // FR-2: the sole trader said yes to insurance and screening: 4 items ready.
    const progress = page.getByTestId("checklist-progress");
    await expect(progress).toHaveText(/^4 of \d+ items ready$/);
    const total = Number((await progress.textContent())!.match(/of (\d+)/)![1]);
    expect(total).toBeGreaterThan(20);
    // The first group (documents) is open; the business group holds the pre-filled items.
    await expect(page.getByTestId("checklist-group-documents")).toHaveAttribute(
      "open",
      "",
    );
    await expect(page.getByTestId("checklist-privacy")).toContainText(
      /Do not enter any participant/,
    );
    await shot(page, "checklist-sole-trader", project);
    await axeClean(page);

    // REQ-015 Section C: the next three things to do, then the ABN item as a row that opens.
    await expect(page.getByTestId("checklist-next")).toContainText(
      "Next three things to do",
    );
    const business = page.getByTestId("checklist-group-business");
    await business.locator("summary").click();
    const abn = page.getByTestId("checklist-item-business-abn");
    await abn.getByTestId("checklist-row-business-abn").click();
    await expect(abn.getByRole("radio", { name: "Done" })).toBeVisible();
    // FR-10: the choice shows at once and the count updates before the save returns (FR-12).
    await abn.getByRole("radio", { name: "Done" }).check();
    await expect(abn.getByTestId("status-tag")).toContainText("Done");
    await expect(progress).toHaveText(
      new RegExp(`^5 of ${total} items ready$`),
    );
    await expect(page.getByTestId("checklist-save-status")).toContainText(
      "Saved",
    );
    // FR-15: undo is offered for a moment and restores the previous status.
    await expect(page.getByTestId("checklist-undo")).toBeVisible();
    await page.getByTestId("checklist-undo").click();
    await expect(abn.getByTestId("status-tag")).toContainText("Need");
    await expect(progress).toHaveText(
      new RegExp(`^4 of ${total} items ready$`),
    );
    await abn.getByRole("radio", { name: "Done" }).check();
    await expect(progress).toHaveText(
      new RegExp(`^5 of ${total} items ready$`),
    );
    await expect(page.getByTestId("checklist-save-status")).toContainText(
      "Saved",
    );
    // FR-11: the note field is hidden until asked for; the warning is once at the top.
    await expect(page.getByText(/Do not enter any participant/)).toHaveCount(1);
    await abn.getByTestId("add-note-business-abn").click();
    await abn.getByRole("textbox").fill("ABN confirmed with the accountant");
    await expect(page.getByTestId("checklist-save-status")).toContainText(
      "Saved",
    );
    await page.waitForTimeout(1200);
    await shot(page, "checklist-item-open", project);

    // Reload: both persisted, the progress line reflects it.
    await page.reload();
    await expect(progress).toHaveText(
      new RegExp(`^5 of ${total} items ready$`),
    );
    await page
      .getByTestId("checklist-group-business")
      .locator("summary")
      .click();
    await page
      .getByTestId("checklist-item-business-abn")
      .getByTestId("checklist-row-business-abn")
      .click();
    await expect(
      page
        .getByTestId("checklist-item-business-abn")
        .getByRole("radio", { name: "Done" }),
    ).toBeChecked();
    await expect(
      page.getByTestId("checklist-item-business-abn").getByRole("textbox"),
    ).toHaveValue("ABN confirmed with the accountant");

    // Unverified items carry the badge; sources link out (inside the opened row).
    await page.getByTestId("checklist-group-people").locator("summary").click();
    await expect(
      page.getByTestId("checklist-item-people-worker-screening-clearances"),
    ).toContainText("Not confirmed by the Commission's text");
    const orientation = page.getByTestId(
      "checklist-item-people-worker-orientation-module",
    );
    await orientation
      .getByTestId("checklist-row-people-worker-orientation-module")
      .click();
    await expect(
      orientation.getByRole("link", { name: /Source:/ }),
    ).toHaveAttribute("href", /ndiscommission\.gov\.au/);
    // FR-2 of REQ-015: no internal path anywhere on the page.
    await expect(page.locator("body")).not.toContainText(/data\/|\.json/);

    // FR-4: the print rendering is hidden on screen and complete in print.
    const printView = page.getByTestId("checklist-print");
    await expect(printView).toBeHidden();
    await page.emulateMedia({ media: "print" });
    await expect(printView).toBeVisible();
    await expect(printView).toContainText("Sunrise Supports");
    await expect(printView).toContainText(`5 of ${total} items ready`);
    await expect(printView).toContainText("ABN confirmed with the accountant");
    await expect(printView).toContainText(/not legal advice/);
    expect(await printView.locator("li").count()).toBe(total);
    await expect(page.getByTestId("checklist-progress")).toBeHidden();
    await shot(page, "checklist-print", project);
    await page.emulateMedia({ media: "screen" });
  });

  test("certification case: site-visit and mid-term items, workers compensation present", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, cert, baseURL!);
    await page.goto("/checklist");
    await expect(page.getByTestId("checklist-progress")).toHaveText(
      /^\d+ of \d+ items ready$/,
    );
    await page.getByTestId("checklist-group-audit").locator("summary").click();
    await expect(
      page.getByTestId("checklist-item-audit-participant-interview-consent"),
    ).toBeVisible();
    await expect(
      page.getByTestId("checklist-item-audit-mid-term-audit-date"),
    ).toContainText("18 months");
    await page
      .getByTestId("checklist-group-business")
      .locator("summary")
      .click();
    await expect(
      page.getByTestId(
        "checklist-item-business-insurance-workers-compensation",
      ),
    ).toBeVisible();
    await shot(page, "checklist-certification", project);
    await axeClean(page);
  });
});
