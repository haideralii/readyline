/**
 * Questionnaire answer model (REQ-003 Q1, accepted by the PO).
 * Every object is strict: unknown keys are rejected at the boundary. Free text
 * is limited to the trading name and the optional services note (FR-5).
 * `answersVersion` lets later versions migrate saved drafts (FR-6).
 */
import { z } from "zod";
import { strictObject, text } from "@/lib/validation";
import { isValidAbn, normaliseAbn } from "./abn";

export const STEP_IDS = [
  "business",
  "supports",
  "practices",
  "workforce",
  "existing",
  "result",
] as const;
export type StepId = (typeof STEP_IDS)[number];
export const ANSWER_STEP_IDS = [
  "business",
  "supports",
  "practices",
  "workforce",
  "existing",
] as const;
export type AnswerStepId = (typeof ANSWER_STEP_IDS)[number];

export const ANSWERS_VERSION = 1 as const;

export const State = z.enum([
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "ACT",
  "NT",
]);
export type State = z.infer<typeof State>;

export const BusinessStructureAnswer = z.enum([
  "sole-trader",
  "partnership",
  "company",
  "incorporated-association",
  "trust",
  "other",
]);
export type BusinessStructureAnswer = z.infer<typeof BusinessStructureAnswer>;

export const YesNoUnsure = z.enum(["yes", "no", "not-sure"]);
export type YesNoUnsure = z.infer<typeof YesNoUnsure>;

export const ScreeningAnswer = z.enum([
  "yes",
  "no",
  "not-sure",
  "not-applicable",
]);

export const GroupCode = z
  .string()
  .regex(/^\d{4}$/, "Choose a registration group from the list");

export const ABN_MESSAGE =
  "Enter an 11-digit ABN (for example 51 824 753 556), or leave it blank";

/** Optional ABN: blank is allowed; anything else must be a valid 11-digit ABN. */
export const AbnField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .transform((v) => normaliseAbn(v))
    .refine((v) => isValidAbn(v), { message: ABN_MESSAGE })
    .optional(),
);

export const BusinessStep = strictObject({
  tradingName: text(120, 1),
  structure: BusinessStructureAnswer,
  states: z
    .array(State)
    .min(1, "Choose at least one state or territory")
    .max(8),
  abn: AbnField,
});

export const SilEligibilityAnswer = strictObject({
  fewHoursOnly: z.boolean(),
  participantManagesOwnWorkers: z.boolean(),
});

export const SIL_CODE = "0138";

export const SupportsStep = strictObject({
  groups: z
    .array(GroupCode)
    .min(1, "Choose at least one registration group")
    .max(38),
  silEligibility: SilEligibilityAnswer.optional(),
  servicesNote: text(500).optional(),
}).superRefine((v, ctx) => {
  if (v.groups.includes(SIL_CODE) && !v.silEligibility) {
    ctx.addIssue({
      code: "custom",
      path: ["silEligibility"],
      message: "Answer the two supported independent living questions",
    });
  }
  if (new Set(v.groups).size !== v.groups.length) {
    ctx.addIssue({
      code: "custom",
      path: ["groups"],
      message: "A registration group is listed twice",
    });
  }
});

export const PracticesStep = strictObject({
  restrictivePractices: YesNoUnsure,
});

export const WorkforceStep = strictObject({
  workerCount: z.number().int().min(1, "Count yourself as a worker").max(500),
  keyPersonnelCount: z.number().int().min(1).max(50),
  hasRiskAssessedRoles: z.boolean(),
  allRiskAssessedScreened: ScreeningAnswer,
});

export const ExistingStep = strictObject({
  policies: YesNoUnsure,
  incidentRegister: YesNoUnsure,
  complaintsRegister: YesNoUnsure,
  insuranceCertificate: YesNoUnsure,
  workerInductionRecords: YesNoUnsure,
});

export const STEP_SCHEMAS = {
  business: BusinessStep,
  supports: SupportsStep,
  practices: PracticesStep,
  workforce: WorkforceStep,
  existing: ExistingStep,
} as const;

export const QuestionnaireAnswers = strictObject({
  answersVersion: z.literal(ANSWERS_VERSION),
  business: BusinessStep,
  supports: SupportsStep,
  practices: PracticesStep,
  workforce: WorkforceStep,
  existing: ExistingStep,
});
export type QuestionnaireAnswers = z.infer<typeof QuestionnaireAnswers>;
export type QuestionnaireAnswersInput = z.input<typeof QuestionnaireAnswers>;

/**
 * Same shape, but group codes must exist in the dataset. Used by the server
 * action, which knows the dataset; the client uses QuestionnaireAnswers.
 */
export function answersSchemaFor(knownCodes: ReadonlySet<string>) {
  return QuestionnaireAnswers.superRefine((v, ctx) => {
    v.supports.groups.forEach((code, i) => {
      if (!knownCodes.has(code)) {
        ctx.addIssue({
          code: "custom",
          path: ["supports", "groups", i],
          message: "Unknown registration group",
        });
      }
    });
  });
}

/** What the DraftStore persists: each completed step is fully valid; later steps may be absent (FR-3, SR-4). */
export const QuestionnaireDraft = strictObject({
  answersVersion: z.literal(ANSWERS_VERSION),
  answers: strictObject({
    business: BusinessStep.optional(),
    supports: SupportsStep.optional(),
    practices: PracticesStep.optional(),
    workforce: WorkforceStep.optional(),
    existing: ExistingStep.optional(),
  }),
  currentStep: z.enum(STEP_IDS),
  updatedAt: z.string().datetime(),
});
export type QuestionnaireDraft = z.infer<typeof QuestionnaireDraft>;

export const STEP_FIELDS: Record<AnswerStepId, readonly string[]> = {
  business: ["tradingName", "structure", "states", "abn"],
  supports: ["groups", "silEligibility", "servicesNote"],
  practices: ["restrictivePractices"],
  workforce: [
    "workerCount",
    "keyPersonnelCount",
    "hasRiskAssessedRoles",
    "allRiskAssessedScreened",
  ],
  existing: [
    "policies",
    "incidentRegister",
    "complaintsRegister",
    "insuranceCertificate",
    "workerInductionRecords",
  ],
};

/** Above this many workers the result shows a positioning note (PO review item 1). */
export const LARGE_PROVIDER_THRESHOLD = 25;
