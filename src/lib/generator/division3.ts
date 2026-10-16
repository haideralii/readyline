/**
 * REQ-024 A2 (FR-4a, W-1b; D-2421, D-2424 as amended, D-2428; findings 72,
 * 95, 111, 136, 147, 154, 158, 169 and 192): the Division 3 risk management
 * plan for a worker in a risk assessed role while in the process of
 * obtaining a clearance (Worker Screening Rules ss 11 and 12), as a section
 * of the worker screening and recruitment procedure.
 *
 * The section is not in the catalogue and not in the skeleton: every tailored
 * section's prompt carries the document's numbered outline (prompts.ts, the
 * OUTLINE block), so a catalogue section would change the recorded prompt
 * hashes of every procedure fixture. It is inserted into the finished model
 * by the job, with the register snapshot the job took, and replaced in a
 * stored model by "Update the procedure"; `rerenderSetWithFacts` keeps the
 * blocks it finds and retakes nothing (D-2428). The controls are fixed; the
 * risks are the participant risk register's rows by code, since s 12(2)(a)
 * wants each risk to a person the provider supports and the product holds
 * those in that register. No bracketed text: a bracket is a blank the Finish
 * step would ask about (blanks.ts).
 */
import type { DocumentModel, ResolvedSection } from "./document-model";
import type { Block } from "./section-schema";
import { formatLongDay } from "@/lib/registers/state-facts";

export const DIVISION_3_SECTION = "division-3-plan";
export const DIVISION_3_HEADING =
  "Risk management plan for workers awaiting clearance";
/** The document type the plan belongs to (REQ-005). */
export const WORKER_SCREENING_PROCEDURE_ID =
  "worker-screening-and-recruitment-procedure";
/** The outline section the plan follows; the record-keeping section every procedure outline has. */
const AFTER_SECTION = "records-and-evidence";

/**
 * The participant risk register as the section reads it, taken by one named
 * server function (`participantRiskSnapshot`) whose tenancy is its account
 * argument and carried here alone, never into a prompt (CLAUDE.md 4.5).
 */
export type ParticipantRiskSnapshot = {
  rows: { code: string; risk: string }[];
  /** The register's last-reviewed day: the latest `reviewed` or `created` event under `participant_risks` (finding 158); null with no rows. */
  lastReviewedOn: string | null;
  /** The Sydney day the snapshot was taken. */
  takenOn: string;
};

export const REGISTER_EMPTY_SENTENCE =
  "This plan is complete only once the register lists each risk to the people we support; the rows are added in the register, the procedure is updated from it and the new version adopted before any exception starts.";

export function division3Blocks(
  tradingName: string,
  snapshot: ParticipantRiskSnapshot,
): Block[] {
  const rows = snapshot.rows;
  const blocks: Block[] = [
    {
      type: "paragraph",
      text: `This is our written risk management plan under Division 3 of the NDIS (Practice Standards—Worker Screening) Rules 2018 (ss 11 and 12). It applies while any worker or key person of ${tradingName} is engaged in a risk assessed role and is in the process of obtaining a clearance (s 12(1)). We implement it from the day the first such exception starts (s 12(4)).`,
    },
    {
      type: "paragraph",
      text: "How we manage each risk while a worker awaits clearance:",
    },
    {
      type: "bullets",
      items: [
        "The worker is supervised by a named worker who holds a current clearance, in every shift and every contact with a participant (s 14(1)(a)(ii)).",
        "The worker does no lone work, no personal care, no transport alone, and no overnight or sleepover shift until the clearance is issued.",
        "The worker does not handle a participant's money, medication or keys, and does not use or help with any restrictive practice, until the clearance is issued.",
        "The supervisor's own clearance is checked in the NDIS Worker Screening Database before the exception starts, and the exception ends the day that clearance expires or is suspended (s 15(2)(f)).",
        "We record the start and end of every exception, the supervisor and the dates in our worker screening records (s 18), and we keep them for seven years (s 21).",
      ],
    },
    {
      type: "paragraph",
      text: "The risks to the people we support (s 12(2)(a)):",
    },
    {
      type: "paragraph",
      text: "Our participant risk register is the list of each risk to a person we support and how each is managed. The rows below are the register as it stood when this version of the procedure was written, by participant code and never by name; the register itself is kept current, and this section is updated from it when we update the procedure.",
    },
  ];
  if (rows.length === 0) {
    blocks.push({
      type: "callout",
      text: `Our participant risk register had no rows on ${formatLongDay(snapshot.takenOn)}. ${REGISTER_EMPTY_SENTENCE}`,
    });
  } else {
    blocks.push({
      type: "paragraph",
      text: `${rows.length} ${rows.length === 1 ? "row" : "rows"} as the register stood on ${formatLongDay(snapshot.takenOn)}; the register was last reviewed on ${formatLongDay(snapshot.lastReviewedOn ?? snapshot.takenOn)}.`,
    });
    blocks.push({
      type: "table",
      columns: ["Participant code", "Risk"],
      rows: rows.map((r) => [r.code, r.risk]),
    });
  }
  blocks.push(
    { type: "paragraph", text: "When we review this plan (s 12(3)):" },
    {
      type: "bullets",
      items: [
        "After any reportable incident involving a worker or any of our personnel, whether or not the incident register names them (s 12(3)(b)).",
        "Whenever the NDIS Quality and Safeguards Commissioner requires us to (s 12(3)(a)).",
        "Whenever we update the procedure, which copies the participant risk register into this section again.",
      ],
    },
  );
  return blocks;
}

/** True when the document carries the section (any version). */
export function hasDivision3Plan(model: DocumentModel): boolean {
  return model.sections.some((s) => s.id === DIVISION_3_SECTION);
}

/**
 * The model with the plan after the records section (or before the first
 * unnumbered back-matter section when the outline lacks it), replacing an
 * earlier copy, the numbered sections after it renumbered. Pure; the caller
 * decides when a snapshot is taken.
 */
export function insertDivision3Plan(
  model: DocumentModel,
  snapshot: ParticipantRiskSnapshot,
): DocumentModel {
  const without = model.sections.filter((s) => s.id !== DIVISION_3_SECTION);
  const afterIndex = without.findIndex((s) => s.id === AFTER_SECTION);
  const lastNumbered = without.reduce(
    (last, s, i) => (s.number ? i : last),
    -1,
  );
  const at = afterIndex >= 0 ? afterIndex + 1 : lastNumbered + 1;
  const section: ResolvedSection = {
    id: DIVISION_3_SECTION,
    number: "",
    heading: DIVISION_3_HEADING,
    mode: "fixed",
    status: "fixed",
    blocks: division3Blocks(model.facts.tradingName, snapshot),
  };
  const sections = [...without.slice(0, at), section, ...without.slice(at)];
  let n = 0;
  return {
    ...model,
    sections: sections.map((s) =>
      s.number || s.id === DIVISION_3_SECTION
        ? { ...s, number: String(++n) }
        : s,
    ),
  };
}
