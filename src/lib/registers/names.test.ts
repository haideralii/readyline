// @vitest-environment node
/**
 * The one naming table (batch 42 items 2 and 3, D-547): canonical names are
 * unique and never doubled as aliases, every alias resolves to its name, and
 * the twelve audit-day records are the same list the self-assessment's
 * "Items to prepare before the audit" uses, in the same order.
 */
import { describe, expect, it } from "vitest";
import { documentTypeById } from "@/lib/generator/catalogue";
import { buildProviderFacts } from "@/lib/generator/facts";
import { fixedExtra } from "@/lib/generator/fixed-extras";
import type { FixedContext } from "@/lib/generator/fixed-text";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  AUDIT_DAY_RECORDS,
  AUDIT_RECORD_TIER_TITLES,
  KEPT_ON_PAPER,
  auditRecordTier,
  itemsToPrepareByTier,
  CLEARANCE_COLUMNS,
  COMPLAINT_COLUMNS,
  INCIDENT_COLUMNS,
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

describe("the thirteen records an auditor asks for (twelve of REQ-018 and the hazard register of REQ-020)", () => {
  it("are thirteen, each a canonical record with the same name and page, the hazard register after the delegations", () => {
    expect(AUDIT_DAY_RECORDS).toHaveLength(13);
    const ids = AUDIT_DAY_RECORDS.map((r) => r.id);
    expect(new Set(ids).size).toBe(13);
    expect(ids[ids.indexOf("delegations") + 1]).toBe("hazards");
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

  it("the self-assessment list mirrors them in the same order, with the insurances line pointing at the register and the paper records marked", () => {
    const items = itemsToPrepareBeforeAudit();
    expect(items).toHaveLength(13);
    AUDIT_DAY_RECORDS.forEach((r, i) => {
      if (r.id === "insurances") {
        expect(items[i]).toMatch(/^Your insurances and vehicles register:/);
        expect(items[i]).toMatch(/expiry date/);
        expect(items[i]).toMatch(/\(kept on paper\)$/);
      } else if (r.paper) expect(items[i]).toBe(`${r.ask} (${KEPT_ON_PAPER})`);
      else expect(items[i]).toBe(r.ask);
    });
  });
});

describe("the records in two tiers (batch 45, REQ-018-gated item; REQ-020 FR-7)", () => {
  it("six are named by the standards or the Rules and seven are asked for in practice; two are kept on paper", () => {
    const named = AUDIT_DAY_RECORDS.filter((r) => r.tier === "named").map(
      (r) => r.id,
    );
    const practice = AUDIT_DAY_RECORDS.filter((r) => r.tier === "practice").map(
      (r) => r.id,
    );
    expect(named).toEqual([
      "document-control",
      "corporate-risks",
      "insurances",
      "staff-matrix",
      "incidents",
      "complaints",
    ]);
    expect(practice).toEqual([
      "decisions",
      "participant-risks",
      "conflicts-of-interest",
      "delegations",
      "hazards",
      "improvements",
      "onboarding",
    ]);
    expect(AUDIT_DAY_RECORDS.filter((r) => r.paper).map((r) => r.id)).toEqual([
      "insurances",
      "onboarding",
    ]);
    expect(AUDIT_RECORD_TIER_TITLES.named).toBe("Records the standards name");
    expect(AUDIT_RECORD_TIER_TITLES.practice).toBe(
      "Records auditors often ask for",
    );
  });

  it("the tiered list holds the same thirteen lines as the flat one, each tier in the audit-day order, and the lookup answers by id", () => {
    const tiers = itemsToPrepareByTier();
    expect(tiers.named).toHaveLength(6);
    expect(tiers.practice).toHaveLength(7);
    expect(new Set([...tiers.named, ...tiers.practice])).toEqual(
      new Set(itemsToPrepareBeforeAudit()),
    );
    const flat = itemsToPrepareBeforeAudit();
    expect(tiers.named.map((l) => flat.indexOf(l))).toEqual(
      [...tiers.named.map((l) => flat.indexOf(l))].sort((a, b) => a - b),
    );
    expect(auditRecordTier("insurances")).toEqual({
      tier: "named",
      paper: true,
    });
    expect(auditRecordTier("decisions")).toEqual({
      tier: "practice",
      paper: false,
    });
    expect(auditRecordTier("nope")).toEqual({ tier: "practice", paper: false });
  });
});

describe("the paper registers carry the app's columns (batch 45 item 17)", () => {
  const dataset = getStandardsDataset();
  const reference = loadReferenceCases().find(
    (c) => c.id === "verification-sole-trader",
  )!;
  const ctx: FixedContext = {
    type: documentTypeById("incident-management-policy-and-register")!,
    facts: buildProviderFacts(reference.answers, reference.result),
    standards: [],
    documents: [],
    registers: [],
    version: "1",
    generatedAt: "2026-10-15",
    reviewDueAt: "2027-10-15",
  };
  void dataset;

  it("the incident register template's columns are the app's incident columns, with INC-0001 as the example", () => {
    const blocks = fixedExtra("incident-register", ctx)!;
    const table = blocks.find((b) => b.type === "table") as {
      columns: string[];
      rows: string[][];
    };
    expect(table.columns).toEqual(Object.values(INCIDENT_COLUMNS));
    expect(table.rows[0][0]).toBe("INC-0001");
    expect(table.rows[0]).toHaveLength(table.columns.length);
  });

  it("the complaints register template's columns are the app's complaint columns, with CMP-0001 as the example", () => {
    const blocks = fixedExtra("complaints-register", ctx)!;
    const table = blocks.find((b) => b.type === "table") as {
      columns: string[];
      rows: string[][];
    };
    expect(table.columns).toEqual(Object.values(COMPLAINT_COLUMNS));
    expect(table.rows[0][0]).toBe("CMP-0001");
    expect(table.rows[0]).toHaveLength(table.columns.length);
  });

  it("every column name is sentence case and never a database column", () => {
    for (const name of [
      ...Object.values(INCIDENT_COLUMNS),
      ...Object.values(COMPLAINT_COLUMNS),
      ...Object.values(CLEARANCE_COLUMNS),
    ]) {
      expect(name).toMatch(/^[A-Z][^_]*$/);
    }
  });
});
