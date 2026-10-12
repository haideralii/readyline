/**
 * REQ-013 FR-1 / AC-1: no raw zod message can reach the questionnaire UI.
 * Every step schema is driven through its error paths (empty submit, wrong
 * types, out-of-range values, bad enum values) and every message produced
 * must read as plain English, not as a type description.
 */
import { describe, expect, it } from "vitest";
import { parseInput } from "@/lib/validation";
import {
  BusinessStep,
  ExistingStep,
  PracticesStep,
  STEP_SCHEMAS,
  SupportsStep,
  WorkforceStep,
} from "./schema";

/** Shapes of zod's default messages that must never appear. */
const RAW =
  /expected \w+, received|invalid (?:option|input|type|value)|too (?:small|big)|\bundefined\b|>=|<=|\|/i;

function messagesFor(
  schema: Parameters<typeof parseInput>[0],
  input: unknown,
): string[] {
  const r = parseInput(schema, input);
  if (r.ok) return [];
  return [...Object.values(r.fieldErrors).flat(), ...r.formErrors];
}

const CASES: {
  name: string;
  schema: (typeof STEP_SCHEMAS)[keyof typeof STEP_SCHEMAS];
  inputs: unknown[];
}[] = [
  {
    name: "business",
    schema: BusinessStep,
    inputs: [
      {},
      { tradingName: "", structure: undefined, states: [], abn: "" },
      { tradingName: 5, structure: "cartel", states: "NSW", abn: 12 },
      {
        tradingName: "x".repeat(121),
        structure: "company",
        states: ["XX"],
        abn: "123",
      },
    ],
  },
  {
    name: "supports",
    schema: SupportsStep,
    inputs: [
      {},
      { groups: [] },
      { groups: "0107" },
      { groups: ["12"] },
      { groups: ["0138"] },
      { groups: ["0107"], servicesNote: 7 },
    ],
  },
  {
    name: "practices",
    schema: PracticesStep,
    inputs: [
      {},
      { restrictivePractices: "maybe" },
      { restrictivePractices: 1 },
    ],
  },
  {
    name: "workforce",
    schema: WorkforceStep,
    inputs: [
      {},
      {
        workerCount: "two",
        keyPersonnelCount: null,
        hasRiskAssessedRoles: "yes",
        allRiskAssessedScreened: "x",
      },
      {
        workerCount: 0,
        keyPersonnelCount: 0,
        hasRiskAssessedRoles: true,
        allRiskAssessedScreened: "yes",
      },
      {
        workerCount: 1.5,
        keyPersonnelCount: 99,
        hasRiskAssessedRoles: false,
        allRiskAssessedScreened: "no",
      },
      {
        workerCount: 501,
        keyPersonnelCount: 1,
        hasRiskAssessedRoles: true,
        allRiskAssessedScreened: "not-sure",
      },
    ],
  },
  {
    name: "existing",
    schema: ExistingStep,
    inputs: [
      {},
      { policies: "perhaps" },
      { policies: true, incidentRegister: 0 },
    ],
  },
];

describe("questionnaire validation messages are plain English (REQ-013 AC-1)", () => {
  for (const c of CASES) {
    it(`${c.name}: every error path yields a plain message`, () => {
      let seen = 0;
      for (const input of c.inputs) {
        const messages = messagesFor(c.schema, input);
        expect(
          messages.length,
          `${c.name} ${JSON.stringify(input)} should fail`,
        ).toBeGreaterThan(0);
        for (const m of messages) {
          seen++;
          expect(m, `${c.name}: "${m}"`).not.toMatch(RAW);
          expect(m.length).toBeGreaterThan(8);
          expect(m[0]).toMatch(/[A-Z]/);
        }
      }
      expect(seen).toBeGreaterThan(0);
    });
  }

  it("empty step 1 names each missing field in plain words", () => {
    const r = parseInput(BusinessStep, {
      tradingName: "",
      states: [],
      abn: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.tradingName).toEqual(["Enter your trading name"]);
      expect(r.fieldErrors.structure).toEqual([
        "Choose your business structure",
      ]);
      expect(r.fieldErrors.states).toEqual([
        "Choose at least one state or territory",
      ]);
    }
  });
});
