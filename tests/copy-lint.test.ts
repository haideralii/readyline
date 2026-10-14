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
import { lintText, type CopyViolation } from "@/lib/copy-lint/rules";

const ROOT = process.cwd();

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
      if (BLOCK_TAGS.has(tag)) {
        const text = inlineText(node.children, sf);
        for (const v of lintText(text, { block: true }))
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
      for (const v of lintText(text, { block: true }))
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

describe("customer-facing copy (REQ-015 FR-2)", () => {
  it("pages and components: no paragraph over 60 words, sentence over 35, banned word or internal path", () => {
    const findings: Finding[] = [];
    for (const dir of ["src/app", "src/components"])
      for (const f of walkDir(join(ROOT, dir))) lintTsx(f, findings);
    expect(findings.map(format)).toEqual([]);
  });

  it("copy modules", () => {
    const findings: Finding[] = [];
    for (const f of COPY_MODULES) lintCopyModule(join(ROOT, f), findings);
    expect(findings.map(format)).toEqual([]);
  });

  it("content JSON the UI renders", () => {
    const findings: Finding[] = [];
    for (const name of readdirSync(join(ROOT, CONTENT_JSON_DIR)))
      if (name.endsWith(".json"))
        lintJson(join(ROOT, CONTENT_JSON_DIR, name), findings);
    expect(findings.map(format)).toEqual([]);
  });

  it("guides (REQ-011): every paragraph and list item", () => {
    const findings: Finding[] = [];
    for (const name of readdirSync(join(ROOT, GUIDES_DIR)))
      if (name.endsWith(".md"))
        lintMarkdown(join(ROOT, GUIDES_DIR, name), findings);
    expect(findings.map(format)).toEqual([]);
  });
});

const GUIDES_DIR = "content/guides";

/** Markdown paragraphs (blank-line separated); headings, tables, code fences, placeholders and front matter are skipped; a list is linted item by item. */
function lintMarkdown(file: string, findings: Finding[]) {
  const rel = relative(ROOT, file);
  const raw = readFileSync(file, "utf8").replace(/^---[\s\S]*?\n---\n/, "");
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
    for (const item of items)
      for (const v of lintText(item, { block: true }))
        findings.push({ file: rel, where: `paragraph ${n}`, violation: v });
  }
}
