# Review of REQ-028 (third pass)

Reviewer: independent reviewer, 17 Oct 2026. Version reviewed: v3 (PO, 17 Oct 06:10), `product/requirements/REQ-028-desktop-layout-and-design-system.md` at `origin/main` `45f4c04`, with Dev's response (306a83d). Code on `origin/next` `c85ca54`. Ratios recomputed with `tokens.ts`'s formula.

**Verdict: Ready with edits.** 0 blockers, 1 major, 4 minors, 1 nit. Of 32 to 45, 12 are closed, 2 partly (34, 41), 0 open. Each edit is one sentence or one value; 46 is the one that needs a decision, and REQ-013 FR-7 already makes it. With the six edits in, v4 can go to Dev without a fourth pass.

## The 14 second-pass findings

| # | State | Where v3 answers it |
|---|---|---|
| 32 | closed | D-2814 "Complaints: Ref, Received, Acknowledged ("Not yet" when null), Status (`ComplaintRow` holds no deadline)". "Not yet" is the complaint page's own cell (`complaints/[id]/page.tsx:39`). |
| 33 | closed | D-2804 "a short typed field that names a role, a reference, a document title or a policy number ... is allowed"; D-2814 names the eight (2 + 1 + 2 + 2 + 1, the seven plus the insurer: the count holds); D-2815 plants `what_could_happen`. |
| 34 | partly | D-2802 "line #798280 / #707B78 (amended from #7E8785 / #6B7673 ...)" passes (3.01 / 3.03 on mist), but the same sentence leaves Dev's pair as an alternative under a rule that cannot choose. See 48. |
| 35 | closed | FR-4 "No new legend: the component keeps its `sentence` prop and `readyLineSentence` default"; AC-4 "the sentence under it is REQ-025 FR-3's pack sentence, unchanged"; D-2803. |
| 36 | closed | FR-13 "each on its own `bg-surface` fill"; AC-2 "ochre, moss and signal on paper and surface ... never sit on mist, sky or a wash". Ochre on surface 5.39 / 4.55. See 51(c). |
| 37 | closed | D-2805 names the five tests; "`NEXT_LINE` and its test are deleted". |
| 38 | closed | FR-2 "`TOKEN_NAMES` gains the six names ... both dark blocks ... `TEXT_PAIRS` widens ... `min: 4.5 \| 3 \| 1.4`; the warm override ramp ... its `WARM_SCALE` pin and the monotonic test go in A1". See 50 for one more pinned test. |
| 39 | closed | AC-1 "`e2e/req-028-shell.spec.ts`; the public specs live in `e2e/`"; Test expectations "the `iphone` project ... takes no new name". |
| 40 | closed | FR-10 "Document pack · AUD N one-off", `priceLine`'s word (`home-copy.ts:32`); "both strings in `home-copy.ts`"; "a null price or `SUBSCRIPTION_OFF` omits that cell". No "399" in REQ text. |
| 41 | partly | AC-8 now bounds on a recorded baseline, but the gate has no reader and the bound is unmet by construction. See 47. |
| 42 | closed | FR-5 and FR-6 "`max-h-[calc(100vh-6rem)] overflow-y-auto`". |
| 43 | closed | AC-10 "record their CLS with `OpenOnLarge` in place"; D-2813 "set again on a change only when crossing into `lg`". But 46. |
| 44 | closed | FR-8 "unchanged (second pass 44)". |
| 45 | closed | D-2813 "`Disclosure` ... renders through it when its `openOnLarge` prop is set"; Dev response 4 "yes, one component". |

## New findings

46. **major, D-2813 / FR-6 vs REQ-013 FR-7.** The result's three sections already have an owner of `open`: `useRememberedOpen` (`result-step.tsx:132-181`, `localStorage` key `readyline.result.open`), passed to the local `Disclosure` as a controlled prop so a section a reader closed stays closed across reloads. D-2813's `OpenOnLarge` "owns its `open` state: set on mount when `matchMedia` matches", so at 1280 every reload re-opens what the reader closed (FR-7 undone on laptops), or two controlled `open`s fight. Dev response 4 is silent on it. Concrete casualty: `e2e/req-015-a11y.spec.ts:287-300`, on `desktop-chromium`, clicks the documents summary (closed today; open under `OpenOnLarge`, so the click now closes it), reloads and asserts `open`: it fails, or passes only because `OpenOnLarge` overrode the memory. Fix: D-2813 gains "`OpenOnLarge` takes an optional controlled `open`/`onToggle` pair; when given, the mount rule applies only when the caller has no remembered value for that section (first visit on the device), and the remembered value wins; the result's three sections pass `useRememberedOpen`'s state"; the unit test adds "remembered closed stays closed at `lg`"; D-2805's list of tests that change in C gains `req-015-a11y.spec.ts:287`.

47. **minor, AC-8 / FR-10 / Session C.** Two problems, the second my own from the second pass (41). (a) `req-025-c.spec.ts` only writes (`EVIDENCE=1`, under `product/evidence/req-025/`, named `home-height-<EVIDENCE_TAG>-<project>.json`) and reads no file, so the gate on `product/evidence/req-028/home-height-before.json` has no reader, a different directory and no project suffix. (b) The bound: D-2810's cut is on `next` (`whatHeading` gone), the hero's `lead` exists (`home-copy.ts:22`), FR-12 takes the phone h1 from 30 to 32 px, and FR-10 adds a two-cell strip at 360 that nothing offsets, so "does not rise above the post-D-2810 measurement" fails by construction. Fix: AC-8 reads "`height <= baseline + 160`, `baseline` read by `req-025-c.spec.ts` from `product/evidence/req-028/home-height-before-android-small.json`, written by the spec's own `EVIDENCE=1 EVIDENCE_TAG=before` run with `DIR` from `EVIDENCE_DIR`; 5,000 stays the ceiling"; Session C names that spec as changed.

48. **minor, D-2802 / FR-2.** Two line pairs are named: #798280 / #707B78 as the value, then "Dev's dry run offers #74807D / #737F7C; the Dev takes whichever holds 3:1 on all three surfaces with the fewest other pairs moved". Both hold (reviewer's: paper 3.57 / 3.63, surface 3.89 / 3.25, mist 3.01 / 3.03; Dev's: 3.70 / 3.82, 4.03 / 3.42, 3.12 / 3.19), and `--line` is a foreground to no other pair, so the rule never decides, and `tokens.ts`'s drift check needs one value. Fix: take Dev's pair (3.01 is inside another formula's rounding) and delete the "whichever" clause.

49. **minor, FR-7 / lawyer's read.** "Download as a spreadsheet (CSV)" on every register page. Today four registers export (`exportHref` in `complaints`, `incidents`, `policy-reviews`, `worker-checks`); incidents and complaints serve `export.zip`, "the register and its events as two CSVs" (`incidents/export.zip/route.ts:4`), so for those two the label names the wrong file and the lawyer's "describe the file truthfully" is not yet true. Fix: FR-7 "where an export exists"; the `.zip` registers read "Download the register and its events (zip of two CSV files)"; the lawyer's read lists both labels.

50. **minor, FR-2 / Session A1.** `e2e/req-014.spec.ts:107` asserts the dark body background `rgb(20, 28, 27)` (#141C1B); the lift to #1B2422 makes it `rgb(27, 36, 34)`. FR-2 names the unit pins that break (38) but not this spec. Fix: name it in FR-2's ramp sentence as A1's one e2e change.

51. **nit.** (a) D-2802's header carries no "amended" after two amendments; D-2805 and D-2806 say "amended 05:40" though v3 changed both (37, 40). (b) FR-15 "Nothing matches. " has a space inside the quote. (c) `TEXT_PAIRS` holds ochre and moss on mist at 3 ("the ready line on its track"); FR-2's widening re-points those two to `--track` (Dev measured 3.3 / 3.2, 3.8 / 4.6), or AC-2's "never sit on mist" is contradicted by the list it loops.

## Answers to (i) to (vii)

**(i)** Not consistent as a rule: finding 48. The two pairs are stated, both pass, the tiebreak ("fewest other pairs moved") is zero for both; one hex pair must stand in D-2802 and `tokens.ts`.

**(ii)** D-2813 and Dev response 4 agree on the shape (`OpenOnLarge` the one client `<details>`, `Disclosure` the server wrapper with `openOnLarge`, `onToggle` follows the person) and on Dev's controlled-`open` note: D-2813's "following the person's own toggle through `onToggle`" is that note. One divergence: Dev says "following the change event", D-2813 "only when crossing into `lg`"; D-2813 governs and Dev's unit test should add the crossing case. Both miss the remembered state (46).

**(iii)** Safe. `WARM_SCALE` is imported only by `src/lib/theme/tokens.test.ts` (lines 15, 80 to 102); nothing under `src/`, `tests/` or `e2e/` else names it or `--color-zinc-*`. The `@theme` ramp (`globals.css:69-79`) goes with the classes it serves, as FR-2 says. The one other pin is finding 50.

**(iv)** Not workable as written: finding 47. The spec writes, never reads; the path and name differ from the writer's convention; the baseline from `next` is post-D-2810 (the cut is merged), which is right, but FR-10's strip makes the bound unmet.

**(v)** Every D number referenced (D-2801 to D-2816 and the fourteen from other REQs) exists. D-2810 after D-2816 follows the repo's practice: REQ-027 lists D-2708 after D-2712, REQ-024 lists D-2222 between D-2407 and D-2408. Status, Review and Decisions agree on what v3 amended, except the headers in 51(a).

**(vi)** Nothing contradicts Dev's estimate (65 to 79 hours; A1 17 to 21 with `OpenOnLarge` at 1 hour, as Session A1 lists) or the four findings: 1(a) is FR-2's "both dark blocks", 1(b) FR-2's ramp deletion (less than the "coupling" Dev costed), 1(c) D-2802's amended values with 48's loose end, 1(d) D-2802's `--rule` floor. Dev's "nine new `TEXT_PAIRS`" is under AC-2's list (about twenty-two in all): a dry-run count, not a contradiction.

**(vii)** All seven strings pass `BANNED_WORDS` and `INTERNAL_PATH` (`copy-lint/rules.ts:25-44`) and use words already on the product: "Not yet" (`complaints/[id]/page.tsx:39`), "(zip)" ("Download all (zip)", "Export my data (zip)"), "spreadsheet" ("Import from a spreadsheet"), "Go to your next step" beside the strip's "Your next step." Two notes: "Nothing matches." sits beside the registration-groups guide's "No matches. Try another word, or clear the search to see every group." (`groups-search.tsx:110`), one state in two voices, so FR-15 should take the guide's words or say why not; and "(CSV)" is untrue for two registers (49).
