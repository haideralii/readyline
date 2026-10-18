/**
 * The health answer and its limiter (REQ-010 FR-4), pure so both are unit
 * tested. No database call and no secret: the version is the package
 * version plus the git SHA the platform exposes, the region is the one the
 * platform reports. The limiter is per instance and in memory because the
 * route must not touch the database; it only stops a tight loop of
 * requests from one address.
 */
import { siteUrl } from "@/lib/site";

export type Health = {
  ok: true;
  version: string;
  sha: string;
  region: string;
  deployment: "production" | "preview" | "development";
  /** REQ-022 FR-9 (Session C): the canonical origin, so a smoke record names the host it ran against. */
  siteUrl: string;
};

export function healthBody(
  env: Record<string, string | undefined>,
  packageVersion: string,
): Health {
  const sha = (env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 12);
  const deployment =
    env.VERCEL_ENV === "production"
      ? "production"
      : env.VERCEL_ENV === "preview"
        ? "preview"
        : "development";
  return {
    ok: true,
    version: `${packageVersion}+${sha}`,
    sha,
    region: env.VERCEL_REGION ?? "local",
    deployment,
    siteUrl: siteUrl(env),
  };
}

export const HEALTH_LIMIT = { limit: 60, windowMs: 60_000 } as const;

/** A fixed-window counter per key; `allow` returns false once the limit is reached in the window. */
export class MemoryRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly limit: number = HEALTH_LIMIT.limit,
    private readonly windowMs: number = HEALTH_LIMIT.windowMs,
  ) {}
  allow(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.hits.clear();
      return true;
    }
    entry.count++;
    return entry.count <= this.limit;
  }
}
