import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DOCUMENTS_COPY } from "@/lib/payments/documents-copy";
import { collectBlanks } from "@/lib/generator/blanks";
import { formBlanks } from "@/lib/generator/facts-fill";
import { orderDocuments } from "@/lib/generator/set-order";
import { START_HERE_FILE } from "@/lib/generator/start-here";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { isSetLocked } from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { DocumentsNotices } from "../notices";

export const metadata: Metadata = { title: "Document set" };

const button = "btn-secondary";

/**
 * REQ-016 S-7: the set reads as one system, numbered in audit order under
 * the result page's four headings; FR-0c: the count is the provider's own
 * blanks, never generator failures; D-058: the notices sit here, not in
 * the documents.
 */

export default async function DocumentSetPage({
  params,
}: PageProps<"/documents/[setId]">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (!viewer.account) redirect("/account/setup");
  const { setId } = await params;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, setId);
  if (!set || set.account_id !== viewer.account.id) notFound();
  // FR-8: a refunded pack keeps its data but serves nothing.
  if (await isSetLocked(supabase, set.id)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm">
          <Link href="/documents" className="underline underline-offset-2">
            All document sets
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Document set
        </h1>
        <p
          role="status"
          className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300"
          data-testid="set-locked"
        >
          {DOCUMENTS_COPY.lockedSet}
        </p>
      </div>
    );
  }
  const documents = await listLatestDocuments(supabase, set.id);
  // S-7: one running number across the groups, in audit order.
  let counter = 0;
  const groups = orderDocuments(documents).map((g) => ({
    title: g.title,
    documents: g.documents.map((d) => ({ ...d, n: ++counter })),
  }));
  // REQ-016 FR-0c: what the page counts is the provider's own blanks, never generator failures.
  // Batch 45b item 2: and only the blanks the Finish page can ask for, by the
  // one rule the form and the next-step strip use (`formBlanks`); the example
  // cells of a register template ([Owner], [Risk]) are the paper form's own,
  // and the owner's name, role and the approval date are account facts
  // (D-1704), so none of them is a detail to fill in here.
  const blanks = formBlanks(documents.flatMap((d) => collectBlanks(d.model)));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm">
        <Link href="/documents" className="underline underline-offset-2">
          All document sets
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Document set
      </h1>
      <p
        className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300"
        data-testid="set-summary"
      >
        Drafted{" "}
        {new Date(set.created_at).toLocaleString("en-AU", {
          timeZone: "Australia/Sydney",
        })}
        . {documents.length} documents.{" "}
        {blanks.length === 0 ? (
          "No blanks to fill in."
        ) : (
          <Link
            href={`/documents/${set.id}/finish`}
            className="underline underline-offset-2"
            data-testid="finish-link"
          >
            {blanks.length === 1
              ? "1 detail to fill in"
              : `${blanks.length} details to fill in`}
          </Link>
        )}
      </p>

      {/* REQ-026 FR-1: the sheet first on the set's page, before the files. */}
      <p
        className="border-ochre mt-5 rounded-md border p-3 leading-7"
        data-testid="start-here"
      >
        <Link
          href={`/documents/${set.id}/start-here`}
          className="font-medium underline underline-offset-4"
          data-testid="start-here-link"
        >
          Start here: what to do with your documents
        </Link>
        . One list of what to fill in, what to review and what to read once, in
        the order to adopt them. It is in your zip as{" "}
        <span className="font-mono text-sm">{START_HERE_FILE}</span>.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href={`/documents/${set.id}/download?file=set.zip`}
          className={button}
          data-testid="download-zip"
        >
          Download all (zip)
        </a>
        <a
          href={`/documents/${set.id}/download?file=readiness-summary.pdf`}
          className={button}
          data-testid="download-pdf"
        >
          Readiness summary (PDF)
        </a>
      </div>

      <section aria-labelledby="docs-heading" className="mt-10">
        <h2 id="docs-heading" className="text-xl font-semibold">
          Documents, in audit order
        </h2>
        {/* Batch 45b item 1: one "set-list" wrapper; each group's list has its own id, so a locator is never ambiguous. */}
        <div data-testid="set-list">
          {groups.map((g) => (
            <div key={g.title} className="mt-4" data-testid="set-group">
              <h3 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
                {g.title}
              </h3>
              <ol
                className="mt-1 divide-y divide-zinc-200 dark:divide-zinc-800"
                data-testid="set-group-list"
              >
                {g.documents.map((d) => {
                  return (
                    <li
                      key={d.id}
                      className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span>
                        <span className="mr-2 text-zinc-500 tabular-nums">
                          {d.n}.
                        </span>
                        <Link
                          href={`/documents/${set.id}/${d.document_type_id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {d.model.title}
                        </Link>
                      </span>
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {d.status === "ready"
                          ? "Drafted"
                          : "Drafted, with generic text to make yours"}{" "}
                        · version {d.version}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>
      <DocumentsNotices />
    </div>
  );
}
