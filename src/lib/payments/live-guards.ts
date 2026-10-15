/**
 * Live-mode guards (REQ-022 FR-3, AC-2). With a live Stripe key, any one of
 * these conditions means the payment routes must not serve, because they
 * would sell at the wrong price or hand money to a configuration nobody
 * checked: STRIPE_FAKE set, a test-mode Price id, a missing webhook secret,
 * a display price that differs from the Price. GENERATION_LIVE=1 without an
 * ANTHROPIC_API_KEY refuses the generate job the same way. Pure over facts
 * the boot check gathers, so every combination is unit tested; the strings
 * name conditions and variables, never values.
 */
import { isLiveKey } from "./fake-session";

export type PriceFact =
  | {
      ok: true;
      livemode: boolean;
      unitAmount: number | null;
      currency: string;
    }
  | { ok: false; reason: "no-permission" | "not-found" | "error" };

export type LiveGuardInput = {
  env: Record<string, string | undefined>;
  /** The pack Price as read from Stripe; null when it was not read. */
  pack: PriceFact | null;
  /** The registers Price as read from Stripe; null when not configured or not read. */
  registers: PriceFact | null;
};

function cents(value: string | undefined): number | null {
  const n = Number(value?.trim());
  return value && Number.isInteger(n) && n > 0 ? n : null;
}

/** Conditions that refuse the payment routes; empty means serve. Only a live key is judged. */
export function liveModeProblems(input: LiveGuardInput): string[] {
  const { env } = input;
  const key = env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!isLiveKey(key)) return [];
  const problems: string[] = [];
  if (env.STRIPE_FAKE?.trim())
    problems.push("STRIPE_FAKE is set beside a live Stripe key");
  if (!env.STRIPE_WEBHOOK_SECRET?.trim())
    problems.push("STRIPE_WEBHOOK_SECRET is missing beside a live Stripe key");
  if (!env.STRIPE_PRICE_PACK?.trim())
    problems.push("STRIPE_PRICE_PACK is missing beside a live Stripe key");
  else
    problems.push(
      ...priceProblems(
        "STRIPE_PRICE_PACK",
        "PACK_PRICE_AUD_CENTS",
        input.pack,
        cents(env.PACK_PRICE_AUD_CENTS),
      ),
    );
  if (env.STRIPE_PRICE_REGISTERS?.trim())
    problems.push(
      ...priceProblems(
        "STRIPE_PRICE_REGISTERS",
        "SUBSCRIPTION_PRICE_AUD_CENTS",
        input.registers,
        cents(env.SUBSCRIPTION_PRICE_AUD_CENTS),
      ),
    );
  return problems;
}

function priceProblems(
  idName: string,
  centsName: string,
  fact: PriceFact | null,
  expected: number | null,
): string[] {
  if (!fact) return [`${idName} was not read from Stripe`];
  if (!fact.ok)
    return [`${idName} could not be read from Stripe (${fact.reason})`];
  const out: string[] = [];
  if (!fact.livemode)
    out.push(`${idName} is a test-mode Price beside a live Stripe key`);
  if (fact.currency.toLowerCase() !== "aud")
    out.push(`${idName} is not priced in AUD`);
  if (expected === null) out.push(`${centsName} is not set`);
  else if (fact.unitAmount !== expected)
    out.push(`${centsName} differs from the unit_amount of ${idName}`);
  return out;
}

/** Conditions that refuse the generate job; empty means run. */
export function generationProblems(
  env: Record<string, string | undefined>,
): string[] {
  const live = env.GENERATION_LIVE?.trim() === "1";
  if (live && !env.ANTHROPIC_API_KEY?.trim())
    return ["GENERATION_LIVE is 1 without an ANTHROPIC_API_KEY"];
  return [];
}
