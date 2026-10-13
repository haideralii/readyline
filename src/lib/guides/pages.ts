/**
 * The guides (REQ-011, batch 29): markdown under content/guides/ with the
 * same front-matter convention as the legal pages, read on the server. Each
 * guide gives a title, slug, description, the dates it was updated and
 * reviewed, a FAQ section parsed into question-and-answer pairs (rendered
 * as FAQPage structured data too), a Sources section, and placeholders
 * ({{registration-groups-table}}, {{pack-price}}, {{cost-calculator}}) the
 * page fills from live data so a figure is never hand-typed twice.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { parseFrontMatter } from "@/lib/legal/pages";

export const GUIDES_DIR = join(process.cwd(), "content", "guides");

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const FrontMatter = z.object({
  title: z.string().trim().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().trim().min(40).max(200),
  updated: z.string().regex(DATE),
  reviewed: z.string().regex(DATE),
  owner: z.literal("po"),
  status: z.string().trim().optional(),
});

export type GuideFaq = { question: string; answer: string };

export type Guide = {
  slug: string;
  title: string;
  description: string;
  updated: string;
  reviewed: string;
  status: string | null;
  draft: boolean;
  /** The body without the title heading, FAQ and Sources sections. */
  markdown: string;
  faq: GuideFaq[];
  sources: { label: string; url: string | null }[];
  /** UNVERIFIED lines for the PO, as written. */
  unverified: string[];
};

function section(markdown: string, heading: string): string | null {
  const re = new RegExp(`^## ${heading}\\s*$`, "m");
  const m = re.exec(markdown);
  if (!m) return null;
  const rest = markdown.slice(m.index + m[0].length);
  const next = /^## /m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function withoutSections(markdown: string, headings: string[]): string {
  let out = markdown;
  for (const h of headings) {
    const re = new RegExp(`^## ${h}\\s*$[\\s\\S]*?(?=^## |(?![\\s\\S]))`, "m");
    out = out.replace(re, "");
  }
  return out.trim();
}

export function parseFaq(block: string | null): GuideFaq[] {
  if (!block) return [];
  const out: GuideFaq[] = [];
  const parts = block.split(/^### /m).slice(1);
  for (const p of parts) {
    const [q, ...rest] = p.split("\n");
    const answer = rest.join("\n").trim();
    if (q.trim() && answer) out.push({ question: q.trim(), answer });
  }
  return out;
}

export function parseSources(block: string | null): Guide["sources"] {
  if (!block) return [];
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(l);
      return link
        ? { label: link[1], url: link[2] }
        : { label: l.slice(2).trim(), url: null };
    });
}

export function loadGuide(slug: string, dir: string = GUIDES_DIR): Guide {
  const raw = readFileSync(join(dir, `${slug}.md`), "utf8");
  const parsed = parseFrontMatter(raw);
  const front = FrontMatter.safeParse(parsed.data);
  if (!front.success)
    throw new Error(
      `content/guides/${slug}.md front matter: ${front.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  if (front.data.slug !== slug)
    throw new Error(
      `content/guides/${slug}.md: slug "${front.data.slug}" does not match the file name`,
    );
  const body = parsed.content
    .replace(/^\s*\n/, "")
    .replace(/^#\s[^\n]*\n+/, "");
  const status = front.data.status ?? null;
  return {
    slug,
    title: front.data.title,
    description: front.data.description,
    updated: front.data.updated,
    reviewed: front.data.reviewed,
    status,
    draft: /^draft\b/i.test(status ?? ""),
    markdown: withoutSections(body, ["FAQ", "Sources"]),
    faq: parseFaq(section(body, "FAQ")),
    sources: parseSources(section(body, "Sources")),
    unverified: body
      .split("\n")
      .filter((l) => /UNVERIFIED/.test(l))
      .map((l) => l.trim()),
  };
}

export function listGuideSlugs(dir: string = GUIDES_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

export function loadGuides(dir: string = GUIDES_DIR): Guide[] {
  return listGuideSlugs(dir).map((s) => loadGuide(s, dir));
}
