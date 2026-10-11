/**
 * Product name. "Readyline" was chosen by Haider on 2026-10-11 after ASIC,
 * IP Australia and auDA checks (DECISIONS D-020, D-027). It must not contain
 * "NDIS" (CLAUDE.md section 4.1). `NEXT_PUBLIC_BRAND_NAME` remains an
 * override for previews or a future rename.
 */
export const BRAND_DEFAULT = "Readyline";

export const BRAND =
  process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || BRAND_DEFAULT;

/**
 * Plain-language statement required on the site footer and in every generated
 * document (CLAUDE.md sections 4.2 and 4.3).
 */
export const GENERAL_INFORMATION_NOTICE =
  `${BRAND} provides general information and document templates for your own review. ` +
  `It is not legal advice and does not take account of your specific circumstances. ` +
  `Seek legal advice if you are unsure how a requirement applies to you. ` +
  `${BRAND} is an independent service and is not affiliated with the National Disability ` +
  `Insurance Agency or the NDIS Quality and Safeguards Commission.`;

/**
 * AI transparency statement (CLAUDE.md sections 4.3 and 5).
 */
export const AI_DISCLOSURE =
  "First drafts of your documents are generated with AI from your questionnaire answers. " +
  "You are responsible for reviewing, editing and adopting them before use.";
