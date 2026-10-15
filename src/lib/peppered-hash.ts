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
 * Without the variable, development, test and CI use one fixed stand-in
 * value and log one warning; the production deployment refuses to run.
 */
import { createHmac } from "node:crypto";
import { readHashPepper } from "./env";
import { log } from "./logging/logger";

let warned = false;

/** The pepper in force, warning once when the development stand-in is used. */
export function hashPepper(
  source: Record<string, string | undefined> = process.env,
): string {
  const { pepper, fallback } = readHashPepper(source);
  if (fallback && !warned) {
    warned = true;
    log.warn("hash-pepper.fallback", {
      name: "HASH_PEPPER",
      note: "not set; using the fixed development value",
    });
  }
  return pepper;
}

/** HMAC-SHA-256 of `value` under the pepper, as 64 hex characters. */
export function pepperedHash(value: string, pepper = hashPepper()): string {
  return createHmac("sha256", pepper).update(value, "utf8").digest("hex");
}

/** An email, trimmed and lower-cased, hashed under the pepper (invitations, limiter keys, log lines). */
export function emailHash(email: string, pepper = hashPepper()): string {
  return pepperedHash(email.trim().toLowerCase(), pepper);
}
