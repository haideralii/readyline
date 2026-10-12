/**
 * Generation policy (REQ-005 FR-9, SR-6, AC-8, AC-10): the feature flag and
 * the per-account daily quota, as pure decisions so they are unit-tested.
 * The quota count itself lives in Postgres (generation_quota_hit) so two
 * concurrent requests cannot both pass.
 */
export type GenerationGate =
  | { allowed: true }
  | {
      allowed: false;
      reason: "disabled" | "quota" | "no-account" | "deleted";
      message: string;
    };

export function isGenerationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.GENERATION_ENABLED?.trim().toLowerCase() === "true";
}

export const QUOTA_MESSAGE =
  "You have used today's document generations for this account. The limit resets at midnight Sydney time; your existing documents stay available.";

export const DISABLED_MESSAGE =
  "Document generation is coming soon. Your questionnaire result and readiness list are ready now.";

export function decideGeneration(input: {
  enabled: boolean;
  hasAccount: boolean;
  deleted: boolean;
  withinQuota: boolean;
}): GenerationGate {
  if (!input.enabled)
    return { allowed: false, reason: "disabled", message: DISABLED_MESSAGE };
  if (input.deleted)
    return {
      allowed: false,
      reason: "deleted",
      message: "This account was deleted; nothing can be generated.",
    };
  if (!input.hasAccount)
    return {
      allowed: false,
      reason: "no-account",
      message: "Create your account before generating documents.",
    };
  if (!input.withinQuota)
    return { allowed: false, reason: "quota", message: QUOTA_MESSAGE };
  return { allowed: true };
}
