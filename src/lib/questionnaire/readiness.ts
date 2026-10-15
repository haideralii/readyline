/**
 * What the result's summary card says (REQ-025 FR-3; REQ-014 motif kept for
 * the ready line): how many documents and registers the provider said they
 * already have, as a list over derived counts, never a literal number. A
 * count of zero drops its "you said you have" clause.
 */
import type { ReadyLineCounts } from "@/components/ready-line";
import type { QuestionnaireResult } from "./result";

export type ReadinessCounts = {
  /** Items the provider said they have, documents and registers together. */
  have: number;
  documentsHave: number;
  registersHave: number;
  documents: number;
  registers: number;
};

export function readinessCounts(r: QuestionnaireResult): ReadinessCounts {
  const documentsHave = r.documents.filter((i) => i.have === "yes").length;
  const registersHave = r.registers.filter((i) => i.have === "yes").length;
  return {
    have: documentsHave + registersHave,
    documentsHave,
    registersHave,
    documents: r.documents.length,
    registers: r.registers.length,
  };
}

export function readyLineCounts(c: ReadinessCounts): ReadyLineCounts {
  return { done: c.have, todo: c.documents + c.registers - c.have };
}

export type SummaryLines = {
  documents: string;
  registers: string;
  checklist: string;
  pack: string;
};

/** The four lines of the summary card (FR-3), with the checklist's total from the derived checklist. */
export function summaryLines(
  c: ReadinessCounts,
  checklistTotal: number,
): SummaryLines {
  const said = (n: number) => (n > 0 ? `, you said you have ${n}` : "");
  const above = c.documents + c.registers;
  const rest = Math.max(checklistTotal - above, 0);
  return {
    documents: `Documents: ${c.documents}${said(c.documentsHave)}`,
    registers: `Registers: ${c.registers}${said(c.registersHave)}, you keep these as you go`,
    checklist: `Checklist: ${checklistTotal} items (${above} above plus ${rest} about your workers, insurance and the audit)`,
    pack: `The pack drafts all ${c.documents} so they match; your checklist shows which to compare with what you have.`,
  };
}
