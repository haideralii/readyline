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
import { findProhibitedClaims } from "@/lib/claims";
import {
  GLOSSARY_ATTRIBUTION,
  GLOSSARY_BRACKET_TITLE,
} from "@/components/glossary-terms";
import {
  extractMarkdownText,
  extractModuleText,
  extractTsxText,
  formatGlossaryFinding,
  glossaryFindings,
  markdownGlossaryIds,
  meaningWays,
} from "./glossary-lint";
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
  // REQ-027 A2 (FR-3a, FR-3b): the result page's own copy, the legend and the tags (the "Next:" line went with REQ-028 D-2805).
  "src/app/start/_components/steps/result-copy.ts",
  // REQ-023 Session C: the renewal path's step titles, states, actions and the Commission's practice lines.
  "src/lib/path/renewal.ts",
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

// ---------------------------------------------------------------------------
// REQ-027 FR-2: glossary presence (D-2705, D-2710, D-2714, D-2715, D-2717,
// D-2720, D-2724). Every page in D-2710's named list must give the meaning
// of every glossary term it renders, its own text and the text of the copy
// modules and components rendered through it alike, by a helper, the shared
// component or a token; in A1 the pages that fail are allow-listed by name
// below and A2 empties that list page by page.
// ---------------------------------------------------------------------------

/** D-2710: the public pages, the questionnaire, the result page, the checklist and /path/adopt/[group]. */
const GLOSSARY_PAGES = [
  "src/app/page.tsx",
  "src/app/sample/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/guides/page.tsx",
  "src/app/guides/[slug]/page.tsx",
  "src/app/guides/registration-groups/page.tsx",
  "src/app/guides/registration-groups/[slug]/page.tsx",
  "src/app/start/page.tsx",
  "src/app/start/layout.tsx",
  "src/app/start/[step]/page.tsx",
  "src/app/start/_components/start-intro.tsx",
  "src/app/start/_components/step-page.tsx",
  "src/app/start/_components/step-shell.tsx",
  "src/app/start/_components/stepper.tsx",
  "src/app/start/_components/fields.tsx",
  "src/app/start/_components/questionnaire-provider.tsx",
  "src/app/start/_components/steps/business-step.tsx",
  "src/app/start/_components/steps/supports-step.tsx",
  "src/app/start/_components/steps/practices-step.tsx",
  "src/app/start/_components/steps/workforce-step.tsx",
  "src/app/start/_components/steps/existing-step.tsx",
  "src/app/start/_components/steps/result-step.tsx",
  "src/app/checklist/page.tsx",
  "src/app/checklist/checklist-view.tsx",
  "src/app/checklist/loading.tsx",
  "src/app/path/adopt/[group]/page.tsx",
  "src/app/path/adopt/adopt-button.tsx",
  "src/app/path/adopt/page.tsx",
];

/**
 * FR-2: a copy module or a component is checked through the one page that
 * renders it, so its terms are satisfied by that page's disclosure; a file
 * whose page is outside the list (Session C's pages, the legal pages' nav,
 * the documents pages) is named with `null` and not checked here;
 * `brand.ts`'s strings are the allow-listed constants and are exempt by
 * constant. The shared component carries no term of its own.
 */
const GLOSSARY_RENDERED_THROUGH: Record<string, string | null> = {
  "src/components/sample-document.tsx": "src/app/sample/page.tsx",
  "src/components/trust-blocks.tsx": "src/app/page.tsx",
  "src/app/guides/registration-groups/groups-search.tsx":
    "src/app/guides/registration-groups/page.tsx",
  "src/components/glossary-terms.tsx": null,
  // REQ-028 FR-1: the shell carries no words of its own, only the container every page shares.
  "src/components/page-shell.tsx": null,
  // REQ-028 FR-13: the tag, the disclosure and the header links render their callers' words only.
  "src/components/tag.tsx": null,
  "src/components/disclosure.tsx": null,
  "src/components/nav-links.tsx": null,
  // REQ-028 D-2813: the open-on-lg disclosure renders its caller's words only.
  "src/components/open-on-large.tsx": null,
  // REQ-028 FR-8: the register table renders the columns its callers name.
  "src/components/register-table.tsx": null,
  // REQ-022 Session B: the unsubscribe page is outside D-2710's list (no term of the glossary on it).
  "src/app/email/unsubscribe/[token]/page.tsx": null,
  // REQ-028 FR-11: the "Jump to" nav renders its callers' headings only.
  "src/components/jump-to.tsx": null,
  // REQ-028 FR-10 (D-2816): the pricing card renders the pricing page's words only.
  "src/app/pricing/pricing-card.tsx": "src/app/pricing/page.tsx",
  // REQ-023 FR-5: the period selector's words (the choices, the dates line) carry no glossary term.
  "src/components/period-selector.tsx": null,
  "src/lib/home-copy.ts": "src/app/page.tsx",
  "src/lib/brand.ts": null,
  "src/lib/checklist/derive.ts": "src/app/checklist/checklist-view.tsx",
  "src/lib/checklist/state.ts": "src/app/checklist/checklist-view.tsx",
  "src/lib/questionnaire/navigation.ts": "src/app/start/[step]/page.tsx",
  // REQ-027 A2 (D-2267): the schema's two messages with a term ("Choose a registration group from
  // the list", "Enter the number of key personnel") render inside the supports and workforce
  // steps, each of which carries that term's disclosure; the render check proves them there.
  "src/lib/questionnaire/schema.ts": null,
  "src/lib/questionnaire/result.ts":
    "src/app/start/_components/steps/result-step.tsx",
  "src/lib/legal/nav.ts": null,
  "src/lib/payments/copy.ts": "src/app/pricing/page.tsx",
  "src/lib/payments/documents-copy.ts": null,
  "src/server/payments/messages.ts": null,
  "src/lib/generation/writing-state.ts": null,
  "src/lib/path/next-step.ts": "src/app/checklist/checklist-view.tsx",
  "src/app/start/_components/steps/practices-copy.ts":
    "src/app/start/_components/steps/practices-step.tsx",
  "src/app/start/_components/steps/result-copy.ts":
    "src/app/start/_components/steps/result-step.tsx",
  // REQ-023 Session C: rendered on the signed-in renewal path, outside D-2710's list.
  "src/lib/path/renewal.ts": null,
};

/**
 * D-2710: every other file the copy lint walks is outside FR-2's list and
 * is named here (by prefix for the signed-in areas, by name for the rest),
 * the signed-in pages the decision lists as Session C (`/registers`,
 * `/path/audit-day`, `/documents/[setId]`, `cost-calculator.tsx`) among
 * them; the legal wrappers are skipped by prefix (finding 69); the REQ-017
 * strip is outside the render check too (finding 49). A new file is either
 * added to the list above or named here, so the lint never passes a file it
 * did not consider.
 */
const GLOSSARY_OUTSIDE_LIST_PREFIXES = [
  "src/app/(legal)/",
  "src/app/account/",
  "src/app/admin/",
  "src/app/auditor/",
  "src/app/dev/",
  "src/app/documents/",
  "src/app/invite/",
  "src/app/path/audit-day/",
  "src/app/path/before-you-buy/",
  // REQ-023 Session C: the renewal path is signed-in, outside D-2710's list like audit day.
  "src/app/path/renewal/",
  "src/app/registers/",
  "src/app/report/",
  "src/app/sign-in/",
  "src/app/worker/",
];
const GLOSSARY_OUTSIDE_LIST = [
  "src/app/layout.tsx",
  "src/app/not-found.tsx",
  "src/app/guides/[slug]/cost-calculator.tsx",
  "src/components/confirm-button.tsx",
  "src/components/data-table.tsx",
  "src/components/json-ld.tsx",
  "src/components/legal-article.tsx",
  "src/components/next-step-strip.tsx",
  "src/components/ready-line.tsx",
  "src/components/route-progress.tsx",
  "src/components/site-footer.tsx",
  "src/components/site-header.tsx",
  "src/components/wordmark.tsx",
  "src/components/writing-indicator.tsx",
];

/** D-2705: ids the check skips while a meaning is marked to verify; empty at A1's PR and kept as the mechanism. */
const VERIFY_TERMS: string[] = [];

/**
 * D-2710, D-2717: the pages and guides FR-2 fails at A1's starting SHA,
 * allow-listed by name; A2 gives each its disclosure or bracket and removes
 * it here, so the list is empty at A2's PR. A file in this list must still
 * fail, so one A2 has fixed leaves the list in the same change.
 */
const A1_FAILING_PAGES: string[] = [
  // A1's run at next a9cd6cf listed fourteen pages and the four guides here (REQ-027's Delivery
  // evidence holds that list); A2 gave each its disclosure or bracket and the list is empty, as
  // D-2717 asks. A page added here again must still fail, so the mechanism stays.
];

function relOf(file: string): string {
  return relative(ROOT, file).replace(/\\/g, "/");
}

function sourceOf(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

/** A page's customer text: its own and the text of every module and component rendered through it. */
function pagePieces(page: string) {
  const pieces = extractTsxText(sourceOf(page), page).map((p) => ({
    ...p,
    file: page,
  }));
  for (const [file, through] of Object.entries(GLOSSARY_RENDERED_THROUGH)) {
    if (through !== page) continue;
    const extracted = file.endsWith(".tsx")
      ? extractTsxText(sourceOf(file), file)
      : extractModuleText(sourceOf(file), file).filter(
          (p) => !ALLOWED_CONSTANTS.has(p.text),
        );
    pieces.push(...extracted.map((p) => ({ ...p, file })));
  }
  return pieces;
}

/** The ways a meaning reaches a page: its own and those of the files rendered through it. */
function pageWays(page: string) {
  const own = meaningWays(sourceOf(page), page);
  const ids = new Set(own.ids);
  let computed = own.computed === true;
  for (const [file, through] of Object.entries(GLOSSARY_RENDERED_THROUGH))
    if (through === page) {
      const w = meaningWays(sourceOf(file), file);
      for (const id of w.ids) ids.add(id);
      if (w.computed) computed = true;
    }
  // D-2267: a list computed at render, on the page or in a module rendered through it, flags the page.
  return { ids, tokens: [] as string[], computed };
}

describe("glossary presence (REQ-027 FR-2)", () => {
  it("every file the copy lint walks is in D-2710's list, rendered through a page in it, or named outside it", () => {
    const walked = ["src/app", "src/components"].flatMap((d) =>
      walkDir(join(ROOT, d)).map(relOf),
    );
    const unplaced = walked.filter(
      (f) =>
        !GLOSSARY_PAGES.includes(f) &&
        !(f in GLOSSARY_RENDERED_THROUGH) &&
        !GLOSSARY_OUTSIDE_LIST.includes(f) &&
        !GLOSSARY_OUTSIDE_LIST_PREFIXES.some((p) => f.startsWith(p)),
    );
    expect(unplaced).toEqual([]);
    for (const f of [...GLOSSARY_PAGES, ...GLOSSARY_OUTSIDE_LIST])
      expect(walked, f).toContain(f);
    // Every copy module the lint walks is mapped, and every mapping lands on a page in the list.
    for (const m of [...COPY_MODULES, "src/lib/path/next-step.ts"])
      expect(Object.keys(GLOSSARY_RENDERED_THROUGH), m).toContain(m);
    for (const [file, through] of Object.entries(GLOSSARY_RENDERED_THROUGH))
      if (through !== null) expect(GLOSSARY_PAGES, file).toContain(through);
    for (const f of A1_FAILING_PAGES)
      expect([...GLOSSARY_PAGES, ...guideFiles()], f).toContain(f);
  });

  it("every page in the list gives the meaning of every term it renders, except the pages A1 allow-lists by name, which still fail", () => {
    const open: string[] = [];
    const allowListed: string[] = [];
    const passingAllowListed: string[] = [];
    for (const page of GLOSSARY_PAGES) {
      const findings = glossaryFindings(pagePieces(page), pageWays(page), {
        skip: VERIFY_TERMS,
      });
      const lines = findings.map((f) => formatGlossaryFinding(page, f));
      if (A1_FAILING_PAGES.includes(page)) {
        if (lines.length === 0) passingAllowListed.push(page);
        allowListed.push(...lines);
      } else open.push(...lines);
    }
    // The evidence item "files FR-2 failed at A1's starting SHA", as the allow-list holds it.
    for (const line of allowListed) console.log(`FR-2 allow-listed: ${line}`);
    expect(open).toEqual([]);
    expect(passingAllowListed, "allow-listed pages that now pass").toEqual([]);
  });

  it("every guide gives the meaning of every term it uses through its front-matter list or a token, except the guides A1 allow-lists", () => {
    const open: string[] = [];
    const passingAllowListed: string[] = [];
    for (const file of guideFiles()) {
      const source = sourceOf(file);
      const findings = glossaryFindings(
        extractMarkdownText(source),
        { ids: new Set(markdownGlossaryIds(source)), tokens: [] },
        { skip: VERIFY_TERMS },
      );
      const lines = findings.map((f) => formatGlossaryFinding(file, f));
      if (A1_FAILING_PAGES.includes(file)) {
        if (lines.length === 0) passingAllowListed.push(file);
        for (const line of lines) console.log(`FR-2 allow-listed: ${line}`);
      } else open.push(...lines);
    }
    expect(open).toEqual([]);
    expect(passingAllowListed, "allow-listed guides that now pass").toEqual([]);
  });

  // AC-2's fixtures: each proved to fail or pass on a string, before the real files.
  it("fails a page that uses a term and gives no meaning, naming the term and the line, and passes with each way", () => {
    const at = "src/app/x/page.tsx";
    const src = `export function P() {\n  return (\n    <main>\n      <p>Your module list.</p>\n    </main>\n  );\n}\n`;
    expect(
      glossaryFindings(extractTsxText(src, at), meaningWays(src, at)),
    ).toEqual([
      {
        kind: "term",
        id: "module",
        line: 4,
        text: "Your module list.",
        file: undefined,
      },
    ]);
    for (const way of [
      '<p>{glossarySentence("module")}</p>',
      '<GlossaryTerms ids={["module"]} where="page" />',
      '<GlossaryBracket id="module" />',
    ]) {
      const ok = src.replace("</main>", `${way}</main>`);
      expect(
        glossaryFindings(extractTsxText(ok, at), meaningWays(ok, at)),
        way,
      ).toEqual([]);
    }
    const viaConst = `const IDS = ["module", "adopt"] as const;\nexport function P() {\n  return <main><p>Adopt each module.</p><GlossaryTerms ids={IDS} where="page" /></main>;\n}\n`;
    expect(
      glossaryFindings(extractTsxText(viaConst, at), meaningWays(viaConst, at)),
    ).toEqual([]);
    // REQ-027 A2 (D-2267): a list the page computes at render is a way the AST cannot name; the
    // render check is that page's proof, and the lint takes every term present as reached, a
    // token still failing on two terms.
    const computed = `export function P({ names }: { names: string[] }) {\n  const present = findGlossaryTerms(names.join(" "));\n  return <main><p>Adopt each module.</p><GlossaryTerms ids={present} where="page" /></main>;\n}\n`;
    expect(meaningWays(computed, at).computed).toBe(true);
    expect(
      glossaryFindings(extractTsxText(computed, at), meaningWays(computed, at)),
    ).toEqual([]);
    const computedToken = computed.replace(
      "Adopt each module.",
      'Adopt each module. {"{{glossary:module}}"}',
    );
    expect(
      glossaryFindings(
        extractTsxText(computedToken, at),
        meaningWays(computedToken, at),
      ).map((x) => x.kind),
    ).toEqual(["token"]);
    expect(meaningWays(viaConst, at).computed).toBe(false);
    // A template literal ending in -audit reaches both audit terms (finding 48).
    const audits = `export function P({ kind }: { kind: string }) {\n  return <main><p>A verification audit or a certification audit.</p><p>{glossarySentence(\`\${kind}-audit\`)}</p></main>;\n}\n`;
    expect(
      glossaryFindings(extractTsxText(audits, at), meaningWays(audits, at)),
    ).toEqual([]);
  });

  it("skips a VERIFY term, fails a token on a two-term page, and lets a one-term page's meaning hold another term (D-2705, D-2714, D-2715)", () => {
    const at = "src/app/x/page.tsx";
    const verify = `export function P() {\n  return <main><p>Your module list.</p></main>;\n}\n`;
    expect(
      glossaryFindings(extractTsxText(verify, at), meaningWays(verify, at), {
        skip: ["module"],
      }),
    ).toEqual([]);
    const twoTerms = `export function P() {\n  return <main><p>Adopt each module. {"{{glossary:module}}"}</p></main>;\n}\n`;
    const f = glossaryFindings(
      extractTsxText(twoTerms, at),
      meaningWays(twoTerms, at),
    );
    expect(f.map((x) => `${x.kind}:${x.id}`)).toEqual([
      "term:adopt",
      "token:module",
    ]);
    // One term, the module, whose bracket meaning holds "Practice Standards", and the term again outside the bracket.
    const oneTerm = `export function P() {\n  return <main><p>Each <GlossaryBracket id="module" /> is listed. A module can be long.</p></main>;\n}\n`;
    expect(
      glossaryFindings(extractTsxText(oneTerm, at), meaningWays(oneTerm, at)),
    ).toEqual([]);
    const brackets = extractMarkdownText(
      "---\nslug: x\n---\n\nEach module (a group of the Practice Standards rules on one topic) is listed. A module can be long.\n",
    );
    expect(
      glossaryFindings(brackets, { ids: new Set(), tokens: [] }).map(
        (x) => x.id,
      ),
    ).toEqual(["module"]);
    expect(
      glossaryFindings(brackets, { ids: new Set(["module"]), tokens: [] }),
    ).toEqual([]);
    // A guide's token is its own way on a one-term guide, and a finding on a two-term one.
    const tokenGuide = extractMarkdownText(
      "---\nslug: x\n---\n\nA {{glossary:mid-term-audit}} follows.\n",
    );
    expect(
      glossaryFindings(tokenGuide, { ids: new Set(), tokens: [] }),
    ).toEqual([]);
  });

  it("reads a term in a legend prop, an options entry and a step file's top-level const, skips a const of ids, and applies the exclusions and the clearance forms (D-2720; decisions 3 and 4)", () => {
    const at = "src/app/start/_components/steps/x-step.tsx";
    const legend = `export function S() {\n  return <form><RadioGroup legend="Who are your key personnel?" options={[{ value: "a", label: "Yes" }]} /></form>;\n}\n`;
    expect(
      glossaryFindings(extractTsxText(legend, at), meaningWays(legend, at)),
    ).toEqual([
      {
        kind: "term",
        id: "key-personnel",
        line: 2,
        text: "Who are your key personnel?",
        file: undefined,
      },
    ]);
    const options = `export function S() {\n  return <form><RadioGroup legend="Which?" options={[{ value: "a", label: "A reportable incident" }]} /></form>;\n}\n`;
    expect(
      glossaryFindings(
        extractTsxText(options, at),
        meaningWays(options, at),
      ).map((f) => f.id),
    ).toEqual(["reportable-incident"]);
    const consts = `const LABELS = { a: "Number of key personnel" };\nconst IDS = ["module", "adopt"];\nexport function S() {\n  return <form />;\n}\n`;
    expect(
      glossaryFindings(extractTsxText(consts, at), meaningWays(consts, at)).map(
        (f) => f.id,
      ),
    ).toEqual(["key-personnel"]);
    // Outside the steps' folder a const is not page text.
    expect(
      glossaryFindings(
        extractTsxText(consts, "src/app/x/page.tsx"),
        meaningWays(consts, "src/app/x/page.tsx"),
      ),
    ).toEqual([]);
    const orientation = `export function S() {\n  return <p>Evidence of the NDIS Worker Orientation Module and the Commission's orientation module.</p>;\n}\n`;
    expect(
      glossaryFindings(
        extractTsxText(orientation, at),
        meaningWays(orientation, at),
      ),
    ).toEqual([]);
    const clearance = `export function S() {\n  return <p>Hold a current NDIS Worker Screening clearance. Worker screening clearance register.</p>;\n}\n`;
    expect(
      glossaryFindings(
        extractTsxText(clearance, at),
        meaningWays(clearance, at),
      ).map((f) => f.id),
    ).toEqual(["worker-screening-check"]);
  });

  it("the disclosure's fixed lines and the bracket's title pass the claims lint (D-2706, D-2719; finding 107)", () => {
    for (const line of [
      ...Object.values(GLOSSARY_ATTRIBUTION),
      GLOSSARY_BRACKET_TITLE,
    ]) {
      expect(findProhibitedClaims(line), line).toEqual([]);
      expect(lintText(line), line).toEqual([]);
    }
  });
});

function guideFiles(): string[] {
  return readdirSync(join(ROOT, GUIDES_DIR))
    .filter((n) => n.endsWith(".md"))
    .map((n) => `${GUIDES_DIR}/${n}`);
}
