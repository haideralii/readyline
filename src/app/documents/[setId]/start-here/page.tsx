import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StartHereSheetView } from "@/components/start-here-sheet";
import { START_HERE_FILE } from "@/lib/generator/start-here";
import { getViewer } from "@/server/accounts/queries";
import { getVersionSet } from "@/server/generation/queries";
import { startHereForSet } from "@/server/generation/start-here-set";
import { isSetLocked } from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Start here" };

/**
 * The Start here sheet as a page (REQ-026 FR-1, FR-4): the same list as
 * the Word file, printable, with a tick on every "Fill in" line whose
 * blank the Finish form has filled and on every adopted document; the
 * Word-only lines keep their printed box. The sheet itself is the shared
 * block the sample page also shows (REQ-031 FR-3).
 */
export default async function StartHerePage({
  params,
}: PageProps<"/documents/[setId]/start-here">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (!viewer.account) redirect("/account/setup");
  const { setId } = await params;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, setId);
  if (!set || set.account_id !== viewer.account.id) notFound();
  if (await isSetLocked(supabase, set.id)) redirect(`/documents/${set.id}`);
  const built = await startHereForSet(supabase, set);
  if (!built) notFound();
  return (
    <PageShell kind="reading">
      <p className="text-sm print:hidden">
        <Link
          href={`/documents/${set.id}`}
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Document set
        </Link>
      </p>
      <StartHereSheetView sheet={built.sheet} setId={set.id} level={1} />
      <p className="mt-2 print:hidden">
        <a
          href={`/documents/${set.id}/download?file=${START_HERE_FILE}`}
          className="btn-secondary"
          data-testid="start-here-download"
        >
          Download this list (Word)
        </a>
      </p>
    </PageShell>
  );
}
