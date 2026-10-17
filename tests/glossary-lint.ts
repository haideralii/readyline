/**
 * REQ-027 FR-2 (D-2705, D-2710, D-2714, D-2715, D-2720, D-2724): the
 * glossary-presence check over source files, run by tests/copy-lint.test.ts.
 * It extracts the customer text a file renders (never the raw source, so
 * imports, comments and id arrays do not match), finds the glossary terms in
 * it, reads from the AST the ways a meaning reaches the page, and reports
 * each term whose meaning does not. Pure over a source string, so the
 * fixtures in the test are strings too.
 */
import ts from "typescript";
import {
  AUDIT_IDS,
  findGlossaryTerms,
  glossaryTokens,
  stripGlossaryBrackets,
} from "@/lib/copy-lint/glossary";

/** One piece of customer text with its line and, when it comes from a file rendered through a page, that file. */
export type TextPiece = { text: string; line: number; file?: string };

export type GlossaryFinding =
  | { kind: "term"; id: string; line: number; text: string; file?: string }
  | { kind: "token"; id: string; line: number; text: string; file?: string };

/** The ways a meaning reaches a page, read from the AST (FR-2). */
export type MeaningWays = {
  ids: Set<string>;
  tokens: string[];
  /**
   * REQ-027 A2 (D-2267): the page renders `<GlossaryTerms ids={...}>` with a
   * list computed at render from the strings it is about to show (the
   * result page, the registration-group pages), so the AST cannot name the
   * ids; the render check (`glossaryOnPage`) is the proof for such a page,
   * and the lint takes every term present as reached.
   */
  computed?: boolean;
};

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
/** The copy rules' attributes (tests/copy-lint.test.ts) plus D-2720's wider list for the term match. */
const TEXT_ATTRIBUTES = new Set([
  "placeholder",
  "aria-label",
  "title",
  "alt",
  "aria-description",
]);
const TERM_PROPS = new Set([
  "legend",
  "help",
  "label",
  "summary",
  "placeholder",
]);
/** D-2720: the files whose top-level `const` string literals are page text (the steps' LABELS and option arrays). */
export const CONST_TEXT_PREFIX = "src/app/start/_components/";
/** The helpers that put a meaning on the page by id (FR-2). */
const WAYS = new Set([
  "glossarySentence",
  "glossaryMeaning",
  "glossaryBracket",
]);

function decode(s: string): string {
  return s
    .replace(/&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\{"\s*"\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagName(node: ts.JsxOpeningLikeElement | ts.JsxSelfClosingElement) {
  return node.tagName.getText();
}

function literalText(e: ts.Node): string | null {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))
    return e.text;
  if (ts.isTemplateExpression(e))
    return [
      e.head.text,
      ...e.templateSpans.map((s) => ` ${s.literal.text}`),
    ].join("");
  return null;
}

/** Static strings inside a JSX expression: literals, template parts, both arms of a conditional, nested JSX. */
function expressionText(e: ts.Expression, sf: ts.SourceFile): string {
  const lit = literalText(e);
  if (lit !== null) return lit;
  if (ts.isConditionalExpression(e))
    return `${expressionText(e.whenTrue, sf)} ${expressionText(e.whenFalse, sf)}`;
  if (ts.isParenthesizedExpression(e)) return expressionText(e.expression, sf);
  if (
    ts.isBinaryExpression(e) &&
    (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      e.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  )
    return `${expressionText(e.left, sf)} ${expressionText(e.right, sf)}`;
  if (ts.isJsxElement(e)) return inlineText(e.children, sf);
  if (ts.isJsxFragment(e)) return inlineText(e.children, sf);
  return "";
}

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
      if (INLINE_TAGS.has(tagName(c.openingElement)))
        text += ` ${inlineText(c.children, sf)}`;
    } else if (ts.isJsxSelfClosingElement(c) && tagName(c) === "br")
      text += " ";
  }
  return decode(text);
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** The string literals an `options` prop's object entries hold under `label` and `help` (D-2720). */
function optionTexts(e: ts.Expression): string[] {
  const out: string[] = [];
  if (!ts.isArrayLiteralExpression(e)) return out;
  for (const el of e.elements)
    if (ts.isObjectLiteralExpression(el))
      for (const p of el.properties)
        if (
          ts.isPropertyAssignment(p) &&
          ts.isIdentifier(p.name) &&
          (p.name.text === "label" || p.name.text === "help")
        ) {
          const t = literalText(p.initializer);
          if (t) out.push(t);
        }
  return out;
}

/**
 * The customer text of a `.tsx` file for the term match (D-2720): every
 * JSX element's own text (block or loose), the copy rules' text attributes,
 * the `legend`, `help`, `label`, `summary` and `placeholder` props, the
 * `label` and `help` entries of an `options` array prop, and, for a file
 * under `src/app/start/_components/`, the string literals inside its
 * top-level `const` declarations that contain whitespace (ids, slugs, keys
 * and class tokens drop out).
 */
export function extractTsxText(source: string, rel: string): TextPiece[] {
  const sf = ts.createSourceFile(
    rel,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const pieces: TextPiece[] = [];
  const push = (text: string, node: ts.Node) => {
    const clean = decode(text);
    if (clean) pieces.push({ text: clean, line: lineOf(sf, node) });
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) push(inlineText(node.children, sf), node);
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText();
      const init = node.initializer;
      if (TEXT_ATTRIBUTES.has(name) || TERM_PROPS.has(name)) {
        const text = ts.isStringLiteral(init)
          ? init.text
          : ts.isJsxExpression(init) && init.expression
            ? expressionText(init.expression, sf)
            : "";
        push(text, node);
      } else if (
        name === "options" &&
        ts.isJsxExpression(init) &&
        init.expression
      ) {
        for (const t of optionTexts(init.expression)) push(t, node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (rel.replace(/\\/g, "/").startsWith(CONST_TEXT_PREFIX))
    for (const st of sf.statements)
      if (ts.isVariableStatement(st)) {
        const literals = (n: ts.Node) => {
          const t = literalText(n);
          if (t !== null && /\s/.test(t.trim())) push(t, n);
          else if (t === null) ts.forEachChild(n, literals);
        };
        for (const d of st.declarationList.declarations)
          if (d.initializer) literals(d.initializer);
      }
  return pieces;
}

/** A copy module's natural-language strings of three words or more, with their lines. */
export function extractModuleText(source: string, rel: string): TextPiece[] {
  const sf = ts.createSourceFile(
    rel,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const pieces: TextPiece[] = [];
  const visit = (node: ts.Node) => {
    const t = literalText(node);
    if (t !== null && t.trim().split(/\s+/).length >= 3)
      pieces.push({ text: decode(t), line: lineOf(sf, node) });
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return pieces;
}

/**
 * A guide's customer text: the front matter's short answer and description,
 * then the body's paragraphs and list items up to the Sources section;
 * headings, tables, code fences and the sources list are not page text the
 * lint reads (FR-2, finding 69). Tokens stay in the text for the token rule.
 */
export function extractMarkdownText(source: string): TextPiece[] {
  const pieces: TextPiece[] = [];
  const lines = source.split("\n");
  let i = 0;
  if (lines[0]?.trim() === "---") {
    for (i = 1; i < lines.length && lines[i].trim() !== "---"; i++) {
      const m = /^(shortAnswer|description):\s*(.*)$/.exec(lines[i]);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      for (const part of m[1] === "shortAnswer" ? value.split(" | ") : [value])
        pieces.push({ text: part.trim(), line: i + 1 });
    }
    i += 1;
  }
  let inFence = false;
  let paragraph: string[] = [];
  let start = 0;
  const flush = () => {
    if (paragraph.length) {
      const text = paragraph
        .map((l) =>
          l
            .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
            .replace(/\*\*|__|`/g, "")
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
        )
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) pieces.push({ text, line: start });
    }
    paragraph = [];
  };
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*```/.test(l)) {
      inFence = !inFence;
      flush();
      continue;
    }
    if (inFence) continue;
    if (/^##\s+Sources\s*$/.test(l)) {
      flush();
      break;
    }
    if (!l.trim() || /^\s*#/.test(l) || /^\s*\|/.test(l)) {
      flush();
      continue;
    }
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(l)) {
      flush();
      paragraph = [l];
      start = i + 1;
      flush();
      continue;
    }
    if (!paragraph.length) start = i + 1;
    paragraph.push(l);
  }
  flush();
  return pieces;
}

/** A guide's front-matter `glossary: [a, b]` list (D-2715): the ids its disclosure carries. */
export function markdownGlossaryIds(source: string): string[] {
  const m = /^glossary:\s*\[([^\]]*)\]/m.exec(source);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/**
 * The ways a meaning reaches a `.tsx` or `.ts` file, read from the AST:
 * `glossarySentence("id")`, `glossaryMeaning("id")`, `glossaryBracket("id")`
 * (a template literal ending in `-audit` reaches both audit ids, finding 48),
 * `<GlossaryTerms ids={[...]} />` or `ids={CONST}` with the const resolved
 * to its string literals, and `<GlossaryBracket id="..." />`.
 */
export function meaningWays(source: string, rel: string): MeaningWays {
  const sf = ts.createSourceFile(
    rel,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const ids = new Set<string>();
  let computed = false;
  const consts = new Map<string, string[]>();
  for (const st of sf.statements)
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name) && d.initializer) {
          let init: ts.Expression = d.initializer;
          while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init))
            init = init.expression;
          if (ts.isArrayLiteralExpression(init))
            consts.set(
              d.name.text,
              init.elements
                .map((e) => literalText(e))
                .filter((x): x is string => x !== null),
            );
        }
  const idsFrom = (e: ts.Expression) => {
    let init: ts.Expression = e;
    while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init))
      init = init.expression;
    if (ts.isArrayLiteralExpression(init))
      for (const el of init.elements) {
        const t = literalText(el);
        if (t) ids.add(t);
      }
    else if (ts.isIdentifier(init) && consts.has(init.text))
      for (const t of consts.get(init.text) ?? []) ids.add(t);
    // D-2267: a list the page computes at render (a call, a local variable
    // of the component, a member access): the render check is the proof.
    else computed = true;
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      WAYS.has(node.expression.text)
    ) {
      const arg = node.arguments[0];
      if (arg) {
        if (ts.isTemplateExpression(arg)) {
          // `${kind}-audit` reaches both audit terms (finding 48).
          if (arg.templateSpans.at(-1)?.literal.text.endsWith("-audit"))
            for (const a of AUDIT_IDS) ids.add(a);
        } else {
          const t = literalText(arg);
          if (t) ids.add(t);
        }
      }
    }
    if (ts.isJsxOpeningLikeElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      for (const attr of node.attributes.properties)
        if (ts.isJsxAttribute(attr) && attr.initializer) {
          const name = attr.name.getText();
          const init = attr.initializer;
          if (
            tag === "GlossaryTerms" &&
            name === "ids" &&
            ts.isJsxExpression(init) &&
            init.expression
          )
            idsFrom(init.expression);
          if (tag === "GlossaryBracket" && name === "id") {
            const t = ts.isStringLiteral(init)
              ? init.text
              : ts.isJsxExpression(init) && init.expression
                ? literalText(init.expression)
                : null;
            if (t) ids.add(t);
          }
        }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { ids, tokens: [], computed };
}

/**
 * FR-2 over one file's pieces: the terms present (after the bracket
 * stripping, D-2714), each one whose meaning reaches the page by none of
 * the ways is a finding naming the term and the line; a token on a page
 * with two or more terms present is a finding naming the token (D-2715).
 */
export function glossaryFindings(
  pieces: readonly TextPiece[],
  ways: MeaningWays,
  options: { skip?: readonly string[] } = {},
): GlossaryFinding[] {
  const out: GlossaryFinding[] = [];
  const whole = pieces.map((p) => p.text).join("\n");
  const present = findGlossaryTerms(stripGlossaryBrackets(whole), options);
  const tokens = [...ways.tokens, ...glossaryTokens(whole)];
  const satisfied = new Set([...ways.ids, ...tokens]);
  for (const id of present) {
    if (satisfied.has(id) || ways.computed) continue;
    const piece = pieces.find((p) =>
      findGlossaryTerms(stripGlossaryBrackets(p.text), options).includes(id),
    );
    out.push({
      kind: "term",
      id,
      line: piece?.line ?? 0,
      text: piece?.text ?? "",
      file: piece?.file,
    });
  }
  if (present.length >= 2)
    for (const id of tokens) {
      const piece = pieces.find((p) => glossaryTokens(p.text).includes(id));
      if (piece)
        out.push({
          kind: "token",
          id,
          line: piece.line,
          text: piece.text,
          file: piece.file,
        });
    }
  return out;
}

/** The findings as one line each: the file (the piece's own when it was rendered through the page), the line, the term or the token, and the text. */
export function formatGlossaryFinding(
  file: string,
  f: GlossaryFinding,
): string {
  const at = `${f.file ?? file}:${f.line}`;
  return f.kind === "term"
    ? `${at} uses "${f.id}" and gives no meaning: "${f.text.slice(0, 70)}"`
    : `${at} carries a {{glossary:${f.id}}} token on a page with two or more terms: "${f.text.slice(0, 70)}"`;
}
