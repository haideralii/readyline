/**
 * The launch switchboard's rows (REQ-022 FR-1, SR-1). Pure: the server
 * gathers `LaunchFacts` (presence of each variable, what Stripe said, when
 * each job last ran, the legal pages' dates) and this module judges every
 * launch condition into one of four states with one plain sentence on what
 * to do. Nothing here interpolates a value: the names, states and sentences
 * are fixed strings, so a key, a price id or an address can never reach the
 * page, the script's output or a log (the unit test proves it with marker
 * values). `product/ops/LAUNCH.md` uses the same row names, and a test
 * holds the two together.
 */
import { isLiveKey } from "@/lib/payments/fake-session";
import type { PriceFact } from "@/lib/payments/live-guards";

export type LaunchState = "set" | "unset" | "mismatched" | "unverified";

export type LaunchGroup =
  | "identity"
  | "payments"
  | "generation"
  | "email"
  | "domain"
  | "jobs"
  | "admin"
  | "legal";

export const LAUNCH_GROUP_TITLES: Record<LaunchGroup, string> = {
  identity: "Identity",
  payments: "Payments",
  generation: "Generation",
  email: "Email",
  domain: "Domain",
  jobs: "Scheduled jobs",
  admin: "Admin",
  legal: "Legal pages",
};

export const LAUNCH_STATE_WORDS: Record<LaunchState, string> = {
  set: "Set",
  unset: "Not set",
  mismatched: "Mismatched",
  unverified: "Not verified here",
};

export type LaunchRow = {
  id: string;
  group: LaunchGroup;
  name: string;
  state: LaunchState;
  sentence: string;
};

export type LaunchFacts = {
  env: Record<string, string | undefined>;
  /** The host the request came in on, or null outside a request. */
  requestHost: string | null;
  /** Whether the About page carries the registered name; null while BUSINESS_NAME is unset. */
  aboutNamesBusiness: boolean | null;
  stripe: {
    pack: PriceFact | null;
    registers: PriceFact | null;
    webhookEndpoint: "matches" | "missing" | "unverified" | null;
  };
  email: {
    /** The provider's name as `createEmailProvider()` reports it. */
    provider: string;
    domainVerified: boolean | null;
    lastTestSendAt: string | null;
  };
  jobs: {
    purge: string | null;
    generate: string | null;
    reminders: string | null;
  };
  /** True when a platform admin has a verified authenticator; null when there is no platform admin. */
  adminTotpEnrolled: boolean | null;
  legal: { slug: string; updated: string }[];
  now: Date;
};

export const LEGAL_FRESH_DAYS = 90;
export const JOB_WINDOW_HOURS = 26;
export const TEST_SEND_WINDOW_HOURS = 24;

type Verdict = { state: LaunchState; sentence: string };
type Rule = {
  id: string;
  group: LaunchGroup;
  name: string;
  judge: (f: LaunchFacts) => Verdict;
};

const present = (env: LaunchFacts["env"], name: string) =>
  Boolean(env[name]?.trim());

const presence =
  (name: string, home: string): Rule["judge"] =>
  (f) =>
    present(f.env, name)
      ? { state: "set", sentence: `${name} is set.` }
      : { state: "unset", sentence: `Set ${name} in ${home}.` };

const VERCEL = "Vercel, Settings, Environment Variables (Production)";

export function stripeMode(
  env: LaunchFacts["env"],
): "live" | "test" | "fake" | "none" {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (env.STRIPE_FAKE?.trim() === "1") return "fake";
  if (!key) return "none";
  return isLiveKey(key) ? "live" : "test";
}

function cents(value: string | undefined): number | null {
  const n = Number(value?.trim());
  return value && Number.isInteger(n) && n > 0 ? n : null;
}

function priceRow(
  idName: string,
  centsName: string,
  fact: PriceFact | null,
  f: LaunchFacts,
): Verdict {
  if (!present(f.env, idName))
    return { state: "unset", sentence: `Set ${idName} in ${VERCEL}.` };
  const mode = stripeMode(f.env);
  if (mode === "fake")
    return {
      state: "mismatched",
      sentence: "STRIPE_FAKE is set, so no Price was read.",
    };
  if (!fact)
    return {
      state: "unverified",
      sentence: `${idName} was not read; the Stripe key is missing or the read did not run.`,
    };
  if (!fact.ok)
    return fact.reason === "no-permission"
      ? {
          state: "unverified",
          sentence:
            "The restricted key cannot read Prices; add Prices: read in Stripe, Developers, API keys.",
        }
      : {
          state: "mismatched",
          sentence: `${idName} could not be read from Stripe; check the id in Stripe, Product catalogue.`,
        };
  if (mode === "live" && !fact.livemode)
    return {
      state: "mismatched",
      sentence: `${idName} is a test-mode Price beside a live key; use the live Price id.`,
    };
  if (mode === "test" && fact.livemode)
    return {
      state: "mismatched",
      sentence: `${idName} is a live Price beside a test key; keep the two in one mode.`,
    };
  if (fact.currency.toLowerCase() !== "aud")
    return { state: "mismatched", sentence: `${idName} is not priced in AUD.` };
  const expected = cents(f.env[centsName]);
  if (expected === null)
    return { state: "unset", sentence: `Set ${centsName} in ${VERCEL}.` };
  if (fact.unitAmount !== expected)
    return {
      state: "mismatched",
      sentence: `${centsName} differs from the Price's unit_amount; set it to the Price's amount or fix the Price.`,
    };
  return { state: "set", sentence: `${idName} matches ${centsName}.` };
}

function hoursSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / 3_600_000;
}

function jobRow(name: string, last: string | null, f: LaunchFacts): Verdict {
  const h = hoursSince(last, f.now);
  if (h === null)
    return {
      state: "unset",
      sentence: `No run of the ${name} job is recorded yet; it runs from Vercel, Settings, Cron Jobs, and records each run.`,
    };
  if (h > JOB_WINDOW_HOURS)
    return {
      state: "mismatched",
      sentence: `The ${name} job last ran longer ago than its schedule; check Vercel, Settings, Cron Jobs, and CRON_SECRET.`,
    };
  return { state: "set", sentence: `The ${name} job ran within its schedule.` };
}

function daysBetween(ymd: string, now: Date): number | null {
  const t = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / 86_400_000;
}

const RULES: Rule[] = [
  {
    id: "business-name",
    group: "identity",
    name: "Business name",
    judge: presence("BUSINESS_NAME", VERCEL),
  },
  {
    id: "business-abn",
    group: "identity",
    name: "ABN",
    judge: (f) => {
      const v = f.env.BUSINESS_ABN?.trim() ?? "";
      if (!v)
        return {
          state: "unset",
          sentence: `Set BUSINESS_ABN in ${VERCEL} once the ABN is registered.`,
        };
      return /^\d{11}$/.test(v)
        ? {
            state: "set",
            sentence: "BUSINESS_ABN is set and has eleven digits.",
          }
        : {
            state: "mismatched",
            sentence: "BUSINESS_ABN is set but is not eleven digits.",
          };
    },
  },
  {
    id: "contact-email",
    group: "identity",
    name: "Contact email",
    judge: presence("CONTACT_EMAIL", VERCEL),
  },
  {
    id: "about-name",
    group: "identity",
    name: "About page carries the registered name",
    judge: (f) =>
      f.aboutNamesBusiness === null
        ? {
            state: "unset",
            sentence:
              "Set BUSINESS_NAME first; the About page is checked against it.",
          }
        : f.aboutNamesBusiness
          ? {
              state: "set",
              sentence: "The About page names the registered business.",
            }
          : {
              state: "mismatched",
              sentence:
                "The About page does not carry the registered name; the PO edits product/legal/about.md.",
            },
  },
  {
    id: "stripe-mode",
    group: "payments",
    name: "Stripe key mode",
    judge: (f) => {
      switch (stripeMode(f.env)) {
        case "live":
          return { state: "set", sentence: "A live restricted key is set." };
        case "test":
          return {
            state: "unset",
            sentence:
              "A test-mode key is set; paste the live restricted key last, when every other row is green (D-2202).",
          };
        case "fake":
          return {
            state: "mismatched",
            sentence:
              "STRIPE_FAKE is set; remove it from the production environment.",
          };
        default:
          return {
            state: "unset",
            sentence: `Set STRIPE_SECRET_KEY in ${VERCEL}.`,
          };
      }
    },
  },
  {
    id: "price-pack",
    group: "payments",
    name: "Pack price matches Stripe",
    judge: (f) =>
      priceRow("STRIPE_PRICE_PACK", "PACK_PRICE_AUD_CENTS", f.stripe.pack, f),
  },
  {
    id: "price-registers",
    group: "payments",
    name: "Registers price matches Stripe",
    judge: (f) =>
      priceRow(
        "STRIPE_PRICE_REGISTERS",
        "SUBSCRIPTION_PRICE_AUD_CENTS",
        f.stripe.registers,
        f,
      ),
  },
  {
    id: "webhook-secret",
    group: "payments",
    name: "Stripe webhook secret",
    judge: presence("STRIPE_WEBHOOK_SECRET", VERCEL),
  },
  {
    id: "gst-line",
    group: "payments",
    name: "GST line",
    judge: presence("GST_LINE", VERCEL),
  },
  {
    id: "stripe-fake",
    group: "payments",
    name: "Fake Checkout off",
    judge: (f) =>
      present(f.env, "STRIPE_FAKE")
        ? {
            state: "mismatched",
            sentence: "STRIPE_FAKE is set; it must not exist in production.",
          }
        : { state: "set", sentence: "STRIPE_FAKE is not set." },
  },
  {
    id: "generation-enabled",
    group: "generation",
    name: "Generation enabled",
    judge: (f) =>
      f.env.GENERATION_ENABLED?.trim().toLowerCase() === "true"
        ? { state: "set", sentence: "GENERATION_ENABLED is true." }
        : {
            state: "unset",
            sentence: `Set GENERATION_ENABLED to true in ${VERCEL}; without it nothing can be bought.`,
          },
  },
  {
    id: "generation-live",
    group: "generation",
    name: "Live model calls",
    judge: (f) =>
      f.env.GENERATION_LIVE?.trim() === "1"
        ? {
            state: "set",
            sentence: "GENERATION_LIVE is 1; customers' packs call the model.",
          }
        : {
            state: "unset",
            sentence:
              "GENERATION_LIVE is not 1; packs replay fixtures. Set it to 1 as the last step of the launch pass (D-2202).",
          },
  },
  {
    id: "anthropic-key",
    group: "generation",
    name: "Anthropic API key",
    judge: presence("ANTHROPIC_API_KEY", VERCEL),
  },
  {
    id: "anthropic-model",
    group: "generation",
    name: "Model id",
    judge: (f) =>
      present(f.env, "ANTHROPIC_MODEL")
        ? { state: "set", sentence: "ANTHROPIC_MODEL is set." }
        : {
            state: "unset",
            sentence:
              "ANTHROPIC_MODEL is not set; the code default applies (D-048). Set it to pin the model.",
          },
  },
  {
    id: "email-provider",
    group: "email",
    name: "Email provider",
    judge: (f) =>
      f.email.provider !== "log-only"
        ? { state: "set", sentence: "A sending provider is configured." }
        : {
            state: "unset",
            sentence:
              "Email only logs; the provider arrives with REQ-022 Session B (D-2201).",
          },
  },
  {
    id: "email-domain",
    group: "email",
    name: "Sending domain verified",
    judge: (f) =>
      f.email.domainVerified === null
        ? {
            state: "unverified",
            sentence:
              "Not checked until the provider exists (Session B); then the provider reports the domain.",
          }
        : f.email.domainVerified
          ? {
              state: "set",
              sentence: "The provider reports the sending domain verified.",
            }
          : {
              state: "mismatched",
              sentence:
                "The provider reports the sending domain unverified; add the records in LAUNCH.md at the registrar.",
            },
  },
  {
    id: "email-test-send",
    group: "email",
    name: "Test email in the last 24 hours",
    judge: (f) => {
      const h = hoursSince(f.email.lastTestSendAt, f.now);
      return h !== null && h <= TEST_SEND_WINDOW_HOURS
        ? {
            state: "set",
            sentence: "A test email was sent from this page within 24 hours.",
          }
        : {
            state: "unset",
            sentence:
              'Press "Send me a test email" (Session B) and confirm it arrived.',
          };
    },
  },
  {
    id: "site-url",
    group: "domain",
    name: "Site URL matches this host",
    judge: (f) => {
      const raw = f.env.NEXT_PUBLIC_SITE_URL?.trim();
      if (!raw)
        return {
          state: "unset",
          sentence: `Set NEXT_PUBLIC_SITE_URL in ${VERCEL}.`,
        };
      if (!f.requestHost)
        return {
          state: "unverified",
          sentence: "No request host to compare with.",
        };
      let host: string | null = null;
      try {
        host = new URL(raw).host;
      } catch {
        host = null;
      }
      return host === f.requestHost
        ? {
            state: "set",
            sentence:
              "NEXT_PUBLIC_SITE_URL is the host this page was served on.",
          }
        : {
            state: "mismatched",
            sentence:
              "NEXT_PUBLIC_SITE_URL differs from the host this page was served on; after the domain move set it to the domain.",
          };
    },
  },
  {
    id: "supabase-urls",
    group: "domain",
    name: "Supabase Site URL and redirects",
    judge: () => ({
      state: "unverified",
      sentence:
        "Not readable with the project's keys; check Supabase, Authentication, URL Configuration against LAUNCH.md, and launch-check.mjs proves the sign-in path from outside.",
    }),
  },
  {
    id: "stripe-webhook-endpoint",
    group: "domain",
    name: "Stripe webhook endpoint",
    judge: (f) => {
      switch (f.stripe.webhookEndpoint) {
        case "matches":
          return {
            state: "set",
            sentence:
              "A Stripe webhook endpoint points at this site's /api/stripe/webhook.",
          };
        case "missing":
          return {
            state: "unset",
            sentence:
              "No webhook endpoint in Stripe points at this site; add one in Stripe, Developers, Webhooks (LAUNCH.md).",
          };
        case "unverified":
          return {
            state: "unverified",
            sentence:
              "The restricted key cannot list webhook endpoints; add Webhook Endpoints: read in Stripe, or check the list by hand.",
          };
        default:
          return {
            state: "unset",
            sentence: "Not read: no live or test Stripe key, or fake mode.",
          };
      }
    },
  },
  {
    id: "cron-secret",
    group: "jobs",
    name: "Cron secret",
    judge: presence("CRON_SECRET", VERCEL),
  },
  {
    id: "job-purge",
    group: "jobs",
    name: "Purge job ran in the last 26 hours",
    judge: (f) => jobRow("purge", f.jobs.purge, f),
  },
  {
    id: "job-generate",
    group: "jobs",
    name: "Generate job ran in the last 26 hours",
    judge: (f) => jobRow("generate", f.jobs.generate, f),
  },
  {
    id: "job-reminders",
    group: "jobs",
    name: "Reminders job ran in the last 26 hours",
    judge: (f) => jobRow("reminders", f.jobs.reminders, f),
  },
  {
    id: "hash-pepper",
    group: "admin",
    name: "Hash pepper",
    judge: (f) =>
      present(f.env, "HASH_PEPPER")
        ? { state: "set", sentence: "HASH_PEPPER is set." }
        : {
            state: "unset",
            sentence: `Set HASH_PEPPER in ${VERCEL} (openssl rand -hex 32), once and never changed; until then address and email hashes are plain SHA-256, as before (retro finding 34, D-2238).`,
          },
  },
  {
    id: "admin-totp",
    group: "admin",
    name: "Authenticator enrolled for the platform admin",
    judge: (f) =>
      f.adminTotpEnrolled === null
        ? {
            state: "unset",
            sentence:
              "No platform admin yet; set platform_admin on the owner's user row (DEPLOY.md), then enrol at /admin/mfa.",
          }
        : f.adminTotpEnrolled
          ? {
              state: "set",
              sentence: "The platform admin has a verified authenticator.",
            }
          : {
              state: "unset",
              sentence: "Enrol an authenticator at /admin/mfa.",
            },
  },
];

/** Every row, in group order; the legal rows come from the pages present. */
export function launchRows(f: LaunchFacts): LaunchRow[] {
  const fixed = RULES.map((r) => ({
    id: r.id,
    group: r.group,
    name: r.name,
    ...r.judge(f),
  }));
  const legal = f.legal.map((p): LaunchRow => {
    const d = daysBetween(p.updated, f.now);
    const name = `${p.slug} page updated in the last ${LEGAL_FRESH_DAYS} days`;
    if (d === null)
      return {
        id: `legal-${p.slug}`,
        group: "legal",
        name,
        state: "mismatched",
        sentence:
          "The page's updated date could not be read; fix the front matter.",
      };
    return d <= LEGAL_FRESH_DAYS
      ? {
          id: `legal-${p.slug}`,
          group: "legal",
          name,
          state: "set",
          sentence: "The page's updated date is within the window.",
        }
      : {
          id: `legal-${p.slug}`,
          group: "legal",
          name,
          state: "mismatched",
          sentence:
            "The page's updated date is older than the window; the PO reviews the page and updates the date.",
        };
  });
  return [...fixed, ...legal];
}

/** The fixed row names, for LAUNCH.md and its test (legal rows follow the pages). */
export const LAUNCH_ROW_NAMES: readonly string[] = RULES.map((r) => r.name);

export function legalRowName(slug: string): string {
  return `${slug} page updated in the last ${LEGAL_FRESH_DAYS} days`;
}

/** Plain-text rendering, one line per row, for the script and the no-secrets test. */
export function rowsToText(rows: LaunchRow[]): string {
  return rows
    .map(
      (r) =>
        `${r.state.padEnd(11)} ${LAUNCH_GROUP_TITLES[r.group]}: ${r.name}. ${r.sentence}`,
    )
    .join("\n");
}

export function countByState(rows: LaunchRow[]): Record<LaunchState, number> {
  const out: Record<LaunchState, number> = {
    set: 0,
    unset: 0,
    mismatched: 0,
    unverified: 0,
  };
  for (const r of rows) out[r.state] += 1;
  return out;
}
