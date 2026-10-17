# REQ-028 Session A2: delivery evidence

Dev, 17 Oct 2026. Branch `req-028-session-a2` from `next` 76fc650 (A1 in), PR #94 into `next`, with `next` 71e6515 (A3) merged in before the last commit. The session's scope is FR-3 (the controls, the stepper, the chips, error clearing), FR-4 (the ready line), FR-13 (the components), FR-14 (the spacing pass) and FR-15 (the small states); no page's layout changed (that is Sessions B and C). The Dev's calls are D-2274 in `DECISIONS.md`.

## Commits

| # | Commit | What |
| --- | --- | --- |
| 1 | eaa9a1e | The controls (FR-3): `accent-color` ochre, the per-input focus classes gone so the global ochre ring applies, choice rows and the state chips on sky when checked (the states wrap as chips), `bg-surface border-line` on inputs and the Show steps control, error clearing on change through `clearFieldError` and `revalidateField` (`field-errors.ts` and its test, wired into the five step forms), the stepper's sr-only names and the current circle on paper under the ochre ring; `e2e/req-028-controls.spec.ts`; `req-015-a11y.spec.ts` refuses an `aria-prohibited-attr` incomplete |
| 1a | 3fa0ea9 | The controls spec names the error summary among the page's two live regions |
| 2 | 9e6dfc0 | The ready line (FR-4): `readyLineGeometry`, moss done over ochre still-to-do on an 8 px track, `--track` only at 0 of 0; `ready-line.test.tsx`; `e2e/req-028-ready-line.spec.ts` |
| 2a | b5c3706 | The ready-line spec reads the pack sentence by its shape, not its count |
| 3 | 34db13b | The components (FR-13): `Tag` with its variants and the `StatusTag`, `HaveTag` and pill adapters; `Disclosure` with the quiet variant, `openOnLarge` and `onSummaryClick`; `NavLinks` with the current-section underline; the button states, the footer, the link rows, the skip link and the error summary in `globals.css`; `tag.test.tsx`, `disclosure.test.tsx` |
| 3a | 462feb7 | The chevron as `summary.disclosure-summary::before`; the done step's link keeps `aria-label` and `req-013-p2.spec.ts` reads the current circle's sr-only text |
| 4 | f491770 | The spacing pass (FR-14): twelve `p-3` sites beside a `p-4` to `p-4`, the shell's page top `py-8 lg:py-12`, the lint's p-3/p-5 rule as a hard fail |
| 5 | 800efb5 | The small states (FR-15): the participant line once per form, the sample's callout once above the document on the ochre wash, the badge in the footer under lg, the empty search state in the guide's words with "clear the search", the delayed state's "Check again" and `mailto:`, the guide's draft note on the wash |
| 5a | 24384ba | The pressed transform stays on the two button classes (audit 48) |
| merge | 634396f (A3 in; 5b c86ecd3 moves A3's fill form onto the one padding step after the merged lint named it) | `next` 71e6515 (A3) merged in |
| 6 | (this) | The evidence, D-2274 |

## Acceptance criteria in A2's scope

| AC | Test | Level | Result |
| --- | --- | --- | --- |
| AC-3 | `e2e/req-028-controls.spec.ts` (a checked radio and checkbox compute `accent-color` to the ochre token and their row's background to sky; a keyboard-focused input's outline is the ochre ring; an error corrected on change loses its message, its summary entry and `aria-invalid` before the next submit); `src/app/start/_components/field-errors.test.ts` (the clearing and the revalidation, other fields untouched) | e2e, unit | green on `desktop-chromium` and `android-small`; unit in `npm run check` |
| AC-4 (the line) | `e2e/req-028-ready-line.spec.ts` (0 done: one full ochre segment, the pack sentence unchanged); `src/components/ready-line.test.tsx` (the two segments, the 0-of-N case, `--track` at 0 of 0) | e2e, unit | green on both projects |
| AC-4 (the fold) | REQ-015 FR-4's check and FR-6's two phone exceptions are Session C's (the result page's layout) | | not in A2 |
| FR-13 | `src/components/tag.test.tsx` (the variants, the icon, the wrap, the surface fill), `src/components/disclosure.test.tsx` (default and quiet, `openOnLarge`, the controlled state, the toggle); `e2e/home.spec.ts`, `req-027.spec.ts`, `req-013-p2.spec.ts` (the summaries' words unchanged after the chevron moved to the stylesheet) | unit, e2e | green |
| FR-14 | `tests/class-lint.test.ts` ("no file under src/app mixes p-4 with p-3 or p-5") | unit | green with the allow-list empty |
| FR-15 | `e2e/home-v2.spec.ts` (the badge that is visible for the viewport); `e2e/signed-in/registers.spec.ts:201` (the empty search state's words; the Supabase job); the participant line, the sample's callout, the delayed state and the guide's note by the screenshots below | e2e, screenshots | public specs green locally; the signed-in spec on #94's CI |
| AC-2, AC-9 | `e2e/req-015-a11y.spec.ts` and `e2e/req-028-type.spec.ts` re-run over the changed controls and components | e2e | green on both projects |

AC-1, AC-2 and AC-9 were A1's; AC-5 to AC-8 are Sessions B and C.

## Runs

- `npm run check` green on every commit (lint, format, typecheck, unit: 161 files, 1,167 tests at the head).
- Public specs from the main tree at each pushed commit, a production build first, both projects: at 462feb7 ten specs, 49 passed; at f491770 the same ten, 49 passed; at 800efb5 eleven specs (`req-015-width` added for the badge), 77 passed; at 634396f (A3 in; 5b c86ecd3 moves A3's fill form onto the one padding step after the merged lint named it) the eleven and the evidence capture, 81 passed.
- Red before green, each fixed in the next commit: the text chevron reached every summary's words and broke four specs (3a); `no-html-link-for-pages` on the delayed state's `<a>` (a `Link` in 5); Prettier on the generated edits (5).
- PR #94's CI (the `CI` workflow runs on the pull request only; a push to the branch runs the secret scan alone): red at 462feb7 and at 6dd49d4 on one assertion on all three projects, `e2e/req-025-b.spec.ts:76` reading `aria-label` from the current circle that FR-3 renamed with sr-only text; the Supabase job and the budgets green at 6dd49d4. A CI-mode run of every public spec on the three projects from a production build of 6dd49d4 in the main tree (288 passed, 25 skipped, 3 failed) found that spec and no other; 419e614 (6a) reads the circle's words and takes any span as the 44 px target, green in CI mode on the three projects with `req-013-p2`, `req-015-a11y` and `questionnaire`. The run at the head is the one to read.
- The gate from here: the last push of a session runs the whole public set in CI mode on the three projects (production build, `CI=true`, every `e2e/*.spec.ts` named explicitly so the signed-in specs never run locally), not a named subset on two.

## Screenshots (the after set, D-2271 (12))

`e2e/req-028-evidence.spec.ts` with `EVIDENCE=1 EVIDENCE_TAG=a2` at 634396f (A3 in; 5b c86ecd3 moves A3's fill form onto the one padding step after the merged lint named it): the fourteen public states in both schemes at 360 (`android-small`) and 1280 (`desktop-chromium`), 56 screenshots named `<state>-a2-<scheme>-<project>.jpg`, and `heights-a2-<project>.json`. Against A1's `after` set, the controls and components changed inside the same layout: the chips and choice rows on sky when checked, the stepper's current circle, the ready line's two colours, the tags with icons, the disclosures' chevron, the footer's badge at 360, the sample's callout above the document. The signed-in states (the register forms with the participant line, the empty search state, the documents page) are the Supabase job's `signed-in-screenshots` artefact on #94.

## Heights at 1280 (unchanged structure)

| Page | A1 after | A2 |
| --- | --- | --- |
| Supports step, every group open | 6,773 | 6,802 |
| Result, sections open | 6,609 | 6,708 |
| Which-audit guide | 6,539 | 6,532 |

The differences are the spacing pass (16 px inside cards, the page top) and the type of the controls; no section moved.

## Not in A2

The laptop layouts (B and C), the fold and phone exceptions of AC-4 and AC-5 (C), `RegisterTable` (B), the Lighthouse re-measure (C, when `OpenOnLarge` is in use on the result page), the VoiceOver note and the hallway test (after C).
