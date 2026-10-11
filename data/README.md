# data/

Source-of-truth fixtures for the standards mapping (Phase 1).

- `standards.json` (Phase 1): NDIS Practice Standards and Quality Indicators,
  registration groups, module applicability and audit pathway rules. Every
  entry carries the Commission source URL and the version date it was taken
  from. Nothing in this folder is written from memory.
- `*.test.ts`: unit tests over the fixtures (every registration group maps to
  at least one module; verification vs certification derives correctly).
