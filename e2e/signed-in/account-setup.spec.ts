import { test, expect, type Page } from "@playwright/test";
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
 * Batch 45 item 28: a new customer creates the account through the setup
 * form exactly as a customer would (a fresh user, the form, "Create my
 * account", then the start of the guided path), on all three projects, in
 * CI's Supabase job. The other signed-in specs seed their tenant through the
 * `create_account` RPC and never submit this form, which is how a client-side
 * validation failure on every save (#34, run 38591057870) went unseen: from
 * batch 37 up no new customer could have created an account. Rule (DoD 11):
 * every form a customer submits has one e2e that submits it through the
 * real handler.
 */
const enabled = hasSupabaseForE2e();

test.describe("a new customer creates the account through the setup form (batch 45 item 28)", () => {
  test.skip(!enabled, "needs the Supabase variables");

  let user: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    user = await createTenant({
      label: `setup-${testInfo.project.name}`,
      tradingName: "",
      answers: {},
      withAccount: false,
    });
  });

  test.afterAll(async () => {
    if (user) await deleteTenant(user);
  });

  test("the setup form creates the account, the path starts at the questionnaire, and the account page shows what was typed", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, user, baseURL!);
    await page.goto("/account/setup");
    await expect(
      page.getByRole("heading", { name: "About your business" }),
    ).toBeVisible();
    await checkWidths(page, "account setup");

    await page.locator("#tradingName").fill("Sunrise Supports");
    await page.locator("#structure-sole-trader").check();
    await page.locator("#states-NSW").check();
    await page.locator("#ownerName").fill("Jane Citizen");
    await page.locator("#ownerRole").fill("Owner");
    // The button enables on hydration (147ccad); a click then runs the action.
    const create = page.getByRole("button", { name: "Create my account" });
    await expect(create).toBeEnabled();
    await create.click();

    // No draft on this device, so the guided path starts at the questionnaire.
    await expect(page).toHaveURL(/\/start(\/|$)/, { timeout: 30_000 });

    // The account exists with what was typed, owner facts included (D-1704).
    await page.goto("/account");
    await expect(page.getByText("Sunrise Supports").first()).toBeVisible();
    await expect(page.locator("#tradingName")).toHaveValue("Sunrise Supports");
    await expect(page.locator("#structure-sole-trader")).toBeChecked();
    await expect(page.locator("#states-NSW")).toBeChecked();
    await expect(page.locator("#ownerName")).toHaveValue("Jane Citizen");
    await expect(page.locator("#ownerRole")).toHaveValue("Owner");

    // A second visit to the setup page lands on the account: never a second account.
    await page.goto("/account/setup");
    await expect(page).toHaveURL(/\/account$/);
  });
});

/** REQ-023 Session A evidence: the screenshots the Supabase job saves under EVIDENCE=1. */
const EVIDENCE_DIR = "product/evidence/req-023";
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

/** The product's calendar is Australia/Sydney (D-2242): every date the page derives is read against it. */
const sydney = (days: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86_400_000));
/** Calendar months on an ISO date, the way `addMonths` in the app does it (day clamped to the month's end). */
const plusMonths = (iso: string, months: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)),
  )
    .toISOString()
    .slice(0, 10);
};

/**
 * REQ-023 Session A, AC-1 on the three projects (finding 57): the owner types
 * the certificate's dates, the timeline shows the rows with their source
 * words and the dates seeded relative to the run day, the audit-day page
 * shows the legal rows alone (D-2314), the registers page links to the
 * timeline, and the checklist carries the dated audit items (FR-4).
 */
test.describe("the registration timeline (REQ-023 Session A)", () => {
  test.skip(!enabled, "needs the Supabase variables");

  let tenant: TestTenant;
  // The fixture is the answers object itself (`answersVersion`, `business`,
  // `supports` at the top level), passed whole as `accessibility-pass.spec.ts`
  // does; #73's third run failed at `session.ts:81` on `answers.answers`.
  const answers = JSON.parse(
    readFileSync(
      "fixtures/reference-cases/certification-personal-care.json",
      "utf8",
    ),
  ) as Record<string, unknown>;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `timeline-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the dates from the certificate become the timeline, the audit-day rows and the dated checklist items", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    // Seven months in, as AC-1's fixture; three years long, as is usual.
    const starts = sydney(-213);
    const ends = plusMonths(starts, 36);
    await signInContext(context, tenant, baseURL!);
    await page.goto("/account");
    const form = page.getByTestId("registration-form");
    await expect(form).toBeVisible();
    await expect(page.getByTestId("registration-midterm")).toHaveAttribute(
      "data-applies",
      "true",
    );
    await page.locator("#periodStartsOn").fill(starts);
    await page.locator("#periodEndsOn").fill(ends);
    await page.locator("#auditType-certification").check();
    const save = page.getByTestId("registration-save");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByTestId("registration-saved")).toHaveText("Saved.");

    // FR-2: every row with its date and its source word; the sentence and the fixed line under the table.
    const table = page.getByTestId("registration-timeline");
    await expect(table).toBeVisible();
    const row = (id: string) => page.getByTestId(`timeline-row-${id}`);
    await expect(row("midterm-prepare")).toHaveAttribute(
      "data-date",
      plusMonths(starts, 12),
    );
    await expect(row("midterm-prepare")).toHaveAttribute(
      "data-source",
      "our suggestion",
    );
    await expect(row("midterm-start-by")).toHaveAttribute(
      "data-date",
      plusMonths(starts, 18),
    );
    await expect(row("midterm-start-by")).toHaveAttribute(
      "data-source",
      "Rules s 13B",
    );
    await expect(row("renewal-window")).toHaveAttribute(
      "data-date",
      plusMonths(ends, -6),
    );
    await expect(row("renewal-window")).toHaveAttribute(
      "data-source",
      "NDIS Act s 73K",
    );
    await expect(row("renewal-apply-by")).toHaveAttribute(
      "data-date",
      plusMonths(ends, -3),
    );
    await expect(row("period-end")).toHaveAttribute("data-date", ends);
    await expect(row("period-end")).toHaveAttribute(
      "data-source",
      "your certificate",
    );
    await expect(page.getByTestId("registration-position")).toContainText(
      "Prepare for your mid-term audit from",
    );
    await expect(page.getByTestId("registration-fixed-sentence")).toContainText(
      "The dates on your certificate rule",
    );
    await checkWidths(page, "account with the timeline");
    await shot(page, "timeline", project);

    // D-2314: the audit-day copy shows the legal rows only.
    await page.goto("/path/audit-day");
    const auditDay = page.getByTestId("audit-day-timeline");
    await expect(auditDay).toBeVisible();
    await shot(page, "audit-day-dates", project);
    await expect(
      auditDay.getByTestId("timeline-row-midterm-start-by"),
    ).toBeVisible();
    await expect(
      auditDay.getByTestId("timeline-row-renewal-window"),
    ).toBeVisible();
    await expect(auditDay.getByTestId("timeline-row-period-end")).toBeVisible();
    await expect(
      auditDay.getByTestId("timeline-row-midterm-prepare"),
    ).toHaveCount(0);
    await expect(
      auditDay.getByTestId("timeline-row-renewal-apply-by"),
    ).toHaveCount(0);

    // FR-1: the registers page points at the timeline instead of its own date.
    await page.goto("/registers");
    await expect(page.getByTestId("registration-timeline-link")).toContainText(
      "See your registration timeline",
    );

    // FR-4 (AC-7): the dated items replace the booking and calendar items; a date sets Done.
    await page.goto("/checklist");
    await expect(
      page.getByTestId("checklist-item-audit-mid-term-audit-started"),
    ).toBeVisible();
    await expect(
      page.getByTestId("checklist-item-audit-book-audit"),
    ).toHaveCount(0);
    await page.getByTestId("checklist-row-audit-renewal-audit-done").click();
    await page.locator("#audit-renewal-audit-done-date").fill(sydney(-1));
    await expect(
      page.getByTestId("item-feedback-audit-renewal-audit-done"),
    ).toContainText("Saved");
    const stored = await tenant.admin
      .from("checklist_items")
      .select("status, done_on")
      .eq("account_id", tenant.accountId)
      .eq("item_id", "audit:renewal-audit-done")
      .single();
    expect(stored.data).toEqual({ status: "have", done_on: sydney(-1) });
  });
});
