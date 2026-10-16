"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ImportPreview, ImportRegister } from "@/lib/registers/import";
import {
  commitImportAction,
  previewImportAction,
  undoImportAction,
} from "@/server/registers/import-actions";

/**
 * The import screen (REQ-020 FR-8, FR-12): choose the file, see every row's
 * result, import the rows that pass. The file is read in the browser and
 * sent as text; nothing is written until "Import". Recent imports can be
 * undone for an hour (the owner).
 */
export function ImportForm({
  register,
  slug,
  title,
  recent,
}: {
  register: ImportRegister;
  slug: string;
  title: string;
  recent: {
    id: string;
    createdAt: string;
    imported: number;
    total: number;
    canUndo: boolean;
  }[];
}) {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pending, setPending] = useState<"preview" | "import" | "undo" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(null);
    setMessage(null);
    if (!file) {
      setText(null);
      return;
    }
    if (file.size > 1_000_000) {
      setText(null);
      setMessage("The file is over 1 MB. Split it and try again.");
      return;
    }
    const content = await file.text();
    setFileName(file.name);
    setText(content);
    setPending("preview");
    try {
      setPreview(await previewImportAction({ register, text: content }));
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(null);
    }
  }

  async function onImport() {
    if (!text) return;
    setPending("import");
    setMessage(null);
    try {
      const r = await commitImportAction({ register, text });
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      router.push(`/registers/${slug}?imported=${r.imported}`);
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(null);
    }
  }

  async function onUndo(id: string) {
    setPending("undo");
    setMessage(null);
    try {
      const r = await undoImportAction({ id });
      setMessage(
        r.ok
          ? `Undone: ${r.removed} ${r.removed === 1 ? "row" : "rows"} removed.`
          : r.message,
      );
      router.refresh();
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div data-testid="import-form">
      <ol className="mt-4 list-decimal space-y-1 pl-5 leading-7">
        <li>
          <a
            href={`/registers/${slug}/import-template.csv`}
            className="underline underline-offset-4"
            data-testid="import-template"
          >
            Download the empty template
          </a>{" "}
          and fill it in a spreadsheet. Keep the column names exactly as they
          are.
        </li>
        <li>
          Use codes for people (P-014, W-003), never names, dates of birth or
          NDIS numbers.
        </li>
        <li>
          Choose the file here. Every row is checked before anything is saved.
        </li>
      </ol>
      <label htmlFor="import-file" className="mt-5 block text-sm font-medium">
        Your CSV file
      </label>
      <input
        id="import-file"
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        className="mt-1 block w-full text-sm"
        data-testid="import-file"
      />
      {pending === "preview" ? (
        <p role="status" className="mt-3 text-sm">
          Checking {fileName}…
        </p>
      ) : null}
      {message ? (
        <p
          role="alert"
          className="mt-3 text-sm leading-6"
          data-testid="import-message"
        >
          {message}
        </p>
      ) : null}
      {preview && !preview.ok ? (
        <p
          role="alert"
          className="mt-3 text-sm leading-6"
          data-testid="import-refused"
        >
          {preview.message}
        </p>
      ) : null}
      {preview && preview.ok ? (
        <div className="mt-5" data-testid="import-preview">
          <p className="leading-7" data-testid="import-counts">
            {preview.passed} of {preview.rows.length}{" "}
            {preview.rows.length === 1 ? "row passes" : "rows pass"}
            {preview.failed > 0
              ? `; ${preview.failed} ${preview.failed === 1 ? "row does" : "rows do"} not and will be left out.`
              : "."}
          </p>
          {preview.failed > 0 ? (
            <ul
              className="mt-2 space-y-2 text-sm leading-6"
              data-testid="import-failures"
            >
              {preview.rows
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.n} data-testid="import-failure">
                    <span className="font-medium">
                      Row {r.n} ({r.label}):
                    </span>{" "}
                    {r.reasons.join("; ")}
                  </li>
                ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="btn-primary mt-4"
            disabled={pending !== null || preview.passed === 0}
            aria-busy={pending === "import" || undefined}
            onClick={onImport}
            data-testid="import-commit"
          >
            {pending === "import"
              ? "Importing…"
              : `Import ${preview.passed} ${preview.passed === 1 ? "row" : "rows"} into ${title}`}
          </button>
        </div>
      ) : null}
      {recent.length > 0 ? (
        <section aria-labelledby="recent-imports" className="mt-8">
          <h2 id="recent-imports" className="">
            Recent imports
          </h2>
          <ul className="divide-rule mt-2 divide-y text-sm">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
                data-testid="import-recent"
              >
                <span>
                  {r.imported} of {r.total} rows, {r.createdAt}
                </span>
                {r.canUndo ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={pending !== null}
                    onClick={() => onUndo(r.id)}
                    data-testid="import-undo"
                  >
                    Undo this import
                  </button>
                ) : (
                  <span className="text-slate">
                    Kept (the hour to undo has passed)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
