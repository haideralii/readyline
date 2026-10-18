// @vitest-environment node
/**
 * REQ-012 FR-4c (AC-10): the link check collects off-site links from
 * markdown, follows one redirect, records the final URL without its query
 * string, and names every non-200 first.
 */
import { describe, expect, it } from "vitest";
import {
  checkLinks,
  distinctOffSite,
  isOffSite,
  markdownLinks,
  report,
} from "./check-source-links-lib.mjs";

describe("the off-site link check (REQ-012 FR-4c)", () => {
  it("collects markdown links with their lines and leaves our own and anchor links out", () => {
    const md = `See [the Rules](https://www.legislation.gov.au/C2018L00633) and <https://www.ndiscommission.gov.au/x>.\nOurs: [pricing](https://readyline.com.au/pricing) and [here](#top).\nBare https://example.org/page.`;
    const links = markdownLinks(md, "g.md");
    expect(links.map((l) => l.url)).toEqual([
      "https://www.legislation.gov.au/C2018L00633",
      "https://www.ndiscommission.gov.au/x",
      "https://readyline.com.au/pricing",
      "https://example.org/page",
    ]);
    expect(isOffSite("https://readyline.com.au/pricing")).toBe(false);
    expect(isOffSite("https://www.ndiscommission.gov.au/x")).toBe(true);
    const distinct = distinctOffSite([
      ...links,
      { file: "h.md", line: 4, url: "https://example.org/page" },
    ]);
    expect(distinct.map((d) => d.url)).toEqual([
      "https://www.legislation.gov.au/C2018L00633",
      "https://www.ndiscommission.gov.au/x",
      "https://example.org/page",
    ]);
    expect(distinct[2].where).toEqual(["g.md:3", "h.md:4"]);
  });

  it("follows one redirect, records the final URL without its query, and names non-200s first", async () => {
    const answers: Record<
      string,
      { status: number; location?: string | null }
    > = {
      "https://a.test/old": {
        status: 301,
        location: "https://a.test/new?utm=x",
      },
      "https://a.test/new?utm=x": { status: 200 },
      "https://b.test/gone": { status: 404 },
      "https://c.test/ok": { status: 200 },
    };
    const results = await checkLinks(
      [
        { url: "https://a.test/old", where: ["g.md:1"] },
        { url: "https://b.test/gone", where: ["g.md:2"] },
        { url: "https://c.test/ok", where: ["g.md:3"] },
        { url: "https://d.test/down", where: ["g.md:4"] },
      ],
      async (url: string) => {
        const a = answers[url];
        if (!a) throw new Error("ECONNREFUSED");
        return a;
      },
    );
    expect(results.map((r) => [r.status, r.ok, r.hops])).toEqual([
      [200, true, 1],
      [404, false, 0],
      [200, true, 0],
      [-1, false, 0],
    ]);
    expect(results[0].finalUrl).toBe("https://a.test/new");
    const lines = report(results);
    expect(lines[0]).toMatch(/^FAIL 404 https:\/\/b\.test\/gone/);
    expect(lines[1]).toMatch(/^FAIL ERR https:\/\/d\.test\/down/);
    expect(lines.at(-1)).toBe("links: 2 of 4 not 200");
  });
});
