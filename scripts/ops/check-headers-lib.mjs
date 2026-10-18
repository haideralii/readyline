/**
 * The security headers check (REQ-012 FR-1d, AC-2): one expected-values
 * table per route class, compared with the response a production build
 * gives. Pure functions here; `check-headers.mjs` does the fetching. The
 * table is the threat model's header set (`next.config.ts`, `src/proxy.ts`):
 * HSTS for the configured HSTS_MAX_AGE, nosniff, the referrer policy, the
 * permissions policy, X-Frame-Options DENY, no X-Powered-By, and a CSP with a
 * nonce and strict-dynamic, no unsafe-inline, object-src and frame-ancestors
 * 'none', base-uri 'self', and form-action naming Stripe's Checkout on the
 * purchase routes alone. Dependency-free so the script runs anywhere Node is.
 */

// Mirrors src/lib/ops/hsts.ts (the unit test asserts the two agree).
export const HSTS_DEFAULT_MAX_AGE = 604800;
export const HSTS_PRELOAD_FROM = 31536000;

export function hstsHeaderValue(raw) {
  const n = Number(raw?.trim());
  const maxAge = Number.isInteger(n) && n > 0 ? n : HSTS_DEFAULT_MAX_AGE;
  return `max-age=${maxAge}; includeSubDomains${maxAge >= HSTS_PRELOAD_FROM ? "; preload" : ""}`;
}

export const STATIC_HEADERS = Object.freeze({
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "x-frame-options": "DENY",
});

export const CHECKOUT_ORIGIN = "https://checkout.stripe.com";

/**
 * The route classes (FR-1d). `status`: the statuses a signed-out GET may
 * answer. `csp`: "page" when the response passes through the proxy and so
 * carries the policy; "none" when the proxy answers before the policy is
 * built (its own redirect), which the static headers still cover. `checkout`:
 * the purchase routes, where form-action names Stripe's Checkout origin.
 */
export const ROUTE_CLASSES = Object.freeze([
  { id: "content page", path: "/", status: [200], csp: "page" },
  {
    id: "purchase page",
    path: "/pricing",
    status: [200],
    csp: "page",
    checkout: true,
  },
  { id: "questionnaire", path: "/start", status: [200], csp: "page" },
  { id: "sign-in", path: "/sign-in", status: [200], csp: "page" },
  { id: "guide", path: "/guides/which-ndis-audit", status: [200], csp: "page" },
  { id: "legal page", path: "/privacy", status: [200], csp: "page" },
  { id: "404", path: "/this-page-does-not-exist", status: [404], csp: "page" },
  { id: "API route", path: "/api/health", status: [200], csp: "page" },
  {
    id: "auditor page (unknown token)",
    path: "/auditor/not-a-real-token",
    status: [404],
    csp: "page",
  },
  {
    id: "report page (unknown token)",
    path: "/report/not-a-real-token",
    status: [404],
    csp: "page",
  },
  {
    id: "worker home (signed out)",
    path: "/worker",
    status: [200, 307],
    csp: "page",
  },
  {
    id: "register page (signed out)",
    path: "/registers",
    status: [307],
    csp: "page",
  },
  {
    id: "documents (signed out, the proxy's redirect)",
    path: "/documents",
    status: [307],
    csp: "none",
  },
]);

/** Parses a CSP into { directive: [values] }. */
export function parseCsp(csp) {
  const out = {};
  for (const part of String(csp ?? "").split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name] = values;
  }
  return out;
}

const NONCE = /^'nonce-[A-Za-z0-9+/=_-]{16,}'$/;

/**
 * Compares one response with its class. `headers` is a plain object with
 * lower-case names. Returns problems, each { path, header, expected, actual };
 * an empty list means the route matches the table.
 */
export function checkResponse(route, response, options = {}) {
  const hsts = hstsHeaderValue(options.hstsMaxAge);
  const h = Object.fromEntries(
    Object.entries(response.headers ?? {}).map(([k, v]) => [
      k.toLowerCase(),
      String(v),
    ]),
  );
  const problems = [];
  const fail = (header, expected, actual) =>
    problems.push({
      path: route.path,
      header,
      expected,
      actual: actual ?? "(absent)",
    });

  if (!route.status.includes(response.status))
    fail("status", route.status.join(" or "), String(response.status));
  if (h["strict-transport-security"] !== hsts)
    fail("strict-transport-security", hsts, h["strict-transport-security"]);
  for (const [name, expected] of Object.entries(STATIC_HEADERS))
    if (h[name] !== expected) fail(name, expected, h[name]);
  if ("x-powered-by" in h) fail("x-powered-by", "(absent)", h["x-powered-by"]);

  const csp = h["content-security-policy"];
  if (route.csp === "none") {
    return problems;
  }
  if (!csp) {
    fail("content-security-policy", "a policy", undefined);
    return problems;
  }
  const d = parseCsp(csp);
  const has = (name, value) => (d[name] ?? []).includes(value);
  const cspFail = (what, expected, actual) =>
    fail(`content-security-policy ${what}`, expected, actual);

  if (!has("default-src", "'self'"))
    cspFail("default-src", "'self'", (d["default-src"] ?? []).join(" "));
  const script = d["script-src"] ?? [];
  if (
    !script.includes("'self'") ||
    !script.includes("'strict-dynamic'") ||
    !script.some((v) => NONCE.test(v))
  )
    cspFail(
      "script-src",
      "'self' 'nonce-…' 'strict-dynamic'",
      script.join(" "),
    );
  for (const bad of ["'unsafe-inline'", "'unsafe-eval'"])
    if (script.includes(bad))
      cspFail("script-src", `no ${bad}`, script.join(" "));
  const style = d["style-src"] ?? [];
  if (
    !style.includes("'self'") ||
    !style.some((v) => NONCE.test(v)) ||
    style.includes("'unsafe-inline'")
  )
    cspFail(
      "style-src",
      "'self' 'nonce-…', no 'unsafe-inline'",
      style.join(" "),
    );
  if (!has("object-src", "'none'"))
    cspFail("object-src", "'none'", (d["object-src"] ?? []).join(" "));
  if (!has("base-uri", "'self'"))
    cspFail("base-uri", "'self'", (d["base-uri"] ?? []).join(" "));
  if (!has("frame-ancestors", "'none'"))
    cspFail(
      "frame-ancestors",
      "'none'",
      (d["frame-ancestors"] ?? []).join(" "),
    );
  if (!has("connect-src", "'self'"))
    cspFail("connect-src", "'self' …", (d["connect-src"] ?? []).join(" "));
  const form = (d["form-action"] ?? []).join(" ");
  const expectedForm = route.checkout ? `'self' ${CHECKOUT_ORIGIN}` : "'self'";
  if (form !== expectedForm) cspFail("form-action", expectedForm, form);
  const stripeMentions = (csp.match(/stripe/g) ?? []).length;
  if (stripeMentions !== (route.checkout ? 1 : 0))
    cspFail(
      "stripe origins",
      route.checkout ? "Checkout in form-action only" : "none",
      String(stripeMentions),
    );
  return problems;
}

/** Runs every class over `fetchRoute(path) -> { status, headers }` and returns { results, problems }. */
export async function checkAll(fetchRoute, options = {}) {
  const results = [];
  const problems = [];
  for (const route of options.routes ?? ROUTE_CLASSES) {
    const response = await fetchRoute(route.path);
    const found = checkResponse(route, response, options);
    results.push({
      id: route.id,
      path: route.path,
      status: response.status,
      ok: found.length === 0,
    });
    problems.push(...found);
  }
  return { results, problems };
}

/** The lines the script prints: one per route, then one per problem. */
export function report({ results, problems }) {
  const lines = results.map(
    (r) =>
      `${r.ok ? "ok  " : "FAIL"} ${r.id.padEnd(44)} ${r.path.padEnd(28)} ${r.status}`,
  );
  for (const p of problems)
    lines.push(
      `FAIL ${p.path} ${p.header}: expected ${p.expected}, got ${p.actual}`,
    );
  lines.push(
    problems.length === 0
      ? `headers: ${results.length} route classes match the table`
      : `headers: ${problems.length} mismatch(es) on ${new Set(problems.map((p) => p.path)).size} route(s)`,
  );
  return lines;
}
