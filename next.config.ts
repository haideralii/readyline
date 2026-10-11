import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Scaffold defaults for Next 16; see DECISIONS.md D-003.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
