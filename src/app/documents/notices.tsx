import { AI_DISCLOSURE, BRAND, GENERAL_INFORMATION_NOTICE } from "@/lib/brand";

/**
 * The general-information notice and the AI disclosure at the point of
 * delivery (REQ-016 D-058): the documents themselves are the provider's own
 * and no longer carry them. Shown on the documents page and the set page;
 * the readiness summary's first page and the zip's cover note say the same.
 */
export function DocumentsNotices() {
  return (
    <section
      aria-labelledby="notices-heading"
      className="border-rule text-ink mt-10 rounded-md border p-4 text-sm leading-6"
      data-testid="documents-notices"
    >
      <h2 id="notices-heading" className="text-base font-semibold">
        About these documents
      </h2>
      <p className="mt-2">{GENERAL_INFORMATION_NOTICE}</p>
      <p className="mt-2">{AI_DISCLOSURE}</p>
      <p className="mt-2">
        Each document is yours once you have reviewed it, filled in the blanks
        and adopted it. Until then its footer reads &quot;Draft prepared with{" "}
        {BRAND}&quot;; marking it Done on your checklist removes that line.
      </p>
    </section>
  );
}
