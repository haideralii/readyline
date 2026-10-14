import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { collectBlanks, type DocumentBlank } from "@/lib/generator/blanks";
import { orderDocuments } from "@/lib/generator/set-order";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { isSetLocked } from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Finish your pack" };

/**
 * REQ-016 S-8: every blank in the set, by document and section, in audit
 * order, so the provider works top to bottom. The count on the set page is
 * this list's length. REQ-017 turns each line into a question; for now the
 * provider fills the blank in Word and the list is read from the drafts.
 */
export default async function FinishPackPage({
  params,
}: PageProps<"/documents/[setId]/finish">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (!viewer.account) redirect("/account/setup");
  const { setId } = await params;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, setId);
  if (!set || set.account_id !== viewer.account.id) notFound();
  if (await isSetLocked(supabase, set.id)) redirect(`/documents/${set.id}`);
  const documents = await listLatestDocuments(supabase, set.id);
  const ordered = orderDocuments(documents).flatMap((g) => g.documents);
  const byDocument: {
    typeId: string;
    title: string;
    blanks: DocumentBlank[];
  }[] = [];
  for (const d of ordered) {
    const blanks = collectBlanks(d.model);
    if (blanks.length)
      byDocument.push({
        typeId: d.document_type_id,
        title: d.model.title,
        blanks,
      });
  }
  const total = byDocument.reduce((n, d) => n + d.blanks.length, 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm">
        <Link
          href={`/documents/${set.id}`}
          className="underline underline-offset-2"
        >
          Back to the set
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Finish your pack
      </h1>
      <p
        className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300"
        data-testid="finish-summary"
      >
        {total === 0
          ? "Every blank is filled in. Review each document and mark it Done on your checklist when you adopt it."
          : `${total} ${total === 1 ? "detail" : "details"} to fill in, listed by document and section in the order they appear. Each is a bracketed blank inside a complete sentence; open the document, replace the blank with your detail, and save.`}
      </p>
      {byDocument.map((d) => (
        <section
          key={d.typeId}
          aria-labelledby={`finish-${d.typeId}`}
          className="mt-8"
          data-testid="finish-document"
        >
          <h2 id={`finish-${d.typeId}`} className="text-xl font-semibold">
            <Link
              href={`/documents/${set.id}/${d.typeId}`}
              className="underline-offset-4 hover:underline"
            >
              {d.title}
            </Link>
          </h2>
          <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
            {d.blanks.map((b, i) => (
              <li key={`${b.sectionNumber}-${i}`} className="py-2 leading-7">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {b.sectionNumber ? `${b.sectionNumber} ` : ""}
                  {b.sectionHeading}
                </span>
                <span className="ml-2 rounded bg-amber-100 px-1 font-mono text-sm text-zinc-900 dark:bg-amber-900 dark:text-amber-50">
                  {b.blank}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
