# REQ-025: The questionnaire and result, made scannable: what "already have" means, one stepper, and lists instead of paragraphs

Status: ready for Sessions A, B and C (PO, 15 Oct 2026, from Haider's walk through `/start` on 15 Oct; researched, sources at the end; replaces Batch 48 items 1 and 2, which close as "replaced by REQ-025"; the independent `req-review` of 15 Oct 2026 is in `product/qa/req-reviews/2026-10-15-req-025-026.md` and the PO's decisions on its 24 findings are applied to this text; Session D moves to REQ-027 once the hallway test gives evidence, and its text is kept below until REQ-027 is written)
Phase: 6 Priority: must Owner: Dev

## Why (one paragraph, then lists from here on)

Haider read step 5 as "if I already have an incident register you will not draft one", and could not tell from the page. On the result page he found paragraphs where he wanted a list, and three different ways to go back to a step. The research below says the same three things: auditors want tailored, implemented policies rather than borrowed ones; people scan rather than read; a step indicator helps only when it is simple and navigable. This REQ fixes the three on `/start` and `/start/result`, and sets the writing rule for the rest of the site.

## What the research says (the facts the decisions rest on)

- Auditors check that policies are tailored to the business, understood by staff, followed, and reviewed; "off the shelf high level documents are not good enough" (Provider Institute, audit process article). A policy with elements missing is a minor non-conformity; one nobody follows is major.
- Consultants sell a "gap check" of existing documentation against the Practice Standards and report what is missing (Centro Assist). The market treats "I already have policies" as "review them", not "skip them".
- Progress indicators: test the form without one first; add one only with evidence; start with a plain "Step X of Y"; many users do not see progress indicators and some find them noise (DWP research via the NSW Design System thread quoting GOV.UK); users valued a per-step link to go back to any completed step (Revenue NSW variant); on mobile, show the count and the current step name, with the full list on tap.
- Reading on the web: people scan; chunk into sections and bulleted lists; meaningful subheadings; front-load the key fact; style keywords; most users read very little of a wall of text (NN/g, text scanning patterns).

## Decisions

- D-2215 Every REQ gets the independent `req-review` before "ready"; this one included.
- D-2216 "Already have" means review, not skip (supersedes batch 48's D-2214, which said the same and was built on `batch-48-questionnaire`). The pack always drafts the full set (a mixed pack is what auditors notice). A "Yes" pre-ticks the checklist item and adds one line to it: "You said you have this. Compare it with the draft and keep one: an auditor needs it tailored, understood and followed." "Not sure" counts as "No". The generator never reads these answers. The same holds for the registers: a step-5 "Yes" for a register pre-ticks it and carries the same line.
- D-2217 One stepper, simple first. "Step X of Y: name" stays the primary indicator; the row of steps beneath it is the navigation; nothing else. On phones the row is dots plus the current name, and a "Show steps" control beside line one opens the step names.
- D-2218 House rule for pages: lists, not paragraphs. On a customer-facing page a paragraph is at most three lines at 360 px, which the copy lint measures as 45 words (the number `product/domain/ui-copy.md` already carries); list items and disclosure summaries are exempt; the Start here sheet (REQ-026, D-2221) is held to two lines. Anything with three or more parallel facts is a list; reasons, sources and modules are one line each with the source as the link; long sections sit behind a disclosure with a count in its label. The copy lint enforces the paragraph rule on `/start/result`, `/pricing` and the guides.

## Functional requirements

Session A, step 5 and the result page

- FR-1 Step 5 intro, replaced: a heading "What you already have" and two lines: "Your answers here pre-tick your readiness checklist, so you can see what is missing today." and "They do not change which standards apply or what your pack contains: the pack drafts the full set so every document matches. Not sure counts as no." (These lines stand under D-2219's reworded cap: under 30 words a sentence.)
- FR-2 Each step-5 question keeps its one-line helper; the three options stay; no other change.
- FR-3 Result summary card, as a list, not a sentence, every number derived from the result (never a literal in the copy or the tests): "Your audit: {audit kind}" / "Documents: {documents}, you said you have {documents you have}" / "Registers: {registers}, you said you have {registers you have}, you keep these as you go" / "Checklist: {checklist items} items ({documents + registers} above plus {the rest} about your workers, insurance and the audit)"; one line under it: "The pack drafts all {documents} so they match; your checklist shows which to compare with what you have." A count of zero drops its "you said you have" clause, for documents and for registers alike.
- FR-4 Checklist items pre-ticked from step 5, documents and registers both, carry the D-2216 line in their detail; the audit-day page's ask for such an item reads "Show me your <document>, adopted and dated" as today.
- FR-4a One badge vocabulary on the result page's lists ("Documents you will need", "Registers to keep") and the checklist: the badge states the provider's status only: "You have this" (step 5 said yes), "To prepare" (no or not sure; the detail says "you said not sure"), "Not asked" (no step-5 question for it). The pack's part is one line above each list, never per row: "Your pack includes a draft of every document below." / "Your pack includes a template for every register below; the subscription keeps them for you." The labels "Readyline drafts this", "You said you don't have this yet" and "You said: not sure" go; the same words are used for documents, registers, workers and insurance; the result and checklist specs assert the vocabulary.
- FR-5 "Why this result": each reason is one list item: the fact in plain words, then the source as the link text ("Registration groups table", "Application pack PDF", "Types of audits"), "(opens in a new tab)" once in the list's intro, not on every line. Modules: the three cards stay; each card's standards list stays behind its disclosure with the count in the label ("The 24 standards in this module").
- FR-13 The glossary, one line each, in `data/readyline-content/glossary.json`, the one source of every term's meaning: `audit-kinds.json`, `derive.ts`, `home-copy.ts` and `result-step.tsx` read their meanings from it, so the site never carries two texts for one term. Session A's result page shows each term's meaning on first use. Terms: verification audit ("an auditor checks your documents at a desk; nobody visits"), certification audit ("an auditor reads your documents and visits you"), Practice Standards ("the rules every registered provider is audited against"), module ("a group of those rules that applies to the supports you deliver"), quality indicator ("one thing an auditor looks for under a rule"), registration group ("the Commission's name for a type of support"), mid-term audit ("a check about halfway through your three years"), restrictive practice ("a practice that restricts a person's rights or movement; the law controls it"; VERIFY against the NDIS Act s 9 before it ships), key personnel ("the people who run the business"), self-assessment ("the form where you say how you meet each rule"), NDIS Worker Screening Check ("the national police-and-history check a worker in a risk-assessed role must hold"), reportable incident ("a serious incident the Commission must be told about"), adopt ("sign and date a document so it is yours"). Every term's meaning is PO text; the Dev does not write meanings.

Session B, the stepper (starts from the parked `batch-48-questionnaire` branch, where most of it exists)

- FR-6 One component in `step-shell.tsx` replaces the progress line, "Back to:", "Change my answers" and "Change a step": line one "Step 5 of 6: Already have", always visible, the primary indicator; line two a row of six numbered circles joined by a line that fills to the current step; labels under the circles from 640 px up.
- FR-7 States: done (filled, tick, a link to `stepHref(id)`), current (ring, `aria-current="step"`, not a link), not yet (muted, `aria-disabled="true"`, not interactive). Markup `<nav aria-label="Questionnaire steps"><ol>`; REQ-015 focus ring; targets at least 44 px; no new dependency; CSS only.
- FR-8 Phones (360 px): circles without labels, each circle a plain link as on desktop; a "Show steps" control beside line one opens a disclosure listing the step names with the same links; no nested interaction on the row; no horizontal scroll; the budget job's numbers unchanged.
- FR-9 Result page: one text link under the stepper, "Start again", which clears the draft after a one-screen confirm. Changing one answer is tapping its step; later steps stay done while still valid, as today.

Session C, the writing rule on the rest of the public pages

- FR-10 The copy lint gains the D-2218 paragraph rule for `/start/result`, `/pricing` and the four guides: a paragraph is at most 45 words; list items and disclosure summaries are exempt. The allow-list is by constant, not by path: `GENERAL_INFORMATION_NOTICE`, `AI_DISCLOSURE` and the legal pages' content (a lawyer's text is not shortened by a lint, wherever it renders).
- FR-11 `/pricing` "What you get" and "What it is not", the home page's "What you can count on", and each guide's "short answer" are rewritten as lists where they are parallel facts; the rule is recorded in `product/domain/ui-copy.md` (page copy; `house-style.md` governs generated documents), and the phone width is 360 px everywhere: ui-copy's 375 px changes to 360 px in the same commit.
- FR-12 The sample document leaves the home page (Haider: "sample document on the same page? it's too much"; the field review found 13,400 px at 360 px). `/sample` becomes its own page carrying today's full sample with the download button; the home page keeps the heading "See exactly what you get", the two intro sentences as two bullets, a card with the sample's name, its one-line description and the "7 of 16 sections drafted from the answers" line, and two links: "Read the sample" (to `/sample`) and "Download it as a Word file". The hero's "See a sample document" button points at `/sample`; the dead `/sample` link on `/path/before-you-buy` now lands; `/sample` joins `sitemap.ts`; `e2e/home-v2.spec.ts` is updated. The sample's recorded fixture and the `home` specs that assert the sample move with it; the home page's height at 360 px drops below 5,000 px, measured by Playwright as `scrollHeight` at 360 px and stored under `product/evidence/req-025/`; the budget job (Lighthouse) is not touched.

Session D, plain words and the flow: moved to REQ-027 (finding 21), to be written after the hallway test gives evidence; the text below is kept here with the review's edits applied so nothing is lost, and nothing in it is built under this REQ (Haider, 15 Oct: "if the vocabulary of these audits were easy they would have done it in the first place")

- D-2219 One idea per line, one plain meaning per term. On customer pages a sentence averages under 20 words and never passes 30; the lint fails at 35 (ui-copy's rule); a line carries one idea; an audit term gets its plain meaning the first time it appears, in brackets or as a tap-to-open "what this means", never a link away. The copy lint checks the sentence length per file, and that every glossary term present in a file has its meaning in that file; one Playwright render check of `/start/result` and step 5 covers the terms present on those two pages.
- FR-14 The flow, as a UX researcher would cut it: one primary action per screen (the result page's three buttons become one primary button, which keeps its delivered name "Open your checklist", and two text links); every page says what happens next in one line under its primary action ("Next: your checklist, {checklist items} items, sign in to keep it"); the result page's order is what you face, what you need, what you already have, what to do next, then why (sources) behind a disclosure; nothing a first-time reader needs sits below the fold on a phone. Evidence: the before and after screenshots at 360 px, and a five-person hallway test by Haider: five people who have never seen the site are given the task "Read this page, then tell me in one sentence what it says you need"; an answer is correct when it names the audit type and says documents will be drafted; pass is four of five correct; only the five answers are recorded, no names, no recordings.
- AC-8 Given any customer page, when the copy lint runs, then no sentence exceeds 30 words (the lint fails at 35) outside the allow-listed legal constants, and every glossary term present in a file has its meaning in that file; and given `/start/result` and step 5 rendered, then every glossary term present has its meaning on the page.
- AC-9 Given the result page at 360 px, when it renders, then the audit type, the counts and the primary action are above the fold and the sources are collapsed.

## Security and privacy

- SR-1 No data change; the stepper reads the draft's step state only; "Start again" clears the draft with the existing delete path and one `audit_log` line for signed-in users.

## Acceptance criteria

- AC-1 Given step 5, when it renders at 360 px and desktop, then the two intro lines are present verbatim and the copy lint passes.
- AC-2 Given the recorded fixture with two "Yes" answers, when the result renders, then the summary list shows "Documents: {documents}, you said you have 2" with the fixture's derived document count and the pack line; with no "Yes" the clause is absent; the test derives every number from the fixture, never from a literal.
- AC-3 Given a pre-ticked checklist item, when opened, then the D-2216 line is in its detail.
- AC-4 Given the result page, when axe runs on three projects, then no serious or critical violation; the stepper is one `nav` with six `li`, the current step has `aria-current="step"`, done steps are links, future steps are not focusable.
- AC-5 Given a phone viewport, when the stepper renders, then no per-step labels are under the circles, line one stays visible, "Show steps" opens the names, the page has no horizontal scroll, and the tap targets are at least 44 px.
- AC-6 Given "Start again" on the result page, when confirmed, then the draft is empty and step 1 renders with empty fields; when cancelled, nothing changes.
- AC-7 Given `/pricing` and the guides, when the copy lint runs, then no paragraph exceeds 45 words outside the allow-listed constants and the rewritten sections are lists.

## Tests and evidence

- Unit: the summary-list copy for N = 0, 1, 2 over the fixture's derived counts; the paragraph rule with one paragraph over and one under, and one exempt list item.
- E2E (three projects): AC-1, AC-4, AC-5, AC-6; the existing questionnaire a11y specs extended, not duplicated.
- Evidence: screenshots of step 5, the result page and the stepper at 360 px and desktop, before and after; the lint output; for Session C the home page's `scrollHeight` at 360 px before and after, under `product/evidence/req-025/`.

## Questions for Dev

1. Can the lint measure "three lines at 360 px" as a character count on the rendered text, or does it need a Playwright measure? Prefer the character count.
2. Does the draft store already expose "steps completed" for the stepper, or is it derived from answers on each render?
3. Estimate per session.

## Sources (read 15 Oct 2026)

- Provider Institute, "NDIS Audit Process and Responding to Audit Outcomes": https://providerinstitute.au/articles/ndis-audit-process-and-responding-to-audit-outcomes/
- Centro Assist, "NDIS Practice Standards Gap Check": https://www.centroassist.com.au/gap-check
- NDIS Commission, "The quality audit process" (robots blocked the fetch; UNVERIFIED until read; no glossary meaning rests on it, the audit-kind meanings come from `audit-kinds.json`'s own sources): https://www.ndiscommission.gov.au/provider-registration/apply-registration/types-audits
- NSW Design System community, "Progress indicators" (quotes GOV.UK and DWP research; Revenue NSW variant): https://community.designsystem.nsw.gov.au/t/progress-indicators/669
- GOV.UK Design System, "Step by step navigation": https://design-system.service.gov.uk/patterns/step-by-step-navigation
- Nielsen Norman Group, "Text scanning patterns: eyetracking evidence": https://nngroup.com/articles/text-scanning-patterns-eyetracking/

## Dev response

Written 15 Oct 2026 (Dev), answers only; no session started: D-2215 puts the independent review first, and the REQ says it is awaited.

1. **Measuring "three lines at 360 px" in the lint.** A character count on the rendered text is enough and is what the copy lint already does: it walks the JSX text, the copy modules and the content JSON as source (`tests/copy-lint.test.ts`, `src/lib/copy-lint/rules.ts`), so a paragraph-length rule is one more rule over the same text, with 220 characters as the line (the site's 16 px type fits about 70 to 75 characters a line at 360 px, so three lines is 210 to 225). A Playwright measure would depend on the font loading and the device; the width helper (`e2e/helpers/width.ts`) stays the ground truth for sideways scroll, and the character rule stays the rule a writer can check before pushing. The allow-list for the legal pages is a path list in the rule, as the internal-path rule does. _(Superseded by the review's decisions 10 and 11: the rule counts words, 45 a paragraph, list items and summaries exempt, and the allow-list is by constant.)_
2. **"Steps completed" for the stepper.** Not stored. The draft holds the answers per step (`answers[stepId]`) and `firstIncompleteStep` / `canOpenStep` in `src/lib/questionnaire/navigation.ts` derive which steps are complete on each render; the server draft's `current_step` is the last step opened, not completion. The stepper derives the same way (a pure `stepStates(step, answers, ready)` beside it), so a step that becomes invalid after an earlier answer changes stops being "done" without any stored state to repair. No data change, as SR-1 says.
3. **Estimate per session.** Session A: 4 hours (the two step-5 lines; the summary card as the FR-3 list with the N = 0 case; the FR-4a badge vocabulary on the result lists and the checklist; the "why" list with the source as the link; the D-2216 line in pre-ticked checklist details; unit tests for the copy, the e2e extended). Session B: 2 to 3 hours, because most of it exists: batch 48 items 1 and 2 were built this evening before REQ-025 landed and are parked unpushed on `batch-48-questionnaire` (the `Stepper` component with the states, the nav and list markup, the 44 px targets, the focus ring, the ochre line, "Start again" with the confirm, the specs reshaped); what is left is FR-6's line one as the primary indicator, FR-8's phone disclosure of the step names (today the labels only hide), and two `req-014` assertions still red. Session C: 4 hours (the paragraph rule with the allow-list, the rewrites on `/pricing`, the home page and the four guides, the house style line, `/sample` as its own page with the home card and the hero button). Session D: 5 hours of Dev time (the glossary JSON with first-use meanings and its lint, the 20-word sentence rule, the result page's order and the one primary action, before and after screenshots); the hallway test is Haider's. The before screenshots should be taken before Session A merges.

## Review

Done 15 Oct 2026: `product/qa/req-reviews/2026-10-15-req-025-026.md` (independent reviewer; the PO's decision on each of the 24 findings is at its top). Applied to this text by Dev on 15 Oct 2026 as one docs-only commit for the PO to check: findings 1 to 19, 21, 23 and 24 as decided; 20 and 22 noted, no change.

## Delivery evidence

**Session A (Dev, 15 Oct 2026)** on `req-025-session-a` ebe524c (cut from `next` 5866b4a; PR to `next`; body: `product/evidence/req-025/pr-body-session-a.md`).

- AC mapping: AC-1 → `e2e/req-025.spec.ts` (the two lines verbatim on step 5, three projects) and the copy lint in the unit run; AC-2 → `e2e/req-025.spec.ts` (the list's numbers read back from the page and compared with the disclosures' counts, the tags and the checklist link; no literal) and `src/lib/questionnaire/readiness.test.ts` (0, 1, 2 for documents and registers); AC-3 → `src/lib/checklist/derive.test.ts` (the D-2216 line on pre-ticked documents and registers of the reference cases, on nothing else) and `checklist-view.tsx` renders it under the why line (the signed-in checklist e2e is untouched); FR-4a → `e2e/req-025.spec.ts` and the updated `questionnaire` and `req-015-a11y` specs (only the three labels, the old words absent); FR-5 → `e2e/req-025.spec.ts` (one link per reason, by title, "new tab" once in the intro); FR-13 → `data/readyline-content/glossary.test.ts` (thirteen terms, 20 words, claim-free, the loader, the token, no reader keeps a copy), `derive.test.ts`, `home-copy.test.ts` and the e2e's glossary disclosure; AC-4's axe and width checks on step 5 and the open result in the e2e.
- `npm run check`: green (122 files, 871 tests, 6 skipped); 17 new unit tests.
- Local public gate (dev server, desktop and Android): `req-025`, `questionnaire`, `req-013-p2`, `req-014`, `req-015-a11y`, `checklist`, `home`, `home-v2`, `questionnaire-a11y`, `questionnaire-a11y-tree`: 69 passed, 2 skipped, one timeout in the a11y page sweep on the first compile that passed alone on the re-run (4 passed).
- CI: the pull request's run once it is opened (public job: the specs above on three projects).
- Screenshots: `product/evidence/req-025/step-5-*`, `result-*`, `result-open-*` at 360 px and desktop, `before` and `after`, committed.
- UNVERIFIED: the restrictive-practice meaning carries its VERIFY note against the NDIS Act 2013 s 9 in `glossary.json` and is not shown on the result page (not one of its six terms). Deferred: the per-term tap-to-open form of "first use" (REQ-027; D-2232).

**Session B (Dev, 15 Oct 2026)** on `req-025-session-b` 5fa135a (from the parked `batch-48-questionnaire` on batch 47, with Session A merged in; PR to `next` after #59 and Session A's PR; body: `product/evidence/req-025/pr-body-session-b.md`).

- AC mapping: AC-4 → `e2e/req-025-b.spec.ts` on desktop, Android and iPhone (one `nav`, six `li`, the current step `aria-current="step"`, five done links, four inert spans with no tab stop on step 2, axe on step 2 and the result); AC-5 → the same spec at the phone widths (no labels under the circles, line one visible, "Show steps" opens the six names with the one done link and the current item, no sideways scroll by the width helper, 44 px circles) and on desktop (labels shown, no disclosure); AC-6 → the same spec ("Start again" asks; Keep leaves everything; Yes clears and step 1 renders empty with step 2 not yet); FR-6 → the DOM-order check that line one precedes the row; FR-9 → tapping a done step, later steps stay done.
- `npm run check`: green (122 files, 876 tests, 6 skipped).
- Local gate (dev server): `req-025-b` on the three projects 6 passed; `req-014`, `req-013-p2`, `req-015-a11y`, `req-015-width`, `questionnaire-a11y`, `questionnaire-a11y-tree`, `req-025` and `questionnaire` on desktop and Android 76 passed.
- CI: the pull request's run once it is opened (public job, three projects).
- Screenshots: `product/evidence/req-025/step-5-session-b-*`, `result-session-b-*`, `result-open-session-b-*` at 360 px and desktop, committed; the `before` set from Session A shows the old progress line and navigations.
- Deferred: none. The `progress-line.tsx` component and its test are removed (nothing else used them).
