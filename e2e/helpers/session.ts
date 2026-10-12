/**
 * A signed-in browser context for the e2e (REQ-007 AC-1) without an email
 * hop: the admin key creates a throwaway user with a password, the test
 * process signs in with supabase-js, and the resulting session is written
 * to the browser as the cookie `@supabase/ssr` expects (`sb-<ref>-auth-token`,
 * `base64-` + base64url JSON, chunked at 3180 characters). The server then
 * reads it like any other session.
 */
import type { BrowserContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export type TestTenant = {
  userId: string;
  email: string;
  accountId: string;
  admin: SupabaseClient;
  session: Record<string, unknown>;
};

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const secretKey = process.env.SUPABASE_SECRET_KEY!;
  return { url, publishableKey, secretKey };
}

export function adminClient(): SupabaseClient {
  const { url, secretKey } = env();
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Creates a user and an owned account, and seeds the questionnaire draft. */
export async function createTenant(input: {
  label: string;
  tradingName: string;
  answers: Record<string, unknown>;
}): Promise<TestTenant> {
  const { url, publishableKey } = env();
  const admin = adminClient();
  const email = `e2e-${input.label}-${randomUUID()}@example.test`;
  const password = `Pw-${randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw created.error ?? new Error("createUser failed");
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session)
    throw signed.error ?? new Error("sign-in failed");
  const rpc = await client.rpc("create_account", {
    p_trading_name: input.tradingName,
    p_business_structure: "sole-trader",
    p_states: ["NSW"],
    p_abn: null,
  });
  if (rpc.error) throw rpc.error;
  const accountId = rpc.data as string;
  const { answersVersion: _v, ...answers } = input.answers as {
    answersVersion?: number;
  } & Record<string, unknown>;
  void _v;
  const draft = await admin.from("questionnaire_drafts").upsert({
    account_id: accountId,
    answers,
    answers_version: 1,
    current_step: "result",
    updated_at: new Date().toISOString(),
  });
  if (draft.error) throw draft.error;
  return {
    userId: created.data.user.id,
    email,
    accountId,
    admin,
    session: signed.data.session as unknown as Record<string, unknown>,
  };
}

/** Writes the session into the browser the way the server expects to read it. */
export async function signInContext(
  context: BrowserContext,
  tenant: TestTenant,
  baseURL: string,
): Promise<void> {
  const { url } = env();
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const encoded =
    "base64-" +
    Buffer.from(JSON.stringify(tenant.session), "utf8").toString("base64url");
  const MAX = 3180;
  const chunks: { name: string; value: string }[] = [];
  if (encodeURIComponent(encoded).length <= MAX)
    chunks.push({ name, value: encoded });
  else {
    // The library splits on the URI-encoded length; base64url never needs encoding, so plain slices match.
    for (let i = 0, n = 0; i < encoded.length; i += MAX, n++)
      chunks.push({ name: `${name}.${n}`, value: encoded.slice(i, i + MAX) });
  }
  const site = new URL(baseURL);
  await context.addCookies(
    chunks.map((c) => ({
      name: c.name,
      value: c.value,
      domain: site.hostname,
      path: "/",
      httpOnly: true,
      secure: site.protocol === "https:",
      sameSite: "Lax" as const,
    })),
  );
}

/** Removes the user (cascading to the account and its rows) and the set's objects. */
export async function deleteTenant(tenant: TestTenant): Promise<void> {
  const sets = await tenant.admin
    .from("version_sets")
    .select("id")
    .eq("account_id", tenant.accountId);
  for (const s of sets.data ?? []) {
    const prefix = `${tenant.accountId}/${s.id}`;
    const listed = await tenant.admin.storage
      .from("documents")
      .list(prefix, { limit: 1000 });
    const names = (listed.data ?? []).map((o) => `${prefix}/${o.name}`);
    if (names.length)
      await tenant.admin.storage
        .from("documents")
        .remove(names)
        .catch(() => undefined);
  }
  await tenant.admin.auth.admin
    .deleteUser(tenant.userId)
    .catch(() => undefined);
}
