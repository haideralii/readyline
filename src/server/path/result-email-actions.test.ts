// @vitest-environment node
/**
 * REQ-031 FR-1, SR-2, SR-3, SR-4 (D-2881, D-2883): the action's branches over
 * a fake limiter, a recording provider and a stubbed viewer: the address
 * bucket first, the IP's second, the limited answers as sentences, a refused
 * body, the sent message's shape and the account id by sign-in state, and no
 * address in any log line.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { ANSWERS_VERSION } from "@/lib/questionnaire/steps";
import type { EmailMessage } from "@/server/email/provider";

const hits: { key: string; limit: number }[] = [];
let refuse: (key: string) => boolean = () => false;
const sent: EmailMessage[] = [];
let viewer: {
  account: { id: string } | null;
  deleted: null;
  user: { email: string };
} | null = null;
const logged: Record<string, unknown>[] = [];

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));
vi.mock("@/server/auth/rate-limit", () => ({
  hitRateLimit: async (key: string, limit: { limit: number }) => {
    hits.push({ key, limit: limit.limit });
    return !refuse(key);
  },
}));
vi.mock("@/server/email/provider", () => ({
  createEmailProvider: () => ({
    name: "fake",
    send: async (m: EmailMessage) => {
      sent.push(m);
    },
  }),
}));
vi.mock("@/server/accounts/queries", () => ({
  getViewer: async () => viewer,
}));
vi.mock("@/server/accounts/actions", () => ({
  loadServerDraft: async () => {
    const c = loadReferenceCases()[0];
    return {
      answersVersion: ANSWERS_VERSION,
      answers: c.answers,
      currentStep: "result",
      updatedAt: "2026-10-18T00:00:00.000Z",
    };
  },
}));
vi.mock("@/lib/logging/logger", () => ({
  log: {
    info: (event: string, fields: Record<string, unknown>) =>
      logged.push({ event, ...fields }),
    warn: (event: string, fields: Record<string, unknown>) =>
      logged.push({ event, ...fields }),
  },
}));

const { sendResultEmailAction } = await import("./result-email-actions");
const answers = loadReferenceCases()[0].answers;
const ADDRESS = "Someone@Example.test";

beforeEach(() => {
  hits.length = 0;
  sent.length = 0;
  logged.length = 0;
  refuse = () => false;
  viewer = null;
});

describe("sendResultEmailAction", () => {
  it("signed out: validates the answers, hits the address bucket then the IP's, sends the result and answers in words", async () => {
    const r = await sendResultEmailAction({ email: ADDRESS, answers });
    expect(r).toEqual({ ok: true, message: "Sent to someone@example.test" });
    expect(hits.map((h) => [h.key.split(":")[0], h.limit])).toEqual([
      ["result-email", 1],
      ["result-email-ip", 5],
    ]);
    for (const h of hits) {
      expect(h.key).not.toMatch(/example|203\.0\.113/);
      expect(h.key).toMatch(/^result-email(-ip)?:[0-9a-f]{16,}$/);
    }
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("someone@example.test");
    expect(sent[0].template).toBe("result");
    expect(sent[0].accountId).toBeNull();
    expect(sent[0].text).toContain("Sign in to get ready:");
    expect(sent[0].text).toContain("start the questionnaire:");
  });

  it("the address bucket refuses first and the IP's is never spent; the answers are sentences, never counts", async () => {
    refuse = (key) => key.startsWith("result-email:");
    const r = await sendResultEmailAction({ email: ADDRESS, answers });
    expect(r).toEqual({
      ok: false,
      limited: true,
      message: "You already asked for this result in the last hour",
    });
    expect(hits).toHaveLength(1);
    expect(sent).toHaveLength(0);
    refuse = (key) => key.startsWith("result-email-ip:");
    const r2 = await sendResultEmailAction({ email: ADDRESS, answers });
    expect(r2.ok).toBe(false);
    expect(r2.message).not.toMatch(/\d/);
    expect(sent).toHaveLength(0);
  });

  it("refuses a bad address, a body with another field, invalid answers, and a signed-in body that carries answers", async () => {
    expect(
      (await sendResultEmailAction({ email: "not-an-address", answers })).ok,
    ).toBe(false);
    expect(
      (await sendResultEmailAction({ email: ADDRESS, answers, extra: 1 })).ok,
    ).toBe(false);
    expect(
      (await sendResultEmailAction({ email: ADDRESS, answers: { nope: true } }))
        .message,
    ).toContain("did not pass our checks");
    viewer = {
      account: { id: "acc-1" },
      deleted: null,
      user: { email: "owner@example.test" },
    };
    expect((await sendResultEmailAction({ email: ADDRESS, answers })).ok).toBe(
      false,
    );
    expect(sent).toHaveLength(0);
  });

  it("signed in: the server draft is the answers, the account id rides the message, and the links are the owner's", async () => {
    viewer = {
      account: { id: "acc-1" },
      deleted: null,
      user: { email: "owner@example.test" },
    };
    const r = await sendResultEmailAction({ email: ADDRESS });
    expect(r).toEqual({
      ok: true,
      message: expect.stringContaining("Sent to"),
    });
    expect(sent[0].accountId).toBe("acc-1");
    expect(sent[0].text).toContain("Go to your next step:");
    expect(sent[0].text).toContain("See your result:");
  });

  it("SR-3: no log line carries the address, and the hash prefix is eight characters", async () => {
    await sendResultEmailAction({ email: ADDRESS, answers });
    const text = JSON.stringify(logged);
    expect(text).not.toMatch(/example\.test|Someone/);
    expect(logged.some((l) => l.event === "result-email.sent")).toBe(true);
    const line = logged.find((l) => l.event === "result-email.sent")!;
    expect(String(line.hashPrefix)).toMatch(/^[0-9a-f]{8}$/);
  });
});
