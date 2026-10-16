/**
 * Runtime tokens in the legal pages (batch 47 items 1 and 2). The PO writes
 * the pages as markdown; two facts only the running server knows are filled
 * in at render time, so the pages never carry a bracketed placeholder and
 * never contradict the pricing page:
 *
 *   {{business-line}}            the registered name and ABN sentence, or
 *                                nothing while either is unset
 *   {{subscription-off}}         the one off-state sentence while the
 *                                registers subscription cannot be bought,
 *                                or nothing
 *   {{#subscription}}...{{/subscription}}   kept only while it can be bought
 *   {{vendor-terms-date}}        the day the vendors' terms were read, in
 *                                words (REQ-022 Session E, D-2258, D-2248)
 *
 * Pure; the server helper supplies the values.
 */
import type { LegalPage } from "./pages";

export type LegalTokenValues = {
  subscriptionOffered: boolean;
  /** The sentence to show, or null while the name or the ABN is unset. */
  businessLine: string | null;
  subscriptionOff: string;
  /** "16 October 2026": the bundle index's date, or the page's own updated date while no bundle exists. */
  vendorTermsDate: string;
};

export const LEGAL_TOKEN_PATTERN = /\{\{[#/]?[a-z-]+\}\}/;

export function applyLegalTokens(
  markdown: string,
  values: LegalTokenValues,
): string {
  let out = markdown.replace(
    /\{\{#subscription\}\}([\s\S]*?)\{\{\/subscription\}\}/g,
    (_, inner: string) => (values.subscriptionOffered ? inner : ""),
  );
  out = out.replace(
    /\{\{subscription-off\}\}/g,
    values.subscriptionOffered ? "" : values.subscriptionOff,
  );
  out = out.replace(/\{\{business-line\}\}/g, values.businessLine ?? "");
  out = out.replace(/\{\{vendor-terms-date\}\}/g, values.vendorTermsDate);
  // A token that produced nothing leaves double spaces or an empty line behind.
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function renderLegalTokens(
  page: LegalPage,
  values: LegalTokenValues,
): LegalPage {
  return {
    ...page,
    body: applyLegalTokens(page.body, values),
    markdown: applyLegalTokens(page.markdown, values),
  };
}
