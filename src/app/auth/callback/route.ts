/**
 * Magic-link landing (REQ-004 FR-1, FR-2, FR-6, FR-9): turns the link into a
 * session cookie, then sends a user with no account to the "about your
 * business" step, a user whose account was deleted back out (signed out, to
 * the "account deleted" page), and everyone else to their requested
 * same-origin page.
 *
 * Two ways in (src/server/auth/callback.ts): the token-hash link from the
 * email template, which works in any browser (FR-9a), and the legacy PKCE
 * code, kept until 2026-10-13 for links already sent. The failure redirect
 * carries only an error flag; the email never appears in a URL.
 */
import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { getDeletedAccount, getOwnedAccount } from "@/server/accounts/queries";
import { decideCallback } from "@/server/auth/callback";
import { safeNextPath } from "@/server/auth/paths";
import { createSupabaseServerClient } from "@/server/supabase/server";

// The raw query is read as strings; decideCallback validates each path's shape.
const RawQuery = strictObject({}).passthrough();

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const raw = parseInput(RawQuery, params);
  const decision = decideCallback(
    raw.ok ? (raw.data as Record<string, string>) : {},
  );
  const failed = (code: string, path: string) => {
    log.warn("auth.callback.failed", { code, path });
    return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
  };
  if (decision.kind === "invalid") return failed(decision.reason, "query");

  const supabase = await createSupabaseServerClient();
  const verified =
    decision.kind === "token_hash"
      ? await supabase.auth.verifyOtp({
          token_hash: decision.tokenHash,
          type: decision.type,
        })
      : await supabase.auth.exchangeCodeForSession(decision.code);
  if (verified.error || !verified.data.user)
    return failed(
      verified.error?.code ?? verified.error?.name ?? "no-user",
      decision.kind,
    );
  const user = verified.data.user;

  const account = await getOwnedAccount(supabase, user.id);
  if (!account) {
    const deleted = await getDeletedAccount(user.id);
    if (deleted) {
      // Sign-in is refused for a deleted account until the purge (AC-5).
      await supabase.auth.signOut({ scope: "local" });
      log.info("auth.callback.deleted-account", {
        userId: user.id,
        accountId: deleted.id,
      });
      return NextResponse.redirect(new URL("/account/deleted", url.origin));
    }
  }
  const destination = account ? safeNextPath(decision.next) : "/account/setup";
  log.info("auth.callback.ok", {
    userId: user.id,
    hasAccount: Boolean(account),
    path: decision.kind,
  });
  return NextResponse.redirect(new URL(destination, url.origin));
}
