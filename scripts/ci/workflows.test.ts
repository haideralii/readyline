// @vitest-environment node
/**
 * The kicker workflow (batch 32 item 1, D-1006; schedule and dispatch per
 * D-059), checked without `act` and without a YAML dependency: the file has
 * the shape the runbook describes, every thirty minutes plus the app's
 * `generate` dispatch plus by hand, one run at a time, read-only
 * permissions, the variable and the secret gated and masked, the twenty
 * minute loop inside the job's timeout, and the loop script as the only
 * command.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const text = readFileSync(".github/workflows/generate-kick.yml", "utf8");
const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));

/** Lines that are not comments, with their leading spaces kept. */
const code = lines.filter((l) => l.trim() && !l.trim().startsWith("#"));

describe("generate-kick workflow (batch 32 item 1)", () => {
  it("runs every thirty minutes, on the app's dispatch and by hand, one at a time, read-only", () => {
    expect(code).toContain('    - cron: "*/30 * * * *"');
    expect(code).not.toContain('"*/5 * * * *"');
    expect(code).toContain("  repository_dispatch:");
    expect(code).toContain("    types: [generate]");
    expect(code).toContain("  workflow_dispatch:");
    expect(code).toContain("  group: generate-kick");
    expect(code).toContain("  cancel-in-progress: false");
    const permissions = code.indexOf("permissions:");
    expect(permissions).toBeGreaterThan(-1);
    expect(code[permissions + 1]).toBe("  contents: read");
    expect(text).not.toMatch(/contents:\s*write|pull-requests:\s*write/);
  });

  it("reads PROD_URL from variables and CRON_SECRET from secrets, looping twenty minutes inside the job's timeout and under the schedule", () => {
    expect(code).toContain("      PROD_URL: ${{ vars.PROD_URL }}");
    expect(code).toContain("      CRON_SECRET: ${{ secrets.CRON_SECRET }}");
    const box = Number(text.match(/KICK_MAX_SECONDS: "(\d+)"/)?.[1]);
    expect(box).toBe(1200);
    const timeout = Number(text.match(/timeout-minutes: (\d+)/)?.[1]);
    // One call can run for up to five minutes past the box; the timeout leaves room for it, under the thirty-minute schedule.
    expect(timeout).toBeGreaterThanOrEqual(box / 60 + 5);
    expect(timeout).toBeLessThan(30);
  });

  it("gates on the values, masks the secret, and runs only the loop script", () => {
    expect(text).toContain(
      'if [ -z "$PROD_URL" ] || [ -z "$CRON_SECRET" ]; then',
    );
    expect(text).toContain("::add-mask::$CRON_SECRET");
    // The gate's shell block is `run: |`; every other command is one line.
    const runs = code.filter((l) => /^\s+run: (?!\|)/.test(l));
    expect(runs).toEqual(["        run: node scripts/ops/kick-generation.mjs"]);
    // Every step after the gate is conditional on it.
    const gated = code.filter((l) =>
      l.includes("if: steps.gate.outputs.ready == 'true'"),
    );
    expect(gated).toHaveLength(2);
    expect(text).not.toMatch(/npm (ci|install)/);
    expect(text).toContain("uses: actions/checkout@v4");
  });
});
