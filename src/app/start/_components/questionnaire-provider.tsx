"use client";
/**
 * Holds the questionnaire answers for the whole flow (REQ-003 Q3, accepted):
 * client-held state, one draft store, no server round trips until the result.
 * The draft is saved after every completed step; if the device cannot store
 * it, the flow continues and the shell shows a note (AC-7).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  browserStorage,
  createLocalDraftStore,
  type DraftStore,
} from "@/lib/questionnaire/draft-store";
import type { GroupOption } from "@/lib/questionnaire/groups";
import { createServerDraftStore } from "./server-draft-store";
import type { QuestionnaireDraft } from "@/lib/questionnaire/schema";
import {
  ANSWERS_VERSION,
  type AnswerStepId,
  type StepId,
} from "@/lib/questionnaire/steps";

export type Answers = QuestionnaireDraft["answers"];
export type AccountPrefill = {
  tradingName: string;
  structure: string;
  states: string[];
  abn: string;
};
export type SaveStatus = "idle" | "saved" | "unavailable";

type QuestionnaireContext = {
  ready: boolean;
  /** Where the draft lives: "server" for a signed-in owner (REQ-006 FR-5 uses it for the teaser). */
  mode: "local" | "server";
  /** The public contact address for the result page's question line (REQ-013 FR-9), or null until CONTACT_EMAIL is set. */
  contactEmail: string | null;
  /** A signed-in owner's business details, so step 1 starts filled in (batch 23 item 3, D-1307); null when signed out. */
  accountPrefill: AccountPrefill | null;
  answers: Answers;
  currentStep: StepId;
  saveStatus: SaveStatus;
  groups: GroupOption[];
  saveStep: <S extends AnswerStepId>(
    step: S,
    data: NonNullable<Answers[S]>,
    next: StepId,
  ) => Promise<void>;
  touchStep: (step: StepId) => void;
  clearDraft: () => Promise<void>;
  /** QA pass F7 (D-2269): true from "Start again" until a step opens again, so the step guard does not race the push to the intro. */
  clearing: boolean;
};

const Ctx = createContext<QuestionnaireContext | null>(null);

export function QuestionnaireProvider({
  groups,
  store,
  mode = "local",
  contactEmail = null,
  accountPrefill = null,
  children,
}: {
  groups: GroupOption[];
  store?: DraftStore;
  /** Signed-in owners keep the draft on the server (REQ-004); otherwise on this device. */
  mode?: "local" | "server";
  contactEmail?: string | null;
  accountPrefill?: AccountPrefill | null;
  children: ReactNode;
}) {
  const storeRef = useRef<DraftStore>(
    store ??
      (mode === "server"
        ? createServerDraftStore()
        : createLocalDraftStore(browserStorage)),
  );
  const [ready, setReady] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [currentStep, setCurrentStep] = useState<StepId>("business");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const migrateLocal = async () => {
      // AC-3: a draft started on this device moves to the account on first sign-in.
      if (mode !== "server") return null;
      const local = createLocalDraftStore(browserStorage);
      const draft = await local.load().catch(() => null);
      if (!draft) return null;
      await storeRef.current.save(draft);
      await local.clear().catch(() => undefined);
      return draft;
    };
    storeRef.current
      .load()
      .then(async (draft) => draft ?? (await migrateLocal()))
      .then((draft) => {
        if (cancelled) return;
        if (draft) {
          setAnswers(draft.answers);
          setCurrentStep(draft.currentStep);
          setSaveStatus("saved");
        }
      })
      .catch(() => {
        if (!cancelled) setSaveStatus("unavailable");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const persist = useCallback(async (nextAnswers: Answers, step: StepId) => {
    const draft: QuestionnaireDraft = {
      answersVersion: ANSWERS_VERSION,
      answers: nextAnswers,
      currentStep: step,
      updatedAt: new Date().toISOString(),
    };
    try {
      await storeRef.current.save(draft);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unavailable");
    }
  }, []);

  const saveStep = useCallback<QuestionnaireContext["saveStep"]>(
    async (step, data, next) => {
      const nextAnswers = { ...answers, [step]: data };
      setAnswers(nextAnswers);
      setCurrentStep(next);
      await persist(nextAnswers, next);
    },
    [answers, persist],
  );

  const [clearing, setClearing] = useState(false);
  const touchStep = useCallback(
    (step: StepId) => {
      setClearing(false);
      setCurrentStep(step);
      if (ready && Object.keys(answers).length > 0) void persist(answers, step);
    },
    [answers, persist, ready],
  );

  const clearDraft = useCallback(async () => {
    // QA pass F7 (D-2269): the flag goes up before the answers empty, so the
    // result step's guard sees it in the same render and leaves the
    // navigation to the caller's push; the next step that opens lowers it.
    setClearing(true);
    setAnswers({});
    setCurrentStep("business");
    try {
      await storeRef.current.clear();
      setSaveStatus("idle");
    } catch {
      setSaveStatus("unavailable");
    }
  }, []);

  const value = useMemo<QuestionnaireContext>(
    () => ({
      ready,
      mode,
      contactEmail,
      accountPrefill,
      answers,
      currentStep,
      saveStatus,
      groups,
      saveStep,
      touchStep,
      clearDraft,
      clearing,
    }),
    [
      ready,
      mode,
      contactEmail,
      accountPrefill,
      answers,
      currentStep,
      saveStatus,
      groups,
      saveStep,
      touchStep,
      clearDraft,
      clearing,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuestionnaire(): QuestionnaireContext {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useQuestionnaire must be used inside QuestionnaireProvider",
    );
  return ctx;
}
