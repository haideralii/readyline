// @vitest-environment node
/**
 * D-2239: previews are off at the Git integration. A branch that is not
 * `main` creates no Vercel deployment at all, because a build the Ignored
 * Build Step cancels still counts as a created deployment against Vercel
 * Hobby's 100 a day (Vercel, project settings, "Ignored Build Step", read
 * 16 Oct 2026). This test pins the shape so a later edit cannot quietly turn
 * previews back on; flipping `next` to true is a decision, not a slip.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  git?: { deploymentEnabled?: Record<string, boolean> | boolean };
  crons?: { path: string; schedule: string }[];
};

describe("vercel.json (D-2239)", () => {
  const enabled = config.git?.deploymentEnabled;

  it("turns deployments off for every branch and on for main only", () => {
    expect(typeof enabled).toBe("object");
    const rules = enabled as Record<string, boolean>;
    expect(rules["**"]).toBe(false);
    const deployed = Object.entries(rules)
      .filter(([, on]) => on)
      .map(([branch]) => branch);
    expect(deployed).toEqual(["main"]);
  });

  it("keeps the three daily jobs", () => {
    expect(config.crons?.map((c) => c.path)).toEqual([
      "/api/jobs/purge",
      "/api/jobs/generate",
      "/api/jobs/reminders",
    ]);
  });
});
