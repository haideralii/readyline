// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { WEBHOOK_PATH, webhookEndpointState } from "./launch-facts";

/**
 * REQ-022 FR-1 and FR-8 (Session C): the Stripe webhook endpoint row is judged
 * against the host the page was served on, so it turns green only when
 * Stripe calls the domain after the move; a request-less read is unverified.
 */
describe("the webhook endpoint against the request host (REQ-022 FR-1, FR-8)", () => {
  const onDomain = `https://readyline.example${WEBHOOK_PATH}`;
  const onAlias = `https://readyline-zeta.vercel.app${WEBHOOK_PATH}`;

  it("matches when one endpoint has the request host and the webhook path", () => {
    expect(webhookEndpointState([onAlias, onDomain], "readyline.example")).toBe(
      "matches",
    );
    expect(webhookEndpointState([onDomain], "Readyline.Example")).toBe(
      "matches",
    );
  });

  it("is missing when the endpoints point at the alias or another path", () => {
    expect(webhookEndpointState([onAlias], "readyline.example")).toBe(
      "missing",
    );
    expect(
      webhookEndpointState(
        ["https://readyline.example/api/other"],
        "readyline.example",
      ),
    ).toBe("missing");
    expect(webhookEndpointState([], "readyline.example")).toBe("missing");
    expect(webhookEndpointState(["not a url"], "readyline.example")).toBe(
      "missing",
    );
  });

  it("is unverified with no request host, never a guess from the site URL", () => {
    expect(webhookEndpointState([onDomain], null)).toBe("unverified");
    expect(webhookEndpointState([onDomain], "  ")).toBe("unverified");
  });
});
