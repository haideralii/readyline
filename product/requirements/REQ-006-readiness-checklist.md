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
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
**13 Oct 2026 (branch `req-006-checklist`, 3a48546; Dev response and Sessions A, B): ACCEPTED on the Dev status and tests; UI screenshots reviewed at merge.** D-601 to D-606 accepted. Conditions: every item carries a `sourceRef`; `unverified` items render with a visible "not yet verified against the Commission's text" tag; notes field carries the no-participant-data warning. The PO opens the PR; merge after REQ-013 P2 and REQ-014 per the dev's order.
