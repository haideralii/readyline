// @vitest-environment node
/**
 * REQ-012 FR-1e, AC-3's "with the plain message or 429": every place the
 * code consults a limiter (`hitRateLimit(` or a memory limiter's `.allow(`)
 * answers the refused hit within the next lines with a 429 status or one of
 * the plain sentences, never a stack trace or a silent pass. A new caller
 * without a refusal fails here naming the file and line.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name))
      out.push(p);
  }
  return out;
}

/** A consult: the database limiter, a memory limiter, or the result email's wrapper over both. */
const CALL = /hitRateLimit\(|\.allow\(|\ballowed\(/;
/** A line that only passes the answer on (the wrapper's own body), checked at its callers instead. */
const FORWARDING_LINE =
  /^\s*(?:return|if \(.*\) return) (?:await )?(?:hitRateLimit|\w+\.allow)\(|^\s*(?:async )?function allowed\(/;
/**
 * The refused hit's answer: a 429 status, or a plain \`{ ok: false, …
 * message: … }\` reply (a sentence or a named sentence such as
 * LIMITED_MESSAGE), or the \`limited: true\` flag the result email adds.
 */
const REFUSAL = /\b429\b|ok: false[\s\S]{0,120}message:|limited: true|LIMITED/;
/** The limiter module itself. */
const FORWARDERS = [join("src", "server", "auth", "rate-limit.ts")];

describe("every limiter call site refuses with a 429 or a plain sentence (REQ-012 FR-1e, AC-3)", () => {
  const files = walk("src").filter(
    (f) => !FORWARDERS.some((x) => f.endsWith(x)),
  );
  const sites: { file: string; line: number }[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      if (
        CALL.test(text) &&
        !/^\s*(\*|\/\/)/.test(text) &&
        !FORWARDING_LINE.test(text)
      )
        sites.push({ file, line: i + 1 });
    });
  }

  it("finds the call sites the REQ names (export, checkout, imports, register writes, fills, auditor open, reports, the memory limiters)", () => {
    expect(sites.length).toBeGreaterThanOrEqual(9);
  });

  for (const site of sites)
    it(`${site.file.replace(/\\/g, "/")}:${site.line} answers the refused hit plainly`, () => {
      const lines = readFileSync(site.file, "utf8").split("\n");
      const window = lines.slice(site.line - 1, site.line + 14).join("\n");
      expect(REFUSAL.test(window), window).toBe(true);
    });
});
