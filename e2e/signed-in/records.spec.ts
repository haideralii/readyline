import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { checkWidths } from "../helpers/width";

/**
 * REQ-020 Session C on the three projects: a subscribed owner adds a
 * hazard from an incident's offer and finds the hazard register on the
 * audit-day list with its state (FR-7, AC-6); imports a spreadsheet of
 * incidents whose one named row is listed with its reason and left out
 * while the rest arrive with their imported line, then undoes the import
 * (FR-8, FR-12, AC-5); walks the self-check with two "no" answers and finds
 * two improvement rows and the audit-day line (FR-9, AC-7). Every new
 * screen is checked for sideways scroll and axe serious issues (AC-8).
 * Screenshots under product/evidence/req-020/ with EVIDENCE=1. Needs a
 * Supabase stack with this branch's migrations (CI's Supabase job).
 */
const EVIDENCE_DIR = "product/evidence/req-020";
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

/** A date typed into a form: any calendar will do, the app stores it as typed. */
const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
/**
 * A date the app derives itself: the self-check's walked-on day and the
 * due dates that follow come from the product's calendar, Australia/Sydney
 * (`todaySydney()` on the check page), so an expectation compared with them
 * is computed the same way. The runner's UTC day is one behind Sydney from
 * about 13:00Z, which is where run 38779174050 (18:51Z) failed (D-2242).
 */
const sydney = (days: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86_400_000));

const HEADER =
  "occurred_on,reported_on,category,severity,participant_ref,worker_ref,summary,actions_taken,reportable,reportable_notified_on,commission_reference,status,closed_on";
const row = (occurred: string, summary: string) =>
  `${occurred},${occurred},near-miss,low,P-014,W-3,"${summary}",Sign put out.,false,,,open,`;

test.describe("hazards, import and the self-check (REQ-020 Session C)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `records-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
    const ent = await tenant.admin
      .from("entitlements")
      .insert({ account_id: tenant.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("an incident offers the hazard register; the hazard lands with its state on the register and the audit-day list (FR-7, AC-6)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    const ins = await tenant.admin
      .from("incidents")
      .insert({
        account_id: tenant.accountId,
        occurred_on: future(-3),
        reported_on: future(-3),
        category: "near-miss",
        severity: "low",
        summary: "Trip on the back step.",
      })
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    await page.goto(`/registers/incidents/${ins.data.id}`);
    await expect(page.getByTestId("hazard-offer")).toBeVisible();
    await page.getByTestId("hazard-link").click();
    await expect(page).toHaveURL(/\/registers\/hazards\/new$/);
    await checkWidths(page, "hazard form");
    await axeClean(page, "hazard form");
    await page.locator("#site_ref").fill("s-1");
    await page.locator("#hazard").fill("Loose rail on the back step.");
    await page.locator("#harm_to").selectOption("participant");
    await page.locator("#likelihood").selectOption("medium");
    await page.locator("#severity").selectOption("high");
    await page.locator("#controls").fill("Rail fixed; checked monthly.");
    await page.locator("#due_on").fill(future(7));
    await page.locator("#review_on").fill(future(90));
    await shot(page, "hazard-form", project);
    await page.getByRole("button", { name: "Add a hazard" }).click();
    await expect(page).toHaveURL(/\/registers\/hazards\?saved=/);
    const list = page.getByTestId("hazards-list");
    await expect(list).toContainText("S-1: Loose rail on the back step.");
    await expect(list).toContainText("Could harm a participant");
    await checkWidths(page, "hazards list");
    await axeClean(page, "hazards list");
    await shot(page, "hazards", project);

    await page.goto("/registers/corporate-risks");
    await expect(page.getByTestId("hazards-link-line")).toBeVisible();
    await page.goto("/path/audit-day");
    await expect(
      page.getByTestId("audit-day-ask").getByRole("listitem"),
    ).toHaveCount(14);
    await expect(page.getByTestId("ask-hazards")).toHaveAttribute(
      "data-state",
      "filled",
    );
    await expect(page.getByTestId("ask-hazards")).toContainText(
      "1 entry; all current.",
    );
    await expect(page.getByTestId("ask-link-hazards")).toHaveAttribute(
      "href",
      "/registers/hazards",
    );
  });

  test("a spreadsheet of incidents is previewed, the named row listed and left out, the rest imported with their line, and the import undone (FR-8, FR-12, AC-5)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers/incidents");
    await page.getByTestId("register-import").click();
    await expect(page).toHaveURL(/\/registers\/incidents\/import$/);
    await checkWidths(page, "import page");
    await axeClean(page, "import page");
    await expect(page.getByTestId("import-template")).toHaveAttribute(
      "href",
      "/registers/incidents/import-template.csv",
    );
    const template = await page.request.get(
      "/registers/incidents/import-template.csv",
    );
    expect(template.status()).toBe(200);
    expect((await template.text()).replace(/^﻿/, "").trim()).toBe(HEADER);

    const csv = `${HEADER}\n${row(future(-10), "Wet floor by the back door.")}\n${row(
      future(-9),
      "Jane Citizen slipped in the kitchen.",
    )}\n${row(future(-8), "Hot water left running.")}\n`;
    await page.getByTestId("import-file").setInputFiles({
      name: "incidents.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await expect(page.getByTestId("import-counts")).toContainText(
      "2 of 3 rows pass; 1 row does not and will be left out.",
    );
    await expect(page.getByTestId("import-failure")).toHaveCount(1);
    await expect(page.getByTestId("import-failure")).toContainText("Row 2");
    await expect(page.getByTestId("import-failure")).toContainText(
      "looks like a name",
    );
    await checkWidths(page, "import preview");
    await shot(page, "import-preview", project);
    await page.getByTestId("import-commit").click();
    await expect(page).toHaveURL(/\/registers\/incidents\?imported=2$/);
    const imported = await tenant.admin
      .from("incidents")
      .select("id, summary")
      .eq("account_id", tenant.accountId)
      .in("summary", [
        "Wet floor by the back door.",
        "Hot water left running.",
      ]);
    expect(imported.data?.length).toBe(2);
    const lines = await tenant.admin
      .from("register_events")
      .select("row_id, kind")
      .eq("account_id", tenant.accountId)
      .eq("register", "incidents")
      .eq("kind", "imported");
    expect(lines.data?.length).toBe(2);
    const audit = await tenant.admin
      .from("audit_log")
      .select("action, target")
      .eq("account_id", tenant.accountId)
      .eq("action", "register.incidents.imported");
    expect(audit.data?.length).toBe(1);
    expect(audit.data?.[0].target).toMatch(/ 2\/3$/);
    // The row's own trail carries the same line.
    await page.goto(`/registers/incidents/${imported.data![0].id}`);
    await expect(page.getByText("Imported from a spreadsheet")).toBeVisible();

    await page.goto("/registers/incidents/import");
    await expect(page.getByTestId("import-recent")).toHaveCount(1);
    await page.getByTestId("import-undo").click();
    await expect(page.getByTestId("import-message")).toContainText(
      "Undone: 2 rows removed.",
    );
    const after = await tenant.admin
      .from("incidents")
      .select("id")
      .eq("account_id", tenant.accountId)
      .in("summary", [
        "Wet floor by the back door.",
        "Hot water left running.",
      ]);
    expect(after.data ?? []).toEqual([]);
    await expect(page.getByTestId("import-recent")).toHaveCount(0);

    // A wrong-column file is refused whole.
    await page.getByTestId("import-file").setInputFiles({
      name: "wrong.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("date,what\n2026-09-01,fell\n", "utf8"),
    });
    await expect(page.getByTestId("import-refused")).toContainText(
      "Most rows did not pass; check the column names against the template",
    );
  });

  test("the self-check walks the records one at a time; two no answers become two improvement rows and the audit-day line (FR-9, AC-7)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/path/audit-day");
    const block = page.getByTestId("audit-day-check");
    await expect(block).toHaveAttribute("data-due", "true");
    await expect(block.getByTestId("audit-day-check-line")).toContainText(
      "You have not checked your systems yet.",
    );
    await block.getByTestId("audit-day-check-start").click();
    await expect(page).toHaveURL(/\/path\/audit-day\/check$/);
    await checkWidths(page, "self-check");
    await axeClean(page, "self-check");
    await expect(page.getByTestId("check-progress")).toHaveText("1 of 14");
    await shot(page, "self-check", project);
    for (let i = 1; i <= 14; i += 1) {
      await expect(page.getByTestId("check-progress")).toHaveText(`${i} of 14`);
      await expect(page.getByTestId("check-state")).toHaveAttribute(
        "data-state",
        /filled|missing|overdue/,
      );
      if (i === 2 || i === 5) {
        await page.locator("#check-note").fill("Two are still on paper.");
        await page.getByTestId("check-no").click();
      } else await page.getByTestId("check-yes").click();
    }
    await expect(page.getByTestId("check-summary")).toContainText(
      "2 findings are in your improvement register, due in 30 days.",
    );
    await checkWidths(page, "self-check done");
    await shot(page, "self-check-done", project);
    const findings = await tenant.admin
      .from("improvements")
      .select("source_kind, due_on, learned")
      .eq("account_id", tenant.accountId)
      .eq("source_kind", "self-check");
    expect(findings.data?.length).toBe(2);
    expect(findings.data?.every((r) => r.due_on === sydney(30))).toBe(true);
    expect(
      findings.data?.every((r) =>
        r.learned.endsWith("Two are still on paper."),
      ),
    ).toBe(true);
    const audit = await tenant.admin
      .from("audit_log")
      .select("action, target")
      .eq("account_id", tenant.accountId)
      .eq("action", "self_check.completed");
    expect(audit.data?.length).toBe(1);
    expect(audit.data?.[0].target).toMatch(/ 2$/);

    await page.getByTestId("check-back").click();
    await expect(page).toHaveURL(/\/path\/audit-day$/);
    await expect(block).toHaveAttribute("data-due", "false");
    await expect(block.getByTestId("audit-day-check-line")).toContainText(
      `Last checked ${sydney(0)}, 2 findings still open.`,
    );
    // A second walk the same day is offered, not forced (AC-7).
    await expect(block.getByTestId("audit-day-check-start")).toHaveText(
      "Check my systems again",
    );
    await page.goto("/registers/improvements");
    await expect(page.getByTestId("improvements-list")).toContainText(
      "Our quarterly self-check",
    );
    await shot(page, "improvements-self-check", project);
  });
});
