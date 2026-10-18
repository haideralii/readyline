import { describe, expect, it } from "vitest";
import {
  HSTS_DEFAULT_MAX_AGE,
  HSTS_PRELOAD_FROM,
  hstsHeaderValue,
  hstsMaxAge,
} from "./hsts";

/**
 * REQ-022 FR-10, AC-8 (Session C): one week without preload, one year with
 * it; unset or junk falls to the one-week default; preload never below a year.
 */
describe("HSTS_MAX_AGE (REQ-022 FR-10, AC-8)", () => {
  it("one week carries includeSubDomains and no preload", () => {
    expect(hstsHeaderValue("604800")).toBe("max-age=604800; includeSubDomains");
  });

  it("one year carries preload", () => {
    expect(hstsHeaderValue("31536000")).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(hstsHeaderValue("63072000")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(hstsHeaderValue(String(HSTS_PRELOAD_FROM - 1))).not.toContain(
      "preload",
    );
  });

  it("unset or junk is the one-week default", () => {
    expect(HSTS_DEFAULT_MAX_AGE).toBe(604800);
    for (const raw of [undefined, "", "  ", "a week", "-1", "0", "1.5"])
      expect(hstsMaxAge(raw), String(raw)).toBe(HSTS_DEFAULT_MAX_AGE);
    expect(hstsMaxAge(" 604800 ")).toBe(604800);
  });
});
