# Live QA pass, release b340ee3 (18 October 2026)

Target: https://readyline-zeta.vercel.app, production, sha `b340ee3` (PR #106, `next` to `main`, merged 18 Oct 2026 06:10 Sydney; the hosted database migrated on the same push, `Migrate hosted database` green). Four QA passes run by the PO's QA agents from a cloud container with Playwright 1.64 and Chromium, signed out throughout, nothing submitted but the public questionnaire's steps, no account, no email, no card, about one request a second. The signed-in flows cannot be driven on production by the PO (the founder's standing rule: the PO never signs in anywhere), so pass D maps their CI coverage and gives the founder five scripts to walk on live himself.

| Pass | Scope | Checks | PASS | FAIL | NOTE | Report |
|---|---|---|---|---|---|---|
| A | Home, the questionnaire start to result, pricing; 360 and 1280 | 325 | 276 | 0 | 49 | `report-A-questionnaire.md` |
| B | Guides, registration groups, legal pages, sample, sign-in page, unknown-token routes, headers, robots, sitemap, 404; axe on 18 pages at both widths | 94 | 71 | 1 | 22 | `report-B-content-and-edges.md` |
| C | Keyboard only, 200 % text at 360, 320 at 200 %, dark scheme and reduced motion, screen-reader structure, reading order | 464 | 377 | 14 (8 defects) | 73 | `report-C-accessibility.md` |
| D | Signed-in flows: coverage map of 40 flows against the CI specs, gaps, five human scripts | 40 flows | 26 end to end | 6 none, 8 in parts | | `report-D-signed-in-coverage.md` |

## Defects found on live (for Dev-1, in this order)

1. **High, C D1.** `/start/business` (and any step after an empty submit): the error summary (`role=alert`, `tabindex=-1`) takes focus again every time one of its entries clears, so typing "Sunrise Supports" into Trading name leaves "S" and focus on the alert; the same on a radio arrow or a click. Keyboard and mouse, 360 and 1280. Cause in `fields.tsx` `ErrorSummary`'s effect on `[entries.length]`: focus once, on the submit, never on a shrink.
2. **Medium, B #57.** The unknown-token 404s and `/admin` render the site's 404 page with the server title "Page not found | Readyline", and after hydration the tab title becomes the private route's metadata ("Reminder emails stopped", "Report an incident", "Shared audit view", "Your invitation", "Admin"). The title must follow `notFound()`: `generateMetadata` answers the 404 title when the token fails, and `/admin` carries no static title signed out.
3. **Medium, C D2.** `/start/result`: "Start again" then "Keep" leaves focus on `<body>`; it returns to the "Start again" button.
4. **Medium, C D3.** `/pricing` at 360 and 320 with 200 % text: the two cards are 353 px wide at x=32, the page 385 px, sideways scroll. The cards take the column's width.
5. **Medium, C D4.** The questionnaire stepper at 360 from 150 % text: the six circles overlap (39 px at 200 %). The row wraps or the circles shrink with the text.
6. **Low, C D5 and D6.** At 320 with 200 % text the business-structure fieldset (299 px in a 256 px column) and the supports step's category `h2 > button` headings (305 px) scroll sideways: `min-inline-size: 0` on the fieldsets and the buttons wrap.
7. **Low, C D7.** Three source links on the result open a new tab without "(opens in a new tab)" in the name; the guides say it, the result does too.
8. **Low, intermittent, C D8.** Twice in about twenty fresh loads `/start/business` stayed in its disabled `aria-busy` loading fieldset past 20 s; ten targeted reloads went live in 1 to 3.5 s. Unconfirmed; watch for it, and the loading fieldset gets a line after 5 s ("Still loading, reload if this stays") so a person is never left with a dead form.

## Copy and small things the reports noted (for Dev-1 after the defects)

- `/sign-in`: the email field is `type="text"`; `type="email"` with `inputmode="email"` and `autocomplete="email"`, so a phone shows the email keyboard (B).
- Registration group 0136 reads "Group and centrebased activities" in the title, h1, slug and the CTA while its blurb says "centre-based": the Commission's own spelling decides (check the source file); the slug stays (B).
- `/guides/registration-groups`: "clear the search" in the no-matches sentence is plain text; it becomes the link the REQ-028 FR-15 wording intends (B).
- The cost guide carries "Draft. … lines marked UNVERIFIED are still to be confirmed" with no UNVERIFIED line on the page: the draft line goes, or the page says what is unverified (B).
- The pricing pack card's heading is "Price" while the other card's is "Registers subscription": the pack card's heading is "Document pack" (A).
- "Go to your documents if you already have one." on the result: "one" is unclear; "if you already bought the pack" (A).
- After "Change my answers" the stepper offers no way back to the result until step 6: a "Back to your result" link on each step while a result exists (A).
- "Start again" leaves `readyline.result.open` in localStorage (A): it clears with the draft.
- Every legal page says "to be checked by a lawyer before launch" on the live paid site: this stays until the lawyer's review (the founder's call), but the sentence moves to the foot of the page in the smaller type, not under the heading (PO).
- The only contact is a personal Gmail address (A, B): a live item on the founder's list, not Dev's.

## Signed-in coverage (pass D)

40 flows: 26 walked end to end by one CI test on the release sha (the Supabase job of #106's run, green on attempt 2), 8 covered in parts, 6 with no e2e (resume the guided path later; a real Stripe Checkout and refund; the nightly and timeline reminder emails; the unsubscribe click with a real token; the business-identity flow, not built). Nine flows run on desktop and Android only, no iPhone Safari: the subscription states, the period filter, what changed, the renewal path, the rehearsal, the changes register, the REQ-028 register pages, the magic-link spec. Evidence screenshots on `main` exist for 10 of 40; the rest live in CI's `signed-in-screenshots` artefact (14 days). The five human scripts for the founder are in `report-D-signed-in-coverage.md`, last section.

## What the founder does on live

The five scripts in report D, with his own test account and Stripe's test card 4242 4242 4242 4242: (1) magic-link sign-in on a phone and account setup; (2) a test-mode purchase, the documents arriving, a download, a refund from the Stripe dashboard; (3) inviting a worker from a second mailbox and completing the worker's steps on a phone; (4) an auditor link opened signed out on a phone, the pack download, revoke, the 404; (5) the reminder emails, the unsubscribe click, the switchboard's test send (these three need a real sender, which waits for the launch pass).
