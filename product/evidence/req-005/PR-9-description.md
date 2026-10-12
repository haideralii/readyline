# PR #9: REQ-005 document generator (`req-005-generator`)

Paste this as the pull request description and mark the PR ready for review. Written by Dev on 12 Oct 2026 for batch 17 item 4; the Dev machine has no GitHub CLI or token, so the PO or Haider applies it.

## What the generator does

For a provider who has finished the questionnaire, it produces the document set for their case (18 documents for the verification sole-trader reference case) as editable `.docx` files plus a PDF readiness summary, and stores them per account with versioning, a per-account daily quota and an audit log.

- **Fixed text and tailored sections.** Every document is an outline of fixed sections (document control, definitions, the Commission's rules and standards verbatim, registers, records, review, the general-information notice) and tailored sections (purpose, scope, policy statement, how we put this into practice, responsibilities, procedures). Fixed text never goes near the model. Each tailored section is one model call with a strict context pack: the provider's eleven business facts, the document's purpose, the standards the case is audited against (filtered to its modules), its registers, its numbered outline and its review cycles. Participant data, register contents and the questionnaire's free text never reach the prompt (schema and tests).
- **Gates on every reply.** JSON schema (closed block types, facts used), terminology and claims lint (house style), readability (Flesch-Kincaid; per-document fail line, short sections warn only), statutory-timeframe lint with anchors, review-cycle lint, cross-reference lint against the document's own outline, placeholder lint for no-standard documents. One retry with the problem named, then a visible "Review and complete" fallback. Truncated replies are reported, never retried.
- **Documents kept on an obligation.** For a verification provider, documents whose standards are all core-module ones stay in the set and say why they are kept (Code of Conduct, Commission rules, Privacy Act, good practice) instead of citing a standard.
- **Reproducible by design.** Every model request is hashed; recorded fixtures replay through the current gate in CI without network. Prompts, briefs and lints change only through versioned decisions.
- **Cost controls.** Thinking off on every call; prompt caching on the system prompt and the per-document block; caps per section type; a daily quota per account; a feature flag.
- **Reviewer view.** Per document, which questionnaire answers drove each section, the readability grade, and a diff between versions.

## Decisions (DECISIONS.md)

D-501 to D-540 cover this branch: D-501 to D-508 (architecture, replay, fixed text, readability, caps), D-523 to D-537 (recording pipeline, retries, truncation, timeframe and review-cycle lints, outline cross-references, module-filtered standards, thinking off, caching, Haiku comparison), D-538 (service_role grants), D-539 (readability gate per document, statutory anchors, obligation briefs), D-540 (one readability module). PO decisions D-037 to D-050 set the budgets and the rules the lints enforce.

## Measured on the sole-trader reference set (18 documents, 90 tailored sections)

| Measure | Value |
| --- | --- |
| Tailored sections with real model text | 90 of 90 (review pack in `product/evidence/req-005/sole-trader/`) |
| Cost per pack at cached rates | about $0.80 (about $1.18 uncached), last call per section with retries counted twice |
| Cost per section | about $0.009 passing first time; about $0.04 per six-section policy |
| Cache hit rate | 87% of input tokens (per-document block cached across a document's sections) |
| Model | `claude-sonnet-5-5`, thinking off; Haiku 5.5 recorded as a reference only (D-048) |
| Readability | grades 4.7 to 12.7; every section at or under its document's line, short sections warn |

## Migrations in this PR

- `20261012000000_documents.sql` (version sets, document versions, generation log, quota, private bucket)
- `20261012010000_generation_log_cache_tokens.sql` (cache token columns)
- `20261012020000_service_role_function_grants.sql` (execute grants; already applied by hand on the hosted project, idempotent)

## Checks

`npm run check` (lint, format, typecheck, unit), `next build`, Playwright in CI mode on both projects, the Supabase integration suite in CI (RLS, quota, service-role grants), the LibreOffice render job for every skeleton.
