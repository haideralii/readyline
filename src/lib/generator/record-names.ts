/**
 * The records a generated document may name (house style version 2, lint
 * (d); batch 40, D-544): the registers the questionnaire result lists, the
 * Readyline registers from REQ-009 and REQ-018, the documents in the
 * catalogue, and the forms and templates the fixed text provides. A
 * generated sentence that names any other "X register" or "Y form" fails
 * the record-name lint, because an auditor asks to see it. Pure data.
 */
import { catalogue } from "./catalogue";
import documentSetsJson from "../../../data/readyline-content/document-sets.json";

/** The Readyline registers (REQ-009, REQ-018) by the names the pages use. */
export const READYLINE_REGISTERS: readonly string[] = [
  "incident register",
  "complaints register",
  "worker checks register",
  "worker check register",
  "worker screening clearance register",
  "clearance register",
  "policy review register",
  "corporate risk register",
  "participant risk register",
  "conflict of interest register",
  "delegations register",
  "insurances and vehicles register",
  "insurance register",
  "vehicle register",
  "improvement register",
  "continuous improvement register",
  "record of decisions",
  "staff matrix",
  "onboarding checklist",
  "document control register",
  "training register",
  "restrictive practice use register",
  "use register",
  "risk register",
];

/** Forms and templates the fixed text provides inside the pack. */
export const PACK_FORMS: readonly string[] = [
  "service agreement template",
  "service agreement",
  "consent form",
  "declaration form",
  "conflict of interest declaration form",
  "code of conduct acknowledgement",
  "acknowledgement form",
  "support plan template",
  "support plan",
  "transition checklist",
  "retention schedule",
  "training matrix",
  "emergency contact form",
  "incident report form",
  "complaint form",
  "feedback form",
  "medication chart",
  "medication record",
  "mealtime plan",
  "risk assessment form",
  "risk assessment",
  "easy read summary",
  "self-assessment",
];

/** Every record name a document may use: lower case, de-duplicated. */
export function knownRecordNames(): string[] {
  const registers = (
    documentSetsJson as { registers: { title: string }[] }
  ).registers.map((r) => r.title);
  const documents = catalogue.items.map((i) => i.title);
  return [
    ...new Set(
      [...registers, ...READYLINE_REGISTERS, ...documents, ...PACK_FORMS].map(
        (n) => n.toLowerCase().trim(),
      ),
    ),
  ];
}
