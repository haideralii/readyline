# REQ-025: The questionnaire and result, made scannable: what "already have" means, one stepper, and lists instead of paragraphs

Status: ready (PO, 15 Oct 2026, from Haider's walk through `/start` on 15 Oct; researched, sources at the end; replaces Batch 48 items 1 and 2; independent `req-review` before Session A as D-2215 requires)
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
- D-2216 "Already have" means review, not skip. The pack always drafts the full set (a mixed pack is what auditors notice). A "Yes" pre-ticks the checklist item and adds one line to it: "You said you have this. Compare it with the draft and keep one: an auditor needs it tailored, understood and followed." "Not sure" counts as "No". The generator never reads these answers.
- D-2217 One stepper, simple first. "Step X of Y: name" stays the primary indicator; the row of steps beneath it is the navigation; nothing else. On phones the row is dots plus the current name, and the names appear on tap.
- D-2218 House rule for pages: lists, not paragraphs. On a customer-facing page a paragraph is at most three lines at 360 px; anything with three or more parallel facts is a list; reasons, sources and modules are one line each with the source as the link; long sections sit behind a disclosure with a count in its label. The copy lint enforces the paragraph length on `/start/result`, `/pricing` and the guides.

## Functional requirements

Session A, step 5 and the result page

- FR-1 Step 5 intro, replaced: a heading "What you already have" and two lines: "Your answers here pre-tick your readiness checklist, so you can see what is missing today." and "They do not change which standards apply or what your pack contains: the pack drafts the full set so every document matches. Not sure counts as no."
- FR-2 Each step-5 question keeps its one-line helper; the three options stay; no other change.
- FR-3 Result summary card, as a list, not a sentence: "Your audit: certification" / "Documents: 24, you said you have 2" / "Registers: 6, you keep these as you go" / "Checklist: 42 items (30 above plus 12 about your workers, insurance and the audit)"; one line under it: "The pack drafts all 24 so they match; your checklist shows which to compare with what you have." The N = 0 case drops the "you said you have" clause.
- FR-4 Checklist items pre-ticked from step 5 carry the D-2216 line in their detail; the audit-day page's ask for such an item reads "Show me your <document>, adopted and dated" as today.
- FR-4a One badge vocabulary on the result page's lists ("Documents you will need", "Registers to keep") and the checklist: the badge states the provider's status only: "Set up" (step 5 said yes), "To set up" (no or not sure; the detail says "you said not sure"), "Not asked" (no step-5 question for it). The pack's part is one line above each list, never per row: "Your pack includes a draft of every document below." / "Your pack includes a template for every register below; the subscription keeps them for you." The labels "Readyline drafts this", "You said you don't have this yet" and "You said: not sure" go; the same words are used for documents, registers, workers and insurance; the result and checklist specs assert the vocabulary.
- FR-5 "Why this result": each reason is one list item: the fact in plain words, then the source as the link text ("Registration groups table", "Application pack PDF", "Types of audits"), "(opens in a new tab)" once in the list's intro, not on every line. Modules: the three cards stay; each card's standards list stays behind its disclosure with the count in the label ("The 24 standards in this module").

Session B, the stepper

- FR-6 One component in `step-shell.tsx` replaces the progress line, "Back to:", "Change my answers" and "Change a step": line one "Step 5 of 6: Already have"; line two a row of six numbered circles joined by a line that fills to the current step; labels under the circles from 640 px up.
- FR-7 States: done (filled, tick, a link to `stepHref(id)`), current (ring, `aria-current="step"`, not a link), not yet (muted, `aria-disabled="true"`, not interactive). Markup `<nav aria-label="Questionnaire steps"><ol>`; REQ-015 focus ring; targets at least 44 px; no new dependency; CSS only.
- FR-8 Phones (360 px): circles without labels; tapping the row opens the list of step names (a disclosure), the same links; no horizontal scroll; the budget job's numbers unchanged.
- FR-9 Result page: one text link under the stepper, "Start again", which clears the draft after a one-screen confirm. Changing one answer is tapping its step; later steps stay done while still valid, as today.

Session C, the writing rule on the rest of the public pages

- FR-10 The copy lint gains the D-2218 paragraph rule for `/start/result`, `/pricing` and the four guides (max three lines at 360 px, measured as 220 characters), with an allow-list for the legal pages (a lawyer's text is not shortened by a lint).
- FR-11 `/pricing` "What you get" and "What it is not", the home page's "What you can count on", and each guide's "short answer" are rewritten as lists where they are parallel facts; the house style page records the rule.
- FR-12 The sample document leaves the home page (Haider: "sample document on the same page? it's too much"; the field review found 13,400 px at 360 px). `/sample` becomes its own page carrying today's full sample with the download button; the home page keeps the heading "See exactly what you get", the two intro sentences as two bullets, a card with the sample's name, its one-line description and the "7 of 16 sections drafted from the answers" line, and two links: "Read the sample" (to `/sample`) and "Download it as a Word file". The hero's "See a sample document" button points at `/sample`. The sample's recorded fixture and the `home` specs that assert the sample move with it; the home page's height at 360 px drops below 5,000 px and the budget job records it.

Session D, plain words and the flow (Haider, 15 Oct: "if the vocabulary of these audits were easy they would have done it in the first place")

- D-2219 One idea per line, one plain meaning per term. On customer pages a sentence is at most 20 words; a line carries one idea; an audit term gets its plain meaning the first time it appears on a page, in brackets or as a tap-to-open "what this means", never a link away. The copy lint checks sentence length and that every term in the glossary has its meaning on the page where it first appears.
- FR-13 The glossary, one line each, in `data/readyline-content/glossary.json` and shown on first use: verification audit ("an auditor checks your documents at a desk; nobody visits"), certification audit ("an auditor reads your documents and visits you"), Practice Standards ("the rules every registered provider is audited against"), module ("a group of those rules that applies to the supports you deliver"), quality indicator ("one thing an auditor looks for under a rule"), registration group ("the Commission's name for a type of support"), mid-term audit ("a check about halfway through your three years"), restrictive practice ("limiting what a person can do, for safety; the law controls it"), key personnel ("the people who run the business"), self-assessment ("the form where you say how you meet each rule"), NDIS Worker Screening Check ("the national police-and-history check a support worker must hold"), reportable incident ("a serious incident the Commission must be told about"), adopt ("sign and date a document so it is yours"). Every term's meaning is PO text; the Dev does not write meanings.
- FR-14 The flow, as a UX researcher would cut it: one primary action per screen (the result page's three buttons become one primary "Start getting ready" and two text links); every page says what happens next in one line under its primary action ("Next: your checklist, 42 items, sign in to keep it"); the result page's order is what you face, what you need, what you already have, what to do next, then why (sources) behind a disclosure; nothing a first-time reader needs sits below the fold on a phone. Evidence: the before and after screenshots at 360 px, and a five-person hallway test by Haider (five people who have never seen the site say in their own words what the result page tells them; recorded in the evidence; pass is four of five correct).
- AC-8 Given any customer page, when the copy lint runs, then no sentence exceeds 20 words outside the legal pages, and every glossary term present has its meaning on the page.
- AC-9 Given the result page at 360 px, when it renders, then the audit type, the counts and the primary action are above the fold and the sources are collapsed.

## Security and privacy

- SR-1 No data change; the stepper reads the draft's step state only; "Start again" clears the draft with the existing delete path and one `audit_log` line for signed-in users.

## Acceptance criteria

- AC-1 Given step 5, when it renders at 360 px and desktop, then the two intro lines are present verbatim and the copy lint passes.
- AC-2 Given two "Yes" answers, when the result renders, then the summary list shows "Documents: 24, you said you have 2" and the pack line; with no "Yes" the clause is absent.
- AC-3 Given a pre-ticked checklist item, when opened, then the D-2216 line is in its detail.
- AC-4 Given the result page, when axe runs on three projects, then no serious or critical violation; the stepper is one `nav` with six `li`, the current step has `aria-current="step"`, done steps are links, future steps are not focusable.
- AC-5 Given a phone viewport, when the stepper renders, then no label text is visible until the row is tapped, the page has no horizontal scroll, and the tap targets are at least 44 px.
- AC-6 Given "Start again" on the result page, when confirmed, then the draft is empty and step 1 renders with empty fields; when cancelled, nothing changes.
- AC-7 Given `/pricing` and the guides, when the copy lint runs, then no paragraph exceeds the rule and the rewritten sections are lists.

## Tests and evidence

- Unit: the summary-list copy for N = 0, 1, 2; the lint rule with one paragraph over and one under.
- E2E (three projects): AC-1, AC-4, AC-5, AC-6; the existing questionnaire a11y specs extended, not duplicated.
- Evidence: screenshots of step 5, the result page and the stepper at 360 px and desktop, before and after; the lint output.

## Questions for Dev

1. Can the lint measure "three lines at 360 px" as a character count on the rendered text, or does it need a Playwright measure? Prefer the character count.
2. Does the draft store already expose "steps completed" for the stepper, or is it derived from answers on each render?
3. Estimate per session.

## Sources (read 15 Oct 2026)

- Provider Institute, "NDIS Audit Process and Responding to Audit Outcomes": https://providerinstitute.au/articles/ndis-audit-process-and-responding-to-audit-outcomes/
- Centro Assist, "NDIS Practice Standards Gap Check": https://www.centroassist.com.au/gap-check
- NDIS Commission, "The quality audit process" (robots blocked the fetch; UNVERIFIED today): https://www.ndiscommission.gov.au/provider-registration/apply-registration/types-audits
- NSW Design System community, "Progress indicators" (quotes GOV.UK and DWP research; Revenue NSW variant): https://community.designsystem.nsw.gov.au/t/progress-indicators/669
- GOV.UK Design System, "Step by step navigation": https://design-system.service.gov.uk/patterns/step-by-step-navigation
- Nielsen Norman Group, "Text scanning patterns: eyetracking evidence": https://nngroup.com/articles/text-scanning-patterns-eyetracking/

## Dev response

Written 15 Oct 2026 (Dev), answers only; no session started: D-2215 puts the independent review first, and the REQ says it is awaited.

1. **Measuring "three lines at 360 px" in the lint.** A character count on the rendered text is enough and is what the copy lint already does: it walks the JSX text, the copy modules and the content JSON as source (`tests/copy-lint.test.ts`, `src/lib/copy-lint/rules.ts`), so a paragraph-length rule is one more rule over the same text, with 220 characters as the line (the site's 16 px type fits about 70 to 75 characters a line at 360 px, so three lines is 210 to 225). A Playwright measure would depend on the font loading and the device; the width helper (`e2e/helpers/width.ts`) stays the ground truth for sideways scroll, and the character rule stays the rule a writer can check before pushing. The allow-list for the legal pages is a path list in the rule, as the internal-path rule does.
2. **"Steps completed" for the stepper.** Not stored. The draft holds the answers per step (`answers[stepId]`) and `firstIncompleteStep` / `canOpenStep` in `src/lib/questionnaire/navigation.ts` derive which steps are complete on each render; the server draft's `current_step` is the last step opened, not completion. The stepper derives the same way (a pure `stepStates(step, answers, ready)` beside it), so a step that becomes invalid after an earlier answer changes stops being "done" without any stored state to repair. No data change, as SR-1 says.
3. **Estimate per session.** Session A: 4 hours (the two step-5 lines; the summary card as the FR-3 list with the N = 0 case; the FR-4a badge vocabulary on the result lists and the checklist; the "why" list with the source as the link; the D-2216 line in pre-ticked checklist details; unit tests for the copy, the e2e extended). Session B: 2 to 3 hours, because most of it exists: batch 48 items 1 and 2 were built this evening before REQ-025 landed and are parked unpushed on `batch-48-questionnaire` (the `Stepper` component with the states, the nav and list markup, the 44 px targets, the focus ring, the ochre line, "Start again" with the confirm, the specs reshaped); what is left is FR-6's line one as the primary indicator, FR-8's phone disclosure of the step names (today the labels only hide), and two `req-014` assertions still red. Session C: 4 hours (the paragraph rule with the allow-list, the rewrites on `/pricing`, the home page and the four guides, the house style line, `/sample` as its own page with the home card and the hero button). Session D: 5 hours of Dev time (the glossary JSON with first-use meanings and its lint, the 20-word sentence rule, the result page's order and the one primary action, before and after screenshots); the hallway test is Haider's. The before screenshots should be taken before Session A merges.

## Review

Awaiting the independent review (D-2215).

## Delivery evidence

Not started.
