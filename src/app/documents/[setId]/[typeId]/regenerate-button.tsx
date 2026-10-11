"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { regenerateSectionAction } from "@/server/generation/actions";

export function RegenerateButton(props: {
  versionId: string;
  sectionId: string;
  setId: string;
  typeId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await regenerateSectionAction({
        versionId: props.versionId,
        sectionId: props.sectionId,
      });
      if (r.ok) {
        router.push(
          `/documents/${props.setId}/${props.typeId}?changed=${encodeURIComponent(props.sectionId)}`,
        );
        router.refresh();
      } else setMessage(r.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {busy ? "Regenerating…" : "Regenerate this section"}
      </button>
      {message ? (
        <p
          role="alert"
          className="mt-2 text-sm text-zinc-800 dark:text-zinc-200"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
