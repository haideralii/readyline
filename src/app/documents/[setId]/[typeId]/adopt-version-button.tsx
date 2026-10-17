"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adoptDocumentVersionAction } from "@/server/path/actions";

/**
 * REQ-024 A0 (D-2427, D-2436): the re-adopt action. Shown when this latest
 * version is not adopted while an older version of the document was, so the
 * document control register reads "new version to adopt" until the owner
 * reads this one and adopts it here.
 */
export function AdoptVersionButton(props: {
  setId: string;
  typeId: string;
  version: number;
  olderAdoptedOn: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [href, setHref] = useState<{ href: string; label: string } | null>(
    null,
  );

  async function onClick() {
    setBusy(true);
    setMessage(null);
    setHref(null);
    try {
      const r = await adoptDocumentVersionAction({
        setId: props.setId,
        typeId: props.typeId,
      });
      if (r.ok) router.refresh();
      else {
        setMessage(r.message);
        if (r.href && r.hrefLabel)
          setHref({ href: r.href, label: r.hrefLabel });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="border-ochre mt-4 rounded-md border p-3 text-sm leading-6"
      data-testid="adopt-version"
    >
      <p className="font-medium">
        Version {props.version} is not yet adopted. An older version was adopted
        on {props.olderAdoptedOn}.
      </p>
      <p className="mt-1">
        Read this version. When it says what you do, adopt it; the document
        control register then shows this version as adopted.
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="bg-ink text-paper mt-3 inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        data-testid="adopt-version-button"
      >
        {busy ? "Adopting…" : "Adopt this version"}
      </button>
      {message ? (
        <p role="alert" className="text-ink mt-2 text-sm">
          {message}
          {href ? (
            <>
              {" "}
              <Link href={href.href} className="underline underline-offset-2">
                {href.label}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
