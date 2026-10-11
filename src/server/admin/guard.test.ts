import { describe, expect, it } from "vitest";
import { resolveAdminAccess } from "./guard";

describe("resolveAdminAccess (REQ-004 AC-7)", () => {
  it("treats signed-out and non-admin users as not found", () => {
    expect(
      resolveAdminAccess({
        signedIn: false,
        platformAdmin: false,
        currentLevel: null,
        verifiedTotpFactorIds: [],
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      resolveAdminAccess({
        signedIn: true,
        platformAdmin: false,
        currentLevel: "aal2",
        verifiedTotpFactorIds: ["f1"],
      }),
    ).toEqual({ kind: "not-found" });
  });

  it("requires enrolment when the admin has no verified TOTP factor", () => {
    expect(
      resolveAdminAccess({
        signedIn: true,
        platformAdmin: true,
        currentLevel: "aal1",
        verifiedTotpFactorIds: [],
      }),
    ).toEqual({ kind: "mfa-enrol" });
  });

  it("requires a TOTP challenge when a factor exists but the session is aal1", () => {
    expect(
      resolveAdminAccess({
        signedIn: true,
        platformAdmin: true,
        currentLevel: "aal1",
        verifiedTotpFactorIds: ["f1"],
      }),
    ).toEqual({ kind: "mfa-verify", factorId: "f1" });
  });

  it("admits an admin whose session is already aal2", () => {
    expect(
      resolveAdminAccess({
        signedIn: true,
        platformAdmin: true,
        currentLevel: "aal2",
        verifiedTotpFactorIds: ["f1"],
      }),
    ).toEqual({ kind: "ok" });
  });
});
