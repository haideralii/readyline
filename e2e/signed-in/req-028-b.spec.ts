import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  PLANTED_NAME,
  seedComplaint,
  seedCorporateRisk,
  seedIncidents,
} from "../helpers/registers-seed";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";
import { zoom200NoSidewaysScroll } from "../helpers/a11y";
import { checkWidths } from "../helpers/width";
import { formatShortDateAu } from "@/lib/registers/table-columns";

/**
 * REQ-028 Session B (FR-7, FR-8, AC-6, AC-7) on `desktop-chromium` and
 * `android-small`: the registers index's pack button with its last-download
 * line, the "What is in the pack" disclosure and the ready line; the
 * incidents table at 1280 with D-2814's five headers and no other, the
 * rows in the register's order, and a name planted in every narrative
 * field of three registers reaching no cell of their tables; the cards at
 * 360; an empty register's one sentence and primary. Screenshots under
 * product/evidence/req-028/ with EVIDENCE=1 (the after set, D-2271 (12)).
 * Needs a Supabase stack.
 */
const EVIDENCE_DIR = "product/evidence/req-028";
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
    path: `${EVIDENCE_DIR}/${name}-b-${project}.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 35,
    scale: "css",
  });
}

const large = (page: Page) => (page.viewportSize()?.width ?? 0) >= 640;

test.describe("REQ-028 Session B: the registers on a laptop", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `req-028-b-${testInfo.project.name}`,
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

  test("the index: the pack button, its last-download line, what is in the pack, and the ready line (FR-7, AC-7)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers");
    const button = page.getByTestId("audit-pack-download");
    await expect(button).toHaveText("Download my audit pack as one file (zip)");
    await expect(button).toHaveClass(/btn-primary/);
    await expect(page.getByTestId("audit-pack-last-downloaded")).toHaveText(
      "Not downloaded yet",
    );
    // The disclosure lists the kinds the pack holds.
    await page.getByTestId("pack-contents-summary").click();
    const kinds = page.getByTestId("pack-contents-list").getByRole("listitem");
    expect(await kinds.count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId("pack-contents-list")).toContainText(
      "document control register",
    );
    // Nothing started yet: a full ochre line and the sentence.
    await expect(page.getByTestId("registers-ready-line-text")).toHaveText(
      "0 of 17 registers started",
    );
    await expect(page.getByTestId("registers-ready-line-todo")).toBeVisible();
    // The cards: two columns from lg, one under it; every register is a link.
    const incidents = page.getByTestId("register-incidents");
    await expect(incidents).toBeVisible();
    await checkWidths(page, "registers index");
    await shot(page, "registers-index", project);

    // One download through the request context (shares the cookies), then the line reads the day.
    const res = await page.request.get("/registers/audit-pack.zip");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("zip");
    await page.reload();
    await expect(page.getByTestId("audit-pack-last-downloaded")).toHaveText(
      /^Last downloaded \d{1,2} [A-Z][a-z]+ \d{4}$/,
    );
  });

  test("the incidents table at 1280 has D-2814's headers in the register's order, the cards at 360, and the planted name reaches no cell (FR-8, AC-6)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    const { newestOccurredOn } = await seedIncidents(tenant, 30);
    await seedComplaint(tenant);
    await seedCorporateRisk(tenant);

    await page.goto("/registers/incidents");
    const list = page.getByTestId("incidents-list");
    await expect(list.getByText("All (30)")).toBeVisible();
    const table = page.getByTestId("incidents-list-table");
    if (large(page)) {
      await expect(table).toBeVisible();
      expect(await table.getByRole("columnheader").allTextContents()).toEqual([
        "Ref",
        "Occurred",
        "Category",
        "Status",
        "Notify by",
      ]);
      const rows = table.locator("tbody tr");
      await expect(rows).toHaveCount(30);
      // The register's order: the newest occurrence first, as the list has it.
      await expect(rows.first().locator("td").nth(1)).toHaveText(
        formatShortDateAu(newestOccurredOn),
      );
      await expect(
        rows.first().locator("td").nth(0).getByRole("link"),
      ).toHaveAttribute("href", /\/registers\/incidents\//);
      // The not-reportable rows show the empty word, muted, never a blank.
      await expect(rows.first().locator("td").nth(4)).toHaveText(
        "Not reportable",
      );
      await expect(table).not.toContainText(PLANTED_NAME);
      // The cards are in the DOM for the phone and hidden here.
      await expect(list.locator("ul > li").first()).toBeHidden();
    } else {
      await expect(table).toBeHidden();
      await expect(list.locator("ul > li")).toHaveCount(30);
      await expect(list.locator("ul > li").first()).toBeVisible();
    }
    await checkWidths(page, "incidents table");
    // PO 19:25: the header row with three controls and the table at doubled text, so the public job sees it.
    await zoom200NoSidewaysScroll(page, "incidents list with rows");
    await shot(page, "incidents-table", project);

    // The planted name is on the entry's own page and in no table cell of the other two registers.
    await page.goto("/registers/complaints");
    if (large(page))
      await expect(page.getByTestId("complaints-list-table")).not.toContainText(
        PLANTED_NAME,
      );
    await expect(page.getByTestId("complaints-list")).toContainText("CMP-");
    await page.goto("/registers/corporate-risks");
    if (large(page)) {
      const risks = page.getByTestId("corporate-risks-list-table");
      await expect(risks).toBeVisible();
      await expect(risks).not.toContainText(PLANTED_NAME);
      expect(await risks.getByRole("columnheader").allTextContents()).toEqual([
        "Area",
        "How likely",
        "Owner (role)",
        "Review by",
        "Status",
      ]);
    }
    await shot(page, "corporate-risks-table", project);

    // AC-7: three registers hold a row now (the starter rows made the corporate risks one of them).
    await page.goto("/registers");
    await expect(page.getByTestId("registers-ready-line-text")).toHaveText(
      "3 of 17 registers started",
    );
    await expect(page.getByTestId("registers-ready-line-done")).toBeVisible();
  });

  test("an empty register shows its one sentence and the primary to add the first entry, and the header's actions step aside (FR-8, AC-7)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const project = testInfo.project.name;
    await signInContext(context, tenant, baseURL!);
    await page.goto("/registers/hazards");
    const empty = page.getByTestId("hazards-list-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("No hazards yet.");
    await expect(empty.getByTestId("register-add")).toHaveText("Add a hazard");
    await expect(page.getByTestId("register-actions")).toHaveCount(0);
    await expect(page.getByTestId("hazards-list-table")).toHaveCount(0);
    await shot(page, "hazards-empty", project);
  });
});
