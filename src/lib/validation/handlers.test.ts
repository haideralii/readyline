/**
 * Guard for REQ-002 FR-3: every route handler and server action must go
 * through the validation layer. A lint rule cannot express "this file is a
 * boundary", so this test walks the app tree instead. It passes vacuously
 * until the first handler exists and then fails the moment one skips
 * validation.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry))
      out.push(p);
  }
  return out;
}

const files = walk(join(root, "src"));
const routeHandlers = files.filter((f) =>
  /[\\/]app[\\/].*[\\/]route\.ts$/.test(f),
);
const serverActionFiles = files.filter((f) =>
  /^\s*["']use server["']/m.test(readFileSync(f, "utf8")),
);

describe("boundaries use the validation layer", () => {
  it("every route handler imports from @/lib/validation", () => {
    const missing = routeHandlers.filter(
      (f) => !/from\s+["']@\/lib\/validation["']/.test(readFileSync(f, "utf8")),
    );
    expect(missing.map((f) => relative(root, f))).toEqual([]);
  });

  it("every server action file imports from @/lib/validation", () => {
    const missing = serverActionFiles.filter(
      (f) => !/from\s+["']@\/lib\/validation["']/.test(readFileSync(f, "utf8")),
    );
    expect(missing.map((f) => relative(root, f))).toEqual([]);
  });

  it("no boundary file uses z.object directly (use strictObject)", () => {
    const offenders = [...routeHandlers, ...serverActionFiles].filter((f) =>
      /\bz\.object\(/.test(readFileSync(f, "utf8")),
    );
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});
