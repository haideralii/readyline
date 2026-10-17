import { strictObject } from "@/lib/validation";
import { PERIOD_QUERY_FIELDS } from "@/lib/validation/schemas/period";
import { makeExportHandler } from "@/server/registers/export-route";

/** GET /registers/policy-reviews/export.csv (REQ-009 FR-6). The period parameters alone (REQ-023 FR-5). */
export const GET = makeExportHandler(
  "policy-reviews",
  strictObject(PERIOD_QUERY_FIELDS),
);
