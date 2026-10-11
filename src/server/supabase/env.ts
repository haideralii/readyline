/**
 * Supabase connection settings (REQ-004 SR-5). The project uses Supabase's new
 * API key format: a publishable key for browser and SSR clients and a secret
 * key for server-only admin work. The legacy anon and service_role names are
 * not used.
 *
 * The CI local stack exports its keys as API_URL, ANON_KEY and
 * SERVICE_ROLE_KEY (or PUBLISHABLE_KEY and SECRET_KEY on newer CLIs); the
 * workflow maps them onto these names.
 */
export type SupabaseEnv = {
  url: string;
  publishableKey: string;
  secretKey?: string;
};

export const SUPABASE_ENV_NAMES = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  publishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  secretKey: "SUPABASE_SECRET_KEY",
} as const;

export class SupabaseEnvError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(
      `Supabase is not configured: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing. ` +
        "Copy the value(s) from the Supabase dashboard into .env.local; in production they live in the Vercel project environment variables.",
    );
    this.name = "SupabaseEnvError";
    this.missing = missing;
  }
}

/** Public settings for SSR and browser clients. Throws naming what is missing. */
export function readSupabaseEnv(
  source: Record<string, string | undefined> = process.env,
): SupabaseEnv {
  const url = source[SUPABASE_ENV_NAMES.url]?.trim();
  const publishableKey = source[SUPABASE_ENV_NAMES.publishableKey]?.trim();
  const missing: string[] = [];
  if (!url) missing.push(SUPABASE_ENV_NAMES.url);
  if (!publishableKey) missing.push(SUPABASE_ENV_NAMES.publishableKey);
  if (missing.length > 0) throw new SupabaseEnvError(missing);
  return {
    url: url!,
    publishableKey: publishableKey!,
    secretKey: source[SUPABASE_ENV_NAMES.secretKey]?.trim() || undefined,
  };
}

/** Server-only settings including the secret key. Throws naming what is missing. */
export function readSupabaseAdminEnv(
  source: Record<string, string | undefined> = process.env,
): Required<SupabaseEnv> {
  const env = readSupabaseEnv(source);
  if (!env.secretKey)
    throw new SupabaseEnvError([SUPABASE_ENV_NAMES.secretKey]);
  return { ...env, secretKey: env.secretKey };
}

/** True when the three variables are present (used to skip integration tests locally). */
export function hasSupabaseEnv(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    source[SUPABASE_ENV_NAMES.url]?.trim() &&
    source[SUPABASE_ENV_NAMES.publishableKey]?.trim() &&
    source[SUPABASE_ENV_NAMES.secretKey]?.trim(),
  );
}
