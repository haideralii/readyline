# REQ-003: Readiness questionnaire with save-and-resume
Status: in progress (build approved 11 Oct 2026; persistence waits for REQ-004)
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

Written 2026-10-11 on branch `req-003-questionnaire` (from `main`; REQ-003 and `product/NEXT.md` were brought across from the PO's commit on the REQ-001 branch so this branch carries the requirement it answers). Dev response and the group-description data only; no UI, per NEXT.md item 3.

### Q1. `QuestionnaireAnswers` schema and step-to-field map

All schemas use `strictObject` and `text(max)` from `@/lib/validation` (REQ-002). Enumerations below are the only values accepted; everything else is rejected at the boundary.

```ts
const State = z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"]);
const Structure = z.enum(["sole-trader", "partnership", "company", "incorporated-association", "trust", "other"]);
const YesNoUnsure = z.enum(["yes", "no", "not-sure"]);
const GroupCode = z.string().regex(/^\d{4}$/).refine(isKnownGroup);  // checked against standards.json at parse time

export const QuestionnaireAnswers = strictObject({
  answersVersion: z.literal(1),                                   // FR-6
  business: strictObject({
    tradingName: text(120, 1),                                     // FR-5 free text 1 of 2
    structure: Structure,
    states: z.array(State).min(1).max(8),
    abn: abn().optional(),                                         // 11 digits + ATO weighted checksum, no lookup
  }),
  supports: strictObject({
    groups: z.array(GroupCode).min(1).max(38),
    silEligibility: strictObject({ fewHoursOnly: z.boolean(), participantManagesOwnWorkers: z.boolean() }).optional(),
    servicesNote: text(500).optional(),                            // FR-5 free text 2 of 2, carries the participant-data warning
  }).superRefine(requireSilEligibilityWhen0138),
  practices: strictObject({ restrictivePractices: YesNoUnsure }),
  workforce: strictObject({
    workerCount: z.number().int().min(1).max(500),                 // includes the owner
    keyPersonnelCount: z.number().int().min(1).max(50),
    hasRiskAssessedRoles: z.boolean(),
    allRiskAssessedScreened: z.enum(["yes", "no", "not-sure", "not-applicable"]),
  }),
  existing: strictObject({
    policies: YesNoUnsure, incidentRegister: YesNoUnsure, complaintsRegister: YesNoUnsure,
    insuranceCertificate: YesNoUnsure, workerInductionRecords: YesNoUnsure,
  }),
});

export const QuestionnaireDraft = strictObject({                   // what the DraftStore persists (FR-3, SR-4)
  answersVersion: z.literal(1),
  answers: QuestionnaireAnswers.partial(),                         // deep-partial per step while in progress
  currentStep: z.enum(["business", "supports", "practices", "workforce", "existing", "result"]),
  updatedAt: z.string().datetime(),
});
```

Step-to-field map: (1) About the business: `business.*`. (2) Supports: `supports.groups`, `supports.silEligibility` (shown only when 0138 is selected; required then), `supports.servicesNote`; the SDA-only explanation is shown when `groups` equals `["0131"]`. (3) Practices: `practices.restrictivePractices`. (4) Workforce: `workforce.*`. (5) What you already have: `existing.*`. (6) Result: derived, never stored.

Derivation adapter (`toDeriveInput`): `groups` as is; `businessStructure` passes through (the rule only distinguishes sole trader and partnership); `usesRestrictivePractices = restrictivePractices !== "no"` with a `flagged` marker when the answer was "not-sure" so the result page says "we assumed yes"; `silEligibility` passed when present. `QuestionnaireResult` = `deriveApplicability` output plus the document and register list, computed from the applicable modules' `evidence[].documentTypeId` values and the step 5 gaps.

### Q2. Group descriptions

Drafted all 38 in `data/registration-group-descriptions.json`: one plain sentence each, Australian English, under 170 characters, keyed by class code with the Commission's class name alongside. The file is headed by a note stating it is Readyline text, not Commission text, carries `author: "readyline"` and `status: "draft"` for the PO's review, and `data/registration-group-descriptions.test.ts` checks coverage of 0101 to 0138, sentence shape, no "client" or "patient", no prohibited claims, and (once REQ-001 merges) that names match `standards.json` exactly. The UI will load descriptions from this file and names and audit types from `standards.json`, never hard-coded.

### Q3. Form state approach

Recommendation: client-held answers with a server action for the result only.

- A single client component owns the answers in a reducer; each step validates its slice of `QuestionnaireAnswers` on blur and on "Save and continue"; back navigation keeps state (FR-4). Steps are routes under `/start/[step]` so the browser back button, deep links and focus management behave, with the state lifted into a layout-level provider.
- A `DraftStore` interface (`load`, `save`, `clear`) with a `localStorage` implementation now (every call wrapped in try/catch, "draft saved locally on this device" and "could not save draft" states, FR-3, AC-7) and a server implementation in REQ-004. The swap is a storage change only, as the REQ asks, because the draft shape is the versioned `QuestionnaireDraft`.
- The result step calls one server action `deriveResult(answers)` that re-validates with the full schema (SR-1), runs `deriveApplicability` against `standards.json` on the server, and returns the result with module and standard names. Nothing is persisted (SR-3, SR-4). Keeping the dataset server-side avoids shipping a large JSON to the phone; the group list for step 2 is a small derived array (code, name, audit type, description).
- Trade-offs: per-step server actions were rejected because without accounts there is nowhere to hold state between steps except the client anyway, and they add a round trip to every step on a slow phone; URL-encoded state was rejected because 38 codes plus text exceed sensible URL lengths and leak answers into history. Cache Components no longer applies (REQ-002 turned it off for the nonce CSP), so server actions and per-request rendering are the simple path.

### Q4. Estimate

Three sessions. A: answer and draft schemas, ABN checksum, derivation adapter, document-set derivation, `deriveResult` action, unit tests, descriptions loaded into the step 2 data. B: steps 1 to 5 as accessible forms with validation, DraftStore, focus management, 360px layouts. C: result page with reasons and expanders, e2e on both projects (happy path, back navigation, reload restore, storage-throws stub, ABN), Lighthouse scores, screenshots, evidence.

### Dataset fields I wish existed (for the PO)

A one-sentence plain-English description per module and per audit type (for the result page), and a document-set mapping that lists which documents a module requires rather than inferring it from evidence `documentTypeId`s. Both are Readyline content, not Commission text, and could live beside the group descriptions.

## Delivery evidence

### Session A (2026-10-11), branch `req-003-questionnaire` stacked on `req-002-security-baseline` (D-031)

PO review applied: group descriptions `status: "reviewed"` with `reviewedBy`/`reviewedAt`; `data/readyline-content/{modules,audit-types,document-sets}.json` created from the PO's text (keyed by dataset module ids, `poId` kept), each marked Readyline text and reviewed; `src/lib/questionnaire/content.test.ts` asserts every dataset module and both audit types have entries, class codes in rules are real, names match the Commission table, and no prohibited claims. `servicesNote` is stripped in `toDeriveInput` with a test that the derivation input contains neither the key nor the text.

Model and server: `src/lib/questionnaire/schema.ts` (strict `QuestionnaireAnswers` and `QuestionnaireDraft`, step schemas, ABN checksum field with the plain-English message, `answersSchemaFor(knownCodes)`), `adapter.ts`, `document-set.ts` (always set plus per-module rules with the personal-care and 0108 conditions; what the provider already has mapped onto documents and registers), `result.ts` (pure `buildResult`: pathway and description, modules with standard names and counts, mid-term audit, reasons with source title and URL, documents, registers, flags for assumed restrictive practices, large provider, SIL excluded, unverified), `groups.ts` (small group shape for step 2), `src/lib/standards/dataset.ts` (server-side dataset), and the server action `src/app/start/actions.ts` `deriveResult` (`parseInput` with `strictObject`, classes validated against the dataset, nothing stored).

Tests at the model level: AC-1 to AC-6 and AC-10 in `result.test.ts`; schema, ABN (AC-8 rule), draft version, unknown keys and SIL-eligibility requirement in `schema.test.ts` and `abn.test.ts`. Local: unit suite green, lint, format and typecheck clean, build ok (see Dev status in `product/NEXT.md` for counts). UI is Session B; e2e, screenshots and Lighthouse are Session C.

### Session B (2026-10-11): questionnaire UI

Routes `/start` (intro with resume and clear-draft controls) and `/start/[step]` for `business`, `supports`, `practices`, `workforce`, `existing`, `result`. Client provider holds answers; `DraftStore` interface with the local implementation (versioned draft, try/catch everywhere, foreign or malformed drafts discarded; AC-7). Gate: later steps and the result redirect to the first incomplete step (FR-4). Step shell: progress list with `aria-current`, "Step n of 6", heading focused on every step change (AC-11), draft status note ("Draft saved locally on this device" / "Could not save a draft on this device"). Fields: visible labels, help and error text wired with `aria-describedby`, `aria-invalid`, error summary with links that takes focus, 44px targets, 16px inputs. Steps: business (ABN checksum, AC-8 message), supports (38 groups grouped by audit type with search, Commission names and audit types from the dataset, Readyline descriptions, "mandatory from 1 July 2026" badge on 0137/0138, SIL exclusion questions when 0138 is chosen, SDA-only note when 0131 is alone, services note capped at 500 characters with the participant-data warning and a client-side detector that warns and never blocks), practices (the five regulated practices named, Commission link, "not sure" treated as yes and said so; D-306), workforce (bounds, large-provider note above 25; PO item 1), existing (five yes/no/not-sure questions). Result: pathway with the PO's description, groups in scope, modules with standard counts and an "explain this result" expander listing the standards (FR-7), mid-term audit with its reason, every reason with source title and link and an "unverified" badge where the Commission text does not settle it, documents and registers with what the provider already has, the general-information notice, change-answers and clear-draft actions. Home page links to `/start`. Commit `5acb288`.

### Session C (2026-10-11): tests, accessibility, evidence

**End-to-end (`e2e/questionnaire.spec.ts`, both projects):** happy path [0120] (AC-1: verification, verification module only, no mid-term, reason links to the registration-groups page, notice present, draft saved note); [0120, 0107] (AC-2: certification, core with 24 standards, no verification module, mid-term at 18 months on governance, expander lists "Person-centred supports"); back navigation keeps answers and the result and later steps are unreachable (FR-4); reload restores the step and answers and "Continue where you left off" resumes (AC-7); storage that throws still completes the flow and shows the note (AC-7); invalid ABN blocks with the inline message and clears to continue (AC-8); [0138] with an exclusion says the service is not SIL and removes the module with the reason (AC-6); "not sure" adds the implementing module and says it was assumed (AC-5); participant-data detector warns without blocking (SR-2); heading focus after each step (AC-11); no horizontal overflow at 360px (AC-9).

**Accessibility:** `e2e/questionnaire-a11y.spec.ts` runs axe (WCAG 2.1 A and AA) on every step and state, both projects, zero serious or critical violations (one contrast failure found and fixed, D-307). Lighthouse 12.8.2 accessibility, Playwright's Chromium: `/start` mobile 100, `/start/business` mobile 100, `/start/business` desktop 100, no failing audits (`product/evidence/req-003/lighthouse-summary.json`). Lighthouse cannot load gated steps on a fresh page, so axe is the per-step evidence (D-307).

**Screenshots (AC-9):** `product/evidence/req-003/` holds every step at 360x740 (`*-android-small.jpg`) and desktop (`*-desktop-chromium.jpg`): intro, business, supports, practices, workforce, existing, result with the core expander open. Captured by `e2e/questionnaire-screenshots.spec.ts` with `EVIDENCE=1`.

**Local check outputs (production server, commit at push):** `npm run check` clean (19 files, 222 unit tests); `npm run build` ok, all routes dynamic; `npm run test:e2e` with `CI=true`: all specs on both projects passed (security headers, home, questionnaire, axe; screenshot spec skipped without `EVIDENCE`); `npm run audit:prod` 0 vulnerabilities. CI link: https://github.com/haideralii/readyline/actions (runs on `req-003-questionnaire`; the PO verifies).

**Deviations and notes:** `@axe-core/playwright` added as a dev dependency (D-307). Evidence images are JPEG at quality 40 to keep the repo small (D-308). The `document-sets.json` conditions are a Readyline reading of the PO's bracketed notes (D-304). The branch is stacked on REQ-002 (D-301); after REQ-002 merges it needs a rebase onto `main` before its own PR is merged. Not merged; PO reviews the UI.

### 2026-10-11, PO batch 5: UI review items, branch rebuilt

Branch rebuilt as `req-003-questionnaire-rebuilt` on the rebuilt REQ-002 head (`main` already carries the Session A to C code through the PO's batch-5 commit afeab24; see the REQ-002 batch-5 note). The force-push of the original branch name is blocked for Dev in this session; the PO or Haider replaces `req-003-questionnaire` with this branch (commands in the batch-5 Dev status).

1. Labels: items the questionnaire did not ask about now read "To prepare"; "You said you do not have this yet" stays for the ones it did. A one-line legend sits above the documents list (`data-testid="have-legend"`) and a short "Same labels as the documents list" line above the registers.
2. "What happens next" block at the bottom of the result page (`data-testid="what-next"`), PO wording verbatim with the brand constant, no email capture. Note for the PO: because `main` now carries REQ-004, the header on the same page already shows "Sign in"; the sentence "Sign-in and the document pack are coming in the next releases" can be shortened to the document pack when REQ-004 is accepted.
3. Screenshots re-captured from the production server (`next start`, Playwright CI mode) for all seven steps on both projects; no dev overlay badge in any image. Same file names in `product/evidence/req-003/`.

Tests: the AC-1 happy path now asserts the legend, that "Not asked yet" no longer appears, and the "What happens next" block. Local on this commit: `npm run check` clean (244 unit tests), `npm run build` ok, questionnaire and axe specs in CI mode 24 passed on both projects, screenshot spec 2 passed.
## PO review
(PO fills in.)

**11 Oct 2026, Dev response review: ACCEPTED; build approved for Sessions A to C once PR #1 and PR #2 are merged.**

1. Schema and step map accepted as proposed. Two additions: `workforce.workerCount` max 500 is fine but show a "we focus on providers with up to 10 workers" note above 25 (positioning, not a block); the `servicesNote` must never be sent to `deriveResult` (strip it in the adapter, test it).
2. **Group descriptions: all 38 reviewed and approved as written.** Set `status: "reviewed"` and `reviewedBy: "po"`, `reviewedAt: "2026-10-11"`. No wording changes.
3. Form-state approach accepted: client-held answers, routes per step, one server action for the result, `DraftStore` interface with the local implementation now. Keep `standards.json` server-side as proposed.
4. Estimate accepted (three sessions).
5. On the "dataset fields I wish existed": agreed, and here is the content. Create `data/readyline-content/` with these files, each headed by the same not-Commission-text note, `author: "readyline"`, `status: "reviewed"`:

`modules.json` (one sentence each, for the result page):
- core: "The standards every registered provider is audited against: participants' rights, how your business is run, how supports are delivered, and the environments you deliver them in."
- verification: "A smaller set of four standards (people, incidents, complaints, risk) checked by a document review for lower-risk supports."
- high-intensity: "Extra standards for daily personal care that needs specific clinical skills, such as complex bowel care, tube feeding or ventilation."
- specialist-behaviour-support: "Standards for practitioners who assess behaviour and write behaviour support plans."
- implementing-behaviour-support-plans: "Standards for providers whose workers carry out behaviour support plans, including any regulated restrictive practices."
- early-childhood: "Standards for early intervention with young children and their families."
- specialised-support-coordination: "Standards for support coordination in complex or high-risk situations."
- sda: "Standards for owning or managing specialist disability accommodation as the housing provider."
- sil: "Standards, from 1 July 2026, for managing and delivering supported independent living packages: decision-making, safeguarding, practice governance and tenancy arrangements."

`audit-types.json`:
- verification: "A desk-based review of your documents by an approved auditor. No site visit. Typically the quicker and cheaper audit."
- certification: "A full audit: document review, a site visit, and interviews with your workers and some participants. Followed by a mid-term audit about 18 months after registration."

`document-sets.json` (first pass, PO content; module id to document type ids; REQ-005 refines):
- always (any registration): governance-policy, risk-management-policy-and-register, continuity-of-supports-plan, conflict-of-interest-policy, privacy-and-information-management-policy, records-management-policy, complaints-management-policy-and-register, incident-management-policy-and-register, worker-screening-and-recruitment-procedure, induction-and-training-procedure-and-register, code-of-conduct-acknowledgement, service-agreement-template, participant-rights-and-choice-policy, safeguarding-policy, emergency-and-disaster-management-plan, ai-use-and-governance-policy, ai-and-digital-data-handling-procedure
- verification: (the always set only)
- core: adds quality-management-and-continuous-improvement, feedback-and-participant-engagement-procedure, medication-management-procedure (if personal care groups), mealtime-management-procedure (if personal care groups), waste-and-infection-control-procedure, transport-safety-procedure (if 0108)
- high-intensity: adds high-intensity-skills-descriptors-and-training-register, clinical-oversight-procedure
- specialist-behaviour-support and implementing-behaviour-support-plans: add restrictive-practice-authorisation-and-reporting-procedure, behaviour-support-plan-implementation-procedure
- early-childhood: adds family-centred-practice-procedure, child-safe-practices-policy
- specialised-support-coordination: adds conflict-of-interest-in-coordination-procedure, complex-support-escalation-procedure
- sda: adds dwelling-enrolment-and-maintenance-procedure, tenancy-rights-and-dispute-procedure
- sil: adds supported-decision-making-procedure, sil-safeguarding-and-roster-oversight-procedure, practice-governance-framework, tenancy-housing-and-support-agreements-procedure
Registers (subscription, REQ-009) are derived from the same list: incidents, complaints, worker clearances, training, policy reviews.

Status set to `in progress`.

**11 Oct 2026, UI review of Sessions A to C (branch `req-003-questionnaire`, b2f1ee9, PR #3): ACCEPTED with three small changes; merge after REQ-002.**

Reviewed all fourteen screenshots and the evidence. The flow matches the REQ: six steps, plain English, every reason on the result page cites and links its Commission source, the general-information notice and AI disclosure are present, the local-draft note is honest, the ABN message is in plain words, and the supports step marks the two mandatory classes. CI on the branch: 222 unit tests green, Playwright green on both projects; the only red job is the inherited gitleaks finding from REQ-002, fixed in batch 5. Lighthouse 100 and axe clean per step accepted as evidence.

Changes (fold into the batch-5 rebase):
1. Result page labels: "Not asked yet" reads as a bug to a provider. Use "To prepare" for items the questionnaire did not ask about, keep "You said you do not have this yet" for the ones it did, and add a one-line legend above the list.
2. Add a short "What happens next" block at the bottom of the result page, honest and claim-free: "Readyline will draft these documents for you and keep your registers audit-ready. Sign-in and the document pack are coming in the next releases." No email capture yet (that needs the privacy page, REQ-008).
3. Re-capture the evidence screenshots from the production build (`next start`), not the dev server: the dev overlay badge ("N", "Rendering…") appears in several images and will confuse anyone reading the evidence later.

Noted for later REQs, not for this one: the supports step is long on a phone (38 cards); when the questionnaire gets real users, consider collapsing the two audit-type groups by default with the search open. The result page is where REQ-006 and REQ-007 will place the pack and subscription offer.

