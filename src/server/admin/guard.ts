/**
 * Admin access rules (REQ-004 FR-7, AC-7), kept pure so they are unit-tested:
 * anyone who is not a platform admin gets "not-found" (the routes behave as if
 * they do not exist); an admin without a current TOTP session must enrol or
 * verify first.
 */
export type AssuranceLevel = "aal1" | "aal2" | null;

export type AdminAccess =
  | { kind: "not-found" }
  | { kind: "mfa-enrol" }
  | { kind: "mfa-verify"; factorId: string }
  | { kind: "ok" };

export function resolveAdminAccess(input: {
  signedIn: boolean;
  platformAdmin: boolean;
  currentLevel: AssuranceLevel;
  verifiedTotpFactorIds: string[];
}): AdminAccess {
  if (!input.signedIn || !input.platformAdmin) return { kind: "not-found" };
  if (input.currentLevel === "aal2") return { kind: "ok" };
  const factorId = input.verifiedTotpFactorIds[0];
  if (!factorId) return { kind: "mfa-enrol" };
  return { kind: "mfa-verify", factorId };
}
