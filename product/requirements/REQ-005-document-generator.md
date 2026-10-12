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

### Batch 15 (2026-10-12): R-9 outline cross-references, R-10 module-filtered standards, re-recording the three documents

**R-9 and R-10, no model calls (item 1, D-531).** The context pack carries `outline` (number, id, heading of every numbered section, from `outlineFor`), rendered as an OUTLINE block in the user prompt with "(this section)" on the section being written and the instruction to refer to other sections only by the number and title in the outline, which overrides the house style's generic structure. `lintCrossReferences` runs after R-8: "section N" must exist in the outline, and a capitalised title after the number must be that section's heading (lowercase prose such as "section 3 explains" is not a title); the retry instruction says what section N is, which section carries the title the model used when it exists, and lists the outline ("section 3 is Definitions, and no section is called What we do. Refer to sections by the number and title in the outline (1 Purpose, 2 Scope, 3 Definitions, ...)"). `standardsForType` intersects the document's standards with the standards of the case's applicable modules. Unit tests: lint cases (right title with a lead-in, lowercase prose, generic-structure titles, a missing number, a title that belongs to another number), the retry instruction through `generateSection`, the outline in the pack and prompt for the incident policy (twelve numbered sections), and R-10 for the complaints policy: the verification sole-trader pack holds only `verification.complaints-management`, the certification case only `core.governance.feedback-and-complaints-management`. The R-7 example in eleven briefs no longer names "section 7 Reportable incidents" (wrong for every document except the incident policy); `PROMPT_VERSION` is 2026-10-12.2.

**Replay of every fixture (pinned in `fixtures-replay.test.ts`), by document and section:**

| Fix | What it invalidates |
| --- | --- |
| R-9 (cross-reference lint over the recorded text) | complaints policy / responsibilities ("section 3 What we do", twice); incident policy / how we put this into practice, batch-12 recording only ("section 4 Records we keep"; the batch-13 recording passes); behaviour-support procedure / all three steps sub-sections ("section 7 Reportable incidents", "section 6 Reporting to the Commission", "section 8 Monitoring and review": that document's sections 6 to 8 are Responsibilities, Our role and Records, so the model borrowed the incident policy's numbering) |
| R-10 (standards block changes) | sole trader / incident policy: `core.governance.incident-management` removed; sole trader / complaints policy: `core.governance.feedback-and-complaints-management` removed; behaviour-support company / plan implementation procedure: the five `sbs.*` standards removed (the case implements plans under `ibsp`); self-assessment unchanged (`all-applicable`) |
| Outline block (every section's user prompt changes) | every fixture is re-keyed, including the ones that pass both lints, so the three sole-trader documents (14 sections) are re-recorded in item 2 and the behaviour-support sub-sections wait for the full-set batch (`GENERATION_RECORD_CASE=verification-sole-trader` limits the run) |

**A consequence of R-10 the PO should weigh.** The skeleton snapshot for the sole-trader case changed in eleven documents whose listed standards are all core-module ones (governance policy, continuity of supports plan, conflict of interest policy, privacy and information management policy, records management policy, service agreement template, participant rights and choice policy, safeguarding policy, emergency and disaster management plan, AI use and governance policy, AI and digital data-handling procedure): their fixed "Records and evidence to retain" text, which lists evidence per standard, now renders the provider-to-complete placeholder instead, because a verification provider is not audited against those standards. The documents still ship and the tailored sections still receive the facts; they just cite no standard. If the PO would rather these documents cite the core standards as good practice for a verification provider, the filter can take a per-document `standardsSelection: "listed"` escape; not done without a decision.

**Re-recording the three documents (item 2), three runs, 20 billed calls over 14 sections, thinking off, about $0.28:**

Run 1, all 14 sections (upper bound about $0.21, retry first calls counted at the last call's size):

| Section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| incident / purpose | 1,500 | 2,278 | 111 | 0.006 (x2) | fell back: grade 22, then 11.4 on the retry |
| incident / scope | 1,500 | 2,219 | 575 | 0.010 | first time, grade 9.3 |
| incident / policy statement | 2,500 | 2,303 | 656 | 0.011 (x2) | fell back: "policy and our register every 12 months" (right to reject), then a correct sentence rejected by a lint false positive (D-532) plus "complies with the Rules" |
| incident / how we put this into practice | 4,000 | 2,324 | 901 | 0.014 | first time, grade 6.3 |
| incident / responsibilities | 1,500 | 2,316 | 674 | 0.011 | first time, grade 7.2 |
| incident / incident procedure | 4,000 | 2,257 | 839 | 0.013 | first time, grade 6.0 |
| complaints / purpose | 1,500 | 2,305 | 143 | 0.006 (x2) | grade 15.2, then 9.7 on the retry |
| complaints / scope | 1,500 | 2,297 | 495 | 0.010 (x2) | "carers" (families and carers), then 8.0 on the retry |
| complaints / policy statement | 2,500 | 2,302 | 721 | 0.012 (x2) | fell back: "families and carers" twice (lint false positive, D-532) |
| complaints / how we put this into practice | 4,000 | 2,349 | 739 | 0.012 | first time, grade 6.3 |
| complaints / responsibilities | 1,500 | 2,420 | 653 | 0.011 (x2) | fell back: "Policy every 12 months; register every 3 months" twice, correct text rejected (D-532) |
| complaints / complaints procedure | 4,000 | 2,299 | 1,161 | 0.016 | first time, grade 6.9 |
| self-assessment / our registration scope | 1,500 | 2,929 | 400 | 0.010 | first time, grade 8.8 |
| self-assessment / how we meet these standards | 1,500 | 2,961 | 851 | 0.014 | first time, grade 9.3 |

Three of the four fallbacks were correct text rejected by two lint defects: the R-8 subject rule took the whole sentence or row as the subject of every cycle mention, so a sentence giving the policy and the register their own cycles could never pass; and "families and carers" (the Commission's phrase for a participant's own carers) tripped the worker-synonym rule. Both fixed with unit tests (D-532; the carer exception is narrow and for the PO to confirm). The failed fixtures were removed and the four sections recorded again (run 2, about $0.05): incident policy statement passed on its retry (grade 9.5; the first reply had the register at 12 months), complaints policy statement (9.5) and responsibilities (7.9) first time, incident purpose fell back again (15.7, then 12.0). Its cause is the brief: a two-sentence section is graded on two sentences and the standard's name makes them long (D-533), so the purpose brief now asks for sentences under 15 words; the two recorded purpose sections were re-keyed and recorded (run 3, about $0.01): incident 10.7 and complaints 9.4, first time.

**Review pack.** `sections.md` shows the three documents complete again: incident (grades 6.0 to 10.7), complaints (6.3 to 9.5), self-assessment (8.8, 9.3); no fallback marker; every cross-reference passed the outline lint at generation time (the replay listing for R-9 holds only the orphaned batch-12 and behaviour-support fixtures).

**Measured cost per complete document with thinking off (last-call tokens, retries counted twice):** incident policy about $0.07 (six sections, one retry), complaints policy about $0.07 (six sections, one retry), self-assessment about $0.02 (two sections). About $0.011 per section that passes first time, $0.02 with a retry; input is 2,200 to 3,000 tokens per call with the outline block.

### Batch 16 (2026-10-12): D-045 basis, D-046 caching, the full sole-trader set, the Haiku comparison

**D-045 basis, no model calls (item 1, D-534).** Every catalogue item now has `basis` and, for the twelve the PO assigned, a `basisReason` (schema-enforced: a non-standard basis needs a reason). The document-control section carries a "Why this document" paragraph under its table: for a document with standards in scope, "Why this document: it supports the NDIS Practice Standards [names] for [provider]."; otherwise "Verification providers are not audited against this document under the NDIS Practice Standards. We keep it because [reason]." The records-and-evidence section uses the same sentence plus "We keep the records this document names, with the dates they were made, so an auditor can see it in use." in place of the placeholder. Test (every reference case): each document's control section carries one of the two sentences, no evidence section has a callout, and a kept-because document repeats the sentence in its evidence section. Fixed text only: the replay suite passes without a key change (confirmed); the three structure snapshots changed by one paragraph per document.

**D-046 prompt caching, no model calls (item 2, D-535).** The request's user text is now two content blocks: a per-document block (document title and purpose, FACTS, STANDARDS, REGISTERS, OUTLINE and the outline rule) and a section block (the section line with its outline number, the brief, the reply line). The client sends the system prompt and the document block with `cache_control: {type: "ephemeral"}` and the section block last; a retry appends the rejection to the section block so the cached prefix survives. **Fixture keys could not stay unchanged:** the queue asked for that, but caching a per-document block needs the section-specific text moved to the end of the user message, which changes the hashed text; caching only the system prompt would have kept the keys and saved less than half as much. `PROMPT_VERSION` is 2026-10-12.3 and the fourteen batch-15 sections were recorded again inside item 3 (about $0.15 at cached rates). Usage carries `cacheCreationInputTokens` and `cacheReadInputTokens` beside the API's uncached `inputTokens`; fixtures store them; the generation log gains the two columns (migration `20261012010000_generation_log_cache_tokens.sql`, to apply on merge); the recorder prices cache writes at 1.25x and reads at 0.1x of the input rate and reports the uncached figure beside it. Unit tests: the two blocks join to the hashed text, the document block is identical across a document's sections and carries no section text, the client sends the breakpoints, the pricing arithmetic.

**Full sole-trader set (item 3), D-039 to D-046, thinking off, caching on.** 90 sections of 18 documents plus the three behaviour-support sub-sections, one recorder pass each (built-in retry), then the two genuine failures once more. Per document (last-call tokens, retries counted at twice the last call):

| Document | Sections | First time | Retry | Fallback | Grades | Cache reads | Cached $ | Uncached $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| incident management policy | 6 | 4 | 2 | 0 | 5.5 to 10.7 | 10,675 | 0.054 | 0.080 |
| complaints management policy | 6 | 3 | 3 | 0 | 5.9 to 9.3 | 12,275 | 0.065 | 0.098 |
| self-assessment | 2 | 2 | 0 | 0 | 10.1 to 10.3 | 4,321 | 0.018 | 0.025 |
| governance policy | 6 | 6 | 0 | 0 | 6.0 to 10.7 | 11,220 | 0.037 | 0.057 |
| risk management policy | 6 | 6 | 0 | 0 | 5.7 to 8.5 | 12,530 | 0.044 | 0.066 |
| continuity of supports plan | 6 | 3 | 3 | 0 | 6.1 to 10.1 | 11,190 | 0.068 | 0.098 |
| conflict of interest policy | 5 | 3 | 2 | 0 | 6.2 to 10.6 | 9,239 | 0.046 | 0.070 |
| privacy and information management policy | 5 | 4 | 0 | 1 | 7.6 to 10.6 | 9,695 | 0.030 | 0.051 |
| records management policy | 6 | 3 | 2 | 1 | 6.9 to 9.1 | 11,652 | 0.051 | 0.082 |
| worker screening and recruitment procedure | 5 | 3 | 2 | 0 | 7.1 to 8.7 | 10,399 | 0.051 | 0.077 |
| induction and training procedure | 5 | 4 | 1 | 0 | 8.0 to 10.5 | 10,207 | 0.044 | 0.066 |
| code of conduct acknowledgement | 2 | 2 | 0 | 0 | 6.7 to 7.3 | 3,666 | 0.017 | 0.023 |
| service agreement template | 3 | 2 | 1 | 0 | 4.7 to 7.3 | 5,291 | 0.034 | 0.047 |
| participant rights and choice policy | 6 | 6 | 0 | 0 | 6.8 to 10.0 | 11,200 | 0.039 | 0.059 |
| safeguarding policy | 6 | 4 | 2 | 0 | 5.8 to 8.8 | 11,724 | 0.048 | 0.076 |
| emergency and disaster management plan | 5 | 4 | 0 | 1 | 7.5 to 10.7 | 9,235 | 0.043 | 0.063 |
| AI use and governance policy | 6 | 4 | 1 | 1 | 6.9 to 9.4 | 11,300 | 0.051 | 0.079 |
| AI and digital data-handling procedure | 4 | 1 | 3 | 0 | 7.3 to 10.3 | 7,732 | 0.047 | 0.071 |
| behaviour-support case: BSP implementation procedure | 3 | 2 | 0 | 1 | 9.1 to 9.6 | 8,497 | 0.045 | 0.066 |
| **Total** | 93 | 66 | 22 | 5 | | 182,048 | **0.831** | 1.253 |

Token totals across the 93 last calls: 14,750 uncached input, 12,409 cache writes, 182,048 cache reads, 54,877 output; **cache hit rate 87%** of input tokens. **The sole-trader set (90 sections) cost about $0.79 at cached rates, $1.19 uncached**, plus about $0.02 for the four first-run fixtures that were removed and recorded again: **item 3 about $0.85**, under the $1.60 ceiling. The recorder's five "fallback" rows are what the gate said at recording time; after the lint fixes below, four of those recorded replies pass on replay (the text was right, the lint was wrong), so **the review pack shows 89 of 90 sole-trader sections as real model text and one fallback**: the privacy policy's purpose, which scored 14.5, 12.4, 15.3 and 11.9 over two recorder passes (two sentences naming the Privacy Act and personal information; the under-15-words brief did not save it). Left for the PO: accept the fallback marker, or let purpose sections warn rather than fail above 11.

**Lint defects found by the volume (D-536).** (1) "Policy review register" names where reviews are recorded, so rows like "Reviews this policy and records the review in the Policy review register | Every 12 months" named both subjects; the R-8 subject rule was rebuilt (span before the mention, then after it, then the objects of the review verbs with recording verbs cut off) with eleven new unit cases, including "Every 12 months for the plan; every 3 months for the register". (2) The R-9 cross-reference run stopped at a colon, so "section 5 Steps: monitoring, reporting and review" was rejected; colons and commas now stay in the run and the heading test requires a word boundary. Replay listings re-pinned: R-7 lists seven first replies the gate refused (two batch-11, five batch-16: "within 5 business days", "Within 1 business day", "within 2 days"), R-8 six, R-9 unchanged (the behaviour-support first replies now pass), R-10 all eighteen sole-trader documents with core standards removed. One R-7 case is for the PO: the continuity plan's "Within 1 business day of being told" is the provider's own promise for its backup contact, not a statutory timeframe, and the rule as written rejects it.

**Review pack.** `product/evidence/req-005/sole-trader/` now holds all 18 `.docx` files and a `sections.md` covering every document (89 model-text sections, 1 fallback), each section with the answers it used and its readability grade.

**Haiku comparison (item 4, D-537).** `GENERATION_MODEL_OVERRIDE=claude-haiku-5-5` records into `fixtures/generation-claude-haiku-5-5/` (its own report; production never reads it) and `REVIEW_PACK_MODEL=claude-haiku-5-5` renders the three documents into `product/evidence/req-005/sole-trader-haiku/` with a `sections.md`. Haiku refuses the Sonnet off setting for thinking; the first pass therefore ran with no thinking parameter and its replies carried `thinking` blocks (three were thinking only and truncated at 1,500 tokens), which is direct evidence of the D-530 mechanism. The client now falls back to `{type: "disabled"}` (accepted by Haiku) before dropping the parameter, and the truncated and skipped sections were recorded again; two passing rows from the first pass keep their inflated token counts. Per section, Sonnet 5.5 and Haiku 5.5 side by side (last call; cached rates; Haiku prices assumed at $1 in / $5 out per million, UNVERIFIED):

| Section | Sonnet 5.5 | Haiku 5.5 | Sonnet grade | Haiku grade | Sonnet tokens | Haiku tokens | Sonnet $ | Haiku $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| incident / policy statement | first time | first time (thinking on, first pass) | 10.7 | 10.3 | 2,240 in / 482 out | 2,241 in / 2,372 out | 0.010 | 0.015 |
| incident / purpose | retry | fallback (empty `usedFacts`, then grade 12.4; thinking on) | 9.0 | - | 2,302 / 87 | 2,303 / 1,038 | 0.003 | 0.011 |
| incident / scope | first time | retry (11.7, then 10.9) | 10.5 | 10.9 | 2,233 / 486 | 2,297 / 403 | 0.005 | 0.005 |
| incident / how we put this into practice | first time | first time | 5.5 | 9.9 | 2,342 / 805 | 2,342 / 678 | 0.009 | 0.004 |
| incident / responsibilities | first time | first time | 8.1 | 9.1 | 2,333 / 634 | 2,333 / 502 | 0.007 | 0.003 |
| incident / incident procedure | retry | first time | 6.0 | 9.2 | 2,353 / 862 | 2,274 / 930 | 0.019 | 0.005 |
| complaints / purpose | first time | retry (empty `usedFacts`; thinking on) | 9.3 | 9.3 | 2,263 / 96 | 2,318 / 106 | 0.003 | 0.002 |
| complaints / scope | retry | retry ("carers" twice, passed under D-532) | 9.1 | 11.0 | 2,311 / 439 | 2,332 / 408 | 0.010 | 0.005 |
| complaints / policy statement | retry | retry (11.3, then 7.9) | 9.2 | 7.9 | 2,318 / 544 | 2,329 / 490 | 0.012 | 0.006 |
| complaints / how we put this into practice | first time | retry ("business day") | 7.5 | 8.9 | 2,367 / 710 | 2,441 / 782 | 0.008 | 0.009 |
| complaints / responsibilities | first time | first time | 8.0 | 10.7 | 2,358 / 658 | 2,358 / 710 | 0.007 | 0.004 |
| complaints / complaints procedure | retry | fallback ("within 2 working days", then "support worker") | 5.9 | - | 2,396 / 1,082 | 2,395 / 846 | 0.023 | 0.009 |
| self-assessment / our registration scope | first time | fallback ("guarantee", then grade 11.8) | 10.3 | - | 2,946 / 483 | 3,018 / 355 | 0.009 | 0.004 |
| self-assessment / how we meet | first time | retry (12.3, then 9.6) | 10.1 | 9.6 | 2,979 / 784 | 3,043 / 783 | 0.009 | 0.009 |
| **Total / mean** | 9 first, 5 retry, 0 fallback | 5 first, 6 retry, 3 fallback | mean 8.5 | mean 9.7 | | | 0.136 (uncached 0.202) | 0.090 (uncached 0.135) |

Haiku cache hit rate 86%. Reading: Haiku costs roughly two thirds of Sonnet per section at the assumed prices (less once the two thinking-on rows are discounted), but fails the house-style gates more often (a role title, a banned claim word, restated timeframes), reads about a grade harder, and leaves three of fourteen sections to the provider where Sonnet left none. The Haiku `.docx` files are in `sole-trader-haiku/` for the PO to read side by side. Item 4 spend: about $0.10 (first pass $0.05 including the thinking-on calls, second pass $0.04, retry first calls up to $0.02), at the $0.10 ceiling.

**Running total.** $0.93 before this batch; item 3 about $0.85; item 4 about $0.10; **about $1.88 to date** (batch budget $2.00, cap $2.93).

### Batch 17 (2026-10-12): R-11 grants, D-047, D-049, R-12, the last re-records, PR #9 readiness

**R-11 grants (item 1, D-538).** Migration `20261012020000_service_role_function_grants.sql` grants execute on `auth_rate_limit_hit(text, integer, integer)` and `generation_quota_hit(uuid)` to `service_role`; the header records Haider's hand-applied grants on the hosted project (idempotent) and lists where each function is called. These are the only two secret-key functions: `create_account` and `delete_account` run as the signed-in user with their existing grants; the purge job and the admin pages use table access. `tests/integration/service-role-grants.test.ts` calls each function through a client built with the secret key and asserts a boolean reply, and asserts the publishable key is refused (42501) both signed out and signed in; it runs in CI's Supabase job with the other integration suites (not runnable on this machine: no local stack).

**D-047, D-049, R-12 (item 2, D-539).** Readability: the catalogue holds `defaults.readabilityFailAbove: 11`, `defaults.shortSectionWords: 40` and `readabilityFailAbove: 12` on the privacy and records management policies; the pack carries `readabilityGate` (not in the prompt, so no key change) and a reply fails only above the document's line with at least 40 words; shorter sections keep the warning in the reviewer view. R-7: `lintTimeframes` flags a timeframe only when its sentence (its row, in a table) carries a statutory anchor (the Commission, notify, report, reportable, the Rules, or the document's rules-section heading passed in from the pack). R-12: when the case cites none of a document's standards, the pack's `document.basisReason` names the obligation, the purpose and policy-statement briefs are swapped for obligation briefs ("Our commitment | What we do", never a standard or indicator), and `lintPlaceholders` rejects a "[Provider to complete ...]" that mentions a standard or indicator with a retry naming the obligation. Unit tests: timeframe anchors (promise allowed, Commission, Rules, rules-section heading, table rows), the placeholder lint, short-section warning against a 48-word fail, the privacy line at 12 against the default 11, the obligation briefs for the governance policy against the untouched incident policy, and a placeholder reply retried with the obligation named. **Replay listing of what each change invalidates:** the placeholder lint catches six batch-16 recordings (AI policy purpose and policy statement; continuity purpose; governance, rights and records policy statements); the obligation briefs re-key seventeen sole-trader sections (purpose and policy statement of the governance, conflict of interest, privacy, records, rights, safeguarding and AI use policies; purpose of the continuity plan, the emergency plan and the AI data-handling procedure), pinned in `fixtures-replay.test.ts`; D-047 and D-049 invalidate nothing and instead let two recorded first replies pass (the privacy purpose at 15.3 as a short section, the continuity cover's "within 1 business day"), so those two need no call; the R-7 listing drops from seven to three.

**Re-recording (item 3), one run, 18 billed calls over 17 sections, cached, thinking off, about $0.09 ($0.13 uncached):**

| Section | Outcome | Grade | Tokens (uncached in + cache write + cache read / out) | Cached $ |
| --- | --- | --- | --- | --- |
| governance / purpose | first time | 5.8 | 141 + 1,949 + 0 / 97 | 0.006 |
| governance / policy statement | retry (register every 12 months, rightly refused) | 8.2 | 256 + 0 + 1,949 / 606 | 0.007 x2 |
| continuity plan / purpose | first time | 10.2 | 135 + 468 + 1,475 / 118 | 0.003 |
| conflict of interest / purpose | first time | 8.5 | 141 + 466 + 1,475 / 103 | 0.003 |
| conflict of interest / policy statement | first time | 8.1 | 177 + 0 + 1,941 / 707 | 0.008 |
| privacy / purpose | first time | 10.9 | 158 + 464 + 1,475 / 138 | 0.003 |
| privacy / policy statement | first time | 9.6 | 194 + 0 + 1,939 / 740 | 0.008 |
| records / purpose | first time (11.7: short section, warns) | 11.7 | 140 + 467 + 1,475 / 116 | 0.003 |
| records / policy statement | first time | 8.1 | 176 + 0 + 1,942 / 868 | 0.009 |
| rights / purpose | first time | 8.3 | 141 + 470 + 1,475 / 99 | 0.003 |
| rights / policy statement | first time | 9.0 | 177 + 0 + 1,945 / 693 | 0.008 |
| safeguarding / purpose | first time (11.1: short section, warns) | 11.1 | 141 + 479 + 1,475 / 114 | 0.003 |
| safeguarding / policy statement | first time | 8.7 | 177 + 0 + 1,954 / 682 | 0.008 |
| emergency plan / purpose | first time | 10.2 | 147 + 465 + 1,475 / 106 | 0.003 |
| AI use policy / purpose | first time | 9.5 | 150 + 490 + 1,475 / 124 | 0.003 |
| AI use policy / policy statement | first time | 8.2 | 186 + 0 + 1,965 / 600 | 0.007 |
| AI data-handling procedure / purpose | first time (12.7: short section, warns) | 12.7 | 153 + 458 + 1,475 / 108 | 0.003 |

Three purposes passed only because of the short-section rule (D-047); their grades are visible to the reviewer as warnings. The one retry was the register cycle, a correct rejection. Item 3 spend about $0.09 (under the $0.40 ceiling); **running total about $1.97** (cap $2.28).

**Review pack.** `sections.md` now shows **90 of 90 tailored sections as real model text, no fallback marker, and no placeholder that mentions a standard or indicator**; the privacy purpose and the continuity cover replay their recorded first replies under D-047 and D-049. The sole-trader set's recorded cost, last call per section with retries counted twice, is about $0.80 at cached rates ($1.18 uncached). Replay listings re-pinned: R-8 gains the governance policy statement's refused first reply.
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

**12 Oct 2026, batch-14 review (branch `req-005-generator`, db492bf): ACCEPTED; two new fixes before the full set.** Three complete real documents in the review pack. The complaints policy and procedure are at the standard (grades 5.8 to 9.5; the "receive, record, acknowledge" procedure is exactly how a one-person provider should run it). The thinking-off finding (D-530) is accepted and welcome: real text cost is about half of what the earlier tables show.

- R-9 **Cross-references must match the document's own outline.** The complaints responsibilities section says "Timeframes are in section 3 What we do", and section 5 says "see the section on complaint timeframes"; this document has no section 3 What we do (3 is Definitions) and its timeframes live in a fixed section with another number. The model is quoting the house style's generic structure, not the document's outline. Fix: the context pack carries the document's actual numbered outline (number and title for every section, fixed and tailored) and the brief says "refer to sections by the number and title in the outline"; a lint rejects any "section N" or "section N Title" that does not match the outline, with the retry instruction naming the right section. Replay; re-record only failing sections.
- R-10 **Standards in the pack must be filtered to the case's applicable modules.** `standardsForType` takes `type.standards` as listed, so the verification sole-trader case receives the core module's "Feedback and complaints management" alongside the verification module's "Complaints management", and the policy statement cites both. A verification provider is audited against the verification module only; citing core-module indicators invites questions at audit. Fix: intersect `type.standards` with the standards of `result.modules` (keep `all-applicable` as is), with a unit test that the verification sole-trader case's complaints policy pack holds only `verification.complaints-management` and the certification case holds the core standard. This changes the request hash for every section that received standards; replay to list them and re-record those (budget below).
- Budget: $0.65 spent. Batch 15 may spend up to $0.60 more (cap $1.25 total) to re-record what R-9 and R-10 invalidate in the three documents. The full-set recording follows in batch 16 once the three documents are clean again, with its own cap set from the measured cost per document (about $0.05 with thinking off).

**12 Oct 2026, batch-15 review (branch `req-005-generator`, 9aa867b): ACCEPTED.** Three complete documents, every cross-reference inside the outline, standards filtered to the case. D-531 to D-533 accepted; the carer exception accepted (the Commission's own phrase). Measured cost with thinking off: about $0.07 per six-section policy, so a full sole-trader set is about $1.

Decisions on the open items:
- D-045 **Documents with no applicable standard for a verification provider.** Keep them in the set: they exist because of the NDIS Code of Conduct, the Commission's Rules, the Privacy Act or plain good practice, and an auditor doing a verification audit still asks how the provider handles rights, privacy and emergencies. No per-document escape back to core standards. Instead, every document type in the catalogue gets a `basis` field (one of `practice-standard`, `code-of-conduct`, `commission-rules`, `privacy-act`, `good-practice`, with a one-line plain reason), and when a document cites no standard for the case, the fixed "Why this document" paragraph under the title and the evidence section say: "Verification providers are not audited against this document under the NDIS Practice Standards. We keep it because [reason]." No "[Provider to complete]" placeholder there. PO's assignments: governance, conflict of interest, participant rights and choice, safeguarding, service agreement, code of conduct acknowledgement → `code-of-conduct` ("the NDIS Code of Conduct applies to every provider and worker"); privacy and information management → `privacy-act`; records management → `commission-rules` ("record-keeping conditions of registration"); continuity of supports → `commission-rules` ("conditions of registration"); emergency and disaster management, AI use and governance, AI and digital data handling → `good-practice` (the AI pair: "the Commission's 2026 position on AI use by providers"). Risk management, worker screening and recruitment, induction and training, complaints and incidents already map to verification standards and are unchanged.
- The behaviour-support fixtures are re-recorded in batch 16 (three sub-sections, about $0.05).
- Budget: $0.93 spent. Batch 16 may spend up to $2.00 (cap $2.93 total): the remaining sole-trader sections (about $1.00), the behaviour-support sub-sections, and the Haiku comparison (about $0.05).

**12 Oct 2026, batch-16 review (branch `req-005-generator`, 505c903): ACCEPTED; the full sole-trader set is at the standard; three decisions and two fixes before merge.** 18 documents, 89 of 90 tailored sections real, $0.79 for the set with an 87% cache hit rate. Read in full: the service agreement template (participant details left blank by design, the NDIS Pricing Arrangements cited correctly, an easy-read summary at grade 2.8) and the AI use policy; spot-read governance, rights, safeguarding and the self-assessment. D-534 to D-537 accepted; the fixture re-key for the per-document cache was the right call.

Decisions:
- D-047 **Readability on short sections.** A two-sentence purpose is too small a sample for a grade to mean much, and privacy vocabulary ("personal information") is long by nature. Rule: sections under 40 words get a readability warning, never a failure; `privacy-and-information-management-policy` and `records-management-policy` get a fail threshold of 12 in the catalogue; everything else stays at 11. Re-record the privacy purpose once under the new rule.
- D-048 **Haiku.** Production stays on Sonnet 5.5. Three fallbacks in fourteen sections and harder reading grades are not worth a third of a cent per section. Keep the recorder's model override and the Haiku fixtures as a reference; revisit only if the per-pack cost ever matters, which at about $0.80 a pack it does not.
- D-049 **R-7 scope.** The timeframe lint catches a timeframe only when the sentence also carries a statutory anchor (the Commission, notify, report, reportable, the Rules, or the document's rules-section title). A provider's own promise ("within 1 business day") is tailoring and allowed. Re-record the continuity plan section that the old rule rejected.

Fixes before PR #9 merges:
- R-11 **Server-key functions lack the grant** (found by Haider's first sign-in on the hosted database: Postgres 42501 from `auth_rate_limit_hit`). The migrations revoke execute from public but never grant it to `service_role`, so the hosted project refuses the rate limiter and the generation quota function; CI's local stack passed because it runs as the database owner. Haider has applied the two grants by hand in the SQL editor. Fix: a migration granting execute on `auth_rate_limit_hit` and `generation_quota_hit` (and any other function meant for the secret key) to `service_role`, and an integration test that calls each of them through a client built with the service-role key, not the owner connection, so the gap cannot return. Record as D-538.
- R-12 **No-standard documents still ask for a standard in tailored text.** The AI use policy's purpose says "[Provider to complete: name the NDIS Practice Standard this policy supports]" and its policy statement ends "[Provider to complete: list the quality indicators ... None were provided]". D-045 fixed the fixed text; the briefs still tell the model to name a standard. When the document's `basis` is not `practice-standard` for the case, the purpose brief says "and which obligation it supports: [basis reason]", the policy-statement brief drops the quality-indicator column and uses "Our commitment | What we do", and the lint rejects a "[Provider to complete" placeholder that mentions a standard or indicator. Replay; re-record only the sections that now fail (expected: purpose and policy statement of the no-standard documents, about $0.15).
- Budget: $1.88 spent. Batch 17 may spend up to $0.40 (cap $2.28). After batch 17 the PO merges PR #9 and REQ-005 is accepted; certification and behaviour-support reference sets are recorded later as separate batches when the payments flow needs them.

