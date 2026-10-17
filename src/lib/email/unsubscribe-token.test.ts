import { describe, expect, it } from "vitest";
import {
  hashUnsubscribeToken,
  sameHash,
  UNSUBSCRIBE_TOKEN_PATTERN,
  unsubscribeToken,
  unsubscribeUrl,
} from "./unsubscribe-token";

describe("the unsubscribe token (REQ-022 FR-7, SR-6)", () => {
  const account = "7d6a1c1e-2f4b-4a5c-9d8e-1f2a3b4c5d6e";

  it("is 256 bits of hex, the same for the same account and pepper, different otherwise", () => {
    const t = unsubscribeToken(account, "pepper-one");
    expect(t).toMatch(UNSUBSCRIBE_TOKEN_PATTERN);
    expect(unsubscribeToken(account, "pepper-one")).toBe(t);
    expect(unsubscribeToken(account, "pepper-two")).not.toBe(t);
    expect(
      unsubscribeToken(account.replace("7d", "8d"), "pepper-one"),
    ).not.toBe(t);
  });

  it("its hash is what the row keeps, compared in constant time", () => {
    const t = unsubscribeToken(account, "pepper-one");
    const h = hashUnsubscribeToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(t);
    expect(sameHash(h, hashUnsubscribeToken(t))).toBe(true);
    expect(sameHash(h, hashUnsubscribeToken(`${t.slice(1)}0`))).toBe(false);
    expect(sameHash(h, "short")).toBe(false);
  });

  it("builds the link under the site's origin with no trailing slash doubled", () => {
    expect(unsubscribeUrl("ab".repeat(32), "https://readyline.example/")).toBe(
      `https://readyline.example/email/unsubscribe/${"ab".repeat(32)}`,
    );
  });
});
