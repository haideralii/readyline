import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { axeSerious } from "../helpers/a11y";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { checkWidths } from "../helpers/width";

/**
 * REQ-035 AC-1, AC-3, AC-5, AC-8 (D-2962 to D-2967): the fixture policy
 * pasted gives five sections covered and the rest not covered under the
 * fake model (GENERATION_FAKE=1, the Playwright web server's default once
 * #125 is in), in outline order, each not-covered one with its pack link
 * and the counts line matching; a text naming a person is refused with the
 * detector's sentence and the next step; the documents page, the checklist
 * line and the audit-day count show the stored result after a reload; axe
 * is clean at 360 and 1280 on the page and the result. Needs a Supabase
 * stack.
 */
const enabled = hasSupabaseForE2e();
const policy = readFileSync("fixtures/gap-check/sample-policy.txt", "utf8");
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;
const TYPE = "complaints-management-policy-and-register";

async function axeAt(page: Page, width: number, label: string) {
  await page.setViewportSize({ width, height: width < 800 ? 740 : 800 });
  expect(await axeSerious(page, `${label} at ${width}`)).toEqual([]);
  await checkWidths(page, `${label} at ${width}`);
}

test.describe("bring your own policy: the gap check (REQ-035)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let tenant: TestTenant;
  let resultUrl = "";

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `req-035-${testInfo.project.name}`,
      tradingName: "Example Supports",
      answers,
    });
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("AC-3: a text naming a person is refused before any request, with the detector's sentence and the next step", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/documents/gap-check");
    await expect(page.getByTestId("gap-check-intro")).toContainText(
      "not an audit",
    );
    await expect(page.getByTestId("gap-check-never-stored")).toContainText(
      "The file and its words are not stored.",
    );
    await expect(page.getByTestId("gap-check-limit-line")).toHaveText(
      "3 checks an hour.",
    );
    await page.getByTestId("gap-check-type").selectOption(TYPE);
    await page.getByTestId("gap-check-title").fill("Complaints policy 2023");
    await page
      .getByTestId("gap-check-paste")
      .fill(`${policy}\n\nA complaint from Mr J. Smith was handled last year.`);
    // The browser's check holds the button with the detector's sentence.
    await expect(page.getByTestId("gap-check-warning")).toContainText(
      "person's name",
    );
    await expect(page.getByTestId("gap-check-warning")).toContainText(
      "Remove the names or details it points to, then run the check again.",
    );
    await expect(page.getByTestId("gap-check-run")).toBeDisabled();
    const stored = await tenant.admin
      .from("gap_checks")
      .select("id")
      .eq("account_id", tenant.accountId);
    expect(stored.data).toEqual([]);
    await axeAt(page, 1280, "gap check");
    await axeAt(page, 360, "gap check");
  });

  test("AC-1: the pasted fixture gives five covered and the rest not covered, in outline order, each not-covered one with its pack link", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/documents/gap-check");
    await page.getByTestId("gap-check-type").selectOption(TYPE);
    await page.getByTestId("gap-check-title").fill("Complaints policy 2023");
    await page.getByTestId("gap-check-paste").fill(policy);
    await expect(page.getByTestId("gap-check-warning")).toHaveCount(0);
    await page.getByTestId("gap-check-run").click();
    await expect(page).toHaveURL(/\/documents\/gap-check\/[0-9a-f-]{36}$/, {
      timeout: 60_000,
    });
    resultUrl = page.url();
    const sections = page.getByTestId("gap-check-section");
    const n = await sections.count();
    expect(n).toBeGreaterThan(5);
    await expect(page.getByTestId("gap-check-counts")).toHaveText(
      `Your Complaints policy 2023 against Readyline's Complaints management policy, procedure and register outline: 5 sections covered, 0 partly, ${n - 5} not covered`,
    );
    const states = await sections.evaluateAll((els) =>
      els.map((el) => [
        el.getAttribute("data-section"),
        el.getAttribute("data-state"),
      ]),
    );
    expect(states.filter(([, s]) => s === "covered").map(([id]) => id)).toEqual(
      [
        "purpose",
        "scope",
        "definitions",
        "policy-statement",
        "responsibilities",
      ],
    );
    expect(states.every(([, s]) => s !== "partly")).toBe(true);
    // Outline order: the front matter first, the change log last.
    expect(states[0][0]).toBe("document-control");
    expect(states[n - 1][0]).toBe("change-log");
    for (const [id, state] of states) {
      const row = page.locator(
        `[data-testid="gap-check-section"][data-section="${id}"]`,
      );
      if (state === "covered") {
        await expect(row.getByTestId("gap-check-pack-link")).toHaveCount(0);
      } else {
        const link = row.getByTestId("gap-check-pack-link");
        await expect(link).toContainText("In the Readyline pack:");
        // No set yet: the link lands on the catalogue entry on the documents page.
        await expect(link).toHaveAttribute("href", `/documents#${TYPE}`);
      }
    }
    // Nothing of the document is shown back but the title.
    await expect(page.locator("body")).not.toContainText("welcomes feedback");
    await expect(page.getByTestId("gap-check-record").first()).toContainText(
      "Kept as a record: the Complaints register",
    );
    await axeAt(page, 1280, "gap check result");
    await axeAt(page, 360, "gap check result");
  });

  test("AC-5: the documents page, the checklist line and the audit-day count show the stored result after a reload", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/documents");
    const item = page.getByTestId("documents-gap-item");
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("5 sections covered");
    await item.getByRole("link").click();
    await expect(page).toHaveURL(resultUrl);
    // The catalogue entry the pack link lands on.
    await page.goto(`/documents#${TYPE}`);
    await expect(page.locator(`#${CSS.escape(TYPE)}`)).toBeInViewport();
    await page.goto("/checklist");
    const gapLine = page.locator('[data-testid^="checklist-gap-"]');
    await expect(gapLine).toHaveCount(1);
    await expect(gapLine).toContainText(
      /^Gap check \d{1,2} [A-Z][a-z]+ 20\d\d: \d+ sections not covered$/,
    );
    await expect(gapLine.getByRole("link")).toHaveAttribute(
      "href",
      new RegExp(resultUrl.replace(baseURL!, "")),
    );
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-gap-checks")).toContainText(
      /^1 of your own policy checked, \d+ sections to close$/,
    );
  });
});
