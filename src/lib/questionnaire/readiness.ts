/**
 * What the ready line shows for a result (REQ-014 motif): done is what the
 * provider said they have, to prepare is what they said they lack or were
 * unsure about, the remainder is what the questionnaire did not ask.
 */
import type { QuestionnaireResult } from "./result";

export type ReadinessCounts = {
  done: number;
  toPrepare: number;
  remainder: number;
};

export function readinessCounts(r: QuestionnaireResult): ReadinessCounts {
  const items = [...r.documents, ...r.registers];
  return {
    done: items.filter((i) => i.have === "yes").length,
    toPrepare: items.filter((i) => i.have === "no" || i.have === "not-sure")
      .length,
    remainder: items.filter((i) => i.have === "unknown").length,
  };
}
