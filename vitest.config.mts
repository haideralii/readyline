import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Honour the "@/*" alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Unit and snapshot tests live beside the code they test, under data/ for
    // the standards fixtures, and under scripts/ for CI helpers. Playwright
    // specs live in e2e/ and are excluded.
    include: [
      "src/**/*.test.{ts,tsx}",
      "data/**/*.test.ts",
      "scripts/**/*.test.ts",
      // REQ-015 FR-2: the copy lint walks the pages; the integration suite stays separate.
      "tests/copy-lint.test.ts",
    ],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
