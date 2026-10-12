"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { startGenerationAction } from "@/server/generation/actions";

export function GenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await startGenerationAction();
      if (r.ok) router.push(`/documents/${r.versionSetId}`);
      else setMessage(r.message);
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
        className="btn-primary"
      >
        {busy
          ? "Generating… this can take a few minutes"
          : "Generate my documents"}
      </button>
      {message ? (
        <p
          role="alert"
          className="mt-3 text-sm leading-6 text-zinc-800 dark:text-zinc-200"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
