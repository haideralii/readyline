# Threat model and security baseline

Owner: PO (security reviewer). Dev implements; PO verifies with evidence. Target: OWASP ASVS Level 2 for the app, Australian data residency, and the privacy posture in `CLAUDE.md` 4.5. Review this file at every phase gate.

## What we protect

1. Provider business data: ABN, contact details, workforce size, support types, questionnaire answers, generated documents.
2. Register contents (incidents, complaints, worker clearance expiries). Must not contain participant personal information, but we design as if it accidentally might.
3. Payment state and Stripe identifiers (never card data; Stripe holds it).
4. Our own integrity: generated documents and the standards data must not be tampered with; prohibited claims must not slip into output.
5. Availability around audit deadlines; a provider locked out the week before an audit is a reputational disaster.

## Actors and threats

- **Opportunistic attacker** (credential stuffing, scraping, abuse of free tiers, SQL/NoSQL injection, IDOR between accounts, mass document generation to run up our AI bill).
- **Malicious or careless customer** (pastes participant data into fields; uses prompt injection via questionnaire free text to make the generator emit prohibited claims or exfiltrate prompts).
- **Compromised third party** (Stripe webhook spoofing, npm supply-chain package, leaked AI API key).
- **Insider / operator error** (Haider's laptop or accounts compromised; mis-deployed env vars; debugging with production data).
- **Regulatory scrutiny** (a provider blames our documents for an audit failure; a privacy complaint about where data is stored).

## Controls by layer (the baseline Dev must meet; each gets a test or evidence)

### Identity and access
- Supabase Auth, email magic link; MFA for the admin role. Session cookies HttpOnly, Secure, SameSite=Lax. Short-lived access tokens, rotation on privilege change.
- Row-level security on every table keyed to the account; no service-role key in any client bundle; server-only data access. A test proves account A cannot read account B's rows by ID.
- Admin routes behind a separate role and allow-list; no "isAdmin" flag settable by the client.

### Input and output
- All inputs validated with zod schemas at the boundary; reject unknown fields. Length limits on all free text.
- Questionnaire free text is treated as untrusted when building AI prompts: delimited, length-capped, never allowed to add instructions; model has no tools; output must validate against the JSON schema; `assertNoProhibitedClaims` runs on every output; generation is logged.
- Output encoding by the framework; no `dangerouslySetInnerHTML` with user content; `.docx` generated from structured data, never from raw user HTML.
- Participant-data detector (warn) on register fields; register text never sent to the model.

### Web platform
- Security headers: strict CSP (nonce-based, no inline scripts beyond the framework's nonce), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors none. Verified with an automated header check in CI.
- CSRF: framework protections plus origin checks on mutating routes.
- Rate limiting on auth, questionnaire submit, generation and webhook endpoints; per-account generation quotas.
- Dependency audit in CI (`npm audit --omit=dev` at high severity fails the build); lockfile committed; Dependabot or Renovate weekly.

### Payments
- Stripe webhook signature verification; idempotency on event handling; entitlements derived only from verified events, never from client redirects.
- No card data touches our servers; Stripe Checkout hosted pages only.

### Data
- Postgres in ap-southeast-2; encrypted at rest and in transit; daily backups with a tested restore (evidence: a restore drill logged in `DECISIONS.md` before launch).
- Data minimisation: no fields we do not use; retention policy written and enforced (deleted accounts purged within 30 days; generation logs keep prompt version and token counts, not full prompts with customer text beyond 90 days).
- Export and deletion self-service; deletion cascades to files in storage.
- Logs never contain free-text fields, tokens or emails in clear (hash or redact).

### Secrets and operations
- All secrets in the host's secret store; `.env` never committed (CI grep for common secret patterns). Separate keys per environment; AI key with a monthly spend cap and alerting.
- Least-privilege service accounts; Haider's own accounts on MFA with hardware or app factor; no shared logins.
- Error tracking without PII; uptime check; alert on error-rate and spend anomalies.
- Incident response runbook (REQ-010): who does what in the first hour, how to rotate keys, how to notify customers, Notifiable Data Breach scheme awareness (OAIC) even though the small-business exemption may apply.

### AI-specific
- Model called server-side only; prompts versioned in the repo; eval set of questionnaire fixtures with expected document structure, run in CI.
- Red-team fixtures: prompt-injection attempts in free text must not change document structure or introduce prohibited claims (tests must fail if they do).
- No participant data in prompts by design; de-identification warnings as per `CLAUDE.md` 4.5.

## Evidence the PO will ask for at each gate

Phase 1: dependency audit clean; secrets scan in CI. Phase 2: RLS cross-tenant test; header check; rate limits demonstrated. Phase 3: injection fixtures and claims checker in CI; generation logging. Phase 4: webhook signature test; entitlement from webhook only; refund flow. Phase 5: participant-data detector tests; export and deletion end-to-end. Phase 6: external automated scan (e.g. OWASP ZAP baseline) with findings triaged; restore drill; runbook walkthrough.
