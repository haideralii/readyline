/** The canonical origin from NEXT_PUBLIC_SITE_URL (REQ-011): no trailing slash; localhost when unset. */
export function siteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
