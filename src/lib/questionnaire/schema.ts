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
    .string({ error: ABN_MESSAGE })
    .transform((v) => normaliseAbn(v))
    .refine((v) => isValidAbn(v), { message: ABN_MESSAGE })
    .optional(),
);

export const BusinessStep = strictObject({
  tradingName: text(120, 1, "Enter your trading name"),
  structure: z.enum(BusinessStructureAnswer.options, {
    error: "Choose your business structure",
  }),
  states: z
    .array(z.enum(State.options, { error: "Choose states from the list" }), {
      error: "Choose at least one state or territory",
    })
    .min(1, "Choose at least one state or territory")
    .max(8),
  abn: AbnField,
});

export const SilEligibilityAnswer = strictObject({
  fewHoursOnly: z.boolean({ error: "Choose yes or no" }),
  participantManagesOwnWorkers: z.boolean({ error: "Choose yes or no" }),
});

export const SIL_CODE = "0138";

export const SupportsStep = strictObject({
  groups: z
    .array(GroupCode, { error: "Choose at least one registration group" })
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

/**
 * REQ-013 FR-4: when a provider is not sure, three plain yes/no questions
 * resolve the answer. Present only with "not-sure"; any "yes" resolves to
 * yes (and the result says so), all "no" resolves to no.
 */
export const NotSureHelper = strictObject({
  locksOrBarriers: z.boolean({ error: "Choose yes or no" }),
  holdsOrRestraint: z.boolean({ error: "Choose yes or no" }),
  medicationForBehaviour: z.boolean({ error: "Choose yes or no" }),
});
export type NotSureHelper = z.infer<typeof NotSureHelper>;

export function resolveRestrictivePractices(
  answer: YesNoUnsure,
  helper?: NotSureHelper,
): { uses: boolean; assumed: boolean } {
  if (answer === "yes") return { uses: true, assumed: false };
  if (answer === "no") return { uses: false, assumed: false };
  if (!helper) return { uses: true, assumed: true };
  const uses =
    helper.locksOrBarriers ||
    helper.holdsOrRestraint ||
    helper.medicationForBehaviour;
  return { uses, assumed: uses };
}

export const PracticesStep = strictObject({
  restrictivePractices: z.enum(YesNoUnsure.options, {
    error: "Choose yes, no or not sure",
  }),
  notSureHelper: NotSureHelper.optional(),
}).superRefine((v, ctx) => {
  if (v.notSureHelper && v.restrictivePractices !== "not-sure") {
    ctx.addIssue({
      code: "custom",
      path: ["notSureHelper"],
      message: "The three helper questions apply only when you are not sure",
    });
  }
});

export const WorkforceStep = strictObject({
  workerCount: z
    .number({ error: "Enter the number of workers, counting yourself" })
    .int("Enter a whole number of workers")
    .min(1, "Count yourself as a worker")
    .max(500, "Enter 500 or fewer workers"),
  keyPersonnelCount: z
    .number({ error: "Enter the number of key personnel" })
    .int("Enter a whole number of key personnel")
    .min(1, "Enter at least 1 key person")
    .max(50, "Enter 50 or fewer key personnel"),
  hasRiskAssessedRoles: z.boolean({ error: "Choose yes or no" }),
  allRiskAssessedScreened: z.enum(ScreeningAnswer.options, {
    error: "Choose an answer about worker screening",
  }),
});

const HaveAnswer = z.enum(YesNoUnsure.options, {
  error: "Choose yes, no or not sure",
});
export const ExistingStep = strictObject({
  policies: HaveAnswer,
  incidentRegister: HaveAnswer,
  complaintsRegister: HaveAnswer,
  insuranceCertificate: HaveAnswer,
  workerInductionRecords: HaveAnswer,
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
