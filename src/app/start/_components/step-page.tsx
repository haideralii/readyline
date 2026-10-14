"use client";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  canOpenStep,
  firstIncompleteStep,
  stepHref,
} from "@/lib/questionnaire/navigation";
import type { StepId } from "@/lib/questionnaire/steps";
import { useQuestionnaire } from "./questionnaire-provider";
import { StepShell } from "./step-shell";

/**
 * The shell around one step. The step's own component arrives as `children`
 * from the server page, which picks it per step (D-1012: one chunk per step,
 * because the payload references only the client module it renders). It
 * used to be chosen here through `next/dynamic`, which rendered it on the
 * server inside a streamed Suspense segment: the segment arrives hidden at
 * the end of the body and an inline script moves it into place, and on a
 * slow runner the `ready` flip below rendered the form on the client before
 * that script ran, leaving two copies of every control with the same ids
 * in the DOM (#40, run 38637072132). In the first HTML there is one copy.
 */
export function StepPage({
  step,
  children,
}: {
  step: StepId;
  children: ReactNode;
}) {
  const router = useRouter();
  const { ready, answers, touchStep } = useQuestionnaire();
  const allowed = ready && canOpenStep(step, answers);

  // FR-4: a later step is unreachable until the earlier ones are valid.
  useEffect(() => {
    if (ready && !allowed)
      router.replace(stepHref(firstIncompleteStep(answers)));
  }, [ready, allowed, answers, router]);

  useEffect(() => {
    if (ready && allowed) touchStep(step);
    // touchStep is stable per answers; we only want to run when the step opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, allowed, step]);

  // The result needs the answers, so it gets a placeholder of a step's
  // height until they are ready; a form is in the HTML from the start.
  const form = step === "result" ? null : children;

  if (!ready) {
    // Backlog 2 (D-1012): the step's form is in the server HTML, inert until
    // the draft has loaded, so the page's largest text paints with the first
    // paint instead of after the scripts have run (Lighthouse measured a 4 s
    // largest contentful paint on a throttled phone when the form arrived
    // only with hydration, and a 0.57 layout shift from the footer jumping).
    // The form remounts with the draft's answers once ready (the key below).
    // The result needs the answers, so it keeps a placeholder of a step's height.
    return (
      <StepShell step={step}>
        {form ? (
          // A disabled fieldset, not `inert`: a browser refuses input to both,
          // but only "disabled" is what an automated test waits on before it
          // types, so nothing is typed into the form before it is live.
          <fieldset
            key="loading"
            disabled
            aria-busy="true"
            className="m-0 min-h-[70vh] min-w-0 border-0 p-0"
          >
            {form}
          </fieldset>
        ) : (
          <div className="min-h-[70vh]">
            <p className="text-zinc-600 dark:text-zinc-400" role="status">
              Loading your draft…
            </p>
          </div>
        )}
      </StepShell>
    );
  }
  if (!allowed) return null;

  // The form remounts with the draft's answers only when the draft holds
  // some for this step; a first visit keeps the hydrated form (one render,
  // not two, inside the main-thread budget).
  const hasDraftAnswers =
    step !== "result" && Boolean(answers[step as keyof typeof answers]);
  return (
    <StepShell step={step}>
      <fieldset
        key={hasDraftAnswers ? "ready" : "loading"}
        className="m-0 min-w-0 border-0 p-0"
      >
        {children}
      </fieldset>
    </StepShell>
  );
}
