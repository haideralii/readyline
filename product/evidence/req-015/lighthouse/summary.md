# Lighthouse accessibility (REQ-015 FR-19)

Run 13 Oct 2026 with scripts/ops/lighthouse.mjs (Lighthouse 12.8.2, Playwright Chromium, accessibility category only) against a local production build (next start on port 3100).

- http://localhost:3100/about: 100
- http://localhost:3100/: 100
- http://localhost:3100/pricing: 100
- http://localhost:3100/refunds: 100
- http://localhost:3100/sign-in: 100
- http://localhost:3100/start: 100

The JSON reports are not kept in the repository (about 400 KB each); re-run the script to regenerate them.
