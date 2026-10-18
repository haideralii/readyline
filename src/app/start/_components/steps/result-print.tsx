"use client";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import { glossarySentence } from "@/lib/questionnaire/content";
import type { summaryLines } from "@/lib/questionnaire/readiness";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import {
  GROUPS_LABEL,
  MID_TERM_HEADING,
  MODULES_HEADING,
  RESULT_SCOPE_SENTENCE,
  auditHeading,
  midTermLine,
  resultPreparedLine,
} from "@/lib/questionnaire/result-text";

/** Today in Sydney, in words, for the closing line (client-side, after the result has mounted). */
export function todayWords(): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/**
 * REQ-031 FR-2 (D-2887, D-2895): the print view of the result, hidden on
 * screen and shown by the print stylesheet, from the same result object: the
 * audit kind and its meaning, the scope sentence, the groups, the three
 * counts, the modules with their standard counts, the mid-term line, the
 * reasons with their sources' short names, the general-information line and
 * the closing line with today's date. Every word here is on the screen too
 * (the e2e checks each text node). Its own file, so the path-screen lint's
 * count of lines above the result card's button stays the card's.
 */
export function ResultPrint({
  r,
  lines,
  pathwayWord,
  today,
}: {
  r: QuestionnaireResult;
  lines: ReturnType<typeof summaryLines>;
  pathwayWord: string;
  today: string;
}) {
  return (
    <section
      aria-hidden="true"
      className="hidden text-sm leading-5 print:block"
      data-testid="result-print"
    >
      <h2 className="">{auditHeading(r)}</h2>
      <p className="mt-1">{glossarySentence(`${pathwayWord}-audit`)}</p>
      <p className="mt-1">{RESULT_SCOPE_SENTENCE}</p>
      <h3 className="mt-3">{GROUPS_LABEL}</h3>
      <ul className="mt-1 list-disc pl-5">
        {r.groups.map((g) => (
          <li key={g.code}>
            {g.name} {g.code}
          </li>
        ))}
      </ul>
      <ul className="mt-3">
        <li>{lines.documents}</li>
        <li>{lines.registers}</li>
        <li>{lines.checklist}</li>
      </ul>
      <h3 className="mt-3">{MODULES_HEADING}</h3>
      <ul className="mt-1 list-disc pl-5">
        {r.modules.map((m) => (
          <li key={m.id}>
            {m.name}: {m.standardCount}{" "}
            {m.standardCount === 1 ? "standard" : "standards"}
          </li>
        ))}
      </ul>
      <h3 className="mt-3">{MID_TERM_HEADING}</h3>
      <p className="mt-1">{midTermLine(r)}</p>
      <h3 className="mt-3">Why this result</h3>
      <ul className="mt-1 list-disc pl-5">
        {r.reasons.map((x, i) => (
          <li key={`${x.rule}-${i}`}>
            {x.text} Source: {x.source.title}.
          </li>
        ))}
      </ul>
      <p className="mt-3">{GENERAL_INFORMATION_STATEMENT}</p>
      <p className="mt-1">{resultPreparedLine(today)}</p>
    </section>
  );
}
