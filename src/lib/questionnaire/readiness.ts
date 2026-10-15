/**
 * What the ready line says for a result (REQ-014 motif; REQ-013 batch 36
 * item 3, D-1310): how many of the documents and registers the provider
 * already has, how many documents the pack drafts, and how many registers
 * they keep as they go. One sentence in the customer's words; the line
 * shows two segments (have / still to do) and nothing else.
 */
import { BRAND } from "@/lib/brand";
import type { ReadyLineCounts } from "@/components/ready-line";
import type { QuestionnaireResult } from "./result";

export type ReadinessCounts = {
  /** Items the provider said they have. */
  have: number;
  documents: number;
  registers: number;
};

export function readinessCounts(r: QuestionnaireResult): ReadinessCounts {
  const items = [...r.documents, ...r.registers];
  return {
    have: items.filter((i) => i.have === "yes").length,
    documents: r.documents.length,
    registers: r.registers.length,
  };
}

export function readyLineCounts(c: ReadinessCounts): ReadyLineCounts {
  return { done: c.have, todo: c.documents + c.registers - c.have };
}

export function readinessSentence(c: ReadinessCounts): string {
  const registers =
    c.registers === 1
      ? "the 1 register you keep as you go"
      : `the ${c.registers} registers you keep as you go`;
  if (c.have === 0)
    return `You already have ${c.have} of these. ${BRAND} drafts the ${c.documents} documents for you; ${registers}.`;
  // Batch 48 item 1 (D-2214): "already have" pre-ticks the checklist; the pack still drafts every document.
  const todo = readyLineCounts(c).todo;
  return `You told us you already have ${c.have} of these; the pack still drafts all ${c.documents} so they match each other, and your checklist shows the ${todo} still to prepare.`;
}
