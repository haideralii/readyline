import "server-only";
/**
 * REQ-022 FR-5, FR-7, SR-6 (D-2823): the account's reminder settings. The
 * job asks before every send; the unsubscribe page sets do_not_send by the
 * token's hash. Runs with the service role (the job, the public page), so
 * the queries name the account and nothing else.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hashUnsubscribeToken,
  sameHash,
  UNSUBSCRIBE_TOKEN_PATTERN,
  unsubscribeToken,
} from "@/lib/email/unsubscribe-token";
import { log } from "@/lib/logging/logger";

export const UNSUBSCRIBED_ACTION = "reminders.unsubscribed";

type Row = {
  account_id: string;
  do_not_send: boolean;
  unsubscribe_token_hash: string | null;
};

/**
 * The account's row, created on first use; with a pepper the token's hash
 * is kept current (a pepper change writes the new hash). Returns whether
 * the account asked for no reminders and the token to put in the email
 * (null without a pepper: then the email carries no unsubscribe line and
 * the SMTP provider is not configured anyway, D-2822).
 */
export async function ensureReminderSettings(
  admin: SupabaseClient,
  accountId: string,
  pepper: string | null,
): Promise<{ doNotSend: boolean; token: string | null }> {
  const token = pepper ? unsubscribeToken(accountId, pepper) : null;
  const hash = token ? hashUnsubscribeToken(token) : null;
  const r = await admin
    .from("reminder_settings")
    .select("account_id, do_not_send, unsubscribe_token_hash")
    .eq("account_id", accountId)
    .maybeSingle();
  if (r.error) throw new Error(r.error.message);
  const row = r.data as Row | null;
  if (!row) {
    const ins = await admin
      .from("reminder_settings")
      .insert({ account_id: accountId, unsubscribe_token_hash: hash });
    if (ins.error) throw new Error(ins.error.message);
    return { doNotSend: false, token };
  }
  if (hash && row.unsubscribe_token_hash !== hash) {
    const up = await admin
      .from("reminder_settings")
      .update({ unsubscribe_token_hash: hash })
      .eq("account_id", accountId);
    if (up.error) throw new Error(up.error.message);
  }
  return { doNotSend: row.do_not_send, token };
}

export type UnsubscribeResult =
  { ok: true; accountId: string; tradingName: string | null } | { ok: false };

/**
 * The click: the token's hash finds the row (constant-time compare on the
 * stored hash), do_not_send is set with the reason and the time, one audit
 * line is written; a second click says the same and writes nothing new.
 */
export async function unsubscribeByToken(
  admin: SupabaseClient,
  token: string,
): Promise<UnsubscribeResult> {
  if (!UNSUBSCRIBE_TOKEN_PATTERN.test(token)) return { ok: false };
  const hash = hashUnsubscribeToken(token);
  const r = await admin
    .from("reminder_settings")
    .select(
      "account_id, do_not_send, unsubscribe_token_hash, accounts!inner(trading_name, deleted_at)",
    )
    .eq("unsubscribe_token_hash", hash)
    .maybeSingle();
  if (r.error) throw new Error(r.error.message);
  const row = r.data as
    | (Row & {
        accounts: { trading_name: string | null; deleted_at: string | null };
      })
    | null;
  if (
    !row ||
    !row.unsubscribe_token_hash ||
    !sameHash(row.unsubscribe_token_hash, hash) ||
    row.accounts.deleted_at
  )
    return { ok: false };
  const tradingName = row.accounts.trading_name?.trim() || null;
  if (row.do_not_send)
    return { ok: true, accountId: row.account_id, tradingName };
  const up = await admin
    .from("reminder_settings")
    .update({
      do_not_send: true,
      do_not_send_reason: "unsubscribed",
      do_not_send_at: new Date().toISOString(),
    })
    .eq("account_id", row.account_id);
  if (up.error) throw new Error(up.error.message);
  const audit = await admin.from("audit_log").insert({
    account_id: row.account_id,
    actor_user_id: null,
    action: UNSUBSCRIBED_ACTION,
    target: "reminders",
  });
  if (audit.error)
    log.warn("audit.write.failed", {
      action: UNSUBSCRIBED_ACTION,
      code: audit.error.code,
    });
  return { ok: true, accountId: row.account_id, tradingName };
}
