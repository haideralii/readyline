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

/** One open: the count and time on the row, one audit line (link id, hashed address). */
export async function recordAuditorOpen(
  admin: SupabaseClient,
  link: ResolvedAuditorLink,
  address: string | null,
  what: "opened" | "pack-downloaded",
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
    target: `${link.linkId} viewer:${address ? hashAddress(address) : "unknown"}`,
  });
}

/** Rows whose link ended more than the retention period ago (REQ-020 Data). */
export async function purgeOldAuditorLinks(
  admin: SupabaseClient,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(
    now.getTime() - AUDITOR_LINK_RETENTION_DAYS * 86_400_000,
  ).toISOString();
  const expired = await admin
    .from("auditor_links")
    .delete({ count: "exact" })
    .lt("expires_at", cutoff);
  const revoked = await admin
    .from("auditor_links")
    .delete({ count: "exact" })
    .lt("revoked_at", cutoff);
  if (expired.error)
    log.warn("auditor-link.purge-failed", { code: expired.error.code });
  if (revoked.error)
    log.warn("auditor-link.purge-failed", { code: revoked.error.code });
  return (expired.count ?? 0) + (revoked.count ?? 0);
}
