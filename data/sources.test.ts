/**
 * REQ-001 AC-7 and the PO's Session A review item 1: the generated SOURCES.md
 * must list UNVERIFIED items and its counts must agree with the dataset.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StandardsDataset } from "@/lib/standards/schema";

const root = process.cwd();
const read = (p: string) =>
  readFileSync(resolve(root, p), "utf8").replace(/\r\n/g, "\n");
const data = StandardsDataset.parse(JSON.parse(read("data/standards.json")));
const sourcesMd = read("data/SOURCES.md");
const decisionsMd = read("DECISIONS.md");

describe("SOURCES.md agrees with standards.json", () => {
  it("states the dataset version and totals", () => {
    expect(sourcesMd).toContain(`Dataset version **${data.version}**`);
    expect(sourcesMd).toContain(
      `${data.modules.length} modules, ${data.standards.length} standards, ${data.registrationGroups.length} registration classes.`,
    );
  });

  it("lists every module with the count of standards in the dataset", () => {
    for (const m of data.modules) {
      const n = data.standards.filter((s) => s.moduleId === m.id).length;
      expect(sourcesMd).toContain(`\`${m.id}\` ${m.name}: ${n} standards`);
    }
  });

  it("lists every source id and hash prefix", () => {
    for (const s of data.sources) {
      expect(sourcesMd).toContain(`\`${s.id}\``);
      expect(sourcesMd).toContain(s.sha256.slice(0, 12));
    }
  });

  it("has an UNVERIFIED section that matches the dataset (AC-7)", () => {
    expect(sourcesMd).toMatch(/## UNVERIFIED items/);
    const unverified = [
      ...data.modules
        .filter((m) => m.verification.status === "unverified")
        .map((m) => m.id),
      ...data.standards
        .filter((s) => s.verification.status === "unverified")
        .map((s) => s.id),
      ...data.registrationGroups
        .filter((g) => g.verification.status === "unverified")
        .map((g) => g.code),
    ];
    if (unverified.length === 0) {
      expect(sourcesMd).toMatch(/## UNVERIFIED items\n\n- none/);
    } else {
      for (const id of unverified) expect(sourcesMd).toContain(`\`${id}\``);
    }
  });

  it("the changelog does not hard-code a standards count (counts live in Contents)", () => {
    const changelog = sourcesMd.split("## Changelog")[1] ?? "";
    expect(changelog).not.toMatch(/\(\d+ standards\)/);
  });
});

describe("DECISIONS.md keeps the UNVERIFIED register (AC-7)", () => {
  it("has the register section", () => {
    expect(decisionsMd).toMatch(/## UNVERIFIED register/);
  });
});
