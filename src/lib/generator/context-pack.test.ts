/**
 * REQ-005 SR-3: register contents and the questionnaire free text never reach
 * the prompt builder. Proved three ways: the pack schema has no field for
 * them, the builder never reads them (access is traced), and a canary placed
 * in them does not appear in the pack or the prompts.
 */
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import {
  buildContextPack,
  ContextPack,
  CONTEXT_FACT_KEYS,
} from "./context-pack";
import { FACT_KEYS } from "./facts";
import { buildModelRequest, buildUserPrompt, requestHash } from "./prompts";
import { loadReferenceCases } from "./reference-cases";

const dataset = getStandardsDataset();
const cases = loadReferenceCases();
const [reference] = cases;
const type = documentTypeById("governance-policy")!;
const section = sectionsFor(type).find((s) => s.mode === "tailored")!;

const CANARY = "CANARY-PARTICIPANT-JANE-DOE-1999";

function withCanaries() {
  return {
    ...reference.answers,
    supports: {
      ...reference.answers.supports,
      servicesNote: `We support ${CANARY} at home`,
    },
  };
}

/** Records every property path read from the answers object. */
function traced<T extends object>(obj: T, paths: Set<string>, prefix = ""): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      const path = typeof prop === "string" ? `${prefix}${prop}` : prefix;
      if (typeof prop === "string") paths.add(path);
      return value && typeof value === "object"
        ? traced(value as object, paths, `${path}.`)
        : value;
    },
  });
}

describe("context pack (REQ-005 SR-2, SR-3)", () => {
  it("has exactly the eleven fact keys and nothing else", () => {
    expect([...CONTEXT_FACT_KEYS]).toEqual([...FACT_KEYS]);
    const pack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type,
      section,
    });
    expect(Object.keys(pack.facts).sort()).toEqual([...FACT_KEYS].sort());
    expect(ContextPack.safeParse({ ...pack, participants: [] }).success).toBe(
      false,
    );
    expect(
      ContextPack.safeParse({
        ...pack,
        facts: { ...pack.facts, servicesNote: "x" },
      }).success,
    ).toBe(false);
  });

  it("never reads servicesNote or the existing-step answers", () => {
    const paths = new Set<string>();
    const answers = traced(withCanaries(), paths);
    buildContextPack({
      answers,
      result: reference.result,
      dataset,
      type,
      section,
    });
    const read = [...paths];
    expect(read.some((p) => p.startsWith("supports.servicesNote"))).toBe(false);
    expect(read.some((p) => p.startsWith("existing"))).toBe(false);
    expect(read).toContain("business.tradingName");
  });

  it("keeps the canary out of the pack and both prompts", () => {
    const pack = buildContextPack({
      answers: withCanaries(),
      result: reference.result,
      dataset,
      type,
      section,
    });
    const request = buildModelRequest(pack, "test-model");
    for (const text of [JSON.stringify(pack), request.system, request.user]) {
      expect(text).not.toContain(CANARY);
      expect(text).not.toContain("JANE");
    }
  });

  it("delimits facts and quotes the standard verbatim", () => {
    const pack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type,
      section,
    });
    const user = buildUserPrompt(pack);
    expect(user).toContain("<<<FACTS>>>");
    expect(user).toContain("<<<END FACTS>>>");
    expect(user).toContain(
      `tradingName: ${reference.answers.business.tradingName}`,
    );
    // The governance policy's standards are core-module ones, which the
    // verification case is not audited against (R-10); the incident policy
    // has a verification-module standard to quote.
    const incident = documentTypeById(
      "incident-management-policy-and-register",
    )!;
    const incidentPack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type: incident,
      section: sectionsFor(incident).find((s) => s.mode === "tailored")!,
    });
    const standard = dataset.standards.find(
      (s) => s.id === incidentPack.standards[0].id,
    )!;
    const incidentUser = buildUserPrompt(incidentPack);
    expect(incidentUser).toContain(standard.outcome);
    expect(incidentUser).toContain(standard.indicators[0]);
    expect(user).toContain("<<<STANDARDS>>>\nnone");
  });

  it("R-10: standards are the document's list intersected with the case's applicable modules", () => {
    const complaints = documentTypeById(
      "complaints-management-policy-and-register",
    )!;
    const section = sectionsFor(complaints).find((s) => s.mode === "tailored")!;
    const byCase = (id: string) => {
      const c = cases.find((x) => x.id === id)!;
      return buildContextPack({
        answers: c.answers,
        result: c.result,
        dataset,
        type: complaints,
        section,
      }).standards.map((s) => s.id);
    };
    expect(byCase("verification-sole-trader")).toEqual([
      "verification.complaints-management",
    ]);
    expect(byCase("certification-personal-care")).toEqual([
      "core.governance.feedback-and-complaints-management",
    ]);
  });

  it("R-9: the pack carries the document's numbered outline and the user prompt lists it", () => {
    const incident = documentTypeById(
      "incident-management-policy-and-register",
    )!;
    const section = sectionsFor(incident).find((s) => s.id === "scope")!;
    const pack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type: incident,
      section,
    });
    expect(pack.outline.map((o) => `${o.number} ${o.heading}`)).toEqual([
      "1 Purpose",
      "2 Scope",
      "3 Definitions",
      "4 Policy statement",
      "5 How we put this into practice",
      "6 Responsibilities",
      "7 Reportable incidents",
      "8 Incident procedure",
      "9 Incident register",
      "10 Records and evidence to retain",
      "11 Related documents and registers",
      "12 Review",
    ]);
    const user = buildUserPrompt(pack);
    expect(user).toContain(
      "<<<OUTLINE>>>\n1 Purpose\n2 Scope (this section)\n3 Definitions",
    );
    expect(user).toContain('(for example "see section 1 Purpose")');
    expect(user).toMatch(/never refer to a section that is not in the outline/);
  });

  it("hashes the exact request so any prompt or model change makes a new key", () => {
    const pack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type,
      section,
    });
    const a = buildModelRequest(pack, "model-a");
    const b = buildModelRequest(pack, "model-b");
    const c = { ...a, user: `${a.user} ` };
    expect(requestHash(a)).toHaveLength(64);
    expect(requestHash(a)).toBe(requestHash({ ...a }));
    expect(requestHash(a)).not.toBe(requestHash(b));
    expect(requestHash(a)).not.toBe(requestHash(c));
  });
});
