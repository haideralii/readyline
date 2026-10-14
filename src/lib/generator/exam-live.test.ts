// @vitest-environment node
/**
 * The live exam (standing backlog 9, D-552): the sole-trader pack written by
 * the model, then the sixty questions. Skipped unless GENERATION_EXAM_LIVE=1
 * and the Anthropic variables exist, so CI never calls the model by
 * accident; the monthly workflow and a hand run set them. Replies are
 * recorded into out/generator-exam/fixtures (never the committed fixtures)
 * and the report is written to out/generator-exam/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildExamPack,
  loadExamQuestions,
  renderExamReport,
  runExam,
  summarise,
} from "./exam";
import { createModelClient } from "./model-client";

const enabled =
  process.env.GENERATION_EXAM_LIVE === "1" &&
  Boolean(process.env.ANTHROPIC_API_KEY?.trim()) &&
  Boolean(process.env.ANTHROPIC_MODEL?.trim());

describe.skipIf(!enabled)("the generator exam, live (backlog 9)", () => {
  it("writes the sole-trader pack with the live model and answers every must-pass question", async () => {
    const dir = "out/generator-exam";
    mkdirSync(`${dir}/fixtures`, { recursive: true });
    const client = createModelClient(
      { ...process.env, GENERATION_RECORD: "1" },
      `${dir}/fixtures`,
    );
    expect(client.mode).toBe("record");
    const model = process.env.ANTHROPIC_MODEL!.trim();
    const pack = await buildExamPack({
      caseId: "verification-sole-trader",
      client,
      model,
    });
    const questions = loadExamQuestions();
    const results = runExam(pack, questions);
    const date = new Date().toISOString().slice(0, 10);
    const summary = summarise({ ...pack, mode: "live" }, results, date);
    writeFileSync(
      `${dir}/${date}-live.md`,
      renderExamReport(summary, questions),
    );
    writeFileSync(
      `${dir}/latest-live.json`,
      JSON.stringify(summary, null, 2) + "\n",
    );
    process.stdout.write(
      `Live exam: ${summary.passed} passed, ${summary.failed} failed, ${summary.notApplicable} n/a; must-pass failures: ${summary.mustPassFailed.join(", ") || "none"}\n`,
    );
    expect(summary.mustPassFailed).toEqual([]);
  }, 3_600_000);
});

describe.skipIf(enabled)("the generator exam, live (skipped)", () => {
  it("needs GENERATION_EXAM_LIVE=1, ANTHROPIC_API_KEY and ANTHROPIC_MODEL", () => {
    expect(enabled).toBe(false);
  });
});
