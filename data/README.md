# data/

Source-of-truth fixtures for the standards mapping (Phase 1).

- `sources/`: text snapshots of the NDIS Quality and Safeguards Commission
  pages and PDFs the mapping is built from, with `manifest.json` recording
  each URL, fetch date and SHA-256. Re-fetch and diff before each release.
- `standards.example.json`: small verified sample in the proposed shape, used
  by `src/lib/standards/schema.test.ts`. Review this before the full dataset
  is populated.
- `standards.json` (next session): the full dataset. Every outcome and
  indicator is copied verbatim; every record points at a source entry; any
  record not confirmed from the Commission's site is marked `unverified`
  with a note. Nothing in this folder is written from memory.
- `*.test.ts`: unit tests over the fixtures (every registration group maps to
  at least one module; verification vs certification derives correctly).

The schema lives in `src/lib/standards/schema.ts`.
