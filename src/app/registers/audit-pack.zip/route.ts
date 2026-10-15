/**
 * GET /registers/audit-pack.zip (REQ-020 FR-1): the owner's audit pack,
 * built on request, under the register export limit (five an hour per
 * account, REQ-009 SR-3), one audit-log line `audit_pack.downloaded`. No
 * query parameters.
 */
import { NextResponse } from "next/server";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterExportAllowed } from "@/server/auth/rate-limit";
import { buildAuditPack } from "@/server/registers/audit-pack";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = strictObject({});

export async function GET(request: Request) {
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok) return new NextResponse("Bad request", { status: 400 });
  const viewer = await getViewer();
  if (!viewer)
    return NextResponse.redirect(
      new URL("/sign-in?next=%2Fpath%2Faudit-day", new URL(request.url).origin),
    );
  if (!viewer.account || viewer.deleted)
    return new NextResponse("Not found", { status: 404 });
  const accountId = viewer.account.id;
  if (!(await checkRegisterExportAllowed(accountId))) {
    log.warn("audit-pack.rate-limited", { accountId });
    return new NextResponse(
      "You have downloaded or exported several times in the last hour. Please try again later.",
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }
  const supabase = await createSupabaseServerClient();
  const pack = await buildAuditPack({
    supabase,
    admin: createSupabaseAdminClient(),
    accountId,
    tradingName: viewer.account.trading_name,
    now: new Date(),
  });
  await supabase.from("audit_log").insert({
    account_id: accountId,
    actor_user_id: viewer.user.id,
    action: "audit_pack.downloaded",
    target: accountId,
  });
  log.info("audit-pack.downloaded", { accountId, files: pack.files.length });
  return new NextResponse(new Uint8Array(pack.body), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pack.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
