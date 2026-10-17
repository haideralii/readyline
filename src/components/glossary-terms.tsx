import { glossaryTerm } from "@/lib/questionnaire/content";
import {
  GLOSSARY_ATTRIBUTION,
  GLOSSARY_BRACKET_TITLE,
  splitHyphenated,
} from "./glossary-copy";

/**
 * "What these words mean" (REQ-025 FR-13; REQ-027 D-2701, D-2706, D-2713):
 * the one disclosure a page carries for the glossary terms present on it,
 * extracted from the result page in A1 and placed on every page in A2. It
 * opens with the attribution line, then lists each term with its meaning as
 * a sentence and, where the glossary has one, `more` after it. The `dl` is
 * the element the render check skips when it counts the terms present
 * (D-2714), so a meaning may use another glossary word without a cascade.
 */
export { GLOSSARY_ATTRIBUTION, GLOSSARY_BRACKET_TITLE };

export function GlossaryTerms({
  ids,
  where,
  className,
}: {
  /** The glossary ids present on the page, in the order they first appear. */
  ids: readonly string[];
  where: keyof typeof GLOSSARY_ATTRIBUTION;
  className?: string;
}) {
  if (ids.length === 0) return null;
  return (
    <details className={className ?? "mt-4"} data-testid="glossary-terms">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium underline-offset-4 hover:underline">
        What these words mean ({ids.length})
      </summary>
      <p
        className="text-slate mt-1 text-sm leading-6"
        data-testid="glossary-attribution"
      >
        {GLOSSARY_ATTRIBUTION[where]}
      </p>
      <dl className="mt-1 space-y-1 text-sm leading-6">
        {ids.map((id) => {
          const t = glossaryTerm(id);
          const sentence = `${t.meaning[0].toUpperCase()}${t.meaning.slice(1)}.`;
          return (
            <div key={id} data-testid={`glossary-${id}`}>
              <dt className="inline font-medium">{t.term}: </dt>
              <dd className="inline">
                {splitHyphenated(
                  `${sentence}${t.more ? ` ${t.more}` : ""}`,
                ).map((part, i) =>
                  part.nowrap ? (
                    <span key={i} className="whitespace-nowrap">
                      {part.text}
                    </span>
                  ) : (
                    <span key={i}>{part.text}</span>
                  ),
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

/**
 * The one-term page's inline form (D-2715, D-2719): `term (meaning)` in one
 * wrapper the render check skips, with the attribution as its `title`.
 */
export function GlossaryBracket({ id }: { id: string }) {
  const t = glossaryTerm(id);
  return (
    <span data-testid={`glossary-bracket-${id}`} title={GLOSSARY_BRACKET_TITLE}>
      {t.term} ({t.meaning})
    </span>
  );
}
