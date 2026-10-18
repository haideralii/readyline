/**
 * The e2e's model for a redraft (REQ-033 Session B AC-B1 to AC-B3; the
 * PO's answer 6 (b): fake replies to build). With GENERATION_FAKE=1 the
 * model client answers a redraft request from the request itself: every
 * line of the CURRENT SECTION block as a paragraph plus one plain sentence,
 * so the anchors stay and the checks pass, and the page can be walked end
 * to end without a recorded reply or a spend. Any other request falls
 * through to the replay client. Never set in production (the launch
 * checklist refuses it, as it does STRIPE_FAKE).
 */
import type { ModelRequest } from "./prompts";

export const FAKE_REDRAFT_SENTENCE =
  "We tell every participant, and the people who act for them, how to raise a concern when supports begin, and we check they understood.";

/** The echo reply for a redraft request, or null when the request is not one. */
export function fakeRedraftReply(request: ModelRequest): string | null {
  const m = request.user.match(
    /<<<CURRENT SECTION>>>\n([\s\S]*?)\n<<<END CURRENT SECTION>>>/,
  );
  const id = request.user.match(/section id: ([a-z0-9.-]+)/)?.[1];
  if (!m || !id) return null;
  const lines = m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 11);
  const blocks = [
    ...lines.map((text) => ({ type: "paragraph" as const, text })),
    { type: "paragraph" as const, text: FAKE_REDRAFT_SENTENCE },
  ];
  return JSON.stringify({ sectionId: id, blocks });
}
