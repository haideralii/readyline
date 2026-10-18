import { test, expect, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById } from "@/lib/generator/catalogue";
import {
  buildSkeleton,
  type DocumentModel,
} from "@/lib/generator/document-model";
import { buildProviderFacts } from "@/lib/generator/facts";
import { formatDateAu } from "@/lib/generator/fixed-text";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { sydneyDay } from "@/lib/metrics/counters";
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
 * REQ-029 Session A (AC-1 to AC-6, AC-11, AC-12; D-2854, D-2855): the
 * customer's details typed once on "Your details", saved as each field
 * loses focus with no version written; a draft downloads with its
 * brackets; the adopted version fills from the snapshot of the adoption
 * day, never from the live account; a changed role is a re-approval with a
 * new version whose change log says so; a changed phone number is the next
 * download and nothing else. Desktop and Android (D-2207); needs a Supabase
 * stack. The set is seeded from the sole-trader fixture's skeletons, with
 * one paragraph added so a document carries "[phone or email]".
 */
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;

const GOVERNANCE = "governance-policy";
const PRIVACY = "privacy-and-information-management-policy";
const COMPLAINTS = "complaints-management-policy-and-register";

async function docxText(page: Page, setId: string, typeId: string) {
  const r = await page.request.get(
    `/documents/${setId}/download?file=${typeId}.docx`,
  );
  expect(r.status(), `${typeId} download`).toBe(200);
  expect(r.headers()["cache-control"]).toContain("no-store");
  const files = unzipSync(new Uint8Array(await r.body()));
  return (
    strFromU8(files["word/document.xml"]) +
    Object.keys(files)
      .filter((f) => /^word\/footer\d*\.xml$/.test(f))
      .map((f) => strFromU8(files[f]))
      .join("")
  );
}

test.describe("REQ-029 Session A: fill at download", () => {
  test.skip(!enabled, "needs the Supabase variables");
  // Desktop and Android (D-2207): the iphone project's testMatch does not list this spec.
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  let tenant: TestTenant;
  let setId = "";
  let governanceV1 = "";
  const today = sydneyDay();

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `fill-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
    const admin = tenant.admin;
    const c = loadReferenceCases()[0];
    const facts = buildProviderFacts(c.answers, c.result);
    const dataset = getStandardsDataset();
    const model = (typeId: string): DocumentModel =>
      buildSkeleton({
        type: documentTypeById(typeId)!,
        facts,
        dataset,
        result: c.result,
        version: "1",
        generatedAt: "2026-10-14",
      });
    const set = await admin
      .from("version_sets")
      .insert({
        account_id: tenant.accountId,
        created_by: tenant.userId,
        answers_snapshot_hash: "req-029-e2e",
        derived_result: c.result,
        status: "ready",
        document_count: 3,
        fallback_section_count: 0,
        generated_count: 0,
        storage_prefix: "",
      })
      .select("id")
      .single();
    if (set.error) throw set.error;
    setId = set.data.id as string;
    // The complaints policy gains one paragraph so a document carries the contact blank (model-side in a real pack).
    const complaints = model(COMPLAINTS);
    complaints.sections[0].blocks.push({
      type: "paragraph",
      text: "Workers reach [name], [role], on [phone or email] about this policy.",
    });
    for (const [typeId, m] of [
      [GOVERNANCE, model(GOVERNANCE)],
      [PRIVACY, model(PRIVACY)],
      [COMPLAINTS, complaints],
    ] as const) {
      const ins = await admin
        .from("document_versions")
        .insert({
          version_set_id: setId,
          account_id: tenant.accountId,
          document_type_id: typeId,
          version: 1,
          status: "ready",
          storage_path: `${tenant.accountId}/${setId}/${typeId}.v1.docx`,
          model: m,
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      if (typeId === GOVERNANCE) governanceV1 = ins.data.id as string;
    }
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("the form in FR-1's order, the refusal, the saves with no version, the draft's brackets, the adopted fill, the re-approval and the phone change", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    const admin = tenant.admin;
    const versions = async (typeId: string) =>
      (
        await admin
          .from("document_versions")
          .select("id, version, adopted_on, approver_name, approver_role")
          .eq("account_id", tenant.accountId)
          .eq("document_type_id", typeId)
          .order("version")
      ).data as {
        id: string;
        version: number;
        adopted_on: string | null;
        approver_name: string | null;
        approver_role: string | null;
      }[];
    const field = (key: string) => page.locator(`#${key}`);
    const saved = async (key: string) => {
      await field(key).blur();
      await expect(page.getByTestId(`fact-${key}-status`)).toHaveText("Saved");
    };

    await test.step("AC-1: one page, FR-1's order, no approval date", async () => {
      await page.goto(`/documents/${setId}/finish`);
      await expect(
        page.getByRole("heading", { level: 1, name: "Your details" }),
      ).toBeVisible();
      await expect(page.getByTestId("details-fields")).toBeEnabled();
      const ids = await page
        .getByTestId("finish-form")
        .locator('[data-testid^="fact-"]')
        .evaluateAll((els) =>
          els
            .map((e) => e.getAttribute("data-testid") ?? "")
            .filter(
              (t) =>
                /^fact-[a-z-]+$/.test(t) &&
                !/-(status|warning|reapproval|none)$/.test(t),
            ),
        );
      expect(ids.slice(0, 3)).toEqual([
        "fact-name",
        "fact-role",
        "fact-phone-or-email",
      ]);
      expect(ids).toContain("fact-other-tool");
      expect(ids).not.toContain("fact-date");
      await expect(page.getByTestId("details-warning")).toHaveText(
        "Your own name and details, nothing else. Never a participant's name, number, date of birth or address.",
      );
      await expect(page.getByTestId("details-business-name")).toHaveText(
        "Sunrise Supports",
      );
      await checkWidths(page, "your details");
      expect(await axeSerious(page, "your details")).toEqual([]);
    });

    await test.step("AC-12: square brackets are refused in words; a name in the free-text field warns and saves", async () => {
      await field("name").fill("[Jane]");
      await field("name").blur();
      await expect(page.getByTestId("fact-name")).toContainText(
        "No square brackets",
      );
      // Next's route announcer is an alert too (#105, #112), so the summary is the one with its heading.
      const summary = page.getByRole("alert").filter({ hasText: "Please fix" });
      await expect(summary).toContainText("Your name");
      await expect(
        page.locator('[role="alert"] a[href="#name"]'),
      ).toBeVisible();
      await field("other-tool").fill("Jane Citizen");
      await expect(page.getByTestId("fact-other-tool-warning")).toContainText(
        "person's name",
      );
      await saved("other-tool");
    });

    await test.step("AC-2: name, role and phone saved on blur, three rows and no version", async () => {
      await field("name").fill("Jane Citizen");
      await saved("name");
      await expect(summary).toHaveCount(0);
      await field("role").fill("Owner");
      await saved("role");
      await field("phone-or-email").fill("0400 000 000");
      await saved("phone-or-email");
      const facts = await admin
        .from("account_facts")
        .select("key, value")
        .eq("account_id", tenant.accountId);
      const byKey = Object.fromEntries(
        (facts.data as { key: string; value: string }[]).map((f) => [
          f.key,
          f.value,
        ]),
      );
      expect(byKey).toMatchObject({
        name: "Jane Citizen",
        role: "Owner",
        "owner-role": "Owner",
        "phone-or-email": "0400 000 000",
      });
      expect(byKey.date).toBeUndefined();
      expect(await versions(GOVERNANCE)).toHaveLength(1);
      expect(await versions(COMPLAINTS)).toHaveLength(1);
      const audit = await admin
        .from("audit_log")
        .select("action, target")
        .eq("account_id", tenant.accountId)
        .eq("action", "documents.details.saved");
      const targets = (audit.data as { target: string }[]).map((a) => a.target);
      expect(targets).toContain("name");
      expect(targets).toContain("phone-or-email");
      for (const t of targets) expect(t).not.toMatch(/Jane|0400/);
    });

    await test.step("D-2879: 'no other tool' fills the three appendix keys", async () => {
      await page.getByTestId("fact-other-tool-none").check();
      await expect(field("other-tool")).toHaveValue("No other digital tool");
      await expect(field("allowed-use")).toHaveValue("Not applicable");
      await expect(page.getByTestId("fact-limits-status")).toHaveText("Saved");
    });

    await test.step("AC-3: the draft downloads with its brackets and the draft mark; the contact fills live", async () => {
      const governance = await docxText(page, setId, GOVERNANCE);
      expect(governance).toContain("[name], [role]");
      expect(governance).toContain("[date]");
      expect(governance).toContain("Draft prepared with");
      expect(governance).not.toContain("Jane Citizen");
      const complaints = await docxText(page, setId, COMPLAINTS);
      expect(complaints).toContain("0400 000 000");
      expect(complaints).toContain("[name], [role],");
    });

    await test.step("AC-4: adopted, the governance policy fills from the snapshot and the stored model keeps its brackets", async () => {
      const r = await admin.rpc("adopt_document_version", {
        p_account: tenant.accountId,
        p_version: governanceV1,
      });
      expect(r.error).toBeNull();
      const governance = await docxText(page, setId, GOVERNANCE);
      expect(governance).toContain("Jane Citizen, Owner");
      expect(governance).toContain(formatDateAu(today));
      expect(governance).not.toContain("[name]");
      expect(governance).not.toContain("[date]");
      expect(governance).not.toContain("Draft prepared with");
      const stored = await admin
        .from("document_versions")
        .select("model")
        .eq("id", governanceV1)
        .single();
      expect(JSON.stringify(stored.data?.model)).toContain("[name], [role]");
    });

    await test.step("AC-5: a changed role leaves the adopted document as approved until the re-approval writes version 2", async () => {
      await page.goto(`/documents/${setId}/finish`);
      await expect(page.getByTestId("details-fields")).toBeEnabled();
      await field("role").fill("Director");
      await saved("role");
      expect(await docxText(page, setId, GOVERNANCE)).toContain(
        "Jane Citizen, Owner",
      );
      await expect(page.getByTestId("reapprove")).toContainText(
        "1 adopted document",
      );
      await page.getByTestId("reapprove-button").click();
      await page.getByRole("button", { name: "Yes, re-approve" }).click();
      await expect(page.getByTestId("reapproved-line")).toContainText(
        "1 document has a new version",
      );
      const v = await versions(GOVERNANCE);
      expect(v).toHaveLength(2);
      expect(v[1]).toMatchObject({
        version: 2,
        adopted_on: today,
        approver_name: "Jane Citizen",
        approver_role: "Director",
      });
      expect(v[0].approver_role).toBe("Owner");
      const governance = await docxText(page, setId, GOVERNANCE);
      expect(governance).toContain("Jane Citizen, Director");
      expect(governance).toContain("Approver changed to Director; re-approved");
      const audit = await admin
        .from("audit_log")
        .select("target")
        .eq("account_id", tenant.accountId)
        .eq("action", "documents.reapproved");
      expect((audit.data as { target: string }[]).map((a) => a.target)).toEqual(
        [`${GOVERNANCE}:2`],
      );
    });

    await test.step("AC-6: a changed phone number is the next download and no version", async () => {
      await field("phone-or-email").fill("0411 111 111");
      await saved("phone-or-email");
      const complaints = await docxText(page, setId, COMPLAINTS);
      expect(complaints).toContain("0411 111 111");
      expect(complaints).not.toContain("0400 000 000");
      expect(await versions(COMPLAINTS)).toHaveLength(1);
      expect(await versions(GOVERNANCE)).toHaveLength(2);
    });
  });
});
