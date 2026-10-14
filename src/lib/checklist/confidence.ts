/**
 * The checklist items whose requirement the Commission's text in the
 * dataset does not state (REQ-013 batch 36 item 2, D-1310): Readyline's own
 * evidence items, flagged `unverified` in derive.ts. The flag is for the
 * admin view and the evidence files; a customer page shows a plain "check
 * this" sentence with the source link instead. Computed over the three
 * reference cases so every variant of a title appears once.
 */
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { deriveChecklist } from "./derive";

export function unverifiedChecklistItems(): string[] {
  const dataset = getStandardsDataset();
  const titles = new Set<string>();
  for (const c of loadReferenceCases())
    for (const item of deriveChecklist(c.result, c.answers, dataset).items)
      if (item.unverified) titles.add(`${item.id}: ${item.title}`);
  return [...titles].sort();
}
