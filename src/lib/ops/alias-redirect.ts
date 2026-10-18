/**
 * REQ-022 FR-8 (Session C; D-2203): once the custom domain is live, the
 * vercel.app name stays as an alias that answers 301 to NEXT_PUBLIC_SITE_URL
 * for every path except `/api/*`, which keeps answering on the alias until
 * the crons and the Stripe webhook endpoint have moved to the domain. Pure,
 * so the proxy runs it at the edge and the unit test covers the host and
 * path cases without a server.
 *
 * Nothing redirects when the two hosts match (before the domain move
 * NEXT_PUBLIC_SITE_URL is the vercel.app URL itself), when the deployment is
 * not production (a preview is a vercel.app host too, and must never send
 * its reader to the live site), or when the request host is not a vercel.app
 * name (localhost, CI, the domain itself).
 */
export const ALIAS_HOST_SUFFIX = ".vercel.app";

/** The `/api/*` exclusion of FR-8: the routes the crons and the webhook call. */
export function aliasKeepsPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function aliasRedirectTarget(input: {
  /** The request's Host header (or x-forwarded-host), or null. */
  host: string | null;
  pathname: string;
  /** The query string with its leading `?`, or an empty string. */
  search: string;
  env: Record<string, string | undefined>;
}): string | null {
  if (input.env.VERCEL_ENV !== "production") return null;
  const host = input.host?.trim().toLowerCase() ?? "";
  if (!host.endsWith(ALIAS_HOST_SUFFIX)) return null;
  const raw = input.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  let site: URL;
  try {
    site = new URL(raw);
  } catch {
    return null;
  }
  const siteHost = site.host.toLowerCase();
  if (siteHost === host || siteHost.endsWith(ALIAS_HOST_SUFFIX)) return null;
  if (aliasKeepsPath(input.pathname)) return null;
  return `${site.origin}${input.pathname}${input.search}`;
}
