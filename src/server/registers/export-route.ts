/**
 * GET /registers/<register>/export.(csv|zip): the register as a file
 * (REQ-009 FR-6, SR-3). Member-only through RLS, five an hour per account,
 * a line in the audit log with ids only. The only query parameters are the
 * period's (REQ-023 FR-5, SR-3): a closed list or two ISO dates, parsed by
 * `parsePeriodParams`; anything else answers 400 with nothing echoed.
 */
import { NextResponse } from "next/server";
import { log } from "@/lib/logging/logger";
import {
  parsePeriodParams,
  periodContextFrom,
  resolvePeriod,
} from "@/lib/registers/period";
import { parseInput, type strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterExportAllowed } from "@/server/auth/rate-limit";
import { buildRegisterExport, EXPORT_PATHS } from "@/server/registers/export";
import { currentPeriod } from "@/server/registers/registration-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

/** Each route passes its own strict schema (the period's three optional strings) so the boundary guard sees the validation import where the route lives. */
export function makeExportHandler(
  path: keyof typeof EXPORT_PATHS,
  Query: ReturnType<typeof strictObject>,
) {
  const register = EXPORT_PATHS[path];
  return async function GET(request: Request) {
    const query = parseInput(
      Query,
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!query.ok) return new NextResponse("Bad request", { status: 400 });
    const selection = parsePeriodParams(
      query.data as Record<string, string | undefined>,
    );
    if (!selection.ok) return new NextResponse("Bad request", { status: 400 });
    const viewer = await getViewer();
    if (!viewer)
      return NextResponse.redirect(
        new URL(
          `/sign-in?next=%2Fregisters%2F${path}`,
          new URL(request.url).origin,
        ),
      );
    if (!viewer.account) return new NextResponse("Not found", { status: 404 });
    if (!(await checkRegisterExportAllowed(viewer.account.id))) {
      log.warn("registers.export.rate-limited", {
        accountId: viewer.account.id,
        register,
      });
      return new NextResponse(
        "You have exported several times in the last hour. Please try again later.",
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
    const supabase = await createSupabaseServerClient();
    // REQ-023 FR-5: the period against the account's dates; a date the account
    // has not entered is a refusal here, where a status can be answered.
    const resolved = resolvePeriod(
      selection.selection,
      periodContextFrom(await currentPeriod(supabase, viewer.account.id)),
      "all",
    );
    if (resolved.unavailable)
      return new NextResponse("Bad request", { status: 400 });
    const now = new Date();
    const file = await buildRegisterExport(
      supabase,
      viewer.account.id,
      register,
      now,
      resolved.period,
    );
    await supabase.from("audit_log").insert({
      account_id: viewer.account.id,
      actor_user_id: viewer.user.id,
      action: `register.${register}.exported`,
      target: viewer.account.id,
    });
    log.info("registers.exported", {
      accountId: viewer.account.id,
      register,
      period: resolved.period.kind,
    });
    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  };
}
