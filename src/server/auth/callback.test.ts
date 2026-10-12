import { describe, expect, it } from "vitest";
import { decideCallback, LEGACY_CODE_PATH_UNTIL } from "./callback";

const before = new Date("2026-10-12T12:00:00+11:00");
const after = new Date(new Date(LEGACY_CODE_PATH_UNTIL).getTime() + 1000);
// Fixture hashes are built at runtime, never written as literals (REQ-002 secret-scan rule).
const HASH32 = "a1b2c3d4".repeat(4);
const HASH24 = "a1b2c3d4".repeat(3);
const CODE = ["pkce", "code", "123456"].join("-");

describe("magic-link callback paths (REQ-004 FR-9a)", () => {
  it("takes the token-hash path from the email template, with the type and the next path", () => {
    expect(
      decideCallback(
        {
          token_hash: HASH32,
          type: "magiclink",
          next: "/documents",
        },
        before,
      ),
    ).toEqual({
      kind: "token_hash",
      tokenHash: HASH32,
      type: "magiclink",
      next: "/documents",
    });
  });

  it("keeps the legacy code path until the cut-off and refuses it afterwards", () => {
    expect(decideCallback({ code: CODE, next: "/account" }, before)).toEqual({
      kind: "code",
      code: CODE,
      next: "/account",
    });
    expect(decideCallback({ code: CODE }, after)).toEqual({
      kind: "invalid",
      reason: "legacy-expired",
    });
  });

  it("prefers the token hash when both are present and rejects malformed or missing input", () => {
    expect(
      decideCallback(
        {
          token_hash: HASH24,
          type: "magiclink",
          code: CODE,
        },
        before,
      ).kind,
    ).toBe("token_hash");
    expect(
      decideCallback({ token_hash: "short", type: "magiclink" }, before),
    ).toEqual({
      kind: "invalid",
      reason: "malformed",
    });
    expect(decideCallback({ token_hash: HASH24, type: "sms" }, before)).toEqual(
      {
        kind: "invalid",
        reason: "malformed",
      },
    );
    expect(decideCallback({ code: "x" }, before)).toEqual({
      kind: "invalid",
      reason: "malformed",
    });
    expect(decideCallback({}, before)).toEqual({
      kind: "invalid",
      reason: "missing",
    });
    expect(decideCallback({ next: "/account" }, before)).toEqual({
      kind: "invalid",
      reason: "missing",
    });
  });
});
