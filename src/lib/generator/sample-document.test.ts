// @vitest-environment node
/**
 * The committed sample (data/samples/complaints-policy.json) must be what a
 * fresh replay of the fixtures produces, so it cannot drift from the
 * generator; with WRITE_SAMPLE=1 this test rewrites it. No model call.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { blocksToText } from "./section-schema";
import {
  buildSampleDocument,
  renameProvider,
  SAMPLE_TRADING_NAME,
} from "./sample-document";

vi.mock("server-only", () => ({}));

const PATH = "data/samples/complaints-policy.json";

describe("sample document (batch 24 item 2)", () => {
  it("replays every tailored section from fixtures, names only the fictional provider, and matches the committed file", async () => {
    const model = await buildSampleDocument();
    expect(model.typeId).toBe("complaints-management-policy-and-register");
    expect(model.facts.tradingName).toBe(SAMPLE_TRADING_NAME);
    const tailored = model.sections.filter((s) => s.mode === "tailored");
    expect(tailored.length).toBeGreaterThanOrEqual(4);
    expect(tailored.every((s) => s.status === "generated")).toBe(true);
    const text = JSON.stringify(model);
    expect(text).not.toContain("Sunrise Supports");
    expect(text).toContain(SAMPLE_TRADING_NAME);
    for (const s of model.sections)
      expect(findProhibitedClaims(blocksToText(s.blocks)), s.id).toEqual([]);

    const serialised = JSON.stringify(model, null, 2) + "\n";
    if (process.env.WRITE_SAMPLE === "1") {
      mkdirSync("data/samples", { recursive: true });
      writeFileSync(PATH, serialised);
    }
    expect(JSON.parse(readFileSync(PATH, "utf8"))).toEqual(model);
  });

  it("renameProvider replaces every occurrence and nothing else", () => {
    const model = {
      title: "Policy for Sunrise Supports",
      facts: { tradingName: "Sunrise Supports" },
      sections: [
        { blocks: [{ type: "paragraph", text: "Sunrise Supports x" }] },
      ],
    } as unknown as Parameters<typeof renameProvider>[0];
    const out = renameProvider(model, "Sunrise Supports", "Example Supports");
    expect(JSON.stringify(out)).not.toContain("Sunrise");
    expect(out.title).toBe("Policy for Example Supports");
  });
});
