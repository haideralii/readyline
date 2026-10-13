import { describe, expect, it } from "vitest";
import { BOM, findMojibake, hasBom, repairRun, repairText } from "./encoding";

/** Encodes a string as UTF-8 and reads the bytes back as Windows-1252, which is what the corrupting tool did. */
function corrupt(s: string): string {
  const bytes = new TextEncoder().encode(s);
  return new TextDecoder("windows-1252").decode(bytes);
}

describe("mojibake detection and repair (D-1507)", () => {
  it("round trip of the characters the repo uses", () => {
    for (const ch of ["→", "…", "—", "‘", "’", "“", "”", "▾", "▸", "‹", "é"]) {
      const bad = corrupt(ch);
      expect(bad, ch).not.toBe(ch);
      expect(findMojibake(bad).length, ch).toBeGreaterThan(0);
      expect(repairRun(bad), ch).toBe(ch);
    }
  });

  it("a line encoded twice and three times comes back whole", () => {
    const line = "Supabase → Authentication; the set is drafted…";
    expect(repairText(corrupt(line))).toBe(line);
    expect(repairText(corrupt(corrupt(line)))).toBe(line);
    expect(repairText(corrupt(corrupt(corrupt(line))))).toBe(line);
  });

  it("a run mixing depths (the nonce line) is restored in one call", () => {
    const line = "'nonce-…' 'strict-dynamic'";
    const mixed = `${corrupt(corrupt(line))} and ${corrupt("…")}`;
    expect(repairText(mixed)).toBe(`${line} and …`);
  });

  it("plain English and correct UTF-8 are untouched", () => {
    const ok =
      "Supabase → Authentication → URL Configuration: the set is ready… “quoted” and ‘single’ — done. Café.";
    expect(findMojibake(ok)).toEqual([]);
    expect(repairText(ok)).toBe(ok);
    const code = "const RUN = /[a-z]+/g; <!-- ok --> x & y";
    expect(repairText(code)).toBe(code);
  });

  it("the byte-order mark is reported and stripped", () => {
    const text = `${BOM}# Title\n`;
    expect(hasBom(text)).toBe(true);
    expect(hasBom("# Title")).toBe(false);
    expect(repairText(text)).toBe("# Title\n");
  });

  it("reports the line number of each run", () => {
    const text = `fine\n${corrupt("→")} here\nalso fine\n${corrupt("…")}`;
    expect(findMojibake(text).map((f) => f.line)).toEqual([2, 4]);
  });
});
