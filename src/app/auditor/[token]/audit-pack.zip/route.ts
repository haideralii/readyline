/**
 * GET /auditor/<token>/audit-pack.zip (REQ-020 FR-2): the same pack as the
 * owner's, behind a live auditor link, under the account's export limit;
 * the open is recorded as `auditor_link.pack-downloaded` with the link id
 * and the viewer's hashed address. A dead token is a plain 404. The only
 * query parameters are the period's (REQ-023 FR-5, SR-3), defaulting to the
 * registration period (D-2305); a malformed or unavailable one answers 400.
 */
import { NextResponse } from "next/server";
import { log } from "@/lib/logging/logger";
import { AUDITOR_OPEN_LIMITED_LINE } from "@/lib/registers/auditor-link";
import {
  parsePeriodParams,
  periodContextFrom,
  resolvePeriod,
} from "@/lib/registers/period";
import { parseInput, strictObject } from "@/lib/validation";
import { PERIOD_QUERY_FIELDS } from "@/lib/validation/schemas/period";
import {
  checkAuditorOpenAllowed,
  checkRegisterExportAllowed,
} from "@/server/auth/rate-limit";
import { linkPackFor } from "@/server/registers/link-pack";
import {
  recordAuditorOpen,
  resolveAuditorToken,
} from "@/server/registers/auditor-links";
import { currentPeriod } from "@/server/registers/registration-queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = strictObject(PERIOD_QUERY_FIELDS);

export async function GET(
  request: Request,
  ctx: RouteContext<"/auditor/[token]/audit-pack.zip">,
) {
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok) return new NextResponse("Bad request", { status: 400 });
  const selection = parsePeriodParams(query.data);
  if (!selection.ok) return new NextResponse("Bad request", { status: 400 });
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
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  // Retro review of REQ-020, finding 21: the viewer's address shares the
  // page's bucket (sixty opens of this link an hour), checked before the
  // account's export limit so a hostile address never burns the owner's five.
  if (!(await checkAuditorOpenAllowed(link.linkId, address))) {
    log.warn("audit-pack.address-rate-limited", { linkId: link.linkId });
    return new NextResponse(AUDITOR_OPEN_LIMITED_LINE, {
      status: 429,
      headers: { "Retry-After": "3600" },
    });
  }
  if (!(await checkRegisterExportAllowed(link.accountId))) {
    log.warn("audit-pack.rate-limited", { accountId: link.accountId });
    return new NextResponse(
      "This pack has been downloaded several times in the last hour. Please try again later.",
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }
  const resolved = resolvePeriod(
    selection.selection,
    periodContextFrom(await currentPeriod(admin, link.accountId)),
    "period",
  );
  if (resolved.unavailable)
    return new NextResponse("Bad request", { status: 400 });
  await recordAuditorOpen(
    admin,
    link,
    address,
    "pack-downloaded",
    resolved.period,
  );
  // REQ-029 FR-11 (D-2863, D-2294): the pack is rendered once per link and
  // period and served from storage after that, so two downloads are the
  // same bytes; the default period's render was made when the link was.
  const pack = await linkPackFor({
    admin,
    accountId: link.accountId,
    linkId: link.linkId,
    tradingName: link.tradingName,
    now: new Date(),
    period: resolved.period,
    // REQ-023 FR-8 (D-2309): the rehearsal sheet only when the owner ticked it on this link.
    includeRehearsal: link.includeRehearsal,
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
