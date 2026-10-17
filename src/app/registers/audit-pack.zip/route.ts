/**
 * GET /registers/audit-pack.zip (REQ-020 FR-1): the owner's audit pack,
 * built on request, under the register export limit (five an hour per
 * account, REQ-009 SR-3), one audit-log line `audit_pack.downloaded`. The
 * only query parameters are the period's (REQ-023 FR-5, SR-3), defaulting to
 * the registration period (D-2305); a malformed or unavailable one answers
 * 400 with nothing echoed.
 */
import { NextResponse } from "next/server";
import { log } from "@/lib/logging/logger";
import {
  parsePeriodParams,
  periodContextFrom,
  resolvePeriod,
} from "@/lib/registers/period";
import { parseInput, strictObject } from "@/lib/validation";
import { PERIOD_QUERY_FIELDS } from "@/lib/validation/schemas/period";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterExportAllowed } from "@/server/auth/rate-limit";
import { buildAuditPack } from "@/server/registers/audit-pack";
import { currentPeriod } from "@/server/registers/registration-queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = strictObject(PERIOD_QUERY_FIELDS);

export async function GET(request: Request) {
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok) return new NextResponse("Bad request", { status: 400 });
  const selection = parsePeriodParams(query.data);
  if (!selection.ok) return new NextResponse("Bad request", { status: 400 });
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
  const resolved = resolvePeriod(
    selection.selection,
    periodContextFrom(await currentPeriod(supabase, accountId)),
    "period",
  );
  if (resolved.unavailable)
    return new NextResponse("Bad request", { status: 400 });
  const pack = await buildAuditPack({
    supabase,
    admin: createSupabaseAdminClient(),
    accountId,
    tradingName: viewer.account.trading_name,
    now: new Date(),
    period: resolved.period,
    // REQ-023 FR-8 (D-2309): the owner's own pack carries the rehearsal sheet.
    includeRehearsal: true,
  });
  // The write is checked (PO 16 Oct 19:47): on the hosted project it had
  // answered 42501 unseen since it was written, the insert grant missing.
  const audit = await supabase.from("audit_log").insert({
    account_id: accountId,
    actor_user_id: viewer.user.id,
    action: "audit_pack.downloaded",
    target: accountId,
  });
  if (audit.error)
    log.warn("audit.write.failed", {
      accountId,
      action: "audit_pack.downloaded",
      code: audit.error.code,
    });
  log.info("audit-pack.downloaded", {
    accountId,
    files: pack.files.length,
    period: resolved.period.kind,
  });
  return new NextResponse(new Uint8Array(pack.body), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pack.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
