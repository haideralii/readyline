import { describe, expect, it } from "vitest";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { deriveChecklist } from "./derive";
import {
  DRAFTED_LABEL,
  mergeChecklist,
  screenLabel,
  STATUS_WORDS,
  statusLabel,
} from "./state";

const dataset = getStandardsDataset();
const c = loadReferenceCases().find(
  (x) => x.id === "verification-sole-trader",
)!;
const checklist = deriveChecklist(c.result, c.answers, dataset);

describe("mergeChecklist (REQ-006 FR-2, FR-3)", () => {
  it("starts from the pre-fill, counts 'have' as ready and opens the first incomplete group", () => {
    const shown = mergeChecklist({ checklist, stored: [] });
    expect(shown.total).toBe(checklist.total);
    expect(shown.ready).toBe(
      checklist.items.filter((i) => i.initialStatus === "have").length,
    );
    expect(shown.items.every((i) => !i.stored && i.note === "")).toBe(true);
    const open = shown.groups.filter((g) => g.open);
    expect(open).toHaveLength(1);
    expect(open[0].id).toBe("documents");
  });

  it("a stored row overrides the pre-fill and carries the note; the next group opens once the first is complete", () => {
    const docs = checklist.items.filter((i) => i.group === "documents");
    const stored = docs.map((i) => ({
      itemId: i.id,
      status: "have" as const,
      note: i.id === docs[0].id ? "Reviewed on 12 October" : "",
    }));
    const shown = mergeChecklist({ checklist, stored });
    expect(shown.groups[0].ready).toBe(docs.length);
    expect(shown.groups[0].open).toBe(false);
    expect(shown.groups[1].open).toBe(true);
    expect(shown.items.find((i) => i.id === docs[0].id)).toMatchObject({
      status: "have",
      note: "Reviewed on 12 October",
      stored: true,
    });
    expect(shown.ready).toBe(
      docs.length +
        checklist.items.filter(
          (i) => i.group !== "documents" && i.initialStatus === "have",
        ).length,
    );
  });

  it("shows a generated document as drafted until the provider sets a status, and never counts it ready", () => {
    const first = checklist.items.find((i) => i.group === "documents")!;
    const shown = mergeChecklist({
      checklist,
      stored: [],
      draftedDocumentTypeIds: [first.documentTypeId!],
    });
    expect(shown.items.find((i) => i.id === first.id)?.status).toBe("drafted");
    expect(shown.ready).toBe(
      checklist.items.filter((i) => i.initialStatus === "have").length,
    );
    const set = mergeChecklist({
      checklist,
      stored: [{ itemId: first.id, status: "in-progress", note: "" }],
      draftedDocumentTypeIds: [first.documentTypeId!],
    });
    expect(set.items.find((i) => i.id === first.id)?.status).toBe(
      "in-progress",
    );
  });

  it("labels statuses in plain words, with Adopted for documents", () => {
    expect(statusLabel("need", "people")).toBe("Need");
    expect(statusLabel("in-progress", "people")).toBe("In progress");
    expect(statusLabel("have", "people")).toBe("Have");
    expect(statusLabel("have", "documents")).toBe("Adopted");
    expect(DRAFTED_LABEL).toMatch(/review needed/);
  });

  it("the screen's short words and the print sheet's words come from one table (retro finding 9)", () => {
    expect(screenLabel("need")).toBe("Need");
    expect(screenLabel("in-progress")).toBe("Doing");
    expect(screenLabel("have")).toBe("Done");
    expect(screenLabel("drafted")).toBe("Drafted");
    for (const status of ["need", "in-progress", "have"] as const) {
      expect(screenLabel(status)).toBe(STATUS_WORDS[status].screen);
      expect(statusLabel(status, "people")).toBe(STATUS_WORDS[status].print);
    }
    expect(STATUS_WORDS.have.printDocuments).toBe("Adopted");
  });
});
