import { strictObject } from "@/lib/validation";
import { makeExportHandler } from "@/server/registers/export-route";

/** GET /registers/incidents/export.zip: the register and its events as two CSVs (REQ-009 FR-6). No query parameters. */
export const GET = makeExportHandler("incidents", strictObject({}));
