/**
 * Server-side access to the standards dataset (REQ-003 Q3: `standards.json`
 * stays on the server; only derived, small shapes reach the browser).
 * Parsed once per process.
 */
import standardsJson from "../../../data/standards.json";
import { StandardsDataset, type StandardsDataset as Dataset } from "./schema";

let cached: Dataset | undefined;

export function getStandardsDataset(): Dataset {
  cached ??= StandardsDataset.parse(standardsJson);
  return cached;
}
