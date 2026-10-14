import { NextResponse } from "next/server";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { writingStatusFor } from "@/server/generation/writing-status";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * GET /api/generation/status: what the writing indicator polls (REQ-021 S2,
 * S7, S8; D-2101). Read with the owner's session, so two tabs or two
 * devices see the same server state and nothing lives only in a browser.
 * No query parameters; 401 signed out, 204 when there is no pack job.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!parseInput(strictObject({}), Object.fromEntries(url.searchParams)).ok)
    return NextResponse.json({ error: "No parameters" }, { status: 400 });
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!viewer.account || viewer.deleted)
    return new NextResponse(null, { status: 204 });
  const supabase = await createSupabaseServerClient();
  const status = await writingStatusFor(
    supabase,
    viewer as typeof viewer & { account: NonNullable<typeof viewer.account> },
  );
  if (!status) return new NextResponse(null, { status: 204 });
  return NextResponse.json(status, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
