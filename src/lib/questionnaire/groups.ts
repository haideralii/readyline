/**
 * The small shape of registration groups the browser needs for step 2:
 * code, Commission name and audit type from the dataset, plus the Readyline
 * description. Computed on the server so standards.json stays there.
 */
import type { StandardsDataset } from "@/lib/standards/schema";
import { groupDescription } from "./content";

export type GroupOption = {
  code: string;
  name: string;
  auditType: "verification" | "certification";
  description: string;
  mandatoryFrom: string | null;
};

export function getGroupOptions(dataset: StandardsDataset): GroupOption[] {
  return dataset.registrationGroups
    .map((g) => ({
      code: g.code,
      name: g.name,
      auditType: g.auditType,
      description: groupDescription(g.code) ?? "",
      mandatoryFrom: g.mandatoryFrom,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
