/**
 * Keyed hashes for the two values we store hashed but must never be able
 * to reverse by enumeration: a viewer's network address on an audit line
 * and an invited worker's email (retro review of REQ-018 to 021, finding
 * 34; PO decision 34). HMAC-SHA-256 under `HASH_PEPPER` from the
 * environment (src/lib/env.ts): an unsalted SHA-256 of an IPv4 address or
 * a guessable email is a lookup table away from the value. Tokens are not
 * peppered; they are 256-bit random values and stay plain SHA-256
 * (`hashAuditorToken`).
 *
 * Without the variable (D-2238): every environment falls back to the plain
 * SHA-256 these values had before the pepper existed, one warning is logged
 * at the first hash, and the launch switchboard's "Hash pepper" row stays
 * red until Haider sets it. No deployment refuses to start over it. Once
 * set, new hashes are HMAC; open invitations hashed the old way expire
 * within their seven days, and addresses on audit lines are records, not
 * lookups.
 */
import { createHash, createHmac } from "node:crypto";
import { readHashPepper } from "./env";
import { log } from "./logging/logger";

let warned = false;

/** The pepper in force, or null when HASH_PEPPER is unset (warned once). */
export function hashPepper(
  source: Record<string, string | undefined> = process.env,
): string | null {
  const pepper = readHashPepper(source);
  if (pepper === null && !warned) {
    warned = true;
    log.warn("hash-pepper.unset", {
      name: "HASH_PEPPER",
      note: "not set; address and email hashes are plain SHA-256 until it is (D-2238)",
    });
  }
  return pepper;
}

/** HMAC-SHA-256 of `value` under the pepper, or plain SHA-256 while there is none, as 64 hex characters. */
export function pepperedHash(
  value: string,
  pepper: string | null = hashPepper(),
): string {
  if (pepper === null)
    return createHash("sha256").update(value, "utf8").digest("hex");
  return createHmac("sha256", pepper).update(value, "utf8").digest("hex");
}

/** An email, trimmed and lower-cased, hashed under the pepper (invitations, limiter keys, log lines). */
export function emailHash(
  email: string,
  pepper: string | null = hashPepper(),
): string {
  return pepperedHash(email.trim().toLowerCase(), pepper);
}
