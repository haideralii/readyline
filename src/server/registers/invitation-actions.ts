"use server";
/**
 * Accepting an invitation (REQ-020 FR-4): the signed-in user's id and the
 * peppered hash of their session email go to `accept_invitation`, which
 * checks the token, the expiry and that the hash equals the invited
 * address's, and makes the membership. The function is the service key's
 * alone (retro finding 34): the email hash is an HMAC under HASH_PEPPER,
 * which the database does not hold, so the server computes it from the
 * verified session and nothing a browser sends can stand in for it. The
 * answer never says why it failed (SR-1).
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { emailHash } from "@/lib/peppered-hash";
import { hashAuditorToken } from "@/lib/registers/auditor-link";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const Input = strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

export type AcceptResult = { ok: false; message: string } | null;

export async function acceptInvitationAction(
  _previous: AcceptResult,
  formData: FormData,
): Promise<AcceptResult> {
  const parsed = parseInput(Input, { token: formData.get("token") });
  if (!parsed.ok)
    return { ok: false, message: "That invitation does not work." };
  const viewer = await getViewer();
  if (!viewer)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/invite/${parsed.data.token}`)}`,
    );
  const email = viewer.user.email?.trim();
  if (!email)
    return {
      ok: false,
      message:
        "That invitation does not work for this sign-in. Check you signed in with the email it was sent to, or ask for a new one.",
    };
  const admin = createSupabaseAdminClient();
  const r = await admin.rpc("accept_invitation", {
    p_token_hash: hashAuditorToken(parsed.data.token),
    p_user_id: viewer.user.id,
    p_email_hash: emailHash(email),
  });
  if (r.error || !r.data)
    return {
      ok: false,
      message:
        "That invitation does not work for this sign-in. Check you signed in with the email it was sent to, or ask for a new one.",
    };
  redirect("/worker");
}
