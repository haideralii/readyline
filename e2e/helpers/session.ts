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
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";

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

/**
 * Creates a user and an owned account, and seeds the questionnaire draft.
 * With `withAccount: false` it creates and signs in the user only (no
 * account, no draft, `accountId` empty), for the spec that creates the
 * account through the setup form as a customer would (batch 45 item 28).
 */
export async function createTenant(input: {
  label: string;
  tradingName: string;
  answers: Record<string, unknown>;
  withAccount?: boolean;
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
  if (input.withAccount === false)
    return {
      userId: created.data.user.id,
      email,
      accountId: "",
      admin,
      session: signed.data.session as unknown as Record<string, unknown>,
    };
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

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238, SHA-1, 30-second step, six digits: the code an authenticator app would show. */
export function totpCode(secretBase32: string, now = Date.now()): string {
  const counter = Math.floor(now / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secretBase32)).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const code =
    ((h[off] & 0x7f) << 24) |
    (h[off + 1] << 16) |
    (h[off + 2] << 8) |
    h[off + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Raises or lowers `platform_admin` the way an operator would (REQ-004's
 * trigger refuses the change from any API call that carries a JWT, the
 * secret key included; run 38672915816): one SQL statement through `psql`
 * against the CI stack's database, whose URL the Supabase job exports as
 * SUPABASE_DB_URL. The user id is checked to be a UUID before it is placed
 * in the statement. Never run against the hosted project.
 */
export function setPlatformAdmin(userId: string, on: boolean): void {
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!dbUrl)
    throw new Error(
      "SUPABASE_DB_URL is not set; the admin e2e raises its admin through SQL on the local stack",
    );
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    )
  )
    throw new Error("not a user id");
  execFileSync(
    "psql",
    [
      dbUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-c",
      `update public.users set platform_admin = ${on ? "true" : "false"} where id = '${userId}'`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/**
 * A platform admin with a verified authenticator and an aal2 session
 * (REQ-022 Session A, D-2210): the admin key grants `platform_admin` on
 * the throwaway user, the user enrols TOTP through the auth API, and the
 * test computes the code the way an authenticator app would. The session
 * returned carries aal2, so `requireAdmin()` lets the browser in.
 */
export async function createAdminTenant(label: string): Promise<TestTenant> {
  const t = await createTenant({
    label: `admin-${label}`,
    tradingName: "Admin",
    answers: {},
    withAccount: false,
  });
  setPlatformAdmin(t.userId, true);
  const { url, publishableKey } = env();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const set = await client.auth.setSession({
    access_token: t.session.access_token as string,
    refresh_token: t.session.refresh_token as string,
  });
  if (set.error) throw set.error;
  const enrol = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "e2e",
  });
  if (enrol.error || !enrol.data)
    throw enrol.error ?? new Error("enrol failed");
  const challenge = await client.auth.mfa.challenge({
    factorId: enrol.data.id,
  });
  if (challenge.error || !challenge.data)
    throw challenge.error ?? new Error("challenge failed");
  const verify = await client.auth.mfa.verify({
    factorId: enrol.data.id,
    challengeId: challenge.data.id,
    code: totpCode(enrol.data.totp.secret),
  });
  if (verify.error) throw verify.error;
  const s = await client.auth.getSession();
  if (!s.data.session) throw new Error("no aal2 session after verify");
  return {
    ...t,
    session: s.data.session as unknown as Record<string, unknown>,
  };
}

/** Removes the user (cascading to the account and its rows) and the set's objects. */
export async function deleteTenant(tenant: TestTenant): Promise<void> {
  // After-window item 8 (PO 16 Oct 02:05): a job still queued or running when
  // the tenant goes would be claimed by the job route after the account is
  // gone and fail loud (`payments.generation.failed`, run 38750817767), so
  // it is failed here first, with the reason, and the claim never sees it.
  if (tenant.accountId)
    await tenant.admin
      .from("generation_jobs")
      .update({
        status: "failed",
        last_error: "cancelled: the test tenant was deleted",
      })
      .eq("account_id", tenant.accountId)
      .in("status", ["queued", "running"]);
  // A user created without an account (item 28) has no sets to clear, and the
  // account the form created is removed with the user.
  const sets = tenant.accountId
    ? await tenant.admin
        .from("version_sets")
        .select("id")
        .eq("account_id", tenant.accountId)
    : { data: [] as { id: string }[] };
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
