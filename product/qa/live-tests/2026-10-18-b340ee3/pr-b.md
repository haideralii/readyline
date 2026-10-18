# QA live b340ee3, batch B (Dev-2): report B's defect and copy items, and the REQ-023 acceptance-read tests

Branch `qa-live-20261018-b` from `next` 22ae46a; PR to `next`. Thirteen commits, one per item, each with its test; disjoint from Dev-1's `qa-live-20261018-a` (no `fields.tsx`, stepper, `/pricing`, `/start/result` or questionnaire step is touched).

## Report B and the copy items (PO 08:30)

1. **B #57, medium (bf013f2).** The unknown-token routes (`/email/unsubscribe`, `/report`, `/auditor`, `/invite`) and `/admin` signed out served the 404 body with the server title "Page not found | Readyline", then the RSC payload's static metadata swapped the tab title to the route's own after hydration. Each route now answers its title from `generateMetadata`: the 404 title (shared with `not-found.tsx` through `src/lib/page-titles.ts`) when the token fails its pattern or its lookup, the route's title otherwise; the lookup is wrapped in React `cache` so the title and the page share one call (one write for the unsubscribe). `/admin` has no static title and reads the admin context. `e2e/qa-live-b57.spec.ts` (desktop-chromium) reads `document.title` after hydration on six URLs: 6 failed on the old code, 6 pass now.
2. **Sign-in (0b40657).** The email field is `type="email"` with `inputmode="email"` and `autocomplete="email"`; `sign-in.spec.ts` asserts the three. The shared `TextInput` (`fields.tsx`, Dev-1's this round) is text-only, so the form renders the same control with its own type.
3. **0136 (3c652f6).** The Commission spells the group two ways in `data/sources`: the registration-groups list page (the build's name source) "centrebased", the Registration Requirements by Supports and Services document "centre-based". The hyphenated form wins (readable, the requirements document's, the description's) in `standards.meta.json`, `standards.json` and `registration-group-descriptions.json`; the slug is pinned to `group-and-centrebased-activities` in `groups.ts` so no link breaks; `groups.test.ts` holds both.
4. **Clear the search (fd073e2).** On `/guides/registration-groups` "clear the search" is a button that empties the box, returns the full list and puts focus back in it (REQ-028 FR-15); `guides.spec.ts` gains the case on desktop and Android.
5. **The cost guide (c9f23af).** Status `published (every figure checked in REQ-027's pass against the Sources section, 18 Oct 2026; no UNVERIFIED line remains)`, so the draft box goes; `pages.test.ts` holds no unverified line and no draft flag.
6. **The legal pages (2b1ef4d).** The draft sentence stays until the lawyer's review but closes the article as a small slate line under a rule, same words and test id; `legal-pages.spec.ts` holds it below the last heading in the small type.

## The REQ-023 acceptance read (PO 09:00)

7. **FR-8 (4d21396).** Integration case: a rehearsal row leaves `lastSelfCheck` null and the audit-day offer at "You have not checked your systems yet".
8. **AC-8/SR-5 (b2c0cac).** `team.spec.ts`'s owner-page list gains `/path/renewal`, `/path/renewal/application` and `/registers/commission-changes`.
9. **FR-7/FR-3 (c806519).** Two `dueReminders` cases: an application inside the s 73K window stops the last call; one from before the window does not.
10. **D-2849 (137396c).** Eight modules join the copy lint (`period.ts`, `what-changed.ts`, `commission-changes.ts`, `self-check.ts`, `templates.ts`, `worker-steps.ts`, `supervision.ts`, `worker-states-line.ts`); the lint found one thing, the 75-word ownership helper in `commission-changes.ts`, now 58 words with the Rule's quoted words kept.
11. **D-2245 (2218472).** `commission-changes.test.ts` asserts 42501 on the owner's delete and reads the grants back through `information_schema.role_table_grants` as `adoption-per-version.test.ts` does.
12. **D-2850 (26d474a).** FR-7's sentence in the REQ reads "the review count with a link to the review list".
13. **D-2316 to D-2320, D-2849 to D-2851 (203f2df).** Copied into `DECISIONS.md` in the log's format under their own heading, newest at the bottom; D-2851 (the states compared) is recorded there with nothing to build.

## For the PO (PO 12:06 (3)): the registration-groups full list and the glossary check

The groups index passes the glossary check only with the list filtered (the spec's "cleaning" case); with all 38 groups shown it trips on one term: **"restrictive practice"** (`restrictive-practice`), in the description of group 0110 (Specialist behaviour support), while the page's own disclosure explains `registration-group`, `practice-standards` and `module` only. The content item for the guide: either the 0110 description says the meaning in its own words, or `restrictive-practice` joins the page's `INDEX_TERMS`. Nothing else in the 38 names, descriptions, category lines or audit words trips the check.

## Checks

- `npm run check`: green, 177 files (1 skipped), 1,298 tests, 6 skipped.
- Every public spec in CI mode on the three projects from a production build, port 3100: 315 passed, 35 skipped, none failed in 17.6 minutes.
- `next` 22ae46a unchanged at the push (D-2827).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
