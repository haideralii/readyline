import "server-only";
/**
 * Server-side admin gate (REQ-004 FR-7, AC-7). Every admin page calls
 * requireAdmin(); non-admins and signed-out visitors get Next's 404, admins
 * without a TOTP-verified session are sent to /admin/mfa, and every admin
 * action is written to audit_log with the service key.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { log } from "@/lib/logging/logger";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  resolveAdminAccess,
  type AdminAccess,
  type AssuranceLevel,
} from "./guard";

export type AdminContext = {
  user: User;
  supabase: SupabaseClient;
  access: AdminAccess;
};

/** Resolves the admin state without redirecting; null means "behave as not found". */
export async function readAdminContext(): Promise<AdminContext | null> {
  let supabase: SupabaseClient;
  try {
    supabase = await createSupabaseServerClient();
  } catch (e) {
    if (e instanceof SupabaseEnvError) return null;
    throw e;
  }
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  const row = user
    ? await supabase
        .from("users")
        .select("platform_admin")
        .eq("id", user.id)
        .maybeSingle()
    : null;
  const platformAdmin = Boolean(row?.data?.platform_admin);
  let currentLevel: AssuranceLevel = null;
  let verifiedTotpFactorIds: string[] = [];
  if (user && platformAdmin) {
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    currentLevel = (aal.data?.currentLevel as AssuranceLevel) ?? null;
    const factors = await supabase.auth.mfa.listFactors();
    verifiedTotpFactorIds = (factors.data?.totp ?? [])
      .filter((f) => f.status === "verified")
      .map((f) => f.id);
  }
  const access = resolveAdminAccess({
    signedIn: Boolean(user),
    platformAdmin,
    currentLevel,
    verifiedTotpFactorIds,
  });
  if (!user || access.kind === "not-found") return null;
  return { user, supabase, access };
}

/** For admin pages: 404 unless the viewer is a platform admin; MFA required unless `mfa: false`. */
export async function requireAdmin(
  opts: { mfa: boolean } = { mfa: true },
): Promise<AdminContext> {
  const ctx = await readAdminContext();
  if (!ctx) notFound();
  if (opts.mfa && ctx.access.kind !== "ok") redirect("/admin/mfa");
  return ctx;
}

export async function writeAdminAudit(
  actorUserId: string,
  action: string,
  target?: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const r = await admin.from("audit_log").insert({
    account_id: null,
    actor_user_id: actorUserId,
    action,
    target: target ?? null,
  });
  if (r.error)
    log.warn("audit.admin.write.failed", { action, code: r.error.code });
}
