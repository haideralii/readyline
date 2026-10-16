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
