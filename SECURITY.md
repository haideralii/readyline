# Security

## Reporting a vulnerability

Email **security@{{DOMAIN}}** (placeholder until the Readyline domain is live;
until then use the founder's contact address in the repository settings). Please
include steps to reproduce and do not include any real provider or participant
data. You will get an acknowledgement within 3 business days and a fix or a
mitigation plan within 30 days for confirmed issues. Please give us that time
before public disclosure. No bug bounty is offered at this stage.

## Where data lives

- Application compute: Vercel, Sydney region, once deployed.
- Database, authentication and file storage: Supabase project in the
  Sydney region (`ap-southeast-2`), once provisioned (Phase 2).
- Data never leaves Australia except that questionnaire answers about the
  provider's business are sent to the Anthropic API to draft documents
  (Phase 3). Register text and anything that could describe a participant is
  never sent to any model.
- The product holds provider business data only. It is designed so that NDIS
  participants' personal, health or disability information is never collected;
  every free-text field warns against entering it.

## Baseline controls

Described in `product/security/threat-model.md` and enforced by REQ-002:
strict Content Security Policy and security headers, zod validation that
rejects unknown keys at every boundary, structured logs with emails, tokens
and free text redacted, fail-fast environment checks, `npm audit` at high
severity on production dependencies, a gitleaks secret scan on every push, and
a check that no `.env` file is ever committed.

## Secret scanning note

The gitleaks GitHub Action is free for personal accounts. If this repository
moves to a GitHub organisation, either obtain a gitleaks licence key or switch
the CI step to run the gitleaks binary directly (`gitleaks git --redact`),
which needs no licence.

## Secrets: what exists and where it lives

No secret is ever committed. `scripts/ci/check-env-files.mjs` fails CI if an
`.env` file is tracked and gitleaks scans every push.

| Secret                                 | Used by                                                                               | Lives in                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | app (server and browser), CSP `connect-src`                                           | `.env.local` locally; Vercel project environment variables in production. Public by design.                                                                                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app (SSR and browser clients)                                                         | same as above. Public by design; row-level security is the control.                                                                                                                                            |
| `SUPABASE_SECRET_KEY`                  | server-only admin client (`src/server/supabase/admin.ts`), the magic-link limiter     | `.env.local` locally; Vercel (server scope only) in production. Never in the browser: `scripts/ci/check-client-bundle.mjs` scans `.next/static` after every build.                                             |
| `SUPABASE_ACCESS_TOKEN`                | `.github/workflows/migrate.yml` (`supabase link`)                                     | GitHub repository secret. Personal access token from the Supabase dashboard (Account, Access tokens). Not on any developer machine.                                                                            |
| `SUPABASE_DB_PASSWORD`                 | `.github/workflows/migrate.yml` (`supabase db push`)                                  | GitHub repository secret. Database password from the Supabase project settings. Not on any developer machine.                                                                                                  |
| `CRON_SECRET`                          | the job routes (purge, generate, reminders) and `.github/workflows/generate-kick.yml` | Vercel environment variable, generated with `openssl rand -hex 32`; the same value as a GitHub repository secret so the kicker can call the generate route (D-1006). Haider pastes both; the PO never sees it. |
| `NEXT_PUBLIC_SITE_URL`                 | magic-link redirect, metadata                                                         | not secret; set per environment.                                                                                                                                                                               |

Migrations are applied to the hosted project only by `migrate.yml` on a push
to `main` that changes `supabase/migrations/**`. Until the two GitHub
secrets are set the job skips with a notice and the hosted database is left
untouched. Rotation: regenerate the token or password in the Supabase
dashboard, update the GitHub secret, re-run the workflow by hand
(`workflow_dispatch`).

## Supported versions

Only the `main` branch is deployed. There are no versioned releases to patch.
