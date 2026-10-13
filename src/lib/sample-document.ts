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
