// @vitest-environment node
/**
 * REQ-028 FR-2 (D-2802): after Session A1 no file under `src/` names a zinc
 * or white utility; the colours live in the tokens (ink, slate, paper,
 * surface, mist, sky, rule, line, track, the washes). Allow-list zero: a new
 * site fails here, in CI, with the file, the line and the class. FR-1's
 * width rule joins this file with the shell.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walkDir(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkDir(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Every zinc or white utility, with its variant prefix, e.g. `dark:text-zinc-400`, `hover:bg-zinc-50`, `bg-white`. */
const COLOUR =
  /[A-Za-z0-9:\-[\]()=&>*_.%/]*?(?:(?:text|bg|border|divide|ring|outline|placeholder|fill|stroke|decoration|from|to|via)-zinc-\d{2,3}|(?<![\w-])(?:bg|text)-white)(?![\w-])/g;

function findings(files: string[], re: RegExp): string[] {
  const out: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(re))
        out.push(`${file.replace(/\\/g, "/")}:${i + 1} ${m[0]}`);
    });
  }
  return out;
}

describe("the class lint (REQ-028 FR-2; D-2802)", () => {
  it("no zinc or white utility under src/ (the tokens carry every colour)", () => {
    expect(findings(walkDir("src"), COLOUR)).toEqual([]);
  });

  it("the pattern sees what it is for", () => {
    const sample = [
      'className="text-zinc-600 dark:text-zinc-400 bg-white hover:bg-zinc-50 border-zinc-300"',
      'className="text-ink bg-surface border-rule max-w-6xl max-w-prose"',
    ];
    expect([...sample[0].matchAll(COLOUR)].map((m) => m[0])).toEqual([
      "text-zinc-600",
      "dark:text-zinc-400",
      "bg-white",
      "hover:bg-zinc-50",
      "border-zinc-300",
    ]);
    expect([...sample[1].matchAll(COLOUR)]).toEqual([]);
  });
});
