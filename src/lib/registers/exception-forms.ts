/**
 * REQ-024 A2: the forms behind the s 14 exception (FR-4; D-2403, D-2434,
 * D-2439). Every boundary is a strict object; dates are ISO days the owner
 * types; codes are closed lists; a worker is a code and never a name. The
 * server adds what the owner must not choose: the account, the Sydney day
 * the record is made, the pinned procedure version and the register's date.
 */
import { z } from "zod";
import {
  END_CODES,
  EXCEPTION_CODES,
  GATED_CODES,
  PART4_CODES,
} from "./exception-gates";
import { dateField, refField } from "./forms";
import { AU_STATES, DECISION_CODES, REF_PATTERNS } from "./types";
import { strictObject } from "@/lib/validation";

const applicationNumber = z
  .string()
  .trim()
  .min(1, "Enter the application number from the unit's notice")
  .max(40, "The application number is 40 characters at most")
  .regex(/^[A-Za-z0-9 /-]*$/, "Letters, digits, spaces, / and - only");

/** The "record the application" item (FR-4, finding 109): the pending `ndis-worker-screening` row with the number, the state it was submitted in and no issue date. */
export const RecordApplicationForm = strictObject({
  workerRef: refField(REF_PATTERNS.worker, "W-003"),
  applicationNumber,
  state: z.enum(AU_STATES, {
    error: "Choose the state the application was submitted in",
  }),
  verifiedOn: dateField("day you confirmed the application in the database"),
});
export type RecordApplicationValues = z.input<typeof RecordApplicationForm>;

/** Starting the gated exception (FR-4's four lines and five dates, none optional; D-2434). */
export const StartExceptionForm = strictObject({
  workerRef: refField(REF_PATTERNS.worker, "W-003"),
  supervisorRef: refField(REF_PATTERNS.worker, "W-002"),
  verifiedOn: dateField("day you confirmed the application in the database"),
  noticeSeenOn: dateField("day you saw the unit's written notice"),
  startedOn: dateField("day the worker starts under the exception"),
  declarationOn: dateField("day the worker gave the written declaration"),
  /** Gate (iv): the tick as sent; an unticked declaration is the gate's refusal in the Rules' words (s 15(2)(a) and (b)), never a form error (PO 08:10). */
  declaration: z.boolean(),
});
export type StartExceptionValues = z.input<typeof StartExceptionForm>;

/** Ending an exception on one of FR-4's eight codes with the date (D-2434; finding 168). */
export const EndExceptionForm = strictObject({
  exceptionId: z.string().uuid(),
  endCode: z.enum(END_CODES, { error: "Choose how the exception ended" }),
  endedOn: dateField("day it ended"),
});
export type EndExceptionValues = z.input<typeof EndExceptionForm>;

/** The three own-call codes (W-1a; FR-6a): a code and dates, the Part 4 codes with their state (D-2439 as amended). */
export const OWN_CALL_CODES = ["s14-1b", "s14-1c", "s14-2b"] as const;
export const RecordOwnCallForm = strictObject({
  workerRef: refField(REF_PATTERNS.worker, "W-003"),
  code: z.enum(OWN_CALL_CODES, { error: "Choose the exception's code" }),
  part4State: z
    .union([z.literal(""), z.enum(AU_STATES)])
    .transform((v) => (v === "" ? null : v)),
  startedOn: dateField("day it started"),
  endedOn: z
    .union([z.literal(""), dateField("day it ended")])
    .transform((v) => (v === "" ? null : v)),
  endCode: z
    .union([z.literal(""), z.enum(END_CODES)])
    .transform((v) => (v === "" ? null : v)),
}).superRefine((v, ctx) => {
  const part4 = (PART4_CODES as readonly string[]).includes(v.code);
  if (part4 && !v.part4State)
    ctx.addIssue({
      code: "custom",
      path: ["part4State"],
      message:
        "Choose the state whose Part 4 section the arrangement relied on",
    });
  if (!part4 && v.part4State)
    ctx.addIssue({
      code: "custom",
      path: ["part4State"],
      message: "A state applies to the two Part 4 codes alone",
    });
  if ((v.endedOn === null) !== (v.endCode === null))
    ctx.addIssue({
      code: "custom",
      path: ["endedOn"],
      message: "An end needs both the date and how it ended",
    });
  if (v.endedOn && v.endedOn < v.startedOn)
    ctx.addIssue({
      code: "custom",
      path: ["endedOn"],
      message: "The end cannot be before the start",
    });
});
export type RecordOwnCallValues = z.input<typeof RecordOwnCallForm>;

/** A unit's decision typed on the clearance row (D-2413): a closed code and its date. */
export const RecordDecisionForm = strictObject({
  clearanceId: z.string().uuid(),
  decisionCode: z.enum(DECISION_CODES, {
    error: "Choose the unit's decision",
  }),
  decisionOn: dateField("day of the decision"),
});
export type RecordDecisionValues = z.input<typeof RecordDecisionForm>;

/** "Update the procedure" (FR-4a, finding 192): the set whose procedure takes the register's rows. */
export const UpdateProcedureForm = strictObject({
  setId: z.string().uuid(),
});

export const EXCEPTION_CODE_LABELS: Record<
  (typeof EXCEPTION_CODES)[number],
  string
> = {
  "s14-1a":
    "s 14(1)(a): in the process of obtaining a clearance, supervised, under our Division 3 plan",
  "s14-1b":
    "s 14(1)(b): a Part 4 transitional arrangement (ended; past rows only)",
  "s14-1c": "s 14(1)(c): a supervised secondary-school student",
  "s14-2a":
    "s 14(2)(a): the provider's own pending clearance, supervised by a person with a clearance",
  "s14-2b":
    "s 14(2)(b): the provider's own Part 4 arrangement (ended; past rows only)",
};

export const GATED = GATED_CODES;
