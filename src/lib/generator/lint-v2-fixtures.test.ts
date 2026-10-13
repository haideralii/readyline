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
import { COMMISSION_CONTACT_STRINGS } from "./fixed-extras";
import {
  contactStringsIn,
  lintContactDetails,
  lintIndicatorRestatement,
  lintRecordNames,
  lintStaffActor,
  lintVagueTime,
} from "./lint";
import { DEFAULT_FIXTURES_DIR, type Fixture } from "./model-client";
import { knownRecordNames } from "./record-names";
import { TailoredSection, blocksToText } from "./section-schema";

const DIRS = [
  DEFAULT_FIXTURES_DIR,
  join("fixtures", "generation-claude-haiku-5-5"),
];

/** The quality indicator sentences the fixture's own STANDARDS block carried. */
function indicatorsOf(user: string): string[] {
  const block =
    /<<<STANDARDS>>>\n([\s\S]*?)<<<END STANDARDS>>>/.exec(user)?.[1] ?? "";
  return [...block.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]);
}

export type LintV2Counts = Record<
  | "indicator-restatement"
  | "vague-time"
  | "staff-actor"
  | "record-name"
  | "contact-details",
  number
>;

/** The FACTS and STATE FACTS blocks of a recorded prompt: the contact strings a reply may quote (D-546). */
function allowedContactsOf(user: string): string[] {
  const blocks = [
    /<<<FACTS>>>\n([\s\S]*?)<<<END FACTS>>>/.exec(user)?.[1] ?? "",
    /<<<STATE FACTS>>>\n([\s\S]*?)<<<END STATE FACTS>>>/.exec(user)?.[1] ?? "",
  ].join("\n");
  return [
    ...COMMISSION_CONTACT_STRINGS,
    ...contactStringsIn(blocks).map((c) => c.value),
  ];
}

export function lintV2OverFixtures(): {
  fixtures: number;
  failing: number;
  byRule: LintV2Counts;
  bySection: Record<string, LintV2Counts>;
} {
  const dataset = getStandardsDataset();
  const allowed = dataset.registrationGroups.map((g) => g.name);
  const known = knownRecordNames();
  const byRule: LintV2Counts = {
    "indicator-restatement": 0,
    "vague-time": 0,
    "staff-actor": 0,
    "record-name": 0,
    "contact-details": 0,
  };
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
          let blocks: unknown;
          try {
            blocks = (JSON.parse(fx.reply) as { blocks: unknown }).blocks;
          } catch {
            continue;
          }
          const parsed = TailoredSection.shape.blocks.safeParse(blocks);
          if (!parsed.success) continue;
          fixtures += 1;
          const text = blocksToText(parsed.data);
          const counts: LintV2Counts = {
            "indicator-restatement": lintIndicatorRestatement(
              text,
              indicatorsOf(fx.request.user),
            ).length,
            "vague-time": lintVagueTime(text).length,
            "staff-actor": lintStaffActor(text, { allowedPhrases: allowed })
              .length,
            "record-name": lintRecordNames(text, known).length,
            "contact-details": lintContactDetails(
              text,
              allowedContactsOf(fx.request.user),
            ).length,
          };
          const key = `${typeId}/${sectionId}`;
          const section = (bySection[key] ??= {
            "indicator-restatement": 0,
            "vague-time": 0,
            "staff-actor": 0,
            "record-name": 0,
            "contact-details": 0,
          });
          let any = false;
          for (const k of Object.keys(counts) as (keyof LintV2Counts)[]) {
            byRule[k] += counts[k];
            section[k] += counts[k];
            if (counts[k] > 0) any = true;
          }
          if (any) failing += 1;
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
