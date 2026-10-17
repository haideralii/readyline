"use server";
/**
 * The "Your registration" form (REQ-023 Session A, FR-1; D-2312): the dates
 * as typed from the certificate, the audit type, the override date with its
 * source, the last-audit and mid-term dates. The save derives whether the
 * mid-term audit applies from the audit type and the questionnaire's reading
 * of the classes (finding 78), writes the first period row or updates the
 * current one, mirrors the two `accounts` columns so the existing readers
 * keep working, writes one audit line per changed field (finding 74) and
 * clears the unsent timeline reminders through the owner-only function
 * (finding 61). Written with the owner's own session: RLS keeps it to the
 * owner's account and refuses a member.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  MIDTERM_OVERRIDE_SOURCES,
  midtermFor,
  type RegistrationPeriod,
} from "@/lib/registers/timeline";
import { REGISTRATION_KINDS } from "@/lib/registers/types";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { loadQuestionnaire } from "@/server/path/state";
import { currentPeriod } from "@/server/registers/registration-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = z.string().regex(ISO, "Enter a date as YYYY-MM-DD.");
const optionalDate = z
  .string()
  .max(10)
  .refine((v) => v === "" || ISO.test(v), "Enter a date as YYYY-MM-DD.");

const Input = strictObject({
  id: z.string().uuid().optional(),
  periodStartsOn: isoDate,
  periodEndsOn: isoDate,
  auditType: z.enum(REGISTRATION_KINDS),
  midtermStartByOverride: optionalDate.default(""),
  midtermOverrideSource: z.enum([...MIDTERM_OVERRIDE_SOURCES, ""]).default(""),
  lastAuditOn: optionalDate.default(""),
  midtermAuditOn: optionalDate.default(""),
});

export type RegistrationSaveResult =
  | { ok: true; periodId: string }
  | {
      ok: false;
      fieldErrors: Record<string, string[]>;
      formErrors: string[];
      /** "questionnaire" when the account has no completed assessment to derive from (finding 78). */
      code?: "questionnaire";
    };

const FIELDS = [
  "period_starts_on",
  "period_ends_on",
  "audit_type",
  "midterm_applies",
  "midterm_exempt_reason",
  "midterm_start_by_override",
  "midterm_override_source",
  "last_audit_on",
  "midterm_audit_on",
] as const;

export async function saveRegistrationPeriodAction(
  input: unknown,
): Promise<RegistrationSaveResult> {
  const parsed = parseInput(Input, input);
  if (!parsed.ok)
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      formErrors: parsed.formErrors,
    };
  const v = parsed.data;
  const fieldErrors: Record<string, string[]> = {};
  if (v.periodEndsOn <= v.periodStartsOn)
    fieldErrors.periodEndsOn = [
      "The period must end after it starts; both dates are on your certificate.",
    ];
  if (v.midtermStartByOverride) {
    if (v.midtermStartByOverride <= v.periodStartsOn)
      fieldErrors.midtermStartByOverride = [
        "That date is before your period starts.",
      ];
    else if (v.midtermStartByOverride > v.periodEndsOn)
      fieldErrors.midtermStartByOverride = [
        "That date is after your period ends.",
      ];
    if (!v.midtermOverrideSource)
      fieldErrors.midtermOverrideSource = [
        "Say where the date comes from: a condition on your certificate, or a letter from the Commissioner.",
      ];
  }
  for (const [key, value] of [
    ["lastAuditOn", v.lastAuditOn],
    ["midtermAuditOn", v.midtermAuditOn],
  ] as const)
    if (value && value < v.periodStartsOn)
      fieldErrors[key] = ["That date is before your period starts."];
  if (Object.keys(fieldErrors).length > 0)
    return { ok: false, fieldErrors, formErrors: [] };

  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return {
      ok: false,
      fieldErrors: {},
      formErrors: ["Sign in to save your registration dates."],
    };
  const accountId = viewer.account.id;
  const { result } = await loadQuestionnaire();
  if (!result)
    return {
      ok: false,
      fieldErrors: {},
      formErrors: [
        "Finish the questionnaire first: it tells us which classes you hold, and the mid-term audit rule reads them.",
      ],
      code: "questionnaire",
    };
  const midterm = midtermFor(v.auditType, result.midTermAudit);

  const supabase = await createSupabaseServerClient();
  const existing = await currentPeriod(supabase, accountId);
  const updating = existing && v.id && existing.id === v.id ? existing : null;
  const row = {
    period_starts_on: v.periodStartsOn,
    period_ends_on: v.periodEndsOn,
    audit_type: v.auditType,
    midterm_applies: midterm.applies,
    midterm_exempt_reason: midterm.reason,
    midterm_start_by_override: v.midtermStartByOverride || null,
    midterm_override_source: v.midtermStartByOverride
      ? v.midtermOverrideSource || null
      : null,
    last_audit_on: v.lastAuditOn || null,
    midterm_audit_on: v.midtermAuditOn || null,
  };

  let periodId: string;
  if (updating) {
    const up = await supabase
      .from("registration_periods")
      .update(row)
      .eq("id", updating.id)
      .select("id")
      .single();
    if (up.error) return failed(accountId, up.error.code, "update");
    periodId = up.data.id as string;
  } else {
    const ins = await supabase
      .from("registration_periods")
      .insert({ account_id: accountId, ...row })
      .select("id")
      .single();
    if (ins.error) {
      if (ins.error.code === "23505")
        return {
          ok: false,
          fieldErrors: {
            periodStartsOn: [
              "You already have a period that starts on that date; open it to change it.",
            ],
          },
          formErrors: [],
        };
      return failed(accountId, ins.error.code, "insert");
    }
    periodId = ins.data.id as string;
  }

  // FR-1: the four existing readers of the accounts columns keep working (D-2312).
  const mirror = await supabase
    .from("accounts")
    .update({
      registration_date: v.periodStartsOn,
      registration_kind: v.auditType,
    })
    .eq("id", accountId);
  if (mirror.error)
    log.warn("registration.mirror.failed", {
      accountId,
      code: mirror.error.code,
    });

  // Finding 74: one audit line per changed field, the typed values as typed, never an address.
  const lines: { action: string; target: string }[] = [];
  for (const field of FIELDS) {
    const before = updating
      ? String(updating[field as keyof RegistrationPeriod] ?? "none")
      : "none";
    const after = String(row[field] ?? "none");
    if (before !== after)
      lines.push({
        action: "registration.period.updated",
        target: `${field} ${before} -> ${after}`,
      });
  }
  if (lines.length > 0) {
    const audit = await supabase.from("audit_log").insert(
      lines.map((l) => ({
        account_id: accountId,
        actor_user_id: viewer.user.id,
        ...l,
      })),
    );
    if (audit.error)
      log.warn("audit.write.failed", { accountId, code: audit.error.code });
  }

  // FR-3's once rule: the unsent timeline rows go; the job derives them again from the new dates.
  const cleared = await supabase.rpc("clear_registration_reminders", {
    p_account: accountId,
  });
  if (cleared.error)
    log.warn("registration.clear-reminders.failed", {
      accountId,
      code: cleared.error.code,
    });

  for (const path of [
    "/account",
    "/path/audit-day",
    "/checklist",
    "/registers",
  ])
    revalidatePath(path);
  return { ok: true, periodId };
}

function failed(
  accountId: string,
  code: string | undefined,
  op: "insert" | "update",
): RegistrationSaveResult {
  log.warn("registration.save.failed", { accountId, code, op });
  return {
    ok: false,
    fieldErrors: {},
    formErrors:
      code === "42501"
        ? ["Only the account owner can change the registration dates."]
        : ["We could not save your registration dates. Please try again."],
  };
}
