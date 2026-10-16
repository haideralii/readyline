/**
 * REQ-015 FR-2: every string that reaches the customer passes the
 * plain-language rules. Walks the JSX text of the pages and components, the
 * natural-language strings of the copy modules, and the content JSON the UI
 * renders, and fails on a paragraph over 60 words, a sentence over 35 words,
 * a banned word, or an internal path or file name. Runs in `npm test`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  AI_DISCLOSURE,
  GENERAL_INFORMATION_NOTICE,
  GENERAL_INFORMATION_STATEMENT,
} from "@/lib/brand";
import {
  AVERAGE_MIN_STRING_WORDS,
  TIGHT_PARAGRAPH_MAX_WORDS,
  averageSentenceWords,
  countWords,
  lintAverage,
  lintText,
  splitSentences,
  type CopyViolation,
} from "@/lib/copy-lint/rules";

const ROOT = process.cwd();

/**
 * REQ-027 FR-1 (D-2702): the sentences a file's average is taken over. On a
 * page: the text of `p`, `dd`, `li` and `blockquote` blocks; in a copy
 * module or a content file: the strings of ten words or more; in a guide:
 * the paragraphs and list items with the front matter's short answer and
 * description. Headings, summaries, labels and text attributes are not
 * counted, and nor is an allow-listed constant. Filled by the walkers below,
 * read by `averageFindings` after each walk.
 */
const AVERAGE_POPULATION = new Map<string, string[]>();
/** The block tags whose text joins the average (FR-1, finding 1). */
const AVERAGE_TAGS = new Set(["p", "dd", "li", "blockquote"]);
/** The files whose averages the evidence carries (question 2), logged with each run. */
const AVERAGE_REPORT_FILES = [
  "src/app/start/_components/steps/result-step.tsx",
  "src/app/pricing/page.tsx",
  "src/lib/payments/copy.ts",
  "content/guides/which-ndis-audit.md",
];

function countSentences(rel: string, text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || ALLOWED_CONSTANTS.has(clean)) return;
  const key = rel.replace(/\\/g, "/");
  const list = AVERAGE_POPULATION.get(key) ?? [];
  for (const s of splitSentences(clean)) if (countWords(s) > 0) list.push(s);
  AVERAGE_POPULATION.set(key, list);
}

/** FR-1: one finding per file whose average passes 25, and the report lines for the named files. */
function averageFindings(findings: Finding[]) {
  for (const [file, sentences] of AVERAGE_POPULATION) {
    const v = lintAverage(sentences);
    if (v) findings.push({ file, where: "whole file", violation: v });
    if (AVERAGE_REPORT_FILES.includes(file))
      console.log(
        `FR-1 average: ${file}: ${sentences.length} sentences, ${averageSentenceWords(sentences)} words a sentence`,
      );
  }
  AVERAGE_POPULATION.clear();
}

/**
 * REQ-025 FR-10, D-2218: the result page, the pricing page and the guides
 * hold a paragraph to 45 words. The lawyer's text is allow-listed by
 * constant (review decision 10): a block whose text is one of these
 * constants keeps the 60-word cap wherever it renders.
 */
const TIGHT_FILES = new Set([
  "src/app/start/_components/steps/result-step.tsx",
  "src/app/pricing/page.tsx",
  "src/lib/payments/copy.ts",
]);
/** Paragraph-like tags the tight cap applies to; list items, summaries and the rest keep the 60-word cap (decision 11). */
const TIGHT_TAGS = new Set(["p", "dd", "blockquote"]);
const ALLOWED_CONSTANTS = new Set(
  [
    AI_DISCLOSURE,
    GENERAL_INFORMATION_NOTICE,
    GENERAL_INFORMATION_STATEMENT,
  ].map((s) => s.replace(/\s+/g, " ").trim()),
);

function maxWordsFor(
  rel: string,
  tag: string,
  text: string,
): number | undefined {
  const tight = TIGHT_FILES.has(rel.replace(/\\/g, "/"));
  if (!tight || !TIGHT_TAGS.has(tag)) return undefined;
  if (ALLOWED_CONSTANTS.has(text.replace(/\s+/g, " ").trim())) return undefined;
  return TIGHT_PARAGRAPH_MAX_WORDS;
}

/** Paragraph-like elements whose whole text is capped. */
const BLOCK_TAGS = new Set([
  "p",
  "li",
  "dd",
  "dt",
  "summary",
  "legend",
  "label",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "figcaption",
  "blockquote",
]);
/** Inline elements whose text belongs to the enclosing block. */
const INLINE_TAGS = new Set([
  "span",
  "strong",
  "em",
  "b",
  "i",
  "a",
  "Link",
  "code",
  "abbr",
  "br",
  "small",
  "time",
  "kbd",
]);
/** Attributes whose string values the customer reads. */
const TEXT_ATTRIBUTES = new Set([
  "placeholder",
  "aria-label",
  "title",
  "alt",
  "aria-description",
]);

/** Copy modules: natural-language string literals (3 words or more) are checked. */
const COPY_MODULES = [
  "src/lib/home-copy.ts",
  "src/lib/brand.ts",
  "src/lib/checklist/derive.ts",
  "src/lib/checklist/state.ts",
  "src/lib/questionnaire/navigation.ts",
  "src/lib/questionnaire/schema.ts",
  "src/lib/questionnaire/result.ts",
  "src/lib/legal/nav.ts",
  "src/lib/payments/copy.ts",
  "src/lib/payments/documents-copy.ts",
  "src/server/payments/messages.ts",
  // REQ-021: every line the writing indicator can show.
  "src/lib/generation/writing-state.ts",
  // REQ-027 A1 (decision 8, finding 121): a `.ts` under `src/app` the TSX walk never read; its
  // strings are the practices step's legends, helps and examples.
  "src/app/start/_components/steps/practices-copy.ts",
];
const CONTENT_JSON_DIR = "data/readyline-content";

type Finding = { file: string; where: string; violation: CopyViolation };

function walkDir(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkDir(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

function tagName(node: ts.JsxOpeningLikeElement | ts.JsxSelfClosingElement) {
  return node.tagName.getText();
}

/** The customer-readable text of a JSX child list, inline descendants included, nested blocks excluded. */
function inlineText(
  children: ts.NodeArray<ts.JsxChild>,
  sf: ts.SourceFile,
): string {
  let text = "";
  for (const c of children) {
    if (ts.isJsxText(c)) text += ` ${c.getText(sf)}`;
    else if (ts.isJsxExpression(c) && c.expression)
      text += ` ${expressionText(c.expression, sf)}`;
    else if (ts.isJsxElement(c)) {
      const tag = tagName(c.openingElement);
      if (INLINE_TAGS.has(tag)) text += ` ${inlineText(c.children, sf)}`;
    } else if (ts.isJsxSelfClosingElement(c) && tagName(c) === "br")
      text += " ";
  }
  return decode(text);
}

/**
 * Batch 45 item 7 (WCAG 1.3.2): two inline elements rendered back to back
 * with no whitespace between them read as one word ("AUD 399one-off"). The
 * check is at the boundary only: the last character of one child is a digit
 * and the first character of the next is a letter, with nothing rendered
 * between them (JSX drops whitespace that holds a newline).
 */
function boundaryJoins(
  children: ts.NodeArray<ts.JsxChild>,
  sf: ts.SourceFile,
): string[] {
  const rendered = (c: ts.JsxChild): string | null => {
    if (ts.isJsxText(c)) {
      // The full text: a JSX text node's leading whitespace is trivia to getText().
      const raw = c.getFullText(sf);
      if (/^\s*$/.test(raw)) return raw.includes("\n") ? "" : " ";
      return raw.replace(/\s*\n\s*/g, " ");
    }
    if (ts.isJsxExpression(c))
      return c.expression ? expressionText(c.expression, sf) || "X" : "";
    if (ts.isJsxElement(c)) return inlineText(c.children, sf).trim();
    return null;
  };
  const out: string[] = [];
  let prev: string | null = null;
  for (const c of children) {
    const text = rendered(c);
    if (text === null) continue;
    if (text === "") continue;
    if (prev !== null && /\d$/.test(prev) && /^[A-Za-z]/.test(text))
      out.push(`"${prev.slice(-12)}" runs into "${text.slice(0, 12)}"`);
    prev = text;
  }
  return out;
}

/** Static strings inside a JSX expression: literals, template parts, both arms of a conditional. */
function expressionText(e: ts.Expression, sf: ts.SourceFile): string {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))
    return e.text;
  if (ts.isTemplateExpression(e))
    return [
      e.head.text,
      ...e.templateSpans.map((s) => ` X ${s.literal.text}`),
    ].join("");
  if (ts.isConditionalExpression(e)) {
    // Only one arm renders at a time: measure the longer, never the sum.
    const a = expressionText(e.whenTrue, sf);
    const b = expressionText(e.whenFalse, sf);
    return a.split(/\s+/).length >= b.split(/\s+/).length ? a : b;
  }
  if (ts.isParenthesizedExpression(e)) return expressionText(e.expression, sf);
  if (
    ts.isBinaryExpression(e) &&
    e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  )
    return `${expressionText(e.left, sf)} ${expressionText(e.right, sf)}`;
  if (ts.isJsxElement(e)) return inlineText(e.children, sf);
  if (ts.isJsxFragment(e)) return inlineText(e.children, sf);
  return "";
}

function decode(s: string): string {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\{"\s*"\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lintTsx(file: string, findings: Finding[]) {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const rel = relative(ROOT, file);
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const tag = tagName(node.openingElement);
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      for (const join of boundaryJoins(node.children, sf))
        findings.push({
          file: rel,
          where: `<${tag}> line ${line}`,
          violation: {
            rule: "banned-word",
            detail: `a number runs into a word across two elements with no space between: ${join}`,
          },
        });
      if (BLOCK_TAGS.has(tag)) {
        const text = inlineText(node.children, sf);
        if (AVERAGE_TAGS.has(tag)) countSentences(rel, text);
        for (const v of lintText(text, {
          block: true,
          maxWords: maxWordsFor(rel, tag, text),
        }))
          findings.push({
            file: rel,
            where: `<${tag}> line ${line}`,
            violation: v,
          });
      } else if (!INLINE_TAGS.has(tag)) {
        // Loose text directly inside a div, section, button, etc.
        const text = inlineText(node.children, sf);
        for (const v of lintText(text))
          findings.push({
            file: rel,
            where: `<${tag}> line ${line}`,
            violation: v,
          });
      }
    }
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      TEXT_ATTRIBUTES.has(node.name.getText())
    ) {
      const init = node.initializer;
      const text = ts.isStringLiteral(init)
        ? init.text
        : ts.isJsxExpression(init) && init.expression
          ? expressionText(init.expression, sf)
          : "";
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      for (const v of lintText(text, { block: true }))
        findings.push({
          file: rel,
          where: `${node.name.getText()} line ${line}`,
          violation: v,
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

function lintCopyModule(file: string, findings: Finding[]) {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const rel = relative(ROOT, file);
  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      text = node.text;
    else if (ts.isTemplateExpression(node))
      text = [
        node.head.text,
        ...node.templateSpans.map((s) => ` X ${s.literal.text}`),
      ].join("");
    if (text !== null && text.trim().split(/\s+/).length >= 3) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      if (countWords(text) >= AVERAGE_MIN_STRING_WORDS)
        countSentences(rel, text);
      // A copy module's strings are paragraphs or list items alike; the tight
      // cap applies to strings outside an array (a list's items are exempt).
      const inList = ts.isArrayLiteralExpression(node.parent);
      for (const v of lintText(text, {
        block: true,
        maxWords: inList ? undefined : maxWordsFor(rel, "p", text),
      }))
        findings.push({
          file: rel,
          where: `string line ${line}`,
          violation: v,
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

function lintJson(file: string, findings: Finding[]) {
  const rel = relative(ROOT, file);
  const walk = (v: unknown, path: string) => {
    if (typeof v === "string") {
      if (countWords(v) >= AVERAGE_MIN_STRING_WORDS) countSentences(rel, v);
      if (v.trim().split(/\s+/).length >= 3)
        for (const x of lintText(v, { block: true }))
          findings.push({ file: rel, where: path, violation: x });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        // Notes to the PO, source URLs and the generator's briefs and brief
        // additions (model instructions, never shown to the customer) are not customer copy.
        if (
          /note$/i.test(k) ||
          k === "brief" ||
          k === "briefAdditions" ||
          k === "url" ||
          k === "sourceUrl" ||
          k === "sha256"
        )
          continue;
        walk(x, `${path}.${k}`);
      }
  };
  walk(JSON.parse(readFileSync(file, "utf8")), "$");
}

function format(f: Finding) {
  return `${f.file} (${f.where}) ${f.violation.rule}: ${f.violation.detail}`;
}

describe("customer-facing copy (REQ-015 FR-2; REQ-027 FR-1)", () => {
  it("pages and components: no paragraph over 60 words, sentence over 35, average over 25, banned word or internal path", () => {
    const findings: Finding[] = [];
    AVERAGE_POPULATION.clear();
    for (const dir of ["src/app", "src/components"])
      for (const f of walkDir(join(ROOT, dir))) lintTsx(f, findings);
    averageFindings(findings);
    expect(findings.map(format)).toEqual([]);
  });

  it("copy modules", () => {
    const findings: Finding[] = [];
    AVERAGE_POPULATION.clear();
    for (const f of COPY_MODULES) lintCopyModule(join(ROOT, f), findings);
    averageFindings(findings);
    expect(findings.map(format)).toEqual([]);
  });

  it("content JSON the UI renders", () => {
    const findings: Finding[] = [];
    AVERAGE_POPULATION.clear();
    for (const name of readdirSync(join(ROOT, CONTENT_JSON_DIR)))
      if (name.endsWith(".json"))
        lintJson(join(ROOT, CONTENT_JSON_DIR, name), findings);
    averageFindings(findings);
    expect(findings.map(format)).toEqual([]);
  });

  it("guides (REQ-011): every paragraph and list item, and the front matter's short answer and description (REQ-027 D-2711)", () => {
    const findings: Finding[] = [];
    AVERAGE_POPULATION.clear();
    for (const name of readdirSync(join(ROOT, GUIDES_DIR)))
      if (name.endsWith(".md"))
        lintMarkdown(join(ROOT, GUIDES_DIR, name), findings);
    averageFindings(findings);
    expect(findings.map(format)).toEqual([]);
  });
});

const GUIDES_DIR = "content/guides";

/** Markdown paragraphs (blank-line separated); headings, tables, code fences, placeholders and front matter are skipped; a list is linted item by item. */
function lintMarkdown(file: string, findings: Finding[]) {
  const rel = relative(ROOT, file);
  const whole = readFileSync(file, "utf8");
  // REQ-027 FR-1, D-2711 (finding 54): the front matter's short answer (its
  // " | "-separated lines) and description are customer text the page renders,
  // so they are linted and counted like the paragraphs.
  const front = /^---([\s\S]*?)\n---\n/.exec(whole)?.[1] ?? "";
  for (const key of ["shortAnswer", "description"]) {
    const m = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(front);
    if (!m) continue;
    const value = m[1].trim().replace(/^["']|["']$/g, "");
    for (const part of key === "shortAnswer" ? value.split(" | ") : [value]) {
      countSentences(rel, part);
      for (const v of lintText(part, { block: true }))
        findings.push({
          file: rel,
          where: `front matter ${key}`,
          violation: v,
        });
    }
  }
  const raw = whole.replace(/^---[\s\S]*?\n---\n/, "");
  const plain = (l: string) =>
    l
      .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
      .replace(/\*\*|__|`/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  let inFence = false;
  let n = 0;
  for (const block of raw.split(/\n\s*\n/)) {
    n += 1;
    const lines = block.split("\n").filter((l) => {
      if (/^\s*```/.test(l)) {
        inFence = !inFence;
        return false;
      }
      return !inFence;
    });
    const kept = lines.filter(
      (l) =>
        l.trim().length > 0 &&
        !/^\s*#/.test(l) &&
        !/^\s*\|/.test(l) &&
        !/^\s*\{\{/.test(l),
    );
    if (kept.length === 0) continue;
    const isList = kept.every((l) => /^\s*(?:[-*+]|\d+\.)\s+/.test(l));
    const items = isList ? kept.map(plain) : [kept.map(plain).join(" ")];
    // REQ-025 FR-10: a guide's paragraph is held to 45 words; its list items are not.
    for (const item of items) countSentences(rel, item);
    for (const item of items)
      for (const v of lintText(item, {
        block: true,
        maxWords: isList ? undefined : TIGHT_PARAGRAPH_MAX_WORDS,
      }))
        findings.push({ file: rel, where: `paragraph ${n}`, violation: v });
  }
}
