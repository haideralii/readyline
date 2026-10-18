/**
 * REQ-022 FR-10 (Session C; Dev response 3): the Strict-Transport-Security
 * header's max-age is HSTS_MAX_AGE, read in next.config.ts at build (on
 * Vercel a variable change takes effect at the next deploy, so FR-10's two
 * steps are two variable edits each followed by a redeploy). The code
 * default is one week; `preload` is emitted only from one year, which is the
 * least the preload list accepts; the domain is not submitted to
 * hstspreload.org by anything here (that is Haider's separate decision).
 * Dependency-free so the config file can import it.
 */
export const HSTS_DEFAULT_MAX_AGE = 604800;
export const HSTS_PRELOAD_FROM = 31536000;

/** The max-age in seconds: a positive whole number from HSTS_MAX_AGE, else the one-week default. */
export function hstsMaxAge(raw: string | undefined): number {
  const n = Number(raw?.trim());
  return Number.isInteger(n) && n > 0 ? n : HSTS_DEFAULT_MAX_AGE;
}

/** The header's value for the configured max-age (AC-8). */
export function hstsHeaderValue(raw: string | undefined): string {
  const maxAge = hstsMaxAge(raw);
  return `max-age=${maxAge}; includeSubDomains${maxAge >= HSTS_PRELOAD_FROM ? "; preload" : ""}`;
}
