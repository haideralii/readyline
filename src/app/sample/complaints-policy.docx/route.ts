/**
 * GET /sample/complaints-policy.docx (batch 24 item 2): the sample complaints
 * policy as a Word file, rendered from the committed sample model. Public,
 * no query parameters, memory rate-limited like the health route; nothing
 * here touches a database or a session.
 */
import { NextResponse } from "next/server";
import { renderDocx } from "@/lib/generator/render-docx";
import { MemoryRateLimiter } from "@/lib/ops/health";
import { SAMPLE_FILE_NAME, sampleModelForFiles } from "@/lib/sample-document";
import { parseInput, strictObject } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = new MemoryRateLimiter(30, 60_000);
const Query = strictObject({});
let cached: Buffer | null = null;

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
  // REQ-034 FR-4 (D-2947): the sample's footer on every page.
  cached ??= await renderDocx(sampleModelForFiles());
  return new NextResponse(new Uint8Array(cached), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${SAMPLE_FILE_NAME}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
