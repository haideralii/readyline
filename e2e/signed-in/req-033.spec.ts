import { test, expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import {
  generateAuditorToken,
  hashAuditorToken,
} from "@/lib/registers/auditor-link";
import { axeSerious } from "../helpers/a11y";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { expectNoSidewaysScroll } from "../helpers/width";

/**
 * REQ-033 AC-1, AC-3, AC-4, AC-5, AC-8 (D-2930, D-2931, D-2935): the sample
 * report pasted gives three candidates, the one naming a person is held
 * until its words change, then all three save; a row names the document and
 * section that answer it with a link that opens; marking it addressed closes
 * its improvement row and recording the auditor's verification sets
 * verified; the audit-day card counts; the auditor's view and the pack's
 * findings CSV carry the rows; axe is clean at 360 and 1280. Needs a
 * Supabase stack.
 */
const enabled = hasSupabaseForE2e();
const report = readFileSync("fixtures/findings/sample-report.txt", "utf8");
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;

async function axeAt(page: Page, width: number, label: string) {
  await page.setViewportSize({ width, height: width < 800 ? 740 : 800 });
  expect(await axeSerious(page, `${label} at ${width}`)).toEqual([]);
  await expectNoSidewaysScroll(page, `${label} at ${width}`);
}

test.describe("bring your audit findings (REQ-033)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `req-033-${testInfo.project.name}`,
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

  test("AC-1: three candidates from the pasted report; the one naming a person is held until edited, then all three save", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers/findings");
    await expect(page.getByTestId("findings-list-empty")).toBeVisible();
    await page.goto("/registers/findings/import");
    await expect(page.getByTestId("findings-never-stored")).toContainText(
      "nothing of the file is kept, logged or sent to a model",
    );
    await page.getByTestId("findings-paste").fill(report);
    await page.getByTestId("findings-find").click();
    const candidates = page.getByTestId("findings-candidate");
    await expect(candidates).toHaveCount(3);
    await expect(candidates.nth(2)).toHaveAttribute("data-blocked", "true");
    await expect(
      candidates.nth(2).getByTestId("findings-candidate-warning"),
    ).toContainText("person's name");
    await expect(page.getByTestId("findings-save")).toBeDisabled();
    await expect(page.getByTestId("findings-blocked")).toContainText(
      "1 marked above cannot be saved",
    );
    // The provider's own words: the name becomes a code and the save opens.
    const third = candidates.nth(2).getByTestId("findings-candidate-text");
    await third.fill(
      (await third.inputValue()).replace("Mr J. Smith", "participant P-014"),
    );
    await expect(candidates.nth(2)).toHaveAttribute("data-blocked", "false");
    await expect(page.getByTestId("findings-save")).toBeEnabled();
    await page.getByTestId("findings-save").click();
    await expect(page).toHaveURL(/\/registers\/findings\?saved=3$/);
    await expect(page.getByTestId("findings-list").locator("li")).toHaveCount(
      3,
    );
    await expect(page.getByTestId("findings-list")).toContainText("FND-0003");
    await expect(page.getByTestId("findings-list")).toContainText("FND-0001");
    await axeAt(page, 1280, "findings list");
    await axeAt(page, 360, "findings list");
  });

  test("AC-3: a row names the document and section that answer it, with a link that opens", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers/findings");
    await page
      .getByTestId("findings-list")
      .getByRole("link", { name: /FND-0001/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/registers\/findings\/[0-9a-f-]{36}$/);
    const answers = page.getByTestId("finding-answered-in");
    await expect(answers).toBeVisible();
    await expect(answers).toContainText("Incident management policy");
    await expect(answers).toContainText(/section \d+/);
    await expect(answers).toContainText("Incident register");
    const link = page.getByTestId("finding-answer-link").first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/documents/);
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await axeAt(page, 360, "finding row");
  });

  test("AC-4, AC-5: addressing closes the improvement row, verification sets verified, the card counts, the auditor's view and the pack carry the rows", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-findings")).toContainText(
      "Findings from your last audit: 3 open",
    );
    await page.goto("/registers/findings");
    await page
      .getByTestId("findings-list")
      .getByRole("link", { name: /FND-0001/ })
      .first()
      .click();
    await page.getByTestId("finding-addressed-on").fill("2026-10-02");
    await page.getByTestId("finding-addressed-role").fill("Owner");
    await page.getByTestId("finding-address").click();
    await expect(page.getByText("Addressed 2 October 2026")).toBeVisible();
    const improvement = await tenant.admin
      .from("improvements")
      .select("done_on, source_kind")
      .eq("account_id", tenant.accountId)
      .eq("source_ref", "FND-0001")
      .single();
    expect(improvement.data).toEqual({
      done_on: "2026-10-02",
      source_kind: "audit-finding",
    });
    await page.getByTestId("finding-verified-on").fill("2026-10-09");
    await page.getByTestId("finding-verify").click();
    await expect(
      page.getByText("Verified by the auditor 9 October 2026"),
    ).toBeVisible();
    await expect(page.getByTestId("finding-actions")).toHaveCount(0);
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-findings")).toContainText(
      "Findings from your last audit: 2 open, 1 verified by the auditor",
    );
    // The auditor's view and the pack.
    const token = generateAuditorToken();
    const link = await tenant.admin.from("auditor_links").insert({
      account_id: tenant.accountId,
      token_hash: hashAuditorToken(token),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    if (link.error) throw link.error;
    const auditor = await context.newPage();
    await auditor.goto(`/auditor/${token}`);
    await expect(auditor.getByRole("heading", { level: 1 })).toContainText(
      "Audit view",
    );
    await expect(auditor.locator("body")).toContainText("Audit findings");
    await expect(auditor.locator("body")).toContainText("FND-0001");
    await auditor.close();
    const pack = await page.request.get("/registers/audit-pack.zip");
    expect(pack.status()).toBe(200);
    const names = Object.keys(unzipSync(new Uint8Array(await pack.body())));
    const csv = names.find((n) => /^findings/.test(n));
    expect(csv, names.join(", ")).toBeTruthy();
  });
});
