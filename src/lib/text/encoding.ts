/**
 * Detects and repairs text that was read as Windows-1252 and written back as
 * UTF-8 (batch 31 item 0, D-1507): a three-byte arrow or ellipsis becomes
 * three Latin-1 glyphs (a-circumflex, dagger, right-arrow for the arrow),
 * and a second round trip nests the damage again. Also knows the UTF-8
 * byte-order mark, which the same tooling adds.
 *
 * Pure string functions with no Node imports, so the unit test, the walker
 * test and the repair script share them. Imports use explicit `.ts`
 * extensions so the repair script also runs under Node's type stripping.
 */

export const BOM = "﻿";

/** What a Windows-1252 decoder shows for bytes 0x80 to 0x9F (undefined bytes stay as controls). */
const CP1252_HIGH: Record<number, string> = {
  0x80: "€",
  0x82: "‚",
  0x83: "ƒ",
  0x84: "„",
  0x85: "…",
  0x86: "†",
  0x87: "‡",
  0x88: "ˆ",
  0x89: "‰",
  0x8a: "Š",
  0x8b: "‹",
  0x8c: "Œ",
  0x8e: "Ž",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x98: "˜",
  0x99: "™",
  0x9a: "š",
  0x9b: "›",
  0x9c: "œ",
  0x9e: "ž",
  0x9f: "Ÿ",
};

const TO_BYTE = new Map<string, number>();
for (let b = 0; b < 0x80; b += 1) TO_BYTE.set(String.fromCharCode(b), b);
for (let b = 0x80; b < 0xa0; b += 1)
  TO_BYTE.set(CP1252_HIGH[b] ?? String.fromCharCode(b), b);
for (let b = 0xa0; b < 0x100; b += 1) TO_BYTE.set(String.fromCharCode(b), b);

/** The glyphs a UTF-8 continuation byte (0x80 to 0xBF) shows as under Windows-1252. */
const CONTINUATION = [
  ...Array.from({ length: 0x40 }, (_, i) =>
    (CP1252_HIGH[0x80 + i] ?? String.fromCharCode(0x80 + i)).replace(
      /[\\\]^-]/g,
      "\\$&",
    ),
  ),
].join("");
/** A UTF-8 lead byte (0xC2 to 0xF4) under Windows-1252, followed by one to three continuation glyphs, repeated. */
const RUN = new RegExp(`(?:[\\u00C2-\\u00F4][${CONTINUATION}]{1,3})+`, "g");

export function hasBom(text: string): boolean {
  return text.startsWith(BOM);
}

/** Every double-encoded run in the text, with its 1-based line. */
export function findMojibake(text: string): { line: number; run: string }[] {
  const out: { line: number; run: string }[] = [];
  text.split("\n").forEach((l, i) => {
    for (const m of l.match(RUN) ?? []) out.push({ line: i + 1, run: m });
  });
  return out;
}

/** Encodes to Windows-1252 bytes, or null when a character has no byte there. */
function toCp1252(s: string): Uint8Array | null {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) {
    const b = TO_BYTE.get(s[i]);
    if (b === undefined) return null;
    bytes[i] = b;
  }
  return bytes;
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

/** One round trip back: the run's Windows-1252 bytes read as UTF-8, or null when they are not valid UTF-8. */
function undoOnce(run: string): string | null {
  const bytes = toCp1252(run);
  if (!bytes) return null;
  try {
    return utf8.decode(bytes);
  } catch {
    return null;
  }
}

/** Undoes every round trip in a run, however many times it was re-encoded. */
export function repairRun(run: string): string {
  let current = run;
  for (let i = 0; i < 8; i += 1) {
    const next = undoOnce(current);
    if (next === null || next === current) break;
    current = next;
    if (!new RegExp(RUN.source).test(current)) break;
  }
  return current;
}

/**
 * The text with the byte-order mark removed and every double-encoded run
 * restored. Passes repeat until nothing changes, so a run that mixes depths
 * (the nonce line in DECISIONS.md was encoded three times) comes back whole.
 */
export function repairText(text: string): string {
  let body = hasBom(text) ? text.slice(1) : text;
  for (let i = 0; i < 8; i += 1) {
    const next = body.replace(RUN, (run) => repairRun(run));
    if (next === body) break;
    body = next;
  }
  return body;
}
