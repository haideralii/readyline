// @vitest-environment node
import { describe, expect, it } from "vitest";
import { loadLegalPage } from "./pages";

/**
 * REQ-031 AC-7 (D-2886; the acceptance self-check, 18 Oct 2026): the result
 * email's sentence is a bullet of "What we collect", not elsewhere on the
 * privacy page.
 */
const SENTENCE =
  "If you ask us to email you your result, we send it once to the address you type and do not keep the address. We keep a one-way code of it in our security log so we can see a send happened.";

describe("privacy.md: the result email's bullet", () => {
  it("sits under the heading 'What we collect', before the next heading", () => {
    const body = loadLegalPage("privacy").body;
    const heading = body.indexOf("## What we collect");
    expect(heading).toBeGreaterThan(-1);
    const next = body.indexOf("\n## ", heading + 1);
    expect(next).toBeGreaterThan(heading);
    const at = body.indexOf(`- ${SENTENCE}`);
    expect(at).toBeGreaterThan(heading);
    expect(at).toBeLessThan(next);
  });
});
