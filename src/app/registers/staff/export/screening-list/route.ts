/**
 * POST /registers/staff/export/screening-list (REQ-024 FR-6b, SR-7, SR-8):
 * the s 18 list, filled or unfilled, built once and sent. The region is
 * pinned in code (SR-8(e); the switchboard and a unit test read it).
 */
import { strictObject } from "@/lib/validation";
import { makeFillHandler } from "@/server/registers/fill-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "syd1";

// No query parameters are accepted (REQ-002 FR-3).
export const POST = makeFillHandler("screening-list", strictObject({}));
