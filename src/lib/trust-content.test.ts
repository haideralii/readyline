import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import {
  Testimonial,
  TrustContent,
  trustContent,
  visibleCounters,
} from "./trust-content";

describe("trust content (batch 24 item 4)", () => {
  it("renders no counter and no testimonial until the PO has real ones", () => {
    expect(visibleCounters()).toEqual([]);
    expect(trustContent.testimonials).toEqual([]);
  });

  it("shows only the counters that carry a number", () => {
    const c = TrustContent.parse({
      ...trustContent,
      counters: { providersHelped: 3, firstAuditsPassed: null },
    });
    expect(visibleCounters(c)).toEqual([
      { label: "providers helped", value: 3 },
    ]);
  });

  it("refuses a half-filled testimonial and lints a full one", () => {
    expect(() =>
      Testimonial.parse({ quote: "Great", name: "A", business: "B" }),
    ).toThrow();
    const t = Testimonial.parse({
      quote:
        "The questionnaire told me I only needed a verification audit, and the documents read like my business.",
      name: "A sole trader",
      business: "Example Supports",
      audit: "verification",
      given: "2026-11-01",
    });
    expect(findProhibitedClaims(t.quote)).toEqual([]);
  });

  it("every committed testimonial passes the claims lint", () => {
    for (const t of trustContent.testimonials)
      expect(findProhibitedClaims(t.quote), t.business).toEqual([]);
  });
});
