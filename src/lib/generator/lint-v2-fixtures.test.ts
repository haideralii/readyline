// @vitest-environment node
/**
 * House style version 2 over the recorded replies (batch 40 item 2): how
 * many recorded sections the four new lints would reject, by lint and by
 * section, reported before and after the brief changes. Reported, not
 * gated: a recorded reply predates the rules and is listed for the next
 * recording session; the gate for live replies is in generate-section.ts.
 * With LINT_V2_REPORT=1 the table is written to out/lint-v2-report.txt.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  anyFinding,
  emptyCounts,
  lintV2Counts,
  LINT_V2_RULES,
  type LintV2Counts,
} from "./lint-v2-fixture";
import { DEFAULT_FIXTURES_DIR, type Fixture } from "./model-client";
import { knownRecordNames } from "./record-names";

const DIRS = [
  DEFAULT_FIXTURES_DIR,
  join("fixtures", "generation-claude-haiku-5-5"),
];

export type { LintV2Counts };

export function lintV2OverFixtures(): {
  fixtures: number;
  failing: number;
  byRule: LintV2Counts;
  bySection: Record<string, LintV2Counts>;
} {
  const dataset = getStandardsDataset();
  const allowed = dataset.registrationGroups.map((g) => g.name);
  const known = knownRecordNames();
  const byRule = emptyCounts();
  const bySection: Record<string, LintV2Counts> = {};
  let fixtures = 0;
  let failing = 0;
  for (const dir of DIRS) {
    let types: string[] = [];
    try {
      types = readdirSync(dir);
    } catch {
      continue;
    }
    for (const typeId of types) {
      if (typeId.endsWith(".json") || typeId.endsWith(".md")) continue;
      for (const sectionId of readdirSync(join(dir, typeId))) {
        for (const file of readdirSync(join(dir, typeId, sectionId))) {
          if (!file.endsWith(".json")) continue;
          const fx = JSON.parse(
            readFileSync(join(dir, typeId, sectionId, file), "utf8"),
          ) as Fixture;
          // Backlog 6: the per-fixture lint lives in lint-v2-fixture.ts, shared with the recording plan.
          const counts = lintV2Counts(fx, {
            allowedPhrases: allowed,
            knownRecordNames: known,
          });
          if (!counts) continue;
          fixtures += 1;
          const key = `${typeId}/${sectionId}`;
          const section = (bySection[key] ??= emptyCounts());
          for (const k of LINT_V2_RULES) {
            byRule[k] += counts[k];
            section[k] += counts[k];
          }
          if (anyFinding(counts)) failing += 1;
        }
      }
    }
  }
  return { fixtures, failing, byRule, bySection };
}

describe("house style version 2 over the recorded fixtures (batch 40 item 2)", () => {
  it("reports how many recorded replies the new lints would reject", () => {
    const r = lintV2OverFixtures();
    expect(r.fixtures).toBeGreaterThan(100);
    const lines = [
      `fixtures with a parsed reply: ${r.fixtures}; replies with at least one finding: ${r.failing}`,
      `by rule: ${Object.entries(r.byRule)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
      ...Object.entries(r.bySection)
        .filter(([, c]) => Object.values(c).some((v) => v > 0))
        .sort()
        .map(
          ([k, c]) =>
            `  ${k}: ${Object.entries(c)
              .filter(([, v]) => v > 0)
              .map(([n, v]) => `${n}=${v}`)
              .join(", ")}`,
        ),
    ];
    if (process.env.LINT_V2_REPORT === "1") {
      mkdirSync("out", { recursive: true });
      writeFileSync("out/lint-v2-report.txt", lines.join("\n") + "\n");
    }
    // Reported, not gated: recorded replies predate version 2 (D-544).
    expect(r.failing).toBeLessThanOrEqual(r.fixtures);
  });
});
