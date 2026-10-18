"use server";
/**
 * Live QA of b340ee3, D-2836 (the acceptance read of REQ-022 B): the
 * unsubscribe page sends the person to the account page to turn reminders
 * back on, so the account page has the control. The owner's one write:
 * clear `do_not_send` on their own account's row, with one audit line.
 * The owner reads and updates their own row under RLS (the B integration
 * test proves it), so the write runs with the owner's session; the account
 * id comes from the session, never the form.
 */
import { revalidatePath } from "next/cache";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { resumeReminders } from "@/server/email/reminder-settings";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type ResumeRemindersResult =
  { ok: true } | { ok: false; message: string };

export async function resumeRemindersAction(
  _previous: ResumeRemindersResult | null,
  _formData: FormData,
): Promise<ResumeRemindersResult> {
  void _formData;
  void parseInput(strictObject({}), {});
  const viewer = await getViewer();
  // The viewer's account is the one they own (getViewer), so this is the owner's write alone.
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in first." };
  const done = await resumeReminders(
    await createSupabaseServerClient(),
    viewer.account.id,
    viewer.user.id,
  );
  if (!done.ok)
    return { ok: false, message: "Could not change this just now." };
  revalidatePath("/account");
  return { ok: true };
}
