"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { stepHref } from "@/lib/questionnaire/navigation";
import { ANSWERS_VERSION } from "@/lib/questionnaire/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import { deriveResult, type DeriveResultResponse } from "../../actions";
import { useQuestionnaire } from "../questionnaire-provider";

const HAVE_LABEL: Record<string, string> = {
  yes: "You said you have this",
  no: "You said you do not have this yet",
  "not-sure": "You were not sure",
  unknown: "Not asked yet",
};

type Fetch = {
  key: string;
  response: DeriveResultResponse | null;
  failed: boolean;
};

export function ResultStep() {
  const { answers, clearDraft } = useQuestionnaire();
  const key = useMemo(() => JSON.stringify(answers), [answers]);
  const [fetched, setFetched] = useState<Fetch>({
    key: "",
    response: null,
    failed: false,
  });

  useEffect(() => {
    let cancelled = false;
    deriveResult({ answersVersion: ANSWERS_VERSION, ...answers })
      .then((r) => {
        if (!cancelled) setFetched({ key, response: r, failed: false });
      })
      .catch(() => {
        if (!cancelled) setFetched({ key, response: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [answers, key]);

  const current = fetched.key === key ? fetched : null;

  if (current?.failed) {
    return (
      <p role="alert" className="text-base">
        We could not work out your result just now. Check your connection and
        try again; your answers are still here.
      </p>
    );
  }
  if (!current?.response) {
    return (
      <p role="status" className="text-zinc-600 dark:text-zinc-400">
        Working out which standards apply…
      </p>
    );
  }
  const response = current.response;
  if (!response.ok) {
    return (
      <div
        role="alert"
        className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
      >
        <h2 className="text-lg font-semibold">
          We need a change to your answers
        </h2>
        <p className="mt-2 leading-7">
          {response.kind === "derivation"
            ? response.message
            : "Some answers did not pass our checks. Go back and review each step."}
        </p>
        <Link
          href={stepHref("supports")}
          className="mt-4 inline-block underline underline-offset-2"
        >
          Back to the supports step
        </Link>
      </div>
    );
  }

  return (
    <ResultView
      result={response.result}
      onStartAgain={() => void clearDraft()}
    />
  );
}

function ResultView({
  result,
  onStartAgain,
}: {
  result: QuestionnaireResult;
  onStartAgain: () => void;
}) {
  const r = result;
  return (
    <div className="space-y-10" data-testid="result">
      <section aria-labelledby="pathway-heading">
        <h2 id="pathway-heading" className="text-xl font-semibold">
          Your audit:{" "}
          {r.pathway === "verification" ? "verification" : "certification"}
          {r.modifiedCertification ? " (modified scope)" : ""}
        </h2>
        <p className="mt-2 leading-7" data-testid="pathway-description">
          {r.pathwayDescription}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Groups in scope:{" "}
          {r.groups.map((g) => `${g.code} ${g.name}`).join("; ")}
        </p>
        {r.flags.silExcluded ? (
          <p
            className="mt-3 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900"
            data-testid="sil-excluded"
          >
            Based on your answers, the service you described is not supported
            independent living under the Commission&apos;s definition, so class
            0138 and the SIL module are not in your result.
          </p>
        ) : null}
        {r.flags.restrictivePracticesAssumed ? (
          <p className="mt-3 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900">
            You were not sure about restrictive practices, so we assumed yes. If
            you do not use them, change that answer and the implementing
            behaviour support plans module drops out.
          </p>
        ) : null}
        {r.flags.largeProvider ? (
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Readyline focuses on providers with up to about 10 workers; the
            standards below still apply to you.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="text-xl font-semibold">
          Practice Standards modules that apply ({r.modules.length})
        </h2>
        <ul className="mt-3 space-y-4">
          {r.modules.map((m) => (
            <li
              key={m.id}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
              data-testid={`module-${m.id}`}
            >
              <h3 className="text-base font-semibold">
                {m.name}{" "}
                <span className="font-normal text-zinc-600 dark:text-zinc-400">
                  ({m.standardCount} standards)
                </span>
              </h3>
              <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {m.description}
              </p>
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium underline-offset-4 hover:underline">
                  Explain this result: the standards in this module
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {m.standards.map((s) => (
                    <li key={s.id}>{s.name}</li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="midterm-heading">
        <h2 id="midterm-heading" className="text-xl font-semibold">
          Mid-term audit
        </h2>
        <p className="mt-2 leading-7" data-testid="mid-term">
          {r.midTermAudit.applies
            ? `Applies: about ${r.midTermAudit.monthsAfterRegistration} months after registration, assessed against the provider governance and operational management standards. Start preparing from month ${r.midTermAudit.prepareFromMonth}.`
            : `Does not apply. ${r.midTermAudit.exemptReason ?? ""}`}
        </p>
      </section>

      <section aria-labelledby="why-heading">
        <h2 id="why-heading" className="text-xl font-semibold">
          Why
        </h2>
        <ul className="mt-3 space-y-3">
          {r.reasons.map((x, i) => (
            <li
              key={`${x.rule}-${i}`}
              className="text-sm leading-6"
              data-testid="reason"
            >
              {x.unverified ? (
                <span className="mr-2 rounded-full border border-amber-700 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-400 dark:text-amber-300">
                  Not confirmed by the Commission&apos;s text
                </span>
              ) : null}
              {x.text}{" "}
              <a
                href={x.source.url}
                className="underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source: {x.source.title} (opens in a new tab)
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="documents-heading">
        <h2 id="documents-heading" className="text-xl font-semibold">
          Documents you will need ({r.documents.length})
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          A first-pass list from the modules above. Items marked from what you
          told us in the last step.
        </p>
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {r.documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-base">{d.title}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {HAVE_LABEL[d.have]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="registers-heading">
        <h2 id="registers-heading" className="text-xl font-semibold">
          Registers to keep after registration
        </h2>
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {r.registers.map((x) => (
            <li
              key={x.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-base">{x.title}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {HAVE_LABEL[x.have]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p
        className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        data-testid="result-notice"
      >
        {r.notice}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={stepHref("business")}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 text-base font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Change my answers
        </Link>
        <Link
          href="/start"
          onClick={onStartAgain}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 text-base font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Clear the draft on this device
        </Link>
      </div>
    </div>
  );
}
