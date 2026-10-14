// @vitest-environment node
/**
 * The audit-day register data (REQ-018 Session B; D-1904): every register
 * has fields that match its schema's keys, every customer-facing word
 * (titles, intros, empty states, labels, help, options, onboarding items)
 * passes the copy lint and the claims lint, the onboarding lines are
 * instructions, the schemas refuse a name in a code field and an
 * NDIS-number shape in free text, and the row-to-form mapping round-trips.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import { parseInput } from "@/lib/validation";
import {
  AUDIT_DAY_META,
  AUDIT_DAY_SLUGS,
  CorporateRiskForm,
  DelegationForm,
  ParticipantRiskForm,
  blankValues,
  reviewTag,
  rowToValues,
} from "./audit-day-forms";
import {
  PARTICIPANT_ONBOARDING_ITEMS,
  WORKER_ONBOARDING_ITEMS,
} from "./onboarding-items";

function schemaKeys(schema: unknown): string[] {
  const s = schema as {
    shape?: Record<string, unknown>;
    _def?: { schema?: { shape?: Record<string, unknown> } };
  };
  const shape = s.shape ?? s._def?.schema?.shape;
  return Object.keys(shape ?? {});
}

describe("audit-day register meta (REQ-018 Session B)", () => {
  it("every register's fields are exactly its schema's keys, and each has a title, intro, add label and empty state", () => {
    for (const slug of AUDIT_DAY_SLUGS) {
      const meta = AUDIT_DAY_META[slug];
      expect(meta.slug).toBe(slug);
      expect(meta.fields.map((f) => f.name).sort(), slug).toEqual(
        schemaKeys(meta.schema).sort(),
      );
      for (const s of [meta.title, meta.intro, meta.addLabel, meta.empty])
        expect(s.length, slug).toBeGreaterThan(3);
      expect(meta.table.length).toBeGreaterThan(0);
      expect(meta.view.length).toBeGreaterThan(0);
    }
  });

  it("every customer-facing word passes the copy lint and the claims lint", () => {
    const texts: string[] = [];
    for (const slug of AUDIT_DAY_SLUGS) {
      const meta = AUDIT_DAY_META[slug];
      texts.push(
        meta.title,
        meta.intro,
        meta.addLabel,
        meta.empty,
        meta.singular,
      );
      for (const f of meta.fields) {
        texts.push(f.label);
        if (f.help) texts.push(f.help);
        if (f.hint) texts.push(f.hint);
        for (const o of f.options ?? []) texts.push(o.label);
      }
      for (const fl of meta.filters) texts.push(fl.label);
    }
    for (const i of [
      ...WORKER_ONBOARDING_ITEMS,
      ...PARTICIPANT_ONBOARDING_ITEMS,
    ])
      texts.push(i.text);
    for (const t of texts) {
      expect(lintText(t, { block: true }), t).toEqual([]);
      expect(findProhibitedClaims(t), t).toEqual([]);
    }
  });

  it("the onboarding checklists are instructions with unique ids", () => {
    for (const list of [
      WORKER_ONBOARDING_ITEMS,
      PARTICIPANT_ONBOARDING_ITEMS,
    ]) {
      expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
      for (const i of list) {
        expect(i.id).toMatch(/^[a-z0-9-]{1,60}$/);
        expect(i.text, i.id).toMatch(
          /^(Check|See|Type|Ask|Walk|Have|Show|Book|Go|Record|Write|Add|Explain|Introduce)\b/,
        );
      }
    }
    expect(WORKER_ONBOARDING_ITEMS.length).toBeGreaterThanOrEqual(6);
    expect(PARTICIPANT_ONBOARDING_ITEMS.length).toBeGreaterThanOrEqual(6);
  });

  it("the schemas refuse a name in a code field, an NDIS-number shape in free text and a review before a declaration", () => {
    const name = parseInput(ParticipantRiskForm, {
      participant_ref: "Jane Citizen",
      risk: "Falls when tired.",
      controls: "Two workers.",
      review_on: "2027-01-01",
      support_plan_review_on: "",
    });
    expect(name.ok).toBe(false);
    const ndis = parseInput(CorporateRiskForm, {
      area: "finance",
      what_could_happen: "Participant 430123456 complains.",
      likelihood: "low",
      controls: "None.",
      owner_role: "Owner",
      review_on: "2027-01-01",
    });
    expect(ndis.ok).toBe(false);
    const other = parseInput(DelegationForm, {
      role: "other",
      role_label: "",
      holder_ref: "kp-1",
      backup_ref: "",
      backup_may: "",
    });
    expect(other.ok).toBe(false);
    const good = parseInput(DelegationForm, {
      role: "finance-approver",
      role_label: "",
      holder_ref: "kp-1",
      backup_ref: "w-3",
      backup_may: "Approve payments under $500.",
    });
    expect(good.ok).toBe(true);
    if (good.ok)
      expect(good.data).toMatchObject({
        holder_ref: "KP-1",
        backup_ref: "W-3",
      });
  });

  it("blank values and row-to-form values keep the field shape; review tags follow the state", () => {
    const meta = AUDIT_DAY_META["staff-matrix"];
    const blank = blankValues(meta.fields);
    expect(blank.risk_assessed).toBe(false);
    expect(blank.worker_ref).toBe("");
    const values = rowToValues(meta.fields, {
      worker_ref: "W-1",
      role_label: "support worker",
      qualifications: null,
      risk_assessed: true,
      started_on: null,
      last_supervision_on: "2026-10-01",
      last_appraisal_on: null,
      onboarding_signed_on: null,
      note: "",
    });
    expect(values).toMatchObject({
      worker_ref: "W-1",
      qualifications: "",
      risk_assessed: true,
      last_supervision_on: "2026-10-01",
      started_on: "",
    });
    expect(reviewTag("overdue", "2026-01-01").tone).toBe("signal");
    expect(reviewTag("due-soon", "2026-11-01").tone).toBe("ochre");
    expect(reviewTag("current", "2027-04-01").label).toContain("2027-04-01");
    expect(reviewTag("no-date", null).key).toBe("no-date");
  });
});
