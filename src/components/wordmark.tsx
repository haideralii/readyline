import { BRAND } from "@/lib/brand";

/**
 * The wordmark (REQ-014 FR-3): the product name in the serif with a thin
 * ochre line under its first syllable that runs on to the right, the same
 * line that fills as a provider gets ready. Text, not an image, so it
 * scales, prints and reads to assistive technology as the name.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  const split = BRAND.toLowerCase().startsWith("ready") ? 5 : 0;
  return (
    <span className={`wordmark ${className}`.trim()} data-testid="wordmark">
      {split ? (
        <>
          <span>{BRAND.slice(0, split)}</span>
          <span>{BRAND.slice(split)}</span>
        </>
      ) : (
        BRAND
      )}
      <span className="wordmark-line" aria-hidden="true" />
    </span>
  );
}
