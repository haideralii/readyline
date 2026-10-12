/**
 * Account data export (REQ-004 FR-6, AC-4). Everything is read with the
 * owner's own session, so row-level security guarantees the export can only
 * contain that account's rows. The zip is built in memory; the account holds
 * only business data, so it is small.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { strToU8, zipSync } from "fflate";
import { BRAND } from "@/lib/brand";

export type AccountExport = {
  exportedAt: string;
  product: string;
  account: Record<string, unknown>;
  memberships: Record<string, unknown>[];
  questionnaireDraft: Record<string, unknown> | null;
  /** REQ-006 SR-1: the checklist statuses and notes the provider set. */
  checklistItems: Record<string, unknown>[];
  auditLog: Record<string, unknown>[];
};

/** Returns null when the account is not visible to this session (not a member, or deleted). */
export async function buildAccountExport(
  supabase: SupabaseClient,
  accountId: string,
  now: Date = new Date(),
): Promise<AccountExport | null> {
  const account = await supabase
    .from("accounts")
    .select(
      "id, trading_name, business_structure, states, abn, created_at, updated_at",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (account.error || !account.data) return null;

  const [memberships, draft, checklist, audit] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, created_at")
      .eq("account_id", accountId),
    supabase
      .from("questionnaire_drafts")
      .select("answers, answers_version, current_step, updated_at")
      .eq("account_id", accountId)
      .maybeSingle(),
    supabase
      .from("checklist_items")
      .select("item_id, status, note, updated_at")
      .eq("account_id", accountId)
      .order("item_id", { ascending: true }),
    supabase
      .from("audit_log")
      .select("id, actor_user_id, action, target, at")
      .eq("account_id", accountId)
      .order("at", { ascending: true }),
  ]);

  return {
    exportedAt: now.toISOString(),
    product: BRAND,
    account: account.data,
    memberships: memberships.data ?? [],
    questionnaireDraft: draft.data ?? null,
    checklistItems: checklist.data ?? [],
    auditLog: audit.data ?? [],
  };
}

export function exportFileName(now: Date): string {
  return `${BRAND.toLowerCase()}-export-${now.toISOString().slice(0, 10)}.zip`;
}

export function buildExportZip(data: AccountExport): Uint8Array {
  const readme = [
    `${BRAND} account export`,
    "",
    `Exported at ${data.exportedAt}.`,
    "Files:",
    "  account.json: your business details, memberships, questionnaire draft, readiness checklist statuses and notes, and audit log as JSON.",
    "",
    "This export holds your provider business data only. It never contains participant information,",
    "because the product does not collect any.",
    `${BRAND} provides general information and document templates for your own review; it is not legal advice.`,
    "",
  ].join("\n");
  return zipSync(
    {
      "account.json": strToU8(JSON.stringify(data, null, 2)),
      "README.txt": strToU8(readme),
    },
    { level: 6 },
  );
}
