/**
 * Copy for the restrictive practices step (REQ-013 FR-4, R-4). Kept apart
 * from the component so a unit test can check that the three helper
 * questions between them cover the Commission's five regulated practices
 * (seclusion, chemical, mechanical, physical, environmental) in plain words.
 */
import type { NotSureHelper } from "@/lib/questionnaire/schema";

export const EXAMPLES = [
  "locking a cupboard, door or gate to stop someone getting something or going somewhere, or shutting someone in their room until they calm down",
  "holding someone, or using a belt or strap, to stop them moving",
  "medicine given mainly to control behaviour",
] as const;

export const HELPER: {
  key: keyof NotSureHelper;
  legend: string;
  help: string;
  /** Which of the Commission's regulated practices this question covers. */
  covers: readonly (
    "seclusion" | "environmental" | "mechanical" | "physical" | "chemical"
  )[];
}[] = [
  {
    key: "locksOrBarriers",
    legend:
      "Do you ever lock a cupboard, fridge, door or gate so a person cannot get to something or somewhere, or keep a person alone in a room they cannot leave?",
    help: "For example locking the kitchen at night, a gate they cannot open, or shutting someone in their room until they calm down.",
    covers: ["environmental", "seclusion"],
  },
  {
    key: "holdsOrRestraint",
    legend:
      "Do you ever hold a person, or use a belt, strap or similar, to stop them moving?",
    help: "For example holding someone's arms during a care task, or a lap belt they cannot undo.",
    covers: ["physical", "mechanical"],
  },
  {
    key: "medicationForBehaviour",
    legend:
      "Does a person you support take medicine mainly to control their behaviour, rather than for a health condition?",
    help: "If you are not sure why a medicine is given, their doctor or behaviour support practitioner can tell you.",
    covers: ["chemical"],
  },
];
