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

Written 2026-10-11 on branch `req-005-generator` (from `main`). Dev response and the Session A catalogue draft only; no generation code.

### Q1. Section schema and renderer

**Section schema.** Every tailored section is one JSON object validated with zod (`strictObject`, unknown keys rejected) before anything is rendered. Blocks are a closed set; there is no free HTML or Markdown, so the model cannot change document structure, inject links or styling, or smuggle text into headings.

```ts
// src/lib/generator/section-schema.ts (proposed)
const Inline = z.string().trim().min(1).max(600);            // one sentence or short paragraph, no line breaks
const Block = z.discriminatedUnion("type", [
  strictObject({ type: z.literal("paragraph"), text: Inline }),
  strictObject({ type: z.literal("bullets"), items: z.array(Inline).min(1).max(12) }),
  strictObject({ type: z.literal("steps"), items: z.array(Inline).min(1).max(15) }),   // rendered numbered
  strictObject({
    type: z.literal("table"),
    columns: z.array(z.string().max(40)).min(2).max(4),
    rows: z.array(z.array(Inline)).min(1).max(20),            // every row must match columns.length (refine)
  }),
  strictObject({ type: z.literal("callout"), text: Inline }), // "review and complete" markers and provider notes
]);
export const TailoredSection = strictObject({
  sectionId: z.string(),                                      // must equal the requested section id (refine)
  blocks: z.array(Block).min(1).max(12),
  usedFacts: z.array(z.enum(FACT_KEYS)).min(1),               // which context-pack fields the text relies on (FR-5)
});
```

The prompt asks for exactly this shape and nothing else; the reply is parsed with `JSON.parse` then `TailoredSection.safeParse`. A failed parse is retried once with the zod issues appended; a second failure renders the outline's fixed fallback text plus a `callout` "Review and complete this section" (FR-2, AC-5).

**Renderer.** The `docx` package, one deterministic function `renderDocument(doc: DocumentModel): Document` where `DocumentModel` is the fixed outline with each section resolved to blocks (fixed sections are pre-authored block arrays in the same schema, so there is one renderer path). Mapping: `paragraph` to `Paragraph` with the body style; `bullets` to a bulleted numbering reference; `steps` to a decimal numbering reference restarted per section; `table` to `Table` with a header row and fixed column widths; `callout` to a shaded single-cell table. Headings use Word's built-in Heading 1 and 2 styles with automatic numbering so the document outline works in Word and LibreOffice. The header carries the trading name and document title; the footer carries "Prepared with Readyline", version, page x of y. A document-control table and the notice section come from fixed blocks (FR-3). Snapshot tests serialise the `DocumentModel` (not the binary), which keeps diffs readable when a prompt or outline changes.

Sample of one tailored section (`purpose` of the governance policy) as the model returns it, then as rendered text:

```json
{ "sectionId": "purpose", "usedFacts": ["tradingName", "structure", "states"],
  "blocks": [
    { "type": "paragraph", "text": "This policy explains how Sunrise Supports, a sole trader delivering supports in New South Wales, is run and who is accountable for decisions about participants, workers and money." },
    { "type": "paragraph", "text": "It supports the Governance and operational management standard and is read with the risk management and quality management policies." } ] }
```

```text
1  Purpose
This policy explains how Sunrise Supports, a sole trader delivering supports in New South Wales, is run and who is
accountable for decisions about participants, workers and money.
It supports the Governance and operational management standard and is read with the risk management and quality
management policies.
```

### Q2. Recorded fixtures for CI

Key every model call by `sha256(promptVersion + "\n" + model + "\n" + canonicalJson(request))` where `request` is the exact messages array sent (system and user), so any change to the prompt text, the outline brief, the standard text included, the context pack or the model id produces a new key. Fixtures live in `fixtures/generation/<documentTypeId>/<sectionId>/<key>.json` holding the request hash, the raw reply and the validated section. In CI the client runs in `replay` mode: a missing fixture fails the test with the key and the request summary, which is the signal that a prompt changed and needs re-recording; no network call is possible (`ANTHROPIC_API_KEY` is absent in CI). Locally `npm run generation:record` runs the three reference questionnaires in `record` mode and writes fixtures; the diff of the validated sections is reviewed like code (CLAUDE.md 6, "diffable"). `promptVersion` is a string constant per document type bumped by hand and recorded in `generation_log`; a test asserts every fixture's `promptVersion` matches the current constant so stale fixtures cannot linger. Model cost in CI: zero. The nightly real run is a separate `workflow_dispatch`/schedule job gated on the key being present, uploading the `.docx` set as artifacts for the PO.

### Q3. Readability

Recommend an in-repo Flesch-Kincaid grade implementation (sentence split, word count, syllable estimate with the usual English heuristics and Australian spellings), about 60 lines with unit tests against a few known passages, rather than a dependency: the libraries on npm (`text-readability`, `readability-scores`) are unmaintained, small, and we need the same deterministic numbers in tests and in the reviewer view. Threshold: FR-8 says Year 8; recommend **warn above grade 9.0 per tailored section, fail the CI quality gate above 11.0**, measured on the section's paragraph and bullet text only (tables and headings excluded, which otherwise distort the score). Policy language has unavoidable long terms ("restrictive practice", "Commission"), so the grade is reported per section in the reviewer view with the three worst sections highlighted, and the house style prompt (PO content item 3) asks for short sentences and one idea per sentence, which is what moves the score.

### Q4. LibreOffice in CI

Feasible. `ubuntu-latest` installs `libreoffice-writer` with apt in roughly 60 to 90 seconds (about 300 MB); `soffice --headless --convert-to pdf --outdir out/ *.docx` converts the three reference sets (about 35 documents each) in under two minutes total, and a non-zero exit or a missing PDF fails AC-1. The step runs in a separate job so the main job keeps its current timing, and only on pull requests that touch `src/lib/generator/**` or `fixtures/generation/**` plus the nightly run. The same step gives us the PDF readiness summary pipeline for free if we choose to render the summary as `.docx` first; otherwise the summary is rendered server-side with a small PDF library (decision deferred to Session C).

### Q5. Estimate and values Haider must supply

Four sessions. **A:** catalogue (this response's `document-types.json`, PO-reviewed), section schema, document model, renderer with structure snapshots, fixed text for every outline, readability function, terminology lint. **B:** context pack with the exclusion test (SR-3), prompt builder with delimiting and red-team fixtures (SR-2, AC-4), fixture-replay client, claims gate, fallback path (AC-5), generation log and quota (FR-9, AC-8), `GENERATION_ENABLED` flag (AC-10). **C:** storage bucket with RLS and signed URLs (SR-4, AC-7), version sets (FR-6), the generate and download routes, reviewer view with per-section regeneration and diff (FR-5, AC-6), e2e on both projects. **D:** self-assessment document (FR-4, AC-2), PDF summary, LibreOffice CI job (AC-1), the three reference sets as artifacts, readability and cost evidence.

Values Haider supplies, by name only, into `.env.local` and the Vercel project (server only, never `NEXT_PUBLIC_`):

- `ANTHROPIC_API_KEY` (Anthropic console; create a key in a workspace with a monthly spend cap, SR-1)
- `ANTHROPIC_MODEL` (Dev proposes the current Sonnet-class model id for drafting; recorded in `DECISIONS.md` when set)
- `GENERATION_ENABLED` (`true` or `false`; Dev sets it, listed so it is in the same place)

### Catalogue draft for review (Session A content)

`data/readyline-content/document-types.json`: 39 entries: one per distinct id in `document-sets.json` (37), the Practice Standards self-assessment, and one proposed addition marked `proposed: true` (participant money and property procedure, because that core standard has no document in the set). Each entry has title, purpose, mapped standards ids, `evidenceAliases` into the `documentTypeId` scheme that `standards.json` evidence items use (the two id schemes are reconciled through that field), registers referenced, an outline (policy, procedure, plan, template, acknowledgement, framework, self-assessment) with each section marked fixed or tailored, and document-specific extra sections. `data/readyline-content/document-types.test.ts` checks coverage, real ids, one tailored section per document, no prohibited claims, and that every evidence `documentTypeId` in `standards.json` is carried by at least one document (true once the proposed addition is counted).

Three things for the PO in that file: (1) the proposed addition; (2) `feedback-and-participant-engagement-procedure` is drafted to carry support planning and transitions as well, since the set has no separate document for those two core standards; rename or split as you prefer; (3) the restrictive practice use register is referenced by the SBS/IBSP procedure but is not in the registers list; proposed as a sixth register for REQ-009.


## Delivery evidence

### PO batch 7 item 2 (2026-10-12), branch `req-005-generator` (merged with `main` at 7f456a0), commit 270c4a6

Decisions applied: `participant-money-and-property-procedure` and the new `support-planning-and-transitions-procedure` are in the core list of `document-sets.json`; `feedback-and-participant-engagement-procedure` now carries only the feedback and responsive-support standards; the `restrictive-practices` register is in the registers list with `when: { modulesAny: ["ibsp"] }`, the content schema and `deriveDocumentSet` honour it, and `result.test.ts` proves it appears only with the implementing module. Evidence: the three additions are in `standards.meta.json`; `meta.evidenceReview` marks every item `draft: false`, `reviewedBy: "po"`, `reviewedAt: "2026-10-12"` (schema fields added; later additions opt back into draft); dataset rebuilt as **1.1.0** (186 items, 0 draft), `SOURCES.md` changelog updated, `standards:verify` green, Commission text untouched.

### Session A (2026-10-12), same branch

**Built (`src/lib/generator/`):** `section-schema.ts` (closed block set, strict objects, `usedFacts` from `FACT_KEYS`; D-501); `facts.ts` (the eleven provider facts, banded worker count, formatted ABN; D-509); `catalogue.ts` (typed, validated access to `document-types.json`, extras inserted before the back matter); `document-model.ts` (`buildSkeleton`, numbering, `modelStructure` for snapshots; D-506); `fixed-text.ts` (fixed text for every outline section in the house style: document control, definitions, records and evidence from the reviewed evidence items, related documents, review with a responsibilities table, notice with the general-information statement and AI disclosure, how-to-use, signatures, Code of Conduct summary, acknowledgement, self-assessment table and gaps; document-specific extras get a register table or a placeholder until Session D; D-507); `render-docx.ts` (`docx` 9.10: title, Heading 1 per section, bullets and restarted numbered steps, bordered tables with header rows, shaded callouts, header with provider and title, footer "Prepared with Readyline", version and page x of y); `readability.ts` (Flesch-Kincaid grade, thresholds from the house style; D-508); `lint.ts` (terminology, plain words, exclamation marks, "please", spelling, compliance claims, plus the CLAUDE.md claim rules; class names exempt); `house-style.ts` (the PO's note verbatim, test-pinned to the markdown); `reference-cases.ts` with `fixtures/reference-cases/*.json` (D-510). Dependencies: `docx` 9.10.0, `fflate` 0.8.3 (also on the REQ-004 branch).

**Tests (31 in the generator folder; 282 in the unit suite):** schema accepts the block set and rejects unknown keys, block types, empty lists, line breaks, ragged tables and unknown fact keys; readability known words, sentence counting, an "ok" passage and a "fail" passage; lint passes house-style prose, flags the participant and worker words, Latinate words, American spelling, exclamation marks, "please", compliance claims and prohibited claims, and exempts class names; house style constant equals the markdown; skeletons for the three reference cases: every document plus the self-assessment resolves (18, 26 and 27 documents), notice last, numbering contiguous, **structure snapshot** per case, provider name and notice present in fixed text, **no lint errors in any fixed section**, every `.docx` has one Heading 1 per section, the provider name in the body and the footer text; facts exclude the canary `servicesNote` and the step-5 answers; the first sections of two cases differ.

**LibreOffice (AC-1 mechanics; D-511):** CI job `docx-render` installs `libreoffice-writer`, writes the sets with `npm run generator:skeletons` under `WRITE_SKELETONS=1`, converts every file to PDF and fails on any miss, uploads `out/skeletons/` as an artifact. Local: 71 `.docx` files written (244, 351 and 365 KB per case). Not run locally: LibreOffice is not installed on the dev machine; the first conversion run is the CI job on this push.

**Local outputs:** `npm run check` clean (28 files, 282 tests), typecheck clean, Prettier clean. No model calls exist yet.


### Session B preparation (2026-10-12), same branch

**Waiting for Anthropic key.** `.env.local` has neither `ANTHROPIC_API_KEY` nor `ANTHROPIC_MODEL` (presence checked by name, values never read), so no real generation was recorded and there is no cost note yet (D-515). Everything up to the harness is delivered:

- `context-pack.ts`: strict `ContextPack` (facts, document, section, standards verbatim, register titles) and `buildContextPack` (D-512). Exclusion test (SR-3): Proxy-traced access shows `supports.servicesNote` and the step-5 answers are never read; a canary in the services note is absent from the pack and both prompts; the schema rejects a `participants` key and an extra fact.
- `prompts.ts`: `PROMPT_VERSION` 2026-10-12.1; system prompt = house style verbatim + output contract; user prompt with delimited, length-capped FACTS, STANDARDS and REGISTERS blocks; `requestHash` over canonical JSON (D-512, D-502).
- `model-client.ts`: `ReplayClient`, `RecordingClient`, `FakeClient`, `AnthropicClient` (lazy SDK import, record mode only), `createModelClient` defaulting to replay (D-513). Tests: missing fixture throws with the expected path; record then replay round-trips through a temp directory; mode selection needs both the flag and a key.
- `generate-section.ts`: parse, validate, section-id check, lint gate, one retry with the problems, fallback with the "Review and complete" marker, readability on accepted prose (D-514). Tests cover accept, claim-then-accept on retry, double failure to fallback, and schema paths in messages.
- Red-team fixture `fixtures/red-team/injected-trading-name.json` and `red-team.test.ts` (SR-2, AC-4): same structure as the clean case, injected text only inside FACTS, fake participant details never in any prompt, an obeying reply rejected and replaced by the fallback.
- `record-fixtures.test.ts` + `npm run generation:record`: skipped without `GENERATION_RECORD=1`, the key and the model id; records the governance policy's tailored sections for the three cases and prints token totals. `fixtures/generation/README.md` documents the layout. `.env.example` gains `GENERATION_ENABLED` and `GENERATION_RECORD`.
- Dependency: `@anthropic-ai/sdk` 0.133.0.

**Local outputs:** generator folder 48 tests passed, 1 skipped (the recorder); `npm run check` clean (counts in the batch-7 Dev status); no network call is possible in CI because the key is absent and the client defaults to replay.

**Haider:** supply `ANTHROPIC_API_KEY` (console key in a workspace with a monthly spend cap) and `ANTHROPIC_MODEL` into `.env.local`; Dev then runs the recorder, commits the first fixtures and writes the cost note.
### Batch 8 item 2 (2026-10-12): Session B recordings

**Waiting for Anthropic key.** `.env.local` still has neither `ANTHROPIC_API_KEY` nor `ANTHROPIC_MODEL` (checked by name only), so no reference generation or red-team run was recorded and there is no measured cost note (D-522). The branch was merged with `main` (b58a2a3/2b83699) first, as asked.

### Session C (2026-10-12), branch `req-005-generator`

**Built**

- Migration `20261012000000_documents.sql`: `version_sets`, `document_versions` (resolved model as JSON), `generation_log` (counts only, SR-5), `accounts.generation_daily_limit` (default 5) with `generation_quota_hit()` counting in one statement on the Sydney date, member-only RLS on all three tables, the private `documents` bucket (25 MB, four media types) and a `storage.objects` select policy scoped to the account prefix (D-516, D-517).
- `src/server/generation/`: `policy.ts` (flag and gate decisions, AC-8, AC-10), `storage.ts` (account-prefixed paths, `isOwnedPath`, upload, download, 5-minute signed URLs), `store.ts` (`GenerationStore` interface and the Supabase implementation), `run.ts` (`generateDocumentSet`: skeleton, tailored sections through the pipeline, `.docx` per document, PDF readiness summary, README and `set.zip`, version and log rows; `regenerateSection`: one section, new document version, new `.docx`), `queries.ts`, `actions.ts` (`startGenerationAction`: session, flag, complete questionnaire from the server draft, quota, run, audit row; `regenerateSectionAction`).
- Pages: `/documents` (coming-soon state when the flag is off; otherwise generate button and the list of sets), `/documents/[setId]` (zip and PDF downloads, documents with status and version), `/documents/[setId]/[typeId]` (reviewer view: every section with mode and status, the questionnaire answers each tailored section used, regenerate-one-section, and the line diff against the previous version after a regeneration; D-519), `/documents/[setId]/download` (ownership and path checks, then a signed URL; 404 otherwise). "Documents" link in the header for signed-in users and on the result page.
- `src/lib/generator/`: `pdf-summary.ts` (pdf-lib), `diff.ts` (LCS line diff), `fact-sources.ts` (fact key to step and question), `fixed-extras.ts` (Session D fixed text for every document-specific section: registers, declarations, consent form, retention schedule, reportable incidents without restating timeframes, procedures, clearance and training registers, improvement register, support plan template, transition checklist, approved tools, participant information and AI, de-identification checklist, restrictive practice use register, SDA and SIL agreement outlines; D-520); the self-assessment standards table is now fixed text with the Commission's outcome verbatim in tables of 20 rows, with a separate tailored "how we meet these standards" section (D-518). `generate-section` treats a model or fixture error as a failed attempt so a missing key yields the fallback path, never a crash.
- Purge extension `purgeGenerationArtifacts` (logs after two years, superseded sets after twelve months, objects first) wired into the daily purge route (D-521). `ANTHROPIC_MODEL` listed in the env contract; default model `claude-sonnet-5-5` (D-037).
- Dependency: `pdf-lib` 1.17.1.

**Tests:** unit 41 files, 323 tests, 1 skipped (recorder). New: policy gate; object paths and ownership; diff; fact sources; PDF parses with the title and provider; runner end to end with a fake model and in-memory store (AC-1 verification set and zip contents; AC-2 core documents and all 24 core outcomes verbatim in the self-assessment; AC-3 no shared tailored section between two providers and logs with counts only; AC-5 every section falls back when the model is unreachable and the set still renders; AC-6 regeneration changes only the chosen section and records version 2); structure snapshots refreshed for the three cases. Integration (`tests/integration/generation.test.ts`, Supabase CI job): owner can sign and download its object, the other tenant cannot sign or download, public URL refused, clients cannot upload (AC-7); version rows member-only and no client insert; quota 5 then refused, raised limit allows a 7th, function not callable with the publishable key (AC-8). End-to-end (`e2e/documents.spec.ts`, both projects): documents pages redirect signed-out visitors, the download route redirects and rejects bad file names; whole suite 50 passed in CI mode.

**Local outputs:** `npm run check` clean; `npm run build` ok with the four new routes; bundle check 28 files clean; Playwright 50 passed, 2 skipped.

**Not delivered in this session, and why:** screenshots at 360x740 and desktop of the documents pages need a signed-in session against a database with this migration applied; the hosted project has no migrations yet (PR #8 pending) and the dev machine has no local stack, so only the signed-out states could be captured, which show the sign-in page. The CI link cannot be read from this machine. Both are owed on the next session once PR #8 is merged and the migrations have run.
### Batch 9 items 3 and 4 (2026-10-12)

**Item 3, owed Session C evidence.** CI for f9d89fa: the PO reports all four jobs green; the runs are listed at https://github.com/haideralii/readyline/actions?query=branch%3Areq-005-generator (Dev cannot read Actions from this machine, so the run id is not pasted). Screenshots of the documents pages: a local `supabase start` stack needs Docker, which the dev machine does not have, and the hosted project now carries the three REQ-004 migrations but a session there needs a magic-link email delivered to Dev, which is not possible here. So a signed-in session against the hosted project is needed and this item stops here, as the queue allows; the coming-soon state renders as soon as any signed-in owner opens `/documents`.

**Item 4, Session B recordings.** Waiting for key: `.env.local` has neither `ANTHROPIC_API_KEY` nor `ANTHROPIC_MODEL` (checked by name).
### Batch 10 items 2 and 3 (2026-10-12): first recordings and the review pack

**Recordings (D-039, one call per case).** `npm run generation:record` now records exactly one section per reference case (the recorder loads the two Anthropic variables from `.env.local` itself, prints the estimated input tokens before the first call, and writes `fixtures/generation/recordings-2026-10-12.json` with counts only). Model `claude-sonnet-5-5`; prices from D-037 (`` in, `` out per million tokens).

| Case | Document / section | Estimated in | Actual in | Out | Dollars | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| verification-sole-trader | incident management policy / policy statement | 1,689 | 2,325 | 1,397 | 0.019 | passed first time; readability grade 8.5 |
| certification-personal-care | governance policy / purpose | 2,021 | 2,672 | 159 | 0.007 | passed first time; readability grade 11.8 (above the fail threshold; see note) |
| behaviour-support-company | behaviour support plan implementation / steps | 4,498 | 5,635 then 5,678 | 2,000 then 2,000 | 0.031 each | failed twice: the reply was cut at the 2,000-token output cap mid-JSON, so it never parsed; stopped per the queue, not re-recorded |

Spend for the batch: about `.09` across four completed calls, plus one earlier attempt on the sole-trader case that vitest's default 5-second test timeout cut off mid-flight (its reply was lost; if the API billed it, roughly `.02` more). Two earlier attempts made no call at all (the SDK refused to run under vitest's browser-like environment; fixed with the Node environment directive). The estimate undercounted the real input by about 25 to 40 per cent because the house-style system prompt and the Commission text tokenise denser than four characters per token.

Notes for the PO: (1) the `steps` section for the behaviour-support case needs a higher output cap (the model wrote a long numbered procedure; 2,000 tokens is too low for that section type). Dev will raise `maxTokens` to 4,000 for `steps` and `how-we-do-this` sections before any further recording, which the PO approves separately under D-039. (2) The governance purpose paragraph for the company case scored grade 11.8; it validated because readability is reported, not gated, in the pipeline today. The quality gate (fail above 11) is Session D work; this is the first measured signal that the house-style prompt should push harder on sentence length for "purpose" sections.

**Review pack (item 3).** `npm run generation:review-pack` (`REVIEW_PACK=1`, replay client only, no model call) rendered the sole-trader case's incident management policy, complaints procedure and self-assessment into `product/evidence/req-005/sole-trader/`: three `.docx` files and `sections.md` listing every section as fixed text, model text (with the questionnaire answers it used, from `usedFacts`, and the text itself) or the fallback marker. Under D-039 only the incident policy's policy statement is real model text (it used trading name, structure, states, registration groups, number of workers and the restrictive practices answer); every other tailored section in the three documents shows the "Review and complete" fallback the provider would see when drafting is unavailable.
### Batch 11 (2026-10-12): R-5, R-6, D-040 and the sole-trader incident policy

**R-5 and R-6 (894daba).** `validateReply` treats a readability `fail` as a validation problem carrying the house-style instruction; the retry prompt includes it; a second fail falls back. `ModelReply` carries `stopReason` (mapped from the API; inferred for the four earlier fixtures from usage equal to the cap); a `max_tokens` reply is recorded as "reply truncated at N output tokens (cap M); not retried", surfaced in `SectionOutcome.truncatedAtTokens` and in the recordings report. D-040 caps live in `maxTokensFor`. The fixture key excludes the cap (D-524); the existing fixtures were re-keyed in place. Unit tests: readability fail retries with the instruction then falls back; truncation is reported with its count and makes exactly one call; caps per section type; cap outside the key. `fixtures-replay.test.ts` replays every fixture through the current gate: the sole-trader policy statement passes at grade 8.5, the governance purpose fixture now reports "readability grade 11.8 is above 11" and falls back, and the first behaviour-support recordings are reported as truncations. No model calls for this item.

**Recordings (items 2 and 3), one run of `npm run generation:record`, 7 calls, about `.15`:**

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| behaviour-support / BSP implementation / steps | 4,000 | 5,635 | 4,000 | 0.051 | truncated at 4,000 output tokens; stopped (the outline is too big for one call; split in a later session, per the PO) |
| sole trader / incident policy / purpose | 1,500 | 2,376 | 488 | 0.010 (x2) | readability fail twice: grade 15.8, then 12.2 after the retry instruction; fell back |
| sole trader / incident policy / scope | 1,500 | 2,320 | 673 | 0.011 | passed first time; grade 8.6 |
| sole trader / incident policy / how we put this into practice | 4,000 | 2,328 | 3,052 | 0.035 | passed first time; grade 6.8 |
| sole trader / incident policy / responsibilities | 1,500 | 2,320 | 831 | 0.013 | passed first time; grade 6.3 |
| sole trader / incident policy / incident procedure | 1,500 | 2,305 | 1,500 | 0.020 | truncated at 1,500 output tokens; stopped |

Spend to date about `.26` (`.11` before this batch). Estimates before the calls ran about 25 to 40 per cent under the real input counts, as in batch 10.

**Review pack re-rendered.** `product/evidence/req-005/sole-trader/incident-management-policy-and-register.docx` now carries real text in scope, policy statement, how we put this into practice and responsibilities, and `sections.md` names the pipeline's reason for each fallback (purpose: readability fail after the retry; incident procedure: cut at the cap). The complaints procedure and the self-assessment are unchanged from batch 10 (no recordings approved for them).

**For the PO:** (1) extra sections whose id ends in `procedure` are step lists and should take the 4,000 cap; (2) the catalogue's "purpose" brief should say "two short sentences" so the model stops writing a dense paragraph there, after which one more call for the sole-trader purpose would complete that document; (3) the behaviour-support `steps` outline needs splitting into two sections before any further call (D-525).
### Batch 12 (2026-10-12): R-7, D-041, the complete sole-trader incident policy and the behaviour-support split

**R-7 and D-041, no model calls (e85abe2).** `lintTimeframes` (24 hours; N business days or "business days"; "within ... hours/days", overlapping matches merged) runs on every tailored reply after the terminology and readability gates; a hit is a validation problem whose retry instruction names the fixed section that holds the rule ("refer to section 7 Reportable incidents instead of restating the timeframe"; a generic instruction where a document has no such section). The context pack carries `rulesSection` (id, number, heading) computed from the document's numbering. Catalogue: every `purpose` brief is now "Two short sentences: what this document is for, and which standard it supports; nothing else."; the `how-we-do-this`, `responsibilities`, `steps` and `*procedure` briefs end with the R-7 rule; `*procedure` extras take the 4,000 cap; the behaviour-support `steps` section is omitted and replaced by three anchored sub-sections of at most eight steps (`omitSections` and `insertAfter` added to the catalogue schema). The prompt text itself is unchanged, so only the sections whose brief changed were re-keyed; adding the R-7 sentence to the system prompt would have orphaned every fixture and is deferred to the next prompt-version bump. Unit tests: lint patterns, the retry instruction with the section reference and the generic form, caps, split sub-sections. **Replay through the lint, as asked:** the fixture texts that restate a timeframe are exactly section 5 (how we put this into practice: "within 24 hours", "5 business days") and section 6 (responsibilities) of the batch-11 sole-trader incident policy; policy statement and scope pass; the governance purpose fixture, orphaned by the new brief, still fails the readability gate on its text (grade 11.8).

**Recordings (items 2 and 3), one run, 8 calls, about $0.13:**

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| sole trader / incident policy / purpose (new brief) | 1,500 | 2,381 | 110 | 0.006 (x2) | first reply grade 16.5; passed on the readability retry at grade 10.3 |
| sole trader / incident policy / how we put this into practice (R-7 re-record) | 4,000 | 2,387 | 2,231 | 0.027 | passed first time; grade 5.5; no timeframe restated |
| sole trader / incident policy / responsibilities (R-7 re-record) | 1,500 | 2,379 | 760 | 0.012 | passed first time; grade 8.0 |
| sole trader / incident policy / incident procedure (4,000 cap) | 4,000 | 2,364 | 1,098 | 0.016 | passed first time; grade 5.5 |
| behaviour support / BSP implementation / steps: getting the plan | 4,000 | 5,752 | 1,001 | 0.022 | passed first time; grade 7.7 |
| behaviour support / BSP implementation / steps: putting the plan into practice | 4,000 | 5,765 | 1,049 | 0.022 | passed first time; grade 8.3 |
| behaviour support / BSP implementation / steps: monitoring, reporting and review | 4,000 | 5,772 | 862 | 0.020 | passed first time; grade 8.5 |

Running total about $0.39 ($0.26 before this batch), under the $0.66 cap in the batch-12 review. Scope and policy statement were not re-recorded (passing fixtures, per the queue).

**Review pack.** `product/evidence/req-005/sole-trader/incident-management-policy-and-register.docx` now has real model text in every tailored section (purpose, scope, policy statement, how we put this into practice, responsibilities, incident procedure) with no fallback marker; `sections.md` lists the answers each section used and its readability grade. The complaints procedure and the self-assessment are unchanged (no recordings approved).

### Batch 13 (2026-10-12): R-8 review cycles, two more sole-trader documents

**R-8 and D-042, no model calls (item 1).** Catalogue defaults now hold `reviewCycleMonths: 12` and `registerReviewMonths: 3`, overridable per document type; `reviewCyclesFor(type)` feeds a required `reviewCycles` object in the context pack (D-527). The `how-we-do-this` and `responsibilities` briefs of every outline end with "Review cycles for this document are fixed facts: [review cycles]. Use them and never choose a cycle.", and the pack fills the marker with "policy review every 12 months; register review every 3 months" (D-526 pattern: the system prompt is unchanged, so only those two sections of each document are re-keyed). `lintReviewCycles` reads every "every N months/weeks/years" (digits, number words, "every month" as one month, years and weeks converted) and checks it by subject: register sentences must use the register cycle, policy/procedure/plan/framework/document sentences the policy cycle, sentences naming both must fit both, and sentences naming neither may use either value; in a table the cells are joined by " | " and a cycle cell with no subject takes the row's subject. A hit is a validation problem with the retry instruction "use the review cycles given: policy review every 12 months, register review every 3 months; never choose your own"; one retry, then fallback (same pipeline position as R-7). Unit tests cover the lint cases (including a table row and a reporting cadence), the pack values, the filled brief, and a wrong register cycle causing a retry. **Replay of the recorded fixtures through the lint (fixtures-replay test, pinned):** exactly three sections fail: `incident-management-policy-and-register/how-we-do-this` ("review the Incident register ... every 12 months"), `incident-management-policy-and-register/responsibilities` ("Reviews the Incident register ... | At least every 12 months", both recorded versions) and `behaviour-support-plan-implementation-procedure/steps-monitoring-reporting-and-review` ("steps 1 and 2 apply every month", a reporting cadence rather than a review cycle; flagged by the PO's wording, listed for the PO, not re-recorded this batch). Policy statement ("review this policy and procedure every 12 months"), scope, purpose and the incident procedure ("every 3 months" for the register) pass, as the PO predicted (sections 5 and 6 re-recorded; section 8 stands).

**Re-recording (item 2), one run, 2 calls, about $0.04:**

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| sole trader / incident policy / how we put this into practice (R-8 re-record) | 4,000 | 2,432 | 1,828 | 0.023 | passed first time; grade 5.4; "Every 3 months we review the Incident register", "Review this policy every 12 months", and the same values in its table |
| sole trader / incident policy / responsibilities (R-8 re-record) | 1,500 | 2,424 | 1,216 | 0.017 | passed first time; grade 6.4; rows "Reviews this policy and procedure. \| Every 12 months." and "Reviews the incident register ... \| Every 3 months." |

The incident policy now agrees with itself: sections 5, 6 and 8 all say the register is reviewed every 3 months and the policy every 12 months. Review pack re-rendered; the incident policy keeps real text in all six tailored sections.

**Two more documents (item 3), one run, 5 calls over 3 sections, about $0.07; the case stopped at a truncation, so 2 of the 8 sections are recorded:**

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| sole trader / complaints policy / purpose | 1,500 | 2,497 | 461 | 0.010 (x2) | first reply grade 12.6; passed on the readability retry at grade 9.4 |
| sole trader / complaints policy / scope | 1,500 | 2,489 | 1,116 | 0.016 (x2) | first reply used "carers" (terminology lint); passed on the retry at grade 7.8 |
| sole trader / complaints policy / policy statement | 1,500 | 2,441 | 1,500 | 0.020 | **truncated at the 1,500 cap**; not retried (D-040); fallback callout |
| sole trader / complaints policy / how we put this into practice, responsibilities, complaints procedure | | | | 0 | not attempted: the recorder stops a case after a truncation |
| sole trader / self-assessment / our registration scope, how we meet these standards | | | | 0 | not attempted, same rule (same reference case) |

Retry first calls are not itemised by the recorder (it keeps the last call's tokens), so the "(x2)" rows are counted at twice the last call, an upper bound. Batch 13 spend: about $0.04 (item 2) + $0.07 (item 3) = **about $0.11**, under the $0.50 batch ceiling. **Running total about $0.50** ($0.39 before this batch), under the $0.89 cap.

Why the policy statement did not fit: the incident policy statement (batch 10, same cap) came in at 1,397 output tokens, so 1,500 was already marginal for a policy statement, which the brief shapes as a table of commitments against every quality indicator of the standard (the complaints standard has four indicators, each with a commitment, how-we-do-it text and an indicator reference). Proposed, for the PO (D-528 in `DECISIONS.md`): raise the `policy-statement` cap to 2,500 (the recorder re-records a fixture that was cut at a lower cap, so only this section is re-run) and make the recorder's stop-after-truncation rule per document rather than per reference case, so the self-assessment is not held back by a complaints-policy truncation. No further calls were made this batch; the remaining six sections wait for that decision.

**Review pack.** `sections.md` now shows real text for the complaints policy's purpose and scope and fallback callouts for its other four tailored sections and for both self-assessment sections. The three documents are therefore not yet all complete; one is complete (incident), one is a third done (complaints), one is untouched (self-assessment).

### Batch 14 (2026-10-12): D-043, the R-8 scope, the complaints policy and the self-assessment

**D-043 and the R-8 scope change, no model calls (item 1, D-529).** `maxTokensFor` returns 2,500 for `policy-statement` (4,000 for steps, how-we-do-this and procedures; 1,500 otherwise), with a unit test on the sole-trader incident policy statement's request; the fixture key still excludes the cap. The recorder's truncation stop is keyed by case and document (`verification-sole-trader/complaints-management-policy-and-register`), so a truncation in the complaints policy no longer skips the self-assessment. `lintReviewCycles` now examines only sentences (or table rows) with review wording (review, check, look at, with their inflections); a cadence without it is left to R-7. Unit tests: the BSP monitoring sentence and "we send the report every month" produce no finding; "we check our records every week" still does. **Replay of all fixtures:** every recorded fixture passes the current gate except the batch-11 and batch-12 recordings of incident sections 5 and 6, orphaned by the R-8 brief and kept as history; a new test loads every fixture of `steps-monitoring-reporting-and-review`, asserts it says "every month", and asserts the lint returns nothing, so that fixture stands un-re-recorded as the PO asked.

**Finishing the two documents (item 2), two runs, 7 billed calls, about $0.15:**

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| sole trader / complaints policy / policy statement (re-record, D-043 cap) | 2,500 | 2,441 | 1,892 | 0.024 | passed first time; grade 9.5 |
| sole trader / complaints policy / how we put this into practice | 4,000 | 2,548 | 2,459 | 0.030 | passed first time; grade 5.8 |
| sole trader / complaints policy / responsibilities | 1,500 | 2,540 | 1,462 | 0.020 | passed first time; grade 6.5 |
| sole trader / complaints policy / complaints procedure | 4,000 | 2,497 | 2,119 | 0.026 | passed first time; grade 5.8 |
| sole trader / self-assessment / our registration scope | 1,500 | 2,755 | 1,228 | 0.018 | passed first time; grade 8.3 |
| sole trader / self-assessment / how we meet these standards (first run) | 1,500 | 2,787 | 1,500 | 0.021 | **truncated** with only 1,618 characters of reply; stopped that document only (D-043 rule) |
| sole trader / self-assessment / how we meet these standards (second run, thinking off, D-530) | 1,500 | 2,786 | 721 | 0.013 | passed first time; grade 10.0; 2,393 characters |

Two requests with `thinking: {type: "disabled"}` were rejected by the API (HTTP 400, no tokens, $0) before the off setting was corrected to `between_tools`. Batch 14 spend: **about $0.15**, under the $0.30 ceiling. **Running total about $0.65** ($0.50 before this batch), under the $0.80 cap.

**Why "how we meet" truncated, and the finding behind it (D-530).** The truncated reply was 1,618 characters for 1,500 output tokens, which cannot be text alone. Across all fixtures, replies fall into two groups: about 3 characters per output token, and 0.6 to 1.5 (one batch-11 fixture used 1,500 tokens for no text at all). The extra tokens were non-text blocks that the client drops. Every generation call now sends the model's off setting for thinking, the fixture records the setting and the content block types returned, and a truncated fixture recorded without it is re-recorded once (this is why the second call was made: the first was spent by the request defect, not by the cap; the queue's one-call rule was otherwise kept). Effect: the same section came back at 721 tokens and passed; earlier token and dollar figures in these tables overstate the cost of the text by roughly half, and the caps the PO set are now comfortable. Unit test: the client passes the setting and records `["thinking", "text"]` block types when the API returns them.

**Review pack.** `sections.md` now shows three complete documents: the incident policy (six tailored sections), the complaints policy (six) and the self-assessment (two), all real model text, no fallback markers. Readability grades run 5.4 to 10.3; the two sections above 9 (incident purpose 10.3, self-assessment how we meet 10.0) are within the fail line of 11 and flagged by the reviewer view.
## PO review
(PO fills in.)

**12 Oct 2026, Dev response review (branch `req-005-generator`, 5359f04): ACCEPTED; Session A approved.** Decisions on the three flagged items: (1) the proposed `participant-money-and-property-procedure` is accepted into the core set (`document-sets.json` core list); (2) split `feedback-and-participant-engagement-procedure` into two documents: keep it for feedback and participant engagement, and add `support-planning-and-transitions-procedure` covering the support planning and transitions standards, because auditors sample those as separate evidence; (3) a sixth register `restrictive-practices` is accepted for REQ-009, applicable only when the implementing behaviour support plans module is in scope. Schema, replay-fixture keying, in-repo Flesch-Kincaid (warn above grade 9, fail above 11), LibreOffice as its own CI job, and the four-session estimate are all accepted.

**PO content delivered:** `product/domain/house-style.md` (use verbatim in the system prompt and as the lint source). **Evidence items reviewed:** all 183 items in `standards.json` are approved as written with three additions Dev applies in `standards.meta.json`: under `core.governance.human-resource-management` add `[record] Signed NDIS Code of Conduct acknowledgement for every worker (form.code-of-conduct)`; under `verification.human-resource-management` add `[register] Worker screening clearance register with expiry dates (register.worker-clearances)` and the same Code of Conduct acknowledgement record. Then set every evidence item `draft: false` with `reviewedBy: "po"`, `reviewedAt: "2026-10-12"`, regenerate the dataset and bump its version. Status: in progress.

**12 Oct 2026, Session A and Session B preparation review (PR #9, 2cb4cfd): ACCEPTED.** CI green including the LibreOffice job (every skeleton converts). Read `fixed-text.ts` (first person plural, plain definitions, placeholders marked for the provider), `prompts.ts` (house style verbatim as the system prompt; strict JSON block contract; facts delimited and declared as data, not instructions; length caps) and the context-pack exclusion proof. The dataset is 1.1.0 with 186 reviewed evidence items. Session B recordings wait only on the Anthropic key; Session C may proceed in parallel. Status: in progress.

**12 Oct 2026, first recordings review (branch `req-005-generator`, 8a06f78): ACCEPTED with two fixes and three decisions.** The sole-trader incident policy statement is good work: Year 8 reading level, first person, names the Incident Management and Reportable Incidents Rules 2018 correctly, treats an unauthorised restrictive practice as a reportable incident, uses only facts from the answers, and makes no prohibited claim. That is the quality bar for every tailored section.

Fixes before the next recording:
- R-5 **Readability gate is not enforced.** The governance purpose section recorded at grade 11.8 with `validationPassedFirstTime: true`. The house style says fail above 11; `readability.ts` knows that, but the pipeline accepts the section. Make a `fail` readability level a validation problem that triggers the single retry with the instruction "shorten sentences to under 20 words and use common words", and the fallback marker if the retry also fails. Add the unit test. (Replay the existing fixture through the new gate; do not re-record it.)
- R-6 **Truncated replies must be recognised.** Both behaviour-support attempts hit the 2,000-token cap and were reported as "not valid JSON". Read the API's `stop_reason`; when it is `max_tokens`, record the problem as "reply truncated at N output tokens", do not retry the identical request, and surface the count in the recordings report.

Decisions:
- D-040 `maxTokens` is 4,000 for `steps` and `how-we-do-this` sections and 1,500 for every other section type. Recorded in DECISIONS.md by the PO.
- One more call is approved for the behaviour-support `steps` case at the new cap (about $0.06). If it truncates again, stop; the section outline is too big for one call and we split it, not the cap.
- Spend to date ($0.11) and the batch-11 budget (up to $0.50) are approved.

**12 Oct 2026, batch-11 recordings review (branch `req-005-generator`, 1a4ad6d): ACCEPTED; D-525 proposals approved as D-041, one new fix.** The four real sections of the sole-trader incident policy (scope, policy statement, how we put this into practice, responsibilities) are at the standard: grades 6 to 9, first person, sized to a sole trader, correct on the Incident Management and Reportable Incidents Rules 2018, honest "[Provider to complete]" placeholders where a fact is missing, and no banned claim. R-5 and R-6 verified by the replay test (the governance purpose fixture now fails the gate).

- R-7 **Statutory timeframes and lists belong to fixed text only.** Section 5 says every reportable incident is notified within 24 hours and repeats the list of reportable incidents; section 6 says 24 hours for the most serious and 5 business days for the others. Both are defensible, but an auditor reads them side by side and sees a contradiction, and the fixed section 7 already states the rule from the Commission's text. Rule for the prompt and the catalogue: tailored sections never restate statutory timeframes, reportable-incident lists, or the Commission's definitions; they say "see section 7 Reportable incidents" (or the fixed section that holds the rule). Add a lint over tailored output for "24 hours", "5 business days", "business days" and "within .* days" in documents whose fixed text carries the timeframe, failing validation with the retry instruction "refer to section N instead of restating the timeframe". Replay the four recorded fixtures through the new lint; re-record only the ones that now fail.
- D-041 (approved from D-525): extra sections whose id ends in `procedure` take the 4,000 cap; the `purpose` brief in the catalogue becomes "two short sentences: what this document is for, and which standard it supports; nothing else"; the behaviour-support `steps` outline is split into sub-sections of at most eight steps each, each its own call under the 4,000 cap.
- Budget: $0.26 spent. Batch 12 may spend up to $0.40 more (cap $0.66 total).

**12 Oct 2026, batch-12 recordings review (branch `req-005-generator`, e64bcc6): ACCEPTED; one new fix.** The sole-trader incident policy is now a complete real document: every tailored section at grade 5.5 to 10.3, each pointing to section 7 for the timeframes (R-7 working as intended), the procedure sized to one person with a sensible "trusted outside reviewer" suggestion and honest placeholders. The three behaviour-support step sub-sections passed first time. Cost table accepted; $0.39 to date.

- R-8 **Review cycles are a provider fact, not a model choice.** Sections 5 and 6 say the register and policy are reviewed every 12 months; section 8 says the register is reviewed every 3 months. Neither is wrong, but a document must agree with itself. Add `reviewCycles` to the context pack as fixed facts (policy review: 12 months; register review: 3 months; both configurable per document type in the catalogue, PO defaults as stated) and instruct tailored sections to use those values and never choose a cycle. Lint: any "every N months/weeks/years" in tailored text must match a context-pack value. Replay the fixtures; re-record only the sections that now fail (expected: 5 and 6, or 8, depending on the default chosen; use 12 months for the policy and 3 months for the register, so section 8 stands and 5 and 6 are re-recorded).
- Budget: the next step is two more complete documents for the sole-trader case (complaints policy, self-assessment) so the review pack holds three real documents; batch 13 may spend up to $0.50 more (cap $0.89 total). If those come in clean, batch 14 records the full sole-trader set with a cap to be set from the measured cost per document.

**12 Oct 2026, batch-13 review (branch `req-005-generator`, 7675633): ACCEPTED; D-528 approved as D-043; R-8 scope narrowed.** Incident sections 5 and 6 re-recorded clean; the document agrees with itself. Complaints purpose and scope accepted.

- D-043 (from D-528): `policy-statement` sections take a 2,500 cap; the recorder's stop-after-truncation rule is per document, not per reference case.
- R-8 scope: the review-cycle lint applies to review wording only (review, reviewed, check this policy, look at the register). A reporting cadence that the law sets (the monthly restrictive practice report to the Commission, for example) is R-7's domain and is allowed when the sentence refers to the fixed section that holds it, which the behaviour-support monitoring sub-section does. Keep that fixture; do not re-record it.
- Budget: $0.50 spent; batch 14 may spend up to $0.30 more (cap $0.80 total) to finish the complaints policy and the self-assessment.

