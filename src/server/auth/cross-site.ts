/**
 * Fetch-metadata check for the export GETs (retro review of REQ-009, finding
 * 48; REQ-004 SR-3). A browser marks a request that another site started (an
 * image tag, a script, a form, a link on that site) with
 * `Sec-Fetch-Site: cross-site`, so a page elsewhere cannot spend a member's
 * five exports an hour or write audit rows through their session cookie.
 * Requests without the header (older browsers, curl) and those the person
 * started themselves (`none`, as from an email client or the address bar) go
 * through; the session and row-level security still decide what comes back.
 */
export function isCrossSiteRequest(headers: Headers): boolean {
  return (
    (headers.get("sec-fetch-site") ?? "").trim().toLowerCase() === "cross-site"
  );
}
