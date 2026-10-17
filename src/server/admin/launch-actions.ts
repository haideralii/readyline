"use server";
/**
 * REQ-022 FR-6, SR-2: "Send me a test email" on /admin/launch. Behind
 * requireAdmin() (the aal2 session); the message goes to the signed-in
 * admin's own address and nowhere else; one a minute, read from the last
 * `email.test-sent` audit line; the send and its refusal never carry the
 * address. The launch row "Test email in the last 24 hours" reads the
 * same audit line.
 */
import { createEmailProvider } from "@/server/email/provider";
import { testEmail } from "@/server/email/templates";
import { readAdminContext, writeAdminAudit } from "@/server/admin/access";
import { TEST_SEND_ACTION } from "@/server/ops/launch-facts";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";

const TEST_SEND_MIN_SECONDS = 60;
/** The form carries nothing; a field smuggled into it is refused (the boundary convention). */
const Input = strictObject({});

export type TestSendResponse =
  { ok: true; provider: string } | { ok: false; message: string };

export async function sendTestEmailAction(
  formData?: FormData,
): Promise<TestSendResponse> {
  const input = parseInput(
    Input,
    Object.fromEntries(formData?.entries() ?? []),
  );
  if (!input.ok) return { ok: false, message: "Not available." };
  const ctx = await readAdminContext();
  if (!ctx || ctx.access.kind !== "ok")
    return { ok: false, message: "Not available." };
  const to = ctx.user.email?.trim();
  if (!to) return { ok: false, message: "Your account has no email address." };
  const admin = createSupabaseAdminClient();
  const last = await admin
    .from("audit_log")
    .select("at")
    .eq("action", TEST_SEND_ACTION)
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastAt = (last.data as { at: string } | null)?.at;
  if (
    lastAt &&
    Date.now() - new Date(lastAt).getTime() < TEST_SEND_MIN_SECONDS * 1000
  )
    return {
      ok: false,
      message: "One test email a minute; try again shortly.",
    };
  const provider = createEmailProvider();
  try {
    await provider.send(testEmail({ to }));
  } catch (e) {
    log.warn("email.test-send.failed", {
      provider: provider.name,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      message:
        "The provider refused the send; check the SMTP values in Vercel and the sender's domain.",
    };
  }
  await writeAdminAudit(ctx.user.id, TEST_SEND_ACTION, provider.name);
  return { ok: true, provider: provider.name };
}
