# Review of REQ-028 (second pass)

Reviewer: independent reviewer, 17 Oct 2026. Version reviewed: v2 (PO, 17 Oct 05:40), `product/requirements/REQ-028-desktop-layout-and-design-system.md` at `origin/main` `d9e9425`. Code on `origin/next` `c85ca54` (D-2814's SHA). Ratios are my recomputation with `tokens.ts`'s WCAG formula.

**Verdict: Not ready.** 0 blockers, 5 majors, 7 minors, 2 nits. Of the 31 first-pass findings, 26 are closed, 5 partly, 0 open. Each major is one sentence or value, but each needs a PO decision, so the third pass can be short. First three: 32, 33, 34.

## The 31 first-pass findings

| # | State | Where v2 answers it |
|---|---|---|
| 1 | closed | FR-1 "Four page kinds: … and grid". |
| 2 | closed | D-2813 `OpenOnLarge`, "one render, no second heading". See (g). |
| 3 | closed | FR-8 "no sort control". |
| 4 | closed | FR-4 "keeps its two quantities (`done`, `todo`; D-1310)"; D-2803 "still to do, not to prepare". The legend sentence raises 35. |
| 5 | closed | AC-8 "under 4,600 px". The number raises 41. |
| 6 | closed | AC-1, AC-2, AC-9 name projects and specs. The path raises 39. |
| 7 | closed | FR-1's forbidden and allowed sets. |
| 8 | closed | D-2811 "the card mode's `dt` labels under `sm` are 14". |
| 9 | partly | FR-2 names `tokens.ts`; "a new `TOKEN_PAIRS` list" ignores `TEXT_PAIRS`. See 38. |
| 10 | closed | D-2802 "rule #D4CCBF … (light amended from #D9D2C6)". Recomputed 1.44. |
| 11 | partly | AC-2 measures `--line` on three surfaces; D-2802's values fail it. See 34. |
| 12 | partly | D-2814 drops the titles; the fixture plants the name in both. But 32, 33. |
| 13 | partly | D-2805 "amends REQ-027 D-2707 and FR-3a", names two tests; two more exist. See 37. |
| 14 | closed | D-2801 "no phone element moves except the four FR-5 and FR-6 name". |
| 15 | closed | D-2811, brand.md amended in A1. |
| 16 | closed | FR-2's mapping table. |
| 17 | closed | FR-7 "the three groups the index has today"; "N of 15 registers started" (matches `registers/page.tsx:143-157`). |
| 18 | closed | FR-7 names `set.zip`'s size and "the newest `audit_log` row". |
| 19 | closed | D-2806 "the three sentences … stay as prose … unmoved". The cells raise 40. |
| 20 | closed | Domain rules "this REQ cites no section of its own". |
| 21 | partly | As 12. |
| 22 | closed | SR-2 "client code only where FR-3 …, FR-5 and FR-6 … say". |
| 23 | closed | D-2812, A1 and A2. |
| 24 | closed | Evidence lists sixteen routes. |
| 25 | closed | D-2815, "seeded through the admin client". |
| 26 | closed | Scope: N8 "goes to Dev now"; N3 "is REQ-027's record". |
| 27 | closed | FR-15 covers 51, 56, 57, 59, 60, 61; 16, 20, 63 have text. |
| 28 | closed | The three labels in FR-7. |
| 29 | closed | No change, as agreed. |
| 30 | closed | D-2816, both pricing buttons `btn-secondary`. |
| 31 | closed | D-2814 "One `Tag` vocabulary serves all fifteen because every register's `statusOf` already returns a `ListStatus` with a tone". True. |

## New findings

32. **major, D-2814 / FR-8 / AC-6.** "Complaints: Ref, Received, From (code), Status, Due." No due value exists: `ComplaintRow` (`src/lib/registers/types.ts:302`) has `received_on`, `acknowledged_on`, `resolved_on` and no deadline, and `listComplaints` reads the table with no status view. AC-6 asserts "D-2814's columns"; the read says "VERIFIED against the registers' own forms". Fix: "Acknowledged" (`acknowledged_on`, "Not yet" when null), the date the status already keys off.

33. **major, D-2814 vs D-2804 / SR-1.** "Every column is a code, a date, a fixed-vocabulary word, a role or a status; the one typed-text column is the insurances label." Seven are typed text: corporate risks "Owner (role)" (`owner_role`, `kind: "text"`, `audit-day-forms.ts:157`); improvements "Reference" (`:440`) and "Who does it" (`:462`); delegations "Role" when other (`role_label`, `:339`); staff matrix "Role" (`role` nullable select or `role_label` text, `:572`; D-2814 does not say which); insurances "Policy number" (`:396`); policy reviews "Document" when other (`reviewTitle` returns `r.title`, `policy-reviews/page.tsx:36`). None is a name field and each role field's help says "never a person", but D-2804's "A column that would put free text in a scannable grid is refused" is broken by the REQ's own list, and D-2815's fixture plants the name only in a note and a summary. Fix: D-2814 names the seven as "role, reference or title fields, capped and hinted 'never a person'"; D-2804's refusal narrows to free narrative (what happened, controls, notes); the fixture plants the name in one narrative field of an audit-day register too (`what_could_happen`).

34. **major, D-2802 / AC-2.** AC-2: "`--line` on paper, surface and mist at least 3:1". Light `--line` #7E8785 on mist #E6E0D6 is **2.81:1**; dark #6B7673 on dark mist #27322F is **2.82:1** (on dark surface 3.02). D-2802 ships the failing values with "the Dev adjusting it to the nearest value that does"; the REQ should name it, as it did for `--rule`. Nearest on the same hue: light **#798280** (3.01 mist, 3.57 paper, 3.89 surface); dark **#707B78** (3.03 mist, 3.63 paper, 3.25 surface). Fix: those two in D-2802.

35. **major, FR-4 / AC-4 vs REQ-025 FR-3 and FR-7.** FR-4 "the legend reads 'N done · N still to do'"; AC-4 "the legend reads '0 done · N still to do'". On the result page the sentence under the line is REQ-025 FR-3's pack line passed as a prop (`result-step.tsx:396 sentence={lines.pack}`: "The pack drafts all N so they match; your checklist shows which to compare with what you have.", `readiness.ts:54`), and the component's default already reads "N of M things in place, N still to do." (`ready-line.tsx:19`). AC-4 either replaces a REQ-025 sentence (against the Why's promise) or puts two sentences under one line; "done" is not the result's word (D-2718's "have"), and FR-7's index line reads "N of 15 registers started". Fix: FR-4 keeps `readyLineSentence` and the `sentence` prop; AC-4 asserts the ochre segment at 0 done and the existing sentence; D-2803's legend goes.

36. **major, FR-13 / FR-3 vs D-2802 and AC-2.** D-2802: "ochre … only on paper or surface (ink on mist)". FR-13 puts a 13 px `Tag` with an ochre variant (`text-ochre`, `register-list.tsx:25`) in link rows that take `hover:bg-mist`; FR-3's choice rows take `hover:bg-mist` and `bg-sky`. Ochre on mist is **4.17:1** light / 4.24 dark, on sky 4.36 / 4.28: under 4.5 on every register row's hover. AC-2 fails if ochre is in the pairs and is silent if not. Fix: the `Tag` carries its own `bg-surface` fill (ochre on surface 5.39 / 4.55) so a hover never sits under its text; `TOKEN_PAIRS` lists ochre, moss and signal on surface.

37. **minor, D-2805.** The named tests miss `e2e/req-015-a11y.spec.ts:274` ("Start getting ready"), `src/app/start/_components/steps/result-copy.test.ts:85` (`/^Next: sign in, then/`) and `tests/copy-lint.test.ts:179`'s entry. Fix: name them; delete `NEXT_LINE` and its test.

38. **minor, FR-2 / AC-2 vs `tokens.ts`.** (i) `TEXT_PAIRS` (`min: 4.5 | 3`) already exists and the test loops it over both themes. (ii) `TOKEN_NAMES` must gain the six names or the drift check never sees them. (iii) The test pins `WARM_SCALE["950"]` to `TOKENS.dark.paper` and asserts `--color-zinc-950: #141c1b`; lifting dark paper to #1B2422 breaks both. Fix: extend `TEXT_PAIRS` (`min: 4.5 | 3 | 1.4`), widen the names, and delete the zinc block, `WARM_SCALE` and their assertions in A1, since the lint makes them dead.

39. **minor, AC-1 / AC-9 / Test expectations.** `e2e/public/` does not exist; public specs are `e2e/*.spec.ts`. The `iphone` project runs only the specs its `testMatch` names (`playwright.config.ts:54`), so "three projects" needs the two new names there, while the ACs say two. Fix: `e2e/req-028-*.spec.ts`; say two projects, or add the regex line.

40. **minor, FR-10 / D-2806 vs `home-copy.ts` and `readPricing`.** Both prices exist (`packPriceCents`, `subscriptionPriceCents`), both nullable; the subscription line renders only when `subscriptionAvailable()` and a price is set, otherwise `SUBSCRIPTION_OFF`. FR-10 says nothing about either case. "AUD 399 once" sits beside `priceLine`'s "one-off"; the cells are new customer strings outside `HOME_COPY` and the claims lint. Fix: "Document pack · AUD N one-off", both cells in `home-copy.ts`; a null price omits its cell; "399" is a fixture value, not REQ text.

41. **minor, AC-8.** Last recorded height: 4,880 px at 360 (`product/evidence/req-025/home-height-after-android-small.json`, 15 Oct), before two additions took it to "exactly on" 5,000 (D-2810) and before the cut; the post-cut number is in #82's run, not the record. Five bullets are 200 to 300 px, so the page sits near 4,700 to 4,800 today, and FR-10 adds a lead sentence and two stacked cells (120 to 150 px). 4,600 is likely unmet. Fix: AC-8 asserts "no higher than the post-D-2810 measurement", with that number written in.

42. **minor, FR-5 / FR-6.** The supports aside (hint, open glossary, "Ticked so far (N)", counts, draft status, "Start again") and the result's summary card are `sticky`; `desktop-chromium` is 1280 × 720, and a sticky block taller than the viewport cannot be read below the fold until the page ends. Fix: `max-h-[calc(100vh-6rem)] overflow-y-auto`, or sticky for the first block only.

43. **minor, D-2813 / AC-10.** See (g).

44. **nit, FR-8.** "one hint sentence, lawyer-read" reads as new copy; the hint exists (`audit-day-forms.ts:393`: "a driver's worker code (W-003). Never a number plate or a person's name"). Say "unchanged".

45. **nit, D-2813.** `supports-step.tsx:72` and `finish-form.tsx:18` already hold a `matchMedia` subscription; `OpenOnLarge` reuses it, and can be a prop of `Disclosure` (the Dev's question 4: yes).

## Answers to (a) to (g)

**(a)** Every D-2814 column exists as a field or a derived value except complaints "Due" (32). Seven columns are typed text (33). "Insurer, vehicle or driver" is `kind: "text"` with a help line that already asks for a code; v2 handles it by that hint and the lawyer's read, adequate for an insurer's name, and the same answer should cover the other six.

**(b)** `--rule` #D4CCBF on paper #F7F3EC: **1.44:1** (passes). Light `--line` #7E8785 on mist #E6E0D6: **2.81:1** (fails 3; paper 3.34, surface 3.63). Dark `--line` #6B7673 on dark mist #27322F: **2.82:1** (fails; dark paper 3.38, dark surface 3.02). Every text pair on the four surfaces passes 4.5 in both schemes (lowest: dark ochre on surface 4.55) except ochre on mist and sky (36). Ochre on `--ochre-wash` is 4.50 light and 4.38 dark: only ink and slate may sit on the washes.

**(c)** "See the price" is the existing link (`result-step.tsx:426`), no figure asserted anywhere: no collision. The two button labels collide only with the tests that assert "Start getting ready" (37). The legend collides with REQ-025 FR-3's sentence and the index line (35). "Next:" also appears in `audit-day-pages.tsx:117`, `worker-items.tsx:113` and two signed-in specs: the worker pages' lines, which stay.

**(d)** Finding 40: both prices exist and are nullable; "once" is not `priceLine`'s "one-off"; the cells are outside `home-copy.ts`.

**(e)** Finding 41: the post-D-2810 height is unknown from the record (last stored 4,880, 15 Oct); the margin runs the wrong way against FR-10's additions.

**(f)** The right file (it parses `globals.css`, loops a pairs list in both themes, pins the warm scale); the wrong shape, finding 38.

**(g)** The server renders `<details>` closed; on mount at `lg` the component sets `open`, so the sections appear after hydration: a one-time shift inside the right column (what follows moves; the sticky card does not), and a laptop reader without JS sees closed sections that still open by hand. Nothing happens under `lg`, so the phone fold and Lighthouse's mobile run (D-1012) are untouched. Accessibility: no concern; native toggling, no focus moves, one heading. Two asks (43): AC-10 records CLS at 1280 for the result and the supports step; the `change` listener sets `open` only on crossing into `lg`, so a reader who closed a section keeps it closed.
