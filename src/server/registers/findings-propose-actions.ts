"use server";
/**
 * The one thing the model does for the findings register (REQ-033 FR-4,
 * D-2934, D-2937): given a finding's words that name no standard, propose
 * the standard, after the participant gate, for the provider to confirm.
 * The reply is a standard id checked against the dataset; nothing is saved
 * here, and the words are sent only once the gate has passed them.
 */
import { createModelClient } from "@/lib/generator/model-client";
import { log } from "@/lib/logging/logger";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import { standardName } from "@/lib/registers/findings";
import {
  NO_PROPOSAL_MESSAGE,
  isKnownStandard,
  parseProposal,
  proposeRequest,
} from "@/lib/registers/findings-propose";
import { parseInput, strictObject, text } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";

const Input = strictObject({
  finding: text(500, 1, "Type the finding first"),
});

export type ProposeStandardResult =
  | { ok: true; standardId: string; name: string }
  | { ok: false; message: string };

export async function proposeStandardAction(
  input: unknown,
): Promise<ProposeStandardResult> {
  const parsed = parseInput(Input, input);
  if (!parsed.ok) return { ok: false, message: "Type the finding first." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to use the registers." };
  // The gate first (FR-2, D-2931): a flagged finding is never sent to the model.
  const found = detectParticipantData(parsed.data.finding);
  if (found.length > 0) return { ok: false, message: found[0].message };
  try {
    const reply = await createModelClient().complete(
      proposeRequest(parsed.data.finding),
      { documentTypeId: "findings", sectionId: "standard" },
    );
    const id = parseProposal(reply.text);
    const known = isKnownStandard(id);
    log.info("findings.standard.proposed", {
      accountId: viewer.account.id,
      proposed: known,
      inputTokens: reply.usage?.inputTokens ?? null,
      outputTokens: reply.usage?.outputTokens ?? null,
    });
    if (!known) return { ok: false, message: NO_PROPOSAL_MESSAGE };
    return { ok: true, standardId: id, name: standardName(id) };
  } catch (e) {
    log.warn("findings.standard.unavailable", {
      accountId: viewer.account.id,
      reason: e instanceof Error ? e.name : "unknown",
    });
    return { ok: false, message: NO_PROPOSAL_MESSAGE };
  }
}
