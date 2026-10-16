// @vitest-environment node
/** REQ-027 D-2716, D-2726: the sole-trader flag is the business structure alone, whatever the worker count. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StandardsDataset } from "@/lib/standards/schema";
import { buildResult } from "./result";
import { BusinessStructureAnswer, QuestionnaireAnswers } from "./schema";
import { validAnswers } from "./schema.test";

const dataset = StandardsDataset.parse(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "data/standards.json"), "utf8"),
  ),
);

function flags(structure: string, workerCount: number) {
  const out = buildResult(
    dataset,
    QuestionnaireAnswers.parse({
      ...validAnswers,
      business: { ...validAnswers.business, structure },
      workforce: { ...validAnswers.workforce, workerCount },
    }),
  );
  if (!out.ok) throw new Error(out.message);
  return out.result.flags;
}

describe("flags.soleTrader", () => {
  it("is true for a sole trader with one worker and with three, and false for every other structure", () => {
    expect(flags("sole-trader", 1).soleTrader).toBe(true);
    expect(flags("sole-trader", 3).soleTrader).toBe(true);
    for (const s of BusinessStructureAnswer.options)
      if (s !== "sole-trader") expect(flags(s, 1).soleTrader, s).toBe(false);
  });
});
