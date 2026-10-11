/**
 * Tests over the built dataset data/standards.json (REQ-001 AC-1, AC-5, AC-8, AC-9
 * and the PO's indicator-order rule). Run `npm run standards:build` first; CI does.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StandardsDataset, checkIntegrity } from "@/lib/standards/schema";
import { findProhibitedClaims } from "@/lib/claims";

const root = process.cwd();
const read = (p: string) =>
  readFileSync(resolve(root, p), "utf8").replace(/\r\n/g, "\n");
const sha256 = (s: string) =>
  createHash("sha256").update(s, "utf8").digest("hex");

const raw = JSON.parse(read("data/standards.json"));
const parsed = StandardsDataset.safeParse(raw);
if (!parsed.success)
  console.error(JSON.stringify(parsed.error.issues, null, 2));
const data = StandardsDataset.parse(raw);
const manifest = JSON.parse(read("data/sources/manifest.json")) as {
  items: { snapshotPath: string; url: string; sha256: string }[];
};

const byModule = (id: string) =>
  data.standards.filter((s) => s.moduleId === id);

describe("standards.json: shape", () => {
  it("parses against the schema", () => {
    expect(parsed.success).toBe(true);
  });

  it("is internally consistent", () => {
    expect(checkIntegrity(data)).toEqual([]);
  });

  it("has the expected module inventory", () => {
    expect(data.modules.map((m) => m.id).sort()).toEqual(
      [
        "core",
        "ec",
        "hidpa",
        "ibsp",
        "sbs",
        "sda",
        "sil",
        "ssc",
        "verification",
      ].sort(),
    );
  });

  it("has the expected number of standards per module (Version 4 contents plus SIL)", () => {
    const counts = Object.fromEntries(
      data.modules.map((m) => [m.id, byModule(m.id).length]),
    );
    expect(counts).toEqual({
      core: 24,
      hidpa: 8,
      sbs: 7,
      ibsp: 8,
      ec: 7,
      ssc: 3,
      sda: 5,
      sil: 4,
      verification: 4,
    });
  });

  it("every core division has at least one standard with at least one indicator (AC-5)", () => {
    const core = data.modules.find((m) => m.id === "core")!;
    for (const d of core.divisions) {
      const inDivision = data.standards.filter((s) => s.divisionId === d.id);
      expect(inDivision.length, d.id).toBeGreaterThan(0);
      for (const s of inDivision)
        expect(s.indicators.length, s.id).toBeGreaterThan(0);
    }
  });

  it("every standard has verbatim text, a source and at least one evidence item", () => {
    for (const s of data.standards) {
      expect(s.outcome.length, s.id).toBeGreaterThan(20);
      expect(
        s.indicators.every((i) => i.length > 10),
        s.id,
      ).toBe(true);
      expect(
        data.sources.some((src) => src.id === s.sourceId),
        s.id,
      ).toBe(true);
      expect(s.evidence.length, s.id).toBeGreaterThan(0);
    }
  });

  it("SIL standards carry intent and the three expectation statements", () => {
    for (const s of byModule("sil")) {
      expect(s.intent, s.id).toBeTruthy();
      expect(s.expectationStatements?.participant, s.id).toBeTruthy();
      expect(s.expectationStatements?.worker, s.id).toBeTruthy();
      expect(s.expectationStatements?.provider, s.id).toBeTruthy();
    }
  });

  it("contains no placeholder text and no prohibited claims", () => {
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/PLACEHOLDER/);
    const ours = [
      data.evidenceDisclaimer,
      ...data.standards.flatMap((s) =>
        s.evidence.flatMap((e) => [e.title, e.note ?? ""]),
      ),
      ...data.registrationGroups.map((g) => g.notes ?? ""),
    ].join("\n");
    expect(findProhibitedClaims(ours)).toEqual([]);
  });
});

describe("standards.json: registration groups (AC-1, AC-2, AC-5)", () => {
  it("lists all 38 classes 0101 to 0138", () => {
    const codes = data.registrationGroups.map((g) => g.code);
    const expected = Array.from({ length: 38 }, (_, i) =>
      String(101 + i).padStart(4, "0"),
    );
    expect(codes).toEqual(expected);
  });

  it("every group maps to at least one module", () => {
    for (const g of data.registrationGroups) {
      expect(g.moduleIds.length > 0 || g.requiresCore, g.code).toBe(true);
    }
  });

  it("verification groups map to the verification module only; certification groups never do", () => {
    for (const g of data.registrationGroups) {
      if (g.auditType === "verification") {
        expect(g.moduleIds, g.code).toEqual(["verification"]);
        expect(g.requiresCore, g.code).toBe(false);
      } else {
        expect(g.moduleIds, g.code).not.toContain("verification");
      }
    }
  });

  it("every supplementary module is brought in by a group or by the restrictive-practices rule", () => {
    const referenced = new Set(
      data.registrationGroups.flatMap((g) => g.moduleIds),
    );
    referenced.add(data.rules.restrictivePracticesModuleId);
    for (const m of data.modules.filter((m) => m.kind === "supplementary")) {
      expect(referenced.has(m.id), m.id).toBe(true);
    }
  });

  it("the two mandatory classes carry the 1 July 2026 commencement and SIL carries the application cut-off (AC-4)", () => {
    const sil = data.registrationGroups.find((g) => g.code === "0138")!;
    const platform = data.registrationGroups.find((g) => g.code === "0137")!;
    expect(sil.mandatoryFrom).toBe("2026-07-01");
    expect(platform.mandatoryFrom).toBe("2026-07-01");
    expect(sil.moduleIds).toEqual(["sil"]);
    expect(sil.requiresCore).toBe(true);
    expect(platform.requiresCore).toBe(true);
    expect(sil.notes).toMatch(/1 October 2026/);
    expect(data.rules.silDefinition.applicationDeadline).toBe("2026-10-01");
    expect(
      data.sources.some((s) => s.id === data.rules.silDefinition.sourceId),
    ).toBe(true);
  });
});

describe("standards.json: rules have sources (AC-8)", () => {
  it("every rule names a source that exists", () => {
    const ids = new Set(data.sources.map((s) => s.id));
    const r = data.rules;
    for (const id of [
      r.mixedAuditSourceId,
      r.restrictivePracticesSourceId,
      r.coreExemptWhenSoleSourceId,
      r.modifiedCertification.sourceId,
      r.registrationPeriodSourceId,
      r.midTermAudit.sourceId,
      r.ratingsSourceId,
      r.silDefinition.sourceId,
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});

describe("standards.json: sources and snapshots (AC-6, AC-9)", () => {
  it("every source hash matches the snapshot on disk and the manifest", () => {
    const manifestByPath = new Map(
      manifest.items.map((i) => [i.snapshotPath, i]),
    );
    for (const s of data.sources) {
      expect(existsSync(resolve(root, s.snapshotPath)), s.snapshotPath).toBe(
        true,
      );
      const actual = sha256(read(s.snapshotPath));
      expect(actual, s.id).toBe(s.sha256);
      expect(manifestByPath.get(s.snapshotPath)?.sha256, s.id).toBe(actual);
      expect(manifestByPath.get(s.snapshotPath)?.url, s.id).toBe(s.url);
    }
  });

  it("indicator order matches the order in the source snapshot (stable indicator ids)", () => {
    for (const s of data.standards) {
      const source = data.sources.find((src) => src.id === s.sourceId)!;
      const snapshot = read(source.snapshotPath).replace(/\s+/g, " ");
      let cursor = -1;
      for (const [i, indicator] of s.indicators.entries()) {
        // The first 60 characters of each indicator are enough to locate it; sub-points may be wrapped in the PDF.
        const probe = indicator.slice(0, 60).replace(/\s+/g, " ");
        const at = snapshot.indexOf(probe, cursor + 1);
        expect(at, `${s.id}#${i}: "${probe}"`).toBeGreaterThan(cursor);
        cursor = at;
      }
    }
  });
});
