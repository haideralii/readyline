import { describe, expect, it } from "vitest";
import {
  LONG_AFTER_MS,
  QUIET_AFTER_MS,
  awaySentence,
  counterLine,
  isMoving,
  liveText,
  phaseFromJob,
  phaseLine,
  quietState,
  statusFromJob,
  usualMinutesFrom,
  type JobSnapshot,
  type WritingStatus,
} from "./writing-state";

/**
 * REQ-021 state mapping: every job state to a phase and its words, the
 * quiet-feed rule, the away sentence and the usual-time rule (D-2101).
 */
const T0 = Date.parse("2026-10-14T10:00:00.000Z");
const SET = [
  { typeId: "governance-policy", title: "Governance policy" },
  {
    typeId: "complaints-management-policy-and-register",
    title: "Complaints management policy and register",
  },
  {
    typeId: "practice-standards-self-assessment",
    title: "Practice Standards self-assessment",
  },
];

function job(over: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    status: "running",
    phase: "writing",
    nextDocumentIndex: 1,
    documentTotal: 3,
    currentDocumentTypeId: SET[1].typeId,
    currentSectionIndex: 3,
    sectionCount: 6,
    lastProgressAt: new Date(T0).toISOString(),
    versionSetId: "set-1",
    failedDocuments: [],
    ...over,
  };
}

function status(over: Partial<JobSnapshot> = {}): WritingStatus {
  return statusFromJob({
    job: job(over),
    setDocuments: SET,
    nextStep: { label: "Finish your pack", href: "/documents/set-1/finish" },
    usualMinutes: null,
    serverTime: new Date(T0).toISOString(),
  });
}

describe("phase mapping (every job state)", () => {
  it.each([
    [job({ status: "queued", phase: null, nextDocumentIndex: 0 }), "preparing"],
    [job({ status: "running", phase: "preparing" }), "preparing"],
    [job({ status: "running", phase: "writing" }), "writing"],
    [job({ status: "running", phase: "checking" }), "checking"],
    [job({ status: "running", phase: "assembling" }), "assembling"],
    [job({ status: "queued", phase: "writing" }), "writing"],
    [job({ status: "ready", phase: "ready" }), "ready"],
    [job({ status: "ready", phase: "writing" }), "ready"],
    [job({ status: "failed", phase: "writing" }), "delayed"],
    [job({ status: "attention", phase: "attention" }), "attention"],
    [job({ status: "running", phase: "something-new" }), "preparing"],
  ] as const)("maps %o to %s", (j, phase) => {
    expect(phaseFromJob(j)).toBe(phase);
  });
});

describe("the words", () => {
  it("writes the document and section line with the canonical title and 1-based numbers", () => {
    const s = status();
    expect(phaseLine(s, "live")).toBe(
      "Writing document 2 of 3: Complaints management policy and register, section 3 of 6.",
    );
    expect(counterLine(s)).toBe("1 of 3 written.");
    // The live region never carries the section number (S10).
    expect(liveText(s, "live")).toBe(
      "1 of 3 written. Writing document 2 of 3: Complaints management policy and register.",
    );
  });

  it("has one line per phase, and the ready line counts the whole set", () => {
    expect(
      phaseLine(
        status({ status: "queued", phase: null, nextDocumentIndex: 0 }),
        "live",
      ),
    ).toBe("Getting your answers ready.");
    expect(phaseLine(status({ phase: "checking" }), "live")).toBe(
      "Checking it against our rules.",
    );
    expect(phaseLine(status({ phase: "assembling" }), "live")).toBe(
      "Putting your files together.",
    );
    const ready = status({
      status: "ready",
      phase: "ready",
      nextDocumentIndex: 3,
    });
    expect(phaseLine(ready, "live")).toBe("Your 3 documents are ready.");
    expect(counterLine(ready)).toBe("3 of 3 written.");
    expect(ready.readySetId).toBe("set-1");
    expect(ready.nextStep?.label).toBe("Finish your pack");
    expect(ready.documents.every((d) => d.state === "written")).toBe(true);
    expect(phaseLine(status({ status: "failed" }), "live")).toMatch(
      /taking longer than usual/,
    );
  });

  it("never names the model, fallbacks or lints", () => {
    const all: string[] = [];
    for (const over of [
      { status: "queued", phase: null, nextDocumentIndex: 0 },
      { phase: "writing" },
      { phase: "checking" },
      { phase: "assembling" },
      { status: "ready", phase: "ready" },
      { status: "failed" },
      {
        status: "attention",
        failedDocuments: [{ typeId: SET[0].typeId, kind: "error" }],
      },
    ] as Partial<JobSnapshot>[])
      for (const q of ["live", "quiet", "long"] as const) {
        const s = status(over);
        all.push(phaseLine(s, q), counterLine(s), liveText(s, q));
      }
    expect(all.join("\n")).not.toMatch(/model|fallback|lint|Claude|AI\b/i);
  });

  it("splits the counter when a document needs another go (S4) and lists it as failed", () => {
    const s = status({
      status: "attention",
      phase: "attention",
      nextDocumentIndex: 3,
      failedDocuments: [{ typeId: SET[1].typeId, kind: "error" }],
    });
    expect(counterLine(s)).toBe("2 written, 1 needs another go, 0 waiting.");
    expect(phaseLine(s, "live")).toBe(
      "1 document needs another go. The rest are written.",
    );
    expect(s.failed).toEqual([
      { typeId: SET[1].typeId, kind: "error", title: SET[1].title },
    ]);
    expect(s.documents.map((d) => d.state)).toEqual([
      "written",
      "failed",
      "written",
    ]);
    expect(s.readySetId).toBeNull();
    // Mid-run with a failure behind it: the counter still adds up to the total.
    const mid = status({
      nextDocumentIndex: 2,
      failedDocuments: [{ typeId: SET[0].typeId, kind: "degraded" }],
    });
    expect(counterLine(mid)).toBe("1 written, 1 needs another go, 1 waiting.");
  });

  it("the document list shows written, current and waiting in set order (S1)", () => {
    expect(status().documents.map((d) => d.state)).toEqual([
      "written",
      "current",
      "waiting",
    ]);
    expect(
      status({
        status: "queued",
        phase: null,
        nextDocumentIndex: 0,
        currentDocumentTypeId: null,
      }).documents.map((d) => d.state),
    ).toEqual(["waiting", "waiting", "waiting"]);
  });
});

describe("the quiet feed (S3)", () => {
  it("is live under 90 seconds, quiet from 90 seconds, long from 5 minutes, and never quiet once finished", () => {
    const s = status();
    expect(quietState(s, T0 + QUIET_AFTER_MS - 1)).toBe("live");
    expect(quietState(s, T0 + QUIET_AFTER_MS)).toBe("quiet");
    expect(quietState(s, T0 + LONG_AFTER_MS)).toBe("long");
    expect(
      quietState(
        status({ status: "ready", phase: "ready" }),
        T0 + LONG_AFTER_MS,
      ),
    ).toBe("live");
    expect(
      quietState(status({ lastProgressAt: null }), T0 + LONG_AFTER_MS),
    ).toBe("live");
  });

  it("moves only while progress is arriving", () => {
    const s = status();
    expect(isMoving(s, T0 + 10_000)).toBe(true);
    expect(isMoving(s, T0 + QUIET_AFTER_MS)).toBe(false);
    expect(isMoving(status({ status: "ready", phase: "ready" }), T0)).toBe(
      false,
    );
    expect(
      isMoving(status({ status: "attention", phase: "attention" }), T0),
    ).toBe(false);
  });

  it("says so in the words, naming the document", () => {
    const s = status();
    expect(phaseLine(s, "quiet")).toBe(
      "Still working on Complaints management policy and register; this one is taking longer.",
    );
    expect(phaseLine(s, "long")).toMatch(
      /^Taking longer than usual\. You can close this page/,
    );
  });
});

describe("coming back (S2) and the usual time (S12)", () => {
  it("tells the provider what happened while the page was hidden", () => {
    expect(awaySentence(1, status())).toBeNull();
    expect(awaySentence(0, status())).toBe(
      "While you were away we wrote 1 more; 1 of 3 done.",
    );
    expect(
      awaySentence(
        1,
        status({ status: "ready", phase: "ready", nextDocumentIndex: 3 }),
      ),
    ).toBe("While you were away we finished the rest; all 3 are done.");
  });

  it("gives the median of the last 50 packs rounded up to 5 minutes, and nothing under 20 packs", () => {
    expect(usualMinutesFrom(Array(19).fill(12 * 60_000))).toBeNull();
    expect(usualMinutesFrom(Array(20).fill(12 * 60_000))).toBe(15);
    expect(usualMinutesFrom(Array(20).fill(4 * 60_000))).toBe(5);
    const many = [
      ...Array(50).fill(3 * 60_000),
      ...Array(50).fill(60 * 60_000),
    ];
    // Sorted ascending and cut to 50: the fast half decides.
    expect(usualMinutesFrom(many)).toBe(5);
  });
});
