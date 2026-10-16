/**
 * The glossary disclosure's fixed words (REQ-027 D-2706, D-2719), in a `.ts`
 * beside the component so the e2e render check (`e2e/helpers/glossary.ts`)
 * reads them without loading JSX; the component re-exports them.
 */
export const GLOSSARY_ATTRIBUTION = {
  result:
    "Our plain words, not the Commission's; the sources are linked under each reason.",
  guide:
    "Our plain words, not the Commission's; the sources are at the end of this guide.",
  page: "Our plain words, not the Commission's; the sources are on the result page and in the guides.",
} as const;

/** D-2719: the attribution's first clause, as the `title` on a one-term page's bracket. */
export const GLOSSARY_BRACKET_TITLE = "Our plain words, not the Commission's";

/**
 * D-2267 item 7 (#81's run 38909477898, `checklist.spec.ts` at 390 and 402 px):
 * a hyphenated word in a meaning ("sole-trader", "risk-assessed") broke at its
 * hyphen on a narrow screen. The renderer keeps each such word on one line;
 * the content keeps its plain hyphen, since the same meanings are printed by
 * the Start here sheet and the summary PDF, whose standard fonts cannot encode
 * a non-breaking hyphen. Pure: text in, parts out.
 */
export function splitHyphenated(
  text: string,
): { text: string; nowrap: boolean }[] {
  return text
    .split(/(\S+-\S+)/)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, nowrap: /^\S+-\S+$/.test(part) }));
}
