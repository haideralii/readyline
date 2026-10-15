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

## Recording order for the next session (batch 42 item 9; backlog 6, D-550)

No recording without the PO's go-ahead. The plan is computed, not kept by
hand: `src/lib/generator/recording-plan.ts` sorts every approved section into
the first group below it qualifies for, with a fixture-key diff and a cost
estimate, and the dry run writes it out without a model call:

```
RECORDING_PLAN=1 npx vitest run src/lib/generator/recording-plan.test.ts
# -> out/recording-plan.md (the copy the PO reads: product/evidence/req-005/recording-plan-<date>.md)
```

Each group is one command. The Anthropic variables are read from `.env.local`
(never passed on a shell line); on PowerShell set them with
`$env:GENERATION_RECORD = "1"; $env:GENERATION_RECORD_GROUP = "1"; npm run generation:record`.
A group re-records its sections even where a fixture exists; the recorder
prints the selection and the estimate before the first call and stops a
document on a truncation (D-043).

0. **No fixture for the current prompt**
   `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=0 npm run generation:record`
   Replay serves the generic fallback for these until they are recorded once.
1. **The complaints procedure** (finding 9, D-546)
   `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=1 npm run generation:record`
   The recorded reply quotes Commission numbers from memory; the new brief
   refers to the fixed contact block and the `contact-details` lint rejects
   any number or address.
2. **The first three tailored sections of every document** (finding 12)
   `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=2 npm run generation:record`
   Purpose, Scope and the policy statement read at Year 10 to 11 against the
   Year 8 target; an auditor skims the front of each document first.
3. **The sections whose briefs changed in batch 40** (finding 8, D-545)
   `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=3 npm run generation:record`
   The incident procedure, the risk areas, the risk-assessed roles and the
   support planning steps; the recorded steps still say "as soon as
   possible", which the vague-time lint rejects.
4. **Recorded replies that carry "[Provider to complete: …]"** (finding 2, D-542)
   `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=4 npm run generation:record`
   Re-recording under the blank rule (S-8) turns the instructions into blanks
   the Finish page can ask for.
5. **Recorded replies the version 2 lints flag** (finding 10, `LINT_V2_REPORT=1`)
   `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=5 npm run generation:record`

6. **Batch 45 item 27: two brief changes that wait for this session, not a fixture now**
   `GENERATION_RECORD=1 GENERATION_RECORD_SECTIONS="practice-standards-self-assessment/summary,supports-step" npm run generation:record`
   The self-assessment's reason for the behaviour support modules reads
   "Our registration group does not carry the behaviour support modules, and
   we do not use restrictive practices"; the supports-step brief says
   "describe only supports inside the registration groups chosen". Apply both
   to `data/readyline-content/document-types.json` in the same commit as the
   recording: a changed brief changes the request hash, so the live briefs
   stay as recorded until then (D-542).
7. **Batch 45, the reviews' stale fixtures (PO recording list)**
   The three "plain-language-summary" fixtures (home sample, complaints
   policy, service agreement template, participant rights policy); the
   incident procedure (open-disclosure words, the medical emergency list
   step, "as soon as possible" replaced by a number, escalation roles taken
   from the responsibilities table); the safeguarding policy steps 3 and 4;
   the complaints policy contact section (refer to the fixed block by
   heading, no second list); the worker screening procedure names ("Worker
   checks"). Each brief change goes into the catalogue with its recording.

One section by name, in or out of a group:
`GENERATION_RECORD=1 GENERATION_RECORD_SECTIONS="complaints-management-policy-and-register/procedure" npm run generation:record`

When the incident sections are re-recorded, number the escalation table
(finding 16, D-542): it is unnumbered only so the recorded cross-references
stay valid.
