/**
 * GET /registers/<register>/export.(csv|zip): the register as a file
 * (REQ-009 FR-6, SR-3). Member-only through RLS, five an hour per account,
 * a line in the audit log with ids only, no query parameters.
 */
import { NextResponse } from "next/server";
import { log } from "@/lib/logging/logger";
import { parseInput, type strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterExportAllowed } from "@/server/auth/rate-limit";
import { buildRegisterExport, EXPORT_PATHS } from "@/server/registers/export";
import { createSupabaseServerClient } from "@/server/supabase/server";

/** Each route passes its own empty strict schema so the boundary guard sees the validation import where the route lives. */
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
    const now = new Date();
    const file = await buildRegisterExport(
      supabase,
      viewer.account.id,
      register,
      now,
    );
    await supabase.from("audit_log").insert({
      account_id: viewer.account.id,
      actor_user_id: viewer.user.id,
      action: `register.${register}.exported`,
      target: viewer.account.id,
    });
    log.info("registers.exported", { accountId: viewer.account.id, register });
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
