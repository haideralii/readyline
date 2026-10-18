/**
 * The committed sample document (batch 24 item 2), imported statically so
 * the home page and the download route need no file read at request time.
 * Regenerate with WRITE_SAMPLE=1 on sample-document.test.ts after a prompt
 * or fixture change; the test fails if the file drifts.
 */
import type { DocumentModel } from "@/lib/generator/document-model";
import sampleJson from "../../data/samples/complaints-policy.json";

export const SAMPLE_DOCUMENT = sampleJson as unknown as DocumentModel;
export const SAMPLE_DOWNLOAD_PATH = "/sample/complaints-policy.docx";
export const SAMPLE_FILE_NAME =
  "sample-complaints-policy-example-supports.docx";
/** REQ-034 FR-4 (D-2947): the same document as a PDF, for a buyer on a phone. */
export const SAMPLE_PDF_PATH = "/sample/complaints-policy.pdf";
export const SAMPLE_PDF_FILE_NAME =
  "sample-complaints-policy-example-supports.pdf";
/** The footer both files carry on every page (D-2947), in place of the draft mark a provider's own documents carry. */
export const SAMPLE_FOOTER =
  "Sample prepared with Readyline for a fictional sole trader";

/** The committed model with the sample's footer, for the two download routes. */
export function sampleModelForFiles(): DocumentModel {
  return { ...SAMPLE_DOCUMENT, footer: SAMPLE_FOOTER };
}
