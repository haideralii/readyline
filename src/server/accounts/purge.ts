/**
 * Purge of soft-deleted accounts after the retention period (REQ-004 FR-6,
 * AC-5; Dev response Q3). Runs with the service key from the cron route or
 * directly from an integration test with an injected clock. Idempotent: a
 * second run finds nothing to do.
 *
 * Storage: no bucket exists yet. By convention every later bucket stores an
 * account's objects under the prefix `<accountId>/`, and this job removes
 * that prefix from every bucket, so new buckets are covered without a change
 * here (D-416).
 */
import { removeLinkPacks } from "@/server/registers/link-pack";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";
import type { EmailProvider } from "@/server/email/provider";
import { accountPurgedEmail } from "@/server/email/templates";

export const RETENTION_DAYS = 30;

export type PurgeReport = {
  dryRun: boolean;
  cutoff: string;
  purged: { accountId: string; usersRemoved: number; objectsRemoved: number }[];
  errors: { accountId: string; message: string }[];
};

export async function runPurge(input: {
  admin: SupabaseClient;
  email: EmailProvider;
  now?: Date;
  retentionDays?: number;
  dryRun?: boolean;
}): Promise<PurgeReport> {
  const now = input.now ?? new Date();
  const retentionDays = input.retentionDays ?? RETENTION_DAYS;
  const dryRun = input.dryRun ?? false;
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  const report: PurgeReport = {
    dryRun,
    cutoff: cutoff.toISOString(),
    purged: [],
    errors: [],
  };

  const due = await input.admin
    .from("accounts")
    .select("id, trading_name, deleted_at")
    .not("deleted_at", "is", null)
    .lte("deleted_at", cutoff.toISOString());
  if (due.error) throw due.error;

  for (const account of due.data ?? []) {
    try {
      const members = await input.admin
        .from("memberships")
        .select("user_id")
        .eq("account_id", account.id);
      if (members.error) throw members.error;
      const userIds = (members.data ?? []).map((m) => m.user_id as string);

      let objectsRemoved = 0;
      if (!dryRun) {
        // REQ-029 SR-5 (D-2863): the auditor links' stored packs sit one folder
        // deeper than the account's prefix lists, so each goes by name first.
        const links = await input.admin
          .from("auditor_links")
          .select("id")
          .eq("account_id", account.id);
        for (const l of (links.data as { id: string }[] | null) ?? [])
          objectsRemoved += await removeLinkPacks(
            input.admin,
            account.id,
            l.id,
          );
        objectsRemoved += await removeStorageObjects(input.admin, account.id);
      }

      let usersRemoved = 0;
      if (!dryRun) {
        const del = await input.admin
          .from("accounts")
          .delete()
          .eq("id", account.id);
        if (del.error) throw del.error;
        for (const userId of userIds) {
          const others = await input.admin
            .from("memberships")
            .select("account_id")
            .eq("user_id", userId)
            .limit(1);
          if ((others.data ?? []).length > 0) continue;
          const user = await input.admin.auth.admin.getUserById(userId);
          const email = user.data.user?.email;
          if (email) {
            await input.email.send(
              accountPurgedEmail({
                to: email,
                tradingName: account.trading_name,
                purgedAt: now,
              }),
            );
          }
          const removed = await input.admin.auth.admin.deleteUser(userId);
          if (removed.error) throw removed.error;
          usersRemoved++;
        }
        await input.admin.from("audit_log").insert({
          account_id: null,
          actor_user_id: null,
          action: "account.purged",
          target: account.id,
        });
      }
      report.purged.push({
        accountId: account.id,
        usersRemoved,
        objectsRemoved,
      });
      log.info("account.purged", {
        accountId: account.id,
        dryRun,
        usersRemoved,
        objectsRemoved,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      report.errors.push({ accountId: account.id, message });
      log.error("account.purge.failed", { accountId: account.id, error: e });
    }
  }
  return report;
}

async function removeStorageObjects(
  admin: SupabaseClient,
  accountId: string,
): Promise<number> {
  const buckets = await admin.storage.listBuckets();
  if (buckets.error || !buckets.data) return 0;
  let removed = 0;
  for (const bucket of buckets.data) {
    const listed = await admin.storage
      .from(bucket.name)
      .list(accountId, { limit: 1000 });
    const names = (listed.data ?? []).map((o) => `${accountId}/${o.name}`);
    if (names.length === 0) continue;
    const res = await admin.storage.from(bucket.name).remove(names);
    if (!res.error) removed += names.length;
  }
  return removed;
}

/** Retention for generated artefacts (REQ-005 SR-5, FR-6): logs after 2 years; superseded sets after 12 months. */
export const GENERATION_LOG_RETENTION_DAYS = 730;
export const SUPERSEDED_SET_RETENTION_DAYS = 365;

export async function purgeGenerationArtifacts(input: {
  admin: SupabaseClient;
  now?: Date;
  dryRun?: boolean;
}): Promise<{ logsRemoved: number; setsRemoved: number }> {
  const now = input.now ?? new Date();
  const dryRun = input.dryRun ?? false;
  const logCutoff = new Date(
    now.getTime() - GENERATION_LOG_RETENTION_DAYS * 86_400_000,
  ).toISOString();
  const setCutoff = new Date(
    now.getTime() - SUPERSEDED_SET_RETENTION_DAYS * 86_400_000,
  ).toISOString();
  let logsRemoved = 0;
  let setsRemoved = 0;
  const oldLogs = await input.admin
    .from("generation_log")
    .select("id")
    .lt("created_at", logCutoff);
  logsRemoved = oldLogs.data?.length ?? 0;
  if (!dryRun && logsRemoved > 0)
    await input.admin
      .from("generation_log")
      .delete()
      .lt("created_at", logCutoff);
  // A set is superseded when a newer set exists for the same account.
  const sets = await input.admin
    .from("version_sets")
    .select("id, account_id, storage_prefix, created_at")
    .lt("created_at", setCutoff)
    .order("created_at", { ascending: false });
  for (const set of sets.data ?? []) {
    const newer = await input.admin
      .from("version_sets")
      .select("id")
      .eq("account_id", set.account_id)
      .gt("created_at", set.created_at)
      .limit(1);
    if ((newer.data ?? []).length === 0) continue;
    setsRemoved++;
    if (dryRun) continue;
    await removeStorageObjects(input.admin, set.storage_prefix);
    await input.admin.from("version_sets").delete().eq("id", set.id);
  }
  log.info("generation.purge", { dryRun, logsRemoved, setsRemoved });
  return { logsRemoved, setsRemoved };
}
