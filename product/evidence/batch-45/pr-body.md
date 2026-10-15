## REQ

Batch 45 (`product/NEXT.md`, "## Batch 45"): the fixes from the seven role reviews of 14 October 2026, in two sessions plus item 28; decisions D-2001 to D-2006 and D-1706; statuses under the batch in NEXT.md. Touches REQ-004, REQ-005, REQ-006, REQ-007, REQ-009, REQ-013, REQ-016, REQ-017 and REQ-018.

## What changed

Session A (the app):

1. Home page: the "[Name and ABN to be added when registered.]" placeholder is gone; "It is registered as <name>, ABN <abn>." renders only when `BUSINESS_NAME` and `BUSINESS_ABN` are set (`businessName()` beside `businessAbn()`, `.env.example` updated).
2. `/documents` with generation off: no Buy box, one line "Document generation is not switched on in this environment."; the generate action says the same; `coming soon` is a banned phrase in the copy lint.
3. `/path/audit-day`: groups sorted by the ASK order; the guided-path spec asserts the five headings in order.
4. Every checklist item carries an `ask` string (what the auditor says); the audit-day page and its print sheet quote it; the derive test holds every ask to the auditor's voice.
5. `/account`: the Registers card reuses `registerOverview` ("1 entry", "2 entries"); "Due soon" lists every item due within 30 days from `src/lib/registers/due-soon.ts` (pure, three unit tests).
6. Result page: one sentence that adds up, "Your checklist has N items: the X above plus Y about your workers, insurance and the audit."
7. A real space between the price spans on `/pricing` and `/documents`; the copy lint's boundary check catches a digit joined to a letter across spans (it found and fixed one more on `/admin`).
8. `/registers` intro says "(certification providers)"; a certification provider with a registration date sees "Your mid-term audit is due around <date>".
9. D-2001: `/pricing`, `/` and `/start/result` present the subscription first ("What keeps you audit-ready") and the pack second ("Where you start") as two halves of equal weight; nothing bundled, nothing discounted.
10. `/pricing` and `/ai`: one line that the AI and digital tools statement is the appendix to the pack's privacy policy, with the links.
11. Checklist item "A signed service agreement for each participant" under the participant group, with its ask, cited to the core service-agreements standard (verification-only providers: the HR standard, marked unverified).
12. D-2002: first-party counters (`daily_counters`, `bump_counter`, no anon or authenticated grant, D-052): page starts on `/start`, results shown, buy clicks, subscribe clicks, finished packs; shown on `/admin` for the last 30 days; counted after the response, never blocking.
13. Tests for items 3, 4 and 5; the subscription lifecycle's second case and the registers spec on iPhone were already in place (said, not touched).
14. `product/evidence/req-005/sole-trader/`: the current set re-rendered, the two retired AI documents removed (17 files).
15. Worker screening procedure: a fixed, unnumbered "Who these steps apply to" section (the sole worker's sentence; a team's sentence otherwise), recorded prompts untouched (D-542).
16. Incident form: "Date it was reported".

Session B (fixed text and templates, from the Rules as read; `product/research/ndis-watch/2026-10-15.md` quotes every section relied on; `data/watch-changes.json` wc-2026-10-15-01 to -06, D-2004):

17. The paper incident and complaints register templates carry the app's columns (`INCIDENT_COLUMNS`, `COMPLAINT_COLUMNS`, `CLEARANCE_COLUMNS` in `src/lib/registers/names.ts`) with INC-0001 and CMP-0001 example rows; the detail pages and the worker check form use the same words; `names.test.ts` holds the tables to the list.
18. Retention schedule as a fixed, sourced table: reportable incident records 7 years from notification (Incident Rules s 25(2)); complaint records 7 years (Complaints Rules s 10(3)); the two worker screening lists 7 years (Worker Screening Rules ss 20 and 21); the rest "no period set in the Rules; we keep it 7 years, our choice"; the blanks are gone and exam Q04 is must-pass again.
19. The 24-hour sentence everywhere: "within 5 business days; within 24 hours if the use of a restrictive practice also caused serious injury or is itself abuse or neglect (Incident Rules ss 20 and 21)".
20. NOT DONE: the Commission's reportable incidents page URL and read date; ndiscommission.gov.au timed out three times from the Dev machine; marked UNVERIFIED, to be retried.
21. Clearance register cadence from `reviewCyclesFor(type).registerMonths`, so it can never disagree with the review cycles.
22. Clearance register columns match the app; the app gains an optional `clearance_number` (migration `20261015010000_clearance_number.sql`: letters, digits, spaces, slash and dash, never a participant-number shape; form, action, CSV export and detail page).
23. Governance policy: fixed "Telling the Commission about changes" section, a table of the s 13 changes and s 13A events with their timing, one cooperation sentence; the Act's s 73F named as the head of power only.
24. Worker screening fixed text: pending means supervised, excluded or barred means no work with participants (Worker Screening Rules ss 13 to 15).
25. Privacy policy: the Code of Conduct and the Australian Privacy Principles sentence in a fixed "The law we follow" section.
26. Incident policy and safeguarding position: "We do not use restrictive practices. If one is used in an emergency, we treat it as an unauthorised restrictive practice and this is what we do: the steps below." for a provider that uses none.
27. Briefs: recorded as recording group 6 in `fixtures/generation/README.md`; the live briefs are untouched because a changed brief changes the recorded prompts' hashes (D-542).

Item 28 (PO, 15 Oct, after #34):

28. `e2e/signed-in/account-setup.spec.ts`: a fresh user creates the account through `/account/setup` as a customer would, on all three projects; definition of done item 11 (every customer form has one e2e through the real handler) and the matching review-checklist line.

The REQ-018-gated items (PO, 15 Oct 10:45, after REQ-018 reached main):

29. The twelve audit-day records in two tiers: "Records the standards name" (document control, corporate risks, insurances, staff matrix, incidents, complaints) and "Records auditors often ask for" (decisions, participant risks, conflicts of interest, delegations, improvements, onboarding), with "kept on paper" after the two signed-or-issued ones (insurances, onboarding). One list in `src/lib/registers/names.ts` (`tier`, `paper`, `itemsToPrepareByTier`, `auditRecordTier`); `/path/audit-day` renders the two groups (`ask-tier-named`, `ask-tier-practice`, still 12 list items); the self-assessment's "Items to prepare before the audit" has a lead line and a bullet list per tier (three skeleton snapshots updated, reviewed: one paragraph and one bullets block more each).
30. Incidents gain an optional `commission_reference` (migration `20261015020000_incident_commission_reference.sql`: text, max 40, letters, digits, spaces, slash and dash, never an NDIS-number shape, default ""), shown and editable only when the incident is reportable ("Tick reportable first" otherwise), in the register columns, the CSV export, the detail page and the incident register template's example row; changing it writes a `notified` event "Commission reference <ref>". The other two gated items (incident to improvement link; circulation per policy version) were delivered by REQ-018 itself.

Also in this branch: D-2003 (the three guides published), D-2005 (`.github/dependabot.yml` removed, the audit step stays), D-2006 (the Writing animation's main-thread cost measured over 10 s on android-small with CDP `Performance.getMetrics`), and the merges of `main` through #47.

## Security checklist (REQ-002 FR-7; tick or explain)

- [x] Every new or changed route handler and server action parses input with `parseInput` and a `strictObject` schema; free text is length-capped. The two new inputs are `clearanceNumber` and `commissionReference` (zod: trim, max 40, `[A-Za-z0-9 /-]`, default ""; the second also refuses an NDIS-number shape and needs `reportable`); `countEvent` takes a fixed event name from a closed list, no user input.
- [x] No secrets, tokens or `.env` files in the diff; `BUSINESS_NAME` is new in `.env.example` (lives in Vercel beside `BUSINESS_ABN`).
- [x] Logs go through `@/lib/logging` and contain no emails, tokens, free text or participant-like data (the counters log event names and counts only).
- [x] Security headers and CSP unchanged.
- [x] No new external origin.
- [x] No new dependencies.
- [x] The new free-text fields (`clearance_number`, a worker's check number; `commission_reference`, the Commission's own reference for a reportable incident) are not participant data; each column's CHECK refuses an NDIS-number shape, the forms say what they are for, and neither is sent to prompts, emails or logs (the incident event note carries the reference, which is the provider's own record). Register text is never sent to the model (unchanged).
- [x] Tenant data: `worker_clearances` and `incidents` each gain a column under the same row-level security; `daily_counters` has no anon or authenticated grant and is written only by the service key through `bump_counter` (D-052); `tests/integration/counters.test.ts` covers the function and the grants and runs in the Supabase job.

## Tests and evidence

- `npm run check`: green on the branch head (115 files, 824 tests, 6 skipped); the orphan-jobs rule adds one file and four tests, the gated items add six.
- Merge precondition: this branch carries two migrations (`20261015010000_clearance_number.sql`, `20261015020000_incident_commission_reference.sql`). `migrate.yml` applies them on push to `main` through GitHub Actions, which the billing lock holds; until Actions is back, push them with `supabase db push --include-all --db-url` before or at the merge, or the next deploy's incident and worker-check forms fail on the missing columns.
- `npm run test:e2e`: the 24 public specs on desktop-chromium, android-small and iphone against a production build in fake Stripe mode: 230 passed, 11 skipped (iPhone's test match), 4 failed in the full run. Of the four: the checklist teaser on desktop and Android still asserted batch 36's 'no count line' while item 6 adds one, so the spec now asserts the count line and that its numbers add up (green on both); the footer-on-every-route test on Android and the magic-link cross-context test on desktop both passed when rerun alone, the first a load artefact of the full run, the second the two projects' requests colliding at the hosted auth. GitHub Actions is under the billing lock, so there is no CI run; npm audit --omit=dev --audit-level=high: 0 vulnerabilities.
- Not run: the signed-in specs (`account-setup`, `registers` due-soon lines, `guided-path` heading order and ask words, `counters` integration test). They need a Supabase stack with this branch's migrations; Docker is not on the Dev machine, GitHub Actions is under the billing lock, and running them against the hosted project would create and delete test users there. Asked the PO for a decision in CHAT.
- Screenshots at 360px and desktop: `product/evidence/req-017/` (guided path) and the role-review evidence under `product/qa/role-reviews/2026-10-14/`.
- Delivery evidence: the three statuses under "## Batch 45" in `product/NEXT.md`.

## Claims, brand, privacy

- [x] New copy passed `findProhibitedClaims`; `{{BRAND}}` placeholder used; Australian spelling. The fixed-text sentences cite the Rules by section; nothing promises an audit outcome.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
