/**
 * The registration groups by audit type as a markdown table, generated from
 * data/standards.json so the guide never drifts from the questionnaire
 * (REQ-011 batch 29 item 2).
 */
import type { StandardsDataset } from "@/lib/standards/schema";

export function registrationGroupsTable(dataset: StandardsDataset): string {
  const rows = [...dataset.registrationGroups].sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  const lines = [
    "| Code | Registration group | Audit |",
    "| --- | --- | --- |",
  ];
  for (const g of rows) {
    const audit =
      g.auditType === "verification"
        ? "Verification (desk audit)"
        : "Certification (site visit)";
    lines.push(`| ${g.code} | ${g.name} | ${audit} |`);
  }
  const v = rows.filter((g) => g.auditType === "verification").length;
  const c = rows.length - v;
  return `${lines.join("\n")}\n\n${rows.length} groups: ${v} verification, ${c} certification.`;
}
