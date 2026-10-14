/**
 * Guard for REQ-002 FR-3: every route handler and server action must go
 * through the validation layer. A lint rule cannot express "this file is a
 * boundary", so this test walks the app tree instead. It passes vacuously
 * until the first handler exists and then fails the moment one skips
 * validation.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry))
      out.push(p);
  }
  return out;
}

const files = walk(join(root, "src"));
const routeHandlers = files.filter((f) =>
  /[\\/]app[\\/].*[\\/]route\.ts$/.test(f),
);
const serverActionFiles = files.filter((f) =>
  /^\s*["']use server["']/m.test(readFileSync(f, "utf8")),
);

describe("boundaries use the validation layer", () => {
  it("every route handler imports from @/lib/validation", () => {
    const missing = routeHandlers.filter(
      (f) => !/from\s+["']@\/lib\/validation["']/.test(readFileSync(f, "utf8")),
    );
    expect(missing.map((f) => relative(root, f))).toEqual([]);
  });

  it("every server action file imports from @/lib/validation", () => {
    const missing = serverActionFiles.filter(
      (f) => !/from\s+["']@\/lib\/validation["']/.test(readFileSync(f, "utf8")),
    );
    expect(missing.map((f) => relative(root, f))).toEqual([]);
  });

  it("no boundary file uses z.object directly (use strictObject)", () => {
    const offenders = [...routeHandlers, ...serverActionFiles].filter((f) =>
      /\bz\.object\(/.test(readFileSync(f, "utf8")),
    );
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});

/**
 * Backlog 5 (OWASP ASVS L1 re-check, REQ-004 SR-3, D-424): every boundary
 * either runs behind a session (a signed-in viewer, an owned account or
 * the admin context), behind a shared secret or signature (cron routes,
 * the Stripe webhook), or behind a rate limiter when it is public. A new
 * action or route file without one of these fails here, so "every public
 * POST has a limit" stays true as the app grows.
 */
const GATES: readonly RegExp[] = [
  /\bgetViewer\(\)/,
  /\bgetOwnedAccount\(/,
  /\breadAdminContext\(\)/,
  /\bisAuthorisedCronRequest\(/,
  /\bverifyWebhookSignature\(|stripe-signature/,
  /\bMemoryRateLimiter\(/,
  /\bcheck\w+Allowed\(/,
  /\bhitRateLimit\(/,
  /\bauth\.signOut\(/,
  // The sign-in callback consumes a single-use token issued by Supabase.
  /\bverifyOtp\(/,
  // The fake Checkout page is inert outside fake mode (redirects home first).
  /if \(!env\.fake\) redirect\(/,
  // The register export routes delegate to one handler that reads the viewer and hits the export limiter.
  /\bmakeExportHandler\(/,
];

describe("boundaries are gated (ASVS L1, backlog 5)", () => {
  it("every route handler and server action file has a session gate, a secret or signature check, or a rate limiter", () => {
    const ungated = [...routeHandlers, ...serverActionFiles].filter((f) => {
      const source = readFileSync(f, "utf8");
      return !GATES.some((g) => g.test(source));
    });
    expect(ungated.map((f) => relative(root, f))).toEqual([]);
  });

  it("the public questionnaire action and the public routes carry a per-address limiter", () => {
    const publicFiles = [
      "src/app/start/actions.ts",
      "src/app/api/health/route.ts",
      "src/app/sample/complaints-policy.docx/route.ts",
    ];
    for (const rel of publicFiles) {
      const source = readFileSync(join(root, rel), "utf8");
      expect(source, rel).toMatch(/new MemoryRateLimiter\(/);
      expect(source, rel).toMatch(/limiter\.allow\(/);
    }
  });
});
