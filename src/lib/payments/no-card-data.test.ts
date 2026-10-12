// @vitest-environment node
/**
 * REQ-007 SR-5: no card data ever touches Readyline. Stripe's hosted Checkout
 * takes the card; our code must never read or name card fields. This test
 * scans the payment and API code for the field names a card form would use.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) yield p;
  }
}

describe("no card data (REQ-007 SR-5)", () => {
  it("payment and API code never names card number, expiry or CVC fields", () => {
    const offenders: string[] = [];
    for (const dir of [
      "src/lib/payments",
      "src/server/payments",
      "src/app/api",
      "src/app/pricing",
    ]) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        // Card form field names; "expiry" alone is ordinary English (worker screening expiry) and is not matched.
        if (
          /\b(card_number|cardNumber|card_cvc|cvc|cvv|exp_month|exp_year|pan)\b/i.test(
            text,
          )
        )
          offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
