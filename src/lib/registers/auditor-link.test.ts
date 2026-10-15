// @vitest-environment node
/** REQ-020 FR-2, SR-1: the auditor link's token, hash, expiry, liveness and banner. */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AUDITOR_TOKEN_PATTERN,
  auditorBanner,
  auditorLinkExpiry,
  auditorLinkIsLive,
  auditorLinkPath,
  generateAuditorToken,
  hashAddress,
  hashAuditorToken,
  hashesMatch,
  isAuditorLinkHours,
} from "./auditor-link";

describe("the auditor token", () => {
  it("is 32 random bytes as base64url, 43 characters, and two draws differ", () => {
    const a = generateAuditorToken();
    const b = generateAuditorToken();
    expect(a).toMatch(AUDITOR_TOKEN_PATTERN);
    expect(b).toMatch(AUDITOR_TOKEN_PATTERN);
    expect(a).not.toBe(b);
    expect(generateAuditorToken(new Uint8Array(32))).toBe(
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
  });

  it("hashes to 64 hex characters, the same input the same way, and compares in constant time", () => {
    const h = hashAuditorToken("token");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAuditorToken("token")).toBe(h);
    expect(hashAuditorToken("token2")).not.toBe(h);
    expect(hashesMatch(h, hashAuditorToken("token"))).toBe(true);
    expect(hashesMatch(h, hashAuditorToken("token2"))).toBe(false);
    expect(hashesMatch(h, "short")).toBe(false);
  });

  it("the path and the address hash never carry the raw address", () => {
    expect(auditorLinkPath("abc")).toBe("/auditor/abc");
    expect(hashAddress("203.0.113.9")).toMatch(/^[0-9a-f]{16}$/);
    expect(hashAddress("203.0.113.9")).not.toContain("203");
  });

  it("the address hash is keyed: it changes with the pepper and is not the plain SHA-256 (retro finding 34)", () => {
    const a = hashAddress("203.0.113.9", "pepper-a");
    const b = hashAddress("203.0.113.9", "pepper-b");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toBe(b);
    expect(hashAddress(" 203.0.113.9 ", "pepper-a")).toBe(a);
    const plain = createHash("sha256")
      .update("203.0.113.9", "utf8")
      .digest("hex")
      .slice(0, 16);
    expect(a).not.toBe(plain);
    // D-2238: without a pepper the hash is the plain SHA-256 it was before.
    expect(hashAddress("203.0.113.9", null)).toBe(plain);
  });
});

describe("expiry and liveness", () => {
  const now = new Date("2026-10-15T06:00:00Z");

  it("takes 24, 48 or 72 hours only, 72 by default", () => {
    expect(isAuditorLinkHours(24)).toBe(true);
    expect(isAuditorLinkHours("72")).toBe(true);
    expect(isAuditorLinkHours(12)).toBe(false);
    expect(auditorLinkExpiry(now, 72).toISOString()).toBe(
      "2026-10-18T06:00:00.000Z",
    );
  });

  it("is live until the expiry and never after a revoke", () => {
    const live = { expires_at: "2026-10-16T06:00:00Z", revoked_at: null };
    expect(auditorLinkIsLive(live, now)).toBe(true);
    expect(
      auditorLinkIsLive({ ...live, revoked_at: "2026-10-15T07:00:00Z" }, now),
    ).toBe(false);
    expect(
      auditorLinkIsLive(
        { expires_at: "2026-10-15T05:59:00Z", revoked_at: null },
        now,
      ),
    ).toBe(false);
    expect(
      auditorLinkIsLive({ expires_at: "nonsense", revoked_at: null }, now),
    ).toBe(false);
  });

  it("the banner names the provider and the expiry, in Sydney time", () => {
    const s = auditorBanner(
      "Sunrise Supports",
      new Date("2026-10-18T06:00:00Z"),
    );
    expect(s).toBe(
      "Read-only view shared by Sunrise Supports for its audit; it expires on 18 October 2026, 5:00 pm.",
    );
  });
});
