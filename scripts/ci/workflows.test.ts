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
const backup = readFileSync(".github/workflows/backup.yml", "utf8");
const promises = readFileSync(".github/workflows/data-promises.yml", "utf8");
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
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

/**
 * REQ-030 FR-2, AC-4 (D-2866, D-2876, SR-2, SR-3): the weekly backup workflow's shape, read
 * from the file: the weekly cron, the two gated and masked secrets, read-only contents, the
 * 90-day artifact, one command, and nothing that could print a value.
 */
describe("backup workflow (REQ-030 FR-2, AC-4)", () => {
  const lines = backup.split("\n").map((l) => l.replace(/\r$/, ""));
  const code = lines.filter((l) => !/^\s*#/.test(l));

  it("runs weekly and by hand, one at a time, read-only, and uploads the encrypted copy for 90 days", () => {
    expect(code).toContain('    - cron: "0 16 * * 6"');
    expect(code).toContain("  workflow_dispatch:");
    expect(code).toContain("  group: backup");
    expect(code).toContain("  cancel-in-progress: false");
    const permissions = code.indexOf("permissions:");
    expect(code[permissions + 1]).toBe("  contents: read");
    expect(backup).not.toMatch(
      /contents:\s*write|issues:\s*write|pull-requests:\s*write/,
    );
    expect(code).toContain("          retention-days: 90");
    expect(code).toContain("        uses: actions/upload-artifact@v4");
  });

  it("gates on both secrets, masks both, builds the URL unprinted, and runs the one script (the direct host as the fallback)", () => {
    expect(backup).toContain(
      'if [ -z "$SUPABASE_DB_PASSWORD" ] || [ -z "$BACKUP_PASSPHRASE" ]; then',
    );
    expect(backup).toContain("::add-mask::$SUPABASE_DB_PASSWORD");
    expect(backup).toContain("::add-mask::$BACKUP_PASSPHRASE");
    expect(backup).toContain("::add-mask::$DB_URL");
    expect(backup).toContain("::add-mask::$DB_URL_DIRECT");
    expect(backup).not.toMatch(/SUPABASE_SECRET_KEY|SUPABASE_ACCESS_TOKEN/);
    const runs = code.filter((l) => /^\s+run: (?!\|)/.test(l));
    expect(runs).toEqual([
      '        run: scripts/ops/backup.sh || DB_URL="$DB_URL_DIRECT" scripts/ops/backup.sh',
    ]);
    const gated = code.filter((l) =>
      l.includes("if: steps.gate.outputs.ready == 'true'"),
    );
    expect(gated.length).toBeGreaterThanOrEqual(5);
    expect(backup).not.toMatch(/echo "\$BACKUP_PASSPHRASE"|echo \$DB_URL/);
  });
});

/** REQ-030 FR-5 (D-2869): the monthly data-promises check's shape. */
describe("data-promises workflow (REQ-030 FR-5)", () => {
  const lines = promises.split("\n").map((l) => l.replace(/\r$/, ""));
  const code = lines.filter((l) => !/^\s*#/.test(l));

  it("runs on the first of the month, read-only, gated and masked, and judges the purge age with the script", () => {
    expect(code).toContain('    - cron: "0 20 1 * *"');
    const permissions = code.indexOf("permissions:");
    expect(code[permissions + 1]).toBe("  contents: read");
    expect(promises).toContain("::add-mask::$SUPABASE_DB_PASSWORD");
    expect(promises).toContain("::add-mask::$DB_URL");
    expect(promises).toContain("node scripts/ops/data-promises.mjs");
    expect(promises).toContain("jobs.purge.ran");
    expect(promises).not.toMatch(/contents:\s*write|issues:\s*write/);
  });
});

/** REQ-030 FR-2, AC-3: CI rehearses the restore on the Supabase job with a fixture passphrase, never the production one. */
describe("the restore rehearsal in CI (REQ-030 AC-3, SR-5)", () => {
  it("dumps with the fixture passphrase, resets the stack, restores, and runs the integration suite again", () => {
    expect(ci).toContain("Backup and restore rehearsal (REQ-030 FR-2, AC-3)");
    // The runner's own client is 16 and the stack is 17 (config.toml): the
    // 17 client is installed before the rehearsal, as backup.yml installs it,
    // or pg_dump stops at once on the version mismatch (#115's first red).
    const client = ci.indexOf("postgresql-client-17");
    expect(client).toBeGreaterThan(-1);
    expect(client).toBeLessThan(
      ci.indexOf("Backup and restore rehearsal (REQ-030 FR-2, AC-3)"),
    );
    expect(ci).toContain(
      "BACKUP_PASSPHRASE: rehearsal-fixture-passphrase-0123456789",
    );
    // One step per command (the jobs API names the failing one), in order.
    const at = (s: string) => {
      const i = ci.indexOf(s);
      expect(i, s).toBeGreaterThan(-1);
      return i;
    };
    const dump = at("run: scripts/ops/backup.sh");
    const reset = at("run: supabase db reset --local --no-seed");
    const restore = at("run: scripts/ops/restore-rehearsal.sh");
    const suite = at(
      "the integration suite on the restored stack\n        run: npm run test:integration",
    );
    expect(dump).toBeLessThan(reset);
    expect(reset).toBeLessThan(restore);
    expect(restore).toBeLessThan(suite);
    expect(ci.split("npm run test:integration").length - 1).toBe(2);
    expect(ci).not.toMatch(/secrets\.BACKUP_PASSPHRASE/);
  });
});
