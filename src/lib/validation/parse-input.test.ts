import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseInput, strictObject, text } from "./parse-input";

const schema = strictObject({
  abn: z.string().regex(/^\d{11}$/),
  workers: z.number().int().min(1).max(500),
  notes: text(200).optional(),
});

describe("parseInput", () => {
  it("returns typed data for valid input", () => {
    const r = parseInput(schema, { abn: "12345678901", workers: 3 });
    expect(r).toEqual({ ok: true, data: { abn: "12345678901", workers: 3 } });
  });

  it("rejects unknown keys (strict objects at every boundary)", () => {
    const r = parseInput(schema, {
      abn: "12345678901",
      workers: 3,
      isAdmin: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(
        r.formErrors.concat(Object.values(r.fieldErrors).flat()),
      ).toContain("Unexpected field");
  });

  it("returns field-level messages without throwing", () => {
    const r = parseInput(schema, { abn: "12", workers: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.fieldErrors).sort()).toEqual(["abn", "workers"]);
      expect(r.fieldErrors.abn[0]).toMatch(/Invalid|regex|pattern/i);
    }
  });

  it("caps and trims free text and rejects control characters", () => {
    expect(
      parseInput(schema, { abn: "12345678901", workers: 1, notes: "  ok  " }),
    ).toMatchObject({
      ok: true,
      data: { notes: "ok" },
    });
    expect(
      parseInput(schema, {
        abn: "12345678901",
        workers: 1,
        notes: "x".repeat(201),
      }).ok,
    ).toBe(false);
    expect(
      parseInput(schema, {
        abn: "12345678901",
        workers: 1,
        notes: "bad\u0007bell",
      }).ok,
    ).toBe(false);
  });
});
