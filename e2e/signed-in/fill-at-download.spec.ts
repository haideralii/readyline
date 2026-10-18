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
import { applyFacts } from "@/lib/generator/facts-fill";
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
  const xml =
    strFromU8(files["word/document.xml"]) +
    Object.keys(files)
      .filter((f) => /^word\/footer\d*\.xml$/.test(f))
      .map((f) => strFromU8(files[f]))
      .join("");
  // The renderer tints a bracketed blank in its own run (S-8), so one sentence is split across
  // <w:t> elements: each paragraph's texts are joined before any assertion (#112's third run).
  return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [])
    .map((para) =>
      (para.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) ?? [])
        .map((run) => run.replace(/<[^>]+>/g, ""))
        .join(""),
    )
    .join("\n");
}

test.describe("REQ-029 Session A: fill at download", () => {
  test.skip(!enabled, "needs the Supabase variables");
  // Desktop and Android (D-2207): the iphone project's testMatch does not list this spec.
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  let tenant: TestTenant;
  let setId = "";
  let governanceV1 = "";
  let complaintsV1 = "";
  /** AC-9: a set made before this REQ, its text carrying the values, dated before the template set. */
  let olderSetId = "";
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
      if (typeId === COMPLAINTS) complaintsV1 = ins.data.id as string;
    }
    // AC-9 (FR-9, D-2861): an older set whose governance policy carries "Jane Citizen" in its text.
    const older = await admin
      .from("version_sets")
      .insert({
        account_id: tenant.accountId,
        created_by: tenant.userId,
        answers_snapshot_hash: "req-029-e2e-older",
        derived_result: c.result,
        status: "ready",
        document_count: 1,
        fallback_section_count: 0,
        generated_count: 0,
        storage_prefix: "",
        created_at: "2026-10-01T00:00:00Z",
      })
      .select("id")
      .single();
    if (older.error) throw older.error;
    olderSetId = older.data.id as string;
    const filled = applyFacts(model(GOVERNANCE), {
      name: "Jane Citizen",
      role: "Owner",
      date: "1 October 2026",
    });
    const olderIns = await admin.from("document_versions").insert({
      version_set_id: olderSetId,
      account_id: tenant.accountId,
      document_type_id: GOVERNANCE,
      version: 1,
      status: "ready",
      storage_path: `${tenant.accountId}/${olderSetId}/${GOVERNANCE}.v1.docx`,
      model: filled,
      created_at: "2026-10-01T00:00:00Z",
    });
    if (olderIns.error) throw olderIns.error;
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
          // FR-7: the account also holds an older set (its version 1, filled); this counts the current set alone (#117's run).
          .eq("version_set_id", setId)
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

    // Next's route announcer is an alert too (#105, #112), so the summary is the one with its heading.
    const summary = page.getByRole("alert").filter({ hasText: "Please fix" });

    await test.step("AC-12: square brackets are refused in words; a name in the free-text field warns and saves", async () => {
      await field("name").fill("[Jane]");
      await field("name").blur();
      await expect(page.getByTestId("fact-name")).toContainText(
        "No square brackets",
      );
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
  test("Session B, AC-7 and AC-9: the sheet's lines read the facts on the template set; the older set keeps its text and says so", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);

    await test.step("AC-7: the sheet on screen, the open and done lines, the approver and date lines", async () => {
      await page.goto(`/documents/${setId}/start-here`);
      const fills = page.getByTestId("sheet-fill");
      await expect(fills.first()).toBeVisible();
      // The three appendix lines read done ("None" filled them in Session A), with no note after them.
      const doneFill = page.locator(
        '[data-testid="sheet-fill"][data-done="true"]',
      );
      await expect(doneFill.first()).toBeVisible();
      await expect(doneFill.first()).not.toContainText(
        "Fill this in on your details page",
      );
      const adoption = page.getByTestId("sheet-adoption");
      await expect(adoption.first()).toBeVisible();
      // The adopted governance policy's approver lines read done; a draft's say where they fill in.
      const openAdoption = adoption.filter({
        hasText: "Fills in when you adopt this document",
      });
      await expect(openAdoption.first()).toBeVisible();
      const doneAdoption = page.locator(
        '[data-testid="sheet-adoption"][data-done="true"]',
      );
      await expect(doneAdoption.first()).toBeVisible();
      await expect(doneAdoption.first()).not.toContainText(
        "Fills in when you adopt",
      );
      // The Word sheet carries the same lines.
      const r = await page.request.get(
        `/documents/${setId}/download?file=start-here.docx`,
      );
      expect(r.status()).toBe(200);
      const xml = strFromU8(
        unzipSync(new Uint8Array(await r.body()))["word/document.xml"],
      );
      expect(xml).toContain("Fills in when you adopt this document");
      expect(xml).toContain("Approval line: [date]");
    });

    await test.step("AC-9: the older set still downloads 'Jane Citizen' after the name changed, and its page says why", async () => {
      await page.goto(`/documents/${setId}/finish`);
      await expect(page.getByTestId("details-fields")).toBeEnabled();
      await page.locator("#name").fill("Sam Worker");
      await page.locator("#name").blur();
      await expect(page.getByTestId("fact-name-status")).toHaveText("Saved");
      const older = await docxText(page, olderSetId, GOVERNANCE);
      expect(older).toContain("Jane Citizen, Owner");
      expect(older).not.toContain("Sam Worker");
      await page.goto(`/documents/${olderSetId}`);
      await expect(page.getByTestId("set-older")).toContainText(
        "filled before your details page existed",
      );
      await page.goto(`/documents/${setId}`);
      await expect(page.getByTestId("set-older")).toHaveCount(0);
      // Back to the name the rest of the journey used.
      await page.goto(`/documents/${setId}/finish`);
      await expect(page.getByTestId("details-fields")).toBeEnabled();
      await page.locator("#name").fill("Jane Citizen");
      await page.locator("#name").blur();
      await expect(page.getByTestId("fact-name-status")).toHaveText("Saved");
    });
  });

  test("Session B, AC-8: the auditor link's pack is one render, the same bytes twice; a new link carries the new number", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    const admin = tenant.admin;
    // The complaints policy adopted, so the pack carries it with its contact line filled.
    const r = await admin.rpc("adopt_document_version", {
      p_account: tenant.accountId,
      p_version: complaintsV1,
    });
    expect(r.error).toBeNull();
    await page.goto(`/documents/${setId}/finish`);
    await expect(page.getByTestId("details-fields")).toBeEnabled();
    await page.locator("#phone-or-email").fill("0422 222 222");
    await page.locator("#phone-or-email").blur();
    await expect(page.getByTestId("fact-phone-or-email-status")).toHaveText(
      "Saved",
    );

    const createLink = async () => {
      await page.goto("/account");
      await page.getByTestId("auditor-link-create").click();
      const urlField = page.getByTestId("auditor-link-url");
      await expect(urlField).toBeVisible();
      return urlField.inputValue();
    };
    const packOf = async (url: string) => {
      const auditor = await browser.newContext();
      const res = await auditor.request.get(`${url}/audit-pack.zip`);
      expect(res.status()).toBe(200);
      const body = new Uint8Array(await res.body());
      await auditor.close();
      return body;
    };
    const complaintsIn = (zip: Uint8Array) =>
      strFromU8(
        unzipSync(unzipSync(zip)[`documents/${COMPLAINTS}.docx`])[
          "word/document.xml"
        ],
      );

    const first = await createLink();
    const a = await packOf(first);
    const files = Object.keys(unzipSync(a));
    expect(files).toContain("cover-sheet.pdf");
    expect(files).toContain(`documents/${COMPLAINTS}.docx`);
    expect(complaintsIn(a)).toContain("0422 222 222");
    const b = await packOf(first);
    expect(Buffer.from(b).equals(Buffer.from(a))).toBe(true);

    await page.goto(`/documents/${setId}/finish`);
    await expect(page.getByTestId("details-fields")).toBeEnabled();
    await page.locator("#phone-or-email").fill("0433 333 333");
    await page.locator("#phone-or-email").blur();
    await expect(page.getByTestId("fact-phone-or-email-status")).toHaveText(
      "Saved",
    );
    const c = await packOf(first);
    expect(Buffer.from(c).equals(Buffer.from(a))).toBe(true);
    expect(complaintsIn(c)).toContain("0422 222 222");

    // A new link replaces the first and is a new render with the new number; the first link is dead.
    const second = await createLink();
    expect(second).not.toBe(first);
    const d = await packOf(second);
    expect(complaintsIn(d)).toContain("0433 333 333");
    expect(Buffer.from(d).equals(Buffer.from(a))).toBe(false);
    const dead = await browser.newContext();
    expect((await dead.request.get(`${first}/audit-pack.zip`)).status()).toBe(
      404,
    );
    await dead.close();
  });
});
