import { describe, expect, it } from "vitest";
import { siteIsHttps, siteUrl } from "./site";

/**
 * The canonical origin and whether it is https: the session cookies are
 * Secure only over https (QA live b340ee3, batch C, #108 run 1: WebKit drops
 * a Secure cookie set over http://localhost, where Chromium keeps it).
 */
describe("siteUrl and siteIsHttps", () => {
  it("drops the trailing slash and defaults to localhost", () => {
    expect(
      siteUrl({ NEXT_PUBLIC_SITE_URL: "https://readyline.example/" }),
    ).toBe("https://readyline.example");
    expect(siteUrl({})).toBe("http://localhost:3000");
  });

  it("is https for the production origin and not for localhost or CI", () => {
    expect(
      siteIsHttps({ NEXT_PUBLIC_SITE_URL: "https://readyline.example" }),
    ).toBe(true);
    expect(
      siteIsHttps({ NEXT_PUBLIC_SITE_URL: "HTTPS://readyline.example/" }),
    ).toBe(true);
    expect(siteIsHttps({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe(
      false,
    );
    expect(siteIsHttps({})).toBe(false);
  });
});
