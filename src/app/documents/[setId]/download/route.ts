/**
 * GET /documents/[setId]/download?file=set.zip|readiness-summary.pdf|<type>.docx
 * (REQ-005 FR-6, SR-4, AC-7). The server checks the session, that the set
 * belongs to the caller's account and that the object path is inside that
 * account, then redirects to a short-lived signed URL. Anything else is 404.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { renderDocx } from "@/lib/generator/render-docx";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { DOCX_TYPE } from "@/server/generation/run";
import { isOwnedPath, signedDownloadUrl } from "@/server/generation/storage";
import { isSetLocked } from "@/server/payments/queries";
import { isDocumentAdopted as isAdopted } from "@/server/registers/queries";
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
  const { setId } = await ctx.params;
  const viewer = await getViewer();
  // Batch 48 item 3: a signed-out download comes back to the document's page after sign-in, never to the file.
  if (!viewer)
    return NextResponse.redirect(
      new URL(
        `/sign-in?next=${encodeURIComponent(`/documents/${setId}`)}`,
        url.origin,
      ),
    );
  if (!viewer.account) return new NextResponse("Not found", { status: 404 });

  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, setId);
  if (!set || set.account_id !== viewer.account.id)
    return new NextResponse("Not found", { status: 404 });
  // REQ-007 FR-8: a refunded pack serves nothing; the data stays for the retention window.
  if (await isSetLocked(supabase, set.id))
    return new NextResponse("Not found", { status: 404 });

  let path = `${set.account_id}/${set.id}/${query.data.file}`;
  if (query.data.file.endsWith(".docx")) {
    // Serve the latest version of that document, which may be a regenerated file.
    const docs = await listLatestDocuments(supabase, set.id);
    const typeId = query.data.file.replace(/(\.v\d+)?\.docx$/i, "");
    const doc = docs.find((d) => d.document_type_id === typeId);
    if (!doc) return new NextResponse("Not found", { status: 404 });
    // REQ-016 D-058: once the provider has adopted the document (checklist
    // Done sets the policy review's adopted date), it is served without the
    // draft footer mark and the section marks, rendered from the stored model.
    if (await isAdopted(supabase, viewer.account.id, typeId)) {
      const bytes = await renderDocx(doc.model, { adopted: true });
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": DOCX_TYPE,
          "Content-Disposition": `attachment; filename="${query.data.file}"`,
          "Cache-Control": "no-store",
        },
      });
    }
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
