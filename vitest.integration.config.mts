import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests run against a real Supabase stack (the CLI's local stack
 * in CI, or a developer's own test project). They are kept out of the default
 * `npm test` run because they need network access and credentials.
 *
 *   npm run test:integration
 *
 * Required environment: NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY. Without them the
 * suites skip themselves and report why.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Batch 38 (D-1008): the server modules under test carry Next's
    // `server-only` guard, which throws outside a Next server bundle; the
    // integration suite is that case by design, so the guard resolves to an
    // empty module here (the unit suite mocks it per file).
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/integration/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
