"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { regenerateSectionAction } from "@/server/generation/actions";
import { markChangeReviewedAction } from "@/server/registers/living-policies-actions";
import {
  describeChange,
  type ReviewNeeded,
} from "@/lib/registers/living-policies";

/**
 * One rule change on one adopted document (backlog 8, D-551): the old and
 * the new sentence side by side, then two answers. "Re-generate this
 * section" asks the model for that section again (a new version, the
 * usual quota); "I have checked it" records that the owner read the
 * document and is satisfied. Nothing here reads register text.
 */
export function ChangeReview(props: {
  documentTypeId: string;
  title: string;
  versionId: string | null;
  setId: string | null;
  change: ReviewNeeded;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"regenerate" | "checked" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { change } = props;
  const canRegenerate = Boolean(
    props.versionId && change.sectionId && change.where !== "fixed-text",
  );

  async function regenerate() {
    if (!props.versionId || !change.sectionId) return;
    setBusy("regenerate");
    setMessage(null);
    try {
      const r = await regenerateSectionAction({
        versionId: props.versionId,
        sectionId: change.sectionId,
      });
      if (r.ok) {
        setMessage("Drafted again. Read the new version before you adopt it.");
        router.refresh();
      } else setMessage(r.message);
    } finally {
      setBusy(null);
    }
  }

  async function checked() {
    setBusy("checked");
    setMessage(null);
    try {
      const r = await markChangeReviewedAction({
        documentTypeId: props.documentTypeId,
        changeId: change.changeId,
      });
      if (r.ok) {
        setMessage("Recorded.");
        router.refresh();
      } else setMessage(r.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="border-ochre mt-2 rounded-md border p-3 text-sm leading-6"
      data-testid={`change-review-${change.changeId}`}
    >
      <p className="font-medium">
        Review needed{change.sectionId ? `: section "${change.sectionId}"` : ""}
        {change.certainty === "likely"
          ? " (drafted before this rule changed)"
          : ""}
      </p>
      <p className="mt-1">{describeChange(change)}</p>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-600 dark:text-zinc-400">Before</dt>
          <dd className="[overflow-wrap:anywhere]">
            {change.oldSentence ?? "No sentence about this."}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600 dark:text-zinc-400">Now</dt>
          <dd className="[overflow-wrap:anywhere]">{change.newSentence}</dd>
        </div>
      </dl>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Source: {change.source}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {canRegenerate ? (
          <button
            type="button"
            className="btn-secondary min-h-11"
            disabled={busy !== null}
            onClick={regenerate}
            data-testid={`change-regenerate-${change.changeId}`}
          >
            {busy === "regenerate"
              ? "Drafting again…"
              : "Re-generate this section"}
          </button>
        ) : change.where === "fixed-text" && props.setId ? (
          <a
            href={`/documents/${props.setId}/${props.documentTypeId}`}
            className="btn-secondary min-h-11"
          >
            Open the document
          </a>
        ) : null}
        <button
          type="button"
          className="btn-secondary min-h-11"
          disabled={busy !== null}
          onClick={checked}
          data-testid={`change-checked-${change.changeId}`}
        >
          {busy === "checked" ? "Saving…" : "I have checked it"}
        </button>
      </div>
      {message ? (
        <p role="status" className="mt-2">
          {message}
        </p>
      ) : null}
    </div>
  );
}
