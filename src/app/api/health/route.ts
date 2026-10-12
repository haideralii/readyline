/**
 * GET /api/health (REQ-010 FR-4): `{ ok, version, sha, region, deployment }`
 * for the smoke test and uptime checks. No database call, no secret, no
 * query parameters; an in-memory per-address limiter keeps a loop of
 * requests from costing anything.
 */
import { NextResponse } from "next/server";
import { parseInput, strictObject } from "@/lib/validation";
import { healthBody, MemoryRateLimiter } from "@/lib/ops/health";
import { version } from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = new MemoryRateLimiter();
// No query parameters are accepted; unknown keys are rejected like every boundary (REQ-002 FR-3).
const Query = strictObject({});

export async function GET(request: Request) {
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok) return new NextResponse("Bad request", { status: 400 });
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!limiter.allow(address))
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  return NextResponse.json(healthBody(process.env, version), {
    headers: { "Cache-Control": "no-store" },
  });
}
