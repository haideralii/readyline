import type { NextConfig } from "next";

/**
 * Static security headers from product/security/threat-model.md (REQ-002 FR-2).
 * The Content-Security-Policy is per request with a nonce and lives in
 * src/proxy.ts. HSTS is only honoured by browsers over HTTPS, so it is
 * harmless on localhost; `preload` is set now so the domain can be submitted
 * to the preload list once it is live.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Legacy equivalent of frame-ancestors 'none' for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // Cache Components (partial prerendering) is off because a nonce-based CSP
  // needs every HTML response rendered per request. See DECISIONS D-003 and
  // D-202; the hash-based alternative was spiked and failed (11 inline
  // bootstrap scripts blocked, no hydration).
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
