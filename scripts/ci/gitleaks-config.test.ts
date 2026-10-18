// @vitest-environment node
/**
 * REQ-012 FR-1g: every gitleaks exemption is justified in place. The
 * fingerprint file's entries each sit under a comment naming the file, the
 * rule and why it is not a secret; the configuration's allow-lists each
 * carry a description and are path-scoped to data/sources/ only; no rule is
 * disabled and the default rules stay on. The inline `gitleaks:allow`
 * markers in the tree are counted and each sits on a line that reads as a
 * fixture value, never a value from a secret store.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ignore = readFileSync(".gitleaksignore", "utf8").split("\n");
const config = readFileSync(".gitleaks.toml", "utf8");
// Built at runtime so this file's own code is not counted as a marker.
const MARKER = ["gitleaks", "allow"].join(":");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git")
      continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|yml|yaml|json)$/.test(name)) out.push(p);
  }
  return out;
}

describe("the gitleaks exemptions are justified (REQ-012 FR-1g)", () => {
  it("every fingerprint sits under a comment that names the file and says why", () => {
    const entries = ignore
      .map((l, i) => ({ l: l.trim(), i }))
      .filter(({ l }) => /^[0-9a-f]{40}:/.test(l));
    expect(entries.length).toBeGreaterThan(0);
    for (const { l, i } of entries) {
      const [, file, rule] = l.split(":");
      expect(file, l).toMatch(/\.(ts|tsx|mjs|yml|json)$/);
      expect(rule, l).toMatch(/^[a-z-]+$/);
      // The nearest comment block above the entry names the file and a reason.
      let j = i - 1;
      const block: string[] = [];
      while (j >= 0 && ignore[j].trim().startsWith("#"))
        (block.unshift(ignore[j]), j--);
      const text = block.join(" ");
      expect(text, `comment above ${l}`).toContain(file);
      expect(text, `reason above ${l}`).toMatch(
        /not a secret|before its marker|fixture|test constant/,
      );
    }
  });

  it("the configuration keeps the default rules, disables none, and allow-lists data/sources/ alone with a description", () => {
    expect(config).toContain("useDefault = true");
    const code = config
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#"))
      .join("\n");
    expect(code).not.toMatch(/\[\[rules\]\]|disabled|enabled = false/);
    const lists = config.split("[[allowlists]]").slice(1);
    expect(lists).toHaveLength(1);
    expect(lists[0]).toContain("description =");
    expect(lists[0]).toContain("paths = ['''^data/sources/''']");
    expect(lists[0]).not.toMatch(/regexes|stopwords|commits/);
  });

  it("the inline gitleaks:allow markers are fixture values built from words and a digit run", () => {
    const marked: string[] = [];
    for (const file of walk(".")) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line) => {
        // A marker on a code line; a mention inside a comment (this file's own) is not one.
        if (line.includes(MARKER) && !/^\s*(\*|\/\/|#)/.test(line))
          marked.push(`${file.replace(/\\/g, "/")}: ${line.trim()}`);
      });
    }
    expect(marked.length).toBeGreaterThanOrEqual(4);
    for (const m of marked)
      expect(m, m).toMatch(
        /e2e|rehearsal|fixture|passphrase-0123456789|0123456789abcdef/,
      );
  });
});
