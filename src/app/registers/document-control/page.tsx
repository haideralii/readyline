import type { Metadata } from "next";
import Link from "next/link";
import {
  documentControlGaps,
  documentControlSentence,
} from "@/lib/registers/document-control";
import { documentControlForAccount } from "@/server/registers/document-control-queries";
import { RegisterPage, registerContext } from "../_components/shell";
import { ChangeReview } from "./change-review";

export const metadata: Metadata = { title: "Document control register" };

/**
 * The document control register (REQ-018 FR-13, FR-14, AC-5; D-1906):
 * generated from the pack, nothing to type. One row per document with its
 * version, adopted on, adopted by, next review and whether the latest
 * version was circulated to workers. The Adopt step fills the dates; this
 * page shows the gaps and where to close them.
 */
export default async function DocumentControlPage() {
  const ctx = await registerContext("/registers/document-control");
  const { setId, rows } = await documentControlForAccount(
    ctx.supabase,
    ctx.viewer.account.id,
  );
  const gaps = documentControlGaps(rows);
  return (
    <RegisterPage
      title="Document control"
      intro="Every policy with its version, when you adopted it, who adopted it, when it is next reviewed and whether your workers were walked through it. Built from your pack: there is nothing to type here. When a rule changes after a document was drafted, the row says so and shows the old and the new sentence."
      canWrite={ctx.canWrite}
      back={{ href: "/registers", label: "Registers" }}
    >
      <p
        className="mt-4 text-lg font-medium"
        data-testid="document-control-sentence"
      >
        {documentControlSentence(rows)}
      </p>
      {!setId ? (
        <p className="mt-3 leading-7" data-testid="document-control-empty">
          Your documents appear here once your pack is drafted.{" "}
          <Link href="/documents" className="underline underline-offset-2">
            Open your documents
          </Link>
          .
        </p>
      ) : null}
      {gaps.length ? (
        <div
          className="border-ochre mt-4 rounded-md border p-3 text-sm leading-6"
          data-testid="document-control-gaps"
        >
          <p className="font-medium">
            {gaps.length} {gaps.length === 1 ? "thing" : "things"} to close:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {gaps.slice(0, 8).map((g) => (
              <li key={g}>{g}</li>
            ))}
            {gaps.length > 8 ? <li>and {gaps.length - 8} more.</li> : null}
          </ul>
          <p className="mt-2">
            <Link href="/path/adopt" className="underline underline-offset-2">
              Adopt your documents and tick who you walked them through
            </Link>
            .
          </p>
        </div>
      ) : null}
      {rows.length ? (
        // Stacked rows, one definition list each: nothing scrolls sideways on a phone (AC-1).
        <ol
          className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800"
          data-testid="document-control-list"
        >
          {rows.map((r) => (
            <li key={r.document_type_id} className="py-3" data-state={r.state}>
              <p className="font-medium">{r.title}</p>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
                {(
                  [
                    ["Version", r.version],
                    ["Adopted on", r.adopted_on ?? "Not yet"],
                    ["By", r.adopted_by || "Not yet"],
                    ["Next review", r.next_review_on ?? "Not yet"],
                    [
                      "Circulated",
                      r.circulated
                        ? `${r.circulated.on}, ${r.circulated.workers} ${r.circulated.workers === 1 ? "worker" : "workers"}`
                        : "Not yet",
                    ],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-zinc-600 dark:text-zinc-400">{k}</dt>
                    <dd className="[overflow-wrap:anywhere]">{v}</dd>
                  </div>
                ))}
              </dl>
              {/* Backlog 8 (D-551): a rule changed since this document was drafted. */}
              {r.reviewNeeded.map((c) => (
                <ChangeReview
                  key={c.changeId}
                  documentTypeId={r.document_type_id}
                  title={r.title}
                  versionId={r.version_id}
                  setId={setId}
                  change={c}
                />
              ))}
            </li>
          ))}
        </ol>
      ) : null}
    </RegisterPage>
  );
}
