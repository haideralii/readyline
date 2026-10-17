"use server";
/**
 * The owner's two actions on the auditor link (REQ-020 FR-2): create one
 * (24, 48 or 72 hours; a live link is revoked first, so there is one at a
 * time) and revoke it. The token is returned to the page once, from here,
 * and stored only as its hash; every step writes its audit line. Plain form
 * posts that work without JavaScript.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  auditorLinkExpiry,
  auditorLinkPath,
  generateAuditorToken,
  hashAuditorToken,
  type AuditorLinkHours,
} from "@/lib/registers/auditor-link";
import { siteUrl } from "@/lib/site";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { latestAuditorLink, liveLink } from "./auditor-links";

export type AuditorLinkActionResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: true; revoked: true; id: string }
  | { ok: false; message: string };

const CreateInput = strictObject({
  hours: z.enum(["24", "48", "72"]).default("72"),
  /** REQ-023 FR-8 (D-2309): the owner's tick, "on" when ticked; absent otherwise, so the default is off. */
  includeRehearsal: z.enum(["on"]).optional(),
});

const RevokeInput = strictObject({
  id: z.string().uuid(),
});

const NOT_OWNER = "Only the account's owner can share an auditor link.";

export async function createAuditorLinkAction(
  _previous: AuditorLinkActionResult | null,
  formData: FormData,
): Promise<AuditorLinkActionResult> {
  const raw = formData.get("hours");
  const tick = formData.get("includeRehearsal");
  const parsed = parseInput(CreateInput, {
    ...(typeof raw === "string" ? { hours: raw } : {}),
    ...(tick === "on" ? { includeRehearsal: "on" } : {}),
  });
  if (!parsed.ok) return { ok: false, message: "Choose 24, 48 or 72 hours." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to share an auditor link." };
  const supabase = await createSupabaseServerClient();
  const accountId = viewer.account.id;
  const now = new Date();
  const current = liveLink(await latestAuditorLink(supabase, accountId), now);
  if (current) {
    const r = await supabase
      .from("auditor_links")
      .update({ revoked_at: now.toISOString() })
      .eq("id", current.id)
      .eq("account_id", accountId)
      .select("id");
    if (r.error || !r.data?.length) return { ok: false, message: NOT_OWNER };
    await supabase.from("audit_log").insert({
      account_id: accountId,
      actor_user_id: viewer.user.id,
      action: "auditor_link.revoked",
      target: `${current.id} replaced`,
    });
  }
  const hours = Number(parsed.data.hours) as AuditorLinkHours;
  const token = generateAuditorToken();
  const expiresAt = auditorLinkExpiry(now, hours);
  const ins = await supabase
    .from("auditor_links")
    .insert({
      account_id: accountId,
      token_hash: hashAuditorToken(token),
      expires_at: expiresAt.toISOString(),
      created_by: viewer.user.id,
      include_rehearsal: parsed.data.includeRehearsal === "on",
    })
    .select("id")
    .single();
  if (ins.error) {
    log.warn("auditor-link.create-failed", { accountId, code: ins.error.code });
    return { ok: false, message: NOT_OWNER };
  }
  await supabase.from("audit_log").insert({
    account_id: accountId,
    actor_user_id: viewer.user.id,
    action: "auditor_link.created",
    target: `${ins.data.id as string} ${hours}h${parsed.data.includeRehearsal === "on" ? " rehearsal" : ""}`,
  });
  // The account page reads the live link on the server; without this the panel
  // never shows the new link's state (run 38721614254, PR #61).
  revalidatePath("/account");
  return {
    ok: true,
    url: `${siteUrl()}${auditorLinkPath(token)}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function revokeAuditorLinkAction(
  _previous: AuditorLinkActionResult | null,
  formData: FormData,
): Promise<AuditorLinkActionResult> {
  const parsed = parseInput(RevokeInput, { id: formData.get("id") });
  if (!parsed.ok) return { ok: false, message: "That link was not found." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to revoke an auditor link." };
  const supabase = await createSupabaseServerClient();
  const r = await supabase
    .from("auditor_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("account_id", viewer.account.id)
    .is("revoked_at", null)
    .select("id");
  if (r.error || !r.data?.length) return { ok: false, message: NOT_OWNER };
  await supabase.from("audit_log").insert({
    account_id: viewer.account.id,
    actor_user_id: viewer.user.id,
    action: "auditor_link.revoked",
    target: parsed.data.id,
  });
  revalidatePath("/account");
  return { ok: true, revoked: true, id: parsed.data.id };
}
