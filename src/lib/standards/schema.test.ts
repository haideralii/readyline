import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StandardsDataset, checkIntegrity } from "./schema";

const example = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/standards.example.json"), "utf8"),
);

describe("standards schema", () => {
  it("accepts the example dataset", () => {
    const parsed = StandardsDataset.safeParse(example);
    if (!parsed.success) console.error(parsed.error.issues);
    expect(parsed.success).toBe(true);
  });

  it("example dataset is internally consistent", () => {
    const d = StandardsDataset.parse(example);
    expect(checkIntegrity(d)).toEqual([]);
  });

  it("rejects an unverified record without a note", () => {
    const d = structuredClone(example);
    d.standards[0].verification = {
      status: "unverified",
      checkedAt: "2026-10-11",
    };
    expect(StandardsDataset.safeParse(d).success).toBe(false);
  });

  it("flags a registration group that maps to no module", () => {
    const d = StandardsDataset.parse(example);
    d.registrationGroups.push({
      code: "9999",
      name: "Orphan group",
      auditType: "certification",
      moduleIds: [],
      requiresCore: false,
      mandatoryFrom: null,
      sourceIds: [d.sources[0].id],
      verification: { status: "verified", checkedAt: "2026-10-11" },
    });
    expect(checkIntegrity(d)).toContain("group 9999: maps to no module at all");
  });

  it("flags a verification group that claims the core module", () => {
    const d = StandardsDataset.parse(example);
    const g = d.registrationGroups.find((x) => x.auditType === "verification")!;
    g.requiresCore = true;
    expect(checkIntegrity(d).some((p) => p.includes(g.code))).toBe(true);
  });

  it("flags a standard whose id does not follow module.division.slug", () => {
    const d = StandardsDataset.parse(example);
    d.standards[0].id = "wrong.id";
    expect(checkIntegrity(d).some((p) => p.includes("must start with"))).toBe(
      true,
    );
  });
});
