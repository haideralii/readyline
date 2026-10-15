/**
 * GET /auditor/<token>/audit-pack.zip (REQ-020 FR-2): the same pack as the
 * owner's, behind a live auditor link, under the account's export limit;
 * the open is recorded as `auditor_link.pack-downloaded` with the link id
 * and the viewer's hashed address. A dead token is a plain 404.
 */
import { NextResponse } from "next/server";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { checkRegisterExportAllowed } from "@/server/auth/rate-limit";
import { buildAuditPack } from "@/server/registers/audit-pack";
import {
  recordAuditorOpen,
  resolveAuditorToken,
} from "@/server/registers/auditor-links";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = strictObject({});

export async function GET(
  request: Request,
  ctx: RouteContext<"/auditor/[token]/audit-pack.zip">,
) {
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok) return new NextResponse("Bad request", { status: 400 });
  const { token } = await ctx.params;
  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    if (e instanceof SupabaseEnvError)
      return new NextResponse("Not found", { status: 404 });
    throw e;
  }
  const link = await resolveAuditorToken(admin, token);
  if (!link) return new NextResponse("Not found", { status: 404 });
  if (!(await checkRegisterExportAllowed(link.accountId))) {
    log.warn("audit-pack.rate-limited", { accountId: link.accountId });
    return new NextResponse(
      "This pack has been downloaded several times in the last hour. Please try again later.",
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }
  await recordAuditorOpen(
    admin,
    link,
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    "pack-downloaded",
  );
  const pack = await buildAuditPack({
    supabase: admin,
    admin,
    accountId: link.accountId,
    tradingName: link.tradingName,
    now: new Date(),
  });
  return new NextResponse(new Uint8Array(pack.body), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pack.fileName}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
