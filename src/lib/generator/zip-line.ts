/**
 * REQ-028 FR-7 (D-2275 (4)): the line under the documents page's zip
 * button, "N Word files and the readiness summary, about X MB", X from the
 * stored set.zip's size to one decimal; no size when the object is missing.
 */
const MB = 1024 * 1024;

export function zipSizeWords(bytes: number): string {
  const mb = bytes / MB;
  if (mb < 0.05) return "under 0.1 MB";
  return `about ${mb.toFixed(1)} MB`;
}

export function zipSizeLine(count: number, bytes: number | null): string {
  const files = `${count} Word ${count === 1 ? "file" : "files"} and the readiness summary`;
  return bytes === null ? files : `${files}, ${zipSizeWords(bytes)}`;
}
