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

CI never sets those variables, so it only replays. No fixtures exist yet:
Dev is waiting for the Anthropic key (batch 7, item 4).
