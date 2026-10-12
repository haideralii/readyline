"use client";
import { useEffect, useState } from "react";
import { startTotpEnrolment, verifyTotp } from "@/server/admin/actions";

type Mode = { kind: "enrol" } | { kind: "verify"; factorId: string };

export function MfaForm({ mode }: { mode: Mode }) {
  const [factorId, setFactorId] = useState(
    mode.kind === "verify" ? mode.factorId : "",
  );
  const [qr, setQr] = useState<{ svg: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode.kind !== "enrol") return;
    let cancelled = false;
    startTotpEnrolment().then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setFactorId(r.factorId);
        setQr({ svg: r.qrCodeSvg, secret: r.secret });
      } else setError(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, [mode.kind]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await verifyTotp({ factorId, code });
      if (r && !r.ok) setError(r.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      {mode.kind === "enrol" && qr ? (
        <div className="mb-6">
          {/* The SVG comes from Supabase's enrol response for this session only. */}
          <div
            className="inline-block rounded-md border border-zinc-300 bg-white p-2"
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Cannot scan? Enter this key by hand:{" "}
            <code className="font-mono">{qr.secret}</code>
          </p>
        </div>
      ) : null}
      {mode.kind === "enrol" && !qr && !error ? (
        <p
          role="status"
          className="mb-4 text-sm text-zinc-600 dark:text-zinc-400"
        >
          Preparing your authenticator code…
        </p>
      ) : null}
      <label htmlFor="code" className="block text-base font-medium">
        6-digit code
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "code-error" : undefined}
        className="mt-2 block w-full max-w-40 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base tracking-widest dark:border-zinc-700 dark:bg-zinc-950"
      />
      {error ? (
        <p
          id="code-error"
          role="alert"
          className="mt-2 text-sm font-medium text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !factorId || code.length !== 6}
        className="btn-primary mt-4"
      >
        {busy ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
