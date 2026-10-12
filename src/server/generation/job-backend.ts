import "server-only";
/**
 * The Supabase side of the paid generation job (REQ-007 FR-5, D-706): claim
 * through `claim_generation_job` (skip-locked, leased), progress on the job
 * row, and the context a job needs (the owner's current answers, the
 * entitlement's state, the owner's email). Admin client only; the caller is
 * the job route or the webhook's after() hook.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import { getStandardsDataset } from "@/lib/standards/dataset";
import type { GenerationJobRow, JobBackend, JobContext, JobPatch } from "./job";
import { listLatestDocuments } from "./queries";
import { answersHash } from "./run";
import type { DocumentVersionRow } from "./store";

export class SupabaseJobBackend implements JobBackend {
  constructor(private readonly admin: SupabaseClient) {}

  async claim(leaseSeconds: number): Promise<GenerationJobRow | null> {
    const r = await this.admin.rpc("claim_generation_job", {
      p_lease_seconds: leaseSeconds,
    });
    if (r.error) throw new Error(`claim_generation_job: ${r.error.message}`);
    const rows = (r.data as GenerationJobRow[] | null) ?? [];
    return rows[0] ?? null;
  }

  async update(id: string, patch: JobPatch): Promise<void> {
    const r = await this.admin
      .from("generation_jobs")
      .update(patch)
      .eq("id", id);
    if (r.error) throw new Error(`generation_jobs update: ${r.error.message}`);
  }

  async loadContext(
    job: GenerationJobRow,
  ): Promise<JobContext | { error: string }> {
    let entitlementRevoked = false;
    if (job.entitlement_id) {
      const e = await this.admin
        .from("entitlements")
        .select("revoked_at")
        .eq("id", job.entitlement_id)
        .maybeSingle();
      if (e.error) return { error: `entitlement read: ${e.error.message}` };
      if (!e.data) return { error: "entitlement missing" };
      entitlementRevoked = Boolean(e.data.revoked_at);
    }
    const account = await this.admin
      .from("accounts")
      .select("trading_name, deleted_at")
      .eq("id", job.account_id)
      .maybeSingle();
    if (account.error || !account.data) return { error: "account missing" };
    if (account.data.deleted_at) return { error: "account deleted" };
    const owner = await this.admin
      .from("memberships")
      .select("user_id")
      .eq("account_id", job.account_id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (owner.error || !owner.data) return { error: "owner missing" };
    const ownerUserId = owner.data.user_id as string;
    const user = await this.admin.auth.admin.getUserById(ownerUserId);
    const ownerEmail = user.data.user?.email ?? null;

    const draft = await this.admin
      .from("questionnaire_drafts")
      .select("answers")
      .eq("account_id", job.account_id)
      .maybeSingle();
    if (draft.error || !draft.data)
      return { error: "questionnaire draft missing" };
    const dataset = getStandardsDataset();
    const schema = answersSchemaFor(
      new Set(dataset.registrationGroups.map((g) => g.code)),
    );
    const parsed = schema.safeParse({
      answersVersion: ANSWERS_VERSION,
      ...(draft.data.answers as Record<string, unknown>),
    });
    if (!parsed.success) return { error: "questionnaire incomplete" };
    const assessmentId = `${ANSWERS_VERSION}:${answersHash(parsed.data)}`;
    return {
      answers: parsed.data,
      tradingName: account.data.trading_name as string,
      ownerUserId,
      ownerEmail,
      entitlementRevoked,
      assessmentMatches:
        !job.assessment_id || job.assessment_id === assessmentId,
    };
  }

  listDocuments(versionSetId: string): Promise<DocumentVersionRow[]> {
    return listLatestDocuments(this.admin, versionSetId);
  }

  async setEntitlementVersionSet(
    entitlementId: string,
    versionSetId: string,
  ): Promise<void> {
    const r = await this.admin
      .from("entitlements")
      .update({ version_set_id: versionSetId })
      .eq("id", entitlementId);
    if (r.error) throw new Error(`entitlements update: ${r.error.message}`);
  }

  async quotaHit(accountId: string): Promise<boolean> {
    const r = await this.admin.rpc("generation_quota_hit", {
      p_account: accountId,
    });
    if (r.error) throw new Error(`quota: ${r.error.message}`);
    return r.data !== false;
  }

  async audit(accountId: string, versionSetId: string): Promise<void> {
    await this.admin.from("audit_log").insert({
      account_id: accountId,
      actor_user_id: null,
      action: "documents.generated",
      target: versionSetId,
    });
  }
}
