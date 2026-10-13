/**
 * Structured data as a JSON script (REQ-011). A JSON-LD script is data, not
 * code, and the nonce CSP does not block it; the text is JSON-encoded with
 * "<" escaped so no markup can break out of the element.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
