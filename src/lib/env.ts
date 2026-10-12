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
];

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

/** Validates a source such as `process.env` without throwing. */
export function validateEnv(
  source: Record<string, string | undefined> = process.env,
): EnvResult {
  const problems: string[] = [];
  for (const v of REQUIRED) {
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
): Env {
  const result = validateEnv(source);
  if (!result.ok) throw new EnvError(result.problems);
  return result.env;
}
