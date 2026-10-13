// @vitest-environment node
/**
 * The repository_dispatch call (D-059, batch 37 item 1) against a mocked
 * fetch: the right endpoint, event and bearer; skipped with one log line
 * and no request when the token is absent; a refusal or a network error
 * reported as failed without throwing and without the token in any log.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "@/lib/logging/logger";
import {
  DISPATCH_EVENT,
  DISPATCH_REPO,
  dispatchGenerateWorkflow,
} from "./dispatch";

const TOKEN = "github_pat_test_value_never_logged";

function mockFetch(status: number) {
  return vi.fn(async () => new Response(null, { status }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dispatchGenerateWorkflow (D-059)", () => {
  it("posts the generate event to the repository with the bearer", async () => {
    const fetchImpl = mockFetch(204);
    const info = vi.spyOn(log, "info").mockImplementation(() => undefined);
    const out = await dispatchGenerateWorkflow({
      reason: "webhook",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { GITHUB_DISPATCH_TOKEN: TOKEN },
    });
    expect(out).toBe("dispatched");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `https://api.github.com/repos/${DISPATCH_REPO}/dispatches`,
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers.accept).toBe("application/vnd.github+json");
    expect(JSON.parse(String(init.body))).toEqual({
      event_type: DISPATCH_EVENT,
      client_payload: { reason: "webhook" },
    });
    expect(info).toHaveBeenCalledWith("payments.generation.dispatched", {
      kicked_by: "webhook",
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain(TOKEN);
  });

  it("skips with one log line and no request when the token is absent", async () => {
    const fetchImpl = mockFetch(204);
    const info = vi.spyOn(log, "info").mockImplementation(() => undefined);
    const out = await dispatchGenerateWorkflow({
      reason: "page",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: {},
    });
    expect(out).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith("payments.generation.dispatch-skipped", {
      reason: "no-token",
      kicked_by: "page",
    });
  });

  it("reports a refusal as failed, with the status and never the token", async () => {
    const fetchImpl = mockFetch(401);
    const warn = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    const out = await dispatchGenerateWorkflow({
      reason: "webhook",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { GITHUB_DISPATCH_TOKEN: TOKEN },
    });
    expect(out).toBe("failed");
    expect(warn).toHaveBeenCalledWith("payments.generation.dispatch-failed", {
      status: 401,
      kicked_by: "webhook",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
  });

  it("reports a network error as failed without throwing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const warn = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    const out = await dispatchGenerateWorkflow({
      reason: "page",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { GITHUB_DISPATCH_TOKEN: TOKEN },
    });
    expect(out).toBe("failed");
    expect(warn).toHaveBeenCalledWith("payments.generation.dispatch-failed", {
      error: "TypeError",
      kicked_by: "page",
    });
  });
});
