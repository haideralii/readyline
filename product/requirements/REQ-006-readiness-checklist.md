# REQ-006: Readiness checklist
Status: ready
Phase: 4   Priority: must   Owner: Dev   Depends on: REQ-003 (result), REQ-005 (document set).

## Why
The result page tells a provider what they need; the checklist tells them what they still lack and lets them tick things off as they get ready. It is the page they come back to between buying the pack and booking the audit, and it is the natural home for the subscription offer later.

## Scope
In: a per-assessment checklist derived from the result (documents, registers, clearances, insurances, training, other evidence), with status per item, free-text notes, and a progress summary; printable; the "already have" answers pre-tick items. Out: uploading evidence files (parking lot; privacy risk), reminders (REQ-009), sharing with an auditor.

## Functional requirements
- FR-1 **Derivation** `deriveChecklist(result)` in `src/lib/checklist/`: items grouped as Documents (one per document in the set), Registers (one per register), People (worker screening clearance for each key personnel and risk-assessed role as a count, NDIS Worker Orientation Module completion per worker, first-aid where the registration group requires it per `standards.json` evidence), Business (ABN, insurances: public liability, professional indemnity; workers compensation when workers > 1 or structure is company; the exact list comes from the Commission's registration requirements already in `standards.json`; anything not sourced is marked `unverified`), Audit (choose an approved auditor, book the audit, mid-term audit date for certification). Every item carries a `sourceRef` into `standards.json` or the Readyline content data, and a one-line "why" in plain words.
- FR-2 **Pre-fill** from the questionnaire's "already have" answers: items the provider said they have start as `have`; everything else `need`. Documents in a purchased pack start as `drafted` once generated, and `adopted` when the provider ticks them after review.
- FR-3 **Page** `/checklist` (signed in; one per assessment): progress line ("14 of 31 items ready"), groups collapsed except the first incomplete one, each item with status (need / in progress / have), a note field (plain text, 500 chars, with the no-participant-data warning from REQ-004 shown once), and the why line. Status and notes persist per account (`checklist_items` table, RLS as REQ-004). Keyboard operable; status is a radio group with the human label as the accessible name (REQ-013 pattern).
- FR-4 **Print**: a print stylesheet that lists every item with its status and note, the provider's trading name, the date, and the not-legal-advice line.
- FR-5 **Signed-out**: the result page shows a two-line teaser ("Your checklist has 31 items; sign in to track them") with the sign-in link; no checklist data is created before sign-in.
- FR-6 **Audit-type specifics**: certification shows the mid-term audit item and the site-visit preparation items (participant interviews consent, worker interview availability); verification shows the desktop-evidence items only.

## Security and privacy
- SR-1 Notes are free text the provider controls; the field label says "Do not enter participant names or health details"; the export (REQ-004) includes notes; purge removes them.
- SR-2 RLS cross-tenant test for `checklist_items`.

## Acceptance criteria
- AC-1 Unit tests: every document and register in the three reference cases appears exactly once; the People and Business items match the case (sole trader: no workers compensation item; company with 5 workers: present); every item has a `sourceRef`; unverified items are flagged.
- AC-2 e2e: pre-fill from "already have"; tick an item, reload, it persists; progress line updates; print view renders; android-small and desktop; axe clean; Lighthouse accessibility 100.
- AC-3 RLS test passes.

## Evidence required on delivery
Screenshots of the checklist for the sole-trader and the certification case at both viewports, and the print view.

## Dev response

**2026-10-12 (batch 19, item 4; branch `req-006-checklist` from `main` a77be8b).**

- **Derivation signature.** `deriveChecklist(result, answers, dataset)` rather than `deriveChecklist(result)`: the People and Business items need the worker counts, the key-personnel count, the screening answer, the business structure and the ABN, none of which is in the result. The result stays the source for documents, registers, modules and the mid-term rule. Pure, no I/O.
- **What is sourced and what is `unverified`.** Every item carries a `sourceRef` (a standard id with the indicator number, a `standards.json` source id, a rule, or the Readyline content file) and a plain-words "why". Sourced from Commission text: the orientation module (core governance HR management indicator 3; verification HR management indicator 2), the three insurances (risk management indicator 6 / verification indicator 2 name professional indemnity, public liability and accident insurance), the ABN (Rules 2018 s 11, "Applicant must have an ABN"), the audit types, site visits, participant and worker interviews and the mid-term audit (the "Types of audits" page). Marked `unverified` because the Commission text in the dataset does not state them: worker screening clearances as a checklist count (the Worker Screening Rules are not in the dataset; the HR evidence item is ours), and workers compensation insurance (state law, not Commission text; shown only when workers > 1 or the structure is a company, per the REQ). No first-aid item is derived: nothing in `standards.json` ties first aid to a registration group, and inventing one would break CLAUDE.md 4.6.
- **Statuses.** `need`, `in-progress`, `have` as the REQ says, stored per account and item in `checklist_items` (member-scoped RLS; explicit grants to `authenticated`, since the hosted project lacks default grants, D-422). Untouched items are not stored, so no row exists before the provider changes something (FR-5). Documents in a generated set show as `drafted` when a ready version set contains that document type and the provider has not set a status yet; `have` reads "Adopted" for documents (FR-2).
- **Print** is a separate print-only rendering of every item with status, note, trading name, date and the not-legal-advice line, so collapsed groups never hide anything on paper.
- **Teaser (FR-5)** comes from the result action: it returns the checklist size alongside the result, so the result step (a client component) shows "Your checklist has N items; sign in to track them" without shipping the standards dataset to the browser.
- **Estimate.** Session A (derivation, tests) and Session B (migration, page, print, RLS test, e2e) in this batch. The signed-in e2e needs a Supabase stack and runs in CI's Supabase job (no local stack on the dev machine; the hosted project refuses the admin client until D-711's grants apply), so the screenshots come from that job's artifact.

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)
