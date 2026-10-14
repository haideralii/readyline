// @vitest-environment node
/**
 * Every recorded fixture replays through the current pipeline (R-5, R-6):
 * no network, deterministic outcomes. The governance "purpose" recording
 * scored grade 11.8, so under the readability gate it must now report a
 * readability problem and fall back (its retry has no fixture); the first
 * behaviour-support "steps" recordings were cut at the 2,000 cap and must
 * be reported as truncations, not as bad JSON.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { briefWithCycles, buildContextPack } from "./context-pack";
import { generateSection } from "./generate-section";
import {
  DEFAULT_FIXTURES_DIR,
  ReplayClient,
  type Fixture,
} from "./model-client";
import { loadReferenceCases } from "./reference-cases";
import { outlineFor, standardsForType } from "./document-model";
import {
  lintCrossReferences,
  lintPlaceholders,
  lintReviewCycles,
  lintTimeframes,
} from "./lint";
import { TailoredSection, blocksToProse, blocksToText } from "./section-schema";
import { readability } from "@/lib/text/readability";

const report = JSON.parse(
  readFileSync(
    join(DEFAULT_FIXTURES_DIR, "recordings-2026-10-12.json"),
    "utf8",
  ),
) as {
  recordings: { caseId: string; documentTypeId: string; sectionId: string }[];
};

const dataset = getStandardsDataset();
const cases = loadReferenceCases();
const allowed = dataset.registrationGroups.map((g) => g.name);
const client = new ReplayClient();

function replay(caseId: string, typeId: string, sectionId: string) {
  const c = cases.find((x) => x.id === caseId)!;
  const type = documentTypeById(typeId)!;
  const section = sectionsFor(type).find((s) => s.id === sectionId)!;
  const pack = buildContextPack({
    answers: c.answers,
    result: c.result,
    dataset,
    type,
    section,
  });
  return generateSection({
    pack,
    client,
    model: "claude-sonnet-5-5",
    allowedPhrases: allowed,
  });
}

describe("recorded fixtures replay through the current gate", () => {
  it("the sole-trader incident policy statement still passes and scores within the target", async () => {
    const out = await replay(
      "verification-sole-trader",
      "incident-management-policy-and-register",
      "policy-statement",
    );
    expect(out.status).toBe("generated");
    // One attempt, or two when the recorded first reply was rejected and its retry passes.
    expect(out.attempts).toBeLessThanOrEqual(2);
    expect(out.readability?.grade).toBeLessThanOrEqual(11);
  });

  it("the governance purpose recording fails the readability gate on its text (R-5); its request is orphaned by the D-041 purpose brief", () => {
    const dir = join(DEFAULT_FIXTURES_DIR, "governance-policy", "purpose");
    const fixtures = readdirSync(dir).map(
      (f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture,
    );
    expect(fixtures.length).toBeGreaterThan(0);
    // The orphaned batch-8 recording (grade 11.8) stays beside the batch-16 one that passes.
    const grades = fixtures.map((fx) => {
      const blocks = TailoredSection.shape.blocks.parse(
        (JSON.parse(fx.reply) as { blocks: unknown }).blocks,
      );
      return readability(blocksToProse(blocks));
    });
    expect(grades.some((g) => g.grade === 11.8 && g.level === "fail")).toBe(
      true,
    );
  });
  it("the first behaviour-support steps recordings stay on disk as truncations; the split sub-sections have no fixture until recorded (R-6, D-041)", async () => {
    const dir = join(
      DEFAULT_FIXTURES_DIR,
      "behaviour-support-plan-implementation-procedure",
      "steps",
    );
    const cut = readdirSync(dir)
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture)
      .filter((f) => f.usage?.outputTokens === f.request.maxTokens);
    expect(cut.length).toBeGreaterThan(0);
    const type = documentTypeById(
      "behaviour-support-plan-implementation-procedure",
    )!;
    const ids = sectionsFor(type).map((s) => s.id);
    expect(ids).not.toContain("steps");
    expect(ids.filter((id) => id.startsWith("steps-"))).toHaveLength(3);
    for (const id of ids.filter((x) => x.startsWith("steps-"))) {
      const out = await replay("behaviour-support-company", type.id, id);
      expect(["generated", "fallback"]).toContain(out.status);
      if (out.status === "fallback")
        expect(out.problems.join("\n")).toMatch(
          /No recorded fixture|truncated at \d+ output tokens/,
        );
    }
  });

  it("R-7: lists which recorded replies restate a statutory timeframe", () => {
    const results: Record<string, string[]> = {};
    for (const typeId of readdirSync(DEFAULT_FIXTURES_DIR)) {
      const typeDir = join(DEFAULT_FIXTURES_DIR, typeId);
      if (typeId.endsWith(".json") || typeId.endsWith(".md")) continue;
      for (const sectionId of readdirSync(typeDir)) {
        for (const file of readdirSync(join(typeDir, sectionId))) {
          const fx = JSON.parse(
            readFileSync(join(typeDir, sectionId, file), "utf8"),
          ) as Fixture;
          let blocks: unknown;
          try {
            blocks = (JSON.parse(fx.reply) as { blocks: unknown }).blocks;
          } catch {
            continue; // truncated or invalid replies never reach the lint
          }
          const parsed = TailoredSection.shape.blocks.safeParse(blocks);
          if (!parsed.success) continue;
          const hits = lintTimeframes(blocksToText(parsed.data)).map(
            (h) => h.match,
          );
          if (hits.length) results[`${typeId}/${sectionId}`] = hits;
        }
      }
    }
    // Batch 11: sections 5 and 6 of the sole-trader incident policy restated the
    // 24-hour and 5-business-day rules. Batch 16 adds five rejected first replies
    // whose recorded retries pass ("within 5 business days", "Within 1 business
    // day" and the like); every fixture here is a first attempt the gate refused.
    // D-049 (batch 17): a timeframe counts only with a statutory anchor in its
    // sentence, so the continuity plan's own promises, the induction steps and
    // the complaints procedure's working-days line no longer appear.
    expect(Object.keys(results).sort()).toEqual([
      "incident-management-policy-and-register/how-we-do-this",
      "incident-management-policy-and-register/responsibilities",
      "safeguarding-policy/responding",
    ]);
  });
  it("every fixture on disk is listed in the recordings report", () => {
    const listed = new Set(
      report.recordings.map((r) => `${r.documentTypeId}/${r.sectionId}`),
    );
    for (const typeId of readdirSync(DEFAULT_FIXTURES_DIR)) {
      const typeDir = join(DEFAULT_FIXTURES_DIR, typeId);
      if (!existsSync(join(typeDir))) continue;
      if (typeId.endsWith(".json") || typeId.endsWith(".md")) continue;
      for (const sectionId of readdirSync(typeDir)) {
        expect(
          listed.has(`${typeId}/${sectionId}`),
          `${typeId}/${sectionId}`,
        ).toBe(true);
      }
    }
  });
  it("R-8: lists which recorded replies state a review cycle that is not a document fact", () => {
    const cycles = { policyMonths: 12, registerMonths: 3 };
    const results: Record<string, string[]> = {};
    for (const typeId of readdirSync(DEFAULT_FIXTURES_DIR)) {
      const typeDir = join(DEFAULT_FIXTURES_DIR, typeId);
      if (typeId.endsWith(".json") || typeId.endsWith(".md")) continue;
      for (const sectionId of readdirSync(typeDir)) {
        for (const file of readdirSync(join(typeDir, sectionId))) {
          const fx = JSON.parse(
            readFileSync(join(typeDir, sectionId, file), "utf8"),
          ) as Fixture;
          let blocks: unknown;
          try {
            blocks = (JSON.parse(fx.reply) as { blocks: unknown }).blocks;
          } catch {
            continue;
          }
          const parsed = TailoredSection.shape.blocks.safeParse(blocks);
          if (!parsed.success) continue;
          const hits = lintReviewCycles(blocksToText(parsed.data), cycles).map(
            (h) => h.match,
          );
          // Keyed by section, not by fixture hash: a re-key (D-542) or a re-recording changes the hashes, not the finding.
          if (hits.length) {
            const key = `${typeId}/${sectionId}`;
            results[key] = [...(results[key] ?? []), ...hits].sort();
          }
        }
      }
    }
    // Only the batch-11 and batch-12 recordings of sections 5 and 6 of the sole-trader incident policy (orphaned by the R-8 brief, kept as history) give the register a 12-month cycle; their batch-13 re-recordings pass.
    const sections = [
      ...new Set(
        Object.keys(results).map((k) => k.split("/").slice(0, 2).join("/")),
      ),
    ].sort();
    // Batch 15 adds the rejected first reply of the policy statement ("this
    // policy and our register every 12 months"), kept because its retry fixture
    // is what the replay passes through. Batch 16 adds three more rejected first
    // replies (a register reviewed every 12 months, "the whole register at least
    // every 12 months", "check the register every month"); their retries pass.
    // Batch 17 adds the governance policy statement's refused first reply (register every 12 months).
    expect(sections).toEqual([
      "ai-and-digital-data-handling-procedure/steps",
      "governance-policy/policy-statement",
      "incident-management-policy-and-register/how-we-do-this",
      "incident-management-policy-and-register/policy-statement",
      "incident-management-policy-and-register/procedure",
      "incident-management-policy-and-register/responsibilities",
      "worker-screening-and-recruitment-procedure/steps",
    ]);
  });

  it("R-9: lists which recorded replies cross-reference a section outside their document's outline", () => {
    const results: Record<string, string[]> = {};
    for (const typeId of readdirSync(DEFAULT_FIXTURES_DIR)) {
      const typeDir = join(DEFAULT_FIXTURES_DIR, typeId);
      if (typeId.endsWith(".json") || typeId.endsWith(".md")) continue;
      const outline = outlineFor(documentTypeById(typeId)!);
      for (const sectionId of readdirSync(typeDir)) {
        for (const file of readdirSync(join(typeDir, sectionId))) {
          const fx = JSON.parse(
            readFileSync(join(typeDir, sectionId, file), "utf8"),
          ) as Fixture;
          let blocks: unknown;
          try {
            blocks = (JSON.parse(fx.reply) as { blocks: unknown }).blocks;
          } catch {
            continue;
          }
          const parsed = TailoredSection.shape.blocks.safeParse(blocks);
          if (!parsed.success) continue;
          const hits = lintCrossReferences(
            blocksToText(parsed.data),
            outline,
          ).map((h) => h.match);
          // Keyed by section, not by fixture hash: a re-key (D-542) or a re-recording changes the hashes, not the finding.
          if (hits.length) {
            const key = `${typeId}/${sectionId}`;
            results[key] = [...(results[key] ?? []), ...hits].sort();
          }
        }
      }
    }
    const sections = [
      ...new Set(
        Object.keys(results).map((k) => k.split("/").slice(0, 2).join("/")),
      ),
    ].sort();
    // Batch 15 (D-531): the model quoted the house style's generic structure
    // ("section 3 What we do", "section 4 Records we keep") and, in the
    // behaviour-support procedure, the incident policy's section numbers.
    expect({ sections, results }).toEqual({
      sections: [
        "behaviour-support-plan-implementation-procedure/steps-getting-the-plan",
        "behaviour-support-plan-implementation-procedure/steps-monitoring-reporting-and-review",
        "behaviour-support-plan-implementation-procedure/steps-putting-the-plan-into-practice",
        "complaints-management-policy-and-register/responsibilities",
        "incident-management-policy-and-register/how-we-do-this",
      ],
      results: {
        "behaviour-support-plan-implementation-procedure/steps-getting-the-plan":
          ["section 7 Reportable incidents for what we"],
        "behaviour-support-plan-implementation-procedure/steps-monitoring-reporting-and-review":
          [
            "section 6 Reporting to the Commission for",
            "section 7 Reportable incidents straight away",
          ],
        "behaviour-support-plan-implementation-procedure/steps-putting-the-plan-into-practice":
          ["section 7 Reportable incidents", "section 8 Monitoring and review"],
        "complaints-management-policy-and-register/responsibilities": [
          "section 3 What we do",
          "section 3 What we do",
        ],
        "incident-management-policy-and-register/how-we-do-this": [
          "section 4 Records we keep",
        ],
      },
    });
  });

  it("R-12: lists which recorded replies ask the provider for a standard or indicator", () => {
    const results: Record<string, string[]> = {};
    for (const typeId of readdirSync(DEFAULT_FIXTURES_DIR)) {
      const typeDir = join(DEFAULT_FIXTURES_DIR, typeId);
      if (typeId.endsWith(".json") || typeId.endsWith(".md")) continue;
      for (const sectionId of readdirSync(typeDir)) {
        for (const file of readdirSync(join(typeDir, sectionId))) {
          const fx = JSON.parse(
            readFileSync(join(typeDir, sectionId, file), "utf8"),
          ) as Fixture;
          let blocks: unknown;
          try {
            blocks = (JSON.parse(fx.reply) as { blocks: unknown }).blocks;
          } catch {
            continue;
          }
          const parsed = TailoredSection.shape.blocks.safeParse(blocks);
          if (!parsed.success) continue;
          const hits = lintPlaceholders(blocksToText(parsed.data)).map((h) =>
            h.match.slice(0, 40),
          );
          if (hits.length) results[`${typeId}/${sectionId}`] = hits;
        }
      }
    }
    // Batch 16 recordings for documents kept on an obligation (D-045) asked for a
    // standard because their briefs still named one; D-050 re-keys those sections.
    expect(Object.keys(results).sort()).toEqual([
      "ai-use-and-governance-policy/policy-statement",
      "ai-use-and-governance-policy/purpose",
      "continuity-of-supports-plan/purpose",
      "governance-policy/policy-statement",
      "participant-rights-and-choice-policy/policy-statement",
      "records-management-policy/policy-statement",
    ]);
  });

  it("D-050: lists the sole-trader sections re-keyed by the no-standard briefs", () => {
    const c = cases.find((x) => x.id === "verification-sole-trader")!;
    const rekeyed: string[] = [];
    for (const doc of [
      ...c.result.documents.map((d) => d.id),
      "practice-standards-self-assessment",
    ]) {
      const type = documentTypeById(doc)!;
      for (const section of sectionsFor(type)) {
        if (section.mode !== "tailored") continue;
        const pack = buildContextPack({
          answers: c.answers,
          result: c.result,
          dataset,
          type,
          section,
        });
        if (
          pack.section.brief !==
          briefWithCycles(section.brief, pack.reviewCycles)
        )
          rekeyed.push(`${doc}/${section.id}`);
      }
    }
    expect(rekeyed.sort()).toEqual(
      [
        "conflict-of-interest-policy/policy-statement",
        "conflict-of-interest-policy/purpose",
        "continuity-of-supports-plan/purpose",
        "emergency-and-disaster-management-plan/purpose",
        "governance-policy/policy-statement",
        "governance-policy/purpose",
        "participant-rights-and-choice-policy/policy-statement",
        "participant-rights-and-choice-policy/purpose",
        "privacy-and-information-management-policy/policy-statement",
        "privacy-and-information-management-policy/purpose",
        "records-management-policy/policy-statement",
        "records-management-policy/purpose",
        "safeguarding-policy/policy-statement",
        "safeguarding-policy/purpose",
      ].sort(),
    );
  });

  it("R-10: lists the recorded sections whose standards block changes under module filtering", () => {
    const changed = new Set<string>();
    for (const r of report.recordings) {
      const c = cases.find((x) => x.id === r.caseId)!;
      const type = documentTypeById(r.documentTypeId)!;
      if (type.standardsSelection === "all-applicable") continue;
      const filtered = standardsForType(type, dataset, c.result).map(
        (s) => s.id,
      );
      if (filtered.join() !== type.standards.join())
        changed.add(
          `${r.caseId}/${r.documentTypeId}: ${type.standards.filter((id) => !filtered.includes(id)).join(", ")} removed`,
        );
    }
    // Batch 15 (D-531): the verification case loses the core-module twin of
    // each verification standard; the behaviour-support case loses the
    // specialist-behaviour-support (sbs) standards because it implements plans
    // (ibsp) rather than writing them.
    // Batch 16: the whole sole-trader set is recorded, so every document whose
    // listed standards include core-module ones appears here (D-045 says why they stay).
    expect([...changed].sort()).toEqual([
      "behaviour-support-company/behaviour-support-plan-implementation-procedure: sbs.behaviour-support-in-the-ndis, sbs.functional-behaviour-assessments-and-behaviour-support-plans, sbs.supporting-the-implementation-of-the-behaviour-support-plan, sbs.behaviour-support-plan-monitoring-and-review, sbs.interim-behaviour-support-plans removed",
      "verification-sole-trader/ai-and-digital-data-handling-procedure: core.governance.information-management, core.rights.privacy-and-dignity removed",
      "verification-sole-trader/ai-use-and-governance-policy: core.governance.governance-and-operational-management, core.governance.information-management, core.rights.privacy-and-dignity removed",
      "verification-sole-trader/code-of-conduct-acknowledgement: core.governance.human-resource-management, core.rights.violence-abuse-neglect-exploitation-and-discrimination removed",
      "verification-sole-trader/complaints-management-policy-and-register: core.governance.feedback-and-complaints-management removed",
      "verification-sole-trader/conflict-of-interest-policy: core.governance.governance-and-operational-management, core.rights.independence-and-informed-choice removed",
      "verification-sole-trader/continuity-of-supports-plan: core.governance.continuity-of-supports removed",
      "verification-sole-trader/emergency-and-disaster-management-plan: core.governance.emergency-and-disaster-management removed",
      "verification-sole-trader/governance-policy: core.governance.governance-and-operational-management, core.governance.quality-management removed",
      "verification-sole-trader/incident-management-policy-and-register: core.governance.incident-management removed",
      "verification-sole-trader/induction-and-training-procedure-and-register: core.governance.human-resource-management removed",
      "verification-sole-trader/participant-rights-and-choice-policy: core.rights.person-centred-supports, core.rights.individual-values-and-beliefs, core.rights.independence-and-informed-choice removed",
      "verification-sole-trader/privacy-and-information-management-policy: core.rights.privacy-and-dignity, core.governance.information-management removed",
      "verification-sole-trader/records-management-policy: core.governance.information-management removed",
      "verification-sole-trader/risk-management-policy-and-register: core.governance.risk-management removed",
      "verification-sole-trader/safeguarding-policy: core.rights.violence-abuse-neglect-exploitation-and-discrimination removed",
      "verification-sole-trader/service-agreement-template: core.provision.service-agreements-with-participants, core.provision.access-to-supports removed",
      "verification-sole-trader/worker-screening-and-recruitment-procedure: core.governance.human-resource-management removed",
    ]);
  });

  it("D-043: the behaviour-support monitoring sub-section's monthly reporting cadence is not a review cycle", () => {
    const dir = join(
      DEFAULT_FIXTURES_DIR,
      "behaviour-support-plan-implementation-procedure",
      "steps-monitoring-reporting-and-review",
    );
    const fixtures = readdirSync(dir).map(
      (f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture,
    );
    expect(fixtures.length).toBeGreaterThan(0);
    // The batch-12 recording says monthly reporting applies "every month"; the
    // batch-16 one may word it differently. None may be read as a review cycle.
    const texts = fixtures.map((fx) =>
      blocksToText(
        TailoredSection.shape.blocks.parse(
          (JSON.parse(fx.reply) as { blocks: unknown }).blocks,
        ),
      ),
    );
    expect(texts.some((t) => /every month/i.test(t))).toBe(true);
    for (const text of texts)
      expect(
        lintReviewCycles(text, { policyMonths: 12, registerMonths: 3 }),
      ).toEqual([]);
  });
});
