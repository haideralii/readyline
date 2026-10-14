import "server-only";
/**
 * Reads for the audit-day register pages (REQ-018 Session B), with the
 * user's session so RLS applies; the status views compute the states.
 * `seedCorporateRisks` writes the FR-1 starter rows once, on the first
 * open of an empty register.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";
import {
  AUDIT_DAY_META,
  AUDIT_DAY_SLUGS,
  type AuditDaySlug,
} from "@/lib/registers/audit-day-forms";
import type {
  OnboardingTickRow,
  RegisterEventRow,
} from "@/lib/registers/audit-day-types";
import { starterCorporateRisks } from "@/lib/registers/starter-risks";
import type { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";

const LIMIT = 500;

export type AnyRow = Record<string, unknown> & { id: string };

export async function listAuditDayRows(
  supabase: SupabaseClient,
  accountId: string,
  slug: AuditDaySlug,
): Promise<AnyRow[]> {
  const meta = AUDIT_DAY_META[slug];
  const r = await supabase
    .from(meta.view)
    .select("*")
    .eq("account_id", accountId)
    .order(meta.orderBy.column, {
      ascending: meta.orderBy.ascending,
      nullsFirst: false,
    })
    .limit(LIMIT);
  return (r.data as AnyRow[] | null) ?? [];
}

export async function getAuditDayRow(
  supabase: SupabaseClient,
  accountId: string,
  slug: AuditDaySlug,
  id: string,
): Promise<AnyRow | null> {
  const meta = AUDIT_DAY_META[slug];
  const r = await supabase
    .from(meta.view)
    .select("*")
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  return (r.data as AnyRow | null) ?? null;
}

/** The append-only trail of one row (D-1902), oldest first. */
export async function listRegisterTrail(
  supabase: SupabaseClient,
  accountId: string,
  table: string,
  rowId: string,
): Promise<RegisterEventRow[]> {
  const r = await supabase
    .from("register_events")
    .select("*")
    .eq("account_id", accountId)
    .eq("register", table)
    .eq("row_id", rowId)
    .order("at", { ascending: true })
    .limit(LIMIT);
  return (r.data as RegisterEventRow[] | null) ?? [];
}

export async function listOnboardingTicks(
  supabase: SupabaseClient,
  accountId: string,
  checklistId: string,
): Promise<OnboardingTickRow[]> {
  const r = await supabase
    .from("onboarding_ticks")
    .select("*")
    .eq("account_id", accountId)
    .eq("checklist_id", checklistId)
    .order("ticked_on", { ascending: true });
  return (r.data as OnboardingTickRow[] | null) ?? [];
}

export type AuditDayOverview = Record<
  AuditDaySlug,
  { total: number; attention: number; attentionLabel: string }
>;

/** One line per register for the index and the audit-day page (FR-11): the count and what needs attention. */
export async function auditDayOverview(
  supabase: SupabaseClient,
  accountId: string,
): Promise<AuditDayOverview> {
  const entries = await Promise.all(
    AUDIT_DAY_SLUGS.map(async (slug) => {
      const rows = await listAuditDayRows(supabase, accountId, slug);
      const meta = AUDIT_DAY_META[slug];
      const tones = rows.map((r) => meta.statusOf(r as never));
      const signal = tones.filter((t) => t.tone === "signal").length;
      const ochre = tones.filter((t) => t.tone === "ochre").length;
      const attention = signal > 0 ? signal : ochre;
      const label =
        rows.length === 0
          ? "Nothing recorded"
          : signal > 0
            ? `${signal} overdue`
            : ochre > 0
              ? `${ochre} to act on`
              : "All current";
      return [slug, { total: rows.length, attention, attentionLabel: label }];
    }),
  );
  return Object.fromEntries(entries) as AuditDayOverview;
}

/**
 * FR-1: the nine starter rows, once, when the register is empty and the
 * questionnaire is answered. Idempotent under a race: a second insert of
 * the same area is harmless because the page re-reads, and the rows are
 * marked `starter` so the provider sees "check this and change it".
 */
export async function seedCorporateRisks(
  supabase: SupabaseClient,
  accountId: string,
  answers: QuestionnaireAnswers,
  result: QuestionnaireResult,
  today: string,
): Promise<number> {
  const existing = await supabase
    .from("corporate_risks")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if ((existing.count ?? 0) > 0) return 0;
  const rows = starterCorporateRisks(answers, result, today).map((r) => ({
    account_id: accountId,
    ...r,
  }));
  const ins = await supabase.from("corporate_risks").insert(rows);
  if (ins.error) {
    // A lapsed subscription cannot seed (RLS); the page then shows the empty state.
    log.info("registers.corporate-risks.seed-skipped", {
      accountId,
      code: ins.error.code,
    });
    return 0;
  }
  log.info("registers.corporate-risks.seeded", {
    accountId,
    count: rows.length,
  });
  return rows.length;
}
