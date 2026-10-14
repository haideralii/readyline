/**
 * Batch 31 item 0 (D-1507): no text file in the repo carries a UTF-8
 * byte-order mark or a double-encoded character. The PO asked for every
 * `*.md` under the repo root and `product/`; the walk also covers the
 * source, content, data, tests and workflow files, because the same tool
 * corrupted a source file and the generator's prompt. Fetched source
 * snapshots under data/sources are left alone (their text is the
 * Commission's, byte for byte). Repair with `scripts/ops/repair-mojibake.ts`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findMojibake, hasBom } from "@/lib/text/encoding";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "playwright-report",
  "test-results",
  "coverage",
]);
const SKIP_PATHS = new Set(["data/sources"]);
const TEXT = /\.(md|mdx|ts|tsx|mjs|cjs|json|sql|yml|yaml|css|txt|toml)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const rel = relative(ROOT, p).replace(/\\/g, "/");
    if (SKIP_PATHS.has(rel)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TEXT.test(name)) out.push(p);
  }
  return out;
}

describe("text files are clean UTF-8 (D-1507)", () => {
  it("no byte-order mark and no double-encoded character in any text file", () => {
    const findings: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      if (hasBom(text)) findings.push(`${rel}: byte-order mark`);
      for (const f of findMojibake(text))
        findings.push(`${rel}:${f.line}: "${f.run}"`);
    }
    expect(findings).toEqual([]);
  }, 30_000);

  it("covers the markdown the PO named", () => {
    const files = walk(ROOT).map((f) => relative(ROOT, f).replace(/\\/g, "/"));
    expect(files).toContain("DECISIONS.md");
    expect(files).toContain("product/NEXT.md");
    expect(
      files.some((f) => /^product\/requirements\/REQ-.*\.md$/.test(f)),
    ).toBe(true);
  });
});
