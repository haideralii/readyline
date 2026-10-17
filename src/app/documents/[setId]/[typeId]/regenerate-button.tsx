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
        className="border-line hover:bg-mist inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {busy ? "Regenerating…" : "Regenerate this section"}
      </button>
      {message ? (
        <p role="alert" className="text-ink mt-2 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
