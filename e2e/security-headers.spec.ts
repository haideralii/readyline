import { test, expect } from "@playwright/test";

/**
 * REQ-002 AC-3: the threat-model headers are present on "/" and the page
 * renders without a single CSP violation, on both Playwright projects.
 */
test.describe("security headers", () => {
  test("threat-model headers are set on / and the page renders without CSP violations", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        w.__csp.push(`${e.violatedDirective} blocked=${e.blockedURI}`);
      });
    });

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    const headers = response!.headers();

    const csp = headers["content-security-policy"];
    expect(csp, "CSP header present").toBeTruthy();
    const directives = Object.fromEntries(
      csp.split(";").map((d) => {
        const [name, ...values] = d.trim().split(/\s+/);
        return [name, values];
      }),
    );
    expect(directives["script-src"]).toContain("'self'");
    expect(directives["script-src"]).toContain("'strict-dynamic'");
    expect(
      directives["script-src"].some((v) =>
        /^'nonce-[A-Za-z0-9+/=_-]{16,}'$/.test(v),
      ),
    ).toBe(true);
    expect(directives["script-src"]).not.toContain("'unsafe-inline'");
    expect(directives["object-src"]).toEqual(["'none'"]);
    expect(directives["base-uri"]).toEqual(["'self'"]);
    expect(directives["form-action"]).toEqual(["'self'"]);
    expect(directives["frame-ancestors"]).toEqual(["'none'"]);

    expect(headers["strict-transport-security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();

    // A fresh nonce per request.
    const second = await page.request.get("/");
    const nonce = (h: string) => /'nonce-([^']+)'/.exec(h)?.[1];
    expect(nonce(second.headers()["content-security-policy"])).not.toBe(
      nonce(csp),
    );

    // The page works under the policy: content visible, React hydrated (skip link focus is client behaviour).
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const violations = await page.evaluate(
      () => (window as unknown as { __csp: string[] }).__csp,
    );
    expect(violations).toEqual([]);
  });
});
