import { describe, expect, it } from "vitest";
import { aliasKeepsPath, aliasRedirectTarget } from "./alias-redirect";

/**
 * REQ-022 FR-8, AC-5 (Session C; D-2203): the vercel.app alias answers 301
 * to the domain for every path but `/api/*`; nothing when the hosts match,
 * on a preview, off a vercel.app host, or while the site is still the alias.
 */
const PROD = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://readyline.example",
};
const on = (
  host: string | null,
  pathname: string,
  search = "",
  env: Record<string, string | undefined> = PROD,
) => aliasRedirectTarget({ host, pathname, search, env });

describe("the alias redirect (REQ-022 FR-8)", () => {
  it("sends every page on the vercel.app name to the same path on the domain, query kept", () => {
    expect(on("readyline-zeta.vercel.app", "/")).toBe(
      "https://readyline.example/",
    );
    expect(on("readyline-zeta.vercel.app", "/pricing")).toBe(
      "https://readyline.example/pricing",
    );
    expect(
      on("readyline-zeta.vercel.app", "/sign-in", "?next=%2Faccount"),
    ).toBe("https://readyline.example/sign-in?next=%2Faccount");
    expect(on("Readyline-Zeta.VERCEL.APP", "/guides")).toBe(
      "https://readyline.example/guides",
    );
  });

  it("keeps /api/* on the alias until the crons and the webhook have moved (the exclusion)", () => {
    for (const path of [
      "/api",
      "/api/health",
      "/api/jobs/reminders",
      "/api/stripe/webhook",
    ]) {
      expect(aliasKeepsPath(path), path).toBe(true);
      expect(on("readyline-zeta.vercel.app", path), path).toBeNull();
    }
    expect(aliasKeepsPath("/apis")).toBe(false);
    expect(aliasKeepsPath("/pricing")).toBe(false);
  });

  it("does nothing when the two hosts match, before the domain exists, or when the site is still the alias", () => {
    expect(on("readyline.example", "/pricing")).toBeNull();
    expect(
      on("readyline-zeta.vercel.app", "/pricing", "", {
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://readyline-zeta.vercel.app",
      }),
    ).toBeNull();
    expect(
      on("readyline-zeta.vercel.app", "/pricing", "", {
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://other-name.vercel.app",
      }),
    ).toBeNull();
    expect(
      on("readyline-zeta.vercel.app", "/pricing", "", {
        VERCEL_ENV: "production",
      }),
    ).toBeNull();
    expect(
      on("readyline-zeta.vercel.app", "/pricing", "", {
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "not a url",
      }),
    ).toBeNull();
  });

  it("never redirects a preview, a local run or a host that is not a vercel.app name", () => {
    expect(
      on("feature-x-readyline.vercel.app", "/", "", {
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_SITE_URL: "https://readyline.example",
      }),
    ).toBeNull();
    expect(
      on("localhost:3000", "/", "", {
        NEXT_PUBLIC_SITE_URL: "https://readyline.example",
      }),
    ).toBeNull();
    expect(on("localhost:3000", "/")).toBeNull();
    expect(on("www.readyline.example", "/")).toBeNull();
    expect(on(null, "/")).toBeNull();
  });
});
