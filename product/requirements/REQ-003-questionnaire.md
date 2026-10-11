# REQ-003: Readiness questionnaire with save-and-resume
Status: ready (Dev response and a non-persistent prototype only; persistence waits for REQ-004)
Phase: 2   Priority: must   Owner: Dev

## Why
The questionnaire is the moment a tired sole trader finds out, in plain English, what registration will actually require of them: which Practice Standards modules apply, whether they face a verification or certification audit, whether a mid-term audit will follow, and which documents and registers they will need. Everything downstream (generator, checklist, pricing) keys off its answers. Commercially it is also the top of the funnel: the result page is where the one-off pack and the subscription are offered.

## Scope
In: the multi-step questionnaire UI, the answer model, derivation of the result using `deriveApplicability` from REQ-001, the result page content (modules, pathway, mid-term audit, reasons, document and register list), draft saving, validation, accessibility, tests. For this REQ, saving is in-memory plus a browser-local draft guarded by try/catch; server persistence, accounts and tenancy are REQ-004 and must not be started here.
Out: payments, document generation, accounts, email.

## Domain rules that apply
`product/domain/ndis-registration-primer.md` (registration pathway; registration groups; the four cases that depend on more than the group list). `data/standards.json` is the only source of group names, audit types, modules and rules; the UI must not hard-code any of them.

## Functional requirements
- FR-1 Steps, in order: (1) About the business: trading name, business structure (sole trader, partnership, company, other), states and territories operated in, ABN (optional, validated as 11 digits with the ABN checksum, no lookup). (2) Supports: choose registration groups from the 38 in `standards.json`, grouped by audit type with a plain-English one-line description per group (descriptions are ours, marked as such in data), with search. If 0138 is chosen, ask the Commission's two not-SIL-when questions verbatim and explain the outcome. If 0131 is chosen alone, explain the SDA-only rule. (3) Practices: do you use or plan to use restrictive practices (with the Commission's definition and a "not sure" option that links to an explanation and defaults to yes for derivation, flagged). (4) Workforce: number of workers including yourself, number of key personnel, whether any worker is in a risk-assessed role, whether all such workers currently hold a valid NDIS Worker Screening clearance. (5) What you already have: a checklist of existing items (policies, incident register, complaints register, insurance certificate, worker induction records), yes/no/not sure each. (6) Result.
- FR-2 Result page shows: audit pathway with one sentence on what that audit involves; applicable modules with the number of standards each; whether a mid-term audit applies and why; the reasons list from `deriveApplicability` in plain English with the source title and link; the document set and registers they will need (derived from modules and from step 5 gaps); and the general-information notice. No prohibited claims; copy passes `assertNoProhibitedClaims`.
- FR-3 Save and resume: progress and answers persist across reloads in this REQ via a browser-local draft (try/catch, never required to work), with a visible "draft saved locally on this device" note and a clear-draft control. When REQ-004 lands, the same answer model is stored server-side; design the model so that swap is a storage change only.
- FR-4 Back navigation never loses answers; changing an earlier answer re-derives the result; the result step is unreachable until required answers are valid.
- FR-5 Every field has a label, help text where the term is jargon, and inline validation messages in plain English. Free text is limited to trading name (max 120 chars) and an optional "anything else about your services" note (max 500 chars) that carries the participant-data warning from `CLAUDE.md` 4.5.
- FR-6 Answer model versioned (`answersVersion`), so later questionnaire changes can migrate drafts.
- FR-7 An "explain this result" expander per module lists the standards by name (from the dataset) so the user sees the scale of what is coming.

## Security and privacy requirements
- SR-1 All input parsed with zod at the boundary; unknown keys rejected; lengths capped; registration-group codes validated against the dataset.
- SR-2 No participant data anywhere: the only free-text fields are FR-5's, with the warning and the client-side detector from `CLAUDE.md` 4.5 (warn, not block).
- SR-3 Nothing from the questionnaire is sent to any third party or AI model in this REQ. No analytics.
- SR-4 The browser-local draft stores only the answer model, never derived documents; it is cleared by the user control and on account sign-in later (REQ-004).

## Data
`QuestionnaireAnswers` (versioned), `QuestionnaireResult` (derived, never stored in this REQ). Field list follows FR-1. Retention: local draft only, user-cleared.

## Acceptance criteria
- AC-1 Given groups [0120] only, when the result is shown, then pathway is verification, the verification module is listed, mid-term audit shows "does not apply", and the reason cites the Commission's registration-groups source.
- AC-2 Given groups [0120, 0107], then pathway is certification, core module listed, verification module not listed, mid-term audit applies at 18 months with the governance-and-operational-management scope stated.
- AC-3 Given group [0131] alone, then the SDA module is listed and the core module is not, with the SDA-only reason; adding [0120] adds the core module.
- AC-4 Given group [0118], structure sole trader, no other certification group, then modified certification is shown with the single core standard named.
- AC-5 Given restrictive practices = yes or not sure, then the implementing behaviour support plans module is added with the reason; given no, it is not.
- AC-6 Given group [0138] and an answer that matches a not-SIL-when exclusion, then the result says the service as described is not SIL under the Commission's definition and SIL is removed from the applicable modules with the reason shown.
- AC-7 Given a user completes steps 1 to 3, reloads, then the same step and answers are restored; given storage throws, the questionnaire still works with no error shown beyond the "could not save draft on this device" note.
- AC-8 Given an invalid ABN, then an inline message explains the format and the user can continue only by clearing or fixing it (ABN is optional).
- AC-9 Given the 360x740 project, then every step is usable with no horizontal scroll, touch targets are at least 44px, and Lighthouse accessibility is 95+ on each step.
- AC-10 All result-page copy passes `assertNoProhibitedClaims` in a unit test, and the general-information notice is present.
- AC-11 Keyboard-only navigation through all steps works; focus moves to the step heading on step change; errors are announced.

## Test expectations
Unit: answer schema, result derivation adapter, document-set derivation, claims check on copy. E2E (both projects): full happy path, back-navigation, reload-restore, storage-throws path (stub), ABN validation. Snapshot of the result page structure for the three reference cases.

## Evidence required on delivery
CI run link on the PR; screenshots of each step at 360x740 and desktop; Lighthouse accessibility scores; the e2e report; a short note on any dataset field you wished existed.

## Questions for Dev to answer before building
1. Propose the `QuestionnaireAnswers` zod schema and the step-to-field map before writing UI.
2. Which plain-English group descriptions will you draft, and where do they live in data so the PO can review them (they must be marked as ours, not Commission text)?
3. Form state approach (server actions vs client state with a single submit at the end) given Next 16 cache components and the eventual swap to server persistence in REQ-004; recommendation and trade-off.
4. Estimate in sessions.

## Dev response
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)
