# REQ-005: Document generator and `.docx` rendering
Status: ready (Dev response first)
Phase: 3   Priority: must   Owner: Dev

## Why
This is the product's front door: from the questionnaire answers, produce the tailored policy and procedure set and the Practice Standards self-assessment a small provider needs for registration, as editable Word documents that read as their own. It must be tailored (the regulator's own tools read audit reports; cookie-cutter packs are a risk, CLAUDE.md 3a), accurate to the Commission's standards (REQ-001 data), free of prohibited claims, and generated without ever sending participant data anywhere.

## Scope
In: document type catalogue; per-document templates as structured sections; AI drafting of tailored sections from questionnaire answers via the Anthropic API (server-side); JSON-schema validation of every model output; deterministic rendering to `.docx` and a PDF readiness summary; versioning and regeneration; a reviewer view showing which answers drove each section; the prohibited-claims gate; the prompt-injection fixtures; generation logging; storage of generated files per account in Supabase Storage (Sydney) behind RLS. Out: payments (REQ-007; in this REQ generation runs for any signed-in owner behind a feature flag), registers (REQ-009), email delivery.

## Domain rules that apply
`product/domain/ndis-registration-primer.md` (documents an auditor expects; language rules: participant, worker, provider, plain English); `data/readyline-content/document-sets.json` (which documents per module); `data/standards.json` evidence items (all `draft: true`: the PO reviews them standard by standard as part of this REQ, see "PO content" below); `CLAUDE.md` 4.2, 4.3, 4.5, 4.6 and 5.

## Functional requirements
- FR-1 Document catalogue `data/readyline-content/document-types.json`: for every id in `document-sets.json`, a title, purpose sentence, the standards and indicators it evidences (ids from `standards.json`), the fixed section outline, which sections are tailored by AI and which are fixed text, the review cycle (default 12 months), and the registers it references. PO reviews this file.
- FR-2 Generation pipeline per document: (1) assemble a context pack from the questionnaire answers and the account's business details only (never `servicesNote`, never register contents); (2) for each tailored section, call the model with a versioned prompt that supplies the section's purpose, the relevant standard and indicators verbatim, the business facts, and the house style; (3) validate the output against the section's JSON schema (headings, paragraphs, bullet lists, responsibility tables; no free HTML); (4) run `assertNoProhibitedClaims` and a terminology lint (participant/worker/provider; no "client", "patient", "guaranteed", "compliant with" as a claim); (5) render the full document from fixed text plus validated sections. A failed section retries once with the validation error in the prompt, then falls back to the fixed template text for that section with a visible "review and complete" marker.
- FR-3 Every document carries: the provider's trading name and ABN (if given), version, generation date, review-due date, a document control table, the general-information notice and AI disclosure (CLAUDE.md 4.2, 4.3), and a footer "Prepared with Readyline".
- FR-4 Self-assessment document: one row per applicable standard (from `deriveApplicability`) with outcome, indicators, "how we meet this" (tailored), evidence to retain (from the reviewed evidence items), and a status column the provider fills in.
- FR-5 Reviewer view (in-app): per document, each tailored section shows which answers it used and offers "regenerate this section"; a diff against the previous version is shown on regeneration.
- FR-6 Versioning: each generation creates a new immutable version set stored per account; the latest is downloadable as a zip of `.docx` files plus the PDF summary; previous versions remain downloadable for 12 months.
- FR-7 Tailoring guarantee: two different questionnaire inputs never produce byte-identical tailored sections; documents include the provider's name, structure, states and support types in defined sections (test).
- FR-8 Output quality: Australian spelling; Year 8 reading level target for policies (measure with a readability score in tests, warn above the target); headings numbered; tables for responsibilities and timeframes.
- FR-9 Feature flag `GENERATION_ENABLED` and a per-account quota (default 5 full generations per day) to cap AI spend; admin can raise it.

## Security and privacy requirements
- SR-1 Model called only from server code; `ANTHROPIC_API_KEY` server-only with a monthly spend cap set in the console; model id pinned in `ANTHROPIC_MODEL` and recorded in `generation_log`.
- SR-2 Prompt injection: questionnaire free text is excluded from prompts entirely; business fields are delimited and length-capped; the model has no tools; the output schema is enforced; red-team fixtures (instructions hidden in a trading name, in the ABN field, in states) must not change document structure or introduce prohibited claims (CI test).
- SR-3 No participant data by design: the context pack schema has no field that could hold it; a test proves register contents and `servicesNote` never reach the prompt builder.
- SR-4 Storage: generated files in a private Supabase Storage bucket, Sydney region, paths namespaced by account id, RLS policies on `storage.objects`, signed download URLs with short expiry; cross-tenant download test.
- SR-5 `generation_log` keeps prompt version, model, token counts, cost estimate, timestamps and account id; never the prompt text with customer fields beyond 90 days (purge job extension).
- SR-6 Rate limits on generation endpoints; quota enforcement server-side.

## Data
`document_types` (from data file), `document_versions` (account_id, version_set_id, document_type_id, status, storage_path, created_at), `generation_log`, `version_sets` (account_id, answers_snapshot_hash, derived_result_snapshot, created_at). Retention: versions 12 months after superseded; logs 90 days for content, 2 years for counts.

## Acceptance criteria
- AC-1 Given the reference questionnaire for [0120] (verification), when a full generation runs, then the set contains exactly the "always" document types plus none of the certification-only ones, each rendering to a valid `.docx` that opens in Word and LibreOffice (CI opens with LibreOffice headless and converts to PDF without error).
- AC-2 Given [0120, 0107], then the set adds the core-module documents, including medication and mealtime procedures, and the self-assessment lists all 24 core standards with verbatim outcomes.
- AC-3 Given two different providers' answers, then no tailored section is byte-identical between them, and each document contains the provider's trading name, structure and states where the outline says so.
- AC-4 Given a red-team fixture with injected instructions in business fields, then the output validates against the schema, contains no prohibited claims, and the injected text appears nowhere in the documents.
- AC-5 Given a model response that fails schema validation twice, then the section renders the fixed fallback text with the "review and complete" marker, the document still renders, and the failure is logged.
- AC-6 Given the owner regenerates one section, then only that section changes, a new version is recorded, and the diff is shown.
- AC-7 Given account A, when it requests a signed URL for a file of account B by path, then 403/404 and no download.
- AC-8 Given the quota is exhausted, then generation is refused with a plain message and no model call is made.
- AC-9 Every rendered document passes `assertNoProhibitedClaims` and the terminology lint (CI runs over the three reference sets).
- AC-10 Given `GENERATION_ENABLED` is false, then the UI shows "coming soon" and no endpoint generates.

## Test expectations
Unit: prompt builder (exclusions, delimiting), schema validation, renderer (structure snapshots), claims and terminology lints, quota. Integration: storage RLS, generation log. Model calls in CI use recorded fixtures (replay) so CI never spends money; a nightly or manual job runs three real generations and attaches the documents as artifacts for PO review.

## Evidence required on delivery
CI link; the three reference document sets as artifacts (PO reads them end to end); readability scores; the prompt versions; the red-team fixture list; storage policy SQL; a one-paragraph note on model cost per full generation.

## PO content (owed by the PO before Session B)
1. Review of every evidence item in `standards.json` (flip `draft` to reviewed or edit).
2. Review of `document-types.json` outlines once Dev drafts them in Session A.
3. House style note for the model prompt (tone, reading level, structure), supplied as `product/domain/house-style.md`.

## Questions for Dev to answer before building
1. Propose the section JSON schema and the renderer approach (`docx` library structure), with a 20-line sample of one tailored section's schema and rendered output.
2. Recorded-fixture strategy for CI: how prompts are keyed so a prompt change invalidates the fixture.
3. Readability measurement library and the threshold you recommend.
4. LibreOffice in CI for AC-1: feasibility and runtime.
5. Estimate in sessions; and the exact values Haider must supply (names only): expected `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.

## Dev response
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)

**12 Oct 2026, Dev response review (branch `req-005-generator`, 5359f04): ACCEPTED; Session A approved.** Decisions on the three flagged items: (1) the proposed `participant-money-and-property-procedure` is accepted into the core set (`document-sets.json` core list); (2) split `feedback-and-participant-engagement-procedure` into two documents: keep it for feedback and participant engagement, and add `support-planning-and-transitions-procedure` covering the support planning and transitions standards, because auditors sample those as separate evidence; (3) a sixth register `restrictive-practices` is accepted for REQ-009, applicable only when the implementing behaviour support plans module is in scope. Schema, replay-fixture keying, in-repo Flesch-Kincaid (warn above grade 9, fail above 11), LibreOffice as its own CI job, and the four-session estimate are all accepted.

**PO content delivered:** `product/domain/house-style.md` (use verbatim in the system prompt and as the lint source). **Evidence items reviewed:** all 183 items in `standards.json` are approved as written with three additions Dev applies in `standards.meta.json`: under `core.governance.human-resource-management` add `[record] Signed NDIS Code of Conduct acknowledgement for every worker (form.code-of-conduct)`; under `verification.human-resource-management` add `[register] Worker screening clearance register with expiry dates (register.worker-clearances)` and the same Code of Conduct acknowledgement record. Then set every evidence item `draft: false` with `reviewedBy: "po"`, `reviewedAt: "2026-10-12"`, regenerate the dataset and bump its version. Status: in progress.

**12 Oct 2026, Session A and Session B preparation review (PR #9, 2cb4cfd): ACCEPTED.** CI green including the LibreOffice job (every skeleton converts). Read `fixed-text.ts` (first person plural, plain definitions, placeholders marked for the provider), `prompts.ts` (house style verbatim as the system prompt; strict JSON block contract; facts delimited and declared as data, not instructions; length caps) and the context-pack exclusion proof. The dataset is 1.1.0 with 186 reviewed evidence items. Session B recordings wait only on the Anthropic key; Session C may proceed in parallel. Status: in progress.

