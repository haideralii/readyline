"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  GAP_CHECK_BUTTON,
  GAP_CHECK_EMPTY,
  GAP_CHECK_FILE_LABEL,
  GAP_CHECK_IN_AUDIT,
  GAP_CHECK_LIMIT_LINE,
  GAP_CHECK_NEVER_STORED,
  GAP_CHECK_NOT_IN_AUDIT,
  GAP_CHECK_PASTE_LABEL,
  GAP_CHECK_REFUSED_LINE,
  GAP_CHECK_TITLE_LABEL,
  GAP_CHECK_TYPE_LABEL,
} from "@/lib/gap-check/words";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import { runGapCheckAction } from "@/server/gap-check/actions";

const INPUT =
  "border-line bg-surface text-ink block w-full rounded-md border px-3 py-2 text-base shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2";

export type GapCheckTypeOption = { id: string; title: string };

/**
 * REQ-035 FR-1, FR-2 (D-2962, D-2963): the owner's document, pasted or
 * chosen as a file, the type it stands for and its name. The participant
 * detector runs over the paste and the title as they are typed; a flagged
 * text holds the button with the detector's sentence, and the server runs
 * the same check again before anything is sent.
 */
export function GapCheckForm({
  inAudit,
  notInAudit,
}: {
  inAudit: GapCheckTypeOption[];
  notInAudit: GapCheckTypeOption[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [typeId, setTypeId] = useState(
    inAudit[0]?.id ?? notInAudit[0]?.id ?? "",
  );
  const [title, setTitle] = useState("");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const warnings = useMemo(
    () => detectParticipantData(`${title}\n${pasted}`).map((w) => w.message),
    [title, pasted],
  );

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("documentTypeId", typeId);
      fd.set("title", title);
      fd.set("text", pasted);
      const file = fileRef.current?.files?.[0];
      if (file) fd.set("file", file);
      if (!file && !pasted.trim()) {
        setMessage(GAP_CHECK_EMPTY);
        return;
      }
      const r = await runGapCheckAction(fd);
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      router.push(`/documents/gap-check/${r.id}`);
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const group = (label: string, options: GapCheckTypeOption[]) =>
    options.length ? (
      <optgroup label={label}>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </optgroup>
    ) : null;

  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
      data-testid="gap-check-form"
    >
      <p
        className="text-ink text-sm leading-6"
        data-testid="gap-check-never-stored"
      >
        {GAP_CHECK_NEVER_STORED}
      </p>
      <label className="mt-4 block text-sm">
        <span className="font-medium">{GAP_CHECK_TYPE_LABEL}</span>
        <select
          className={`${INPUT} mt-1`}
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          data-testid="gap-check-type"
          required
        >
          {group(GAP_CHECK_IN_AUDIT, inAudit)}
          {group(GAP_CHECK_NOT_IN_AUDIT, notInAudit)}
        </select>
      </label>
      <label className="mt-4 block text-sm">
        <span className="font-medium">{GAP_CHECK_TITLE_LABEL}</span>
        <input
          type="text"
          className={`${INPUT} mt-1`}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="gap-check-title"
          required
        />
      </label>
      <label className="mt-4 block text-sm">
        <span className="font-medium">{GAP_CHECK_PASTE_LABEL}</span>
        <textarea
          className={`${INPUT} mt-1 min-h-40`}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          data-testid="gap-check-paste"
        />
      </label>
      <label className="mt-4 block text-sm">
        <span className="font-medium">{GAP_CHECK_FILE_LABEL}</span>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="mt-1 block text-sm"
          data-testid="gap-check-file"
        />
      </label>
      {warnings.length > 0 ? (
        <p
          role="alert"
          className="border-signal mt-4 rounded-md border p-3 text-sm leading-6"
          data-testid="gap-check-warning"
        >
          {warnings[0]} {GAP_CHECK_REFUSED_LINE}
        </p>
      ) : null}
      <p className="text-slate mt-4 text-sm" data-testid="gap-check-limit-line">
        {GAP_CHECK_LIMIT_LINE}
      </p>
      <p className="mt-2">
        <button
          type="submit"
          className="btn-primary"
          disabled={busy || warnings.length > 0}
          data-testid="gap-check-run"
        >
          {busy ? "Checking…" : GAP_CHECK_BUTTON}
        </button>
      </p>
      {message ? (
        <p
          role="alert"
          className="border-signal mt-3 rounded-md border p-3 text-sm leading-6"
          data-testid="gap-check-message"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
