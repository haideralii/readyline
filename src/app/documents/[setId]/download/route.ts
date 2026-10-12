/**
 * GET /documents/[setId]/download?file=set.zip|readiness-summary.pdf|<type>.docx
 * (REQ-005 FR-6, SR-4, AC-7). The server checks the session, that the set
 * belongs to the caller's account and that the object path is inside that
 * account, then redirects to a short-lived signed URL. Anything else is 404.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { isOwnedPath, signedDownloadUrl } from "@/server/generation/storage";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

const Query = strictObject({
  file: z.string().regex(/^[a-z0-9][a-z0-9.-]{0,120}\.(docx|pdf|zip)$/i),
});

export async function GET(
  request: Request,
  ctx: RouteContext<"/documents/[setId]/download">,
) {
  const url = new URL(request.url);
  const query = parseInput(
    Query,
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!query.ok) return new NextResponse("Not found", { status: 404 });
  const viewer = await getViewer();
  if (!viewer)
    return NextResponse.redirect(
      new URL("/sign-in?next=%2Fdocuments", url.origin),
    );
  if (!viewer.account) return new NextResponse("Not found", { status: 404 });

  const { setId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, setId);
  if (!set || set.account_id !== viewer.account.id)
    return new NextResponse("Not found", { status: 404 });

  let path = `${set.account_id}/${set.id}/${query.data.file}`;
  if (query.data.file.endsWith(".docx")) {
    // Serve the latest version of that document, which may be a regenerated file.
    const docs = await listLatestDocuments(supabase, set.id);
    const typeId = query.data.file.replace(/(\.v\d+)?\.docx$/i, "");
    const doc = docs.find((d) => d.document_type_id === typeId);
    if (!doc) return new NextResponse("Not found", { status: 404 });
    path = doc.storage_path;
  }
  if (!isOwnedPath(path, viewer.account.id))
    return new NextResponse("Not found", { status: 404 });

  try {
    const signed = await signedDownloadUrl(
      createSupabaseAdminClient(),
      path,
      query.data.file,
    );
    return NextResponse.redirect(signed, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
