/**
 * The generator exam (standing backlog 9, D-552): a fixed set of questions a
 * generated pack must answer correctly, each mapped to a lint or a fixture
 * assertion with the official source beside it. The exam runs over a pack
 * built the way the job builds one (skeleton plus the tailored sections
 * through the model client given: replay in CI, live by hand or on the
 * monthly workflow) and never over register text. A question that must
 * pass and fails blocks a prompt-version bump (exam.test.ts).
 */
import { z } from "zod";
import { findProhibitedClaims } from "@/lib/claims";
import { getStandardsDataset } from "@/lib/standards/dataset";
import examJson from "../../../data/generator-exam.json";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack, PROMPT_VERSION } from "./context-pack";
import { buildSkeleton, type DocumentModel } from "./document-model";
import { buildProviderFacts } from "./facts";
import { applyFacts } from "./facts-fill";
import { COMMISSION_CONTACT_STRINGS } from "./fixed-extras";
import { generateSection } from "./generate-section";
import {
  contactStringsIn,
  lintContactDetails,
  lintCrossReferences,
  lintErrors,
  lintRecordNames,
  lintStaffActor,
  lintText,
  lintTimeframes,
  lintVagueTime,
} from "./lint";
import type { ModelClient } from "./model-client";
import { knownRecordNames } from "./record-names";
import { loadReferenceCases } from "./reference-cases";
import { blocksToText } from "./section-schema";
import { auditOrder } from "./set-order";

/** The self-assessment closes every set (the job adds it after the result's documents). */
const SELF_ASSESSMENT_ID = "practice-standards-self-assessment";

export const EXAM_GROUPS = [
  "time-frames",
  "definitions",
  "names",
  "state-facts",
  "contact",
  "refusals",
  "consistency",
] as const;
export type ExamGroup = (typeof EXAM_GROUPS)[number];

const Scope = z
  .object({
    /** "all", or the document type ids the question applies to. */
    documents: z.union([z.literal("all"), z.array(z.string().min(1)).min(1)]),
    /** "all", the fixed sections, the tailored sections, or named section ids. */
    sections: z.union([
      z.enum(["all", "fixed", "tailored"]),
      z.array(z.string().min(1)).min(1),
    ]),
  })
  .strict();

const Check = z.discriminatedUnion("kind", [
  // Every value appears in the scoped text; "where" says whether one document in scope or every one must carry it.
  z
    .object({
      kind: z.literal("contains"),
      values: z.array(z.string().min(1)).min(1),
      where: z.enum(["any", "every"]).default("any"),
    })
    .strict(),
  // The pattern matches somewhere in scope ("any") or in every document in scope.
  z
    .object({
      kind: z.literal("regex"),
      pattern: z.string().min(1),
      flags: z.string().optional(),
      where: z.enum(["any", "every"]).default("any"),
    })
    .strict(),
  // The pattern matches nowhere in scope.
  z
    .object({
      kind: z.literal("absent"),
      pattern: z.string().min(1),
      flags: z.string().optional(),
    })
    .strict(),
  // A named lint finds nothing in the scoped sections.
  z
    .object({
      kind: z.literal("lint"),
      lint: z.enum([
        "timeframes",
        "cross-references",
        "record-names",
        "contact-details",
        "vague-time",
        "staff-actor",
        "terminology",
        "claims",
      ]),
    })
    .strict(),
  // A document type is in the pack, or is not.
  z
    .object({
      kind: z.literal("document-present"),
      documentTypeId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("document-absent"),
      documentTypeId: z.string().min(1),
    })
    .strict(),
  // No section in scope is still an undrafted placeholder.
  z.object({ kind: z.literal("no-placeholder-sections") }).strict(),
]);

export const ExamQuestion = z
  .object({
    id: z.string().regex(/^Q\d{2}$/),
    group: z.enum(EXAM_GROUPS),
    question: z.string().min(10),
    scope: Scope,
    check: Check,
    /** The lint or fixture assertion this question stands on. */
    mapsTo: z.string().min(1),
    source: z
      .object({ title: z.string().min(1), url: z.string().min(1) })
      .strict(),
    /** A must-pass question that fails blocks a prompt-version bump; the rest are reported. */
    mustPass: z.boolean(),
    note: z.string().optional(),
    /** The watch change that added or last changed this question, when one did. */
    watchChangeId: z.string().optional(),
  })
  .strict();
export type ExamQuestion = z.infer<typeof ExamQuestion>;

const Exam = z.object({
  $comment: z.string(),
  questions: z.array(ExamQuestion),
});

export function loadExamQuestions(): ExamQuestion[] {
  return Exam.parse(examJson).questions;
}

export type ExamSection = {
  id: string;
  number: string | null;
  heading: string;
  mode: "fixed" | "tailored";
  status: string;
  text: string;
};
export type ExamDocument = {
  typeId: string;
  title: string;
  sections: ExamSection[];
  outline: { number: string; heading: string }[];
};
export type ExamPack = {
  caseId: string;
  tradingName: string;
  states: string[];
  documents: ExamDocument[];
  /** How the tailored sections were produced. */
  mode: "replay" | "live" | "skeleton";
  model: string;
};

export type ExamResult = {
  id: string;
  group: ExamGroup;
  outcome: "pass" | "fail" | "not-applicable";
  evidence: string;
  mustPass: boolean;
};

/** Builds the pack the exam reads: the skeleton for each document in the case's set, tailored sections through the client. */
export async function buildExamPack(input: {
  caseId: string;
  client: ModelClient | null;
  model: string;
  generatedAt?: string;
}): Promise<ExamPack> {
  const dataset = getStandardsDataset();
  const c = loadReferenceCases().find((x) => x.id === input.caseId);
  if (!c) throw new Error(`unknown reference case ${input.caseId}`);
  const facts = buildProviderFacts(c.answers, c.result);
  const allowed = dataset.registrationGroups.map((g) => g.name);
  const typeIds = auditOrder([
    ...c.result.documents.map((d) => d.id),
    SELF_ASSESSMENT_ID,
  ]);
  const documents: ExamDocument[] = [];
  for (const typeId of typeIds) {
    const type = documentTypeById(typeId);
    if (!type) continue;
    const skeleton = buildSkeleton({
      type,
      facts,
      dataset,
      result: c.result,
      version: "1",
      generatedAt: input.generatedAt ?? "2026-10-14",
    });
    const filled: DocumentModel = {
      ...skeleton,
      sections: [...skeleton.sections],
    };
    if (input.client) {
      for (let i = 0; i < filled.sections.length; i += 1) {
        const s = filled.sections[i];
        const spec = sectionsFor(type).find((x) => x.id === s.id);
        if (!spec || spec.mode !== "tailored") continue;
        const out = await generateSection({
          pack: buildContextPack({
            answers: c.answers,
            result: c.result,
            dataset,
            type,
            section: spec,
          }),
          client: input.client,
          model: input.model,
          allowedPhrases: allowed,
        });
        filled.sections[i] = { ...s, status: out.status, blocks: out.blocks };
      }
    }
    const model = applyFacts(filled, {});
    documents.push({
      typeId,
      title: model.title,
      sections: model.sections.map((s) => ({
        id: s.id,
        number: s.number ?? null,
        heading: s.heading,
        mode: s.mode,
        status: s.status,
        text: blocksToText(s.blocks),
      })),
      outline: model.sections
        .filter((s) => s.number)
        .map((s) => ({ number: s.number!, heading: s.heading })),
    });
  }
  return {
    caseId: c.id,
    tradingName: facts.tradingName,
    states: c.answers.business.states,
    documents,
    mode: input.client
      ? input.client.mode === "replay"
        ? "replay"
        : "live"
      : "skeleton",
    model: input.model,
  };
}

function inScope(pack: ExamPack, q: ExamQuestion) {
  const docs =
    q.scope.documents === "all"
      ? pack.documents
      : pack.documents.filter((d) => q.scope.documents.includes(d.typeId));
  const sectionsOf = (d: ExamDocument) =>
    q.scope.sections === "all"
      ? d.sections
      : q.scope.sections === "fixed"
        ? d.sections.filter((s) => s.mode === "fixed")
        : q.scope.sections === "tailored"
          ? d.sections.filter((s) => s.mode === "tailored")
          : d.sections.filter((s) => q.scope.sections.includes(s.id));
  return docs
    .map((d) => ({ doc: d, sections: sectionsOf(d) }))
    .filter((x) => x.sections.length > 0);
}

const fill = (value: string, pack: ExamPack) =>
  value.replace(/\{\{tradingName\}\}/g, pack.tradingName);

/** Answers every question against the pack; pure apart from reading the dataset's names. */
export function runExam(
  pack: ExamPack,
  questions: ExamQuestion[],
): ExamResult[] {
  const dataset = getStandardsDataset();
  const allowedPhrases = dataset.registrationGroups.map((g) => g.name);
  const known = knownRecordNames();
  const allowedContacts = [...COMMISSION_CONTACT_STRINGS];
  return questions.map((q) => {
    const base = { id: q.id, group: q.group, mustPass: q.mustPass };
    const scoped = inScope(pack, q);
    const check = q.check;
    if (check.kind === "document-present" || check.kind === "document-absent") {
      const present = pack.documents.some(
        (d) => d.typeId === check.documentTypeId,
      );
      const ok = check.kind === "document-present" ? present : !present;
      return {
        ...base,
        outcome: ok ? "pass" : "fail",
        evidence: `${check.documentTypeId} ${present ? "present" : "absent"}`,
      };
    }
    if (scoped.length === 0)
      return {
        ...base,
        outcome: "not-applicable",
        evidence: "no document or section in scope in this pack",
      };
    const perDoc = scoped.map((x) => ({
      doc: x.doc,
      text: x.sections.map((s) => s.text).join("\n"),
      sections: x.sections,
    }));
    if (check.kind === "contains") {
      const values = check.values.map((v) => fill(v, pack));
      const hits = perDoc.map((d) => values.every((v) => d.text.includes(v)));
      const ok =
        check.where === "every" ? hits.every(Boolean) : hits.some(Boolean);
      const missing = perDoc
        .filter((_, i) => !hits[i])
        .map((d) => d.doc.typeId);
      return {
        ...base,
        outcome: ok ? "pass" : "fail",
        evidence: ok
          ? `found in ${hits.filter(Boolean).length} of ${perDoc.length} documents`
          : `missing in ${missing.join(", ")}`,
      };
    }
    if (check.kind === "regex") {
      const re = new RegExp(fill(check.pattern, pack), check.flags ?? "");
      const hits = perDoc.map((d) => re.test(d.text));
      const ok =
        check.where === "every" ? hits.every(Boolean) : hits.some(Boolean);
      const missing = perDoc
        .filter((_, i) => !hits[i])
        .map((d) => d.doc.typeId);
      return {
        ...base,
        outcome: ok ? "pass" : "fail",
        evidence: ok
          ? `matched in ${hits.filter(Boolean).length} of ${perDoc.length} documents`
          : `no match in ${missing.join(", ")}`,
      };
    }
    if (check.kind === "absent") {
      const re = new RegExp(fill(check.pattern, pack), check.flags ?? "");
      const found: string[] = [];
      for (const d of perDoc)
        for (const s of d.sections) {
          const m = re.exec(s.text);
          if (m) found.push(`${d.doc.typeId}/${s.id}: "${m[0].slice(0, 60)}"`);
        }
      return {
        ...base,
        outcome: found.length === 0 ? "pass" : "fail",
        evidence:
          found.length === 0
            ? `absent from ${perDoc.length} documents`
            : found.slice(0, 4).join("; "),
      };
    }
    if (check.kind === "no-placeholder-sections") {
      const bad = perDoc.flatMap((d) =>
        d.sections
          .filter((s) => s.status === "placeholder")
          .map((s) => `${d.doc.typeId}/${s.id}`),
      );
      return {
        ...base,
        outcome: bad.length === 0 ? "pass" : "fail",
        evidence:
          bad.length === 0
            ? "every section drafted"
            : bad.slice(0, 6).join(", "),
      };
    }
    // lint
    const findings: string[] = [];
    for (const d of perDoc) {
      // A tailored section may quote a contact detail the pack's own fixed text carries (the provider's, D-546).
      const fixedText = d.doc.sections
        .filter((s) => s.mode === "fixed")
        .map((s) => s.text)
        .join("\n");
      const allowedHere = [
        ...allowedContacts,
        ...contactStringsIn(fixedText).map((c) => c.value),
      ];
      for (const s of d.sections) {
        const text = s.text;
        const out: { rule: string; match: string }[] =
          check.lint === "timeframes"
            ? lintTimeframes(text)
            : check.lint === "cross-references"
              ? lintCrossReferences(text, d.doc.outline)
              : check.lint === "record-names"
                ? lintRecordNames(text, known)
                : check.lint === "contact-details"
                  ? lintContactDetails(text, allowedHere)
                  : check.lint === "vague-time"
                    ? lintVagueTime(text)
                    : check.lint === "staff-actor"
                      ? lintStaffActor(text, { allowedPhrases })
                      : check.lint === "terminology"
                        ? lintErrors(lintText(text, { allowedPhrases }))
                        : findProhibitedClaims(text);
        for (const f of out)
          findings.push(
            `${d.doc.typeId}/${s.id}: ${f.rule} "${f.match.slice(0, 50)}"`,
          );
      }
    }
    return {
      ...base,
      outcome: findings.length === 0 ? "pass" : "fail",
      evidence:
        findings.length === 0
          ? `clean over ${perDoc.reduce((n, d) => n + d.sections.length, 0)} sections`
          : `${findings.length} finding(s): ${findings.slice(0, 4).join("; ")}`,
    };
  });
}

export type ExamSummary = {
  date: string;
  promptVersion: string;
  model: string;
  mode: ExamPack["mode"];
  caseId: string;
  questions: number;
  passed: number;
  failed: number;
  notApplicable: number;
  /** Failures on must-pass questions: these block a prompt-version bump. */
  mustPassFailed: string[];
  byGroup: Record<
    ExamGroup,
    { passed: number; failed: number; notApplicable: number }
  >;
  results: ExamResult[];
};

export function summarise(
  pack: ExamPack,
  results: ExamResult[],
  date: string,
): ExamSummary {
  const byGroup = Object.fromEntries(
    EXAM_GROUPS.map((g) => [g, { passed: 0, failed: 0, notApplicable: 0 }]),
  ) as ExamSummary["byGroup"];
  for (const r of results) {
    if (r.outcome === "pass") byGroup[r.group].passed += 1;
    else if (r.outcome === "fail") byGroup[r.group].failed += 1;
    else byGroup[r.group].notApplicable += 1;
  }
  return {
    date,
    promptVersion: PROMPT_VERSION,
    model: pack.model,
    mode: pack.mode,
    caseId: pack.caseId,
    questions: results.length,
    passed: results.filter((r) => r.outcome === "pass").length,
    failed: results.filter((r) => r.outcome === "fail").length,
    notApplicable: results.filter((r) => r.outcome === "not-applicable").length,
    mustPassFailed: results
      .filter((r) => r.mustPass && r.outcome === "fail")
      .map((r) => r.id),
    byGroup,
    results,
  };
}

/** The report under product/qa/generator-exam/<date>.md. */
export function renderExamReport(
  summary: ExamSummary,
  questions: ExamQuestion[],
): string {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const lines = [
    `# Generator exam, ${summary.date}`,
    "",
    `Pack: the ${summary.caseId} reference set, tailored sections by ${summary.mode === "replay" ? "replay of the recorded fixtures (no model call)" : summary.mode === "live" ? `the live model ${summary.model}` : "the skeleton only (fixed text)"}; prompt version ${summary.promptVersion}.`,
    "",
    `**${summary.passed} passed, ${summary.failed} failed, ${summary.notApplicable} not applicable of ${summary.questions}.** Must-pass failures: ${summary.mustPassFailed.length ? summary.mustPassFailed.join(", ") : "none"}${summary.mustPassFailed.length ? " (a prompt-version bump is blocked until these pass)" : ""}.`,
    "",
    "| Group | Passed | Failed | Not applicable |",
    "| --- | ---: | ---: | ---: |",
    ...EXAM_GROUPS.map(
      (g) =>
        `| ${g} | ${summary.byGroup[g].passed} | ${summary.byGroup[g].failed} | ${summary.byGroup[g].notApplicable} |`,
    ),
    "",
    "| Id | Group | Result | Question | Maps to | Evidence | Source |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...summary.results.map((r) => {
      const q = byId.get(r.id)!;
      const result =
        r.outcome === "pass"
          ? "pass"
          : r.outcome === "fail"
            ? r.mustPass
              ? "FAIL (must pass)"
              : "fail (reported)"
            : "n/a";
      return `| ${r.id} | ${r.group} | ${result} | ${q.question} | ${q.mapsTo} | ${r.evidence.replace(/\|/g, "\\|")} | [${q.source.title}](${q.source.url}) |`;
    }),
    "",
    'Questions marked "fail (reported)" are known gaps in the recorded replies (the recording plan\'s groups) and do not block; a "FAIL (must pass)" does.',
    "",
  ];
  return lines.join("\n");
}
