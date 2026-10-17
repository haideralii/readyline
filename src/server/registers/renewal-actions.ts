"use server";
/**
 * The renewal path's dated steps (REQ-023 Session C, FR-7; D-2316, D-2342):
 * the application, the scope of audit, the booking and the decision write
 * their date (and, for the booking, the auditing company's name) onto the
 * current period row, with one `registration.period.updated` audit line per
 * changed field as the registration form writes (finding 74), and the
 * application's date is mirrored onto FR-4's dated checklist item, one date
 * with two readers. Owner only; no participant data (SR-1).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  RENEWAL_DATED_STEPS,
  RENEWAL_FORMS,
  type RenewalDatedStep,
} from "@/lib/path/renewal";
import { NDIS_NUMBER_SHAPE } from "@/lib/registers/types";
import { parseInput, strictObject, text } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { getOwnedAccount } from "@/server/accounts/owned-account";
import { checkRegisterWriteAllowed } from "@/server/auth/rate-limit";
import { currentPeriod } from "@/server/registers/registration-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const Input = strictObject({
  step: z.enum(RENEWAL_DATED_STEPS),
  /** The date, or empty to clear it. */
  date: z
    .string()
    .max(10)
    .refine((v) => v === "" || ISO.test(v), {
      message: "Enter a date as YYYY-MM-DD.",
    }),
  /** The booking step alone: the auditing company's name, never a person's (finding 39). */
  auditorBusinessName: text(80)
    .regex(
      /^[A-Za-z0-9 &'./()-]*$/,
      "Letters, digits, spaces and & ' . / ( ) - only",
    )
    .refine(
      (v) => !NDIS_NUMBER_SHAPE.test(v),
      "This looks like an NDIS participant number.",
    )
    .default(""),
});

export type RenewalStepResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

/** FR-4 mirror: the checklist item the step's date also fills. */
const CHECKLIST_ITEM: Partial<Record<RenewalDatedStep, string>> = {
  application: "audit:renewal-application-submitted",
};

export async function saveRenewalStepAction(
  input: unknown,
): Promise<RenewalStepResult> {
  const parsed = parseInput(Input, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.fieldErrors,
    };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to record your renewal steps." };
  const supabase = await createSupabaseServerClient();
  const owned = await getOwnedAccount(supabase, viewer.user.id);
  if (!owned || owned.id !== viewer.account.id)
    return { ok: false, message: "Only the account's owner can record these." };
  if (!(await checkRegisterWriteAllowed(viewer.user.id)))
    return {
      ok: false,
      message: "Too many changes in a minute. Wait a moment and try again.",
    };
  const accountId = viewer.account.id;
  const period = await currentPeriod(supabase, accountId);
  if (!period)
    return {
      ok: false,
      message:
        "Type the dates from your certificate on the account page first; the renewal path reads them.",
    };
  const v = parsed.data;
  const column = RENEWAL_FORMS[v.step].column;
  const row: Record<string, string | null> = { [column]: v.date || null };
  if (v.step === "booking") row.auditor_business_name = v.auditorBusinessName;
  if (v.step === "scope" && v.date && !period.application_submitted_on)
    return {
      ok: false,
      message:
        "Type the day you applied first; the scope of audit follows the application.",
    };
  if (v.step === "decision" && v.date && !period.application_submitted_on)
    return {
      ok: false,
      message:
        "Type the day you applied first; the decision follows the application.",
    };
  const up = await supabase
    .from("registration_periods")
    .update(row)
    .eq("id", period.id)
    .eq("account_id", accountId)
    .select("id");
  if (up.error || !up.data?.length) {
    log.warn("renewal.step.failed", {
      accountId,
      step: v.step,
      code: up.error?.code,
    });
    return { ok: false, message: "We could not save that just now." };
  }
  // Finding 74: one audit line per changed field, the typed values as typed, never an address.
  const lines = Object.entries(row)
    .filter(
      ([field, after]) =>
        String((period as Record<string, unknown>)[field] ?? "none") !==
        String(after ?? "none"),
    )
    .map(([field, after]) => ({
      account_id: accountId,
      actor_user_id: viewer.user.id,
      action: "registration.period.updated",
      target: `${field} ${String((period as Record<string, unknown>)[field] ?? "none")} -> ${String(after ?? "none")}`,
    }));
  if (lines.length) {
    const audit = await supabase.from("audit_log").insert(lines);
    if (audit.error)
      log.warn("audit.write.failed", { accountId, code: audit.error.code });
  }
  // FR-4: the application's date is the checklist item's date (one date, two readers).
  const itemId = CHECKLIST_ITEM[v.step];
  if (itemId) {
    const item = await supabase.from("checklist_items").upsert(
      {
        account_id: accountId,
        item_id: itemId,
        status: v.date ? "have" : "need",
        done_on: v.date || null,
      },
      { onConflict: "account_id,item_id" },
    );
    if (item.error)
      log.warn("renewal.checklist-mirror.failed", {
        accountId,
        code: item.error.code,
      });
  }
  // FR-3's once rule: the unsent timeline rows go; the job derives them again (the last call reads the application).
  const cleared = await supabase.rpc("clear_registration_reminders", {
    p_account: accountId,
  });
  if (cleared.error)
    log.warn("registration.clear-reminders.failed", {
      accountId,
      code: cleared.error.code,
    });
  for (const path of [
    "/path/renewal",
    "/account",
    "/checklist",
    "/path/audit-day",
  ])
    revalidatePath(path);
  return { ok: true };
}
