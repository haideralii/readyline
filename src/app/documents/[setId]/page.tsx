import { PageShell } from "@/components/page-shell";
import { Tag } from "@/components/tag";
import { zipSizeLine } from "@/lib/generator/zip-line";
import { setZipSize } from "@/server/generation/zip-size";
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
      <PageShell kind="list">
        <p className="text-sm">
          <Link href="/documents" className="underline underline-offset-2">
            All document sets
          </Link>
        </p>
        <h1 className="mt-2">Document set</h1>
        <p
          role="status"
          className="text-ink mt-3 leading-7"
          data-testid="set-locked"
        >
          {DOCUMENTS_COPY.lockedSet}
        </p>
      </PageShell>
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
  // REQ-028 FR-7: the line under the zip button, the size from the stored object (D-2275 (4)).
  const zipLine = zipSizeLine(
    documents.length,
    await setZipSize(viewer.account.id, set.id),
  );

  return (
    <PageShell kind="list">
      <p className="text-sm">
        <Link href="/documents" className="underline underline-offset-2">
          All document sets
        </Link>
      </p>
      {/* REQ-028 FR-7: the list kind's header row; the zip is the page's primary, the summary PDF beside it. */}
      <div className="lg:flex lg:flex-wrap lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 lg:max-w-prose">
          <h1 className="mt-2">Document set</h1>
          <p className="text-ink mt-3 leading-7" data-testid="set-summary">
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
        </div>
        <div className="mt-5 min-w-0 lg:mt-1 lg:max-w-[32rem]">
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <a
              href={`/documents/${set.id}/download?file=set.zip`}
              className="btn-primary"
              data-testid="download-zip"
            >
              Download all as one file (zip)
            </a>
            <a
              href={`/documents/${set.id}/download?file=readiness-summary.pdf`}
              className="btn-secondary"
              data-testid="download-pdf"
            >
              Readiness summary (PDF)
            </a>
          </div>
          <p
            className="text-slate mt-2 text-sm lg:text-right"
            data-testid="zip-size-line"
          >
            {zipLine}
          </p>
        </div>
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Columns 1 to 5: the status card. */}
        <div className="lg:col-span-5">
          {/* REQ-026 FR-1: the sheet first on the set's page, before the files. */}
          <p
            className="border-ochre rounded-md border p-4 leading-7"
            data-testid="start-here"
          >
            <Link
              href={`/documents/${set.id}/start-here`}
              className="font-medium underline underline-offset-4"
              data-testid="start-here-link"
            >
              Start here: what to do with your documents
            </Link>
            . One list of what to fill in, what to review and what to read once,
            in the order to adopt them. It is in your zip as{" "}
            <span className="font-mono text-sm">{START_HERE_FILE}</span>.
          </p>
        </div>
        {/* Columns 6 to 12: the list under the four headings. */}
        <section
          aria-labelledby="docs-heading"
          className="mt-10 lg:col-span-7 lg:mt-0"
        >
          <h2 id="docs-heading" className="">
            Documents, in audit order
          </h2>
          {/* Batch 45b item 1: one "set-list" wrapper; each group's list has its own id, so a locator is never ambiguous. */}
          <div data-testid="set-list">
            {groups.map((g) => (
              <div key={g.title} className="mt-4" data-testid="set-group">
                <h3 className="text-ink">{g.title}</h3>
                <ol
                  className="divide-rule mt-1 divide-y"
                  data-testid="set-group-list"
                >
                  {g.documents.map((d) => {
                    return (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
                      >
                        <span className="text-slate w-6 shrink-0 tabular-nums">
                          {d.n}.
                        </span>
                        <Link
                          href={`/documents/${set.id}/${d.document_type_id}`}
                          className="min-w-0 flex-1 basis-48 underline-offset-4 hover:underline"
                        >
                          {d.model.title}
                        </Link>
                        {/* REQ-028 FR-7: the status as the one Tag, the version beside it, and the file as a link named for its document (D-2275 (5)). */}
                        <span className="ml-auto flex items-center gap-2">
                          <Tag
                            variant={d.status === "ready" ? "done" : "doing"}
                            wrap
                          >
                            {d.status === "ready"
                              ? "Drafted"
                              : "Drafted, with generic text to make yours"}
                          </Tag>
                          <span className="text-slate text-sm whitespace-nowrap">
                            version {d.version}
                          </span>
                          <a
                            href={`/documents/${set.id}/download?file=${d.document_type_id}.docx`}
                            className="btn-secondary-sm"
                            aria-label={`Download ${d.model.title} (.docx)`}
                            data-testid="row-docx"
                          >
                            .docx
                          </a>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </section>
      </div>
      <DocumentsNotices />
    </PageShell>
  );
}
