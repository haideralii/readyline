import { test, expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import { documentTypeById } from "@/lib/generator/catalogue";
import { buildSkeleton } from "@/lib/generator/document-model";
import { buildProviderFacts } from "@/lib/generator/facts";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import {
  generateAuditorToken,
  hashAuditorToken,
} from "@/lib/registers/auditor-link";
import { getStandardsDataset } from "@/lib/standards/dataset";
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
  let setId = "";
  const INCIDENT_TYPE = "incident-management-policy-and-register";

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
    // AC-3 needs the provider's set: one ready version of the incident
    // management policy from the sole-trader fixture's skeleton, as the
    // fill-at-download spec seeds its set.
    const c = loadReferenceCases()[0];
    const set = await tenant.admin
      .from("version_sets")
      .insert({
        account_id: tenant.accountId,
        created_by: tenant.userId,
        answers_snapshot_hash: "req-033-e2e",
        derived_result: c.result,
        status: "ready",
        document_count: 1,
        fallback_section_count: 0,
        generated_count: 0,
        storage_prefix: "",
      })
      .select("id")
      .single();
    if (set.error) throw set.error;
    setId = set.data.id as string;
    const model = buildSkeleton({
      type: documentTypeById(INCIDENT_TYPE)!,
      facts: buildProviderFacts(c.answers, c.result),
      dataset: getStandardsDataset(),
      result: c.result,
      version: "1",
      generatedAt: "2026-10-14",
    });
    // Session B (AC-B1 to AC-B3): the tailored sections carry words, as a generated
    // version would, so the redraft has a current text to keep and to add to.
    const drafted = {
      ...model,
      sections: model.sections.map((sec) =>
        sec.mode === "tailored"
          ? {
              ...sec,
              status: "generated" as const,
              blocks: [
                {
                  type: "paragraph" as const,
                  text: `Sunrise Supports, a sole trader in New South Wales, keeps this ${sec.heading.toLowerCase()} in writing and reads it with every worker. We record what we do and keep the record for 7 years.`,
                },
              ],
            }
          : sec,
      ),
    };
    const ins = await tenant.admin.from("document_versions").insert({
      version_set_id: setId,
      account_id: tenant.accountId,
      document_type_id: INCIDENT_TYPE,
      version: 1,
      status: "ready",
      storage_path: `${tenant.accountId}/${setId}/${INCIDENT_TYPE}.v1.docx`,
      model: drafted,
    });
    if (ins.error) throw ins.error;
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
    // AC-8: the new page, with its candidates showing, at both widths.
    await axeAt(page, 1280, "findings import");
    await axeAt(page, 360, "findings import");
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
    await expect(link).toHaveAttribute(
      "href",
      `/documents/${setId}/${INCIDENT_TYPE}`,
    );
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/documents/${setId}/`));
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
    await expect(
      page.getByText("Addressed 2 October 2026").locator("visible=true"),
    ).toBeVisible();
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
      page
        .getByText("Verified by the auditor 9 October 2026")
        .locator("visible=true"),
    ).toBeVisible();
    await expect(page.getByTestId("finding-actions")).toHaveCount(0);
    // AC-4's other direction: closing the improvement row from its own
    // register marks its finding addressed with the row's day.
    await page.goto("/registers/improvements");
    await page
      .getByTestId("improvements-list")
      .getByRole("link", { name: /Audit finding FND-0002/ })
      .first()
      .click();
    await page.getByTestId("row-edit").locator("summary").click();
    await page.locator("#done_on").fill("2026-10-05");
    await page
      .getByTestId("audit-day-form-improvements")
      .getByRole("button", { name: "Save changes" })
      .click();
    await expect(
      page.getByText("Done 2026-10-05").locator("visible=true"),
    ).toBeVisible();
    await page.goto("/registers/findings");
    await page
      .getByTestId("findings-list")
      .getByRole("link", { name: /FND-0002/ })
      .first()
      .click();
    await expect(
      page.getByText("Addressed 5 October 2026").locator("visible=true"),
    ).toBeVisible();
    await page.goto("/path/audit-day");
    await expect(page.getByTestId("audit-day-findings")).toContainText(
      "Findings from your last audit: 1 open, 1 addressed, 1 verified by the auditor",
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

  test("Session B AC-B1 to AC-B3, AC-B8, AC-B9: the redraft shown beside the current text, accepted into version 2 awaiting adoption, then adopted; the register line says why it has no button", async ({
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
    const findingUrl = page.url();
    // AC-B8: the register line has no button and says why.
    await expect(page.getByTestId("finding-no-redraft").first()).toContainText(
      "This is a register",
    );
    const link = page.getByTestId("finding-redraft-link").first();
    await expect(link).toContainText("Redraft this section with the finding");
    await link.click();
    await expect(page).toHaveURL(
      new RegExp(`/registers/findings/[0-9a-f-]{36}/redraft/${INCIDENT_TYPE}$`),
    );
    await expect(page.getByTestId("redraft-intro")).toContainText(
      "Your auditor decides whether the finding is closed.",
    );
    await expect(page.getByTestId("redraft-finding")).toContainText(
      "no record of the Commission being notified",
    );
    // AC-B9: the page before and after the redraft, both widths.
    await axeAt(page, 1280, "redraft page");
    await axeAt(page, 360, "redraft page");
    // AC-B1: the redraft beside the current text; nothing stored yet.
    await page.getByTestId("redraft-draft").click();
    await expect(page.getByTestId("redraft-review")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("redraft-current")).toContainText(
      "Sunrise Supports",
    );
    await expect(page.getByTestId("redraft-proposed")).toContainText(
      "how to raise a concern when supports begin",
    );
    await expect(page.getByTestId("redraft-changed").first()).toBeVisible();
    const before = await tenant.admin
      .from("document_versions")
      .select("version")
      .eq("account_id", tenant.accountId)
      .eq("document_type_id", INCIDENT_TYPE);
    expect(before.data).toHaveLength(1);
    await axeAt(page, 1280, "redraft review");
    await axeAt(page, 360, "redraft review");
    // AC-B2: "Use this redraft" makes version 2, unadopted, with its change-log row and the links.
    await page.getByTestId("redraft-use").click();
    await expect(page).toHaveURL(
      new RegExp(`/documents/${setId}/${INCIDENT_TYPE}`),
      {
        timeout: 60_000,
      },
    );
    const versions = await tenant.admin
      .from("document_versions")
      .select("id, version, adopted_on, model")
      .eq("account_id", tenant.accountId)
      .eq("document_type_id", INCIDENT_TYPE)
      .order("version", { ascending: false });
    expect(versions.data).toHaveLength(2);
    const v2 = versions.data![0] as {
      id: string;
      version: number;
      adopted_on: string | null;
      model: {
        sections: {
          id: string;
          blocks: { type: string; rows?: string[][] }[];
        }[];
      };
    };
    expect(v2.version).toBe(2);
    expect(v2.adopted_on).toBeNull();
    const changeLog = v2.model.sections.find((x) => x.id === "change-log")!;
    const rows = changeLog.blocks.find((b) => b.type === "table")!.rows!;
    expect(rows.at(-1)![2]).toMatch(
      /redrafted after audit finding FND-0001; approved by \[role\]$/,
    );
    const finding = await tenant.admin
      .from("findings")
      .select("redraft_version_id, redraft_section_id, improvement_id")
      .eq("account_id", tenant.accountId)
      .eq("reference", "FND-0001")
      .single();
    expect(finding.data!.redraft_version_id).toBe(v2.id);
    expect(finding.data!.redraft_section_id).not.toBe("");
    const improvement = await tenant.admin
      .from("improvements")
      .select("changed")
      .eq("id", finding.data!.improvement_id as string)
      .single();
    expect(improvement.data!.changed).toMatch(/redrafted \(version 2\)\.$/);
    const audit = await tenant.admin
      .from("audit_log")
      .select("action, target")
      .eq("account_id", tenant.accountId)
      .eq("action", "documents.redrafted");
    expect(audit.data).toHaveLength(1);
    expect((audit.data![0] as { target: string }).target).toBe(
      `${INCIDENT_TYPE}:2:FND-0001`,
    );
    await page.goto(findingUrl);
    await expect(page.getByTestId("finding-redraft-state")).toContainText(
      "version 2, awaiting adoption",
    );
    // AC-B3: adoption through the existing function fills the snapshot and the line reads adopted.
    const adopt = await tenant.admin.rpc("adopt_document_version", {
      p_account: tenant.accountId,
      p_version: v2.id,
      p_adopted_on: "2026-10-01",
    });
    expect(adopt.error).toBeNull();
    await page.reload();
    await expect(page.getByTestId("finding-redraft-state")).toContainText(
      "version 2, adopted 2026-10-01",
    );
    await axeAt(page, 360, "finding row after the redraft");
  });
});
