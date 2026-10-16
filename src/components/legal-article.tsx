import { isValidElement, type ReactNode } from "react";
import { slugify } from "@/lib/text/slug";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { draftNote, formatUpdated, type LegalPage } from "@/lib/legal/pages";
import { DataTable } from "./data-table";

/** A markdown table's header and body cells as text, from the hast node react-markdown passes to `table`. */
type Hast = {
  type?: string;
  tagName?: string;
  value?: string;
  children?: Hast[];
};
function hastText(n: Hast | undefined): string {
  if (!n) return "";
  if (n.type === "text") return n.value ?? "";
  return (n.children ?? []).map(hastText).join("");
}
function findAll(n: Hast | undefined, tag: string, out: Hast[] = []): Hast[] {
  if (!n) return out;
  if (n.tagName === tag) out.push(n);
  for (const c of n.children ?? []) findAll(c, tag, out);
  return out;
}
export function tableFromNode(node: unknown): {
  columns: string[];
  rows: string[][];
} {
  const n = node as Hast | undefined;
  const trs = findAll(n, "tr");
  const columns = trs.length
    ? findAll(trs[0], "th").map((th) => hastText(th).trim())
    : [];
  const rows = trs
    .slice(1)
    .map((tr) => findAll(tr, "td").map((td) => hastText(td).trim()))
    .filter((r) => r.length > 0);
  return { columns, rows };
}

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

const body = "leading-7 text-ink ";

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
  // REQ-013 batch 36: a markdown table becomes the shared DataTable (stacked
  // rows on phones, no split words on wider screens), read from the syntax
  // tree react-markdown hands over; cell text only, which is all the guides'
  // tables carry. The table carries its name from its header cells (backlog
  // 1, D-1508) inside DataTable.
  table: ({ node }) => {
    const { columns, rows } = tableFromNode(node);
    return columns.length ? <DataTable columns={columns} rows={rows} /> : null;
  },
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
};

export function LegalArticle({ page }: { page: LegalPage }) {
  const note = draftNote(page.status);
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
      <p className="text-slate mt-2 text-sm" data-testid="legal-updated">
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
