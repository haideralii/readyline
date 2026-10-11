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
Rules amendment before launch. Resolved on 2026-10-11, see D-112.

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
A small example dataset was used for the PO's shape review and then removed
once the full `data/standards.json` was built (D-113).

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

### REQ-001 Session A (2026-10-11)

**D-112 D-104 resolved from the Commission's own transition pages.** The
"Mandatory registration and transitional pathways" pages state that
registered SIL providers need certification audits, the core module and the
SIL supplementary module, and that registered NDIS digital platform providers
need certification audits, the core module and specific conditions of
registration (section 13D of the Rules). Both classes are now `verified`
with those pages as sources. The Federal Register of Legislation renders the
Rules text by script, so only the landing page (compilation F2026C00527,
No. 6, 1 July 2026, with its table of contents listing Schedule 7A Module 5A
SIL and Schedule 8 Module 6 Verification) was captured as a source. The full
instrument remains the authoritative text and should be read before launch.

**D-113 The dataset is built, not typed.** `scripts/standards/build.mjs`
parses outcomes and quality indicators straight out of the snapshots in
`data/sources/` (Commission HTML reduced to text; the SIL PDF with its numbered
indicators) and merges them with the hand-maintained
`data/standards.meta.json` (sources, modules, groups, rules, draft evidence).
Multi-line indicators are joined when the previous line ends in a colon,
semicolon, "and" or "or", or the next line starts with a lettered sub-point;
the output was spot-checked against the pages. A test asserts that each
standard's indicator order matches the snapshot, which is the PO's stable-index
rule. `standards:verify` re-hashes every snapshot against `standards.json` and
`manifest.json` and runs in CI.

**D-114 Counts.** The core module has 24 standards (5 rights, 9 governance
including emergency and disaster management, 5 provision, 5 environment), not
23 as written in the Dev response. Totals: 70 standards across 9 modules, 38
registration classes.

**D-115 One web-page line treated as a note, not an indicator.** The high
intensity page's severe dysphagia section ends with "Training for Severe
dysphagia management must only be delivered by an appropriately qualified
health practitioner." That sentence is not in the Version 4 PDF, so it is
stored verbatim in the standard's `note` field rather than as a sixth
indicator.

**D-116 Registration period sourced.** The Commission's "About registration"
page says providers "are generally registered for three years"; it is now a
source and `rules.registrationPeriodSourceId` points at it, replacing the
CLAUDE.md-only basis noted in D-106.

**D-117 Names and spellings follow the audit-type table.** Where the
Registration Requirements PDF spells a class differently (0117 "daily care",
0136 "centre-based"), the group record uses the table's wording and carries a
note. Module and standard names follow the Commission's web pages; the Rules'
table of contents uses slightly different titles for some standards (for
example "Freedom from violence, abuse, neglect, exploitation or
discrimination", "Complaints management and resolution", "Service
agreements"). Ids derive from the web names.

**D-118 Evidence guidance is a first pass.** Every standard carries two to
five draft evidence items (`draft: true`) with planned document-type ids for
Phase 3. The PO reviews them under REQ-001 FR-4; they are not Commission text
and the dataset says so.

### REQ-001 Session B (2026-10-11)

**D-119 Derivation semantics.** `deriveApplicability(dataset, { groups,
businessStructure, usesRestrictivePractices, silEligibility })` in
`src/lib/standards/derive.ts` applies the rules in this order: SIL definition
(0138 is dropped when either Commission exclusion is answered yes; the
answers are required whenever 0138 is selected), pathway (any certification
class makes the whole registration certification), modules (verification
module only on the verification pathway; otherwise the core module unless the
sole class is SDA, plus each class's supplementary modules; individuals and
partnerships whose only certification class is early childhood get the
modified certification with the core limited to the freedom from violence
outcome), restrictive practices (adds the implementing behaviour support
plans module on either pathway), then the mid-term audit with the D-106
exemptions. Every step appends a reason with the rule id, the Commission
source id and plain-English text, so the questionnaire can show its working.
Whether restrictive practice use turns a verification audit into a
certification audit is not stated in the material held; the function keeps
the pathway and emits an `unverified` reason (added to the register).
Transitioned-provider status is not an input; the mid-term reason text notes
the exemption.

**D-120 Report script runs on Node's built-in type stripping.** To avoid a
new dependency, `scripts/standards/report.ts` runs with
`node --experimental-strip-types` and imports the TypeScript modules with
explicit `.ts` extensions (`allowImportingTsExtensions` is now on in
`tsconfig.json`, harmless under `noEmit`). Only erasable syntax may be used
in modules that the script imports: no `enum`, no `namespace`, no parameter
properties. The first run failed on a parameter property in
`DerivationError` and it was rewritten as a plain field. Requires Node 22.6
or later; CI uses the current Node 22 line.

**D-121 Counts are generated.** The changelog note in `standards.meta.json`
no longer carries a standards count (it said 23 while the dataset said 24).
`SOURCES.md` now has a generated "Contents" section computed from the
dataset, and `data/sources.test.ts` asserts the counts, the source hashes and
the UNVERIFIED section agree with `standards.json` (AC-7).

## Product-owner decisions (2026-10-11)

**D-020 Brand: Readyline.** Chosen by Haider on 2026-10-11 after the PO
checked auDA WHOIS (readyline.com.au and readyline.au unregistered), ASIC
Connect (business name shown as available; unrelated Readyline Developments
Pty Ltd and a former name exist), and IP Australia (one live READYLINE mark,
classes 7 and 12, mining machinery; none in 9, 35, 42). readyline.com is held
by a third party. Haider will register the ABN, business name and both .au
domains; `NEXT_PUBLIC_BRAND_NAME=Readyline` once done. Future company name
should not be the bare "Readyline Pty Ltd".

**D-021 No paid auditor referrals.** Following D-109, CLAUDE.md sections 3,
4.4 and 5 and the backlog parking lot were changed: the product never takes or
pays a fee, commission or revenue share connected to an audit referral or
outcome. A fee-free, labelled list of approved auditors remains possible.

**D-022 REQ-001 and REQ-002 approved to proceed** (see PO reviews in the REQ
files). REQ-002 may run in parallel with REQ-001. Derivation signature
extended with SIL exclusion input and rule reasons; AC-8 to AC-10 added to
REQ-001.

**D-023 Supabase confirmed (Haider, 2026-10-11).** Supabase in ap-southeast-2
(Sydney) for Postgres and Auth, per D-007. Phase 2 may provision the project.
Free tier to start; upgrade when row count or auth volume requires it.

**D-024 Vercel Hobby plan to start (Haider, 2026-10-11).** Deploy on the free
Hobby plan; move to Pro when Sydney-pinned functions, a custom domain with
team features, or usage limits require it. The D-008 `UNVERIFIED` item
(Hobby-plan region pinning) is to be resolved at first deploy in Phase 4.

**D-025 Merge rule (PO, 2026-10-11).** Dev may merge a PR only when the
REQ's PO review says Accepted (or the named condition of a conditional
acceptance is met) and every CI job on the latest commit is green; `--no-ff`
merge, record the merge commit in the REQ. Haider no longer has to merge by
hand; the PO acceptance remains the gate.

**D-026 Readyline content files (PO, 2026-10-11).** Plain-English
descriptions of registration groups, modules and audit types, and the first
document-set mapping, are Readyline text kept under `data/readyline-content/`
with `author: "readyline"` and a review status; never presented as Commission
text.

**D-027 Readyline is the default brand in code and data (Dev, 2026-10-11,
queue item 0).** `src/lib/brand.ts` exports `BRAND_DEFAULT = "Readyline"`;
`NEXT_PUBLIC_BRAND_NAME` stays as an override and `.env.example` now shows
`Readyline`. The `{{BRAND}}` placeholder is retired from code, tests and the
prohibited-claims rule (the self-description rule now matches "Readyline is a
registered provider"). Where text is rendered by the app (title, header,
footer, notices) the constant is substituted at render time; where text is
stored, the `evidenceDisclaimer` in `data/standards.meta.json` was changed to
"Readyline guidance" and the dataset regenerated, so the report prints
Readyline. The descriptive line "NDIS is a registered trade mark of the
National Disability Insurance Agency and is used here descriptively only" is
unchanged. Role skills under `.claude/skills` still say `{{BRAND}}` in prose
and are left as documentation.

## Open questions for Haider

1. ~~Brand name~~ Resolved: Readyline (D-020). Pending Haider's ABN, business name and domain registrations.
2. ~~Confirm Supabase over Neon~~ Resolved: Supabase (D-023).
3. ~~Vercel plan~~ Resolved: Hobby to start (D-024); verify region pinning at first deploy.
4. Legal entity line for the footer and documents once the ABN exists.
5. Email provider for Phase 5 reminders (D-013).

## UNVERIFIED register

Items asserted in code or copy that still need a primary source.

- D-008: Vercel Hobby plan function-region pinning.
- ~~D-104: modules applying to class 0137 (digital platforms).~~ Resolved (D-112).
- ~~D-104: core module applying to class 0138 (SIL) alongside the SIL module.~~ Resolved (D-112).
- D-112: the full text of the Provider Registration and Practice Standards
  Rules (F2026C00527) has not been read; only its table of contents was captured.
- D-119: whether using regulated restrictive practices changes a verification
  audit into a certification audit. The derivation keeps the pathway and flags
  the reason as unverified.
- D-122: whether an individual or partnership with early childhood (0118) plus
  one or more verification classes keeps the modified-certification scope. The
  Commission's mapping document lists "early childhood and any other
  verification registration" under modified certification; the derivation
  follows that reading but tags the reason `unverified` for that combination
  (PO Session B review, note a).
- CLAUDE.md section 2 audit cost ranges: third-party figures, not Commission data.
