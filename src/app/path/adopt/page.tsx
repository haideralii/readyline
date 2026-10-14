import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { groupSlug, orderDocuments } from "@/lib/generator/set-order";
import { getViewer } from "@/server/accounts/queries";
import { loadPathContext } from "@/server/path/state";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Adopt your documents" };

/** Step 5's door (REQ-017 FR-4): lands on the first group still to adopt, or on the checklist when every group is adopted. */
export default async function AdoptIndexPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fpath%2Fadopt");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const supabase = await createSupabaseServerClient();
  const ctx = await loadPathContext(supabase, {
    ...viewer,
    account: viewer.account,
  });
  if (!ctx.state.readySetId) redirect("/documents");
  const groups = orderDocuments(ctx.documents);
  const next = groups.find((g) =>
    g.documents.some((d) => !ctx.adopted.has(d.document_type_id)),
  );
  redirect(next ? `/path/adopt/${groupSlug(next.title)}` : "/checklist");
}
