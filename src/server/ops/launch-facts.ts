import "server-only";
/**
 * Gathers the facts the launch switchboard judges (REQ-022 FR-1, SR-1):
 * which variables are present, what Stripe says about the two Prices and
 * the webhook endpoint, when each scheduled job last ran, whether the
 * platform admin has an authenticator, and the legal pages' dates. Reads
 * only; every value stays in this module, and the rows built from these
 * facts carry names and states alone (src/lib/ops/launch.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLegalPage, loadLegalPages } from "@/lib/legal/pages";
import { resolveTxt } from "node:dns/promises";
import { log } from "@/lib/logging/logger";
import {
  hasDmarc,
  hasSpf,
  senderDomain,
  type DnsFacts,
} from "@/lib/ops/sender-domain";
import type { LaunchFacts } from "@/lib/ops/launch";
import { isFakeStripeMode } from "@/lib/payments/fake-session";
import type { PriceFact } from "@/lib/payments/live-guards";
import {
  configuredEmailProvider,
  createEmailProvider,
  smtpMissing,
} from "@/server/email/provider";
import { jobRunAction } from "@/server/jobs/record-run";
import { createStripeClient } from "@/server/payments/stripe";

export const TEST_SEND_ACTION = "email.test-sent";
/** D-2841: a failed attempt is audited too, so the one-a-minute limit holds for a failing provider as well. */
export const TEST_FAILED_ACTION = "email.test-failed";

const DNS_TIMEOUT_MS = 2_500;

async function txt(name: string): Promise<string[][] | null> {
  try {
    return await Promise.race([
      resolveTxt(name),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), DNS_TIMEOUT_MS),
      ),
    ]);
  } catch {
    // D-2842: a resolver error (SERVFAIL, ECONNREFUSED, NXDOMAIN alike) is a lookup that did not answer, and
    // D-2824 reads that as unverified, never as "none there" (mismatched); null, the same as the timeout.
    return null;
  }
}

/**
 * REQ-022 FR-6 (D-2824): the sender's SPF and DMARC records from DNS, each
 * null when the lookup did not answer in time, so the row reads "not
 * verified here" and the page never throws. Nothing but the record kinds
 * is kept.
 */
export async function readSenderDns(
  from: string | undefined,
): Promise<DnsFacts | null> {
  const domain = senderDomain(from);
  if (!domain) return null;
  const [spf, dmarc] = await Promise.all([
    txt(domain),
    txt(`_dmarc.${domain}`),
  ]);
  return {
    spf: spf === null ? null : hasSpf(spf),
    dmarc: dmarc === null ? null : hasDmarc(dmarc),
  };
}

type StripeLike = {
  prices: {
    retrieve(id: string): Promise<{
      livemode: boolean;
      unit_amount: number | null;
      currency: string;
    }>;
  };
  webhookEndpoints: {
    list(params: { limit: number }): Promise<{ data: { url: string }[] }>;
  };
};

function classify(e: unknown): PriceFact {
  const err = e as { type?: string; statusCode?: number; code?: string };
  if (err?.type === "StripePermissionError" || err?.statusCode === 403)
    return { ok: false, reason: "no-permission" };
  if (err?.statusCode === 404 || err?.code === "resource_missing")
    return { ok: false, reason: "not-found" };
  return { ok: false, reason: "error" };
}

export async function readPriceFact(
  stripe: StripeLike,
  id: string | undefined,
): Promise<PriceFact | null> {
  if (!id?.trim()) return null;
  try {
    const p = await stripe.prices.retrieve(id.trim());
    return {
      ok: true,
      livemode: p.livemode,
      unitAmount: p.unit_amount,
      currency: p.currency,
    };
  } catch (e) {
    return classify(e);
  }
}

/** The path the webhook route answers on. */
export const WEBHOOK_PATH = "/api/stripe/webhook";

/**
 * REQ-022 FR-1 and FR-8 (Session C): the endpoint is judged against the host
 * the page was served on, not NEXT_PUBLIC_SITE_URL, so after the domain move
 * the row turns green only when Stripe calls the domain. No request host
 * (outside a request) is "unverified", never a guess.
 */
export function webhookEndpointState(
  urls: readonly string[],
  requestHost: string | null,
): "matches" | "missing" | "unverified" {
  const host = requestHost?.trim().toLowerCase();
  if (!host) return "unverified";
  const matches = urls.some((raw) => {
    try {
      const u = new URL(raw);
      return u.host.toLowerCase() === host && u.pathname === WEBHOOK_PATH;
    } catch {
      return false;
    }
  });
  return matches ? "matches" : "missing";
}

export async function readWebhookEndpoint(
  stripe: StripeLike,
  requestHost: string | null,
): Promise<"matches" | "missing" | "unverified"> {
  try {
    const list = await stripe.webhookEndpoints.list({ limit: 100 });
    return webhookEndpointState(
      list.data.map((w) => w.url),
      requestHost,
    );
  } catch (e) {
    return classify(e).ok === false ? "unverified" : "unverified";
  }
}

async function lastAuditAt(
  admin: SupabaseClient,
  action: string,
): Promise<string | null> {
  const r = await admin
    .from("audit_log")
    .select("at")
    .eq("action", action)
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (r.error) {
    log.warn("launch.facts.audit-read-failed", { action, code: r.error.code });
    return null;
  }
  return (r.data as { at: string } | null)?.at ?? null;
}

async function adminTotpEnrolled(
  admin: SupabaseClient,
): Promise<boolean | null> {
  const users = await admin
    .from("users")
    .select("id")
    .eq("platform_admin", true)
    .limit(10);
  const ids = ((users.data as { id: string }[] | null) ?? []).map((u) => u.id);
  if (!ids.length) return null;
  for (const userId of ids) {
    const f = await admin.auth.admin.mfa.listFactors({ userId });
    const verified = (f.data?.factors ?? []).some(
      (x) => x.factor_type === "totp" && x.status === "verified",
    );
    if (verified) return true;
  }
  return false;
}

export async function gatherLaunchFacts(input: {
  admin: SupabaseClient;
  requestHost: string | null;
  env?: Record<string, string | undefined>;
  now?: Date;
}): Promise<LaunchFacts> {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();

  const stripe: LaunchFacts["stripe"] = {
    pack: null,
    registers: null,
    webhookEndpoint: null,
  };
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (key && !isFakeStripeMode(env)) {
    const client = createStripeClient(key) as unknown as StripeLike;
    stripe.pack = await readPriceFact(client, env.STRIPE_PRICE_PACK);
    stripe.registers = await readPriceFact(client, env.STRIPE_PRICE_REGISTERS);
    stripe.webhookEndpoint = await readWebhookEndpoint(
      client,
      input.requestHost,
    );
  }

  const businessName = env.BUSINESS_NAME?.trim();
  let aboutNamesBusiness: boolean | null = null;
  if (businessName) {
    try {
      aboutNamesBusiness = loadLegalPage("about").body.includes(businessName);
    } catch {
      aboutNamesBusiness = false;
    }
  }

  const jobs = {} as LaunchFacts["jobs"];
  for (const job of [
    "purge",
    "generate",
    "reminders",
    "uptime",
    "backup",
  ] as const)
    jobs[job] = await lastAuditAt(input.admin, jobRunAction(job));

  let legal: LaunchFacts["legal"] = [];
  try {
    legal = loadLegalPages().map((p) => ({ slug: p.slug, updated: p.updated }));
  } catch (e) {
    log.warn("launch.facts.legal-read-failed", { error: e });
  }

  return {
    env,
    requestHost: input.requestHost,
    aboutNamesBusiness,
    stripe,
    email: {
      provider: createEmailProvider().name,
      configured: configuredEmailProvider(),
      missing: configuredEmailProvider() === "smtp" ? smtpMissing() : [],
      dns: await readSenderDns(process.env.EMAIL_FROM),
      domainVerified: null,
      lastTestSendAt: await lastAuditAt(input.admin, TEST_SEND_ACTION),
    },
    jobs,
    adminTotpEnrolled: await adminTotpEnrolled(input.admin),
    legal,
    now,
  };
}
