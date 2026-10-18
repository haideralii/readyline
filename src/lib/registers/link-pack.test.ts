/** REQ-029 FR-11 (D-2863, D-2294): one stored pack per link and period, named by its render day. */
import { describe, expect, it } from "vitest";
import {
  findLinkPack,
  linkPackKey,
  linkPackObjectName,
  linkPackPrefix,
  parseLinkPackObject,
  renderedOnLine,
} from "./link-pack";

describe("the auditor link's stored pack names", () => {
  it("lives under the account's prefix, keyed by the period and dated by the render day", () => {
    expect(linkPackPrefix("acc", "link")).toBe("acc/auditor-links/link");
    expect(linkPackKey("")).toBe("all");
    expect(linkPackKey("-this-period-from-2026-07-01")).toBe(
      "this-period-from-2026-07-01",
    );
    expect(linkPackObjectName("", "2026-10-18")).toBe("all-2026-10-18.zip");
    expect(linkPackObjectName("-2026-01-01-to-2026-06-30", "2026-10-18")).toBe(
      "2026-01-01-to-2026-06-30-2026-10-18.zip",
    );
  });

  it("reads the key and the day back, and ignores other files", () => {
    expect(parseLinkPackObject("all-2026-10-18.zip")).toEqual({
      key: "all",
      stamp: "2026-10-18",
    });
    expect(
      parseLinkPackObject("2026-01-01-to-2026-06-30-2026-10-18.zip"),
    ).toEqual({ key: "2026-01-01-to-2026-06-30", stamp: "2026-10-18" });
    expect(parseLinkPackObject("notes.txt")).toBeNull();
    expect(parseLinkPackObject(".emptyFolderPlaceholder")).toBeNull();
  });

  it("finds the stored pack for a period and names the download as a fresh render would, dated by the render day", () => {
    const names = [
      ".emptyFolderPlaceholder",
      "all-2026-10-18.zip",
      "since-audit-2026-02-01-2026-10-19.zip",
    ];
    const all = findLinkPack(names, "", "Sunrise Supports");
    expect(all?.name).toBe("all-2026-10-18.zip");
    expect(all?.stamp).toBe("2026-10-18");
    expect(all?.fileName).toContain("2026-10-18");
    const since = findLinkPack(
      names,
      "-since-audit-2026-02-01",
      "Sunrise Supports",
    );
    expect(since?.name).toBe("since-audit-2026-02-01-2026-10-19.zip");
    expect(since?.fileName).toContain("since-audit-2026-02-01");
    expect(findLinkPack(names, "-this-period-from-2026-07-01", "X")).toBeNull();
  });

  it("the cover's line names the day and that later changes are not in the file", () => {
    expect(renderedOnLine("2026-10-18")).toContain("made on 2026-10-18");
    expect(renderedOnLine("2026-10-18")).toContain("does not change");
  });
});
