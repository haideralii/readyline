import { test, expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { mkdirSync, readFileSync } from "node:fs";
import { addMonths } from "@/lib/registers/status";
import {
  generateAuditorToken,
  hashAuditorToken,
} from "@/lib/registers/auditor-link";
import { hasSupabaseForE2e } from "../helpers/env";
import { addDays, todaySydney } from "../helpers/dates";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { checkWidths } from "../helpers/width";

/**
 * REQ-023 Session C on desktop and Android (D-2207), AC-5: the certification
 * fixture at the renewal window with the dates confirmed, two documents due,
 * no rehearsal and no application reads the ten states the AC lists; the
 * dated steps take a date (and the booking the auditing company's name, the
 * SR-1 shapes refused); the rehearsal writes no improvement row and ends
 * with the dated working note, which the owner's pack carries and an
 * auditor link's pack carries only when ticked (D-2309). Dates follow the
 * runner's Sydney day (D-2242). Needs a Supabase stack.
 */
const EVIDENCE_DIR = "product/evidence/req-023";
const enabled = hasSupabaseForE2e();
const today = todaySydney();
const sydney = (days: number) => addDays(today, days);
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/certification-personal-care.json",
    "utf8",
  ),
) as Record<string, unknown>;

// A three-year certification period whose renewal window (six months before the end) opened a week ago.
const ends = sydney(175);
const starts = addMonths(ends, -36);

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

async function fetchPack(page: Page, path: string): Promise<string[]> {
  const pack = await page.request.get(path);
  expect(pack.status(), path).toBe(200);
  return Object.keys(unzipSync(new Uint8Array(await pack.body())));
}

test.describe("the renewal path and the rehearsal (REQ-023 Session C)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `req-023-c-${testInfo.project.name}`,
      tradingName: "Harbour Care",
      answers,
    });
    const admin = tenant.admin;
    const accountId = tenant.accountId;
    const ent = await admin
      .from("entitlements")
      .insert({ account_id: accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    const period = await admin.from("registration_periods").insert({
      account_id: accountId,
      period_starts_on: starts,
      period_ends_on: ends,
      audit_type: "certification",
      midterm_applies: true,
      last_audit_on: starts,
    });
    if (period.error) throw period.error;
    // Two documents whose next review falls before the period ends (AC-5: "2 due").
    const reviews = await admin.from("policy_reviews").insert([
      {
        account_id: accountId,
        document_type_id: "other",
        title: "Fire plan",
        adopted_on: sydney(-400),
        last_reviewed_on: sydney(-300),
        review_cycle_months: 12,
      },
      {
        account_id: accountId,
        document_type_id: "other",
        title: "Visitor policy",
        adopted_on: sydney(-400),
        last_reviewed_on: sydney(-200),
        review_cycle_months: 12,
      },
    ]);
    if (reviews.error) throw reviews.error;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the ten steps read AC-5's states, in the Commission's order, with one primary action", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/path/renewal");
    await expect(page.getByTestId("renewal-intro")).toContainText(
      "the renewal window is open",
    );
    const states: Record<string, string> = {
      dates: "(done)",
      "what-changed": "(to read)",
      documents: "(2 due)",
      rehearsal: "(not yet)",
      answers: "(optional)",
      application: "(not yet)",
      scope: "(not yet)",
      booking: "(not yet)",
      "audit-day": "(not yet)",
      decision: "(not yet)",
    };
    const items = page.getByTestId("renewal-steps").locator("li");
    await expect(items).toHaveCount(10);
    const order = Object.keys(states);
    for (let i = 0; i < order.length; i++) {
      await expect(items.nth(i)).toHaveAttribute(
        "data-testid",
        `renewal-step-${order[i]}`,
      );
      await expect(page.getByTestId(`renewal-state-${order[i]}`)).toHaveText(
        states[order[i]],
      );
    }
    await expect(page.getByTestId("renewal-step-dates")).toContainText(
      "the renewal window opened",
    );
    await expect(page.getByTestId("renewal-next")).toHaveText("Read it");
    // One primary on the screen; the "Your next step" strip above the shell carries its own (REQ-017 FR-1, D-1701), as guided-path.spec.ts counts it.
    await expect(page.locator('[data-shell="page"] .btn-primary')).toHaveCount(
      1,
    );
    await expect(page.getByTestId("next-step-button")).toHaveClass(
      /btn-primary/,
    );
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByTestId("renewal-step-booking")).not.toContainText(
      /recommend|approved auditor|fee/i,
    );
    await checkWidths(page, "renewal path");
    await shot(page, "renewal-path", testInfo.project.name);
    // The way in: the account page's link inside the window, the audit-day page's at any time.
    await page.goto("/account");
    await expect(page.getByTestId("registration-renewal-link")).toHaveAttribute(
      "href",
      "/path/renewal",
    );
    await expect(
      page.getByTestId("auditor-link-include-rehearsal"),
    ).not.toBeChecked();
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-renewal")).toHaveAttribute(
      "href",
      "/path/renewal",
    );
  });

  test("the application and the booking take a date, the booking the auditing company's name, SR-1 shapes refused (FR-7)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/path/renewal/application");
    await expect(page.locator("h1")).toHaveText(
      "Apply for renewal in the Commission's portal",
    );
    await expect(page.getByText("Lodge it under the same ABN")).toBeVisible();
    await expect(
      page.getByText("Finish the application within 60 days"),
    ).toBeVisible();
    await expect(page.getByTestId("renewal-window-line")).toHaveCount(0);
    const form = page.getByTestId("renewal-form-application");
    await expect(form.locator("fieldset")).toBeEnabled();
    await page.locator("#renewal-date").fill(sydney(-3));
    await checkWidths(page, "application form");
    await shot(page, "renewal-application", project);
    await page.getByTestId("renewal-save").click();
    await expect(page).toHaveURL(/\/path\/renewal\?saved=application$/);
    await expect(page.getByTestId("renewal-saved")).toBeVisible();
    await expect(page.getByTestId("renewal-state-application")).toContainText(
      "done",
    );
    await expect(page.getByTestId("renewal-step-application")).toContainText(
      "counts under NDIS Act s 73K",
    );
    await expect(page.getByTestId("renewal-next")).toHaveText("Read it");

    // The booking: a person's name shape is refused by its words, the company's accepted.
    await page.goto("/path/renewal/booking");
    await expect(
      page.getByText("the auditing company's name, not a person's"),
    ).toBeVisible();
    await page.locator("#renewal-date").fill(sydney(2));
    await page.locator("#renewal-auditor").fill("430123456");
    await page.getByTestId("renewal-save").click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/path\/renewal\/booking$/);
    await page.locator("#renewal-auditor").fill("Quality Audits Pty Ltd");
    await page.getByTestId("renewal-save").click();
    await expect(page).toHaveURL(/\/path\/renewal\?saved=booking$/);
    await expect(page.getByTestId("renewal-step-booking")).toContainText(
      "With Quality Audits Pty Ltd.",
    );
    const row = await tenant.admin
      .from("registration_periods")
      .select(
        "application_submitted_on, audit_booked_on, auditor_business_name",
      )
      .eq("account_id", tenant.accountId)
      .single();
    expect(row.data).toEqual({
      application_submitted_on: sydney(-3),
      audit_booked_on: sydney(2),
      auditor_business_name: "Quality Audits Pty Ltd",
    });
    await shot(page, "renewal-booked", project);
  });

  test("the rehearsal writes no improvement row and its dated sheet reaches the owner's pack, and an auditor link's only when ticked (FR-8, AC-5)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/path/renewal");
    await page.getByTestId("renewal-action-rehearsal").click();
    await expect(page).toHaveURL(/\/path\/audit-day\/check\?mode=rehearsal$/);
    await expect(page.locator("h1")).toHaveText(
      "Check my systems: a rehearsal",
    );
    await expect(page.getByTestId("check-walk")).toHaveAttribute(
      "data-mode",
      "rehearsal",
    );
    await expect(page.getByTestId("check-question")).not.toContainText(
      "this quarter",
    );
    await shot(page, "rehearsal-start", project);
    // One "no" with a code, then "yes" to the rest.
    await page.locator("#check-note").fill("Ref P-07 not filed");
    await page.getByTestId("check-no").click();
    for (let i = 0; i < 40; i++) {
      if (await page.getByTestId("check-done").isVisible()) break;
      await expect(page.getByTestId("check-yes")).toBeEnabled();
      await page.getByTestId("check-yes").click();
    }
    const done = page.getByTestId("check-done");
    await expect(done).toBeVisible();
    await expect(done).toHaveAttribute("data-mode", "rehearsal");
    await expect(page.getByTestId("check-summary")).toContainText(
      `1 thing is missing. Your working note is saved as rehearsal-${today}.csv`,
    );
    await expect(page.getByTestId("check-summary")).toContainText(
      "Nothing was written to your improvement register.",
    );
    await expect(page.getByTestId("check-back")).toHaveAttribute(
      "href",
      "/path/renewal",
    );
    await shot(page, "rehearsal-done", project);
    const improvements = await tenant.admin
      .from("improvements")
      .select("id", { count: "exact", head: true })
      .eq("account_id", tenant.accountId);
    expect(improvements.count ?? 0).toBe(0);
    const checks = await tenant.admin
      .from("self_checks")
      .select("mode, period_from, period_to, findings")
      .eq("account_id", tenant.accountId);
    expect(checks.data).toEqual([
      { mode: "rehearsal", period_from: starts, period_to: today, findings: 1 },
    ]);
    await page.goto("/path/renewal");
    await expect(page.getByTestId("renewal-state-rehearsal")).toContainText(
      "done",
    );
    await expect(page.getByTestId("renewal-action-rehearsal")).toHaveText(
      "Run it again",
    );

    // The owner's pack carries the sheet, headed as the owner's own note.
    const ownerPack = await page.request.get("/registers/audit-pack.zip");
    expect(ownerPack.status()).toBe(200);
    const ownerFiles = unzipSync(new Uint8Array(await ownerPack.body()));
    const sheet = `rehearsal-${today}.csv`;
    expect(Object.keys(ownerFiles)).toContain(sheet);
    const csv = Buffer.from(ownerFiles[sheet]).toString("utf8");
    expect(csv.split(/\r?\n/)[0]).toMatch(/^Our own working note, /);
    expect(csv).toContain("Ref P-07 not filed");
    expect(csv).not.toMatch(/this quarter/);

    // An auditor link without the tick leaves it out; one with the tick carries it.
    const plain = generateAuditorToken();
    const ticked = generateAuditorToken();
    const links = await tenant.admin.from("auditor_links").insert([
      {
        account_id: tenant.accountId,
        token_hash: hashAuditorToken(plain),
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      },
      {
        account_id: tenant.accountId,
        token_hash: hashAuditorToken(ticked),
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        include_rehearsal: true,
      },
    ]);
    if (links.error) throw links.error;
    const auditorPlain = await fetchPack(
      page,
      `/auditor/${plain}/audit-pack.zip`,
    );
    expect(auditorPlain).not.toContain(sheet);
    expect(auditorPlain.some((n) => /^rehearsal-/.test(n))).toBe(false);
    const auditorTicked = await fetchPack(
      page,
      `/auditor/${ticked}/audit-pack.zip`,
    );
    expect(auditorTicked).toContain(sheet);
  });
});
