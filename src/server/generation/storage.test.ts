import { describe, expect, it } from "vitest";
import { isOwnedPath, objectPath } from "./storage";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SET = "33333333-3333-4333-8333-333333333333";

describe("object paths (REQ-005 SR-4, AC-7)", () => {
  it("builds account-namespaced paths and rejects bad parts", () => {
    expect(objectPath(A, SET, "governance-policy.docx")).toBe(
      `${A}/${SET}/governance-policy.docx`,
    );
    expect(() => objectPath("not-a-uuid", SET, "x.docx")).toThrow();
    expect(() => objectPath(A, SET, "../x.docx")).toThrow();
    expect(() => objectPath(A, SET, "x.exe")).toThrow();
  });

  it("recognises only paths inside the caller's account", () => {
    const mine = objectPath(A, SET, "set.zip");
    expect(isOwnedPath(mine, A)).toBe(true);
    expect(isOwnedPath(mine, B)).toBe(false);
    expect(isOwnedPath(`${A}/${SET}/../${B}/x.zip`, A)).toBe(false);
    expect(isOwnedPath(`${A}/x.zip`, A)).toBe(false);
    expect(isOwnedPath(mine.toUpperCase(), A)).toBe(true);
  });
});
