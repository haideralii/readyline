/**
 * Environment variable contract (REQ-002 FR-5, AC-4).
 *
 * `REQUIRED` grows phase by phase; everything else is optional with a safe
 * default. `.env.example` documents each variable and where it lives in
 * production. `assertEnv()` runs at server start from `src/instrumentation.ts`
 * and stops the process with a message naming the missing variable, so a
 * mis-deployed environment fails loudly instead of half-working.
 */
import { z } from "zod";

/** Variables that must be present in every environment, with where they are set in production. */
export const REQUIRED: ReadonlyArray<{ name: string; productionHome: string }> =
  [
    {
      name: "NEXT_PUBLIC_SITE_URL",
      productionHome: "Vercel project environment variables",
    },
  ];

/** Variables that become required when the phase that uses them ships. Kept here so the list is reviewed with each REQ. */
export const REQUIRED_LATER: ReadonlyArray<{
  name: string;
  from: string;
  productionHome: string;
}> = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    from: "REQ-004",
    productionHome: "Vercel project environment variables",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    from: "REQ-004",
    productionHome: "Vercel project environment variables",
  },
  {
    name: "SUPABASE_SECRET_KEY",
    from: "REQ-004",
    productionHome: "Vercel project environment variables (server only)",
  },
  {
    name: "CRON_SECRET",
    from: "REQ-004 Session C (purge job)",
    productionHome: "Vercel project environment variables (server only)",
  },
  {
    name: "ANTHROPIC_API_KEY",
    from: "REQ-005",
    productionHome: "Vercel project environment variables (server only)",
  },
  {
    name: "ANTHROPIC_MODEL",
    from: "REQ-005",
    productionHome: "Vercel project environment variables (server only)",
  },
  {
    name: "CONTACT_EMAIL",
    from: "REQ-008 (footer Contact link; public once set)",
    productionHome: "Vercel project environment variables",
  },
  {
    name: "STRIPE_SECRET_KEY",
    from: "REQ-007",
    productionHome: "Vercel project environment variables (server only)",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    from: "REQ-007",
    productionHome: "Vercel project environment variables (server only)",
  },
  {
    name: "STRIPE_PRICE_PACK",
    from: "REQ-007 (the pack's Price id)",
    productionHome: "Vercel project environment variables (server only)",
  },
  {
    name: "PACK_PRICE_AUD_CENTS",
    from: "REQ-007 (display price; checked against the Price with a live key)",
    productionHome: "Vercel project environment variables",
  },
  {
    name: "GENERATION_LIVE",
    from: "REQ-007 Session C (the paid job calls the model only when this is 1; D-708)",
    productionHome: "Vercel project environment variables (server only)",
  },
  {
    name: "HASH_PEPPER",
    from: "REQ-020 Session B, retro finding 34 (the HMAC key behind hashed viewer addresses and invitation emails)",
    productionHome: "Vercel project environment variables (server only)",
  },
];

/**
 * Variables the code reads when present and does without when absent; the
 * prebuild check names the ones that are not set (names only) so a missing
 * optional value is a visible choice, never a surprise.
 */
export const OPTIONAL: ReadonlyArray<{
  name: string;
  from: string;
  without: string;
}> = [
  {
    name: "GITHUB_DISPATCH_TOKEN",
    from: "D-059 (the app starts the kicker workflow when work exists)",
    without: "the thirty-minute schedule picks jobs up instead",
  },
  {
    name: "HSTS_MAX_AGE",
    from: "REQ-022 Session C (FR-10: one week after the alias redirect is proven, one year a week later)",
    without: "the header carries the one-week default without preload",
  },
  // REQ-022 Session B (D-2822): plain SMTP; every name or none.
  ...[
    "EMAIL_PROVIDER",
    "EMAIL_FROM",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
  ].map((name) => ({
    name,
    from: "REQ-022 Session B (EMAIL_PROVIDER=smtp with the five SMTP values; D-2822)",
    without: "email only logs, with the address hashed",
  })),
];

/**
 * Variables a production deployment cannot run without (REQ-010 FR-2). The
 * boot check and the prebuild script require them when the deployment is
 * Vercel's production environment; previews, CI's `next start` and local
 * runs keep the short `REQUIRED` list so a page can be tried without every
 * account.
 */
export const PRODUCTION_REQUIRED: ReadonlyArray<{
  name: string;
  productionHome: string;
}> = [
  ...REQUIRED,
  ...REQUIRED_LATER.filter((v) =>
    [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "CRON_SECRET",
      "ANTHROPIC_API_KEY",
      "CONTACT_EMAIL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_PACK",
      "PACK_PRICE_AUD_CENTS",
    ].includes(v.name),
  ),
  {
    name: "GST_LINE",
    productionHome: "Vercel project environment variables",
  },
];

/** True on the Vercel production deployment only (previews and local runs are not). */
export function isProductionDeployment(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return source.VERCEL_ENV?.trim() === "production";
}

/**
 * `HASH_PEPPER`, the key behind every hashed viewer address and invitation
 * email (retro review of REQ-018 to 021, finding 34; PO decision 34). Set:
 * its value. Unset, in any environment: null, and the hashes fall back to
 * the plain SHA-256 they had before the pepper existed (D-2238); nothing
 * refuses to start, the launch switchboard's "Hash pepper" row stays red,
 * and `hashPepper()` logs one warning.
 */
export function readHashPepper(
  source: Record<string, string | undefined> = process.env,
): string | null {
  const value = source.HASH_PEPPER?.trim();
  return value ? value : null;
}

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_BRAND_NAME: z.string().trim().min(1).default("{{BRAND}}"),
});

export type Env = z.infer<typeof schema>;

export type EnvResult =
  { ok: true; env: Env } | { ok: false; problems: string[] };

/** Validates a source such as `process.env` without throwing; `production` widens the required list (REQ-010 FR-2). */
export function validateEnv(
  source: Record<string, string | undefined> = process.env,
  options: { production?: boolean } = {},
): EnvResult {
  const problems: string[] = [];
  const required = options.production ? PRODUCTION_REQUIRED : REQUIRED;
  for (const v of required) {
    const value = source[v.name];
    if (value === undefined || value.trim() === "") {
      problems.push(
        `${v.name} is missing. Set it in .env.local locally; in production it lives in: ${v.productionHome}.`,
      );
    }
  }
  if (problems.length > 0) return { ok: false, problems };
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`${issue.path.join(".") || "env"}: ${issue.message}`);
    }
    return { ok: false, problems };
  }
  return { ok: true, env: parsed.data };
}

export class EnvError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(
      `Environment check failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    this.name = "EnvError";
    this.problems = problems;
  }
}

/** Throws an EnvError naming every missing or invalid variable. */
export function assertEnv(
  source: Record<string, string | undefined> = process.env,
  options: { production?: boolean } = {},
): Env {
  const result = validateEnv(source, options);
  if (!result.ok) throw new EnvError(result.problems);
  return result.env;
}
