# REQ-033 Session B: one mapped section redrafted with the finding as context, as a new version the provider adopts

Branch `req-033-session-b`, from `req-033-session-a` 7c8bcac with `origin/next` (a4ae860, #124) merged before each push; PR to `next`. Dev-2, 19 Oct 2026. One commit per requirement with its tests. One migration (`20261019010000_findings_redraft.sql`: two columns on `findings`, `findings_status` recreated, `generation_log.source`). The REQ's Session B section carries the PO's answers, the lawyer's and NDIS expert's reads (D-2955 to D-2960) and the Delivery evidence block.

## What this PR does

- **FR-B2, FR-B3, FR-B5 (`src/lib/generator/redraft.ts`).** The request the model gets is one pure function: the document's title and kind, the section's number, heading and brief (the generator's own builder), the section's current text after the read-time fill, the standard and the indicator the finding names, the finding's words as data, the outline's numbers and headings; no FACTS block, no other section, no register row, and a test says so. The reply goes through the pipeline's checks and three redraft checks: no "audit", "auditor", "finding", "non-conformity" or "closed" in the body (D-2955), the finding's sentences not quoted, the current text's anchors kept (the provider's name, state names, "section N" references). `redraftModel` replaces the one section, moves the version and adds the change-log row "Section N <heading> redrafted after audit finding FND-0001; approved by [role]" with "[name]" for the adoption snapshot (D-2855, D-2958).
- **FR-B1, FR-B5, FR-B6, SR-B1 to SR-B5 (`src/server/registers/findings-redraft-actions.ts`).** The draft: the subscription, the finding, the gate on its words again, the mapping's tailored section, the hourly limiter (`REDRAFT_LIMIT`, ten) and the daily quota spent only when the model is called, one call, the reply read, a `generation_log` row with `source: redraft:FND-0001` and never the words; nothing stored. The accept: the blocks read again against the newest version, version n+1 inserted by the service role with its .docx and change-log row, unadopted (`adopted_on` null; the control register reads "new-version"), the finding row's `redraft_version_id` and `redraft_section_id`, the improvement row's one action line, a register event and the audit line `documents.redrafted`. A refusal is one plain sentence and the current text stands (D-2957).
- **FR-B1, FR-B4, FR-B6, FR-B7 (the page).** `/registers/findings/[id]/redraft/[typeId]`: the finding's words, what the model sees, one button, then the current text and the redraft side by side (stacked under lg) with the changed sentences marked and counted, "Use this redraft" and "Keep the current text". Each "Answered in" line with a tailored section in a document the set holds carries the link; a register, a fixed section or a document without a version says why in one sentence; a redrafted finding shows the version and whether it is adopted. The AI page's model sentence names the redraft (D-2956), pinned.
- **A Session A fix on the way (8b5948a).** The mapping numbered a section by its index over the front matter, so "Answered in" read "section 5 Scope" for the document's section 2; the number is the rendered one now, only numbered sections are candidates, one test pins it to the outline.
- **The e2e's model (`GENERATION_FAKE=1`).** The client answers a redraft from the request itself (the current section echoed plus one plain sentence) and leaves every other request to the replay client; never in production (the launch checklist's new row "Fake model off"; `LAUNCH.md`; `.env.example`; Playwright's web server sets it as it sets `STRIPE_FAKE`). No reply is recorded as if a model had written it (the PO's 6 (b)).

## Checks

- `npm run check`: green, 216 files (1 skipped), 1,618 tests, 6 skipped.
- The end-to-end walk (AC-B1 to AC-B3, AC-B8, AC-B9) runs in this PR's Supabase job on three projects; the rate-limits table's new row in the same job.

## For the PO

- The first run of the redraft walk is this PR's.
- D-2959's plain-language summary state is the next session's first item; a live reply before the trial when you say so (6 (a)).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
