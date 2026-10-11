import { describe, expect, it } from "vitest";
import { findCommittedEnvFiles } from "./check-env-files.mjs";

describe("findCommittedEnvFiles", () => {
  it("flags .env and .env.* at any depth", () => {
    expect(
      findCommittedEnvFiles([
        ".env",
        ".env.local",
        ".env.production",
        "apps/web/.env.development.local",
        "src/app/page.tsx",
      ]),
    ).toEqual([
      ".env",
      ".env.local",
      ".env.production",
      "apps/web/.env.development.local",
    ]);
  });

  it("allows .env.example and unrelated names", () => {
    expect(
      findCommittedEnvFiles([
        ".env.example",
        "docs/.env.example",
        ".envrc",
        "environment.ts",
        "env.test.ts",
      ]),
    ).toEqual([]);
  });
});
