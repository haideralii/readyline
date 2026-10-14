/**
 * The guided path's one question, "What do I do now?" (REQ-017 FR-1, D-1701):
 * a pure function from the account's state to one sentence and one button.
 * The state table is ordered: the first condition that holds is the step,
 * so the strip never shows two things. The server gathers the state; the
 * unit test walks every row (AC-3).
 */
export type PathState = {
  /** The questionnaire is complete and a result exists. */
  questionnaireDone: boolean;
  /** An unrevoked pack entitlement exists. */
  paid: boolean;
  /** The pack is being drafted (queued or running job, no ready set). */
  generating: boolean;
  /** A ready set exists; null otherwise. */
  readySetId: string | null;
  /** Blanks still unfilled in the ready set. */
  blanksLeft: number;
  /** Document groups (of the four plus the rest) not yet adopted. */
  groupsToAdopt: number;
  /** Checklist items not yet Done. */
  checklistLeft: number;
  /** The next checklist item's title, when any is left. */
  nextChecklistTitle: string | null;
  /** The registration date is on the account. */
  registrationDateSet: boolean;
};

export type NextStep = {
  id:
    | "questionnaire"
    | "buy"
    | "wait"
    | "finish"
    | "adopt"
    | "checklist"
    | "registration-date"
    | "audit-day";
  sentence: string;
  button: { label: string; href: string };
};

export const EMPTY_PATH_STATE: PathState = {
  questionnaireDone: false,
  paid: false,
  generating: false,
  readySetId: null,
  blanksLeft: 0,
  groupsToAdopt: 0,
  checklistLeft: 0,
  nextChecklistTitle: null,
  registrationDateSet: false,
};

export function nextStep(s: PathState): NextStep {
  if (!s.questionnaireDone)
    return {
      id: "questionnaire",
      sentence: "Tell us about your supports and workers to get started.",
      button: { label: "Start the questionnaire", href: "/start" },
    };
  if (!s.paid)
    return {
      id: "buy",
      sentence: "Your result is ready. Your documents are the next step.",
      button: { label: "Get my documents", href: "/path/before-you-buy" },
    };
  if (s.generating || !s.readySetId)
    return {
      id: "wait",
      sentence:
        "We are drafting your documents. You can close this page and come back in about 20 minutes.",
      button: { label: "See the progress", href: "/documents" },
    };
  if (s.blanksLeft > 0)
    return {
      id: "finish",
      sentence:
        s.blanksLeft === 1
          ? "One detail to fill in, then your documents are complete."
          : `${s.blanksLeft} details to fill in, then your documents are complete.`,
      button: {
        label: "Finish my pack",
        href: `/documents/${s.readySetId}/finish`,
      },
    };
  if (s.groupsToAdopt > 0)
    return {
      id: "adopt",
      sentence:
        "Your documents are complete. Read each group and make them your policies.",
      button: { label: "Adopt my documents", href: "/path/adopt" },
    };
  if (s.checklistLeft > 0)
    return {
      id: "checklist",
      sentence: s.nextChecklistTitle
        ? `Next on your checklist: ${s.nextChecklistTitle}.`
        : `${s.checklistLeft} things left on your checklist.`,
      button: { label: "Open my checklist", href: "/checklist" },
    };
  if (!s.registrationDateSet)
    return {
      id: "registration-date",
      sentence:
        "Once the Commission registers you, tell us the date so we can count down to your mid-term audit.",
      button: { label: "Add my registration date", href: "/account" },
    };
  return {
    id: "audit-day",
    sentence: "You are ready. Print your audit-day page and keep it handy.",
    button: { label: "Open my audit-day page", href: "/path/audit-day" },
  };
}
