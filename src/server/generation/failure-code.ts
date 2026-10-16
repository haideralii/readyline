/**
 * The closed code beside `payments.generation.failed`'s free-text reason
 * (after-window item 9, 16 Oct 2026): the logger omits `reason` as free
 * text, which is right in production and left three failures unreadable in
 * CI (runs 38750817767 and 38826340580). The code names the branch of
 * `loadContext` or the job that gave up; the text stays omitted.
 */
export const GENERATION_FAILURE_CODES = [
  "entitlement-read",
  "entitlement-missing",
  "entitlement-revoked",
  "account-missing",
  "account-deleted",
  "owner-missing",
  "questionnaire-missing",
  "questionnaire-incomplete",
  "build-failed",
  "attempts-exhausted",
  "other",
] as const;
export type GenerationFailureCode = (typeof GENERATION_FAILURE_CODES)[number];

/**
 * PO 16 Oct 2026 19:44 (after #75's run, three `owner-missing` lines at
 * 07:36:07Z): an account deleted, or left without an owner, before its job
 * ran is the account's end and not a failure anyone can act on, so the job
 * logs these two at `warn`; every other permanent failure stays an alert.
 */
export const QUIET_FAILURE_CODES: readonly GenerationFailureCode[] = [
  "account-deleted",
  "owner-missing",
];

const BY_PREFIX: [string, GenerationFailureCode][] = [
  ["entitlement read:", "entitlement-read"],
  ["entitlement missing", "entitlement-missing"],
  ["entitlement revoked", "entitlement-revoked"],
  ["account missing", "account-missing"],
  ["account deleted", "account-deleted"],
  ["owner missing", "owner-missing"],
  ["questionnaire draft missing", "questionnaire-missing"],
  ["questionnaire incomplete", "questionnaire-incomplete"],
];

export function generationFailureCode(
  reason: string,
  kind: "context" | "build" | "attempts",
): GenerationFailureCode {
  if (kind === "build") return "build-failed";
  if (kind === "attempts") return "attempts-exhausted";
  for (const [prefix, code] of BY_PREFIX)
    if (reason.startsWith(prefix)) return code;
  return "other";
}

/**
 * CI only: the raw reason at `warn`, under a key the redactor does not omit,
 * so a job log in the Supabase job says which account died and why. Never
 * on a Vercel deployment (`VERCEL_ENV` is set there), whatever `CI` says.
 */
export function reasonForCi(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CI === "true" && !env.VERCEL_ENV;
}
