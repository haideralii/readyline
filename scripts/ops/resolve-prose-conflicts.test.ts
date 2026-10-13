// @vitest-environment node
/**
 * The prose conflict resolver (D-1011): keeps both sides of a Markdown
 * conflict in order, keeps the repaired side alone when the other side is
 * its mojibake, refuses any path that is not a .md file, and throws when a
 * marker is left over.
 */
import { describe, expect, it } from "vitest";
import {
  assertProsePath,
  isProsePath,
  resolveProseConflicts,
} from "./resolve-prose-conflicts-lib";

describe("resolve-prose-conflicts (D-1011)", () => {
  it("accepts only Markdown paths", () => {
    expect(isProsePath("DECISIONS.md")).toBe(true);
    expect(isProsePath("product/NEXT.md")).toBe(true);
    expect(isProsePath("product/requirements/REQ-017-guided-path.MD")).toBe(
      true,
    );
    for (const code of [
      "playwright.config.ts",
      "src/lib/env.ts",
      "package.json",
      "supabase/migrations/20261014000000_account_facts.sql",
      ".github/workflows/generate-kick.yml",
      "README.mdx",
      "notes.md.bak",
    ]) {
      expect(isProsePath(code), code).toBe(false);
      expect(() => assertProsePath(code)).toThrow(/refusing .*only \.md/);
    }
  });

  it("keeps HEAD's side then the other side, one blank line after each", () => {
    const input = [
      "## Queue",
      "<<<<<<< HEAD",
      "- item from this branch",
      "=======",
      "- item from main",
      ">>>>>>> origin/main",
      "## Next",
      "",
    ].join("\n");
    const out = resolveProseConflicts(input);
    expect(out.blocks).toBe(1);
    expect(out.text).toBe(
      "## Queue\n- item from this branch\n\n- item from main\n\n## Next\n",
    );
  });

  it("keeps the repaired side alone when the other side is its mojibake", () => {
    const clean = "- D-059 (PO) the schedule becomes `*/30`— the safety net\n";
    // Built from code points so the source itself never carries a mojibake run (the encoding guard scans it).
    const broken = clean.replace(
      "—",
      String.fromCharCode(0xe2, 0x20ac, 0x201d),
    );
    const input = `<<<<<<< HEAD\n${broken}=======\n${clean}>>>>>>> other\n`;
    expect(resolveProseConflicts(input).text).toBe(clean);
    const reversed = `<<<<<<< HEAD\n${clean}=======\n${broken}>>>>>>> other\n`;
    expect(resolveProseConflicts(reversed).text).toBe(clean);
  });

  it("strips a byte-order mark and throws when a marker remains", () => {
    expect(resolveProseConflicts("﻿# Title\n").text).toBe("# Title\n");
    expect(() =>
      resolveProseConflicts("<<<<<<< HEAD\nno closing marker\n"),
    ).toThrow(/marker remains/);
  });
});
