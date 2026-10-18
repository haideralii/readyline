/**
 * REQ-035 FR-5 (D-2967): the dated gap-check line on a document item, the
 * newest per type, the status untouched; no line without a check.
 */
import { describe, expect, it } from "vitest";
import { applyGapChecks } from "./gap-checks";
import type { ShownChecklist } from "./state";

const item = (id: string, documentTypeId?: string) =>
  ({
    id,
    group: "documents",
    title: id,
    ask: "",
    why: "",
    sourceRef: { kind: "content", id: "document-sets", title: "" },
    unverified: false,
    initialStatus: "todo",
    documentTypeId,
    status: "todo",
    note: "",
    stored: false,
    doneOn: null,
  }) as unknown as ShownChecklist["items"][number];

const shown = {
  items: [
    item("documents:complaints", "complaints-management-policy-and-register"),
    item("documents:other", "other-type"),
    item("people:x"),
  ],
  groups: [
    {
      id: "documents",
      title: "Documents",
      items: [
        item(
          "documents:complaints",
          "complaints-management-policy-and-register",
        ),
        item("documents:other", "other-type"),
      ],
    },
  ],
  ready: 0,
  total: 3,
} as unknown as ShownChecklist;

describe("the checklist's gap-check line (REQ-035 FR-5)", () => {
  it("adds the newest check's dated line to the matching document item and nothing else", () => {
    const out = applyGapChecks(shown, [
      {
        id: "c-new",
        documentTypeId: "complaints-management-policy-and-register",
        day: "19 October 2026",
        missing: 3,
      },
      {
        id: "c-old",
        documentTypeId: "complaints-management-policy-and-register",
        day: "18 October 2026",
        missing: 7,
      },
    ]);
    const complaints = out.items.find((i) => i.id === "documents:complaints")!;
    expect(complaints.gapLine).toEqual({
      text: "Gap check 19 October 2026: 3 sections not covered",
      href: "/documents/gap-check/c-new",
    });
    expect(complaints.status).toBe("todo");
    expect(
      out.items.find((i) => i.id === "documents:other")!.gapLine,
    ).toBeUndefined();
    expect(out.items.find((i) => i.id === "people:x")!.gapLine).toBeUndefined();
    expect(
      out.groups[0].items.find((i) => i.id === "documents:complaints")!.gapLine,
    ).toEqual(complaints.gapLine);
  });

  it("returns the checklist as it was with no checks", () => {
    expect(applyGapChecks(shown, [])).toBe(shown);
  });
});
