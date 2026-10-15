// @vitest-environment node
/**
 * Retro review of REQ-018 to 021, finding 34 (PO decision 34; D-2238): the
 * hashed email is an HMAC under HASH_PEPPER when the pepper is set, so it
 * changes with the pepper and is never the plain SHA-256 a lookup table
 * reverses; while the pepper is unset, in any environment, the hash is the
 * plain SHA-256 these values always had, and nothing refuses to start.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { emailHash, hashPepper, pepperedHash } from "./peppered-hash";

const plainOf = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

describe("emailHash", () => {
  it("is 64 hex characters, trims and lower-cases, and changes with the pepper", () => {
    const a = emailHash("Worker@Example.test", "pepper-a");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(emailHash("  worker@example.test ", "pepper-a")).toBe(a);
    expect(emailHash("worker@example.test", "pepper-b")).not.toBe(a);
    expect(emailHash("other@example.test", "pepper-a")).not.toBe(a);
  });

  it("is never the unsalted SHA-256 of the address once a pepper is set", () => {
    expect(emailHash("worker@example.test", "pepper-a")).not.toBe(
      plainOf("worker@example.test"),
    );
  });

  it("is exactly the plain SHA-256 it was before the pepper existed while HASH_PEPPER is unset (D-2238)", () => {
    expect(emailHash(" Worker@Example.test ", null)).toBe(
      plainOf("worker@example.test"),
    );
  });
});

describe("the pepper", () => {
  it("is HASH_PEPPER when set and null otherwise, in every environment, with no refusal on the production deployment", () => {
    expect(hashPepper({ HASH_PEPPER: " secret " })).toBe("secret");
    expect(hashPepper({})).toBeNull();
    expect(hashPepper({ HASH_PEPPER: "  " })).toBeNull();
    expect(hashPepper({ VERCEL_ENV: "preview" })).toBeNull();
    expect(hashPepper({ VERCEL_ENV: "production" })).toBeNull();
    expect(hashPepper({ VERCEL_ENV: "production", HASH_PEPPER: "k" })).toBe(
      "k",
    );
  });

  it("pepperedHash is HMAC-SHA-256 under the pepper, and plain SHA-256 without one", () => {
    expect(pepperedHash("value", "key")).toMatch(/^[0-9a-f]{64}$/);
    expect(pepperedHash("value", "key")).toBe(pepperedHash("value", "key"));
    expect(pepperedHash("value", "key")).not.toBe(pepperedHash("value", "k"));
    expect(pepperedHash("value", null)).toBe(plainOf("value"));
    expect(pepperedHash("value", "key")).not.toBe(plainOf("value"));
  });
});
