import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEMO_SCENARIOS,
  demoDocuments,
  demoStatus,
} from "@/lib/generation/writing-demo";
import { MemoryRateLimiter } from "@/lib/ops/health";
import { parseInput, strictObject } from "@/lib/validation";
import { readStripeEnv, StripeEnvError } from "@/server/payments/stripe";

/**
 * The scripted feed behind /dev/writing-indicator (REQ-021 tests; fake
 * mode only, 404 everywhere else). No account, no database: the status is
 * computed from the scenario, the start time and the clock.
 */
const Query = strictObject({
  scenario: z.enum(DEMO_SCENARIOS),
  t0: z.coerce.number().int().min(0),
});
const limiter = new MemoryRateLimiter(600, 60_000);

export async function GET(request: Request) {
  let env;
  try {
    env = readStripeEnv();
  } catch (e) {
    if (e instanceof StripeEnvError)
      return new NextResponse(null, { status: 404 });
    throw e;
  }
  if (!env.fake) return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  const parsed = parseInput(Query, Object.fromEntries(url.searchParams));
  if (!parsed.ok)
    return NextResponse.json({ error: "Bad query" }, { status: 400 });
  if (!limiter.allow(request.headers.get("x-forwarded-for") ?? "local"))
    return new NextResponse(null, { status: 429 });
  if (parsed.data.scenario === "offline")
    return new NextResponse(null, { status: 503 });
  return NextResponse.json(
    demoStatus({
      scenario: parsed.data.scenario,
      documents: demoDocuments(),
      t0: parsed.data.t0,
      now: Date.now(),
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}
