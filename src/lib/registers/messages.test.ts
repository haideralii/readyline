// @vitest-environment node
/**
 * The registers' plain words (REQ-009 SR-1; batch 49 item 2). Retro review
 * of REQ-018, finding 6: the linked-registers line says only what the code
 * does. A worker check never creates a staff matrix row; the staff matrix
 * row is typed and its status reads the worker's checks.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import {
  LAPSE_MESSAGE,
  REGISTERS_LINKED_LINE,
  RENEWAL_SAVES_LINE,
  plainDatabaseMessage,
} from "./messages";

describe("the registers' messages", () => {
  it("says a worker check shows on the staff matrix row, never that it becomes one", () => {
    expect(REGISTERS_LINKED_LINE).toContain(
      "a worker check shows on the worker's staff matrix row",
    );
    expect(REGISTERS_LINKED_LINE).not.toMatch(/becomes a staff matrix row/);
    expect(REGISTERS_LINKED_LINE).toContain(
      "an incident becomes an improvement row",
    );
  });

  it("every line passes the copy lint and the claims lint", () => {
    for (const t of [
      LAPSE_MESSAGE,
      REGISTERS_LINKED_LINE,
      RENEWAL_SAVES_LINE,
    ]) {
      expect(lintText(t, { block: true }), t).toEqual([]);
      expect(findProhibitedClaims(t), t).toEqual([]);
    }
  });

  it("turns the database's codes into plain words", () => {
    expect(plainDatabaseMessage({ code: "42501" })).toBe(LAPSE_MESSAGE);
    expect(
      plainDatabaseMessage({
        code: "23514",
        message: "looks_like_ndis_number",
      }),
    ).toMatch(/NDIS participant number/);
    expect(plainDatabaseMessage({ code: "23505" })).toBe(
      "That entry already exists.",
    );
    expect(plainDatabaseMessage({})).toBe(
      "We could not save that just now. Try again.",
    );
  });
});
