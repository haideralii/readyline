import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StandardsDataset, checkIntegrity } from "./schema";

const dataset = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/standards.json"), "utf8"),
);

describe("standards schema", () => {
  it("accepts the built dataset", () => {
    const parsed = StandardsDataset.safeParse(dataset);
    if (!parsed.success) console.error(parsed.error.issues);
    expect(parsed.success).toBe(true);
  });

  it("rejects an unverified record without a note", () => {
    const d = structuredClone(dataset);
    d.standards[0].verification = {
      status: "unverified",
      checkedAt: "2026-10-11",
    };
    expect(StandardsDataset.safeParse(d).success).toBe(false);
  });

  it("rejects a malformed registration group code", () => {
    const d = structuredClone(dataset);
    d.registrationGroups[0].code = "101";
    expect(StandardsDataset.safeParse(d).success).toBe(false);
  });

  it("flags a registration group that maps to no module", () => {
    const d = StandardsDataset.parse(dataset);
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
    const d = StandardsDataset.parse(dataset);
    const g = d.registrationGroups.find((x) => x.auditType === "verification")!;
    g.requiresCore = true;
    expect(checkIntegrity(d).some((p) => p.includes(g.code))).toBe(true);
  });

  it("flags a certification group that maps to the verification module", () => {
    const d = StandardsDataset.parse(dataset);
    const g = d.registrationGroups.find(
      (x) => x.auditType === "certification",
    )!;
    g.moduleIds.push("verification");
    expect(checkIntegrity(d).some((p) => p.includes(g.code))).toBe(true);
  });

  it("flags a standard whose id does not follow module.division.slug", () => {
    const d = StandardsDataset.parse(dataset);
    d.standards[0].id = "wrong.id";
    expect(checkIntegrity(d).some((p) => p.includes("must start with"))).toBe(
      true,
    );
  });

  it("flags a dangling source reference on a rule", () => {
    const d = StandardsDataset.parse(dataset);
    d.rules.midTermAudit.sourceId = "no-such-source";
    expect(checkIntegrity(d)).toContain(
      'rules.midTermAudit: unknown source "no-such-source"',
    );
  });

  it("flags a module with no standards", () => {
    const d = StandardsDataset.parse(dataset);
    d.modules.push({
      id: "empty",
      kind: "supplementary",
      name: "Empty module",
      divisions: [],
      appliesTo: "nobody",
      effectiveFrom: null,
      sourceIds: [d.sources[0].id],
      verification: { status: "verified", checkedAt: "2026-10-11" },
    });
    expect(checkIntegrity(d)).toContain("module empty: has no standards");
  });
});
