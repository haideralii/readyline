import { describe, expect, it } from "vitest";
import { isCrossSiteRequest } from "./cross-site";

describe("isCrossSiteRequest (retro review of REQ-009, finding 48)", () => {
  it("refuses only what another site started", () => {
    expect(
      isCrossSiteRequest(new Headers({ "Sec-Fetch-Site": "cross-site" })),
    ).toBe(true);
    expect(
      isCrossSiteRequest(new Headers({ "sec-fetch-site": " Cross-Site " })),
    ).toBe(true);
  });

  it("lets through same-origin, same-site, user-started and header-less requests", () => {
    for (const value of ["same-origin", "same-site", "none"])
      expect(
        isCrossSiteRequest(new Headers({ "Sec-Fetch-Site": value })),
        value,
      ).toBe(false);
    expect(isCrossSiteRequest(new Headers())).toBe(false);
  });
});
