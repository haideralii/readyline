/**
 * GET /sample/complaints-policy.pdf (REQ-034 FR-4, SR-2): the sample
 * complaints policy as a PDF, rendered once per server process from the
 * committed sample model and cached, as the Word route does. Public, no
 * query parameters, memory rate-limited like the health route; nothing here
 * touches a database, a session or a model.
 */
import { NextResponse } from "next/server";
import { renderDocumentPdf } from "@/lib/generator/pdf-document";
import { MemoryRateLimiter } from "@/lib/ops/health";
import {
  SAMPLE_PDF_FILE_NAME,
  sampleModelForFiles,
} from "@/lib/sample-document";
import { parseInput, strictObject } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = new MemoryRateLimiter(30, 60_000);
const Query = strictObject({});
let cached: Uint8Array | null = null;

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
  cached ??= await renderDocumentPdf(sampleModelForFiles());
  return new NextResponse(new Uint8Array(cached), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${SAMPLE_PDF_FILE_NAME}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
