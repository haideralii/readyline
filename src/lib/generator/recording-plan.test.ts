// @vitest-environment node
/**
 * Standing backlog 6 (D-550): the recording plan is computed without a model
 * call, in the runbook's order, with a fixture-key diff and a cost estimate.
 * With RECORDING_PLAN=1 the dry run is written to out/recording-plan.md.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { documentTypeById, sectionsFor } from "./catalogue";
import { DEFAULT_FIXTURES_DIR, type Fixture } from "./model-client";
import {
  BATCH_40_SECTIONS,
  PLACEHOLDER_INSTRUCTION,
  PLAN_GROUPS,
  approvedRecordings,
  buildRecordingPlan,
  dollarsFor,
  planSelection,
  renderRecordingPlan,
} from "./recording-plan";
import { loadReferenceCases } from "./reference-cases";

const plan = buildRecordingPlan();
const all = [...plan.groups.flatMap((g) => g.entries), ...plan.settled];

describe("the recording plan (backlog 6)", () => {
  it("covers every approved recording exactly once, in a group or settled", () => {
    const approved = approvedRecordings();
    const keys = all.map((e) => `${e.caseId}/${e.typeId}/${e.sectionId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(approved.length);
    expect(plan.groups.map((g) => g.id)).toEqual(PLAN_GROUPS.map((g) => g.id));
    for (const e of all.filter((x) => (x.group as number) !== -1))
      expect(e.reasons.length, `${e.typeId}/${e.sectionId}`).toBeGreaterThan(0);
  });

  it("group 1 is the complaints procedure alone; group 2 is the first three tailored sections of every other document in the set", () => {
    const g1 = plan.groups[1].entries.map((e) => `${e.typeId}/${e.sectionId}`);
    expect(g1).toEqual(["complaints-management-policy-and-register/procedure"]);
    // Every approved section that is one of the first three tailored sections of its document.
    const firstThreeOf = (typeId: string) =>
      sectionsFor(documentTypeById(typeId)!)
        .filter((s) => s.mode === "tailored")
        .slice(0, 3)
        .map((s) => s.id);
    const expected = new Set(
      all
        .filter((e) => firstThreeOf(e.typeId).includes(e.sectionId))
        .map((e) => `${e.typeId}/${e.sectionId}`),
    );
    expect(loadReferenceCases().length).toBe(3);
    const inGroup0 = new Set(
      plan.groups[0].entries.map((e) => `${e.typeId}/${e.sectionId}`),
    );
    const g2 = plan.groups[2].entries.map((e) => `${e.typeId}/${e.sectionId}`);
    // Every first-three section is in group 2 unless it has no live fixture (group 0 first).
    for (const key of expected)
      if (!inGroup0.has(key)) expect(g2, key).toContain(key);
    expect(g2.every((k) => expected.has(k))).toBe(true);
    expect(g2.length).toBeGreaterThanOrEqual(30);
  });

  it("group 3 names the batch 40 briefs that exist in the catalogue and the set", () => {
    for (const s of BATCH_40_SECTIONS) {
      const type = documentTypeById(s.typeId);
      expect(type, s.typeId).toBeDefined();
      expect(
        sectionsFor(type!).some((x) => x.id === s.sectionId),
        `${s.typeId}/${s.sectionId}`,
      ).toBe(true);
    }
    const placed = all.filter((e) =>
      BATCH_40_SECTIONS.some(
        (s) => s.typeId === e.typeId && s.sectionId === e.sectionId,
      ),
    );
    // Each one sits in group 0 to 3 (an earlier reason wins), never later.
    for (const e of placed)
      expect(e.group, `${e.typeId}/${e.sectionId}`).toBeLessThanOrEqual(3);
    expect(placed.some((e) => e.group === 3)).toBe(true);
  });

  it("the placeholder count matches an independent scan of the live fixtures", () => {
    let scanned = 0;
    for (const e of all) {
      const path = join(
        DEFAULT_FIXTURES_DIR,
        e.typeId,
        e.sectionId,
        `${e.currentHash}.json`,
      );
      if (!existsSync(path)) continue;
      const fx = JSON.parse(readFileSync(path, "utf8")) as Fixture;
      if (PLACEHOLDER_INSTRUCTION.test(fx.reply)) scanned += 1;
    }
    const flagged = all.filter((e) => e.live?.placeholderInstructions).length;
    expect(flagged).toBe(scanned);
    expect(flagged).toBeGreaterThan(0);
  });

  it("the fixture-key diff counts live, missing and orphan files from the folders", () => {
    const d = plan.fixtureDiff;
    expect(d.live + d.missing).toBe(d.approved);
    expect(d.byDocument.reduce((n, r) => n + r.approved, 0)).toBe(d.approved);
    let orphans = 0;
    for (const e of all) {
      const folder = join(DEFAULT_FIXTURES_DIR, e.typeId, e.sectionId);
      if (!existsSync(folder)) continue;
      orphans += readdirSync(folder).filter(
        (f) => f.endsWith(".json") && f !== `${e.currentHash}.json`,
      ).length;
    }
    expect(d.orphanFiles).toBe(orphans);
  });

  it("prices every call at the cached and uncached rates, writing the cache once per document", () => {
    expect(plan.totals.calls).toBe(
      plan.groups.reduce((n, g) => n + g.entries.length, 0),
    );
    expect(plan.totals.dollars.cached).toBeGreaterThan(0);
    expect(plan.totals.dollars.uncached).toBeGreaterThanOrEqual(
      plan.totals.dollars.cached,
    );
    for (const e of all) {
      expect(e.estimatedOutputTokens).toBeLessThanOrEqual(e.cap);
      expect(e.estimatedDollars.uncached).toBeGreaterThan(0);
    }
    expect(
      dollarsFor("claude-sonnet-5-5", { inputTokens: 1000, outputTokens: 100 }),
    ).toEqual({
      cached: 0.003,
      uncached: 0.003,
    });
  });

  it("a group or a section list selects the recorder's work", () => {
    expect(planSelection(plan, { group: 1 })).toHaveLength(1);
    const byList = planSelection(plan, {
      sections: ["complaints-management-policy-and-register/procedure"],
    });
    expect(byList).toHaveLength(1);
    expect(planSelection(plan, { group: 9 })).toHaveLength(0);
  });

  it("renders the dry run, and writes it when asked (RECORDING_PLAN=1)", () => {
    const md = renderRecordingPlan(plan, "2026-10-14");
    expect(md).toContain("## Group 1: The complaints procedure");
    expect(md).toContain("GENERATION_RECORD_GROUP=1 npm run generation:record");
    expect(md).toContain("## Fixture keys today");
    expect(md).not.toMatch(/sk-ant|ANTHROPIC_API_KEY=/);
    if (process.env.RECORDING_PLAN === "1") {
      mkdirSync("out", { recursive: true });
      writeFileSync("out/recording-plan.md", md);
    }
  });
});
