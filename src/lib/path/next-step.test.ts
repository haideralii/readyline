import { describe, expect, it } from "vitest";
import { EMPTY_PATH_STATE, nextStep, type PathState } from "./next-step";

/** Every account state in path order, with the step the strip must show (REQ-017 AC-3). */
const TABLE: {
  name: string;
  state: Partial<PathState>;
  id: string;
  href: string;
}[] = [
  { name: "nothing yet", state: {}, id: "questionnaire", href: "/start" },
  {
    name: "result, not paid",
    state: { questionnaireDone: true },
    id: "buy",
    href: "/path/before-you-buy",
  },
  {
    name: "paid, drafting",
    state: { questionnaireDone: true, paid: true, generating: true },
    id: "wait",
    href: "/documents",
  },
  {
    name: "paid, no set yet and no job (the webhook is late)",
    state: { questionnaireDone: true, paid: true },
    id: "wait",
    href: "/documents",
  },
  {
    name: "ready, blanks left",
    state: {
      questionnaireDone: true,
      paid: true,
      readySetId: "set-1",
      blanksLeft: 3,
    },
    id: "finish",
    href: "/documents/set-1/finish",
  },
  {
    name: "complete, groups to adopt",
    state: {
      questionnaireDone: true,
      paid: true,
      readySetId: "set-1",
      groupsToAdopt: 4,
    },
    id: "adopt",
    href: "/path/adopt",
  },
  {
    name: "adopted, checklist left",
    state: {
      questionnaireDone: true,
      paid: true,
      readySetId: "set-1",
      checklistLeft: 5,
      nextChecklistTitle: "Public liability insurance",
    },
    id: "checklist",
    href: "/checklist",
  },
  {
    name: "checklist done, no registration date",
    state: { questionnaireDone: true, paid: true, readySetId: "set-1" },
    id: "registration-date",
    href: "/account",
  },
  {
    name: "everything done",
    state: {
      questionnaireDone: true,
      paid: true,
      readySetId: "set-1",
      registrationDateSet: true,
    },
    id: "audit-day",
    href: "/path/audit-day",
  },
];

describe("nextStep (REQ-017 FR-1, AC-3)", () => {
  for (const row of TABLE)
    it(row.name, () => {
      const step = nextStep({ ...EMPTY_PATH_STATE, ...row.state });
      expect(step.id).toBe(row.id);
      expect(step.button.href).toBe(row.href);
      expect(step.sentence.length).toBeGreaterThan(10);
      expect(step.button.label.length).toBeGreaterThan(3);
    });

  it("names the next checklist item when it knows one, and counts otherwise", () => {
    const base = {
      ...EMPTY_PATH_STATE,
      questionnaireDone: true,
      paid: true,
      readySetId: "s",
    };
    expect(
      nextStep({
        ...base,
        checklistLeft: 2,
        nextChecklistTitle: "Workers screened",
      }).sentence,
    ).toBe("Next on your checklist: Workers screened.");
    expect(nextStep({ ...base, checklistLeft: 2 }).sentence).toBe(
      "2 things left on your checklist.",
    );
  });

  it("the blanks sentence handles one and many", () => {
    const base = {
      ...EMPTY_PATH_STATE,
      questionnaireDone: true,
      paid: true,
      readySetId: "s",
    };
    expect(nextStep({ ...base, blanksLeft: 1 }).sentence).toMatch(
      /^One detail/,
    );
    expect(nextStep({ ...base, blanksLeft: 7 }).sentence).toMatch(/^7 details/);
  });
});
