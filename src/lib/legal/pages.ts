/**
 * The legal and trust pages render the product owner's markdown from
 * product/legal/*.md (REQ-008 FR-1, AC-4). The files are the source of truth:
 * this module reads one on the server, validates its front matter, drops the
 * title heading (the page renders the title itself) and numbers the headings
 * from structure (D-043: the copy carries no hand-typed numbers). Server
 * code only: it reads the file system.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { isLegalSlug, LEGAL_SLUGS, type LegalSlug } from "./nav";

export { isLegalSlug, LEGAL_SLUGS, type LegalSlug };

export const LEGAL_DIR = join(process.cwd(), "product", "legal");

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const FrontMatter = z.object({
  title: z.string().trim().min(1, "title is required"),
  updated: z.string().regex(DATE, "updated must be YYYY-MM-DD"),
  owner: z.literal("po"),
  status: z.string().trim().optional(),
});

/**
 * The front matter is a block of `key: value` lines between `---` fences
 * (D-801: parsed here rather than with a YAML library, which brought
 * advisories; the copy never needs more than scalar strings). Quotes around
 * a value are removed; everything else is kept as written.
 */
export function parseFrontMatter(raw: string): {
  data: Record<string, string>;
  content: string;
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, content: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    data[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { data, content: m[2] };
}

export type LegalPage = {
  slug: LegalSlug;
  title: string;
  /** YYYY-MM-DD from the front matter. */
  updated: string;
  owner: "po";
  status: string | null;
  /** True while the status starts with "draft". */
  draft: boolean;
  /** The body as written, without the front matter. */
  body: string;
  /** The body without its title heading, with headings numbered from structure. */
  markdown: string;
};

export function loadLegalPage(
  slug: LegalSlug,
  dir: string = LEGAL_DIR,
): LegalPage {
  const raw = readFileSync(join(dir, `${slug}.md`), "utf8");
  const parsed = parseFrontMatter(raw);
  const front = FrontMatter.safeParse(parsed.data);
  if (!front.success) {
    throw new Error(
      `product/legal/${slug}.md front matter: ${front.error.issues
        .map((i) => `${i.path.join(".") || "front matter"}: ${i.message}`)
        .join("; ")}`,
    );
  }
  const body = parsed.content.replace(/^\s*\n/, "");
  const status = front.data.status ?? null;
  return {
    slug,
    title: front.data.title,
    updated: front.data.updated,
    owner: front.data.owner,
    status,
    draft: /^draft\b/i.test(status ?? ""),
    body,
    markdown: numberHeadings(stripTitleHeading(body)),
  };
}

export function loadLegalPages(dir: string = LEGAL_DIR): LegalPage[] {
  return LEGAL_SLUGS.map((slug) => loadLegalPage(slug, dir));
}

/** Removes a leading "# Title" line (and the blank line after it). */
export function stripTitleHeading(markdown: string): string {
  return markdown.replace(/^#\s[^\n]*\n+/, "");
}

/** "## Heading" becomes "## 1 Heading", "### Sub" becomes "### 1.1 Sub"; fenced code is left alone. */
export function numberHeadings(markdown: string): string {
  let h2 = 0;
  let h3 = 0;
  let inFence = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const m = /^(#{2,3})\s+(.*)$/.exec(line);
      if (!m) return line;
      if (m[1] === "##") {
        h2 += 1;
        h3 = 0;
        return `## ${h2} ${m[2]}`;
      }
      h3 += 1;
      return `### ${h2}.${h3} ${m[2]}`;
    })
    .join("\n");
}

/** True when a heading in the copy starts with a number, which the renderer would double up. */
export function hasHandTypedNumbers(markdown: string): boolean {
  return /^#{2,3}\s+\d+(?:\.\d+)*\s/m.test(markdown);
}

/**
 * Plain text for the readability score: headings, table rows and list
 * markers removed, emphasis and link syntax unwrapped.
 */
export function markdownToText(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => !/^\s*#/.test(line) && !/^\s*\|/.test(line))
    .map((line) =>
      line
        .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
        .replace(/\*\*|__|`/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
    )
    .join("\n")
    .trim();
}

/**
 * Text with double-quoted spans removed. The AI page says we avoid claims
 * "such as 'guaranteed' or 'audit-proof'": naming a banned phrase in quotes
 * is a mention, not a claim, so the claims lint runs over the rest (D-802).
 */
export function withoutQuotedMentions(text: string): string {
  return text.replace(/"[^"\n]{1,80}"/g, '""');
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-10-12" as "12 October 2026", without locale dependence. */
export function formatUpdated(updated: string): string {
  const [y, m, d] = updated.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** The sentence shown while a page is a draft, taken from the status line's brackets. */
export function draftNote(status: string | null): string | null {
  if (!status || !/^draft\b/i.test(status)) return null;
  const inner = /\((.*)\)\s*$/.exec(status)?.[1]?.trim();
  if (!inner) return "Draft.";
  const sentence = inner.charAt(0).toUpperCase() + inner.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}
