// @vitest-environment node
/**
 * The one naming table (batch 42 items 2 and 3, D-547): canonical names are
 * unique and never doubled as aliases, every alias resolves to its name, and
 * the twelve audit-day records are the same list the self-assessment's
 * "Items to prepare before the audit" uses, in the same order.
 */
import { describe, expect, it } from "vitest";
import {
  AUDIT_DAY_RECORDS,
  PACK_FORM_NAMES,
  RECORD_NAMES,
  canonicalRecordName,
  isCanonicalRecordName,
  itemsToPrepareBeforeAudit,
  registerDisplayName,
} from "./names";

const lower = (s: string) => s.toLowerCase();

describe("record names", () => {
  it("every canonical name and id is unique, sentence case, and not also an alias", () => {
    const names = RECORD_NAMES.map((r) => lower(r.name));
    expect(new Set(names).size).toBe(names.length);
    const ids = RECORD_NAMES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const aliases = new Set(RECORD_NAMES.flatMap((r) => r.aliases.map(lower)));
    for (const n of names) expect(aliases.has(n), n).toBe(false);
    for (const r of RECORD_NAMES) expect(r.name, r.id).toMatch(/^[A-Z][a-z]/);
  });

  it("an alias resolves to its canonical name; a canonical name resolves to itself; an unknown name to null", () => {
    expect(canonicalRecordName("clearance register")).toBe(
      "Worker checks register",
    );
    expect(canonicalRecordName("Risk register")).toBe(
      "Corporate risk register",
    );
    expect(canonicalRecordName("training matrix")).toBe("Staff matrix");
    expect(canonicalRecordName("Incident register")).toBe("Incident register");
    expect(canonicalRecordName("consent form")).toBe("Consent form");
    expect(canonicalRecordName("daily wellbeing register")).toBeNull();
    expect(isCanonicalRecordName("worker checks register")).toBe(true);
    expect(isCanonicalRecordName("worker screening clearance register")).toBe(
      false,
    );
    expect(PACK_FORM_NAMES).toContain("Consent form");
  });

  it("the page title and the pack use the same name for a register", () => {
    expect(registerDisplayName("worker-clearances")).toBe(
      "Worker checks register",
    );
    expect(registerDisplayName("decisions")).toBe("Record of decisions");
    expect(registerDisplayName("unknown")).toBe("unknown");
  });
});

describe("the twelve records an auditor asks for", () => {
  it("are twelve, each a canonical record with the same name and page", () => {
    expect(AUDIT_DAY_RECORDS).toHaveLength(12);
    const ids = AUDIT_DAY_RECORDS.map((r) => r.id);
    expect(new Set(ids).size).toBe(12);
    for (const r of AUDIT_DAY_RECORDS) {
      const canonical = RECORD_NAMES.find((x) => x.id === r.id);
      expect(canonical, r.id).toBeDefined();
      expect(r.name).toBe(canonical!.name);
      expect(r.href).toBe(canonical!.href);
      expect(r.ask.startsWith("Your ") || r.ask.startsWith("A "), r.id).toBe(
        true,
      );
    }
  });

  it("the self-assessment list mirrors them in the same order, with the insurances line pointing at the register", () => {
    const items = itemsToPrepareBeforeAudit();
    expect(items).toHaveLength(12);
    AUDIT_DAY_RECORDS.forEach((r, i) => {
      if (r.id === "insurances") {
        expect(items[i]).toMatch(/^Your insurances and vehicles register:/);
        expect(items[i]).toMatch(/expiry date/);
      } else expect(items[i]).toBe(r.ask);
    });
  });
});
