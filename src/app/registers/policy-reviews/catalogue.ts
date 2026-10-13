import documentTypesJson from "../../../../data/readyline-content/document-types.json";

/** The document catalogue as select options, plus "Other" (REQ-009 FR-5). */
export function documentOptions(): { value: string; label: string }[] {
  const items = (
    documentTypesJson as { items: { id: string; title: string }[] }
  ).items;
  return [
    ...items
      .map((d) => ({ value: d.id, label: d.title }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    { value: "other", label: "Other (give it a title)" },
  ];
}
