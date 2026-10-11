"use server";
/**
 * Account creation, settings and the server-side questionnaire draft
 * (REQ-004 FR-2, FR-5; REQ-003 FR-3 storage swap). Every input is parsed with
 * the REQ-003 strict schemas; every write runs with the user's session so
 * row-level security decides what is visible.
 */
import { log } from "@/lib/logging/logger";
import { parseInput } from "@/lib/validation";
import { BusinessStep, QuestionnaireDraft } from "@/lib/questionnaire/schema";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getOwnedAccount, type Account } from "./queries";

export type ActionFailure = {
  ok: false;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
};

const NOT_SIGNED_IN: ActionFailure = {
  ok: false,
  fieldErrors: {},
  formErrors: ["Please sign in again."],
};

export async function createAccountAction(
  input: unknown,
): Promise<{ ok: true; account: Account } | ActionFailure> {
  const parsed = parseInput(BusinessStep, input);
  if (!parsed.ok)
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      formErrors: parsed.formErrors,
    };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NOT_SIGNED_IN;

  const existing = await getOwnedAccount(supabase, auth.user.id);
  if (existing) return { ok: true, account: existing };

  const rpc = await supabase.rpc("create_account", {
    p_trading_name: parsed.data.tradingName,
    p_business_structure: parsed.data.structure,
    p_states: parsed.data.states,
    p_abn: parsed.data.abn ?? null,
  });
  if (rpc.error) {
    log.warn("account.create.failed", {
      userId: auth.user.id,
      code: rpc.error.code,
    });
    return {
      ok: false,
      fieldErrors: {},
      formErrors: ["We could not create your account. Please try again."],
    };
  }
  const account = await getOwnedAccount(supabase, auth.user.id);
  if (!account)
    return {
      ok: false,
      fieldErrors: {},
      formErrors: ["We could not load your new account. Please try again."],
    };
  log.info("account.created", { userId: auth.user.id, accountId: account.id });
  return { ok: true, account };
}

export async function updateAccountAction(
  input: unknown,
): Promise<{ ok: true; account: Account } | ActionFailure> {
  const parsed = parseInput(BusinessStep, input);
  if (!parsed.ok)
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      formErrors: parsed.formErrors,
    };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NOT_SIGNED_IN;
  const account = await getOwnedAccount(supabase, auth.user.id);
  if (!account) return NOT_SIGNED_IN;

  const update = await supabase
    .from("accounts")
    .update({
      trading_name: parsed.data.tradingName,
      business_structure: parsed.data.structure,
      states: parsed.data.states,
      abn: parsed.data.abn ?? null,
    })
    .eq("id", account.id)
    .select("id, trading_name, business_structure, states, abn")
    .single();
  if (update.error) {
    log.warn("account.update.failed", {
      userId: auth.user.id,
      accountId: account.id,
      code: update.error.code,
    });
    return {
      ok: false,
      fieldErrors: {},
      formErrors: ["We could not save your changes. Please try again."],
    };
  }
  await supabase.from("audit_log").insert({
    account_id: account.id,
    actor_user_id: auth.user.id,
    action: "account.updated",
    target: account.id,
  });
  return { ok: true, account: update.data as Account };
}

/** Server DraftStore backing (REQ-003 FR-3): the owner's account holds one draft. */
export async function loadServerDraft(): Promise<QuestionnaireDraft | null> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const account = await getOwnedAccount(supabase, auth.user.id);
  if (!account) return null;
  const row = await supabase
    .from("questionnaire_drafts")
    .select("answers, answers_version, current_step, updated_at")
    .eq("account_id", account.id)
    .maybeSingle();
  if (row.error || !row.data) return null;
  const parsed = QuestionnaireDraft.safeParse({
    answersVersion: row.data.answers_version,
    answers: row.data.answers,
    currentStep: row.data.current_step ?? "business",
    updatedAt: new Date(row.data.updated_at).toISOString(),
  });
  return parsed.success ? parsed.data : null;
}

export async function saveServerDraft(
  input: unknown,
): Promise<{ ok: boolean }> {
  const parsed = parseInput(QuestionnaireDraft, input);
  if (!parsed.ok) return { ok: false };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const account = await getOwnedAccount(supabase, auth.user.id);
  if (!account) return { ok: false };
  const up = await supabase.from("questionnaire_drafts").upsert(
    {
      account_id: account.id,
      answers: parsed.data.answers,
      answers_version: parsed.data.answersVersion,
      current_step: parsed.data.currentStep,
    },
    { onConflict: "account_id" },
  );
  if (up.error) {
    log.warn("draft.save.failed", {
      accountId: account.id,
      code: up.error.code,
    });
    return { ok: false };
  }
  return { ok: true };
}

export async function clearServerDraft(): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const account = await getOwnedAccount(supabase, auth.user.id);
  if (!account) return { ok: false };
  const del = await supabase
    .from("questionnaire_drafts")
    .delete()
    .eq("account_id", account.id);
  return { ok: !del.error };
}
