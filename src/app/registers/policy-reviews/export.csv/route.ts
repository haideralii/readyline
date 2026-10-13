import { strictObject } from "@/lib/validation";
import { makeExportHandler } from "@/server/registers/export-route";

/** GET /registers/policy-reviews/export.csv (REQ-009 FR-6). No query parameters. */
export const GET = makeExportHandler("policy-reviews", strictObject({}));
