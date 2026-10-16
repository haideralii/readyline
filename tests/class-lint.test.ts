// @vitest-environment node
/**
 * REQ-028 FR-1 and FR-2 (D-2802): after Session A1 no page under `src/app`
 * carries its own width (the widths live in `PageShell`, `max-w-6xl`, and on
 * prose, `max-w-prose`) and no file under `src/` names a zinc or white
 * utility (the colours live in the tokens: ink, slate, paper, surface, mist,
 * sky, rule, line, track, the washes). Allow-list zero: a new site fails
 * here, in CI, with the file, the line and the class.
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

/** FR-1's forbidden set under `src/app`, with any variant prefix. */
const WIDTH =
  /(?<![w-])(?:[a-z-]+:)?max-w-(?:md|lg|xl|2xl|3xl|4xl|5xl)(?![w-])/g;

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

describe("the class lint (REQ-028 FR-1, FR-2; D-2802)", () => {
  it("no zinc or white utility under src/ (the tokens carry every colour)", () => {
    expect(findings(walkDir("src"), COLOUR)).toEqual([]);
  });

  it("no page width under src/app but the shell's and prose's", () => {
    expect(findings(walkDir("src/app"), WIDTH)).toEqual([]);
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
    expect([...sample[1].matchAll(WIDTH)]).toEqual([]);
    expect(
      [...'className="mx-auto max-w-2xl sm:max-w-3xl"'.matchAll(WIDTH)].map(
        (m) => m[0],
      ),
    ).toEqual(["max-w-2xl", "sm:max-w-3xl"]);
  });
});
