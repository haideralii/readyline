import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { axeSerious } from "../helpers/a11y";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { checkWidths } from "../helpers/width";
import { addDays, minusBusinessDays, todaySydney } from "../helpers/dates";

/**
 * REQ-020 Session B, AC-3 and AC-4 on the three projects: the owner invites
 * a worker from the account page; the worker accepts the link signed in,
 * lands on their home, logs an incident with the same form and sees only
 * their own entries; every owner page bounces them home; the owner sees who
 * logged the row and removes the worker, which ends their access. Then the
 * report link: a signed-out report becomes a draft the owner is told about
 * on the registers index, confirms on one screen into an ordinary row with
 * the notification clock running, and the link turned off is a 404. Needs
 * a Supabase stack; skips without one.
 */
const EVIDENCE_DIR = "product/evidence/req-020";
const enabled = hasSupabaseForE2e();
// D-2272: every date the spec types follows the runner's Sydney day.
const today = todaySydney();

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

test.describe("the worker role and the report link (REQ-020 Session B)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let owner: TestTenant;
  let worker: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    owner = await createTenant({
      label: `team-owner-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers: {},
    });
    const ent = await owner.admin
      .from("entitlements")
      .insert({ account_id: owner.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    worker = await createTenant({
      label: `team-worker-${testInfo.project.name}`,
      tradingName: "",
      answers: {},
      withAccount: false,
    });
  });

  test.afterAll(async () => {
    if (worker) await deleteTenant(worker);
    if (owner) await deleteTenant(owner);
  });

  test("the owner invites a worker; the worker logs an incident and sees only their rows; removal ends access (AC-3)", async ({
    page,
    context,
    browser,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, owner, baseURL!);
    await page.goto("/account");
    await expect(page.getByTestId("account-team")).toBeVisible();
    await expect(page.getByTestId("team-panel")).toContainText(
      "A worker can log incidents and complaints and complete their onboarding, and see what they logged.",
    );
    await page.getByLabel("Their email address").fill(worker.email);
    await page.getByLabel("Their worker code").fill("w-003");
    await page.getByTestId("team-invite-submit").click();
    const inviteUrl = await page.getByTestId("team-invite-url").inputValue();
    expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
    await page.reload();
    await expect(page.getByTestId("team-invitation")).toContainText(
      "Worker W-003",
    );
    await checkWidths(page, "account with the team panel");
    expect(await axeSerious(page, "account team panel")).toEqual([]);
    await shot(page, "team-invited", project);

    // The worker, signed in with the invited address, accepts.
    const workerContext = await browser.newContext();
    await signInContext(workerContext, worker, baseURL!);
    const w = await workerContext.newPage();
    await w.goto(inviteUrl);
    await expect(w.getByRole("heading", { level: 1 })).toContainText(
      "Sunrise Supports has invited you",
    );
    await expect(w.getByTestId("invite-line")).toContainText(
      "You would log as worker W-003.",
    );
    await w.getByTestId("invite-accept").click();
    await expect(w).toHaveURL(/\/worker$/);
    // REQ-024 SR-1 (AC-11): the collection notice shows first and once, in
    // the words D-2414 fixed ("the provider you work for", the recipients,
    // the one-time file), and one button records that it was seen.
    const notice = w.getByTestId("worker-collection-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("the provider you work for");
    await expect(notice).toContainText("one-time file");
    await expect(notice).toContainText("your manager's auditor");
    await expect(notice).not.toContainText("your employer");
    await shot(w, "worker-notice", project);
    await w.getByTestId("worker-notice-continue").click();
    await expect(w.getByTestId("worker-home-line")).toBeVisible();
    await w.goto("/worker");
    await expect(w.getByTestId("worker-collection-notice")).toHaveCount(0);
    await expect(w.getByTestId("worker-home-line")).toContainText(
      "Your manager sees everything else. Your code is W-003.",
    );
    await expect(w.getByTestId("nav-worker")).toBeVisible();
    await expect(w.getByTestId("site-nav")).not.toContainText("Registers");
    await checkWidths(w, "worker home");
    expect(await axeSerious(w, "worker home")).toEqual([]);
    await shot(w, "worker-home", project);

    // The same incident form, saved as the worker's row.
    await w.getByTestId("worker-log-incident").click();
    await expect(
      w.getByRole("heading", { level: 1, name: "Log an incident" }),
    ).toBeVisible();
    await expect(w.getByTestId("emergency-line")).toContainText("call 000");
    // D-2272: dates follow the runner's Sydney day.
    const occurred = minusBusinessDays(today, 2);
    await w.getByLabel("Date it happened").fill(occurred);
    await w.getByLabel("Date it was reported").fill(occurred);
    await w
      .getByLabel("What happened", { exact: true })
      .selectOption("near-miss");
    await w.getByLabel("How serious").selectOption("low");
    await w.getByLabel(/Participant code/).fill("p-014");
    await w
      .getByLabel(/What happened, in a sentence/)
      .fill("Near miss on the stairs; no harm.");
    expect(await axeSerious(w, "worker incident form")).toEqual([]);
    await w.getByTestId("register-submit").click();
    await expect(w).toHaveURL(/\/worker\?saved=1$/);
    await expect(w.getByTestId("worker-entry")).toHaveCount(1);
    await expect(w.getByTestId("worker-entry")).toContainText("INC-0001");

    // Every owner page sends the worker home; the exports are not theirs.
    for (const path of [
      "/registers",
      "/registers/incidents",
      "/documents",
      "/checklist",
      "/account",
      "/path/audit-day",
    ]) {
      await w.goto(path);
      await expect(w, path).toHaveURL(/\/worker$/);
    }
    for (const path of [
      "/registers/incidents/export.zip",
      "/registers/audit-pack.zip",
      "/account/export",
    ]) {
      const r = await workerContext.request.get(path, { maxRedirects: 0 });
      expect(r.status(), path).not.toBe(200);
    }

    // The owner sees who logged it.
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("incidents-list")).toContainText(
      "Logged by W-003",
    );
    await page.getByRole("link", { name: /INC-0001/ }).click();
    await expect(page.getByTestId("incident-facts")).toContainText("Logged by");
    await expect(page.getByTestId("incident-facts")).toContainText("W-003");

    // Removal: the worker's next request finds no membership; the row stays.
    await page.goto("/account");
    await expect(page.getByTestId("team-worker")).toContainText("Worker W-003");
    await page.getByTestId("team-worker-remove").click();
    await expect(page.getByTestId("team-worker")).toHaveCount(0);
    await w.goto("/worker");
    await expect(w).toHaveURL(/\/account\/setup$/);
    await workerContext.close();
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("incidents-list")).toContainText("INC-0001");

    const audit = await owner.admin
      .from("audit_log")
      .select("action")
      .eq("account_id", owner.accountId);
    const actions = (audit.data ?? []).map((r) => r.action as string);
    for (const a of [
      "invitation.created",
      "invitation.accepted",
      "worker.removed",
    ])
      expect(actions, a).toContain(a);
  });

  test("the report link: a signed-out report waits as a draft until the owner confirms it on one screen (AC-4)", async ({
    page,
    context,
    browser,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, owner, baseURL!);
    await page.goto("/account");
    await expect(page.getByTestId("team-report-link-state")).toContainText(
      "The report link is off.",
    );
    await page.getByTestId("team-report-link-create").click();
    const url = await page.getByTestId("team-report-link-url").inputValue();
    expect(url).toMatch(/\/report\/[A-Za-z0-9_-]{43}$/);
    await expect(page.getByTestId("team-report-link-state")).toContainText(
      "The report link is on",
    );

    // A signed-out person reports.
    const reporter = await browser.newContext();
    const r = await reporter.newPage();
    expect((await r.goto(url))?.status()).toBe(200);
    await expect(r.getByRole("heading", { level: 1 })).toContainText(
      "Report an incident to Sunrise Supports",
    );
    await expect(r.getByTestId("emergency-line")).toContainText("call 000");
    expect(
      await r.locator('meta[name="robots"]').getAttribute("content"),
    ).toMatch(/noindex/);
    const html = await r.content();
    expect(html.includes(owner.email)).toBe(false);
    expect(html.includes(owner.accountId)).toBe(false);
    await r.getByLabel("Who are you").selectOption("support worker");
    await r.getByLabel("Date it happened").fill(today);
    await r
      .getByLabel("What happened", { exact: true })
      .selectOption("serious-injury");
    await r.getByLabel("How serious it was").selectOption("high");
    await r.getByLabel(/Participant code/).fill("p-021");
    await r
      .getByLabel(/What happened, in a sentence/)
      .fill("Fall in the bathroom; ambulance called.");
    await checkWidths(r, "report form");
    expect(await axeSerious(r, "report form")).toEqual([]);
    await shot(r, "report-form", project);
    await r.getByTestId("report-submit").click();
    await expect(r.getByTestId("report-done")).toContainText(
      /Thank you\. The owner has been told and will confirm it.*INC-\d{4}/,
    );
    await reporter.close();

    // The owner is told on the index and the register; the draft counts nowhere yet.
    await page.goto("/registers");
    await expect(page.getByTestId("reports-to-confirm")).toContainText(
      "1 report to confirm",
    );
    await expect(page.getByTestId("register-incidents")).toContainText(
      "1 entry",
    );
    await page.goto("/registers/incidents");
    await expect(page.getByTestId("reports-to-confirm")).toContainText(
      "1 report to confirm",
    );
    await page.getByTestId("confirm-report-link").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /Confirm INC-\d{4}/,
    );
    await expect(page.getByTestId("aware-line")).toContainText(
      /^Reported \d{1,2} \w+, \d{1,2}:\d{2} [ap]m; if this is a reportable incident the Commission must be told by/,
    );
    await expect(page.getByTestId("report-facts")).toContainText(
      "support worker",
    );
    await expect(page.getByTestId("report-summary")).toContainText(
      "Fall in the bathroom",
    );
    await checkWidths(page, "confirm screen");
    expect(await axeSerious(page, "confirm screen")).toEqual([]);
    await shot(page, "confirm-report", project);
    await page.getByLabel("Reportable to the Commission").check();
    await page.getByTestId("confirm-report-submit").click();
    await expect(page).toHaveURL(
      /\/registers\/incidents\/[0-9a-f-]{36}\?saved=1$/,
    );
    await expect(page.getByTestId("status-tag")).toContainText("Notify by");
    await expect(page.getByTestId("incident-facts")).toContainText(
      "Reported through your link by",
    );
    await page.goto("/registers");
    await expect(page.getByTestId("reports-to-confirm")).toHaveCount(0);
    await expect(page.getByTestId("register-incidents")).toContainText(
      "2 entries",
    );

    // Retro finding 62 (D-2244): a second report, in a reportable category,
    // rejected by the owner. The reject form says the clock runs on; the row
    // reads received, not recorded, with its notify-by date; the owner then
    // records the date the Commission was told and the clock stops.
    const reporter2 = await browser.newContext();
    const r2 = await reporter2.newPage();
    expect((await r2.goto(url))?.status()).toBe(200);
    await r2.getByLabel("Who are you").selectOption("casual worker");
    await r2.getByLabel("Date it happened").fill(addDays(today, -1));
    await r2
      .getByLabel("What happened", { exact: true })
      .selectOption("abuse-or-neglect");
    await r2.getByLabel("How serious it was").selectOption("medium");
    await r2
      .getByLabel(/What happened, in a sentence/)
      .fill("A family member says a worker shouted at the participant.");
    await r2.getByTestId("report-submit").click();
    await expect(r2.getByTestId("report-done")).toContainText(/INC-\d{4}/);
    await reporter2.close();
    await page.goto("/registers/incidents");
    await page.getByTestId("confirm-report-link").click();
    await expect(page.getByTestId("reject-report")).toBeVisible();
    await page.getByText("Not an incident? Reject it").click();
    await expect(page.getByTestId("reject-still-reportable")).toContainText(
      "An allegation of this kind is still reportable; rejecting the report does not stop the Commission's clock.",
    );
    await page
      .getByLabel("Why you are rejecting it")
      .fill(
        "Not one of our participants; the person named is not on our books.",
      );
    await page.getByTestId("reject-report-submit").click();
    await expect(page).toHaveURL(/\/registers\/incidents\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("status-tag")).toContainText(
      "Received, not recorded",
    );
    await expect(page.getByTestId("incident-facts")).toContainText(
      "Notify the Commission by",
    );
    await shot(page, "rejected-still-reportable", project);
    await page.getByLabel("Date you told the Commission").fill(today);
    await page.getByTestId("rejected-notified-submit").click();
    await expect(page).toHaveURL(/\?saved=1$/);
    await expect(page.getByTestId("status-tag")).toContainText(
      "Received, not recorded; Commission told",
    );
    await page.goto("/registers");
    await expect(page.getByTestId("register-incidents")).toContainText(
      "3 entries",
    );

    // Off: the link is a plain 404.
    await page.goto("/account");
    await page.getByTestId("team-report-link-revoke").click();
    await expect(page.getByTestId("team-report-link-state")).toContainText(
      "The report link is off.",
    );
    const dead = await browser.newContext();
    expect((await (await dead.newPage()).goto(url))?.status()).toBe(404);
    await dead.close();

    const audit = await owner.admin
      .from("audit_log")
      .select("action")
      .eq("account_id", owner.accountId);
    const actions = (audit.data ?? []).map((r) => r.action as string);
    for (const a of [
      "report_link.created",
      "report.submitted",
      "report.confirmed",
      "report.rejected",
      "report.notified",
      "report_link.revoked",
    ])
      expect(actions, a).toContain(a);
  });
});
