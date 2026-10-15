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
import { getWorkerMembership } from "@/server/accounts/worker-membership";
import { decideCallback } from "@/server/auth/callback";
import { safeNextPath } from "@/server/auth/paths";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";
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

  // Any failure to verify, including an environment with no Supabase, lands on
  // the plain failure screen rather than an error page (FR-9c).
  let user;
  try {
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
    user = verified.data.user;
  } catch (e) {
    if (e instanceof SupabaseEnvError)
      return failed("not-configured", decision.kind);
    log.error("auth.callback.error", { error: e, path: decision.kind });
    return failed("error", decision.kind);
  }
  const supabase = await createSupabaseServerClient();

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
  // REQ-020 FR-4: a worker lands on their home; a user following an
  // invitation goes back to it to accept, with no account of their own.
  const next = safeNextPath(decision.next);
  let destination: string;
  if (account) destination = next;
  else if (next.startsWith("/invite/")) destination = next;
  else {
    let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
    try {
      admin = createSupabaseAdminClient();
    } catch (e) {
      if (!(e instanceof SupabaseEnvError)) throw e;
    }
    const worker = await getWorkerMembership(supabase, admin, user.id);
    destination = worker ? "/worker" : "/account/setup";
  }
  log.info("auth.callback.ok", {
    userId: user.id,
    hasAccount: Boolean(account),
    path: decision.kind,
  });
  return NextResponse.redirect(new URL(destination, url.origin));
}
