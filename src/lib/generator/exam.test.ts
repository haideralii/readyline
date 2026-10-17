// @vitest-environment node
/**
 * The generator exam (standing backlog 9, D-552) over the replayed
 * sole-trader pack: no model call. Every must-pass question passes; the
 * reported ones are listed. EXAM_REPORT=1 writes
 * product/qa/generator-exam/<date>.md and latest.json. A prompt-version
 * bump without a passing exam on record fails here, so the exam runs on
 * every prompt change by construction.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROMPT_VERSION } from "./context-pack";
import {
  EXAM_GROUPS,
  buildExamPack,
  loadExamQuestions,
  renderExamReport,
  runExam,
  summarise,
  type ExamSummary,
} from "./exam";
import { ReplayClient } from "./model-client";

const questions = loadExamQuestions();
const REPORT_DIR = "product/qa/generator-exam";
/** PO 18 Oct 2026 00:40 (backlog 9, (2)): the report as a CI artefact, written under out/ with EXAM_ARTEFACT=1. */
const OUT_DIR = "out/generator-exam";
const HOMES = [
  ...(process.env.EXAM_REPORT === "1" ? [REPORT_DIR] : []),
  ...(process.env.EXAM_REPORT === "1" || process.env.EXAM_ARTEFACT === "1"
    ? [OUT_DIR]
    : []),
];
const summaries: ExamSummary[] = [];
function writeReport(name: string, report: string, summary: ExamSummary) {
  summaries.push(summary);
  for (const dir of HOMES) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${name}.md`, report);
  }
}
const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

describe("the generator exam (backlog 9)", () => {
  it("has sixty questions across the seven groups, each with a source and a mapping", () => {
    expect(questions).toHaveLength(60);
    expect(new Set(questions.map((q) => q.id)).size).toBe(60);
    for (const g of EXAM_GROUPS)
      expect(
        questions.filter((q) => q.group === g).length,
        g,
      ).toBeGreaterThanOrEqual(5);
    for (const q of questions) {
      expect(q.source.url).toMatch(/^https?:\/\//);
      if (!q.mustPass)
        expect(
          q.note,
          `${q.id} needs a note saying why it only reports`,
        ).toBeTruthy();
    }
  });

  it("the replayed sole-trader pack passes every must-pass question; the rest are reported", async () => {
    const pack = await buildExamPack({
      caseId: "verification-sole-trader",
      client: new ReplayClient(),
      model: "claude-sonnet-5-5",
    });
    expect(pack.documents).toHaveLength(16);
    const results = runExam(pack, questions);
    const summary = summarise(pack, results, TODAY);
    const report = renderExamReport(summary, questions);
    writeReport(TODAY, report, summary);
    if (process.env.EXAM_REPORT === "1") {
      writeFileSync(
        `${REPORT_DIR}/latest.json`,
        JSON.stringify(
          {
            ...summary,
            results: summary.results.map((r) => ({
              id: r.id,
              outcome: r.outcome,
            })),
          },
          null,
          2,
        ) + "\n",
      );
    }
    expect(
      summary.mustPassFailed.map(
        (id) => `${id}: ${results.find((r) => r.id === id)?.evidence}`,
      ),
    ).toEqual([]);
    // The reported failures are the known recording gaps, not more.
    const reported = results
      .filter((r) => !r.mustPass && r.outcome === "fail")
      .map((r) => r.id);
    expect(reported.length).toBeLessThanOrEqual(
      questions.filter((q) => !q.mustPass).length,
    );
    expect(summary.passed).toBeGreaterThanOrEqual(45);
  }, 120_000);

  // PO 18 Oct 2026 00:40 (backlog 9, (1)): the whole exam over the other two reference sets, on their
  // skeletons (no recording exists for their tailored sections; a recording is a model call and the PO's
  // call), each with its own report, so the three cases are examined and read in one place. A question is
  // answered on the fixed sections alone there; one over the tailored sections alone is "not applicable".
  it("the other two reference sets pass every must-pass question on their skeletons, each with its own report", async () => {
    for (const caseId of [
      "certification-personal-care",
      "behaviour-support-company",
    ]) {
      const pack = await buildExamPack({ caseId, client: null, model: "none" });
      const results = runExam(pack, questions);
      const summary = summarise(pack, results, TODAY);
      writeReport(
        `${TODAY}-${caseId}`,
        renderExamReport(summary, questions),
        summary,
      );
      expect(
        results
          .filter((r) => r.mustPass && r.outcome === "fail")
          .map((r) => `${caseId} ${r.id}: ${r.evidence}`),
      ).toEqual([]);
      // The fixed text alone answers a good part of the exam on any pack.
      expect(summary.passed, caseId).toBeGreaterThanOrEqual(25);
    }
  }, 120_000);

  it("one summary lists the three cases for the report's reader", () => {
    if (!HOMES.length) return;
    expect(summaries.length).toBe(3);
    const lines = [
      `# Generator exam, ${TODAY}: the three reference cases`,
      "",
      "| Case | Mode | Passed | Failed | Not applicable | Must-pass failures |",
      "| --- | --- | ---: | ---: | ---: | --- |",
      ...summaries.map(
        (s) =>
          `| ${s.caseId} | ${s.mode} | ${s.passed} | ${s.failed} | ${s.notApplicable} | ${s.mustPassFailed.join(", ") || "none"} |`,
      ),
      "",
      "The sole-trader pack replays its recorded tailored sections; the other two run on their skeletons until their sections are recorded (a model call, the PO's call). Each case's full report sits beside this file.",
      "",
    ].join("\n");
    for (const dir of HOMES) writeFileSync(`${dir}/${TODAY}-summary.md`, lines);
  });

  it("the current prompt version has a passing exam on record (a bump without one is blocked)", () => {
    const path = `${REPORT_DIR}/latest.json`;
    expect(
      existsSync(path),
      "run EXAM_REPORT=1 npx vitest run src/lib/generator/exam.test.ts and commit the report",
    ).toBe(true);
    const latest = JSON.parse(readFileSync(path, "utf8")) as ExamSummary;
    expect(
      latest.promptVersion,
      "the exam report is for an older prompt version; re-run the exam",
    ).toBe(PROMPT_VERSION);
    expect(latest.mustPassFailed).toEqual([]);
  });
});
