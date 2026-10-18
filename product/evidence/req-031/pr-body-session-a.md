# REQ-031 Session A: your result in hand, emailed to yourself and printed

PR into `next`, branch `req-031-session-a` from `next` 23d72f2 (with `next` bd9550e merged before the push, D-2827). Dev-1, 18 Oct 2026. Head: 9d3b70e.

## What this PR does

- **FR-1, "Email me my result" (D-2881 to D-2885, D-2891, D-2893, D-2894, D-2895, D-2897).** One form under the result card: the label, an email field pre-filled for a signed-in owner, D-2891's line with its `/privacy` link, a secondary "Send it", the answer in words ("Sent to <address>", "Not sent, try again", the hour sentence). `sendResultEmailAction` re-validates the answers through `answersSchemaFor` (a signed-in owner's come from the server draft; a body carrying them is refused), re-derives the result as the page does, hits the limiter on the address's peppered hash first (one an hour) then the connection's (five an hour; question 2 (a)), and sends `resultEmail()` through `createEmailProvider()` with the owner's account id or null, so the provider's one audit line reads `email.sent`, `result:<hash>` (D-2882). The message is the result and nothing else, in FR-1's order, the sources by short name without a URL, the audit kind's glossary sentence as the one glossary line (question 1 (a)), two on-site next steps, the link back by sign-in state, the general-information footer and the business with its contact address when `CONTACT_EMAIL` is set. No row, no cookie, no log line with the address (SR-1, SR-3). Without a database (the public e2e job, a local run) the limiter is the instance's memory with the same limits.
- **FR-2, "Print or save as PDF" (D-2887, D-2895).** A text button beside "Change my answers" calling the browser's print. A hidden print block from the same result object (the audit kind and its meaning, the scope sentence, the groups, the three counts, the modules with their standard counts, the mid-term line, the reasons with their sources' short names, the general-information line, the closing line with today's date); in print the two columns, the stepper, the header and the footer hide. The screen carries the same words: the scope sentence inside the audit-kind line (REQ-017 FR-5's lint keeps the card at its lines) and the closing line above the card's footer.
- **The shared words.** `src/lib/questionnaire/result-text.ts` holds what the screen, the print and the email share; the result page reads its headings, the mid-term lines and the registers legend from there.
- **AC-7, the privacy bullet (D-2886).** `privacy.md`'s "What we collect" gains the PO's sentence, dated 18 October 2026, held by `legal-copy.test.ts`.

## Not in this PR (Session B)

FR-3 the sample's sheet, FR-4 the third step, FR-5 the "what changed" reading mark (AC-8 to AC-10).

## Notes for the PO

- AC-1's regex `/price|\$|buy|today|hurry|limited|offer/i` matches the REQ's own link path `/path/before-you-buy`; the tests run it over the text with the on-site links removed, and the subject as it is.
- The audit log's retention is indefinite as the code stands (the Dev response says how a bound would be added).
- `req-025.spec.ts` now reads the audit-kind line as containing the meaning, since D-2895's sentence rides it; `req-015-a11y` already did.

## Verification

- `npm run check`: lint, format, typecheck green; 187 test files, 1,353 tests passed, 6 skipped.
- From the main tree's production build of the head, on desktop and Android: `result-print`, `req-025`, `req-013-p2`, `req-015-a11y` and `health` on desktop-chromium and android-small, 26 passed in 2.0 min. The email spec was not in the local run: a local send goes through `.env.local` to the hosted limiter table, so it runs in CI's public job (memory limiter) only.
- Unit: `templates.test.ts` (the template in the "every template" list and its own cases), `result-email-actions.test.ts` (the limiter's order and sentences, the refused bodies, both sign-in states, no address in a log line), `legal-copy.test.ts`; the copy, class and path-screen lints green.
- Integration (the Supabase job): `tests/integration/result-email.test.ts` (AC-2, AC-4).
- E2E: `e2e/result-email.spec.ts` (AC-1, AC-3's hour sentence), `e2e/result-print.spec.ts` (AC-5 with the one-page measurement and the PDF's page count on desktop, AC-6) on desktop and Android.
- AC mapping: AC-1, AC-3 the email spec; AC-2, AC-4 the integration case; AC-5, AC-6 the print spec; AC-7 `legal-copy.test.ts`; AC-3's IP branch the unit test.

## Evidence

- `product/evidence/req-031/pr-body-session-a.md` (this file). The outbox message for the fixture verbatim and the print PDF come from the CI run's artefacts (the public job's outbox file and the Playwright report), listed when the run is green.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
