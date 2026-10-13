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
import {
  lintCrossReferences,
  lintErrors,
  lintIndicatorRestatement,
  lintPlaceholders,
  lintRecordNames,
  lintReviewCycles,
  lintStaffActor,
  lintText,
  lintTimeframes,
  lintVagueTime,
  type LintFinding,
} from "./lint";
import type { ContextPack } from "./context-pack";
import { genericFallbackBlocks } from "./fallback-text";
import { knownRecordNames } from "./record-names";
import type { FixtureLabels, ModelClient, ModelUsage } from "./model-client";
import { buildModelRequest, requestHash } from "./prompts";
import { readability, type Readability } from "@/lib/text/readability";
import {
  TailoredSection,
  blocksToProse,
  blocksToText,
  type Block,
} from "./section-schema";

export const READABILITY_RETRY_INSTRUCTION =
  "shorten sentences to under 20 words and use common words";

/** Why a section fell back (REQ-016 FR-0b), for the log and the tick line; never the content. */
export type FailureKind =
  "model-error" | "gate" | "truncation" | "fixture-missing";

export type SectionFailure = {
  kind: FailureKind;
  /** Rule names or error names, at most 300 characters, never reply text. */
  detail: string;
  /** True when the model declined rather than erred. */
  refusal: boolean;
};

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
  /** Set when the status is fallback. */
  failure: SectionFailure | null;
};

/**
 * The fallback is a complete generic section marked "Generic text: add your
 * details" (FR-0b); the catalogue brief never reaches it (FR-0a).
 */
export function fallbackBlocks(pack: ContextPack): Block[] {
  return genericFallbackBlocks(pack);
}

/** Classifies the recorded problems: what failed and which rules, in names only. */
export function classifyFailure(
  problems: readonly string[],
  truncatedAtTokens: number | null,
): SectionFailure {
  if (truncatedAtTokens !== null)
    return {
      kind: "truncation",
      detail: `truncated at ${truncatedAtTokens} output tokens`,
      refusal: false,
    };
  const text = problems.join("\n");
  if (/No recorded fixture/.test(text))
    return {
      kind: "fixture-missing",
      detail: "no recorded fixture",
      refusal: false,
    };
  const rules = new Set<string>();
  let gate = false;
  let modelError = false;
  let refusal = false;
  for (const p of problems) {
    const rule = p.match(/^([a-z0-9:-]+):\s/i)?.[1];
    if (rule) {
      rules.add(rule);
      gate = true;
    } else if (
      /^reply was not valid JSON|^sectionId must be|^readability grade|^asks the provider|^restates a statutory|^states a review cycle|^cross-reference/.test(
        p,
      )
    ) {
      rules.add(p.split(/[ :(]/)[0].toLowerCase());
      gate = true;
    } else if (/: .+$/.test(p) && /^[a-zA-Z]+\.[a-zA-Z.]+: /.test(p)) {
      rules.add("schema");
      gate = true;
    } else {
      modelError = true;
      if (/refus|declin|cannot help|can't help/i.test(p)) refusal = true;
      rules.add(p.replace(/\s.*$/, "").slice(0, 40) || "error");
    }
  }
  const kind: FailureKind = gate && !modelError ? "gate" : "model-error";
  return { kind, detail: [...rules].join(", ").slice(0, 300), refusal };
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
  /** House style version 2 lints apply to live replies only (D-544); a recorded reply predates them. */
  strict = false,
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
  // D-047: the limit is the document's (12 for privacy and records, else 11),
  // and a short section only warns, since two sentences are too small a sample.
  const score = readability(blocksToProse(result.data.blocks));
  const gate = pack.readabilityGate;
  if (score.grade > gate.failAbove && score.words >= gate.shortSectionWords) {
    return {
      ok: false,
      problems: [
        `readability grade ${score.grade} is above ${gate.failAbove}: ${READABILITY_RETRY_INSTRUCTION}`,
      ],
    };
  }
  // R-12: a document kept on an obligation never asks the provider for a standard.
  const placeholders = lintPlaceholders(blocksToText(result.data.blocks));
  if (placeholders.length) {
    const basis = pack.document.basisReason
      ? `this document rests on this obligation: ${pack.document.basisReason}`
      : "the standards for this document are in the STANDARDS block";
    return {
      ok: false,
      problems: [
        `asks the provider for a standard ("${placeholders[0].match}"): ${basis}; never ask the provider to name a Practice Standard or quality indicator`,
      ],
    };
  }
  // R-7: statutory timeframes live in fixed text only; tailored text refers to that section.
  // D-049: only a sentence with a statutory anchor counts; a provider's own promise is tailoring.
  const timeframes = lintTimeframes(blocksToText(result.data.blocks), {
    anchors: pack.rulesSection ? [pack.rulesSection.heading] : [],
  });
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
  // R-8: review cycles are facts from the pack, never the model's choice.
  const cycles = lintReviewCycles(
    blocksToText(result.data.blocks),
    pack.reviewCycles,
  );
  if (cycles.length) {
    return {
      ok: false,
      problems: [
        `states a review cycle ("${cycles[0].match}"): ${cycles[0].why}`,
      ],
    };
  }
  // R-9: cross-references must match this document's outline, not the house style's generic one.
  const refs = lintCrossReferences(
    blocksToText(result.data.blocks),
    pack.outline,
  );
  if (refs.length) {
    return {
      ok: false,
      problems: [
        `cross-reference "${refs[0].match}" does not match the outline: ${refs[0].why}`,
      ],
    };
  }
  // House style version 2 (batch 40, D-544): live replies only; a recorded
  // reply predates the rules and is listed for the next recording session.
  if (strict) {
    const text = blocksToText(result.data.blocks);
    const v2 = [
      ...lintIndicatorRestatement(
        text,
        pack.standards.flatMap((s) => s.indicators),
      ).map((f) => `restates a quality indicator ("${f.match}"): ${f.why}`),
      ...lintVagueTime(text).map(
        (f) => `vague time word ("${f.match}"): ${f.why}`,
      ),
      ...lintStaffActor(text, { allowedPhrases }).map(
        (f) => `"${f.match}" as an actor: ${f.why}`,
      ),
      ...lintRecordNames(text, knownRecordNames()).map(
        (f) => `names a record that does not exist ("${f.match}"): ${f.why}`,
      ),
    ];
    if (v2.length) return { ok: false, problems: v2.slice(0, 4) };
  }
  return { ok: true, section: result.data, findings, readability: score };
}

function rejection(problems: readonly string[]): string {
  return `Your previous reply was rejected for these reasons; fix them and reply again with the JSON object only:\n- ${problems.join("\n- ")}`;
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
            user: `${base.user}\n\n${rejection(problems)}`,
            // D-046: the document block stays cached; the rejection joins the section block.
            blocks: {
              document: base.blocks.document,
              section: `${base.blocks.section}\n\n${rejection(problems)}`,
            },
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
    // D-544: a replayed recording predates house style version 2; a live reply is held to it.
    const v = validateReply(
      reply.text,
      pack,
      allowed,
      client.mode !== "replay",
    );
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
        failure: null,
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
    failure: classifyFailure(problems, truncatedAtTokens),
  };
}
