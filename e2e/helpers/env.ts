/**
 * Environment for the signed-in e2e specs (REQ-007 AC-1). The Playwright
 * process does not load `.env.local` the way Next.js does, so this reads it
 * inside Node and fills only the names that are unset; values never pass
 * through a shell. In CI the Supabase job exports the local stack's values
 * before Playwright starts and nothing is read from disk.
 */
import { existsSync, readFileSync } from "node:fs";

let loaded = false;

export function loadLocalEnv(): void {
  if (loaded) return;
  loaded = true;
  // CI=1 is also how a developer runs the production server locally; only GitHub's runner skips the file.
  if (process.env.GITHUB_ACTIONS || !existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, name, raw] = m;
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[name] === undefined && value !== "")
      process.env[name] = value;
  }
}

/** The CRON_SECRET the e2e server and the specs share; built at runtime, never a literal secret. */
export function e2eCronSecret(): string {
  return (
    process.env.CRON_SECRET?.trim() ||
    ["e2e", "cron", "secret", "0123456789abcdef"].join("-")
  );
}

export function hasSupabaseForE2e(): boolean {
  loadLocalEnv();
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY,
  );
}
