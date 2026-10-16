/**
 * The date the vendors' terms were last read (REQ-022 Session E, D-2258):
 * the privacy and AI pages say Anthropic does not use our requests to train
 * its models "under its commercial terms, as read on <date>", so the
 * sentence is a representation about a read, not about the vendor's future
 * conduct. The date is the lawyer's bundle index's (FR-11,
 * `product/evidence/req-022/legal-bundle-<date>.md`), the newest when there
 * are several. Server code only: it reads the file system.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

export const BUNDLE_DIR = join(process.cwd(), "product", "evidence", "req-022");

const BUNDLE_INDEX = /^legal-bundle-(\d{4}-\d{2}-\d{2})\.md$/;

/** The newest bundle index's date as YYYY-MM-DD, or null when no bundle has been built. */
export function vendorTermsDate(dir: string = BUNDLE_DIR): string | null {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  let best: string | null = null;
  for (const name of names) {
    const date = BUNDLE_INDEX.exec(name)?.[1];
    if (date && (!best || date > best)) best = date;
  }
  return best;
}
