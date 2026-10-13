/**
 * The records a generated document may name (house style version 2, lint
 * (d); batch 40, D-544): the registers the questionnaire result lists, the
 * Readyline registers from REQ-009 and REQ-018, the documents in the
 * catalogue, and the forms and templates the fixed text provides. A
 * generated sentence that names any other "X register" or "Y form" fails
 * the record-name lint, because an auditor asks to see it.
 *
 * Batch 42 item 2 (D-547): the names come from the one naming table in
 * src/lib/registers/names.ts. Its aliases are known so the lint can offer
 * the fix, but only the canonical spelling passes. Pure data.
 */
import { catalogue } from "./catalogue";
import {
  PACK_FORM_NAMES,
  RECORD_NAMES,
  canonicalRecordName,
} from "@/lib/registers/names";
import documentSetsJson from "../../../data/readyline-content/document-sets.json";

/** The Readyline registers (REQ-009, REQ-018) by their canonical names, then their aliases. */
export const READYLINE_REGISTERS: readonly string[] = [
  ...RECORD_NAMES.map((r) => r.name.toLowerCase()),
  ...RECORD_NAMES.flatMap((r) => r.aliases.map((a) => a.toLowerCase())),
];

/** Forms and templates the fixed text provides inside the pack. */
export const PACK_FORMS: readonly string[] = PACK_FORM_NAMES.map((f) =>
  f.toLowerCase(),
);

/** Every record name a document may use: lower case, de-duplicated, aliases included for the fix hint. */
export function knownRecordNames(): string[] {
  const registers = (
    documentSetsJson as { registers: { title: string }[] }
  ).registers.map((r) => canonicalRecordName(r.title) ?? r.title);
  const documents = catalogue.items.map((i) => i.title);
  return [
    ...new Set(
      [...registers, ...READYLINE_REGISTERS, ...documents, ...PACK_FORMS].map(
        (n) => n.toLowerCase().trim(),
      ),
    ),
  ];
}
