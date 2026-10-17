/**
 * POST /registers/staff/export/workers (REQ-024 FR-6b, SR-7, SR-8): the
 * workers folder as one zip from one submission (finding 77), filled or
 * unfilled, built once and sent. The region is pinned in code (SR-8(e)).
 */
import { strictObject } from "@/lib/validation";
import { makeFillHandler } from "@/server/registers/fill-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "syd1";

// No query parameters are accepted (REQ-002 FR-3).
export const POST = makeFillHandler("workers", strictObject({}));
