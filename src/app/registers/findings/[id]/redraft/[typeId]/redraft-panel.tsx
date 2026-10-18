"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Blocks } from "@/components/sample-document";
import { DataTable } from "@/components/data-table";
import type { Block } from "@/lib/generator/section-schema";
import { blocksToText } from "@/lib/generator/section-schema";
import {
  DRAFT_REDRAFT_LABEL,
  KEEP_CURRENT_LABEL,
  USE_REDRAFT_LABEL,
  changedSentences,
  sentencesOf,
} from "@/lib/registers/findings-redraft";
import {
  acceptRedraftAction,
  draftRedraftAction,
  type DraftRedraftResult,
} from "@/server/registers/findings-redraft-actions";

/**
 * REQ-033 Session B FR-B4 (D-2957): the one button that asks for the redraft,
 * then the current text and the redraft side by side (stacked under lg) with
 * the changed sentences marked, and two buttons: use it or keep the current
 * text. Nothing is stored until "Use this redraft"; a refusal is one plain
 * sentence and the current text stands.
 */
export function RedraftPanel({
  findingId,
  typeId,
  backHref,
}: {
  findingId: string;
  typeId: string;
  backHref: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Extract<
    DraftRedraftResult,
    { ok: true }
  > | null>(null);
  const [busy, setBusy] = useState<"draft" | "accept" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run<T extends { ok: boolean; message?: string }>(
    kind: "draft" | "accept",
    fn: () => Promise<T>,
    then: (r: T) => void,
  ) {
    setBusy(kind);
    setMessage(null);
    try {
      const r = await fn();
      if (!r.ok) {
        setMessage(r.message ?? "Something went wrong.");
        return;
      }
      then(r);
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!draft)
    return (
      <div className="mt-4" data-testid="redraft-start">
        <button
          type="button"
          className="btn-primary"
          disabled={busy !== null}
          aria-busy={busy === "draft" || undefined}
          onClick={() =>
            void run(
              "draft",
              () => draftRedraftAction({ findingId, typeId }),
              (r) => {
                if (r.ok) setDraft(r);
              },
            )
          }
          data-testid="redraft-draft"
        >
          {busy === "draft" ? "Drafting…" : DRAFT_REDRAFT_LABEL}
        </button>
        {message ? (
          <p
            className="text-signal mt-3 text-sm leading-6"
            role="alert"
            data-testid="redraft-message"
          >
            {message}
          </p>
        ) : null}
      </div>
    );

  const changed = changedSentences(
    blocksToText(draft.current),
    blocksToText(draft.proposed),
  );
  return (
    <div className="mt-4" data-testid="redraft-review">
      <p
        className="text-slate text-sm leading-6"
        data-testid="redraft-changed-count"
      >
        {changed.size === 0
          ? "The redraft reads the same as the current text."
          : `${changed.size} ${changed.size === 1 ? "sentence is" : "sentences are"} new or changed, marked below.`}
      </p>
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="redraft-current-heading"
          data-testid="redraft-current"
        >
          <h3 id="redraft-current-heading" className="text-base font-medium">
            Current text: section {draft.sectionNumber} {draft.heading}
          </h3>
          <div className="border-rule mt-2 rounded-md border p-4">
            <Blocks blocks={draft.current} />
          </div>
        </section>
        <section
          aria-labelledby="redraft-proposed-heading"
          data-testid="redraft-proposed"
        >
          <h3 id="redraft-proposed-heading" className="text-base font-medium">
            Redraft (would be version {draft.version})
          </h3>
          <div className="border-ochre mt-2 rounded-md border p-4">
            <MarkedBlocks blocks={draft.proposed} changed={changed} />
          </div>
        </section>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={busy !== null}
          aria-busy={busy === "accept" || undefined}
          onClick={() =>
            void run(
              "accept",
              () =>
                acceptRedraftAction({
                  findingId,
                  typeId,
                  blocks: draft.proposed,
                }),
              (r) => {
                if (r.ok) router.push(r.href);
              },
            )
          }
          data-testid="redraft-use"
        >
          {busy === "accept" ? "Saving the new version…" : USE_REDRAFT_LABEL}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          onClick={() => router.push(backHref)}
          data-testid="redraft-keep"
        >
          {KEEP_CURRENT_LABEL}
        </button>
      </div>
      {message ? (
        <p
          className="text-signal mt-3 text-sm leading-6"
          role="alert"
          data-testid="redraft-message"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** The redraft's blocks with each new or changed sentence wrapped in a mark. */
function MarkedBlocks({
  blocks,
  changed,
}: {
  blocks: readonly Block[];
  changed: Set<string>;
}) {
  const marked = (text: string) =>
    sentencesOf(text).map((s, i) =>
      changed.has(s) ? (
        <mark
          key={i}
          className="bg-ochre-wash rounded-sm px-0.5"
          data-testid="redraft-changed"
        >
          {s}{" "}
        </mark>
      ) : (
        <span key={i}>{s} </span>
      ),
    );
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "paragraph":
            return (
              <p key={i} className="mt-2 leading-7">
                {marked(b.text)}
              </p>
            );
          case "callout":
            return (
              <p
                key={i}
                className="border-ochre bg-ochre-wash mt-2 rounded-md border p-4 leading-7"
              >
                {marked(b.text)}
              </p>
            );
          case "bullets":
            return (
              <ul key={i} className="mt-2 list-disc space-y-1 pl-5 leading-7">
                {b.items.map((t, j) => (
                  <li key={j}>{marked(t)}</li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol
                key={i}
                className="mt-2 list-decimal space-y-1 pl-5 leading-7"
              >
                {b.items.map((t, j) => (
                  <li key={j}>{marked(t)}</li>
                ))}
              </ol>
            );
          case "table":
            // A table's cells are short; the whole table is shown and its changed cells counted in the line above.
            return <DataTable key={i} columns={b.columns} rows={b.rows} />;
        }
      })}
    </>
  );
}
