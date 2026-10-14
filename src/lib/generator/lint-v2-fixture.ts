/**
 * House style version 2 over one recorded fixture (batch 40 item 2; shared
 * by the fixtures report and the recording plan, backlog 6). Pure: the
 * fixture and the allowed lists in, the counts per lint out.
 */
import { COMMISSION_CONTACT_STRINGS } from "./fixed-extras";
import {
  contactStringsIn,
  lintContactDetails,
  lintIndicatorRestatement,
  lintRecordNames,
  lintStaffActor,
  lintVagueTime,
} from "./lint";
import type { Fixture } from "./model-client";
import { TailoredSection, blocksToText } from "./section-schema";

export type LintV2Counts = Record<
  | "indicator-restatement"
  | "vague-time"
  | "staff-actor"
  | "record-name"
  | "contact-details",
  number
>;

export const LINT_V2_RULES = [
  "indicator-restatement",
  "vague-time",
  "staff-actor",
  "record-name",
  "contact-details",
] as const satisfies readonly (keyof LintV2Counts)[];

export function emptyCounts(): LintV2Counts {
  return {
    "indicator-restatement": 0,
    "vague-time": 0,
    "staff-actor": 0,
    "record-name": 0,
    "contact-details": 0,
  };
}

/** The quality indicator sentences the fixture's own STANDARDS block carried. */
export function indicatorsOf(user: string): string[] {
  const block =
    /<<<STANDARDS>>>\n([\s\S]*?)<<<END STANDARDS>>>/.exec(user)?.[1] ?? "";
  return [...block.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]);
}

/** The FACTS and STATE FACTS blocks of a recorded prompt: the contact strings a reply may quote (D-546). */
export function allowedContactsOf(user: string): string[] {
  const blocks = [
    /<<<FACTS>>>\n([\s\S]*?)<<<END FACTS>>>/.exec(user)?.[1] ?? "",
    /<<<STATE FACTS>>>\n([\s\S]*?)<<<END STATE FACTS>>>/.exec(user)?.[1] ?? "",
  ].join("\n");
  return [
    ...COMMISSION_CONTACT_STRINGS,
    ...contactStringsIn(blocks).map((c) => c.value),
  ];
}

/** The reply's text, or null when the reply does not parse as a tailored section. */
export function replyText(fx: Fixture): string | null {
  let blocks: unknown;
  try {
    blocks = (JSON.parse(fx.reply) as { blocks: unknown }).blocks;
  } catch {
    return null;
  }
  const parsed = TailoredSection.shape.blocks.safeParse(blocks);
  return parsed.success ? blocksToText(parsed.data) : null;
}

/** Version 2 findings per rule for one fixture, or null when its reply does not parse. */
export function lintV2Counts(
  fx: Fixture,
  options: { allowedPhrases: string[]; knownRecordNames: string[] },
): LintV2Counts | null {
  const text = replyText(fx);
  if (text === null) return null;
  return {
    "indicator-restatement": lintIndicatorRestatement(
      text,
      indicatorsOf(fx.request.user),
    ).length,
    "vague-time": lintVagueTime(text).length,
    "staff-actor": lintStaffActor(text, {
      allowedPhrases: options.allowedPhrases,
    }).length,
    "record-name": lintRecordNames(text, options.knownRecordNames).length,
    "contact-details": lintContactDetails(
      text,
      allowedContactsOf(fx.request.user),
    ).length,
  };
}

export function anyFinding(counts: LintV2Counts): boolean {
  return LINT_V2_RULES.some((k) => counts[k] > 0);
}
