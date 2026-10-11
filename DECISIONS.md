# Decisions log

Every assumption or choice not already fixed by [CLAUDE.md](CLAUDE.md) is
recorded here, newest at the bottom of each phase. Anything about the
standards, audit process or fees that could not be confirmed from the NDIS
Quality and Safeguards Commission's own site is tagged `UNVERIFIED`.

Format: id, date, decision, why, how to revisit.

## Phase 0: scaffold (2026-10-11)

**D-001 Package manager: npm.** pnpm is not installed on the dev machine and
npm 10 ships with Node. Lockfile is `package-lock.json`. Revisit only if
install time becomes a problem.

**D-002 Node version.** Next 16 requires Node 20.9 or later. `.nvmrc` and CI
pin Node 22 (LTS). Local Node 25 works fine; CI is the reference environment.

**D-003 Next.js 16.4 with Cache Components on.** `create-next-app` now defaults
to `cacheComponents: true` and `partialPrefetching: true`, and the docs say both
become mandatory in the next major. Kept on. Consequence for later phases:
anything that reads cookies, headers, auth state or the database at request
time must sit under a `<Suspense>` boundary or inside `use cache`, otherwise
the build fails. The version-matched docs live in `node_modules/next/dist/docs/`
and must be consulted before writing routing or data code; APIs differ from
older Next. Revisit if this slows Phase 2 noticeably; turning it off is a
one-line change.

**D-004 Tailwind v4 via the Turbopack loader.** Scaffold default. No PostCSS
config file. Prettier runs with `prettier-plugin-tailwindcss` for class order.

**D-005 Test runners.** Vitest with jsdom and Testing Library for unit and
snapshot tests (`src/**/*.test.ts(x)`, `data/**/*.test.ts`). Playwright for
end-to-end in `e2e/`, Chromium only, two projects: Desktop Chrome and a
360x740 "budget Android" viewport with touch and a mobile UA. Firefox and
WebKit are excluded to keep CI under a few minutes; add them before launch if
analytics show meaningful Safari traffic.

**D-006 One CI job.** Lint, Prettier check, typecheck (`next typegen` then
`tsc --noEmit`, because the generated `LayoutProps`/`PageProps` types do not
exist until typegen runs), unit tests, production build, then Playwright
against `next start`. Playwright report uploaded only on failure. Split into
parallel jobs if the run exceeds roughly ten minutes.

**D-007 Database and auth: Supabase, Sydney region (ap-southeast-2).** Chosen
over Neon because it bundles Auth (email magic link) and row-level security in
one service, which keeps the deployable count at one. Not provisioned yet;
Phase 2 creates the project. Revisit if Supabase pricing or cold starts become
an issue.

**D-008 Hosting: Vercel.** Functions region to be pinned to Sydney (`syd1`) so
compute sits next to the database. `UNVERIFIED`: whether region pinning is
available on the Hobby plan or needs Pro; confirm when deploying in Phase 4.

**D-009 Site language `en-AU`.** Australian spelling throughout the UI and
generated documents.

**D-010 Brand placeholder.** `src/lib/brand.ts` exports `BRAND`, read from
`NEXT_PUBLIC_BRAND_NAME` and falling back to `{{BRAND}}`. All copy imports the
constant rather than hard-coding a name. `isBrandNameAllowed()` rejects any
name containing "ndis" so the final choice can be unit-tested.

**D-011 Prohibited-claims checker shipped in Phase 0.** `src/lib/claims.ts`
contains deterministic regex rules for the wording banned in CLAUDE.md 4.1 and
4.3 (guaranteed outcomes, audit-proof, pass rates, "approved by", "NDIS
approved", "official NDIS", "I heart NDIS", self-description as a registered
provider). Descriptive uses of "NDIS" are allowed. From Phase 3 the generator
runs `assertNoProhibitedClaims` on every output before rendering. Rules are a
starting list and will grow.

**D-012 Footer and layout notices.** The general-information notice and AI
disclosure are rendered on every page from the shared constants, so the same
text can be dropped into generated documents in Phase 3. The footer also notes
that "NDIS" is the NDIA's trade mark used descriptively.

**D-013 Transactional email provider: not chosen.** Only `EMAIL_FROM` and
`EMAIL_PROVIDER_API_KEY` placeholders exist. Decide in Phase 5 (reminders);
candidates are Resend or Postmark, both with Australian-friendly pricing.

**D-014 Sentry deferred to Phase 4.** No SDK installed yet; env placeholders
only. There is nothing worth tracking until the payment flow exists.

**D-015 Anthropic model id not pinned.** `ANTHROPIC_MODEL` is blank in
`.env.example`. The model and prompt version are chosen in Phase 3 and
recorded in `generation_log`.

**D-016 Next.js-managed `AGENTS.md` kept and committed.** `next dev`
regenerates it; committing it keeps the tree clean and points agents at the
version-matched docs.

**D-017 npm package name `readiness-app`.** The folder name contains capital
letters, which npm rejects, so the scaffold was created in a temp folder and
moved in. The package name is internal only and will not appear in the UI.

**D-018 Scaffold assets removed.** Next.js and Vercel SVGs and the default
favicon were deleted so no third-party logo ships by accident. A brand favicon
is added once the name is chosen.

## Operating model (2026-10-11)

**D-019 Brief v2.1 and the `product/` operating model adopted.** Mid-session
Haider committed brief v2 (market section, subscription as the primary
product, AI governance documents, de-identification guardrails) and the
product-owner model: work only from a `ready` or `in progress` REQ, answer its
questions under "Dev response" before building, deliver with evidence on a
branch named after the REQ, and the PO accepts. Phase 1 work therefore moved
from `main` to branch `req-001-standards-mapping`, and the schema proposal
below is recorded as the Dev response to REQ-001. `product/` and
`data/sources/` are excluded from Prettier so prose owned by others and
verbatim Commission text are never rewritten by tooling.

## Phase 1: standards mapping (started 2026-10-11)

Sources were fetched directly from ndiscommission.gov.au on 2026-10-11 and
snapshotted as text under `data/sources/` with a hashed `manifest.json`, so
`standards.json` can be diffed against what the Commission published.

**D-101 What is current.** The consolidated PDF "NDIS Practice Standards and
Quality Indicators" is still labelled Version 4, November 2021 (file dated
2024-10 on the Commission site). The online module pages carry the same text.
New since then: the supported independent living (SIL) module (four
standards: supported decision-making, safeguarding, practice governance,
agreements about tenancy, housing and support arrangements), effective
1 July 2026, published June 2026. The Commission also says a wider Practice
Standards review is under way; no new instrument beyond SIL has been made.
`standards.json` therefore records Version 4 for legacy modules and the June
2026 SIL document for the SIL module, each with its own source entry.

**D-102 Module inventory.** Core (four parts: rights and responsibilities;
provider governance and operational management; provision of supports;
provision of supports environments) with 23 standards. Supplementary: high
intensity daily personal activities; specialist behaviour support;
implementing behaviour support plans; early childhood supports; specialised
support coordination; specialist disability accommodation; supported
independent living. Verification module: human resource management, incident
management, complaints management, risk management.

**D-103 Registration groups.** The Commission's table lists 38 classes
(0101 to 0138) with an audit type each, including the two new mandatory
classes 0137 (NDIS digital platform service) and 0138 (assistance with
supported independent living), both certification. Mixed verification and
certification groups resolve to certification (Commission's own rule).

**D-104 Group-to-module mapping source is old.** The only Commission document
mapping classes to modules is "Registration Requirements by Supports and
Services" (reference 200312, 2020). It predates 0137 and 0138.
`UNVERIFIED`: which modules apply to 0137; core module is assumed.
`UNVERIFIED`: that the core module applies to 0138 alongside the SIL module;
inferred from the Commission's statement that its SIL audit pilot tested the
supported decision-making standard "alongside the Core Module". Both are
flagged in the data and must be confirmed against the Provider Registration
Rules amendment before launch.

**D-105 Edge rules captured from the mapping document.** SDA-only providers
are assessed against the SDA module without the core module; SDA plus any
other group adds the core module. Individuals or partnerships whose only
certification group is early childhood get a "modified certification": core
module limited to the freedom from violence, abuse, neglect, exploitation or
discrimination outcome plus the early childhood module. Any provider using
restrictive practices must also meet the implementing behaviour support
plans module. These are modelled as `rules` in the dataset, not hard-coded.

**D-106 Mid-term audit.** From the Commission's "Types of audits" page:
certification providers have a mid-term audit 18 months after registration
(prepare from month 12), assessed against the governance and operational
management part of the core module plus any standard previously under a
corrective action plan. Exempt: individual or partnership early childhood
only, SDA only, transitioned providers. Audit ratings are 3, 2, 1, 0 as
published. Registration period is three years (CLAUDE.md; also implied by the
18-month mid-term rule). Audit cost figures in CLAUDE.md remain third-party
estimates; the Commission states it does not set audit prices.

**D-107 Schema shape.** `src/lib/standards/schema.ts` (zod) defines sources,
modules (with divisions for the core module only), standards (verbatim outcome
and indicators, SIL intent and expectation statements, our evidence guidance
with per-item source), registration groups (own modules plus a
`requiresCore` flag so SDA-only and modified certification stay expressible),
and rules. Every record has a `verification` block; unverified records must
carry a note or the schema rejects them. `checkIntegrity()` enforces cross
references and the invariants the brief asks for (every group maps to at
least one module; verification groups map to the verification module only).
`data/standards.example.json` holds a small verified sample to review the
shape before the full dataset is populated.

**D-108 Evidence guidance is ours, labelled as such.** The dataset carries an
`evidenceDisclaimer` shown wherever evidence items appear. Items cite the
Commission's "Types of audits" page where it describes what auditors sample
(incident and complaints records, training logs, supervision notes, staff
files with screening, qualifications and induction, risk registers, meeting
minutes).

**D-109 Auditor independence confirmed from source.** The Commission's
"Regulatory Expectations for Approved Quality Auditors" (V1, June 2026) says
referral fees, commissions, success-based payments and revenue sharing linked
to audit referrals are incompatible with auditor obligations. Consequence for
CLAUDE.md section 3: any future auditor referral arrangement must be
fee-free on the auditor side and disclosed; the product never takes a payment
tied to an audit outcome.

**D-110 Fetch method.** The Commission site times out for the hosted fetch
tool but responds to a direct download with a browser user agent. Sources were
downloaded with PowerShell, HTML main content stripped to text, PDFs extracted
with pypdf. The same approach should be scripted in the repo in a later phase
so snapshots can be refreshed in CI.

**D-111 Primer corrections.** The PO's domain primer lists 0125, 0117 and
0106 as probably lower-risk; the Commission's table marks all three
certification. Reported in the REQ-001 Dev response so the primer can be
updated.

Next session: populate `data/standards.json` in full from the snapshots
(all 23 core, 4 verification, 4 SIL and the six legacy supplementary modules'
standards, all 38 groups), write the mapping and pathway unit tests, then the
derivation function (groups plus answers to modules, audit pathway, mid-term
applicability).

## Open questions for Haider

1. Brand name (after ASIC and IP Australia checks). Until then `{{BRAND}}`.
2. Confirm Supabase over Neon (D-007) before Phase 2 provisions a project.
3. Vercel plan, which decides whether Sydney region pinning is available (D-008).
4. Legal entity line for the footer and documents once the ABN exists.
5. Email provider for Phase 5 reminders (D-013).

## UNVERIFIED register

Items asserted in code or copy that still need a primary source.

- D-008: Vercel Hobby plan function-region pinning.
- D-104: modules applying to class 0137 (digital platforms).
- D-104: core module applying to class 0138 (SIL) alongside the SIL module.
- CLAUDE.md section 2 audit cost ranges: third-party figures, not Commission data.
