# REQ-031: Your result in hand: email it to yourself, print it, and see the Start here sheet before you buy

Status: ready for Session A (PO, 18 Oct 2026 16:20; lawyer's and NDIS expert's reads applied as D-2891 to D-2897, D-2222)
Phase: 6   Priority: should   Owner: Dev (Session A and Session B, Dev-1)

## Why (user and business outcome)

- The result on `/start/result` lives in this browser only (localStorage `readyline.questionnaire.draft.v1`) unless a signed-in owner's server draft holds it. Close the tab and it is gone. REQ-015 parked both ideas; D-013 is resolved.
- A buyer on `/sample` never sees the sheet that says what to do with the pack (REQ-026 FR-6, deferred).
- The sheet's section 5 names two next steps; "Check my systems" (REQ-020 FR-9) is built and not named (REQ-026, deferred item).
- The renewal step "Read what changed since your last audit" is always "to read": nothing records a reading (D-2342 item 15, "said, not built").

## Scope (in / out)

- In: FR-1 email of the result; FR-2 the printable result card; FR-3 the sheet on `/sample`; FR-4 the third step in section 5; FR-5 the "what changed" reading mark; one privacy sentence.
- Out: account creation from the email form; marketing email or opt-in; a server-built PDF; the sample's sheet as a Word download.

## Domain rules that apply (link to product/domain)

- `product/domain/ui-copy.md`: answer first, short sentences, feedback in words; the email form is secondary to the one primary action.
- `CLAUDE.md` 4.2, 4.3: the email and the print card carry the general-information line; no claim.
- `CLAUDE.md` 4.5 and `privacy.md`: the typed address is used once and not kept; the audit line holds the hash and the template only.
- `CLAUDE.md` 5: the email is the result and nothing else. No price, no offer, no "buy now", no deadline, no follow-up.
- REQ-022 FR-7 (`templates.test.ts`): plain text with the provider's HTML alternative, no image, no off-site link, the footer line, no unsubscribe line.

## Decisions (PO, 18 Oct 2026)

- D-2881 (reworded under D-2892) The address typed on the result page is used for one send and stored nowhere: no row, no account, no cookie; a peppered hash of it is written to one audit line, kept as the audit log is kept.
- D-2882 One `audit_log` line per real send: `email.sent`, `target = result:<peppered hash>`, `account_id` the owner's when signed in, null signed out; never the body.
- D-2883 Limits through the existing `hitRateLimit`: one send per address per rolling hour, five per IP; keys carry hashes, never the address or raw IP.
- D-2884 The email carries the result's facts and the footer, nothing more. Sources appear by short name without URL, since a template may not link off site.
- D-2885 The subject names the audit kind: `Readyline: your result, a certification audit` (or verification).
- D-2886 (bullet amended under D-2892) `privacy.md` gains one bullet under "What we collect": "If you ask us to email you your result, we send it once to the address you type and do not keep the address. We keep a one-way code of it in our security log so we can see a send happened." PO copy, read by the lawyer role (D-2222).
- D-2887 The print card carries nothing the screen does not, fits one A4 page, and hides every control, the navigation and the footer.
- D-2888 `/sample` shows the sole-trader reference case's Start here sheet (`product/evidence/req-026/start-here-sole-trader.txt`), read-only, in the real sheet's layout, with D-2896's line.
- D-2889 Section 5 of every sheet gains a third step, "Check your systems before the audit: /path/audit-day/check" (UNVERIFIED route; `src/app/path/audit-day/check/` exists).
- D-2890 A reading of "What changed since the last audit" is kept on the period row as `what_changed_read_at`; the renewal step reads "Read on <date>" until a change is dated after the reading.

The lawyer's and the NDIS expert's reads (PO, 18 Oct 2026 16:20; D-2222), every finding accepted:

- D-2891 (finding 1) Under the email field, verbatim: "We send your result to this address once and do not keep the address. Privacy policy.", "Privacy policy" linked to `/privacy`.
- D-2892 (finding 2) D-2881 reworded and the privacy bullet extended as above, so the hash in the audit line is said plainly. The Dev states the audit log's retention period in the Dev response.
- D-2893 (findings 3, 12) The email carries no "See the price" line and no offer. The next steps are two: sign in to get ready (signed in: your next step) and the checklist. The footer names the business and the contact address as the account templates do; the Dev confirms `SIGN_OFF` carries them or adds them. AC-1's regex stays.
- D-2894 (finding 4) The email's first line, verbatim: "Someone asked Readyline to send this questionnaire result to this address. If that was not you, you can ignore this email; nothing was created and nothing else will be sent." AC-1 asserts it.
- D-2895 (findings 7, 10, 11) The email and the print card carry, directly under "Your audit", the sentence "General information, not legal advice: this is based on the supports you told us you deliver; the Commission sets the scope of your audit when you apply." The print block ends with "Prepared by Readyline from your answers on <date>; the sources named are the public instruments, read on the dates recorded at /sources". The screen carries the same words (D-2887). "(modified scope)" keeps its glossary meaning line in the email as on the page.
- D-2896 (finding 8) The sample's line reads "This is the sheet you get with your documents, shown for Sunrise Supports, a fictional sole trader."
- D-2897 (finding 13) The email's registers count carries the `REGISTERS_LEGEND` sentence "An auditor samples them at the mid-term audit and at renewal."

## Functional requirements (numbered FR-1 ...)

Session A (Dev-1): the result in hand

- FR-1 "Email me my result". Under the result card, signed out or in: one label "Email me my result", one field (`type="email"`, `autocomplete="email"`, prefilled for a signed-in owner), the D-2891 line under it with its `/privacy` link, one button "Send it". One server action takes the address and the answers (signed out) or the address alone (signed in; the server draft), re-derives the result as `deriveResult` does, builds the message through a new `resultEmail()` in `templates.ts`, sends through `createEmailProvider()`, and answers in words: "Sent to <address>", "Not sent, try again", or "You already asked for this result in the last hour". The text, in order: the D-2894 line; "Your audit: <kind>" ("(modified scope)" as on the page) and its glossary meaning; the D-2895 sentence; the groups by name and code; the three count lines (`summaryLines`), the registers line with the D-2897 sentence; the modules with standard counts; the reasons, one line each, the source's short name after it, no URL; two next steps with on-site links: "Sign in to get ready: <origin>/sign-in?next=/path/before-you-buy" (signed in: "Go to your next step: <origin>/path/before-you-buy") and "Open your checklist: <origin>/checklist" (D-2893); the link back: signed out, "Your result is not saved on our side. To see it again, start the questionnaire: <origin>/start"; signed in, "See your result: <origin>/start/result"; then the SIGN_OFF line with the business and the contact address (D-2893). No other glossary lines (question 1). `template: "result"`; sender and reply-to as the provider sets them; `accountId` per D-2882.
- FR-2 "Print or save as PDF". A secondary button beside "Change my answers" calling `window.print()`, and `@media print` rules that show: "Your audit: <kind>" with its meaning, the D-2895 sentence under it, the groups, the three counts, the modules with standard counts, the mid-term line, the reasons with short source names, the general-information line, and last the D-2895 closing line with today's date (`formatDateAu`); the screen gains the same two D-2895 lines (D-2887); and hide the stepper, the disclosures, the lists, the offers, every button and link, the FR-1 form, header, nav and footer. The Dev chooses a hidden print block from the same `result` object (the `checklist-print` pattern, `checklist.spec.ts:211-223`) or print classes on the screen's elements.

Session B (Dev-1): the sheet and the reading

- FR-3 (REQ-026 FR-6) `/sample` shows the Start here sheet for the committed sole-trader reference case under the document and above "See which audit I need": the same component as `/documents/[setId]/start-here`, every line "to do", no ticks, no account links, the D-2896 line above it. Built at build time from `fixtures/reference-cases/verification-sole-trader.json` through `buildStartHere` (as `start-here.test.ts:85` does; UNVERIFIED that no server-only import blocks a page import); no model call.
- FR-4 `data/readyline-content/start-here.json`'s `next` list gains the D-2889 step, so the Word file, the page and the sample carry it, in that order after the checklist and audit day.
- FR-5 (D-2890) `registration_periods` gains `what_changed_read_at timestamptz null`. When the owner opens `/path/audit-day/what-changed`, the reading is recorded on the current period (owner only). `renewalSteps` (`src/lib/path/renewal.ts:132`) takes `whatChangedReadAt` and `latestChangeOn` (the newest date among the rows `whatChanged` already reads) and sets "Read on <date>", `done: true`, when the reading is after the latest change, else "to read". The audit-day page's "What changed" link carries the same words in brackets.

## Security and privacy requirements (numbered SR-1 ...)

- SR-1 No new table and no row per send for FR-1 (D-2881).
- SR-2 Rate limits per D-2883; the limited answer is a sentence, never a count.
- SR-3 No log line, audit line, error report or committed fixture carries the address in clear; the outbox file is a CI artefact, not committed; the IP bucket expires with the hour, and nothing outside the limiter keeps the IP hash.
- SR-4 The action re-validates the answers with `answersSchemaFor` and the address with zod (`email`, at most 254 characters); other fields are refused.
- SR-5 The print view carries nothing the screen does not (D-2887).
- SR-6 `what_changed_read_at` follows the row's policies unchanged: members read, the owner writes (`20261016010000_registration_periods.sql`; table-level grants, so no new grant; UNVERIFIED after later migrations).
- SR-7 The sample's sheet is the fixture's text: a fictional sole trader.

## Data (entities, fields, retention)

- `registration_periods.what_changed_read_at timestamptz null`, written by the owner's open, kept with the row. `start-here.json` `next` gains one item. Nothing else stored; the address is not retained.

## Acceptance criteria (Given/When/Then, numbered AC-1 ...)

- AC-1 Given the signed-out result for the REQ-025 AC-2 fixture, when the reader types an address and presses "Send it", then the page says "Sent to <address>" and the outbox holds one message whose subject names the audit kind and whose text opens with the D-2894 line and holds the audit kind, the D-2895 sentence, each group's name, the three count lines as the card shows them with the D-2897 sentence, each module's name, every reason with its source's short name, no `http` link outside the site's origin, the two next steps, the `/start` line and the sentence "Readyline provides general information and document templates for your own review; it is not legal advice."; `findProhibitedClaims` over subject and text is empty; the text matches none of /price|\$|buy|today|hurry|limited|offer/i; and given the form, then the D-2891 line and its `/privacy` link are under the field.
- AC-2 Given a signed-in owner, when they send, then the field was prefilled, the link back is `/start/result`, and the audit line's `account_id` is theirs (a recording `SendAudit` over a stubbed transport).
- AC-3 Given an address sent to in the last hour, when it is sent to again, then the page says the hour sentence and the outbox did not grow; given six sends from one IP to six addresses, then the sixth is refused (a fake `hitRateLimit`).
- AC-4 Given any send, then no log or `audit_log` line holds the address, and the hash equals `emailHash(address)`.
- AC-5 Given `/start/result` on `desktop-chromium` at 794 px wide with `emulateMedia({ media: "print" })`, then `document.documentElement.scrollHeight` is within one A4 page at 96 dpi (1123 px; question 3), the stepper, every button and link, header, nav and footer are hidden, the print view holds the audit kind, the D-2895 sentence, groups, counts, modules, the reasons' short source names, the full general-information sentence AC-1 quotes, and the D-2895 closing line with today's date, and every text node in it also appears on screen (D-2887).
- AC-6 Given the print button pressed, then a stubbed `window.print` ran once.
- AC-7 Given `privacy.md`, when rendered, then the D-2886 sentence is under "What we collect".
- AC-8 Given `/sample` on the three projects, when it renders, then the sheet is under the document with the D-2896 line ("fictional" asserted), every line "to do", no tick, no link to `/documents`, `/checklist` or `/path`, the REQ-026 page's headings, three steps in section 5; axe and the width check pass.
- AC-9 Given the sole-trader fixture, when the sheet is built, then section 5 holds exactly three steps in FR-4's order and `start-here-sole-trader.txt` is regenerated.
- AC-10 Given a period with `what_changed_read_at` null, when the owner opens the what-changed page, then the column is set and the renewal step reads "Read on <today>", `done: true`; given an incident then logged for today, then the step reads "to read" again; given a member opens the page, then the column is unchanged (integration under RLS; unit over `renewalSteps`).

## Test expectations (unit, integration, e2e, manual)

- Unit: `resultEmail()` joins `templates.test.ts`'s "every template" list (template name, footer, HTML with no off-site link, no unsubscribe line, no claim, the AC-1 regex); the limiter branches; `renewalSteps` for AC-10; section 5's count and order; the sample sheet's build.
- Integration: AC-2's audit line; AC-10 under RLS.
- E2E: AC-1, AC-3's hour sentence, AC-5 and AC-6 on `desktop-chromium` and `android-small` (AC-5's measurement on desktop only); AC-8 on the three projects through `home-v2.spec.ts`'s click; AC-10 in the signed-in suite. Under the log provider the e2e reads the outbox file `EMAIL_OUTBOX_FILE` and asserts the body (UNVERIFIED on this checkout; batch C builds it; if not merged, the Dev adds it as one JSON line per message).
- Manual: Haider emails himself the result from his phone on the hosted site; prints it to PDF from Safari and checks one page.

## Evidence required on delivery

- The outbox message for the fixture, verbatim, under `product/evidence/req-031/`; the print render as `page.pdf` (A4) showing one page; screenshots at 360 px and desktop of the form's three states and `/sample` with its height.
- Test output; the migration; the regenerated `start-here-sole-trader.txt` diff; a grep of the CI log for the test address finding nothing; every UNVERIFIED confirmed or corrected; the audit log's retention period (D-2892).

## Questions for Dev to answer before building

1. Should the email carry the "What these words mean" lines? (a) no, the audit kind's only; (b) every term present. Recommendation: (a); the email stays short.
2. The limiter's keys. (a) `result-email:${emailHash(address)}` and `result-email-ip:${hashAddress(ip)}` (the auditor-open pattern in `rate-limit.ts`); (b) the magic-link buckets. Recommendation: (a); the address bucket first, so a limited address never spends the IP's.
3. The print test's tolerance. (a) `scrollHeight <= 1123` at 794 px wide; (b) `<= 1047` (1123 minus 10 mm top and bottom) so default margins never push a line to page 2; (c) also count the pages of `page.pdf({ format: "A4" })`. Recommendation: (b), plus (c) if it costs under ten lines.
4. Where `what_changed_read_at` lives and how it is written. (a) on `registration_periods`, written by a server action the page calls after render (no write inside a GET render); (b) on `accounts`; (c) a "Mark as read" button. Recommendation: (a): the reading and the renewal step are both per period; (c) only if the after-render write proves unreliable.

## Dev response

Dev-1, 18 Oct 2026, on `req-031-session-a` from `next` 23d72f2. The decisions D-2881 to D-2897 read first; nothing below widens them.

**Approach, Session A (four commits).**

1. **`resultEmail()` in `templates.ts`** (D-2884, D-2885, D-2893 to D-2895, D-2897): a pure template over the derived result, the signed-in flag, the origin, today's date and the contact address; `template: "result"`; the subject `Readyline: your result, a <kind> audit`; the text in FR-1's order, the D-2894 line first, "Your audit: <kind>" ("(modified scope)" as on the page) with its glossary sentence alone (question 1 (a)), the D-2895 sentence, the groups by name and code, the three `summaryLines`, the registers line with the D-2897 sentence, the modules with their standard counts, the reasons one per line with the source's short name after each and no URL, the two next steps as on-site links, the link back (signed out `/start`, signed in `/start/result`), then the footer. `SIGN_OFF` carries the general-information line alone, so the footer gains a line "Readyline. Contact: <address>." from the contact address the action passes (`contactEmail()`), and nothing when none is set; the HTML alternative is `renderHtml` as every template's. It joins the "every template" list in `templates.test.ts` and its own cases hold AC-1's regexes.
2. **The action** `sendResultEmailAction` in `src/server/path/result-email-actions.ts`: zod over `{ email, answers? }` (`email` at most 254 characters; `answers` through `answersSchemaFor`, refused when a signed-in owner sends them, other fields refused, SR-4); the signed-in owner's answers from the server draft; `buildResult` as the page derives it; the limiter first on `result-email:${emailHash(address)}` (1 an hour) then on `result-email-ip:${hashAddress(ip)}` (5 an hour), question 2 (a), the limited answer the hour sentence; the send through `createEmailProvider()` with `accountId` the owner's or null (D-2882: the provider's own audit line, `email.sent`, `target = result:<hash>`); the answers "Sent to <address>", "Not sent, try again", the hour sentence (SR-2). No row, no cookie, no log line with the address (D-2881, SR-3: the action logs the template and the hash's first eight characters only).
3. **The form** under the result card: a client component in `result-step.tsx`'s file set with the label, the `type="email"` field (prefilled for a signed-in owner from the viewer's email), the D-2891 line with its `/privacy` link, "Send it", the answer in words; the strings in a copy module the lint walks.
4. **Print** (FR-2, D-2887, D-2895): a hidden print block from the same `result` object (the `checklist-print` pattern), shown by `@media print` with the screen's shell hidden (`print:hidden` on the stepper, the disclosures, the lists, the offers, the buttons and links, the form, header, nav and footer); the screen gains the two D-2895 lines so the print carries nothing the screen does not (SR-5: the e2e checks every text node of the print block against the screen's text); a "Print or save as PDF" secondary button beside "Change my answers" calling `window.print()`.

**Session B (three commits):** FR-3 the sample's sheet (built at build time from the fixture through `buildStartHere`; its import chain is `content.ts`, `blanks.ts`, `facts-fill.ts`, `set-order.ts` and the glossary, no `server-only`, so the page import is clear: UNVERIFIED resolved); FR-4 the third step in `start-here.json`'s `next` and the regenerated `start-here-sole-trader.txt`; FR-5 the migration, the after-render write and `renewalSteps`.

**The four questions, as options with a recommendation.**

1. *The glossary lines in the email.* (a) The audit kind's only. (b) Every term present. **(a)**, as the REQ recommends: the email is the result; the page carries the rest.
2. *The limiter's keys.* (a) `result-email:${emailHash(address)}` at one an hour and `result-email-ip:${hashAddress(ip)}` at five, the address bucket hit first, so a limited address never spends the IP's five (the auditor-open pattern in `rate-limit.ts`; the IP bucket expires with its hour and nothing else keeps the hash, SR-3). (b) The magic-link buckets (five an address, twenty an IP), which would let five sends to one address through. **(a)**.
3. *The print test's tolerance.* (a) `scrollHeight <= 1123` at 794 px wide. (b) `<= 1047`, so default margins never push a line to a second page. (c) Also count the pages of `page.pdf({ format: "A4" })` on Chromium: the count of `/Type /Page` objects in the bytes, six lines. **(b) and (c)**: (b) on `desktop-chromium` at 794 px with `emulateMedia({ media: "print" })`, and (c) asserts one page from the same run.
4. *Where the reading lives and how it is written.* (a) `registration_periods.what_changed_read_at`, written by a server action the page's client component calls once after it has rendered (an effect that calls the action and sets no state, so the lint allows it; no write inside a GET render), owner only through the row's update policy (SR-6: the policies are unchanged by the two later migrations that touch the table, which add grants per verb and the renewal columns; UNVERIFIED resolved). (b) On `accounts`: wrong grain, since the renewal step is per period. (c) A "Mark as read" button: one more tap for a fact the open already shows. **(a)**; (c) only if the after-render write proves unreliable in the signed-in run.

**The audit log's retention (D-2892).** No job removes `audit_log` rows today: the account's purge deletes the account and leaves its lines with `account_id` set null (the column's `on delete set null`), and no retention constant names the table. So "kept as the audit log is kept" means kept indefinitely as the code stands. The privacy bullet's "security log" wording is true; if the PO wants a bound, a purge of lines older than a fixed period is one small job (a Dev decision I would make at two years, the generation log's period, unless told otherwise) and I would state it in `privacy.md` in the same bullet.

**Hours.** Session A: 6 to 8 hours (the template with its tests, the action with the limiter's branches, the form with the copy module, the print block and the two e2e projects, the AC-2 and AC-4 integration case over a stubbed transport). Session B: 5 to 6 hours (the sample's sheet on three projects, the `next` list and the regenerated text, the migration with its RLS case, the after-render write, `renewalSteps` and the signed-in e2e).

**Test plan (AC to test).** AC-1 and AC-3's hour sentence: `e2e/result-email.spec.ts` on desktop and Android against the outbox file; AC-2 and AC-4: `tests/integration/result-email.test.ts` (the audit line's `account_id` and the hash equal to `emailHash(address)`; the recorded transport); AC-3's IP branch and the limiter's order: `result-email.test.ts` unit over a fake `hitRateLimit`; AC-5 and AC-6: `e2e/result-print.spec.ts` on desktop (the measurement, the page count, the text-node check, the stubbed `window.print`) and the hidden-shell checks on Android; AC-7: `legal-copy.test.ts`; AC-8, AC-9, AC-10: Session B. Negative cases added: a 255-character address; an address with a display name; the same address in two cases; answers with an extra field; a signed-in send with answers in the body (refused); a print with every section open; the limiter unreachable (the send does not go).

**Open with the PO (none blocks the start).** (i) The audit log's bound, above. (ii) Whether the contact address line in the footer is wanted when `CONTACT_EMAIL` is unset (built: the line is left out).

## Delivery evidence

## PO review
