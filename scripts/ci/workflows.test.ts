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
    // The gate's shell block is `run: |`; every other command is one line: the uptime check
    // (REQ-030 FR-3) and the kick.
    const runs = code.filter((l) => /^\s+run: (?!\|)/.test(l));
    expect(runs).toEqual([
      "        run: node scripts/ops/uptime.mjs",
      "        run: node scripts/ops/kick-generation.mjs",
    ]);
    // The kick is conditional on the gate; the checkout and the uptime steps sit ahead of it.
    const gated = code.filter((l) =>
      l.includes("if: steps.gate.outputs.ready == 'true'"),
    );
    expect(gated).toHaveLength(1);
    expect(text).not.toMatch(/npm (ci|install)/);
    expect(text).toContain("uses: actions/checkout@v4");
  });

  it("REQ-030 FR-3 (D-2867, SR-3): the uptime step runs ahead of the gate on PROD_URL alone, with the issue permission and its cached state", () => {
    const gate = code.indexOf("        id: gate");
    const uptime = code.indexOf("        run: node scripts/ops/uptime.mjs");
    expect(uptime).toBeGreaterThan(-1);
    expect(uptime).toBeLessThan(gate);
    // The permission block: contents read, then issues write for the "Site down" issue, nothing else.
    const permissions = code.indexOf("permissions:");
    expect(code[permissions + 1]).toBe("  contents: read");
    expect(code.slice(permissions, permissions + 4)).toContain(
      "  issues: write",
    );
    expect(text).not.toMatch(/actions:\s*write|contents:\s*write/);
    // The three uptime steps run only with PROD_URL, never needing the cron secret.
    const onProd = code.filter((l) => l === "        if: env.PROD_URL != ''");
    expect(onProd).toHaveLength(3);
    expect(text).toContain("uses: actions/cache/restore@v4");
    expect(text).toContain("uses: actions/cache/save@v4");
    expect(text).toContain("          path: .uptime-state.json");
    expect(text).toContain(
      "          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
    );
    // The minutes note names the step's cost.
    expect(text).toContain("the uptime step rides inside");
  });
});
