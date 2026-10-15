/**
 * GET /account/export: the owner downloads a zip of everything stored for the
 * account (REQ-004 FR-6, AC-4). Rate limited per account (SR-3) and recorded
 * in the audit log.
 */
import { NextResponse } from "next/server";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import {
  buildAccountExport,
  buildExportZip,
  exportFileName,
} from "@/server/accounts/export";
import { getViewer } from "@/server/accounts/queries";
import { isCrossSiteRequest } from "@/server/auth/cross-site";
import { checkExportAllowed } from "@/server/auth/rate-limit";
import { createSupabaseServerClient } from "@/server/supabase/server";

// No query parameters are accepted; unknown keys are rejected like every boundary (REQ-002 FR-3).
const Query = strictObject({});

export async function GET(request: Request) {
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok) return new NextResponse("Bad request", { status: 400 });
  // Before the limiter and the audit row: a request another site started
  // must not spend the owner's hour (retro review of REQ-009, finding 48).
  if (isCrossSiteRequest(request.headers)) {
    log.warn("account.export.cross-site", {});
    return new NextResponse("Forbidden", { status: 403 });
  }
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.redirect(
      new URL("/sign-in?next=%2Faccount", new URL(request.url).origin),
    );
  }
  if (!viewer.account) return new NextResponse("Not found", { status: 404 });

  if (!(await checkExportAllowed(viewer.account.id))) {
    log.warn("account.export.rate-limited", { accountId: viewer.account.id });
    return new NextResponse(
      "You have requested several exports in the last hour. Please try again later.",
      {
        status: 429,
        headers: { "Retry-After": "3600" },
      },
    );
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const data = await buildAccountExport(supabase, viewer.account.id, now);
  if (!data) return new NextResponse("Not found", { status: 404 });

  await supabase.from("audit_log").insert({
    account_id: viewer.account.id,
    actor_user_id: viewer.user.id,
    action: "account.exported",
    target: viewer.account.id,
  });
  log.info("account.exported", {
    accountId: viewer.account.id,
    userId: viewer.user.id,
  });

  const zip = buildExportZip(data);
  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${exportFileName(now)}"`,
      "Cache-Control": "no-store",
    },
  });
}
