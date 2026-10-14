"use server";
/**
 * Generation entry points for a signed-in owner (REQ-005 FR-9, SR-6, FR-5).
 * Order of checks: session and ownership, feature flag, questionnaire
 * complete, quota (one database statement), then the run. Writes use the
 * service key through the store after the ownership check (D-516).
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { createModelClient } from "@/lib/generator/model-client";
import { log } from "@/lib/logging/logger";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import {
  buildResult,
  type QuestionnaireResult,
} from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { parseInput, strictObject } from "@/lib/validation";
import { loadServerDraft } from "@/server/accounts/actions";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { decideGeneration, isGenerationEnabled, QUOTA_MESSAGE } from "./policy";
import { getDocumentVersion } from "./queries";
import { generateDocumentSet, regenerateSection } from "./run";
import { SupabaseGenerationStore } from "./store";

export type GenerationActionResult =
  { ok: true; versionSetId: string } | { ok: false; message: string };

const DEFAULT_MODEL = "claude-sonnet-5-5"; // D-037

function modelId(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

async function quotaAllows(accountId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const r = await admin.rpc("generation_quota_hit", { p_account: accountId });
  if (r.error) throw new Error(`quota: ${r.error.message}`);
  return r.data !== false;
}

export async function startGenerationAction(): Promise<GenerationActionResult> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  const gate = decideGeneration({
    enabled: isGenerationEnabled(),
    hasAccount: Boolean(viewer.account),
    deleted: Boolean(viewer.deleted),
    withinQuota: true,
  });
  if (!gate.allowed) return { ok: false, message: gate.message };
  const account = viewer.account!;

  const draft = await loadServerDraft();
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const parsed = draft
    ? schema.safeParse({ answersVersion: ANSWERS_VERSION, ...draft.answers })
    : null;
  if (!parsed || !parsed.success) {
    return {
      ok: false,
      message:
        "Finish every step of the questionnaire first; your documents are drafted from those answers.",
    };
  }
  const built = buildResult(dataset, parsed.data);
  if (!built.ok) return { ok: false, message: built.message };

  if (!(await quotaAllows(account.id))) {
    log.warn("generation.quota-exhausted", { accountId: account.id });
    return { ok: false, message: QUOTA_MESSAGE };
  }

  const admin = createSupabaseAdminClient();
  try {
    const summary = await generateDocumentSet({
      store: new SupabaseGenerationStore(admin),
      client: createModelClient(),
      modelId: modelId(),
      dataset,
      accountId: account.id,
      userId: viewer.user.id,
      answers: parsed.data,
      result: built.result,
      now: new Date(),
    });
    await admin.from("audit_log").insert({
      account_id: account.id,
      actor_user_id: viewer.user.id,
      action: "documents.generated",
      target: summary.versionSetId,
    });
    log.info("generation.completed", {
      accountId: account.id,
      versionSetId: summary.versionSetId,
      documents: summary.documents.length,
      generated: summary.generatedSections,
      fallback: summary.fallbackSections,
      inputTokens: summary.usage.inputTokens,
      outputTokens: summary.usage.outputTokens,
    });
    return { ok: true, versionSetId: summary.versionSetId };
  } catch (e) {
    log.error("generation.failed", { accountId: account.id, error: e });
    return {
      ok: false,
      message:
        "We could not generate your documents just now. Nothing was charged against your daily limit twice; please try again later.",
    };
  }
}

const RegenerateInput = strictObject({
  versionId: z.string().uuid(),
  sectionId: z.string().min(1).max(60),
});

export type RegenerateResult =
  | { ok: true; nextVersionId: string; outcome: "generated" | "fallback" }
  | { ok: false; message: string };

export async function regenerateSectionAction(
  input: unknown,
): Promise<RegenerateResult> {
  const parsed = parseInput(RegenerateInput, input);
  if (!parsed.ok) return { ok: false, message: "Invalid request." };
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (!isGenerationEnabled())
    return {
      ok: false,
      message: "Document generation is not switched on in this environment.",
    };
  if (!viewer.account)
    return { ok: false, message: "Create your account first." };

  const supabase = await createSupabaseServerClient();
  const current = await getDocumentVersion(supabase, parsed.data.versionId);
  if (!current || current.account_id !== viewer.account.id)
    return { ok: false, message: "Document not found." };

  if (!(await quotaAllows(viewer.account.id)))
    return { ok: false, message: QUOTA_MESSAGE };

  const admin = createSupabaseAdminClient();
  const set = await admin
    .from("version_sets")
    .select("derived_result")
    .eq("id", current.version_set_id)
    .single();
  if (set.error) return { ok: false, message: "Document set not found." };
  try {
    const { next, outcome } = await regenerateSection({
      store: new SupabaseGenerationStore(admin),
      client: createModelClient(),
      modelId: modelId(),
      dataset: getStandardsDataset(),
      current,
      result: set.data.derived_result as QuestionnaireResult,
      sectionId: parsed.data.sectionId,
    });
    await admin.from("audit_log").insert({
      account_id: viewer.account.id,
      actor_user_id: viewer.user.id,
      action: "documents.section-regenerated",
      target: `${current.document_type_id}/${parsed.data.sectionId}`,
    });
    return { ok: true, nextVersionId: next.id, outcome };
  } catch (e) {
    log.error("generation.regenerate.failed", {
      accountId: viewer.account.id,
      error: e,
    });
    return {
      ok: false,
      message:
        "We could not regenerate that section just now. Please try again later.",
    };
  }
}
