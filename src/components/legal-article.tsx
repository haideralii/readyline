import { isValidElement, type ReactNode } from "react";
import { slugify } from "@/lib/text/slug";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { draftNote, formatUpdated, type LegalPage } from "@/lib/legal/pages";
import { DataTable } from "./data-table";
import { JumpTo, type JumpToItem } from "./jump-to";
import { PageShell } from "./page-shell";

/** A markdown syntax-tree node, as far as the plugin below reads it. */
type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, unknown> };
};
function mdText(n: MdNode): string {
  return n.value ?? (n.children ?? []).map(mdText).join("");
}

/**
 * REQ-028 QA F10: a remark plugin that tells each table the heading it sits
 * under (and its number under that heading), so DataTable can name its
 * region by the heading and two tables with the same columns stop sharing
 * one name (axe `landmark-unique` on the registers guide). The values ride
 * on `data.hProperties`, which react-markdown hands to the `table`
 * renderer as `node.properties`.
 */
export function tableHeadings() {
  return (tree: MdNode) => {
    let heading = "";
    let n = 0;
    const walk = (node: MdNode) => {
      if (node.type === "heading") {
        heading = mdText(node);
        n = 0;
      }
      if (node.type === "table") {
        n += 1;
        node.data = {
          ...(node.data ?? {}),
          hProperties: {
            ...(node.data?.hProperties ?? {}),
            dataHeading: heading,
            dataTableIndex: String(n),
          },
        };
      }
      for (const c of node.children ?? []) walk(c);
    };
    walk(tree);
  };
}

/** The remark plugins every markdown render site uses (the legal pages, the guides). */
export const markdownPlugins = [remarkGfm, tableHeadings];

/** REQ-028 FR-11: the "## " headings of a legal page's markdown, with the ids the renderer gives them, for the aside's "Jump to". */
export function legalHeadings(markdown: string): JumpToItem[] {
  return [...markdown.matchAll(/^## (.+?)\s*$/gm)].map((m) => ({
    id: slugify(m[1]),
    text: m[1],
  }));
}

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
    <h2 id={slugify(textOf(children))} className="mt-10 scroll-mt-24">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(textOf(children))} className="mt-6 scroll-mt-24">
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
    // REQ-028 QA F10: the region's name from the heading the table sits under (tableHeadings above).
    const props = (node as { properties?: Record<string, unknown> } | undefined)
      ?.properties;
    const heading =
      typeof props?.dataHeading === "string" ? props.dataHeading : "";
    const index = Number(props?.dataTableIndex ?? 1);
    const label = heading
      ? `${heading}${index > 1 ? ` (table ${index})` : ""}: ${columns.join(", ")}`
      : undefined;
    return columns.length ? (
      <DataTable columns={columns} rows={rows} label={label} />
    ) : null;
  },
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
};

export function LegalArticle({ page }: { page: LegalPage }) {
  const note = draftNote(page.status);
  const updated = `Last updated ${formatUpdated(page.updated)}`;
  // REQ-028 FR-11: from lg the page is the shell's reading kind, eight columns of prose at 65ch with the
  // sticky aside holding the "Jump to" nav and the updated line; under lg the article keeps its own order
  // (the updated line under the h1) and the aside is out of the page (D-2276).
  const aside = (
    <div data-testid="legal-aside">
      <p className="text-slate text-sm" data-testid="aside-updated">
        {updated}
      </p>
      <JumpTo
        items={legalHeadings(page.markdown)}
        testId="aside-jump-to"
        className="mt-4"
      />
    </div>
  );
  return (
    <PageShell kind="reading" aside={aside} asideFrom="lg">
      <article>
        <h1 className="">{page.title}</h1>
        <p
          className="text-slate mt-2 text-sm lg:hidden"
          data-testid="legal-updated"
        >
          {updated}
        </p>
        {note ? (
          <p
            className="mt-4 rounded-md border border-amber-700 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100"
            data-testid="legal-draft-note"
          >
            <strong className="font-semibold">Draft.</strong> {note}
          </p>
        ) : null}
        <Markdown
          remarkPlugins={markdownPlugins}
          components={markdownComponents}
        >
          {page.markdown}
        </Markdown>
      </article>
    </PageShell>
  );
}
