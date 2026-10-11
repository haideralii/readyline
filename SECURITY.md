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

## Supported versions

Only the `main` branch is deployed. There are no versioned releases to patch.
