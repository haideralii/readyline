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
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
