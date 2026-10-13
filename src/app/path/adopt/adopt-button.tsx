"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adoptGroupAction } from "@/server/path/actions";

/**
 * "These are our policies" (REQ-017 step 5): one button, pending text while
 * the documents are re-rendered, the message in place when it fails, and
 * the next screen on success.
 */
export function AdoptButton({
  setId,
  group,
  nextHref,
}: {
  setId: string;
  group: string;
  nextHref: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function onClick() {
    setPending(true);
    setMessage(null);
    const r = await adoptGroupAction({ setId, group });
    if (r.ok) {
      router.push(nextHref);
      router.refresh();
      return;
    }
    setPending(false);
    setMessage(r.message);
  }
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="btn-primary"
        data-testid="adopt-group"
      >
        {pending ? "Making them yours…" : "These are our policies"}
      </button>
      {message ? (
        <p role="alert" className="mt-3 text-sm leading-6">
          {message}
        </p>
      ) : null}
    </div>
  );
}
