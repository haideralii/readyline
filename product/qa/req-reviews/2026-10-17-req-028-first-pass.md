# Review of REQ-028 (first pass)

Reviewer: independent reviewer, 17 Oct 2026, `origin/main` at `8759e3b` (read-only; none of the PO's reasoning). REQ: `product/requirements/REQ-028-desktop-layout-and-design-system.md` (draft, PO 17 Oct 02:50, D-2801 to D-2810). Read against `ux-audit.md` (7450511), `qa-pass.md` (ac72e9b), REQ-014, REQ-015, REQ-017, REQ-025, REQ-027 and the code the FRs name. Ratios are my recomputation over D-2802's hex values.

**Verdict: Not ready.** 0 blockers, 10 majors, 14 minors, 5 nits. First three: 4 (the ready line's third segment no longer exists and "to prepare" is a word REQ-027 retired), 7 (FR-8's "What happened" column is the free text D-2804 refuses), 10 (AC-2's own floor fails on `--rule`). Decisions needed: 1, 2, 4, 5, 7, 8, 12, 16.

## 1. Testability

1. **major, FR-1 / AC-1.** FR-1 defines three page types (reading 8+4, form 7+4, list 12) and says "every page names its type in one place (a `PageShell` component with a `kind` prop)", but FR-6 is 5+7, FR-7's documents page 5+7, FR-9 4+8, FR-11's account 3+9 and pricing "columns 2 to 11". Five pages fit none of the three kinds. Fix: add a `grid` kind that exposes the 12 columns, or fold the five layouts into the three.
2. **major, FR-6 / FR-5 / SR-2.** "the three sections as plain `<section>`s with `<h2>`s, open on `lg`, `<details>` closed under `lg` as today" and FR-5's glossary "open by default on `lg`" name no mechanism. CSS cannot open a `<details>` by viewport; the choice is JS on `matchMedia` (new script, against SR-2) or two renders hidden by breakpoint (doubled headings, which `req-015-a11y`'s heading-order check will see). Fix: say which, and amend REQ-015's heading test to visible headings only.
3. **major, AC-6 vs FR-8 and SR-2.** AC-6 asks for a table "sortable by its date column"; FR-8 never says sortable, `DataTable` (`src/components/data-table.tsx:36`) has no sort, and SR-2 forbids new script. Fix: either drop "sortable" or specify a server-side sort by `?sort=` on the register page (a link in the `th`, no script) and put it in FR-8.
4. **major, FR-4 / AC-4 / D-2803.** FR-4 says the line "draws three segments: done in moss, to prepare in ochre, the remainder in `--track`" as "REQ-014's spec". REQ-014 line 34 records that D-1310 reduced it to "two segments since batch 36: have and still to do"; `ready-line.tsx` takes `{done, todo}` and nothing else, so the "remainder" is always zero and the track never shows. And "N to prepare" is the word REQ-027 D-2718 retired on that page ("You need one" (was "To prepare", which read as homework for the reader)), while the Why promises "without moving a word of copy that REQ-027 settled". Fix: name the third quantity (the index's unstarted registers is the one real case) and say FR-4 amends D-1310, or keep two segments with ochre for todo; and pick a legend REQ-027 allows ("N still to do").
5. **major, FR-10 / AC-8 vs REQ-025 FR-12.** D-2810 records the home page "sat exactly on REQ-025 FR-12's 5,000 px cap at 360 px" before the list was cut. FR-10 adds a lead sentence and lifts the price lines from 14 px to 16 px cells; AC-8 says nothing about height. Fix: AC-8 asserts `e2e/req-025-c.spec.ts`'s `scrollHeight` at 360 with a margin (under 4,600 px, say) on Session C, and the evidence records it.
6. **minor, AC-1 / AC-2 / AC-9 viewports.** AC-1 measures "at 1280 and 1536 px" and AC-2 and AC-9 "at 360 and 1280"; no project is 1536 wide, `iphone` cannot be 1280, and `req-015-a11y.spec.ts` runs light only and omits the guides (QA F2). Fix: name the spec files, 1536 as a `setViewportSize` in `desktop-chromium`, 360 on `android-small` only, the guides added, and a timeout for the two-scheme axe run (QA N2).
7. **minor, AC-1.** "no element carries `max-w-2xl`, `max-w-3xl` or `max-w-5xl`" leaves `max-w-md` (sign-in, audit 7); say the forbidden set and the allowed one (`max-w-prose`).
8. **minor, AC-9 vs FR-12.** "no readable text under 14 px" fails `DataTable`'s phone card mode today (`data-table.tsx:59`, 12 px uppercase `dt` labels that a person reads), and FR-12 allows 12 px "for table headers only". Say whether the card labels count as table headers.
9. **minor, FR-2 / AC-2 / tokens.ts.** FR-2 adds six tokens to `globals.css` and AC-2 tests "over `globals.css`", but `src/lib/theme/tokens.ts` is the declared source (`tokens.test.ts` fails if the stylesheet drifts from it) and `@theme inline` must gain `--color-surface` etc. before `bg-surface` exists. Fix: FR-2 names `TOKEN_NAMES`, `TOKENS` and a new pairs list as the record; AC-2 extends the existing test.

## 2. Conflicts

10. **major, AC-2 / D-2802.** AC-2's floor "decorative rules at least 1.4:1" fails D-2802's own value: `--rule` light #D9D2C6 on paper #F7F3EC is **1.36:1** (the audit's "1.5" was for the earlier #CFC7B9). Dark passes (1.47). Fix: light `--rule` #D4CCBF (≈1.45) or drop the 1.4 floor (it is not a WCAG floor; say it is the PO's).
11. **minor, D-2802 rules.** `--line` on `--mist` is **2.81:1** light / 2.82 dark, so a hovered secondary button, chip or choice row drops its boundary under 3:1; on dark `--surface` (the input's own background) it is 3.02. Fix: AC-2 measures `--line` against `--surface` and `--mist` as well as paper.
12. **major, FR-8 vs D-2804 / SR-1.** FR-8 names "incidents: Ref, Date, What happened, Status, Notify by; complaints: Ref, Received, About, Status, Due". "What happened" and "About" are the entry's free-text title ("INC-0001: Restrictive practice used …", `register-list.tsx`), and D-2804 says "A column that would put free text in a scannable grid is refused". AC-6's fixture plants a name in a note, the column already kept off the table, so it cannot catch a name typed in a title. Fix: a fixed-vocabulary field (incident type) or no title column; plant the fixture's name in the title too.
13. **major, FR-6 / D-2805 vs REQ-027 D-2707 and its tests.** D-2805 renames "Start getting ready" to "Sign in to get ready", adds "(AUD 399)" to "See the price", moves "Open your checklist (N things)" into a section header and deletes the "Next:" line. REQ-027 D-2707 fixed that line, REQ-027 AC-4 asserts it, and `tests/path-screens.test.ts` asserts it follows the control. "Out" excludes D-2709 to D-2730 only, so D-2707 is in scope by number against the Why's promise. Fix: say D-2805 amends D-2707, list the REQ-027 tests that change, and send the labels through the lawyer (the figure comes from `readPricing`; say the label when no price is set, as `heroHeadline` does).
14. **minor, D-2801 vs FR-5 and FR-6.** D-2801: "a laptop change never moves a phone element". FR-5 collapses the hint and reorders the practices step on phones; FR-6 collapses the stepper and moves "Start again" into the card footer on phones. Fix: "no phone element moves except those FR-5 and FR-6 name, each with a 360 assertion".
15. **minor, FR-12 vs brand.md / REQ-014.** "small 14, label 12" against brand.md:48 "never below 16 px on phones" (audit 22 quotes it). Fix: brand.md gains the 14 px floor and the 12 px label exception in Session A's commit, as REQ-025 finding 9 did for the width.
16. **major, FR-2 scope.** "`text-zinc-500` without a dark pair is gone" and the lint "fails any new `text-zinc-*`" with D-2802's "no `text-zinc-*` … in `src/` after Session A" together retire every zinc text class, but FR-2 maps only helper text (→ slate), white (→ paper/surface) and borders. `text-zinc-700 dark:text-zinc-300` (body prose) and `text-zinc-600 dark:text-zinc-400` (133 lines) have no named token. Fix: a mapping table in FR-2 (700/300 → ink; 600/400/500 → slate).
17. **minor, FR-7 vs the index today.** "the two groups as `lg:grid-cols-2` register cards" and "N of 14 registers started": `registers/page.tsx` renders three groups ("From your pack", "Keep as things happen", "Keep current") over 15 registers (five named plus the ten `AUDIT_DAY_SLUGS`). Say three groups, and whether document control (built, never "started") is the one excluded from the 14.
18. **minor, FR-7 vs Data "None".** "Last downloaded <date>" needs a read of `audit_log` (`audit-pack.zip/route.ts:50` writes `audit_pack.downloaded`), and "about X MB" needs a size for a zip that is built on request. Fix: name each source (the newest `audit_log` row; the stored `set.zip`'s size) or drop the lines.
19. **nit, FR-10 / D-2806.** "D-2265's words" are `subscriptionLine` (34 words, including "the mid-term audit countdown") and `priceLine` (15 words); a "two-cell price strip at 16 px" cannot hold them. Quote the cells' text in FR-10; note once for the lawyer that "countdown" is a reminder feature, not sales urgency.

## 3. Domain claims

20. **nit, Domain rules.** "Worker Screening Rules s 20" carries a VERIFY until the NDIS expert names the section; D-2407's columns rule carries the weight either way.

## 4. Privacy and security

21. See 12: the planted-name fixture tests the wrong column.
22. **minor, SR-2.** "no new script" is contradicted by FR-8's sort (3) and FR-6's open state (2). Fix: "no new dependency and no new network call; client code only where FR-3, FR-6 and FR-8 say".

## 5. Scope and cost

23. **major, Sessions.** Session A is "the shell, the tokens and the search-and-replace, the controls, the ready line, the type, the components" and "changes no page's structure beyond the container and the tokens", but FR-13 adds chevrons to every link row and a header underline, FR-14 resets spacing on every page, FR-3 restyles the stepper, FR-12 moves the supports description out of its `<h2>`, and FR-2 touches roughly 400 class occurrences (39 `max-w-2xl`, 72 `dark:border-zinc-*`, 73 `border-zinc-200/300`, 133 `dark:text-zinc-400`). That is two to three sessions of D-2215's size. Fix: split A into A1 (shell, tokens, lint, type) and A2 (controls, ready line, components, spacing), each its own PR.
24. **minor, Evidence.** "Screenshots of every page at 360, 768, 1280 and 1536 in both schemes, before and after" is about 30 routes × 8 × 2. Fix: list the routes and say the signed-in ones come from the Supabase CI job.
25. **minor, Test expectations.** "e2e, signed in: documents, registers (table and cards, the planted-name fixture)" needs a register with 30 entries (AC-6); say which helper seeds it.

## 6. Clarity and plain words

26. **minor, QA coverage.** The status line claims the QA pass's "F3, F8, F10, F11, N3, N7, N8"; F3 (FR-3), F8 (FR-3, D-2807), F10 and F11 (FR-11), N7 (FR-10) are covered; **N3** (the glossary lint's `computed` bypass and the case-sensitive `N/A` ban) and **N8** (`NumberInput` turns "2.5" into 25) appear nowhere. Fix: an FR each, or move them to a named REQ.
27. **minor, audit coverage.** Not covered and not deferred: **51** (the repeated participant-data warning on register forms), **56** (the sample's "Generic text: add your details." callout, which a prospect reads), **57** (the "In development" badge on phones), **59** (the empty-search state with a Clear button), **60** (the documents "delayed" state with no action), **61** (the 404 at `lg`). Cited but with no substance: **16** (the "Show steps" dropdown's `bg-white`), **20** (the "Anything else" free-text field: used or removed?), **63** (state checkboxes as chips). Fix: one FR line each or a deferral with a reason; 56 and 60 are customer-facing and cheap.
28. **nit, plain words in quoted copy.** "Download all (zip)", "Download my audit pack (zip)" and "Export CSV": a sole trader may not know "zip" or "CSV". Prefer "Download all as one file (zip)" and "Download as a spreadsheet (CSV)". "Open your guided path" is REQ-017's internal name; the strip says "Your next step". Nothing else quoted is beyond the reader.
29. **nit, FR-1 arithmetic.** `grid-cols-12 gap-x-8` in 1152 px gives 66.7 px columns, not the audit's "72 px"; the REQ does not repeat it. No change.

## 7. Legal: for the lawyer's read

30. **nit.** Pricing (FR-10): `btn-primary` on the AUD 399 pack and `btn-secondary` on the subscription, while home shows "two equal cells". Defensible (the pack needs no account) but a nudge toward the dearer item where price is decided; say the reason in D-2806 or make both secondary. No countdown, scarcity or discount appears in any FR.

## 8. Domain: for the NDIS expert's read

31. D-2803's word (4) and D-2804's columns (12, 17) are the asks; add whether one `Tag` status vocabulary fits all fifteen registers.

## Coverage table (audit finding → FR)

| Audit | FR | Audit | FR | Audit | FR |
|---|---|---|---|---|---|
| 1, 2, 7, 8 | FR-1 (FR-11 for 7) | 25, 38, 39, 40, 67 | FR-12 | 49, 50, 62, 65 | FR-5 |
| 3, 18, 21, 22 | FR-5 | 26, 34 | FR-4 (see 4) | 51 | **missing** |
| 4, 5, 58 | FR-7, FR-8 | 27 | D-2810 | 52, 53, 54 | FR-6 (see 13) |
| 6, 17 | FR-6 | 28, 29, 30, 35, 66 | FR-2 | 55, 64 | FR-10 |
| 9, 10, 12, 13, 14 | FR-3 | 31, 32 | FR-13 | 56, 57, 59, 60, 61 | **missing** |
| 11 | FR-2 | 33, 68 | D-2808 (deferred) | 63 | FR-5 (cited, no text) |
| 15, 37 | FR-3 | 36 | D-2802 rule | 16, 20 | FR-3 / FR-5 (cited, no text) |
| 19 | FR-12 | 41 | FR-14 | 42–48 | FR-13 |
| 23, 24 | FR-10 | | | | |

QA: F3 FR-3; F8 FR-3/D-2807; F10, F11 FR-11; N7 FR-10; N3, N8 missing (26).

## Dev's four questions: what the record already answers

1. **Shell.** None is shared. `RegisterPage` (`src/app/registers/_components/shell.tsx:59`) wraps the registers in `mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14`; `documents/page.tsx:307` and `step-shell.tsx:45` carry their own copies; header and footer use `max-w-5xl`; home is `max-w-5xl` with `max-w-2xl` per section. So `PageShell` is new in `src/components/` and `RegisterPage` its first consumer; home, the result step and the checklist view need structure work.
2. **DataTable.** It takes `columns: readonly string[]` and `rows: readonly (readonly string[])[]` (strings only): no row href, no cell renderer, no sort, and its under-640 mode is `dt`/`dd` with 12 px labels and no tag. FR-8 needs node cells (`Tag`, title link), a row href, sticky `thead`, 48 px rows, and `RegisterList`'s cards under 640. Obvious answer: a sibling `RegisterTable`.
3. **Lint.** `copy-lint.test.ts`'s walker extracts customer text and ignores `className`; a regex over file text suffices. Obvious answer: a separate `tests/class-lint.test.ts` reusing `walkDir`.
4. **Estimate.** Not in the record. From the counts in 23: A as written is the largest session yet; B is one session once the columns arrive; C is one to two. The "before" heights are already measured (supports 5,957 px, result open 5,075 px, which-audit guide 6,665 px at 1280).
