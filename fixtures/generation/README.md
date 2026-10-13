# Recorded model fixtures (REQ-005, D-502)

Layout: `<documentTypeId>/<sectionId>/<sha256>.json`, where the hash covers the
prompt version, the model id and the exact system and user prompts. A change to
any of those produces a new key, so a stale fixture is never replayed by
mistake; CI fails with the expected path when a fixture is missing.

Each file holds the request, the raw reply, token usage and the recording time.
Re-record locally:

```
GENERATION_RECORD=1 ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=... npm run generation:record
```

CI never sets those variables, so it only replays. A fixture whose user prompt
was re-keyed after a brief change says so in `userRekeyNote` (D-1802); its
reply answers the brief as it was.

## Recording order for the next session (batch 42 item 9)

No recording without the PO's go-ahead. In this order, each about one call at
the current model price:

1. The complaints procedure (finding 9, D-546): the recorded reply quotes
   Commission numbers from memory; the new brief refers to the fixed contact
   block and the `contact-details` lint rejects any number or address.
2. The first three sections of every document (finding 12): Purpose, Scope and
   Policy statement read at Year 10 to 11 against the Year 8 target; an auditor
   skims the front of each document first.
3. The incident procedure and the other four sections whose briefs changed in
   batch 40 (finding 8, D-545): the recorded steps still say "as soon as
   possible", which the vague-time lint rejects.
4. The 88 recorded sections that carry "[Provider to complete: …]" instructions
   inside sentences (finding 2, D-542): re-recording under the blank rule
   (S-8) turns them into blanks the Finish page can ask for.
5. The complaints policy statement and the rest of the 60 recordings the
   version 2 lints flag (finding 10 and the lint report from
   `LINT_V2_REPORT=1`).

When the incident sections are re-recorded, number the escalation table
(finding 16, D-542): it is unnumbered only so the recorded cross-references
stay valid.
