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

    // REQ-007 SR-5 and the retro review of REQ-002 (15 Oct 2026, fix 15):
    // Stripe's hosted Checkout is a form destination on every page that
    // carries a Buy or Subscribe form (the list mirrors PURCHASE_ROUTES in
    // src/proxy.ts) and appears nowhere else in the policy. The signed-in
    // pages answer a visitor with a redirect; the proxy sets the header on
    // that response too, so no session is needed to check it.
    for (const path of [
      "/pricing",
      "/documents",
      "/account",
      "/path/before-you-buy",
    ]) {
      const res = await page.request.get(path, { maxRedirects: 0 });
      const routeCsp = res.headers()["content-security-policy"];
      expect(routeCsp, path).toContain(
        "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
      );
      expect(routeCsp.match(/stripe/g)?.length, path).toBe(2);
    }
    for (const path of ["/account/deleted", "/documents/not-a-set"]) {
      const res = await page.request.get(path, { maxRedirects: 0 });
      expect(res.headers()["content-security-policy"], path).not.toContain(
        "stripe",
      );
    }
    expect(csp).not.toContain("stripe");

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

  // Backlog 5 (ASVS L1 re-check, D-209): the same headers on every kind of
  // route, not only the home page: a content page, the questionnaire, the
  // sign-in form, a guide, a missing page and an API route.
  test("the threat-model headers are on every kind of route, including 404 and the API", async ({
    request,
  }) => {
    const paths = [
      "/pricing",
      "/start",
      "/sign-in",
      "/guides/which-ndis-audit",
      "/this-page-does-not-exist",
      "/api/health",
    ];
    for (const path of paths) {
      const res = await request.get(path, { maxRedirects: 0 });
      const h = res.headers();
      expect(h["strict-transport-security"], path).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["referrer-policy"], path).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(h["permissions-policy"], path).toBe(
        "camera=(), microphone=(), geolocation=(), payment=()",
      );
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["x-powered-by"], path).toBeUndefined();
      const csp = h["content-security-policy"];
      expect(csp, `${path} CSP`).toContain("frame-ancestors 'none'");
      expect(csp, `${path} CSP`).toContain("object-src 'none'");
      expect(csp, `${path} CSP`).not.toContain("'unsafe-inline' 'strict");
    }
  });
});
