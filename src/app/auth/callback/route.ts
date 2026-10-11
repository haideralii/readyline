/**
 * Magic-link landing (REQ-004 FR-1, FR-2): exchanges the one-time code for a
 * session cookie, then sends a user with no account to the "about your
 * business" step and everyone else to their requested same-origin page.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { getOwnedAccount } from "@/server/accounts/queries";
import { safeNextPath } from "@/server/auth/paths";
import { createSupabaseServerClient } from "@/server/supabase/server";

const Query = strictObject({
  code: z.string().min(8).max(512),
  next: z.string().max(512).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = parseInput(Query, {
    code: params.code,
    ...(params.next ? { next: params.next } : {}),
  });
  if (!parsed.ok)
    return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(
    parsed.data.code,
  );
  if (error || !data.user) {
    log.warn("auth.callback.failed", {
      code: error?.code ?? error?.name ?? "no-user",
    });
    return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
  }

  const account = await getOwnedAccount(supabase, data.user.id);
  const destination = account
    ? safeNextPath(parsed.data.next)
    : "/account/setup";
  log.info("auth.callback.ok", {
    userId: data.user.id,
    hasAccount: Boolean(account),
  });
  return NextResponse.redirect(new URL(destination, url.origin));
}
