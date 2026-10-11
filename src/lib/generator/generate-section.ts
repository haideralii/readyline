/**
 * One tailored section through the pipeline (REQ-005 FR-2 steps 2 to 4,
 * AC-5): prompt, model, JSON parse, schema validation, lint, readability.
 * A failed attempt retries once with the problems appended to the prompt;
 * a second failure falls back to the fixed placeholder with a visible
 * "Review and complete" marker. Nothing here touches the network directly.
 */
import { lintErrors, lintText, type LintFinding } from "./lint";
import type { ContextPack } from "./context-pack";
import type { FixtureLabels, ModelClient, ModelUsage } from "./model-client";
import { buildModelRequest, requestHash } from "./prompts";
import { readability, type Readability } from "./readability";
import {
  TailoredSection,
  blocksToProse,
  blocksToText,
  type Block,
} from "./section-schema";

export type SectionOutcome = {
  status: "generated" | "fallback";
  blocks: Block[];
  usedFacts: string[];
  attempts: number;
  hash: string;
  problems: string[];
  readability: Readability | null;
  usage: ModelUsage | null;
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
  | { ok: true; section: TailoredSection; findings: LintFinding[] }
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
  return { ok: true, section: result.data, findings };
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

  for (let attempt = 1; attempt <= 2; attempt++) {
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
    const v = validateReply(reply.text, pack, allowed);
    if (v.ok) {
      return {
        status: "generated",
        blocks: v.section.blocks,
        usedFacts: v.section.usedFacts,
        attempts: attempt,
        hash,
        problems,
        readability: readability(blocksToProse(v.section.blocks)),
        usage,
      };
    }
    problems.push(...v.problems);
  }
  return {
    status: "fallback",
    blocks: fallbackBlocks(pack),
    usedFacts: [],
    attempts: 2,
    hash,
    problems,
    readability: null,
    usage,
  };
}
