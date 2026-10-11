import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Unit and snapshot tests live beside the code they test, or under data/
    // for the standards fixtures. Playwright specs live in e2e/ and are excluded.
    include: ["src/**/*.test.{ts,tsx}", "data/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
