/**
 * REQ-003 question 2: the plain-English group descriptions are ours, marked as
 * such, cover all 38 classes, read plainly and contain no prohibited claims.
 * When data/standards.json is present (after REQ-001 merges), names and codes
 * must match the Commission's table exactly.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const file = JSON.parse(read("data/registration-group-descriptions.json")) as {
  note: string;
  author: string;
  status: string;
  items: { code: string; name: string; description: string }[];
};

describe("registration group descriptions", () => {
  it("is marked as Readyline text, not Commission text", () => {
    expect(file.author).toBe("readyline");
    expect(file.note).toMatch(
      /NOT NDIS Quality and Safeguards Commission text/,
    );
    expect(["draft", "reviewed"]).toContain(file.status);
  });

  it("covers all 38 classes 0101 to 0138 exactly once, in order", () => {
    const expected = Array.from({ length: 38 }, (_, i) =>
      String(101 + i).padStart(4, "0"),
    );
    expect(file.items.map((i) => i.code)).toEqual(expected);
  });

  it("descriptions are one plain sentence, not too long for a phone screen", () => {
    for (const item of file.items) {
      expect(item.description.length, item.code).toBeGreaterThanOrEqual(30);
      expect(item.description.length, item.code).toBeLessThanOrEqual(170);
      expect(item.description.endsWith("."), item.code).toBe(true);
      expect(item.description, item.code).not.toMatch(/\b(client|patient)\b/i);
    }
  });

  it("contains no prohibited claims", () => {
    const text = file.items
      .map((i) => `${i.name}. ${i.description}`)
      .join("\n");
    expect(findProhibitedClaims(text)).toEqual([]);
  });

  it("matches the Commission class names in standards.json when that dataset is present", () => {
    const path = resolve(root, "data/standards.json");
    if (!existsSync(path)) return; // REQ-001 branch not merged yet; checked after merge.
    const dataset = JSON.parse(read("data/standards.json")) as {
      registrationGroups: { code: string; name: string }[];
    };
    const byCode = new Map(
      dataset.registrationGroups.map((g) => [g.code, g.name]),
    );
    for (const item of file.items)
      expect(byCode.get(item.code), item.code).toBe(item.name);
  });
});
