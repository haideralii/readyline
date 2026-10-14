/**
 * The writing indicator's state (REQ-021, D-2101): a pure mapping from what
 * the server reports about the pack job to the five phases the provider
 * sees, the words for each, the quiet-feed rule and the "while you were
 * away" sentence. No timers live here; the component evaluates these on
 * every poll with the clock it is given, so every label maps to a real job
 * state and the animation moves only while progress is arriving.
 */

export type WritingPhase =
  | "preparing"
  | "writing"
  | "checking"
  | "assembling"
  | "ready"
  /** One or more documents need another go (S4); the rest are written. */
  | "attention"
  /** The job gave up (REQ-007: the page says "taking longer", never an error code). */
  | "delayed";

export type FailedDocument = {
  typeId: string;
  title: string;
  /** error: nothing was written for it; degraded: written, but with too many generic sections. */
  kind: "error" | "degraded";
};

/** What the status endpoint returns and the component renders; a pure value. */
export type WritingStatus = {
  phase: WritingPhase;
  /** Documents written (counted after assembling), failed and waiting; written + failed + waiting = total. */
  done: number;
  total: number;
  failed: FailedDocument[];
  /** The document in flight, by its canonical title, and its 1-based position in the set. */
  currentDocument: { typeId: string; title: string; position: number } | null;
  /** 1-based section in flight and the document's tailored section count; 0 when not writing. */
  currentSection: number;
  sectionCount: number;
  /** ISO time of the last progress the server recorded, or null before the job starts. */
  lastProgressAt: string | null;
  /** The set's documents in set order with their state, for the list below the counter. */
  documents: {
    typeId: string;
    title: string;
    state: "written" | "current" | "waiting" | "failed";
  }[];
  /** When ready: the guided path's next step and the set to download. */
  readySetId: string | null;
  nextStep: { label: string; href: string } | null;
  /** S12: the measured usual time, rounded up to 5 minutes, or null until 20 packs exist. */
  usualMinutes: number | null;
  /** The server's clock when the status was built, so pause detection does not trust the browser's clock. */
  serverTime: string;
};

/** S3: no progress for this long pauses the animation and says so. */
export const QUIET_AFTER_MS = 90_000;
/** S3: and after this long the line says the provider can close the page. */
export const LONG_AFTER_MS = 5 * 60_000;
/** S7: status requests that fail in a row before the page says it cannot reach the server. */
export const OFFLINE_AFTER_FAILURES = 3;

export type Quiet = "live" | "quiet" | "long";

/** How quiet the feed is, from the last progress time and the clock; a finished or failed job is never "quiet". */
export function quietState(
  status: Pick<WritingStatus, "phase" | "lastProgressAt">,
  now: number,
): Quiet {
  if (
    status.phase === "ready" ||
    status.phase === "attention" ||
    status.phase === "delayed"
  )
    return "live";
  if (!status.lastProgressAt) return "live";
  const since = now - Date.parse(status.lastProgressAt);
  if (since >= LONG_AFTER_MS) return "long";
  if (since >= QUIET_AFTER_MS) return "quiet";
  return "live";
}

/** The animation runs only while progress is arriving (S3, S6, S9 handled by CSS). */
export function isMoving(
  status: Pick<WritingStatus, "phase" | "lastProgressAt">,
  now: number,
): boolean {
  if (
    status.phase === "ready" ||
    status.phase === "attention" ||
    status.phase === "delayed"
  )
    return false;
  return quietState(status, now) === "live";
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** The phase line (the words beside the icon), one per phase and quiet state. */
export function phaseLine(status: WritingStatus, quiet: Quiet): string {
  const doc = status.currentDocument;
  switch (status.phase) {
    case "preparing":
      return "Getting your answers ready.";
    case "writing":
      if (quiet === "long")
        return "Taking longer than usual. You can close this page; we keep going and the documents page will show the result.";
      if (quiet === "quiet")
        return doc
          ? `Still working on ${doc.title}; this one is taking longer.`
          : "Still working; this one is taking longer.";
      return doc
        ? `Writing document ${doc.position} of ${status.total}: ${doc.title}${status.sectionCount > 0 ? `, section ${Math.max(1, status.currentSection)} of ${status.sectionCount}` : ""}.`
        : "Writing your documents.";
    case "checking":
      return quiet === "live"
        ? "Checking it against our rules."
        : doc
          ? `Still checking ${doc.title}; this one is taking longer.`
          : "Still checking; this one is taking longer.";
    case "assembling":
      return quiet === "live"
        ? "Putting your files together."
        : "Still putting your files together; this one is taking longer.";
    case "ready":
      return `Your ${status.total} documents are ready.`;
    case "attention": {
      const n = status.failed.length;
      return `${n} ${plural(n, "document needs", "documents need")} another go. The rest are written.`;
    }
    case "delayed":
      return "This is taking longer than usual. You do not need to do anything; come back later and your documents will be here.";
  }
}

/** The counter line above the phase line; the aria-live region reads this and the phase, never the section. */
export function counterLine(status: WritingStatus): string {
  const waiting = Math.max(
    0,
    status.total - status.done - status.failed.length,
  );
  if (status.phase === "ready")
    return `${status.total} of ${status.total} written.`;
  if (status.failed.length > 0)
    return `${status.done} written, ${status.failed.length} ${plural(status.failed.length, "needs", "need")} another go, ${waiting} waiting.`;
  return `${status.done} of ${status.total} written.`;
}

/** The text the aria-live region announces: changes when a document completes or the phase changes, not per section (S10). */
export function liveText(status: WritingStatus, quiet: Quiet): string {
  const doc = status.currentDocument;
  const where =
    status.phase === "writing" && doc && quiet === "live"
      ? `Writing document ${doc.position} of ${status.total}: ${doc.title}.`
      : phaseLine(status, quiet);
  return `${counterLine(status)} ${where}`;
}

/** S2: the sentence for a provider who comes back after the page was hidden. */
export function awaySentence(
  doneBefore: number,
  status: WritingStatus,
): string | null {
  const more = status.done - doneBefore;
  if (more <= 0) return null;
  if (status.phase === "ready")
    return `While you were away we finished the rest; all ${status.total} are done.`;
  return `While you were away we wrote ${more} more; ${status.done} of ${status.total} done.`;
}

/** The Ready screen's next step and warm line (S5, AC-3). */
export const READY_WARM_LINE =
  "Take your time with the next step; nothing is lost if you close this page.";
export const RECONNECTING_LINE =
  "We cannot reach the server right now; your pack keeps being written.";
export const USUAL_TIME_LINE = (minutes: number, documents: number) =>
  `Usually about ${minutes} minutes for ${documents} documents.`;

/** S12: the usual time from the last packs' durations: the median, in minutes, rounded up to the nearest 5; null until 20 packs. */
export function usualMinutesFrom(
  durationsMs: readonly number[],
): number | null {
  const valid = durationsMs.filter((d) => Number.isFinite(d) && d > 0);
  if (valid.length < 20) return null;
  const sorted = [...valid].sort((a, b) => a - b).slice(0, 50);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.max(5, Math.ceil(median / 60_000 / 5) * 5);
}

/** The job row's fields the mapping needs; the server fills them from `generation_jobs` (D-2101). */
export type JobSnapshot = {
  status: "queued" | "running" | "ready" | "failed" | "attention";
  phase: string | null;
  nextDocumentIndex: number;
  documentTotal: number | null;
  currentDocumentTypeId: string | null;
  currentSectionIndex: number;
  sectionCount: number;
  lastProgressAt: string | null;
  versionSetId: string | null;
  failedDocuments: { typeId: string; kind: "error" | "degraded" }[];
};

/** Maps the job row to the phase; `queued` before any progress is "preparing", a finished job is "ready" even if its phase column lags. */
export function phaseFromJob(job: JobSnapshot): WritingPhase {
  if (job.status === "ready") return "ready";
  if (job.status === "failed") return "delayed";
  if (job.status === "attention") return "attention";
  switch (job.phase) {
    case "writing":
    case "checking":
    case "assembling":
      return job.phase;
    default:
      return "preparing";
  }
}

/** Builds the status from the job row and the set's document list (titles in set order). */
export function statusFromJob(input: {
  job: JobSnapshot;
  setDocuments: { typeId: string; title: string }[];
  nextStep: { label: string; href: string } | null;
  usualMinutes: number | null;
  serverTime: string;
}): WritingStatus {
  const { job, setDocuments } = input;
  const phase = phaseFromJob(job);
  const total = job.documentTotal ?? setDocuments.length;
  const failedIds = new Set(job.failedDocuments.map((f) => f.typeId));
  const titleOf = (typeId: string) =>
    setDocuments.find((d) => d.typeId === typeId)?.title ?? typeId;
  const currentIndex = setDocuments.findIndex(
    (d) => d.typeId === job.currentDocumentTypeId,
  );
  const writtenCount = Math.max(
    0,
    job.nextDocumentIndex - job.failedDocuments.length,
  );
  const documents = setDocuments.map((d, i) => ({
    ...d,
    state: failedIds.has(d.typeId)
      ? ("failed" as const)
      : phase === "ready" || i < job.nextDocumentIndex
        ? ("written" as const)
        : d.typeId === job.currentDocumentTypeId && phase !== "preparing"
          ? ("current" as const)
          : ("waiting" as const),
  }));
  return {
    phase,
    done: phase === "ready" ? total : Math.min(total, writtenCount),
    total,
    failed: job.failedDocuments.map((f) => ({
      ...f,
      title: titleOf(f.typeId),
    })),
    currentDocument:
      job.currentDocumentTypeId && phase !== "ready" && phase !== "preparing"
        ? {
            typeId: job.currentDocumentTypeId,
            title: titleOf(job.currentDocumentTypeId),
            position:
              currentIndex >= 0 ? currentIndex + 1 : job.nextDocumentIndex + 1,
          }
        : null,
    currentSection: phase === "writing" ? job.currentSectionIndex : 0,
    sectionCount: phase === "writing" ? job.sectionCount : 0,
    lastProgressAt: job.lastProgressAt,
    documents,
    readySetId: phase === "ready" ? job.versionSetId : null,
    nextStep: phase === "ready" ? input.nextStep : null,
    usualMinutes: input.usualMinutes,
    serverTime: input.serverTime,
  };
}
