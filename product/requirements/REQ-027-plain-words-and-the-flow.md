# REQ-027: Plain words and the flow: one idea per line, every audit word explained where it stands, and the result page in the order a first-time reader needs

Status: ready for review (PO, 16 Oct 2026 03:25: the five questions answered below, the decisions numbered D-2701 to D-2703, two lines added to FR-5; goes to the independent `req-review` with headings 7 and 8 under D-2222 before Session A starts). Draft (Dev, 16 Oct 2026, on the PO's 02:05 instruction; the text is REQ-025 Session D as the review left it, D-2219, FR-14, AC-8 and AC-9, moved here per finding 21 of `product/qa/req-reviews/2026-10-15-req-025-026.md`, with the result page's state after REQ-017 and REQ-025 Sessions A to C written in; the PO edits, numbers the decisions and sets it ready; nothing is built until the hallway test in FR-5 has its five answers)
Phase: 6 Priority: should Owner: Dev

## Why

- Haider, 15 Oct: "if the vocabulary of these audits were easy they would have done it in the first place". A support worker who does not like paperwork meets "certification", "module", "quality indicator" and "registration group" on the result page before anything else, and leaves if a word stops them (CLAUDE.md section 1, the one-step-at-a-time rule).
- REQ-025 fixed the structure (lists, the stepper, the 45-word paragraph) and gave every term one meaning in `glossary.json`. What is not done: a sentence rule a writer can keep (the lint fails only at 35 words), a check that every term on a page is explained on that page, and the order of the result page measured against what a first-time reader has to know.
- The research REQ-025 cites says people scan and stop at the first thing they do not understand (NN/g); the Commission's own guidance is written for providers who already know the words, so ours must not be.

## Scope

- In: the sentence rule and its lint; the glossary-presence check (lint and render); the form of "first use" on every customer page (the per-term tap-to-open form D-2232 left to this REQ); the result page's order and above-the-fold content at 360 px; the hallway test as the evidence gate; before and after screenshots.
- Out: new glossary terms or meanings (PO text, REQ-025 FR-13); generated documents (house-style.md governs them, REQ-016); the guides' content (batch 49 and REQ-025 Session C); the checklist and path pages beyond the one "Next:" line (FR-4); any change to the stepper (REQ-025 Session B).

## What is already true on `/start/result` (so the REQ asks only for what is missing)

- One primary button, "Start getting ready" (REQ-017 step 1), with "Open your checklist (N things)" and "See the price" as text links; REQ-015 FR-4 and REQ-017 FR-5 (`tests/path-screens.test.ts`) hold the path's screens to one primary button, one heading and three lines above the control. D-2219's "three buttons become one" is done; the primary's name is "Start getting ready", not "Open your checklist" as the Session D text said.
- The audit kind's meaning is the line under the heading, from the glossary; the other five terms the page uses sit in one "What these words mean" disclosure at the top of "Why this result" (D-2232).
- The order today: the summary card (audit, groups, the three counts, the ready line, the button and two links, the two offers), then "Why this result", the modules, "Documents you will need", "Registers to keep", "What happens next", the notice, the contact line.
- The copy lint: a paragraph fails at 60 words (45 on the result page, the pricing page and the guides), a sentence at 35, plus banned words and internal paths, over every page, copy module and content file.

## Domain rules that apply

- `product/domain/ui-copy.md` (answer first; sentences average under 20 words and never pass 30; one idea per sentence; everyday words).
- CLAUDE.md 4.3: no claim wording enters through a rewrite; the claims lint runs over every changed file as today.
- The glossary meanings are PO text and the one source (REQ-025 FR-13, D-2232); this REQ moves none of them and adds none.

## Decisions (D-2219 stands; D-2701 to D-2703 confirmed by the PO 16 Oct 2026)

- D-2219 (REQ-025, kept): one idea per line, one plain meaning per term; on customer pages a sentence averages under 20 words and never passes 30; a term gets its meaning the first time it appears on a page, in brackets or as a tap-to-open "what this means", never a link away.
- D-2701 The form of "first use" is one per page, not one per term: the page's first term carries its meaning inline (the audit-kind line today), and every other term present is in one "What these words mean" disclosure near the top of the page, as the result page does now. Per-term tap-to-open is not built: it adds one interaction per word on a phone, and the glossary-presence check (FR-2) is what guarantees the meaning is on the page. (Dev's recommendation from D-2232's open call, taken by the PO: one disclosure a reader opens once beats a tap per word; the FR-2 check is the guarantee, the disclosure is the courtesy.)
- D-2702 The sentence rule is enforced as D-2219 says: the lint fails at 35 words and reports the average per file against 20, failing when a file's average passes 25 (the number between "average under 20" and "never 30" that a page of short lines with one long legal sentence still passes). The allow-list stays by constant (REQ-025 FR-10): `GENERAL_INFORMATION_NOTICE`, `AI_DISCLOSURE` and the legal pages' content.
- D-2703 The hallway test is the gate for FR-4 (the order), not for FR-1 to FR-3 (the lint and the glossary check are deterministic and ship first as Session A). Session A does not wait for the five answers; Session B does. The "before" run happens on the page as Session A leaves it, so the test measures the order, not the words.

## Functional requirements

Session A, the rules (deterministic; no hallway evidence needed)

- FR-1 Sentence length. `src/lib/copy-lint/rules.ts` gains the per-file average: `lintFile` (or the test that calls `lintText` per file) reports `averageSentenceWords` and fails a customer page, copy module or content file whose average passes 25 words, beside the 35-word hard limit that stays. Allow-listed constants are left out of the average. The rule applies to the files the lint already walks (`tests/copy-lint.test.ts`: the app pages, the copy modules, the content JSON, the guides) and to nothing new.
- FR-2 Glossary presence. The lint learns the glossary: for every customer-facing file, every glossary `term` that appears in the file's text (case-insensitive, whole word, singular or plural) must have its `meaning` in the same file, either verbatim or through `glossarySentence`/`glossaryMeaning`/a `{{glossary:<id>}}` token. A file that uses a term and gives no meaning fails with the term and the line. Exempt: the legal pages (the lawyer's text), the guides' sources lists, and the glossary file itself.
- FR-3 First use on the other customer pages. Every public page that uses a glossary term gets the one-per-page form of D-2701: `/pricing`, `/sample`, the home page, the four guides, `/path/before-you-buy` and the checklist (signed in). The disclosure's summary is "What these words mean (N)" with N the count of terms on that page; it lists only the terms present, in the order they first appear; the component is the result page's, extracted, not copied. Where a page uses one term only, the meaning goes inline in brackets after the term and no disclosure is shown.
- FR-3a The "Next:" line. Every page on the path and the questionnaire's result says what happens next in one line under its primary action, in the form "Next: <the next screen's name>, <what it needs>" (for the result page: "Next: before you buy, two minutes; sign in to keep your checklist" when signed out, without the sign-in clause when signed in). The words per screen are PO text in `data/readyline-content/next-lines.json`; the Dev drafts them for editing, as `start-here.json` was done (REQ-026).

Session B, the order (after the hallway test)

- FR-4 The result page's order at 360 px: what you face (the audit kind and its meaning), what you need (the three counts and the ready line), what you already have (the "You have this" count from step 5, one line), what to do next (the primary button, the "Next:" line, the two text links), then why (the reasons and sources, the modules, the document and register lists) behind disclosures. The two offers ("What keeps you audit-ready" / "Where you start") move below the disclosures, above "What happens next", because a first-time reader does not need the price before the result. Nothing a first-time reader needs sits below the fold on a 360 × 640 px screen: the audit kind, its meaning, the counts and the primary button are inside the first 640 px, measured by Playwright as the bounding boxes, not by eye.
- FR-5 The hallway test, the evidence for FR-4, run by Haider before Session B and recorded under `product/evidence/req-027/hallway.md`: five people who have never seen the site are shown the result page for the recorded sole-trader fixture on a phone (the "before" page first for the first run; the "after" page for the second run once Session B is built) and given one task: "Read this page, then tell me in one sentence what it says you need." An answer is correct when it names the audit type and says documents will be drafted. Pass is four of five correct. Only the five sentences and a tick per sentence are recorded: no names, no ages, no recordings, no screenshots of the person. The five are people from Haider's own life outside work, never colleagues, never on company time or company devices (CLAUDE.md section 5: nothing of this product uses company resources), and each is told before the task that nothing about them is written down. If the "before" run already passes four of five, the PO decides whether FR-4 is built at all.

## Security and privacy requirements

- SR-1 No data change; the pages read what they read today. The hallway record holds five sentences and nothing that identifies a person (CLAUDE.md 4.5 applies to testers as to participants).
- SR-2 The "Next:" line and the disclosures carry no account facts beyond the counts already on the page.

## Data

- `data/readyline-content/next-lines.json`: one entry per screen id with the line (PO text, status draft until the PO edits it). No database change.

## Acceptance criteria

- AC-1 Given any customer-facing file the lint walks, when the lint runs, then no sentence passes 35 words and no file's average passes 25 outside the allow-listed constants; the lint's own test proves one file over and one under for each rule.
- AC-2 Given a customer-facing file that uses a glossary term without its meaning, when the lint runs, then it fails naming the term and the line; given the real pages, then it passes (proved failing on a fixture file first).
- AC-3 Given `/start/result`, `/pricing`, `/sample`, the home page, a guide and `/path/before-you-buy` rendered on the three Playwright projects, when the page is read, then every glossary term present on the page has its meaning on the page (the render check reads the glossary and the page text, never a literal list of terms); axe reports no serious or critical violation; the disclosure's summary count equals the terms present.
- AC-4 Given the result page and each path screen, when it renders, then the "Next:" line is under the primary action with that screen's words from the content file, and `tests/path-screens.test.ts` still passes (the line counts as one of the three allowed).
- AC-5 (Session B) Given the result page at 360 × 640 px, when it renders for the recorded sole-trader fixture, then the audit-kind heading, its meaning line, the three counts and the primary button each have a bounding box whose bottom is within 640 px of the top, and the reasons, the modules and the lists are closed disclosures below it.
- AC-6 (Session B) Given the hallway record, when the PO reviews, then it holds five sentences, five ticks, the page version shown (before or after, with the commit), and nothing else; four of five are correct on the "after" run.

## Test expectations

- Unit: the two new lint rules with one failing and one passing fixture each; the glossary matcher (plural, capitalised, inside a longer word is not a match: "modules" matches "module", "modular" does not); the "Next:" content file has an entry for every screen id and every line is at most 20 words.
- E2E (desktop, android-small, iphone): AC-3 on the listed pages; AC-4 on the result and the path's first two screens; AC-5 for Session B.
- Manual: the hallway test (FR-5), Haider; a screen-reader pass of the extracted disclosure on one page.

## Evidence required on delivery

- `npm run check` output; the lint's report of per-file averages for the result page, the pricing page and one guide, before and after.
- Screenshots at 360 px and desktop of the result page before and after Session B under `product/evidence/req-027/`.
- `product/evidence/req-027/hallway.md` as FR-5 describes, for the before run (gate for Session B) and the after run (AC-6).

## Questions for the PO (answered by the PO, 16 Oct 2026 03:25)

1. One-per-page (the recommendation) or per-term tap-to-open for "first use"? Per-term changes FR-3 and adds about two hours and one interaction per word on phones. **PO: one per page, D-2701.**
2. The average rule's number: 25 (recommended, see the decision) or the strict 20? **PO: 25, D-2702, and measure first as your Dev response says: the evidence shows today's averages for the result page, the pricing page and one guide before the rule lands, and if the result page is over 25 today the shortening is Session A's work, not a loosened number.**
3. Does Session A ship before the hallway test, or does the REQ wait as one? **PO: Session A ships first; the hallway test gates Session B only, D-2703.**
4. The "Next:" line's words per screen: the Dev drafts them in the content file for your edit, as in REQ-026, or you write them first? **PO: you draft them in `next-lines.json` with status draft, I edit in the same file; the e2e asserts the file's words, so my edit is a docs-only commit that reruns nothing but the unit test.**
5. Is the home page in FR-3, given it carries one example only (the "Your audit" card)? Recommended yes, inline brackets, no disclosure. **PO: yes, inline brackets, no disclosure; and the home page's sentence averages count under FR-1 like every other customer page.**

## Dev response

Written 16 Oct 2026 (Dev), with the draft; no session started.

1. **What exists to build on.** The lint walks every customer file already (`tests/copy-lint.test.ts`, `src/lib/copy-lint/rules.ts`: `lintText` with `splitSentences` and `countWords`, the tight 45-word block option from REQ-025 FR-10 and the allow-list by constant), so FR-1 is one more number out of `lintText` and one assertion per file; FR-2 is a matcher over the same text with the glossary loaded through `glossaryContent` (`src/lib/questionnaire/content.ts`), and the three helpers plus the `{{glossary:<id>}}` token are the only ways a meaning reaches a file, so "has its meaning in the file" is "the file's text contains the meaning or the file calls one of the helpers with that id". The result page's disclosure (`result-step.tsx`, `glossary-terms`, `PAGE_TERMS`) becomes a shared component that takes the list of ids present; the pages name their terms in code and the e2e proves the names match the page's words.
2. **Risks.** The guides are MDX with long source titles that contain glossary words ("Practice Standards and Quality Indicators"): FR-2 exempts the sources lists for that reason, and the matcher must skip link text that is a document title, or the four guides fail on their citations. The 25-word average is a guess at the number that passes today's pages: the Dev measures the real averages first and reports them in the evidence before the number is fixed; if the result page averages over 25 today, the REQ says what to shorten before the rule lands. The "Next:" line on path screens adds one line above the control on screens that already carry three (`tests/path-screens.test.ts` allows three): the line sits under the button, which the test does not count, and the test is extended to say so.
3. **Estimate.** Session A: 4 to 5 hours (the two rules with their fixtures, the measured averages, the shared disclosure on six pages with the e2e on three projects, the "Next:" content file with its draft lines and the path screens' line, the before screenshots). Session B: 2 to 3 hours after the hallway answers (the reorder, the two offers moved, the 640 px bounding-box spec, the after screenshots). The hallway test is Haider's: about an hour for five people, twice.
4. **Assumptions to correct.** The primary button keeps "Start getting ready" (REQ-017), so the Session D sentence "keeps its delivered name Open your checklist" is dropped here; the restrictive-practice meaning stays VERIFY and off every page until the PO clears it (REQ-025 Session A's UNVERIFIED line); no new glossary term is added by this REQ even where a page uses a word the glossary lacks (the lint reports only the thirteen terms).

## Sources (REQ-025's, read 15 Oct 2026, plus one)

- Nielsen Norman Group, "Text scanning patterns: eyetracking evidence": https://nngroup.com/articles/text-scanning-patterns-eyetracking/
- GOV.UK Design System, "Step by step navigation": https://design-system.service.gov.uk/patterns/step-by-step-navigation
- Nielsen Norman Group, "Why you only need to test with 5 users" (the basis for five testers and a four-of-five pass; link not fetched tonight, UNVERIFIED until read): https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/

## Delivery evidence

(none; draft)

## PO review

(none; draft)
