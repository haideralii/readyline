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
import { log } from "@/lib/logging/logger";
import type { LaunchFacts } from "@/lib/ops/launch";
import { isFakeStripeMode } from "@/lib/payments/fake-session";
import type { PriceFact } from "@/lib/payments/live-guards";
import { createEmailProvider } from "@/server/email/provider";
import { jobRunAction, type JobName } from "@/server/jobs/record-run";
import { createStripeClient } from "@/server/payments/stripe";

export const TEST_SEND_ACTION = "email.test-sent";

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

export async function readWebhookEndpoint(
  stripe: StripeLike,
  siteUrl: string | undefined,
): Promise<"matches" | "missing" | "unverified"> {
  const want = siteUrl?.trim()
    ? `${siteUrl.trim().replace(/\/$/, "")}/api/stripe/webhook`
    : null;
  try {
    const list = await stripe.webhookEndpoints.list({ limit: 100 });
    return want && list.data.some((w) => w.url === want)
      ? "matches"
      : "missing";
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
      env.NEXT_PUBLIC_SITE_URL,
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
  for (const job of ["purge", "generate", "reminders"] as JobName[])
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
      domainVerified: null,
      lastTestSendAt: await lastAuditAt(input.admin, TEST_SEND_ACTION),
    },
    jobs,
    adminTotpEnrolled: await adminTotpEnrolled(input.admin),
    legal,
    now,
  };
}
