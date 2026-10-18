# REQ-033 Session C: the plain-words summary's review state

Branch `req-033-session-c`, from `req-033-session-b` 4f872ef (D-031) and rebased onto `next` once #125 landed; PR to `next`. Dev-2, 19 Oct 2026. One commit per requirement with its tests. One migration (`20261019020000_summary_check.sql`: two nullable columns on `document_versions`, set together or not at all). The REQ's Session C section carries the Dev response and the Delivery evidence block.

## What this PR does

- **FR-C1 (D-2977).** When `regenerateSection` or Session B's redraft replaces a tailored section of a document that carries the plain-words summary, the new version records which section changed and when (`summary_check_section_id`, `summary_check_on`); the summary's own redraft and a document without the summary set nothing. The control register's row carries the line "In plain words may be out of date: section N <heading> changed on <date>" whatever its one-word state, and takes the word `summary-review` once the document is adopted and nothing more urgent stands; adoption is untouched.
- **FR-C2 (D-2978, D-2982).** Under the summary on the document's page, two buttons. "Redraft the summary": one model request with the summary's current text and brief, the changed section's new text and the outline headings (no facts, finding or standard block), the Year 6 gate, the redraft limiter and the daily quota, into a new unadopted version with the change-log row "In plain words redrafted after section N changed; approved by [role]". "The summary is still right": the change-log row "In plain words confirmed after section N changed" with the day and the owner's name and role, written into the current version in place with its .docx rendered again; no model, no new version, no re-adoption. Either clears the state; a refusal is one plain sentence and the current text stands.
- **FR-C3 (D-2980).** While the state is set, one line under the Easy Read section: "If you keep an Easy Read version, check it too."
- **FR-C4 (D-2981).** The register row's line with a link to the summary; "N summary to check" in the registers sentence the registers index and the audit-day page read; the auditor's view and the pack's document-control CSV gain the column `summary_to_check`.
- **FR-C5.** The label "Summary to check"; no "compliant", "closed" or "resolved" in any word; pinned.
- **The e2e.** On the fake model mode from Session B (a summary request is answered with a short sentence so the Year 6 gate holds), the spec seeds the complaints policy with its summary in words, redrafts a section through Session B's walk, reads the state and the surfaces, confirms, sets the state again as the paths set it and redrafts the summary into version 3.

## Checks

- `npm run check`: green, 228 files (1 skipped), 1,709 tests, 6 skipped.
- The Session C walk runs in this PR's Supabase job on three projects.

## For the PO

- The Dev response's questions 1 (a) and 2 (a) as built (D-2350 (3), (4)).
- A live reply for the summary's redraft before the trial, with REQ-033's 6 (a).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
