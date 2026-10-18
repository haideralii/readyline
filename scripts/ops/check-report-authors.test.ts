// @vitest-environment node
/**
 * REQ-012 SR-1 (D-2913, D-2926): the report-author check finds a git-log
 * name or email inside a report file and any address shape, allows the
 * fixture domains, and names files and counts only.
 */
import { describe, expect, it } from "vitest";
import { checkReportAuthors } from "./check-report-authors-lib.mjs";

const identities = ["Jane Citizen", "jane.citizen@example.net", "JC", "x"];

describe("the report-author check (REQ-012 SR-1, D-2913)", () => {
  it("passes a report that names roles and fixture addresses only", () => {
    const r = checkReportAuthors(
      [
        {
          path: "a.md",
          text: "Author: Dev-2 (role). The PO's NVDA walk. owner@example.test wrote nothing.",
        },
      ],
      identities,
    );
    expect(r.ok).toBe(true);
    expect(r.lines.at(-1)).toContain("carry no git-log name or email");
  });

  it("fails on a git-log name, a git-log email, or any other address, naming the file and the count only", () => {
    const r = checkReportAuthors(
      [
        { path: "a.md", text: "Reviewed by Jane Citizen on Tuesday." },
        { path: "b.md", text: "Contact JANE.CITIZEN@EXAMPLE.NET for the key." },
        { path: "c.md", text: "Send to someone@company.com.au" },
        { path: "d.md", text: "Clean." },
      ],
      identities,
    );
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toBe("FAIL a.md (1 hit)");
    expect(r.lines[1]).toMatch(/^FAIL b\.md \(\d hits?\)$/);
    expect(r.lines[2]).toBe("FAIL c.md (1 hit)");
    expect(r.lines[3]).toBe("ok   d.md (0 hits)");
    expect(r.lines.join("\n")).not.toContain("Jane");
    expect(r.lines.join("\n")).not.toContain("@");
  });

  it("a two-letter identity is matched as a whole word, a one-letter one is ignored", () => {
    const r = checkReportAuthors(
      [{ path: "a.md", text: "The JCB digger; the xylophone." }],
      identities,
    );
    expect(r.ok).toBe(true);
    const hit = checkReportAuthors(
      [{ path: "a.md", text: "Signed: JC" }],
      identities,
    );
    expect(hit.ok).toBe(false);
  });
});
