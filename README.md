# {{BRAND}}: registration-readiness for small NDIS providers

Self-serve web app that helps sole-trader and small NDIS providers prepare for
mandatory provider registration: a guided questionnaire, tailored policies and
a Practice Standards self-assessment as editable Word files, a readiness
checklist, and an optional monthly audit-ready subscription with registers.

The full product brief, constraints and build plan are in [CLAUDE.md](CLAUDE.md).
Every assumption made along the way is logged in [DECISIONS.md](DECISIONS.md).

## Stack

Next.js 16 (App Router, Cache Components) with TypeScript and Tailwind v4.
Postgres and auth via Supabase (Sydney). Stripe Checkout and Billing. Anthropic
API for template-driven document drafts. Vitest for unit and snapshot tests,
Playwright for end-to-end. GitHub Actions CI. Vercel hosting.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in as each phase needs them
npm run dev                  # http://localhost:3000
```

## Scripts

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Dev server                                              |
| `npm run build`     | Production build                                        |
| `npm run lint`      | ESLint                                                  |
| `npm run format`    | Prettier (write) / `format:check` in CI                 |
| `npm run typecheck` | `next typegen` then `tsc --noEmit`                      |
| `npm test`          | Vitest unit and snapshot tests (`test:watch` to watch)  |
| `npm run test:e2e`  | Playwright, desktop Chrome and a 360px Android viewport |
| `npm run check`     | Lint, format check, typecheck and unit tests in one go  |

First Playwright run needs browsers: `npx playwright install chromium`.

## Layout

```
src/app/          routes (App Router)
src/components/   shared UI
src/lib/          domain logic (brand constants, claims guardrails, later: mapping, generator)
data/             standards fixtures with source URLs and version dates (Phase 1)
e2e/              Playwright specs
.github/workflows CI
```

## Build phases

| Phase | Scope                                     | Status      |
| ----- | ----------------------------------------- | ----------- |
| 0     | Scaffold, tooling, CI, decisions log      | Done        |
| 1     | Standards mapping (`data/standards.json`) | Next        |
| 2     | Questionnaire                             | Not started |
| 3     | Generator                                 | Not started |
| 4     | Readiness checklist and payments          | Not started |
| 5     | Registers (subscription)                  | Not started |
| 6     | Content and launch                        | Not started |

## Non-negotiables

No "NDIS" in the brand or domain. No claims of guaranteed outcomes or
endorsement. General information, not legal advice, stated on every page and
document. No participant personal or health data, ever. Fixed disclosed prices,
no interest, no hidden fees. See CLAUDE.md sections 4 and 5.
