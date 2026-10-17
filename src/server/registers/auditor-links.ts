import "server-only";
/**
 * The auditor link's server side (REQ-020 FR-2, SR-1, SR-2, D-2230): the
 * owner's current link, the signed-out resolution through the security
 * definer lookup by token hash, the open recorded (count, time, one audit
 * line with the link id and the viewer's hashed address), and the purge of
 * rows 30 days after they ended. The token never reaches a log or a row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";
import {
  AUDITOR_LINK_RETENTION_DAYS,
  AUDITOR_TOKEN_PATTERN,
  auditorLinkIsLive,
  hashAddress,
  hashAuditorToken,
} from "@/lib/registers/auditor-link";
import { ALL_PERIOD, type Period } from "@/lib/registers/period";

export type AuditorLinkRow = {
  id: string;
  account_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  last_opened_at: string | null;
  opened_count: number;
};

const COLUMNS =
  "id, account_id, expires_at, revoked_at, created_at, last_opened_at, opened_count";

/** The newest link of the account, live or not, so the page can say what happened to it. */
export async function latestAuditorLink(
  supabase: SupabaseClient,
  accountId: string,
): Promise<AuditorLinkRow | null> {
  const r = await supabase
    .from("auditor_links")
    .select(COLUMNS)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (r.data as AuditorLinkRow | null) ?? null;
}

export function liveLink(
  row: AuditorLinkRow | null,
  now = new Date(),
): AuditorLinkRow | null {
  return row && auditorLinkIsLive(row, now) ? row : null;
}

export type ResolvedAuditorLink = {
  linkId: string;
  accountId: string;
  tradingName: string;
  expiresAt: Date;
};

/** The live link behind a token, or null for anything else (never a reason, SR-1). */
export async function resolveAuditorToken(
  admin: SupabaseClient,
  token: string,
): Promise<ResolvedAuditorLink | null> {
  if (!AUDITOR_TOKEN_PATTERN.test(token)) return null;
  const r = await admin.rpc("auditor_link_lookup", {
    p_token_hash: hashAuditorToken(token),
  });
  if (r.error) {
    log.warn("auditor-link.lookup-failed", { code: r.error.code });
    return null;
  }
  const row = (
    r.data as
      | {
          link_id: string;
          account_id: string;
          trading_name: string;
          expires_at: string;
        }[]
      | null
  )?.[0];
  if (!row) return null;
  return {
    linkId: row.link_id,
    accountId: row.account_id,
    tradingName: row.trading_name,
    expiresAt: new Date(row.expires_at),
  };
}

/**
 * One open: the count and time on the row, one audit line (link id, hashed
 * address, and the period shown as `from` and `to`, `-` for an open side;
 * REQ-023 SR-3, nothing else).
 */
export async function recordAuditorOpen(
  admin: SupabaseClient,
  link: ResolvedAuditorLink,
  address: string | null,
  what: "opened" | "pack-downloaded",
  period: Period = ALL_PERIOD,
): Promise<void> {
  const current = await admin
    .from("auditor_links")
    .select("opened_count")
    .eq("id", link.linkId)
    .maybeSingle();
  const count =
    ((current.data as { opened_count: number } | null)?.opened_count ?? 0) + 1;
  await admin
    .from("auditor_links")
    .update({ last_opened_at: new Date().toISOString(), opened_count: count })
    .eq("id", link.linkId);
  await admin.from("audit_log").insert({
    account_id: link.accountId,
    actor_user_id: null,
    action: `auditor_link.${what}`,
    target: `${link.linkId} viewer:${address ? hashAddress(address) : "unknown"} from:${period.from ?? "-"} to:${period.to ?? "-"}`,
  });
}

/** The retention cutoff: rows that ended before it go (REQ-020 Data). */
export function purgeCutoff(now = new Date()): string {
  return new Date(
    now.getTime() - AUDITOR_LINK_RETENTION_DAYS * 86_400_000,
  ).toISOString();
}

/** Deletes the table's rows whose `column` is before the cutoff; one statement per ended-state column. */
async function purgeEnded(
  admin: SupabaseClient,
  table: "auditor_links" | "invitations" | "report_links",
  columns: readonly string[],
  cutoff: string,
): Promise<number> {
  let total = 0;
  for (const column of columns) {
    const r = await admin
      .from(table)
      .delete({ count: "exact" })
      .lt(column, cutoff);
    if (r.error)
      log.warn("auditor-link.purge-failed", { table, code: r.error.code });
    total += r.count ?? 0;
  }
  return total;
}

/** Rows whose link ended more than the retention period ago (REQ-020 Data). */
export async function purgeOldAuditorLinks(
  admin: SupabaseClient,
  now = new Date(),
): Promise<number> {
  return purgeEnded(
    admin,
    "auditor_links",
    ["expires_at", "revoked_at"],
    purgeCutoff(now),
  );
}

/**
 * Retro review of REQ-020, finding 27: an invitation (the worker's email
 * hash and token hash, Session B) ends when it is accepted, revoked or
 * expires, and goes 30 days later like an auditor link.
 */
export async function purgeOldInvitations(
  admin: SupabaseClient,
  now = new Date(),
): Promise<number> {
  return purgeEnded(
    admin,
    "invitations",
    ["accepted_at", "revoked_at", "expires_at"],
    purgeCutoff(now),
  );
}

/** A report link has no expiry; a revoked one goes 30 days after the revocation (finding 27). */
export async function purgeOldReportLinks(
  admin: SupabaseClient,
  now = new Date(),
): Promise<number> {
  return purgeEnded(admin, "report_links", ["revoked_at"], purgeCutoff(now));
}
