"use server";
/**
 * Accepting an invitation (REQ-020 FR-4): runs as the signed-in user
 * through `accept_invitation`, which checks the token, the expiry and that
 * the session's email hashes the same as the invited address, and makes
 * the membership. The answer never says why it failed (SR-1).
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashAuditorToken } from "@/lib/registers/auditor-link";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

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
  const supabase = await createSupabaseServerClient();
  const r = await supabase.rpc("accept_invitation", {
    p_token_hash: hashAuditorToken(parsed.data.token),
  });
  if (r.error || !r.data)
    return {
      ok: false,
      message:
        "That invitation does not work for this sign-in. Check you signed in with the email it was sent to, or ask for a new one.",
    };
  redirect("/worker");
}
