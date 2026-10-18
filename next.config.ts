import type { NextConfig } from "next";
import { hstsHeaderValue } from "./src/lib/ops/hsts";

/**
 * Static security headers from product/security/threat-model.md (REQ-002 FR-2).
 * The Content-Security-Policy is per request with a nonce and lives in
 * src/proxy.ts. HSTS is only honoured by browsers over HTTPS, so it is
 * harmless on localhost. REQ-022 FR-10 (Session C): its max-age is
 * HSTS_MAX_AGE, read here at build (one week by default, `preload` only
 * from one year), so the domain's two-step is two variable edits and two
 * redeploys, never a code change.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: hstsHeaderValue(process.env.HSTS_MAX_AGE),
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
