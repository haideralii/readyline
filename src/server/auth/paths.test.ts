import { describe, expect, it } from "vitest";
import { clientIp, safeNextPath } from "./paths";

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/start/supports")).toBe("/start/supports");
    expect(safeNextPath("/account?tab=1")).toBe("/account?tab=1");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "account",
    "",
    null,
    undefined,
    "/x\r\nLocation: y",
  ])("falls back for %j", (v) =>
    expect(safeNextPath(v as string | null | undefined)).toBe("/account"),
  );
});

describe("clientIp", () => {
  const headers = (map: Record<string, string>) => ({
    get: (n: string) => map[n.toLowerCase()] ?? null,
  });
  it("takes the first forwarded address", () => {
    expect(
      clientIp(headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })),
    ).toBe("203.0.113.5");
  });
  it("falls back to x-real-ip then null", () => {
    expect(clientIp(headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
    expect(clientIp(headers({}))).toBeNull();
  });
});
