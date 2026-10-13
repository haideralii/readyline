// @vitest-environment node
/**
 * The kicker's loop (batch 32 item 1, D-1006) against a stub of the job
 * route: it keeps calling while the route says `more: true`, stops on
 * `more: false`, stops at the time box, stops on a refusal, sends the
 * bearer and the `kick=kicker` marker, and never prints the secret.
 */
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { kickUntilDrained } from "./kick-generation-lib.mjs";

type Reply = { status: number; body: unknown };

let server: Server | null = null;

async function stub(replies: Reply[]) {
  const seen: { url: string; authorization: string | undefined }[] = [];
  let i = 0;
  server = createServer((req, res) => {
    seen.push({ url: req.url ?? "", authorization: req.headers.authorization });
    const r = replies[Math.min(i, replies.length - 1)];
    i += 1;
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(JSON.stringify(r.body));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { url: `http://127.0.0.1:${port}`, seen };
}

afterEach(async () => {
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
});

describe("kick-generation (batch 32 item 1)", () => {
  it("calls until the route reports nothing more, with the bearer and the kicker marker", async () => {
    const s = await stub([
      { status: 200, body: { runs: [{ claimed: true }], more: true } },
      { status: 200, body: { runs: [{ claimed: true }], more: true } },
      { status: 200, body: { runs: [{ claimed: false }], more: false } },
    ]);
    const lines: string[] = [];
    const out = await kickUntilDrained({
      url: s.url,
      secret: "s".repeat(64),
      log: (l: string) => lines.push(l),
    });
    expect(out).toMatchObject({ ok: true, reason: "drained" });
    expect(out.calls).toHaveLength(3);
    expect(s.seen).toHaveLength(3);
    for (const call of s.seen) {
      expect(call.url).toBe("/api/jobs/generate?kick=kicker");
      expect(call.authorization).toBe(`Bearer ${"s".repeat(64)}`);
    }
    expect(lines.join("\n")).not.toContain("s".repeat(64));
    expect(lines).toEqual([
      "kick 1: runs=1 more=true",
      "kick 2: runs=1 more=true",
      "kick 3: runs=1 more=false",
    ]);
  });

  it("an overlapping kick is a no-op: the route claims nothing and the loop ends after one call", async () => {
    const s = await stub([
      { status: 200, body: { runs: [{ claimed: false }], more: false } },
    ]);
    const out = await kickUntilDrained({ url: s.url, secret: "x".repeat(32) });
    expect(out).toMatchObject({ ok: true, reason: "drained" });
    expect(s.seen).toHaveLength(1);
  });

  it("stops at the time box while the route still has more", async () => {
    const s = await stub([{ status: 200, body: { runs: [], more: true } }]);
    let t = 0;
    const out = await kickUntilDrained({
      url: s.url,
      secret: "x".repeat(32),
      maxSeconds: 240,
      now: () => (t += 100_000),
      log: () => undefined,
    });
    expect(out.reason).toBe("time-box");
    // 0 s at start, then 100 s and 200 s pass the check, 300 s does not.
    expect(out.calls).toHaveLength(3);
  });

  it("a refusal (wrong secret, 404 by design) ends the run as a failure", async () => {
    const s = await stub([{ status: 404, body: "Not found" }]);
    const out = await kickUntilDrained({
      url: s.url,
      secret: "x".repeat(32),
      log: () => undefined,
    });
    expect(out).toMatchObject({ ok: false, reason: "http-404" });
  });

  it("a skipped preview answer counts as drained", async () => {
    const s = await stub([
      { status: 200, body: { skipped: "not the production deployment" } },
    ]);
    const out = await kickUntilDrained({
      url: s.url,
      secret: "x".repeat(32),
      log: () => undefined,
    });
    expect(out).toMatchObject({ ok: true, reason: "drained" });
  });
});
