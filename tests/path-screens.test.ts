/**
 * REQ-017 FR-5, the one-button rule: no screen on the guided path has more
 * than one primary button, one h1, or more than three lines of text above
 * the control. Read from the source of the path pages and the finish form
 * with the TypeScript compiler, like the copy lint: the count of
 * `btn-primary` classes and `<h1>` elements per rendered branch, and the
 * paragraphs that precede the first control. A conditional renders one arm
 * at a time and a component with several `return` statements renders one
 * of them, so the larger branch is measured, never the sum. Runs in
 * `npm test`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PATH_FILES = [
  ...walk(join(ROOT, "src/app/path")),
  join(ROOT, "src/app/documents/[setId]/finish/page.tsx"),
  join(ROOT, "src/app/documents/[setId]/finish/finish-form.tsx"),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

type Counts = { primary: number; h1: number; textAboveControl: number };
const ZERO: Counts = { primary: 0, h1: 0, textAboveControl: 0 };
const add = (a: Counts, b: Counts): Counts => ({
  primary: a.primary + b.primary,
  h1: a.h1 + b.h1,
  textAboveControl: a.textAboveControl + b.textAboveControl,
});
const max = (a: Counts, b: Counts): Counts => ({
  primary: Math.max(a.primary, b.primary),
  h1: Math.max(a.h1, b.h1),
  textAboveControl: Math.max(a.textAboveControl, b.textAboveControl),
});

/** Counts for one rendered branch of a node. */
function branch(node: ts.Node): Counts {
  let own = ZERO;
  let returns = ZERO;
  let seenControl = false;
  const visit = (n: ts.Node) => {
    if (ts.isConditionalExpression(n)) {
      own = add(own, max(branch(n.whenTrue), branch(n.whenFalse)));
      return;
    }
    if (ts.isReturnStatement(n) && n.expression) {
      returns = max(returns, branch(n.expression));
      return;
    }
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const open = ts.isJsxElement(n) ? n.openingElement : n;
      const tag = open.tagName.getText();
      const attrs = open.attributes.getText();
      const primary =
        /btn-primary/.test(attrs) ||
        tag === "BuyButton" ||
        tag === "AdoptButton";
      const isControl =
        primary || tag === "form" || tag === "FinishForm" || tag === "input";
      if (primary) own = add(own, { ...ZERO, primary: 1 });
      if (tag === "h1") own = add(own, { ...ZERO, h1: 1 });
      if (tag === "p" && !seenControl && !/print:hidden|text-sm/.test(attrs))
        own = add(own, { ...ZERO, textAboveControl: 1 });
      if (isControl) seenControl = true;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return add(own, returns);
}

function count(file: string): Counts {
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  return branch(sf);
}

describe("the guided path's screens (REQ-017 FR-5)", () => {
  for (const file of PATH_FILES) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    it(`${rel}: one primary button, one heading, at most three lines above the control`, () => {
      const c = count(file);
      expect(c.primary, "primary buttons").toBeLessThanOrEqual(1);
      expect(c.h1, "h1 elements").toBeLessThanOrEqual(1);
      expect(
        c.textAboveControl,
        "paragraphs above the control",
      ).toBeLessThanOrEqual(3);
    });
  }
});
