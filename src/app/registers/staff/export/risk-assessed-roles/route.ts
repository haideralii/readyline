/**
 * POST /registers/staff/export/risk-assessed-roles (REQ-024 FR-6b, SR-7,
 * SR-8): the s 17 list, the assessor filled or bracketed, built once and
 * sent. The region is pinned in code (SR-8(e)).
 */
import { strictObject } from "@/lib/validation";
import { makeFillHandler } from "@/server/registers/fill-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "syd1";

// No query parameters are accepted (REQ-002 FR-3).
export const POST = makeFillHandler("risk-assessed-roles", strictObject({}));
