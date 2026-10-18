# REQ-034 Session A: the trust page, the sample in both formats, and the pricing page's plain lines

PR into `next`, branch `req-034-session-a` from `next` a60f7df. Dev-1, 19 Oct 2026. Head: a0ae3f6.

## What this PR does

- **FR-1, FR-2, FR-7, SR-1, the trust page (commit 1; D-2944, D-2945, D-2949, D-2950).** `/trust`, "Where your data lives and who can see it": eight question headings, each with its answer in our words and a link "In the privacy policy" into the policy's section it restates (`/privacy#who-helps-us-run-the-service` and the others, the ids the legal renderer already gives every heading). "Last reviewed <date>" is the policy's own `updated`; the business line is the footer's, now one helper (`businessIdentityLine`) both use. The pin: `legal-copy.test.ts` holds every source sentence in `privacy.md` verbatim, every answer verbatim, and every place and number an answer carries in its sources, so either side changing alone fails. `trust/answers.test.ts` holds FR-7 as failures: no secure, safe, bank-level, guaranteed, compliant or certified; every heading a question; every sentence of ours under 20 words (the breach row quotes the policy's sentence as it stands, D-2950); the page at or under Year 8. The footer links the page; the a11y spec and the copy lint cover it.
- **FR-3, FR-6, the links and the lines (commit 2; D-2946, D-2948).** Under the pack's price: "One price for every document in your pack." "No credits, no expiry: your documents are yours to keep and edit." "No subscription is needed to use what you bought; the registers are a separate subscription you can cancel at any time." Pinned in `copy.test.ts` and run through the claims lint; the trust link under them. The home "No participant data" card keeps its words and gains "Where your data lives"; the AI page's first paragraph links the page and its date moves to 19 October.
- **FR-4, FR-5, SR-2, the sample and the pack lists (commit 3; D-2947, D-2951).** `/sample/complaints-policy.pdf` beside the Word file, both from the committed model with "Sample prepared with Readyline for a fictional sole trader" in the footer of every page. The PDF comes from `pdf-document.ts`, a pdf-lib renderer of the document model (title, numbered sections, paragraphs, bullets, steps, callouts, tables as rows, the footer and page number on every page), rendered once per server process and cached as the Word route does. The line above the files says the sample is from a recorded run for a fictional provider. "What a pack holds": the sole-trader verification case and the personal-care certification case, each the result's own document list with the catalogue's titles, counted in the disclosure's summary; the page's one glossary line covers the audit words.
- **The spec and the decision (commit 4; D-2301).** `e2e/req-034.spec.ts` on desktop and Android. The ASVS table's five stale lines on `next` are moved, as on #119 and #122.
- **Two fixes from the spec's first runs (commits 6 and 7).** The legal renderer numbers its heading ids, so a row names its section by its words and `legalHeadingId` looks the id up at render (the spec computes the same); an id that starts with a digit is found through an attribute selector.

## Notes for the PO

- **FR-4's "same LibreOffice step the pack uses" (question 1).** LibreOffice runs only in D-504's CI job, which converts every rendered Word file to prove it converts and ships nothing; the pack holds Word files; neither Vercel nor the laptop has LibreOffice. The PDF is therefore our pdf-lib rendering of the same model, the footer guaranteed by code, and it does not look identical to Word's. A LibreOffice-rendered file can replace it later by committing the file and pointing the route at it; the tests would not change.
- Row 7 ("Who can sign in") derives from three policy sentences, since the policy has no single one; row 3's "refuse" is the register schemas' behaviour (REQ-018's tests), with the policy's warning sentences as the sources. Say if you would rather the policy gained a sentence for either.
- `pdfjs-dist` 4.10.38 is added here at the version #122 carries, with identical lock lines, so the branch stands alone and the merge with #122 is clean. The AI page's `updated` and its pin will conflict with #122's (18 October there, 19 here); the resolution is 19.
- D-2944 to D-2951 are cited by the REQ but are not yet in `DECISIONS.md` on main; D-2301 reads them from the REQ's text.
- The sample's Word footer changes from "Draft prepared with Readyline" to the sample sentence (the committed model is untouched; the footer is set for the two routes).

## Verification

- `npm run check`: lint, format, typecheck green; 205 test files, 1558 passed | 6 skipped (1564).
- From the main tree's production build of the head, on desktop and Android: `req-034`, `home-v2`, `req-025`, `req-028-c`, `business-identity`, `req-013-p2`, `req-015-a11y` (now with `/trust`) and `health`: 54 passed in 2.5 min.
- Unit: `trust/answers.test.ts` (FR-7), `legal-copy.test.ts` (the pins, the AI sentence and date), `payments/copy.test.ts` (the three lines, the claims lint), `home-copy.test.ts` (the files line), `pdf-document.test.ts` (the footer and page number on every page through pdfjs; a character outside WinAnsi), `sample-pack-lists.test.ts` (the counts, the catalogue's titles, the certification case larger), the copy lint and the class lint over the new page.
- AC mapping: AC-1 `req-034.spec.ts` "AC-1" (rows, links with the heading in view, axe at 360 and 1280); AC-2 `legal-copy.test.ts` (three pin tests); AC-3 `req-034.spec.ts` "AC-3"; AC-4 `req-034.spec.ts` "AC-4, AC-5" (PDF page texts, the Word footer part, the files line) and `pdf-document.test.ts`; AC-5 `sample-pack-lists.test.ts` and the spec's counts; AC-6 `copy.test.ts` and the spec's "AC-6"; AC-7 `answers.test.ts` and the copy lint; AC-8 `npm run check` and `req-015-a11y.spec.ts` with `/trust`.

## Evidence

- `product/evidence/req-034/pr-body-session-a.md` (this file). Screenshots of `/trust` and `/sample` at 360 and desktop come from the a11y spec's artefacts in CI.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
