import { isValidElement, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { draftNote, formatUpdated, type LegalPage } from "@/lib/legal/pages";

/**
 * Renders one legal or trust page (REQ-008 FR-1). Markdown becomes React
 * elements through react-markdown (no raw HTML), headings get ids from their
 * text, and the title, "Last updated" line and draft note come from the
 * front matter.
 */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean")
    return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node))
    return textOf(node.props.children);
  return "";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const body = "leading-7 text-zinc-700 dark:text-zinc-300";

const Th: NonNullable<Components["th"]> = ({ children }) => (
  <th
    scope="col"
    className="border-b border-zinc-300 py-2 pr-4 text-left font-semibold dark:border-zinc-700"
  >
    {children}
  </th>
);

/** The header cells of a markdown table, so the table can carry its name (backlog 1, D-1508). */
function headerCells(node: ReactNode, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const n of node) headerCells(n, out);
    return out;
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.type === Th || node.type === "th")
      out.push(textOf(node.props.children).trim());
    else headerCells(node.props.children, out);
  }
  return out;
}

/** The markdown renderers; the guides (REQ-011) reuse them so every page reads the same. */
export const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2
      id={slugify(textOf(children))}
      className="mt-10 text-xl font-semibold tracking-tight"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(textOf(children))} className="mt-6 text-lg font-semibold">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className={`mt-4 ${body}`}>{children}</p>,
  ul: ({ children }) => (
    <ul className={`mt-4 list-disc space-y-2 pl-5 ${body}`}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className={`mt-4 list-decimal space-y-2 pl-5 ${body}`}>{children}</ol>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="underline underline-offset-2"
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  table: ({ children }) => {
    const cols = headerCells(children);
    return (
      <div className="mt-4 overflow-x-auto">
        <table
          className="w-full border-collapse text-sm"
          aria-label={cols.length ? `Table: ${cols.join(", ")}` : "Table"}
        >
          {children}
        </table>
      </div>
    );
  },
  th: Th,
  td: ({ children }) => (
    <td className="border-b border-zinc-200 py-2 pr-4 align-top dark:border-zinc-800">
      {children}
    </td>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
};

export function LegalArticle({ page }: { page: LegalPage }) {
  const note = draftNote(page.status);
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
      <p
        className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
        data-testid="legal-updated"
      >
        Last updated {formatUpdated(page.updated)}
      </p>
      {note ? (
        <p
          className="mt-4 rounded-md border border-amber-700 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100"
          data-testid="legal-draft-note"
        >
          <strong className="font-semibold">Draft.</strong> {note}
        </p>
      ) : null}
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {page.markdown}
      </Markdown>
    </article>
  );
}
