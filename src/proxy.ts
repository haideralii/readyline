/**
 * Per-request Content Security Policy with a fresh nonce (REQ-002 FR-2, AC-3;
 * DECISIONS D-202). Next.js reads the nonce from the request's CSP header and
 * attaches it to every script and style it emits, so no 'unsafe-inline' is
 * needed for scripts. Nonces require per-request rendering, which is why
 * Cache Components is off in next.config.ts.
 *
 * Non-CSP headers (HSTS, nosniff, referrer, permissions, frame options) are
 * static and live in next.config.ts `headers()`.
 */
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes with a Buy form (REQ-007 SR-5). With JavaScript off the form posts
 * and the server answers with a redirect to Stripe's hosted Checkout, which
 * `form-action` governs; nowhere else may a form leave our origin. No Stripe
 * script, frame or connection exists on any page, so nothing is added to
 * script-src, frame-src or connect-src (D-710).
 */
export const PURCHASE_ROUTES = ["/pricing", "/documents"] as const;
export const CHECKOUT_ORIGIN = "https://checkout.stripe.com";

export function isPurchaseRoute(pathname: string): boolean {
  return PURCHASE_ROUTES.some((p) => pathname === p);
}

export function buildCsp(
  nonce: string,
  isDev: boolean,
  supabaseOrigin: string | null = supabaseOriginFromEnv(),
  options: { purchaseRoute?: boolean } = {},
): string {
  return [
    "default-src 'self'",
    // strict-dynamic lets scripts loaded by a nonced script run without listing hosts.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Dev tooling injects inline styles; production styles are files plus nonced inline tags.
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // HMR in development uses a websocket; Supabase and Stripe origins are added in their REQs.
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self'${options.purchaseRoute ? ` ${CHECKOUT_ORIGIN}` : ""}`,
    "frame-ancestors 'none'",
  ].join("; ");
}

/** The Supabase project origin for connect-src (REQ-004 SR-2), or null when not configured. */
export function supabaseOriginFromEnv(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Routes whose page redirects a signed-out visitor to sign-in but sits under
 * a loading boundary, so the redirect would otherwise arrive inside a
 * streamed 200 (batch 47 item 7). Without any Supabase session cookie the
 * proxy answers the 307 itself, as /registers does; with a cookie the page
 * still verifies the session, and the loading UI stays for the signed-in
 * load.
 */
export const SESSION_ROUTES = ["/documents", "/checklist"] as const;

export function needsSessionRedirect(
  pathname: string,
  cookieNames: readonly string[],
): string | null {
  const guarded = SESSION_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!guarded) return null;
  const hasSession = cookieNames.some(
    (n) => n.startsWith("sb-") && n.includes("-auth-token"),
  );
  return hasSession ? null : `/sign-in?next=${encodeURIComponent(pathname)}`;
}

export function proxy(request: NextRequest) {
  const redirectTo = needsSessionRedirect(
    request.nextUrl.pathname,
    request.cookies.getAll().map((c) => c.name),
  );
  if (redirectTo) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url, 307);
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(
    nonce,
    process.env.NODE_ENV === "development",
    supabaseOriginFromEnv(),
    { purchaseRoute: isPurchaseRoute(request.nextUrl.pathname) },
  );

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except static assets, image optimisation and the favicon;
      // prefetches skip the proxy too, as the Next.js CSP guide recommends.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
