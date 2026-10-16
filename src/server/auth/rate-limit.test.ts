// @vitest-environment node
/**
 * The limiter's wiring (REQ-004 SR-3; REQ-020 SR-2, retro review finding
 * 21): one database statement per hit, the key never holding an email or
 * an address in clear, and the auditor-open bucket at sixty an hour per
 * link per viewer address.
 */
import { describe, expect, it, vi } from "vitest";
import { hashAddress } from "@/lib/registers/auditor-link";

vi.mock("server-only", () => ({}));

const calls: Record<string, unknown>[] = [];
let answer: boolean | null = true;
vi.mock("@/server/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, ...args });
      return { data: answer, error: null };
    },
  }),
}));

const {
  AUDITOR_OPEN_LIMIT,
  auditorOpenKey,
  checkAuditorOpenAllowed,
  checkMagicLinkAllowed,
  emailHash,
} = await import("./rate-limit");

describe("the rate limiter's keys and limits", () => {
  it("an auditor open counts against the link and the viewer's hashed address, sixty an hour", async () => {
    calls.length = 0;
    answer = true;
    expect(await checkAuditorOpenAllowed("link-1", "203.0.113.9")).toBe(true);
    expect(calls).toEqual([
      {
        fn: "auth_rate_limit_hit",
        p_key: `auditor-open:link-1:${hashAddress("203.0.113.9")}`,
        p_limit: 60,
        p_window_seconds: 3600,
      },
    ]);
    expect(AUDITOR_OPEN_LIMIT).toEqual({ limit: 60, windowSeconds: 3600 });
    expect(auditorOpenKey("link-1", "203.0.113.9")).not.toContain(
      "203.0.113.9",
    );
    expect(auditorOpenKey("link-1", null)).toBe("auditor-open:link-1:unknown");
  });

  it("the sixty-first open is refused when the statement says so", async () => {
    answer = false;
    expect(await checkAuditorOpenAllowed("link-1", "203.0.113.9")).toBe(false);
    answer = true;
  });

  it("a magic link hit keys the email by its hash and the address by its value, and names the reason", async () => {
    calls.length = 0;
    answer = true;
    const hash = emailHash("Owner@Example.test ");
    expect(hash).toBe(emailHash("owner@example.test"));
    expect(
      await checkMagicLinkAllowed({ emailHash: hash, ip: "198.51.100.4" }),
    ).toEqual({ allowed: true });
    expect(calls.map((c) => c.p_key)).toEqual([
      `email:${hash}`,
      "ip:198.51.100.4",
    ]);
    answer = false;
    expect(
      await checkMagicLinkAllowed({ emailHash: hash, ip: "198.51.100.4" }),
    ).toEqual({ allowed: false, reason: "email" });
    answer = true;
  });
});
