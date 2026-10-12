import { describe, expect, it } from "vitest";
import { businessAbn, contactEmail } from "./config";

describe("footer config (REQ-008 FR-2)", () => {
  it("shows the contact address only when it is set and looks like an address", () => {
    expect(contactEmail({})).toBeNull();
    expect(contactEmail({ CONTACT_EMAIL: "  " })).toBeNull();
    expect(contactEmail({ CONTACT_EMAIL: "not an address" })).toBeNull();
    expect(contactEmail({ CONTACT_EMAIL: " hello@example.com.au " })).toBe(
      "hello@example.com.au",
    );
  });

  it("shows the ABN only when it is 11 digits, formatted in the usual groups", () => {
    expect(businessAbn({})).toBeNull();
    expect(businessAbn({ BUSINESS_ABN: "123" })).toBeNull();
    expect(businessAbn({ BUSINESS_ABN: "12345678901" })).toBe("12 345 678 901");
    expect(businessAbn({ BUSINESS_ABN: "12 345 678 901" })).toBe(
      "12 345 678 901",
    );
  });
});
