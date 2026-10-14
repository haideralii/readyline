/**
 * Batch 45 item 12 (D-2002) against a real Supabase stack: the service key
 * bumps a counter twice and reads 2 for the day; the anonymous key can
 * neither read nor bump; a wrong event name is refused by the CHECK. Skips
 * without the variables.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();
// A day far enough back that no real count shares it.
const DAY = "1999-01-01";

describe.skipIf(!enabled)("first-party counters (D-2002)", () => {
  const env = enabled ? readSupabaseAdminEnv() : null;
  const admin = env
    ? createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  afterAll(async () => {
    if (admin) await admin.from("daily_counters").delete().eq("day", DAY);
  });

  it("the service key bumps and reads; the same day and event add up", async () => {
    const a = await admin!.rpc("bump_counter", {
      p_event: "start-view",
      p_day: DAY,
    });
    expect(a.error).toBeNull();
    const b = await admin!.rpc("bump_counter", {
      p_event: "start-view",
      p_day: DAY,
    });
    expect(b.error).toBeNull();
    const r = await admin!
      .from("daily_counters")
      .select("count")
      .eq("day", DAY)
      .eq("event", "start-view")
      .single();
    expect(r.data?.count).toBe(2);
  });

  it("an event outside the list is refused", async () => {
    const r = await admin!.rpc("bump_counter", {
      p_event: "pageview",
      p_day: DAY,
    });
    expect(r.error?.code).toBe("23514");
  });

  it("the anonymous key can neither read nor bump", async () => {
    const anon = createClient(env!.url, env!.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const read = await anon
      .from("daily_counters")
      .select("count")
      .eq("day", DAY);
    expect(read.error?.code ?? (read.data?.length === 0 ? "42501" : "")).toBe(
      "42501",
    );
    const bump = await anon.rpc("bump_counter", {
      p_event: "start-view",
      p_day: DAY,
    });
    expect(bump.error).not.toBeNull();
  });
});
