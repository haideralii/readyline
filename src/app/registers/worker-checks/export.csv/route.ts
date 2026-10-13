import { strictObject } from "@/lib/validation";
import { makeExportHandler } from "@/server/registers/export-route";

/** GET /registers/worker-checks/export.csv (REQ-009 FR-6). No query parameters. */
export const GET = makeExportHandler("worker-checks", strictObject({}));
