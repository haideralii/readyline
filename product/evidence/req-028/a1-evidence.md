# REQ-028 Session A1: delivery evidence

Dev, 17 Oct 2026. Branch `req-028-session-a1` from `next` b03ce46, PR #87 into `next`. The session's scope is FR-1 (the shell), FR-2 (the tokens, the mapping pass, the lint), FR-12 (the type) and D-2813's `OpenOnLarge`, built and unit-tested but used by nothing yet; no page's structure changed beyond the container, the tokens and the type. The Dev's calls are D-2271 in `DECISIONS.md`.

## Commits

| # | Commit | What |
| --- | --- | --- |
| 1 | 79693c2 | The six tokens and the record: `TOKEN_NAMES`, `TOKENS` in both themes, both dark blocks, `TEXT_PAIRS` at AC-2's thirty-one pairs; `req-014.spec.ts:107`'s pin moved |
| 2 | 678b164 | The mapping pass: 875 hits in 90 files; the zinc ramp, `WARM_SCALE` and its test removed |
| 3 | 1db15b3 | `tests/class-lint.test.ts` (colours over `src/`, widths over `src/app`) |
| 4 | f720650 | `a1-token-pairs.md`, every pair as measured, before and after |
| 5 | c5860e6 | `PageShell` and its four kinds; the header, the strip and the footer on its container; 41 wrappers in 38 files; `e2e/req-028-shell.spec.ts` |
| 6 | ff96dc9 | The type: the scale in `globals.css`, 138 headings stripped of size and weight utilities, `text-xs` to `text-sm`, `brand.md`'s floor; `e2e/req-028-type.spec.ts` |
| 6a | a45f814 | Follow-up: the class 0138 pill wraps at 360 (the type pass had pushed it past its row; D-2271 (6)) |
| 7 | 8be71c3 | `OpenOnLarge` and its unit tests |
| 8 | (this) | The evidence, `e2e/req-028-evidence.spec.ts`, D-2271 |

## Acceptance criteria in A1's scope

| AC | Test | Level | Result |
| --- | --- | --- | --- |
| AC-1 | `e2e/req-028-shell.spec.ts` (1280 and 1536: one left edge, one width; the h1's x on home and pricing); `tests/class-lint.test.ts` (no forbidden `max-w-*` under `src/app`) | e2e, unit | green locally on `desktop-chromium`; the lint in `npm run check` |
| AC-2 | `src/lib/theme/tokens.test.ts` (thirty-one pairs, both schemes, the 4.5, 3 and 1.4 floors; see `a1-token-pairs.md`); `e2e/req-015-a11y.spec.ts` (axe in both schemes at 360 and 1280) | unit, e2e | green locally on both projects |
| AC-9 | `e2e/req-028-type.spec.ts` (no serif body text, no readable text under 14 px, every h1/h2/h3 on the scale) | e2e | green locally on both projects |
| AC-10 | Lighthouse budget before and after, below; CLS with `OpenOnLarge` in place is Session C's (nothing uses it yet) | script | within D-1012's budget both sides |
| D-2813 | `src/components/open-on-large.test.tsx` (opens at lg on a first visit, stays closed under lg, a redundant change event opens nothing, a crossing into lg opens a closed section once, remembered closed stays closed at lg, the toggle reports through `onToggle`) | unit | 3 tests green |

AC-3 to AC-8 are Sessions A2, B and C.

## Runs

- `npm run check` green on every commit (lint, format, typecheck, unit: 153 files, 1,121 tests at the head, 1,115 passed and 6 skipped).
- Public specs at 8be71c3 from a clean `.next`, both projects: `questionnaire-a11y`, `req-028-type`, `req-028-shell`, `questionnaire`, `req-015-a11y`, `home`, `pricing`: 63 passed, 4 skipped (the shell spec on the phone projects), 5 failed on the `iphone` project under load; `questionnaire.spec.ts` alone on `iphone` a minute later: 13 passed. CI runs one worker.
- The a11y spec on `android-small` timed out at ff96dc9 and passes at a45f814: D-2271 (6).
- PR #87's CI at f720650 (commits 1 to 4): every job green, the Lighthouse job included.

## Lighthouse, before and after (AC-10)

Measured locally with the budget script and CI's settings (`LIGHTHOUSE_PAGES="/,/pricing,/start,/start/business"`, three runs, the median), the same machine minutes apart; the CI artefact needs a token to download. Full reports: `a1-lighthouse-before.md` (`next` b03ce46) and `a1-lighthouse-after.md` (8be71c3). Budget: performance 90+, LCP 2,500 ms, CLS 0.1, questionnaire JavaScript under 250 kB.

| Page | Performance before / after | LCP before / after | CLS | JavaScript before / after |
| --- | --- | --- | --- | --- |
| `/` | 92 / 91 | 1,891 / 1,919 ms | 0 / 0 | 143.8 / 143.8 kB |
| `/pricing` | 94 / 93 | 1,895 / 1,768 ms | 0 / 0 | 145.4 / 145.4 kB |
| `/start` | 90 / 90 | 1,721 / 1,761 ms | 0 / 0 | 191.8 / 192 kB |
| `/start/business` | 92 / 92 | 1,754 / 1,728 ms | 0 / 0 | 210.8 / 210.8 kB |

The differences are run-to-run noise: no byte of JavaScript moved and CLS stayed at 0 on every page.

## Heights at 1280 (the baseline for Sessions B and C)

Measured by `e2e/req-028-evidence.spec.ts` as `document.documentElement.scrollHeight` on `desktop-chromium` (`heights-before-desktop-chromium.json`, `heights-after-desktop-chromium.json`; the 360 files sit beside them). The first pass recorded the audit's heights as supports 5,957 px, result open 5,075 px and the which-audit guide 6,665 px.

| Page | Audit (first pass) | Before (`next` b03ce46) | After (A1) |
| --- | --- | --- | --- |
| Supports step, every group open | 5,957 | 6,459 | 6,773 |
| Result, sections open | 5,075 | 6,543 | 6,609 |
| Which-audit guide | 6,665 | 6,665 | 6,539 |

The guide matches the audit to the pixel, so the method agrees; the supports and result rows differ from the audit because the spec's fixture differs from the audit's walk (two classes ticked with the SIL questions shown, the not-sure helper, four workers, every result section open). A1 moved the heights after all, by the type and not by structure: body leading went from 25.6 to 28 px a line and the headings onto the scale, so the supports step grew 314 px, the result 66 px, and the guide shrank 126 px (its headings were larger than the scale). Sessions B and C measure against the "after" column. At 360 (`heights-*-android-small.json`): supports 10,031 to 10,519, result 9,237 to 9,333, guide 12,980 to 13,497.

## Screenshots

`e2e/req-028-evidence.spec.ts` with `EVIDENCE=1` and `EVIDENCE_TAG=before|after` captured the public routes the REQ names, full page, both schemes, at 360 (`android-small`) and 1280 (`desktop-chromium`), as `<state>-<tag>-<scheme>-<project>.jpg` in this folder (112 files, 16 MB at jpeg quality 35 and CSS scale; the PO may want a lighter rule for A2, B and C): home, pricing, sample, guide-which-audit, terms, sign-in, start-intro, step-1-business, step-2-supports, step-3-practices, step-4-workforce, step-5-already-have, step-6-result, step-6-result-open. The signed-in routes (documents, a document, the registers index, the incidents register, the checklist, the account page) come from the Supabase CI job's EVIDENCE run; its `signed-in-screenshots` artefact on PR #87's run is theirs. 1536 is the shell spec's measurement only, as the REQ says.

## #87 run 1 (38982864476, 4ecd5b7) and the fix

Six red lines, all the type meeting the phone rules (PO, 11:05): 200 % text overflow on the iPhone project on the registration-groups guide (404 against 402), the documents page with a ready set (404) and the incident detail (440), offenders unnamed; and words broken across lines in the corporate risks list at 360 on two projects. Found with a probe that lists boxes whose content overhangs them: the guide's h1 "Registration" at 64 px in a 338 px column (the which-audit guide's "certification:" the same, 416, on a page the pass does not visit). Fixed on the branch: `overflow-wrap: break-word` on h1 to h3; the register list row wraps so the title keeps 12rem before its status tag drops under it; the width report names overhanging boxes in its message; `req-028-type.spec.ts` adds the registration-groups guide and a 200 % text pass over its pages. D-2271 (13) and (14). The screenshots above predate the fix; at 100 % text nothing in them changes except the register list rows, which are signed-in pages the CI job captures.

## Not in A1

The asides are empty (B and C fill them); `OpenOnLarge` is used by nothing; the stepper's `aria-label` on spans is A2's; the three heights are expected unchanged by A1 and recorded for B and C to move.
