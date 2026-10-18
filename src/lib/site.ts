/** The canonical origin from NEXT_PUBLIC_SITE_URL (REQ-011): no trailing slash; localhost when unset. */
export function siteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

/**
 * Whether the site is served over HTTPS, read from NEXT_PUBLIC_SITE_URL. The
 * session cookies are marked Secure when it is (QA live b340ee3, batch C,
 * #108 run 1): a Secure cookie set over plain http is kept by Chromium on
 * localhost but dropped by WebKit, so CI's production build on
 * http://localhost signed every browser in but Safari. Production is https,
 * so the cookies stay Secure there.
 */
export function siteIsHttps(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return siteUrl(env).toLowerCase().startsWith("https:");
}
