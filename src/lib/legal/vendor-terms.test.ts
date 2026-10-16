// @vitest-environment node
/** REQ-022 Session E (D-2258): the vendor-terms date is the newest bundle index's, or null with no bundle. */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { vendorTermsDate } from "./vendor-terms";

const dirs: string[] = [];
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), "legal-bundle-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("vendorTermsDate", () => {
  it("returns the newest bundle index's date and ignores other files", () => {
    const d = scratch();
    writeFileSync(join(d, "legal-bundle-2026-10-20.md"), "# index\n");
    writeFileSync(join(d, "legal-bundle-2026-11-02.md"), "# index\n");
    writeFileSync(join(d, "legal-bundle-notes.md"), "not an index\n");
    writeFileSync(join(d, "screenshot-2026-12-01.png"), "");
    expect(vendorTermsDate(d)).toBe("2026-11-02");
  });

  it("is null for an empty folder and for a folder that does not exist", () => {
    expect(vendorTermsDate(scratch())).toBeNull();
    expect(
      vendorTermsDate(join(tmpdir(), "no-such-folder-readyline")),
    ).toBeNull();
  });
});
