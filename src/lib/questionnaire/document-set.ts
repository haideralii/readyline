/**
 * The documents and registers a provider will need, from the applicable
 * modules, the selected classes and what they already have (REQ-003 FR-2).
 * Content comes from data/readyline-content/document-sets.json (PO text).
 */
import { documentSetsContent, documentTitle } from "./content";
import type { ExistingStep } from "./types";

export type HaveStatus = "yes" | "no" | "not-sure" | "unknown";

export type DocumentItem = {
  id: string;
  title: string;
  /** Module ids that bring the document in; empty for the always set. */
  fromModules: string[];
  have: HaveStatus;
};

export type RegisterItem = { id: string; title: string; have: HaveStatus };

export type DocumentSet = {
  documents: DocumentItem[];
  registers: RegisterItem[];
};

/** Step 5 answers that speak to a specific document or register. */
const EXISTING_TO_DOCUMENT: Partial<Record<keyof ExistingStep, string>> = {
  incidentRegister: "incident-management-policy-and-register",
  complaintsRegister: "complaints-management-policy-and-register",
  workerInductionRecords: "induction-and-training-procedure-and-register",
};
const EXISTING_TO_REGISTER: Partial<Record<keyof ExistingStep, string>> = {
  incidentRegister: "incidents",
  complaintsRegister: "complaints",
  workerInductionRecords: "training",
};

/**
 * REQ-027 D-2718 (finding 115): how many of the set's documents step 5 asked
 * about, the numeral the result page's legend renders, so the legend and its
 * test share one number and a fourth question or an id leaving the `always`
 * list never leaves the line stale.
 */
export function askedDocumentCount(
  set: Pick<DocumentSet, "documents">,
): number {
  return set.documents.filter((d) => d.have !== "unknown").length;
}

export function deriveDocumentSet(
  moduleIds: readonly string[],
  groupCodes: readonly string[],
  existing: ExistingStep,
): DocumentSet {
  const c = documentSetsContent;
  const groups = new Set(groupCodes);
  const applies = (
    when: { groupsAny: "personalCareGroups" | string[] } | undefined,
  ) => {
    if (!when) return true;
    const list =
      when.groupsAny === "personalCareGroups"
        ? c.personalCareGroups
        : when.groupsAny;
    return list.some((code) => groups.has(code));
  };

  const byId = new Map<string, DocumentItem>();
  const add = (id: string, moduleId: string | null) => {
    const item = byId.get(id) ?? {
      id,
      title: documentTitle(id),
      fromModules: [],
      have: "unknown",
    };
    if (moduleId && !item.fromModules.includes(moduleId))
      item.fromModules.push(moduleId);
    byId.set(id, item);
  };
  for (const id of c.always) add(id, null);
  for (const moduleId of moduleIds) {
    for (const rule of c.byModule[moduleId] ?? [])
      if (applies(rule.when)) add(rule.id, moduleId);
  }

  for (const [field, docId] of Object.entries(EXISTING_TO_DOCUMENT) as [
    keyof ExistingStep,
    string,
  ][]) {
    const item = byId.get(docId);
    if (item) item.have = existing[field];
  }

  const registers: RegisterItem[] = c.registers
    .filter(
      (r) => !r.when || r.when.modulesAny.some((m) => moduleIds.includes(m)),
    )
    .map((r) => {
      const field = (
        Object.entries(EXISTING_TO_REGISTER) as [keyof ExistingStep, string][]
      ).find(([, id]) => id === r.id)?.[0];
      return {
        id: r.id,
        title: r.title,
        have: field ? existing[field] : "unknown",
      };
    });

  return { documents: [...byId.values()], registers };
}
