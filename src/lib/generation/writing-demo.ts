/**
 * Scripted statuses for the writing indicator's test page (REQ-021; fake
 * mode only, like the fake Checkout page): every scenario the REQ lists,
 * computed from a start time and the clock so Playwright can watch the
 * phases without a model, a database or a job. Pure.
 */
import { documentTypeById } from "@/lib/generator/catalogue";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { auditOrder } from "@/lib/generator/set-order";
import type { WritingStatus } from "./writing-state";

const SELF_ASSESSMENT_ID = "practice-standards-self-assessment";

/** The clock for the demo page's first render; a server component renders once per request, so this is read there rather than in a hook. */
export function demoClock(): number {
  return Date.now();
}

/** The sole-trader reference set's documents by canonical title, in set order: the demo's list. */
export function demoDocuments(): { typeId: string; title: string }[] {
  const sole = loadReferenceCases().find(
    (c) => c.id === "verification-sole-trader",
  )!;
  return auditOrder([
    ...sole.result.documents.map((d) => d.id),
    SELF_ASSESSMENT_ID,
  ]).map((typeId) => ({
    typeId,
    title: documentTypeById(typeId)?.title ?? typeId,
  }));
}

export const DEMO_SCENARIOS = [
  "happy",
  "quiet",
  "long",
  "steady",
  "failed",
  "ready",
  "offline",
  "preparing",
] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

/** Seconds per phase in the happy path; short, so a test sees every phase. */
export const DEMO_TIMING = {
  preparingS: 2,
  writingS: 4,
  checkingS: 1,
  assemblingS: 1,
} as const;
const DOCUMENT_S =
  DEMO_TIMING.writingS + DEMO_TIMING.checkingS + DEMO_TIMING.assemblingS;

export function demoStatus(input: {
  scenario: DemoScenario;
  documents: { typeId: string; title: string }[];
  t0: number;
  now: number;
}): WritingStatus {
  const { scenario, documents, t0, now } = input;
  const total = documents.length;
  const base = {
    total,
    failed: [],
    usualMinutes: 15,
    serverTime: new Date(now).toISOString(),
    readySetId: null,
    nextStep: null,
  };
  const list = (
    done: number,
    currentIndex: number | null,
    failedIds: string[] = [],
  ) =>
    documents.map((d, i) => ({
      ...d,
      state: failedIds.includes(d.typeId)
        ? ("failed" as const)
        : i < done
          ? ("written" as const)
          : i === currentIndex
            ? ("current" as const)
            : ("waiting" as const),
    }));
  if (scenario === "ready")
    return {
      ...base,
      phase: "ready",
      done: total,
      currentDocument: null,
      currentSection: 0,
      sectionCount: 0,
      lastProgressAt: new Date(now - 60_000).toISOString(),
      documents: list(total, null),
      readySetId: "demo-set",
      nextStep: {
        label: "Finish your pack (3 blanks to fill)",
        href: "/documents",
      },
    };
  if (scenario === "preparing")
    return {
      ...base,
      phase: "preparing",
      done: 0,
      currentDocument: null,
      currentSection: 0,
      sectionCount: 0,
      lastProgressAt: new Date(now - 1000).toISOString(),
      documents: list(0, null),
    };
  if (scenario === "failed") {
    const failedIds = [documents[1]?.typeId ?? documents[0].typeId];
    return {
      ...base,
      phase: "attention",
      done: total - 1,
      failed: failedIds.map((typeId) => ({
        typeId,
        title: documents.find((d) => d.typeId === typeId)?.title ?? typeId,
        kind: "error" as const,
      })),
      currentDocument: null,
      currentSection: 0,
      sectionCount: 0,
      lastProgressAt: new Date(now - 5000).toISOString(),
      documents: list(total, null, failedIds),
    };
  }
  // D-2006 (batch 45): a feed that stays in Writing with fresh progress for
  // as long as a test needs, so the animation's cost can be measured over
  // ten seconds (the happy script's Writing phase lasts four).
  if (scenario === "steady") {
    return {
      ...base,
      phase: "writing",
      done: 1,
      currentDocument: { ...documents[1], position: 2 },
      currentSection: 1 + (Math.floor((now - t0) / 3000) % 6),
      sectionCount: 6,
      lastProgressAt: new Date(now).toISOString(),
      documents: list(1, 1),
    };
  }
  if (scenario === "quiet" || scenario === "long") {
    const ago = scenario === "quiet" ? 95_000 : 6 * 60_000;
    return {
      ...base,
      phase: "writing",
      done: 1,
      currentDocument: { ...documents[1], position: 2 },
      currentSection: 3,
      sectionCount: 6,
      lastProgressAt: new Date(now - ago).toISOString(),
      documents: list(1, 1),
    };
  }
  // happy (and offline, whose route answers 503 instead of this): phases advance with the clock.
  const elapsed = Math.max(0, (now - t0) / 1000);
  if (elapsed < DEMO_TIMING.preparingS)
    return {
      ...base,
      phase: "preparing",
      done: 0,
      currentDocument: null,
      currentSection: 0,
      sectionCount: 0,
      lastProgressAt: new Date(now).toISOString(),
      documents: list(0, null),
    };
  const since = elapsed - DEMO_TIMING.preparingS;
  const index = Math.floor(since / DOCUMENT_S);
  if (index >= total)
    return {
      ...base,
      phase: "ready",
      done: total,
      currentDocument: null,
      currentSection: 0,
      sectionCount: 0,
      lastProgressAt: new Date(now).toISOString(),
      documents: list(total, null),
      readySetId: "demo-set",
      nextStep: {
        label: "Finish your pack (3 blanks to fill)",
        href: "/documents",
      },
    };
  const within = since - index * DOCUMENT_S;
  const sectionCount = 6;
  const phase =
    within < DEMO_TIMING.writingS
      ? "writing"
      : within < DEMO_TIMING.writingS + DEMO_TIMING.checkingS
        ? "checking"
        : "assembling";
  return {
    ...base,
    phase,
    done: index,
    currentDocument: { ...documents[index], position: index + 1 },
    currentSection:
      phase === "writing"
        ? Math.min(
            sectionCount,
            1 + Math.floor((within / DEMO_TIMING.writingS) * sectionCount),
          )
        : 0,
    sectionCount: phase === "writing" ? sectionCount : 0,
    lastProgressAt: new Date(now).toISOString(),
    documents: list(index, index),
  };
}
