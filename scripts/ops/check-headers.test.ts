// @vitest-environment node
/**
 * REQ-012 FR-1d, AC-2: the headers check's comparison. A response carrying
 * the threat model's headers matches its class; one changed header fails
 * naming the route and the header; the Checkout origin is right on the
 * purchase page and wrong anywhere else; the HSTS expectation is the one the
 * build emits (`src/lib/ops/hsts.ts`).
 */
import { describe, expect, it } from "vitest";
import { hstsHeaderValue as hstsFromBuild } from "@/lib/ops/hsts";
import {
  CHECKOUT_ORIGIN,
  ROUTE_CLASSES,
  STATIC_HEADERS,
  checkAll,
  checkResponse,
  hstsHeaderValue,
  parseCsp,
  report,
} from "./check-headers-lib.mjs";

const NONCE = "'nonce-" + "a".repeat(22) + "'";

function csp(
  opts: { checkout?: boolean; scriptExtra?: string; styleExtra?: string } = {},
) {
  return [
    "default-src 'self'",
    `script-src 'self' ${NONCE} 'strict-dynamic'${opts.scriptExtra ?? ""}`,
    `style-src 'self' ${NONCE}${opts.styleExtra ?? ""}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self' https://example.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self'${opts.checkout ? ` ${CHECKOUT_ORIGIN}` : ""}`,
    "frame-ancestors 'none'",
  ].join("; ");
}

function good(status = 200, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    "strict-transport-security": hstsHeaderValue(undefined),
    ...STATIC_HEADERS,
    "content-security-policy": csp(),
    ...extra,
  };
  return { status, headers };
}

const byId = (id: string) => ROUTE_CLASSES.find((r) => r.id === id)!;

describe("the headers check (REQ-012 FR-1d, AC-2)", () => {
  it("expects the Strict-Transport-Security value the build emits, at both configured ages", () => {
    for (const raw of [undefined, "604800", "31536000", "nonsense"])
      expect(hstsHeaderValue(raw)).toBe(hstsFromBuild(raw));
    expect(hstsHeaderValue("31536000")).toContain("preload");
    expect(hstsHeaderValue("604800")).not.toContain("preload");
  });

  it("a response with the threat model's headers matches its class", () => {
    expect(checkResponse(byId("content page"), good())).toEqual([]);
    expect(checkResponse(byId("404"), good(404))).toEqual([]);
    expect(
      checkResponse(byId("purchase page"), {
        status: 200,
        headers: {
          ...good().headers,
          "content-security-policy": csp({ checkout: true }),
        },
      }),
    ).toEqual([]);
  });

  it("one changed header fails naming the route and the header", () => {
    const changed = good();
    changed.headers["x-frame-options"] = "SAMEORIGIN";
    const problems = checkResponse(byId("content page"), changed);
    expect(problems).toEqual([
      {
        path: "/",
        header: "x-frame-options",
        expected: "DENY",
        actual: "SAMEORIGIN",
      },
    ]);
    const missing = good();
    delete (missing.headers as Record<string, string>)["referrer-policy"];
    expect(checkResponse(byId("guide"), missing)).toEqual([
      {
        path: "/guides/which-ndis-audit",
        header: "referrer-policy",
        expected: "strict-origin-when-cross-origin",
        actual: "(absent)",
      },
    ]);
    expect(
      checkResponse(
        byId("content page"),
        good(200, { "x-powered-by": "Next.js" }),
      )[0],
    ).toMatchObject({ header: "x-powered-by", expected: "(absent)" });
    expect(checkResponse(byId("content page"), good(500))[0]).toMatchObject({
      header: "status",
      expected: "200",
      actual: "500",
    });
  });

  it("the policy is held to its shape: nonce and strict-dynamic, no unsafe-inline, 'none' where 'none' belongs", () => {
    const unsafe = good();
    unsafe.headers["content-security-policy"] = csp({
      scriptExtra: " 'unsafe-inline'",
    });
    expect(
      checkResponse(byId("content page"), unsafe).map((p) => p.header),
    ).toEqual(["content-security-policy script-src"]);
    const inlineStyles = good();
    inlineStyles.headers["content-security-policy"] = csp({
      styleExtra: " 'unsafe-inline'",
    });
    expect(
      checkResponse(byId("content page"), inlineStyles).map((p) => p.header),
    ).toEqual(["content-security-policy style-src"]);
    const none = good();
    none.headers["content-security-policy"] = csp().replace(
      "frame-ancestors 'none'",
      "frame-ancestors 'self'",
    );
    expect(
      checkResponse(byId("content page"), none).map((p) => p.header),
    ).toEqual(["content-security-policy frame-ancestors"]);
    const absent = good();
    delete (absent.headers as Record<string, string>)[
      "content-security-policy"
    ];
    expect(
      checkResponse(byId("API route"), absent).map((p) => p.header),
    ).toEqual(["content-security-policy"]);
  });

  it("Stripe's Checkout origin belongs to the purchase page's form-action alone", () => {
    const elsewhere = good();
    elsewhere.headers["content-security-policy"] = csp({ checkout: true });
    expect(
      checkResponse(byId("content page"), elsewhere).map((p) => p.header),
    ).toEqual([
      "content-security-policy form-action",
      "content-security-policy stripe origins",
    ]);
    expect(
      checkResponse(byId("purchase page"), good()).map((p) => p.header),
    ).toEqual([
      "content-security-policy form-action",
      "content-security-policy stripe origins",
    ]);
  });

  it("a route the proxy redirects before the policy is built is held to the static headers alone", () => {
    const redirect = good(307);
    delete (redirect.headers as Record<string, string>)[
      "content-security-policy"
    ];
    expect(
      checkResponse(
        byId("documents (signed out, the proxy's redirect)"),
        redirect,
      ),
    ).toEqual([]);
    delete (redirect.headers as Record<string, string>)[
      "x-content-type-options"
    ];
    expect(
      checkResponse(
        byId("documents (signed out, the proxy's redirect)"),
        redirect,
      )[0],
    ).toMatchObject({
      header: "x-content-type-options",
    });
  });

  it("the table covers every route class FR-1d names", () => {
    const ids = ROUTE_CLASSES.map((r) => r.id);
    for (const word of [
      "content",
      "questionnaire",
      "sign-in",
      "guide",
      "legal",
      "404",
      "API",
      "auditor",
      "report",
      "worker",
      "register",
      "purchase",
    ])
      expect(
        ids.some((id) => id.includes(word)),
        word,
      ).toBe(true);
    expect(parseCsp("a 'x'; b 'y' 'z'")).toEqual({
      a: ["'x'"],
      b: ["'y'", "'z'"],
    });
  });

  it("checkAll runs every class and the report names the mismatch, exit 1 by the script", async () => {
    const fetchRoute = async (path: string) => {
      const route = ROUTE_CLASSES.find((r) => r.path === path)!;
      const response = good(route.status[0]);
      if (route.checkout)
        response.headers["content-security-policy"] = csp({ checkout: true });
      if (route.csp === "none")
        delete (response.headers as Record<string, string>)[
          "content-security-policy"
        ];
      if (path === "/sign-in") response.headers["x-frame-options"] = "ALLOWALL";
      return response;
    };
    const outcome = await checkAll(fetchRoute);
    expect(outcome.results).toHaveLength(ROUTE_CLASSES.length);
    expect(outcome.problems).toEqual([
      {
        path: "/sign-in",
        header: "x-frame-options",
        expected: "DENY",
        actual: "ALLOWALL",
      },
    ]);
    const lines = report(outcome);
    expect(
      lines.some((l: string) =>
        l.startsWith(
          "FAIL /sign-in x-frame-options: expected DENY, got ALLOWALL",
        ),
      ),
    ).toBe(true);
    expect(lines.at(-1)).toBe("headers: 1 mismatch(es) on 1 route(s)");
  });
});
