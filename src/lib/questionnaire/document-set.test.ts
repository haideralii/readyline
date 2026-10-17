// @vitest-environment node
/** REQ-027 D-2718 (finding 115): the legend's numeral is the set's own count of asked documents. */
import { describe, expect, it } from "vitest";
import { askedDocumentCount, deriveDocumentSet } from "./document-set";

describe("askedDocumentCount", () => {
  it("counts the documents step 5 asked about, whatever the answer, and none of the unasked rows", () => {
    const set = deriveDocumentSet(["core"], ["0107"], {
      policies: "yes",
      incidentRegister: "yes",
      complaintsRegister: "no",
      insuranceCertificate: "no",
      workerInductionRecords: "not-sure",
    });
    // The three step-5 answers that speak to a document (EXISTING_TO_DOCUMENT); the other two map to no row.
    expect(askedDocumentCount(set)).toBe(3);
    expect(set.documents.filter((d) => d.have === "unknown").length).toBe(
      set.documents.length - 3,
    );
    expect(askedDocumentCount({ documents: [] })).toBe(0);
  });
});
