/**
 * REQ-030 FR-3, AC-6 (D-2867): the uptime check against stubs. Two probes;
 * two consecutive failures open one issue `Site down <date>` (reusing an
 * open one); two consecutive passes close it; a lone failure between passes
 * opens nothing; the issue's words are status codes and times only (SR-3);
 * the report to the route carries up and the two statuses.
 */
import { describe, expect, it } from "vitest";
import {
  applyIssueAction,
  issueText,
  judge,
  probe,
  report,
} from "./uptime-lib.mjs";

type Reply = { status: number; body: string };
function fetchFor(byPath: Record<string, Reply>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const reply = byPath[path] ?? { status: 404, body: "" };
    return new Response(reply.body, { status: reply.status });
  }) as typeof fetch;
  return { impl, calls };
}

describe("probe", () => {
  it("is up when health is 200 with ok and the home page carries the brand", async () => {
    const { impl } = fetchFor({
      "/api/health": { status: 200, body: '{"ok":true}' },
      "/": { status: 200, body: "<title>Readyline</title>" },
    });
    expect(
      await probe("https://readyline.example/", "Readyline", impl),
    ).toEqual({
      health: { status: 200, ok: true },
      home: { status: 200, ok: true },
      up: true,
    });
  });

  it("is down on a 500, on ok false, on a page without the brand, or on a network error", async () => {
    const down = fetchFor({
      "/api/health": { status: 500, body: "" },
      "/": { status: 200, body: "<title>Readyline</title>" },
    });
    expect((await probe("https://x.example", "Readyline", down.impl)).up).toBe(
      false,
    );
    const notOk = fetchFor({
      "/api/health": { status: 200, body: '{"ok":false}' },
      "/": { status: 200, body: "Readyline" },
    });
    expect((await probe("https://x.example", "Readyline", notOk.impl)).up).toBe(
      false,
    );
    const noBrand = fetchFor({
      "/api/health": { status: 200, body: '{"ok":true}' },
      "/": { status: 200, body: "<title>Maintenance</title>" },
    });
    const r = await probe("https://x.example", "Readyline", noBrand.impl);
    expect(r.up).toBe(false);
    expect(r.home).toEqual({ status: 200, ok: false });
    const failing = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await probe("https://x.example", "Readyline", failing)).toEqual({
      health: { status: 0, ok: false },
      home: { status: 0, ok: false },
      up: false,
    });
  });
});

describe("judge (two strikes, two passes)", () => {
  it("AC-6: the second consecutive failure opens, the first does not; two passes close an open issue; a lone failure between passes opens nothing", () => {
    const first = judge({ strikes: 0, passes: 0, issueOpen: false }, false);
    expect(first).toMatchObject({
      strikes: 1,
      action: "none",
      issueOpen: false,
    });
    const second = judge(first, false);
    expect(second).toMatchObject({
      strikes: 2,
      action: "open",
      issueOpen: true,
    });
    const third = judge(second, false);
    expect(third).toMatchObject({
      strikes: 3,
      action: "none",
      issueOpen: true,
    });
    const pass1 = judge(third, true);
    expect(pass1).toMatchObject({
      strikes: 0,
      passes: 1,
      action: "none",
      issueOpen: true,
    });
    const pass2 = judge(pass1, true);
    expect(pass2).toMatchObject({
      passes: 2,
      action: "close",
      issueOpen: false,
    });
    const blip = judge(pass2, false);
    expect(blip).toMatchObject({
      strikes: 1,
      action: "none",
      issueOpen: false,
    });
    const back = judge(blip, true);
    expect(back).toMatchObject({ passes: 1, action: "none", issueOpen: false });
    expect(judge(back, true)).toMatchObject({
      action: "none",
      issueOpen: false,
    });
  });

  it("starts from nothing", () => {
    expect(judge({}, true)).toMatchObject({
      strikes: 0,
      passes: 1,
      action: "none",
      issueOpen: false,
    });
    expect(judge({}, false)).toMatchObject({ strikes: 1, action: "none" });
  });
});

describe("the issue and the report (SR-3, D-2867)", () => {
  const result = {
    health: { status: 500, ok: false },
    home: { status: 200, ok: true },
    up: false,
  };
  const now = new Date("2026-10-18T03:00:00Z");

  it("names the day and carries statuses and times only", () => {
    const t = issueText(result, now);
    expect(t.title).toBe("Site down 2026-10-18");
    expect(t.body).toContain("/api/health: status 500 (not ok)");
    expect(t.body).toContain("/: status 200");
    expect(t.body).not.toMatch(/https?:\/\/|@|Bearer|token=/i);
  });

  it("opens one issue through the API, reuses an open one, and closes it on the close action", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const api = (open: unknown[]) =>
      (async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({
          url,
          method: init?.method ?? "GET",
          body: typeof init?.body === "string" ? init.body : undefined,
        });
        if (url.includes("state=open")) return Response.json(open);
        if (init?.method === "POST") return Response.json({ number: 7 });
        if (init?.method === "PATCH") return Response.json({ number: 7 });
        return new Response("", { status: 404 });
      }) as typeof fetch;
    const base = {
      repository: "owner/repo",
      token: "ghs_fixture",
      result,
      now,
    };
    const opened = await applyIssueAction({ ...base, action: "open" }, api([]));
    expect(opened).toEqual({ done: true, reused: false, number: 7 });
    const post = calls.find((c) => c.method === "POST");
    expect(post?.url).toBe("https://api.github.com/repos/owner/repo/issues");
    expect(JSON.parse(post!.body!).title).toBe("Site down 2026-10-18");
    calls.length = 0;
    const reused = await applyIssueAction(
      { ...base, action: "open" },
      api([{ number: 3, title: "Site down 2026-10-17" }]),
    );
    expect(reused).toEqual({ done: true, reused: true, number: 3 });
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    calls.length = 0;
    const closed = await applyIssueAction(
      { ...base, action: "close" },
      api([{ number: 3, title: "Site down 2026-10-17" }]),
    );
    expect(closed).toEqual({ done: true, number: 3 });
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.url).toBe("https://api.github.com/repos/owner/repo/issues/3");
    expect(JSON.parse(patch!.body!).state).toBe("closed");
    expect(
      await applyIssueAction({ ...base, action: "none" }, api([])),
    ).toEqual({ done: false });
    expect(
      await applyIssueAction({ ...base, action: "open", token: "" }, api([])),
    ).toEqual({ done: false });
  });

  it("reports up and the two statuses to the route with the bearer, and skips without the secret", async () => {
    const { impl, calls } = fetchFor({
      "/api/jobs/uptime": { status: 200, body: "{}" },
    });
    const r = await report(
      { baseUrl: "https://readyline.example", secret: "cron-fixture", result },
      impl,
    );
    expect(r).toEqual({ reported: true, status: 200 });
    const u = new URL(calls[0].url);
    expect(u.pathname).toBe("/api/jobs/uptime");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      up: "false",
      health: "500",
      home: "200",
    });
    expect(
      (calls[0].init?.headers as Record<string, string>).authorization,
    ).toBe("Bearer cron-fixture");
    expect(
      await report({ baseUrl: "https://x.example", secret: "", result }, impl),
    ).toEqual({ reported: false });
  });
});
