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
 * REQ-009 Session B (batch 28) on all three projects: a subscribed owner
 * sees the registers index, adds an incident (with the notify-by line for a
 * reportable one), adds a note to its trail, adds a complaint, a worker
 * check and a policy review, filters a list, exports a CSV and a zip, sees
 * the participant-data warning on a typed name, and, once the subscription
 * is revoked, reads everything but cannot add. Screenshots under
 * product/evidence/req-009/ with EVIDENCE=1. Needs a Supabase stack.
 */
const EVIDENCE_DIR = "product/evidence/req-009";
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

test.describe("registers (REQ-009 Session B)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let tenant: TestTenant;
  let entitlementId = "";

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `registers-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
    const ent = await tenant.admin
      .from("entitlements")
      .insert({ account_id: tenant.accountId, kind: "subscription" })
      .select("id")
      .single();
    if (ent.error) throw ent.error;
    entitlementId = ent.data.id as string;
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("index, add an incident with notify-by, trail note, filters, export", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers");
    await expect(page.getByTestId("registers-index")).toContainText(
      "Incidents",
    );
    await expect(page.getByTestId("register-lapsed")).toHaveCount(0);
    await checkWidths(page, "registers index");
    await shot(page, "registers-index", project);
    await axeClean(page, "registers index");

    await page.getByTestId("register-incidents").click();
    await expect(page.getByTestId("incidents-list-empty")).toBeVisible();
    await page.getByTestId("register-add").click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Add an incident" }),
    ).toBeVisible();
    await page.getByLabel("Date it happened").fill("2026-10-09");
    await page.getByLabel("Date it was reported").fill("2026-10-09");
    await page
      .getByLabel("What happened", { exact: true })
      .selectOption("restrictive-practice-unauthorised");
    await page.getByLabel("How serious").selectOption("low");
    await page.getByLabel(/Participant code/).fill("p-014");
    // The detector warns on a name but never blocks (SR-1).
    const summary = page.getByLabel(/What happened, in a sentence/);
    await summary.fill("Jane Citizen was kept in her room.");
    await summary.blur();
    await expect(page.getByTestId("summary-participant-warning")).toContainText(
      /person's name/,
    );
    await summary.fill("Door locked for ten minutes without a plan in place.");
    await page.getByLabel("Reportable to the Commission").check();
    await expect(page.getByTestId("notify-by")).toContainText("2026-10-16");
    await checkWidths(page, "incident form");
    await shot(page, "incident-form", project);
    await axeClean(page, "incident form");
    await page.getByTestId("register-submit").click();
    await expect(page).toHaveURL(
      /\/registers\/incidents\/[0-9a-f-]{36}\?saved=1$/,
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "INC-0001",
    );
    await expect(page.getByTestId("register-saved")).toBeVisible();
    await expect(page.getByTestId("status-tag")).toContainText(
      "Notify by 2026-10-16",
    );
    await expect(page.getByTestId("events-trail")).toContainText("Recorded");

    // Batch 45 item 5: the account page says the same words as the registers
    // index, pluralised, and "Due soon" leads with the incident's notify-by date.
    const incidentUrl = page.url();
    await page.goto("/account");
    await expect(page.getByTestId("account-registers")).toContainText(
      "1 entry, all current.",
    );
    await expect(
      page.getByTestId("due-soon").getByRole("listitem").first(),
    ).toContainText(
      "Notify the Commission about incident INC-0001 by 2026-10-16.",
    );
    await page.goto(incidentUrl);

    // A note joins the trail.
    await page.getByTestId("add-note").click();
    await page
      .getByLabel("Note")
      .fill("Spoke with the worker and the participant's advocate ADV-1.");
    await page.getByTestId("note-submit").click();
    await expect(page.getByTestId("events-trail")).toContainText(
      "advocate ADV-1",
    );
    await checkWidths(page, "incident detail");
    await shot(page, "incident-detail", project);
    await axeClean(page, "incident detail");

    // Edit: close it; the status change is an event.
    await page.getByTestId("register-edit").click();
    await page.getByLabel("Status").selectOption("closed");
    await page.getByLabel("Date closed").fill("2026-10-12");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("events-trail")).toContainText(
      "Status changed",
    );

    // The list and its filter.
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("incidents-list")).toContainText("INC-0001");
    await page.getByLabel(/^Closed/).check();
    await expect(page.getByTestId("incidents-list")).toContainText("INC-0001");
    await page.getByLabel(/^Open/).check();
    await expect(page.getByTestId("incidents-list-empty")).toContainText(
      "Nothing with that status",
    );

    // Export: a zip with two CSVs, through the session.
    const zip = await page.request.get("/registers/incidents/export.zip");
    expect(zip.status()).toBe(200);
    expect(zip.headers()["content-type"]).toContain("zip");
    const bytes = await zip.body();
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  test("complaint, worker check (suggested expiry) and policy review; CSV with BOM", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers/complaints/new");
    await page.getByLabel("Date received").fill("2026-10-12");
    await page.getByLabel("How it arrived").selectOption("phone");
    await page.getByLabel(/Who raised it/).fill("fam-2");
    await page
      .getByLabel(/The complaint, in a sentence/)
      .fill("Worker arrived late twice this week.");
    await page.getByTestId("register-submit").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "CMP-0001",
    );
    await expect(page.getByTestId("status-tag")).toContainText(
      "Not yet acknowledged",
    );
    await shot(page, "complaint-detail", project);

    await page.goto("/registers/worker-checks/new");
    await page.getByLabel(/Worker code/).fill("w-1");
    await page.getByLabel("Role").fill("support worker");
    await page
      .getByLabel("Kind of check")
      .selectOption("ndis-worker-screening");
    await page.getByLabel("Date issued").fill("2026-02-01");
    await expect(page.getByLabel(/Expiry date/)).toHaveValue("2031-02-01");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("worker-checks-list")).toContainText("W-1");
    await expect(page.getByTestId("status-tag").first()).toContainText(
      "Valid to 2031-02-01",
    );
    await checkWidths(page, "worker checks");
    await shot(page, "worker-checks", project);
    await axeClean(page, "worker checks");

    await page.goto("/registers/policy-reviews/new");
    await page
      .getByLabel("Document")
      .selectOption("complaints-management-policy-and-register");
    await page.getByLabel(/Date adopted/).fill("2025-01-15");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("policy-reviews-list")).toContainText(
      "Overdue since 2026-01-15",
    );
    await shot(page, "policy-reviews", project);

    const csv = await page.request.get("/registers/worker-checks/export.csv");
    expect(csv.status()).toBe(200);
    const text = await csv.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("worker_ref,role_label");
    expect(text).toContain(
      "W-1,support worker,ndis-worker-screening,2026-02-01,2031-02-01",
    );
    const bad = await page.request.get(
      "/registers/worker-checks/export.csv?x=1",
    );
    expect(bad.status()).toBe(400);
  });

  test("a lapsed subscription reads everything and cannot add (PO answer 4)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const revoke = await tenant.admin
      .from("entitlements")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", entitlementId);
    expect(revoke.error).toBeNull();
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("register-lapsed")).toContainText(
      /subscription has lapsed/,
    );
    await expect(page.getByTestId("register-add")).toHaveCount(0);
    await expect(page.getByTestId("incidents-list")).toContainText("INC-0001");
    await page.goto("/registers/incidents/new");
    await expect(page).toHaveURL(/\/registers\/incidents$/);
    await shot(page, "registers-lapsed", testInfo.project.name);
  });
});
