/**
 * REQ-007 AC-2 / SR-2 against a real Supabase stack: the `apply_stripe_event`
 * function follows the reducer's rules atomically (grant once, replay no-op,
 * refund revokes, refund before completion never grants) and is closed to
 * the publishable key. Skips without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

describe.skipIf(!enabled)("apply_stripe_event (REQ-007 AC-2, SR-2)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let userId: string;
  let accountId: string;
  const eventIds: string[] = [];

  function args(overrides: Record<string, unknown>) {
    const id = `evt_${randomUUID()}`;
    eventIds.push(id);
    return {
      p_event_id: id,
      p_type: "checkout.session.completed",
      p_session_id: null,
      p_payment_intent_id: null,
      p_account_id: accountId,
      p_assessment_id: "answers-v1-test",
      p_amount_cents: 39900,
      p_currency: "aud",
      p_receipt_url: null,
      p_occurred_at: new Date().toISOString(),
      ...overrides,
    };
  }

  async function apply(overrides: Record<string, unknown>) {
    const r = await admin.rpc("apply_stripe_event", args(overrides));
    if (r.error) throw r.error;
    return r.data as string;
  }

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `apply-${randomUUID()}@example.test`;
    const password = `Pw-${randomUUID()}`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("createUser failed");
    userId = created.data.user.id;
    const client = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw signed.error;
    const rpc = await client.rpc("create_account", {
      p_trading_name: "Apply Test",
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (eventIds.length)
      await admin.from("stripe_events").delete().in("id", eventIds);
  });

  it("grants once, replays as a duplicate, and a second completion for the session grants nothing", async () => {
    const session = `cs_${randomUUID()}`;
    const pi = `pi_${randomUUID()}`;
    const first = args({ p_session_id: session, p_payment_intent_id: pi });
    const r1 = await admin.rpc("apply_stripe_event", first);
    expect(r1.data).toBe("granted");
    const r2 = await admin.rpc("apply_stripe_event", first);
    expect(r2.data).toBe("duplicate");
    expect(
      await apply({ p_session_id: session, p_payment_intent_id: pi }),
    ).toBe("already_paid");
    const ents = await admin
      .from("entitlements")
      .select("kind, revoked_at, source_purchase_id")
      .eq("account_id", accountId);
    expect(
      ents.data?.filter((e) => e.kind === "pack" && !e.revoked_at),
    ).toHaveLength(1);
  });

  it("a refund revokes the entitlement and marks the purchase refunded", async () => {
    const session = `cs_${randomUUID()}`;
    const pi = `pi_${randomUUID()}`;
    expect(
      await apply({ p_session_id: session, p_payment_intent_id: pi }),
    ).toBe("granted");
    expect(
      await apply({ p_type: "charge.refunded", p_payment_intent_id: pi }),
    ).toBe("revoked");
    expect(
      await apply({ p_type: "charge.refunded", p_payment_intent_id: pi }),
    ).toBe("duplicate");
    const purchase = await admin
      .from("purchases")
      .select("status, refunded_at, id")
      .eq("stripe_checkout_session_id", session)
      .single();
    expect(purchase.data?.status).toBe("refunded");
    expect(purchase.data?.refunded_at).not.toBeNull();
    const ent = await admin
      .from("entitlements")
      .select("revoked_at")
      .eq("source_purchase_id", purchase.data!.id)
      .single();
    expect(ent.data?.revoked_at).not.toBeNull();
  });

  it("a refund that arrives first leaves the purchase refunded and the later completion grants nothing", async () => {
    const session = `cs_${randomUUID()}`;
    const pi = `pi_${randomUUID()}`;
    expect(
      await apply({ p_type: "charge.refunded", p_payment_intent_id: pi }),
    ).toBe("refund_recorded");
    expect(
      await apply({ p_session_id: session, p_payment_intent_id: pi }),
    ).toBe("refunded_before_completion");
    const purchase = await admin
      .from("purchases")
      .select("status, stripe_checkout_session_id, id")
      .eq("stripe_payment_intent_id", pi)
      .single();
    expect(purchase.data).toMatchObject({
      status: "refunded",
      stripe_checkout_session_id: session,
    });
    const ents = await admin
      .from("entitlements")
      .select("id")
      .eq("source_purchase_id", purchase.data!.id);
    expect(ents.data).toEqual([]);
  });

  it("ignores other types, refuses malformed events, and is closed to the publishable key", async () => {
    expect(await apply({ p_type: "payment_intent.created" })).toBe("ignored");
    expect(
      await apply({ p_type: "checkout.session.completed", p_session_id: null }),
    ).toBe("invalid");
    const r = await anon.rpc(
      "apply_stripe_event",
      args({ p_session_id: `cs_${randomUUID()}` }),
    );
    expect(r.error?.code).toBe("42501");
  });
});

describe.skipIf(enabled)("apply_stripe_event (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});
