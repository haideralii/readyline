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

  // REQ-028 FR-14 (D-2274): inside a card 16 px, one padding scale per page;
  // a page that carries p-4 carries no bare p-3 or p-5 beside it (variants
  // such as sm:p-3 are read as the same step and count too).
  it("no file under src/app mixes p-4 with p-3 or p-5", () => {
    const PAD = /(?<![\w-])(?:[a-z-]+:)?p-(3|4|5)(?![\w-])/g;
    const mixed: string[] = [];
    for (const file of walkDir("src/app")) {
      const steps = new Set<string>();
      for (const m of readFileSync(file, "utf8").matchAll(PAD)) steps.add(m[1]);
      if (steps.has("4") && (steps.has("3") || steps.has("5")))
        mixed.push(
          `${file.replace(/\\/g, "/")}: p-${[...steps].sort().join(", p-")}`,
        );
    }
    expect(mixed).toEqual([]);
  });

  // REQ-024 A3 (PO 17 Oct 2026 14:50; #92 run 38997349648): Next's production
  // build refuses `react-dom/server` anywhere in the app bundle, and the dev
  // server does not, so `npm run check` passed where the build failed. The
  // string may not appear under `src/` at all; allow-list zero.
  it("no react-dom/server import under src/ (the production build refuses it)", () => {
    const hits: string[] = [];
    for (const file of walkDir("src")) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (line.includes("react-dom/server"))
          hits.push(`${file.replace(/\\/g, "/")}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
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
