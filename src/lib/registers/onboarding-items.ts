/**
 * The two onboarding checklists (REQ-018 FR-9; D-1904), in the same
 * instruction voice as the readiness checklist: what to do, where to
 * record it. Each item is ticked with the date and who ticked it; a
 * complete checklist is the "signed and dated" evidence an auditor asks
 * for. The worker checklist's completion sets the staff matrix's
 * onboarding date. Pure data; the copy lint runs over every line.
 */
import type { OnboardingKind } from "./audit-day-types";

export type OnboardingItem = { id: string; text: string };

export const WORKER_ONBOARDING_ITEMS: OnboardingItem[] = [
  {
    id: "identity-and-agreement",
    text: "Check the worker's identity and sign the employment or contractor agreement; file both.",
  },
  {
    id: "screening-clearance-seen",
    text: "See the NDIS Worker Screening clearance, or supervise the worker until it arrives, and type its expiry into the worker checks register.",
  },
  {
    id: "other-checks-recorded",
    text: "Type any Working with Children check, first aid, manual handling or medication training into the worker checks register with its expiry.",
  },
  {
    id: "orientation-module",
    text: "Ask the worker to finish the NDIS Worker Orientation Module and keep the certificate.",
  },
  {
    id: "policies-walked-through",
    text: "Walk the worker through the Code of Conduct, incident, complaints, privacy and safeguarding policies, and have them sign the acknowledgement.",
  },
  {
    id: "participant-plans-read",
    text: "Have the worker read the support plan and the risk row for each participant they will support.",
  },
  {
    id: "emergency-plan-shown",
    text: "Show the worker the emergency and disaster plan and where the first aid kit is.",
  },
  {
    id: "supervision-booked",
    text: "Book the first supervision for within a month and type the date into the staff matrix.",
  },
];

export const PARTICIPANT_ONBOARDING_ITEMS: OnboardingItem[] = [
  {
    id: "service-agreement-signed",
    text: "Go through the service agreement in plain words and have the participant or their representative sign it.",
  },
  {
    id: "consent-recorded",
    text: "Record consent to collect and use personal information, and to any recording, on the consent form.",
  },
  {
    id: "support-plan-written",
    text: "Write the support plan with the participant's goals and set its review date in the participant risk register.",
  },
  {
    id: "risk-row-added",
    text: "Add the participant's row to the participant risk register, by code, with what you do about each risk.",
  },
  {
    id: "medical-emergency-list",
    text: "Write the participant's medical emergency list with the agreed action for each item, and keep it with their plan.",
  },
  {
    id: "rights-and-complaints-explained",
    text: "Explain the participant's rights, how to complain to you and to the Commission, and give them the written version.",
  },
  {
    id: "workers-introduced",
    text: "Introduce the workers who will support them and note any preferences about who comes.",
  },
];

export function onboardingItemsFor(kind: OnboardingKind): OnboardingItem[] {
  return kind === "worker"
    ? WORKER_ONBOARDING_ITEMS
    : PARTICIPANT_ONBOARDING_ITEMS;
}
