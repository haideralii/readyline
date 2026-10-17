import type { WorkerOnboardingItem } from "./onboarding-items";

/**
 * REQ-024 Session B (FR-7, FR-8; D-2438, D-2444): the worker's own view of
 * an item, in words, from the three columns the item row carries, and the
 * documents an acknowledgement item names. Pure, so the words are tested
 * once and the home and the owner's page cannot drift.
 */
/** REQ-020 FR-11's sentence as REQ-024 FR-7 changes it, in its three homes (the worker home, the invite screen, the invitation). */
export const WORKER_ROLE_WORDS =
  "log incidents and complaints and complete your onboarding";

/** FR-9 (AC-8): the three steps every worker has, in the worker's own words, for the invitation and the home. */
export const WORKER_FIRST_STEPS: readonly string[] = [
  "Read the NDIS Code of Conduct acknowledgement from your manager's pack and acknowledge it.",
  "Finish the NDIS Worker Orientation Module and keep your completion certificate.",
  "Read the Code of Conduct, incident, complaints, privacy and safeguarding policies and acknowledge each one.",
];

export type ItemStepState =
  "to-do" | "waiting" | "confirmed" | "recorded-by-manager" | "manager-records";

export const STEP_WORDS: Record<ItemStepState, string> = {
  "to-do": "To do",
  waiting: "Waiting for your manager to confirm",
  confirmed: "Confirmed",
  "recorded-by-manager": "Recorded by your manager",
  "manager-records": "Your manager records this",
};

export type ItemStepInput = {
  done_on: string | null;
  confirmed_on: string | null;
  recorded_by_owner: boolean;
};

/**
 * The worker's state of one item. An owner's item is the manager's to
 * record and reads confirmed once it is; a shared or worker item the owner
 * dated for the worker reads "recorded by your manager" whatever else is
 * set, so the worker is never told they ticked what they did not (finding
 * 224); the worker's own date waits for the owner's confirmation.
 */
export function itemStepState(
  who: WorkerOnboardingItem["who"],
  state: ItemStepInput | undefined,
): ItemStepState {
  if (who === "owner")
    return state?.confirmed_on ? "confirmed" : "manager-records";
  if (!state) return "to-do";
  if (state.recorded_by_owner) return "recorded-by-manager";
  if (state.confirmed_on) return "confirmed";
  if (state.done_on) return "waiting";
  return "to-do";
}

/** W-1's item id on the worker's home, where it is the worker's step (D-2834). */
export const W1_ITEM_ID = "w1-clearance";

/**
 * D-2834 (#102's run at fbd82b6): W-1 is the worker's step, whatever the
 * owner's list says about who confirms it. The worker reads "to do" until
 * their screening row carries a check number, "waiting" once it does and
 * the owner has not confirmed, "confirmed" once the owner has; a row the
 * owner dated for them reads "recorded by your manager" as every item does.
 */
export function w1StepState(
  screening: { clearance_number: string } | null,
  state: ItemStepInput | undefined,
): ItemStepState {
  if (state?.recorded_by_owner) return "recorded-by-manager";
  if (state?.confirmed_on) return "confirmed";
  return screening?.clearance_number ? "waiting" : "to-do";
}

/** The state of any item on the worker's home: W-1 by its row, the rest by the three columns. */
export function workerStepState(
  item: Pick<WorkerOnboardingItem, "id" | "who">,
  state: ItemStepInput | undefined,
  screening: { clearance_number: string } | null,
): ItemStepState {
  return item.id === W1_ITEM_ID
    ? w1StepState(screening, state)
    : itemStepState(item.who, state);
}

/** FR-7: the document types each acknowledgement item names; W-6's five are `MANDATORY_POLICIES`' words as document ids. */
export const ACKNOWLEDGEMENT_DOCUMENTS: Readonly<
  Record<"w3-code-of-conduct" | "w6-policies", readonly string[]>
> = {
  "w3-code-of-conduct": ["code-of-conduct-acknowledgement"],
  "w6-policies": [
    "code-of-conduct-acknowledgement",
    "incident-management-policy-and-register",
    "complaints-management-policy-and-register",
    "privacy-and-information-management-policy",
    "safeguarding-policy",
  ],
};

export type AdoptedDocument = {
  id: string;
  document_type_id: string;
  version: number;
  adopted_on: string | null;
};

/** The adopted version of each type: the highest version among the adopted rows. */
export function latestAdopted(
  rows: readonly AdoptedDocument[],
): Map<string, AdoptedDocument> {
  const out = new Map<string, AdoptedDocument>();
  for (const r of rows) {
    const cur = out.get(r.document_type_id);
    if (!cur || r.version > cur.version) out.set(r.document_type_id, r);
  }
  return out;
}

export type AcknowledgementRow = {
  document_type_id: string;
  version: number;
  acknowledged_on: string;
};

/** True when every document the item names has an adopted version and that version is acknowledged. */
export function acknowledgementsComplete(
  itemId: keyof typeof ACKNOWLEDGEMENT_DOCUMENTS,
  adopted: Map<string, AdoptedDocument>,
  acks: readonly AcknowledgementRow[],
): boolean {
  return ACKNOWLEDGEMENT_DOCUMENTS[itemId].every((typeId) => {
    const doc = adopted.get(typeId);
    return (
      doc !== undefined &&
      acks.some(
        (a) => a.document_type_id === typeId && a.version === doc.version,
      )
    );
  });
}

/** The documents the worker still has to acknowledge for an item, with the ones the account has not adopted named apart. */
export function acknowledgementsOutstanding(
  itemId: keyof typeof ACKNOWLEDGEMENT_DOCUMENTS,
  adopted: Map<string, AdoptedDocument>,
  acks: readonly AcknowledgementRow[],
): { toAcknowledge: AdoptedDocument[]; notAdopted: string[] } {
  const toAcknowledge: AdoptedDocument[] = [];
  const notAdopted: string[] = [];
  for (const typeId of ACKNOWLEDGEMENT_DOCUMENTS[itemId]) {
    const doc = adopted.get(typeId);
    if (!doc) notAdopted.push(typeId);
    else if (
      !acks.some(
        (a) => a.document_type_id === typeId && a.version === doc.version,
      )
    )
      toAcknowledge.push(doc);
  }
  return { toAcknowledge, notAdopted };
}
