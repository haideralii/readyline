/**
 * One tailored section through the pipeline (REQ-005 FR-2 steps 2 to 4,
 * AC-5): prompt, model, JSON parse, schema validation, lint, readability.
 * A failed validation retries once with the problems appended to the prompt
 * (a readability fail adds the house-style instruction, R-5); a reply the
 * model cut off at the output cap is a truncation, reported with its token
 * count and never retried unchanged (R-6, D-040). A second failure, or a
 * truncation, falls back to the fixed placeholder with a visible "Review and
 * complete" marker. Nothing here touches the network directly.
 */
import { lintErrors, lintText, lintTimeframes, type LintFinding } from "./lint";
import type { ContextPack } from "./context-pack";
import type { FixtureLabels, ModelClient, ModelUsage } from "./model-client";
import { buildModelRequest, requestHash } from "./prompts";
import {
  readability,
  READABILITY_FAIL_ABOVE,
  type Readability,
} from "./readability";
import {
  TailoredSection,
  blocksToProse,
  blocksToText,
  type Block,
} from "./section-schema";

export const READABILITY_RETRY_INSTRUCTION =
  "shorten sentences to under 20 words and use common words";

export type SectionOutcome = {
  status: "generated" | "fallback";
  blocks: Block[];
  usedFacts: string[];
  attempts: number;
  hash: string;
  problems: string[];
  readability: Readability | null;
  usage: ModelUsage | null;
  /** Output tokens of a reply the model cut off at the cap, when that is why the section fell back. */
  truncatedAtTokens: number | null;
};

export function fallbackBlocks(pack: ContextPack): Block[] {
  return [
    {
      type: "callout",
      text: "Review and complete: this section could not be drafted automatically.",
    },
    {
      type: "callout",
      text: `[Provider to complete: ${pack.section.heading}. ${pack.section.brief}]`,
    },
  ];
}

/** Strips code fences the model sometimes adds despite the contract. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export type Validation =
  | {
      ok: true;
      section: TailoredSection;
      findings: LintFinding[];
      readability: Readability;
    }
  | { ok: false; problems: string[] };

export function validateReply(
  text: string,
  pack: ContextPack,
  allowedPhrases: readonly string[],
): Validation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    return { ok: false, problems: ["reply was not valid JSON"] };
  }
  const result = TailoredSection.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      problems: result.error.issues.map(
        (i) => `${i.path.join(".") || "section"}: ${i.message}`,
      ),
    };
  }
  if (result.data.sectionId !== pack.section.id) {
    return { ok: false, problems: [`sectionId must be "${pack.section.id}"`] };
  }
  const findings = lintText(blocksToText(result.data.blocks), {
    allowedPhrases,
  });
  const errors = lintErrors(findings);
  if (errors.length) {
    return {
      ok: false,
      problems: errors.map((e) => `${e.rule}: "${e.match}" (${e.why})`),
    };
  }
  // R-5: the house style's hard limit is a validation problem, not a note.
  const score = readability(blocksToProse(result.data.blocks));
  if (score.level === "fail") {
    return {
      ok: false,
      problems: [
        `readability grade ${score.grade} is above ${READABILITY_FAIL_ABOVE}: ${READABILITY_RETRY_INSTRUCTION}`,
      ],
    };
  }
  // R-7: statutory timeframes live in fixed text only; tailored text refers to that section.
  const timeframes = lintTimeframes(blocksToText(result.data.blocks));
  if (timeframes.length) {
    const target = pack.rulesSection
      ? `section ${pack.rulesSection.number} ${pack.rulesSection.heading}`
      : "the fixed section that holds the rule";
    return {
      ok: false,
      problems: [
        `restates a statutory timeframe ("${timeframes[0].match}"): refer to ${target} instead of restating the timeframe`,
      ],
    };
  }
  return { ok: true, section: result.data, findings, readability: score };
}

export async function generateSection(input: {
  pack: ContextPack;
  client: ModelClient;
  model: string;
  allowedPhrases?: readonly string[];
  labels?: FixtureLabels;
}): Promise<SectionOutcome> {
  const { pack, client, model } = input;
  const allowed = input.allowedPhrases ?? [];
  const labels = input.labels ?? {
    documentTypeId: pack.document.id,
    sectionId: pack.section.id,
  };
  const base = buildModelRequest(pack, model);
  const hash = requestHash(base);
  const problems: string[] = [];
  let usage: ModelUsage | null = null;
  let truncatedAtTokens: number | null = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    attempts = attempt;
    const request =
      attempt === 1
        ? base
        : {
            ...base,
            user: `${base.user}\n\nYour previous reply was rejected for these reasons; fix them and reply again with the JSON object only:\n- ${problems.join("\n- ")}`,
          };
    let reply;
    try {
      reply = await client.complete(request, labels);
    } catch (e) {
      // A missing fixture or a model error counts as a failed attempt (AC-5).
      problems.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    usage = reply.usage;
    if (reply.stopReason === "max_tokens") {
      // R-6: the same request would be cut off again; report and stop.
      truncatedAtTokens = reply.usage?.outputTokens ?? request.maxTokens;
      problems.push(
        `reply truncated at ${truncatedAtTokens} output tokens (cap ${request.maxTokens}); not retried`,
      );
      break;
    }
    const v = validateReply(reply.text, pack, allowed);
    if (v.ok) {
      return {
        status: "generated",
        blocks: v.section.blocks,
        usedFacts: v.section.usedFacts,
        attempts: attempt,
        hash,
        problems,
        readability: v.readability,
        usage,
        truncatedAtTokens: null,
      };
    }
    problems.push(...v.problems);
  }
  return {
    status: "fallback",
    blocks: fallbackBlocks(pack),
    usedFacts: [],
    attempts,
    hash,
    problems,
    readability: null,
    usage,
    truncatedAtTokens,
  };
}
