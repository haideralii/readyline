// @vitest-environment node
/**
 * Retro review of REQ-018 to 021, finding 34 (PO decision 34): the hashed
 * email is an HMAC under HASH_PEPPER, so it changes with the pepper and is
 * never the plain SHA-256 a lookup table reverses; the pepper comes from
 * the environment, with the fixed development value only where there is no
 * production deployment.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEVELOPMENT_HASH_PEPPER } from "./env";
import { emailHash, hashPepper, pepperedHash } from "./peppered-hash";

describe("emailHash", () => {
  it("is 64 hex characters, trims and lower-cases, and changes with the pepper", () => {
    const a = emailHash("Worker@Example.test", "pepper-a");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(emailHash("  worker@example.test ", "pepper-a")).toBe(a);
    expect(emailHash("worker@example.test", "pepper-b")).not.toBe(a);
    expect(emailHash("other@example.test", "pepper-a")).not.toBe(a);
  });

  it("is never the unsalted SHA-256 of the address", () => {
    const plain = createHash("sha256")
      .update("worker@example.test", "utf8")
      .digest("hex");
    expect(emailHash("worker@example.test", "pepper-a")).not.toBe(plain);
    expect(emailHash("worker@example.test")).not.toBe(plain);
  });
});

describe("the pepper", () => {
  it("is HASH_PEPPER when set, the development value otherwise, and refused on the production deployment", () => {
    expect(hashPepper({ HASH_PEPPER: " secret " })).toBe("secret");
    expect(hashPepper({})).toBe(DEVELOPMENT_HASH_PEPPER);
    expect(hashPepper({ VERCEL_ENV: "preview" })).toBe(DEVELOPMENT_HASH_PEPPER);
    expect(() => hashPepper({ VERCEL_ENV: "production" })).toThrow(
      /HASH_PEPPER is missing/,
    );
    expect(hashPepper({ VERCEL_ENV: "production", HASH_PEPPER: "k" })).toBe(
      "k",
    );
  });

  it("pepperedHash is a plain HMAC-SHA-256 under the pepper", () => {
    expect(pepperedHash("value", "key")).toMatch(/^[0-9a-f]{64}$/);
    expect(pepperedHash("value", "key")).toBe(pepperedHash("value", "key"));
    expect(pepperedHash("value", "key")).not.toBe(pepperedHash("value", "k"));
  });
});
