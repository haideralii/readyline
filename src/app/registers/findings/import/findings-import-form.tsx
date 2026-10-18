"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import {
  FINDING_SEVERITIES,
  FINDING_SEVERITY_LABELS,
  type FindingSeverity,
} from "@/lib/registers/audit-day-types";
import type { FindingCandidate } from "@/lib/registers/findings-parse";
import {
  parseFindingsAction,
  saveFindingsAction,
} from "@/server/registers/findings-actions";

/** D-2930: the one sentence above the control. */
export const NEVER_STORED_LINE =
  "Your report is read here and then forgotten: nothing of the file is kept, logged or sent to a model.";

const INPUT =
  "border-line bg-surface text-ink block w-full rounded-md border px-3 py-2 text-base shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2";

type Draft = FindingCandidate & { include: boolean; standardId: string };

export function FindingsImportForm({
  standards,
}: {
  standards: { value: string; label: string }[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState<"find" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refused, setRefused] = useState<Record<number, string>>({});

  async function find() {
    setBusy("find");
    setMessage(null);
    setRefused({});
    try {
      const file = fileRef.current?.files?.[0];
      let input: FormData | { text: string };
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        input = fd;
      } else {
        input = { text: pasted };
      }
      const r = await parseFindingsAction(input);
      if (!r.ok) {
        setDrafts(null);
        setMessage(r.message);
        return;
      }
      setSource(
        r.source === "paste"
          ? "the text you pasted"
          : `your ${r.source === "pdf" ? "PDF" : "Word"} file (${r.pages} page${r.pages === 1 ? "" : "s"}; the file itself is not kept)`,
      );
      setDrafts(
        r.candidates.map((c) => ({
          ...c,
          include: true,
          standardId: c.standardId,
        })),
      );
      if (r.candidates.length === 0)
        setMessage(
          "No findings were found in that text. Paste the findings section of the report, one finding per paragraph.",
        );
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((d) =>
      d
        ? d.map((x, j) =>
            j === i
              ? {
                  ...x,
                  ...patch,
                  warnings:
                    patch.text !== undefined
                      ? detectParticipantData(patch.text).map((w) => w.message)
                      : x.warnings,
                }
              : x,
          )
        : d,
    );
  }

  const included = (drafts ?? []).filter((d) => d.include);
  const blocked = included.filter((d) => d.warnings.length > 0).length;

  async function save() {
    if (!drafts) return;
    setBusy("save");
    setMessage(null);
    const rows = drafts
      .map((d, index) => ({ d, index }))
      .filter(({ d }) => d.include);
    try {
      const r = await saveFindingsAction({
        rows: rows.map(({ d }) => ({
          standard_id: d.standardId,
          indicator: "",
          severity: d.severity,
          finding: d.text,
          due_on: "",
        })),
      });
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      if (r.refused.length > 0) {
        const byDraft: Record<number, string> = {};
        for (const x of r.refused) byDraft[rows[x.index].index] = x.message;
        setRefused(byDraft);
        setMessage(
          `${r.saved} saved. ${r.refused.length} not saved: change the words marked below and save again.`,
        );
        // The saved ones leave the list; the refused stay.
        setDrafts((d) =>
          d ? d.filter((x, j) => !x.include || byDraft[j] !== undefined) : d,
        );
        return;
      }
      router.push(`/registers/findings?saved=${r.saved}`);
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6" data-testid="findings-import-form">
      <p
        className="text-ink text-sm leading-6"
        data-testid="findings-never-stored"
      >
        {NEVER_STORED_LINE}
      </p>
      <label
        htmlFor="findings-paste"
        className="mt-4 block text-base font-medium"
      >
        Paste the findings from your auditor&apos;s report
      </label>
      <textarea
        id="findings-paste"
        className={`${INPUT} mt-1 min-h-40`}
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        data-testid="findings-paste"
      />
      <label
        htmlFor="findings-file"
        className="mt-4 block text-base font-medium"
      >
        Or choose the report as a PDF or Word file (up to 5 MB)
      </label>
      <input
        id="findings-file"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="mt-1 block text-sm"
        ref={fileRef}
        data-testid="findings-file"
      />
      <div className="mt-4">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void find()}
          disabled={busy !== null}
          data-testid="findings-find"
        >
          {busy === "find" ? "Reading…" : "Find the findings"}
        </button>
      </div>
      {message ? (
        <p
          role="status"
          className="border-ochre mt-4 rounded-md border p-3 text-sm leading-6"
          data-testid="findings-message"
        >
          {message}
        </p>
      ) : null}
      {drafts && drafts.length > 0 ? (
        <section className="mt-6" aria-labelledby="findings-candidates-heading">
          <h2 id="findings-candidates-heading" className="text-lg font-medium">
            {drafts.length} finding{drafts.length === 1 ? "" : "s"} from{" "}
            {source}
          </h2>
          <p className="text-slate mt-1 text-sm leading-6">
            Put each one in your own words. A finding that names a person cannot
            be saved until the name is replaced with a code.
          </p>
          <ol className="mt-4 space-y-4" data-testid="findings-candidates">
            {drafts.map((d, i) => (
              <li
                key={i}
                className="border-line rounded-md border p-3"
                data-testid="findings-candidate"
                data-blocked={d.warnings.length > 0 ? "true" : "false"}
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={d.include}
                    onChange={(e) => update(i, { include: e.target.checked })}
                    data-testid="findings-candidate-include"
                  />
                  Save this finding
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium">
                      Severity, as the auditor wrote it
                    </span>
                    <select
                      className={`${INPUT} mt-1`}
                      value={d.severity}
                      onChange={(e) =>
                        update(i, {
                          severity: e.target.value as FindingSeverity,
                        })
                      }
                      data-testid="findings-candidate-severity"
                    >
                      {FINDING_SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {FINDING_SEVERITY_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">Practice Standard</span>
                    <select
                      className={`${INPUT} mt-1`}
                      value={d.standardId}
                      onChange={(e) =>
                        update(i, { standardId: e.target.value })
                      }
                      data-testid="findings-candidate-standard"
                    >
                      {standards.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  <span className="font-medium">
                    The finding, in your own words
                  </span>
                  <textarea
                    className={`${INPUT} mt-1 min-h-24`}
                    value={d.text}
                    maxLength={500}
                    onChange={(e) => update(i, { text: e.target.value })}
                    data-testid="findings-candidate-text"
                  />
                </label>
                {d.truncated ? (
                  <p className="text-slate mt-1 text-xs">
                    Cut to 500 characters; shorten it in your own words.
                  </p>
                ) : null}
                {d.warnings.map((w) => (
                  <p
                    key={w}
                    role="status"
                    className="border-ochre mt-2 rounded-md border p-3 text-sm leading-6"
                    data-testid="findings-candidate-warning"
                  >
                    {w}
                  </p>
                ))}
                {refused[i] ? (
                  <p
                    role="alert"
                    className="border-signal mt-2 rounded-md border p-3 text-sm leading-6"
                    data-testid="findings-candidate-refused"
                  >
                    {refused[i]}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void save()}
              disabled={busy !== null || included.length === 0 || blocked > 0}
              data-testid="findings-save"
            >
              {busy === "save"
                ? "Saving…"
                : `Save ${included.length} finding${included.length === 1 ? "" : "s"}`}
            </button>
            {blocked > 0 ? (
              <p className="text-sm" data-testid="findings-blocked">
                {blocked} marked above cannot be saved until the words change.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
