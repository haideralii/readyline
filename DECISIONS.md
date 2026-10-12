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

**D-027 confirmed by PO.** Brand default Readyline in code; env override retained.

**D-028 Merge rule when CI is unreadable (PO, 2026-10-11).** Dev may satisfy
the "CI green" condition by running the identical checks locally (check,
build, e2e, audit, gitleaks) and recording the output in Delivery evidence;
the PO verifies the GitHub run afterwards and a red run is fixed forward as
the first item of the next batch.

**D-029 Supabase project created (Haider, 2026-10-11).** Organisation
"Readyline", project `readyline`, ref `dpwwzhylcyosnkmlcnnp`, region
ap-southeast-2 (Oceania, Sydney), Free plan, "automatically expose new
tables" off, automatic RLS on, GitHub integration not connected. New API key
format (publishable and secret keys); env names in REQ-004 SR-5.

**D-030 Merges via GitHub (PO, 2026-10-11).** The Dev's safety check refuses
local merges into `main`; merges are done with GitHub's merge button by
Haider when the PO confirms CI green and the REQ is Accepted. D-025 and D-028
are narrowed accordingly: Dev prepares, PO verifies, Haider clicks.

**D-031 Stacked branches (PO, 2026-10-11).** A REQ that depends on an
unmerged branch is branched from it and rebased after the dependency merges.

**D-032 Hosted migrations by workflow (PO, 2026-10-11).** Migrations reach the
hosted Supabase project through a GitHub Actions job on `main`, using the
`SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` repository secrets that
Haider sets, not by hand from a laptop.

## REQ-002: security and privacy baseline (2026-10-11, branch `req-002-security-baseline`)

Decision numbers D-2xx are used on this branch so they do not collide with
the D-1xx series on the REQ-001 branch; the PO merges both.

**D-201 Hash-based CSP spike failed; nonce CSP adopted.** With Cache
Components on, experimental SRI (`experimental.sri`) and
`script-src 'self'`, the production home page produced 11
`securitypolicyviolation` events on both Playwright viewports (desktop and
360px): every inline React Server Components bootstrap script was blocked and
the page did not hydrate, while SRI only added `integrity` to the 6 external
chunks. Spike output is attached to the REQ-002 delivery evidence. Per the PO's
decision, the fallback is in force: a per-request nonce issued in
`src/proxy.ts` with `'strict-dynamic'`, no `'unsafe-inline'` for scripts.

**D-202 Cache Components turned off; every HTML response is dynamic (revises
D-003).** A nonce only works when the HTML is rendered for the request that
carries it; a static shell has no nonce and is blocked. `cacheComponents` and
`partialPrefetching` are removed from `next.config.ts`, and the root layout
awaits `connection()` so no route is prerendered. Cost accepted by the PO:
no CDN-cached HTML, per-request rendering in Sydney. Revisit if the blog
grows (an option then is a separate static CSP for blog routes without
inline scripts, or hash allow-listing of Next's bootstrap scripts if Next
ships stable support).

**D-203 CSP directives.** Production: `default-src 'self'`, `script-src 'self'
'nonce-Ã¢â‚¬Â¦' 'strict-dynamic'`, `style-src 'self' 'nonce-Ã¢â‚¬Â¦'`, `img-src 'self'
blob: data:`, `font-src 'self'`, `connect-src 'self'`, `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
Development adds `'unsafe-eval'` (React dev tooling) and `style-src
'unsafe-inline'` plus `ws:`/`wss:` for hot reload, exactly as the Next CSP
guide documents. `upgrade-insecure-requests` is deliberately omitted because
CI runs the production server over plain http on localhost and the browser
would upgrade asset requests to https and fail; HSTS and Vercel's TLS cover
production. No external origin is allowed yet; Supabase and Stripe origins
are added to `connect-src` (and Stripe's script origin, nonced) in their REQs
and recorded here. Fonts are self-hosted by `next/font`, so no Google origin.

**D-204 Static headers in `next.config.ts`.** `Strict-Transport-Security:
max-age=63072000; includeSubDomains; preload` (browsers ignore it over http,
so it is harmless locally; preload submission waits for the live domain),
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `Permissions-Policy: camera=(),
microphone=(), geolocation=(), payment=()`, `X-Frame-Options: DENY` as the
legacy twin of `frame-ancestors 'none'`. `poweredByHeader` stays off.

**D-205 Secrets and dependency gates.** gitleaks runs as a separate CI job via
`gitleaks/gitleaks-action@v2` with `.gitleaks.toml` (default rules; the only
allow-list is path-scoped to `data/sources/`). `npm audit --omit=dev
--audit-level=high` runs before anything else in the main job. A small script
fails CI if any `.env*` file other than `.env.example` is tracked, because
gitleaks only inspects content. Dev-only advisories as of 2026-10-11: the
`npm audit` report lists high-severity findings in the development toolchain
only (`braces` and its dependants, pulled in by test and build tooling);
production dependencies report zero. Tracked here; re-check at each phase
gate and clear with upgrades when the toolchain allows.

**D-206 Env fail-fast.** `src/lib/env.ts` holds the contract (`REQUIRED` now:
`NEXT_PUBLIC_SITE_URL`; `REQUIRED_LATER` lists the variables each REQ will
promote). `src/instrumentation.ts` validates at server start and exits with
code 1 naming each missing variable and where it lives in production. CI,
Playwright's web server and `.env.example` set the required variable.
Consequence for Haider: `npm run dev` needs a `.env.local` copied from
`.env.example`.

**D-207 Logging and validation conventions.** `src/lib/logging` emits one JSON
line per event through a redactor that replaces secret-named keys, omits
free-text-named keys (register and questionnaire text could contain
participant details) and masks emails and known token shapes in every
string. ESLint `no-console` is an error under `src/` (tests excepted).
`src/lib/validation` provides `parseInput`, `strictObject` and `text(max)`;
`handlers.test.ts` fails the unit suite if any route handler or server action
skips the layer or uses `z.object`, which is the "test instead of lint rule"
approach FR-3 allows.

**D-208 GitHub CLI is not installed on the dev machine.** Pull requests are
opened by the PO from the pushed branch; this is noted in the REQ's delivery
evidence rather than installing a tool mid-session.

## REQ-003: readiness questionnaire (branch `req-003-questionnaire`, stacked on REQ-002)

Decision numbers D-3xx on this branch.

**D-301 Branch stacked on REQ-002 (D-031).** `req-003-questionnaire` was
rebased onto `req-002-security-baseline` because the questionnaire uses the
validation layer, logging rule and CSP from REQ-002; it is rebased onto `main`
after REQ-002 merges. Conflicts in `.prettierignore`, `product/NEXT.md` and
the REQ file were resolved by keeping the PO's upstream files and re-inserting
the Dev response.

**D-302 Client-held answers, one server action (PO-accepted Q3).** Routes
`/start` and `/start/[step]`; a client provider owns the answers and a
`DraftStore`; the local implementation stores the versioned
`QuestionnaireDraft` in `localStorage` with every call in try/catch and
discards drafts of another version or with unknown keys. The only server call
is the `deriveResult` action on the result step, which re-validates against
the dataset's classes and stores nothing. `standards.json` never reaches the
browser; step 2 receives a 38-row shape (code, Commission name, audit type,
Readyline description).

**D-303 Gate and navigation.** A step may be opened when every earlier answer
step holds valid saved data; otherwise the page replaces the URL with the
first incomplete step. Focus moves to the step heading on every step change;
the error summary receives focus when it appears; all controls have 44px
targets.

**D-304 Readyline content and conditions.** `data/readyline-content/*` is the
PO's text keyed by dataset module id with the PO's slug kept as `poId`. The
bracketed conditions in the PO's document-set list are modelled as `when`
rules: "personal care groups" is the list `0104, 0107, 0115, 0138` (Readyline
interpretation, stated in the file) and the transport procedure applies when
0108 is selected; both rules sit under the core module as the PO listed them,
so a verification-only provider does not receive them.

**D-305 Participant-data detector.** `src/lib/privacy/participant-data.ts`
warns (never blocks) on name-like pairs of capitalised words, dates of birth,
nine-digit numbers starting 43, street addresses and health or diagnosis
terms, with a list of compass, place and organisation words to keep
"Western Sydney" and "Practice Standards" from counting as people. False
positives are acceptable; the note it guards is never used in derivation.

**D-306 Restrictive practices wording.** The practices step names the five
regulated restrictive practices (seclusion; chemical, mechanical, physical and
environmental restraint) as the practices the NDIS (Restrictive Practices and
Behaviour Support) Rules 2018 regulate and links to the Commission's page. The
category names are the Rules' own terms; the page does not quote Commission
text beyond that. "Not sure" is treated as yes and the result says so.

**D-307 Accessibility evidence method.** Lighthouse cannot reach steps behind
the draft gate on a fresh load, so per-step evidence comes from an axe scan
(`@axe-core/playwright`, WCAG 2.1 A and AA rules) on every step and state on
both Playwright projects with zero serious or critical violations allowed;
Lighthouse accessibility runs on the pages reachable without a draft
(`/start`, `/start/business`) in mobile and desktop presets and scored 100.
One contrast failure found by axe (future step labels in `text-zinc-400`) was
fixed. `@axe-core/playwright` is a dev dependency.

**D-308 Evidence files in the repo.** Screenshots of every step at 360x740
and desktop are stored as JPEG (quality 40) under
`product/evidence/req-003/` with a Lighthouse summary JSON; full Lighthouse
reports are not committed. The capture spec runs only with `EVIDENCE=1`.

## REQ-004: accounts, authentication and tenancy (branch `req-004-accounts`)

Decision numbers D-4xx on this branch.

**D-401 Supabase client packages (Dev, 2026-10-11).** `@supabase/supabase-js`
and `@supabase/ssr` are the two runtime dependencies REQ-004 needs (FR-4,
FR-8); `server-only` is added so the admin client and the SSR client cannot
be imported into a client bundle without a build error. The publishable-key
format is accepted: the supabase-js README uses `your-publishable-key` and the
ssr README reads `SUPABASE_PUBLISHABLE_KEY`; the ssr type comment still says
"anon" but the parameter is the same string. Env names follow SR-5:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`.

**D-402 Schema and tenancy model.** `users` mirrors `auth.users` by trigger
with a SHA-256 email hash (never the email); `accounts` (soft-delete column),
`memberships` (owner or member), `questionnaire_drafts`, `audit_log`, and
`auth_rate_limits` for the magic-link limiter. Clients never insert accounts
or memberships: `create_account()` (security definer) creates both in one
transaction and writes the audit row. `is_member()` and `is_owner()` ignore
soft-deleted accounts, so deletion hides data immediately. `platform_admin`
is protected by a trigger that rejects any change made through the API (any
request carrying JWT claims), leaving SQL by an operator as the only path.
The limiter table has no client policy at all.

**D-403 Integration tests run only against a real Postgres.** The RLS suite
(`tests/integration/rls.test.ts`, `npm run test:integration`) needs the three
Supabase variables and skips itself otherwise, so `npm test` stays offline.
In CI the `supabase-integration` job starts the CLI's local stack (which
applies `supabase/migrations`), maps its exported keys onto the app's variable
names (legacy `ANON_KEY`/`SERVICE_ROLE_KEY` or newer
`PUBLISHABLE_KEY`/`SECRET_KEY`, whichever the CLI prints), and runs the suite.
`supabase/config.toml` is hand-written for the local stack (Postgres 17,
mail inbox on, Studio off, TOTP on) because the CLI is not installed on the dev
machine.

**D-404 Local verification gap (Dev, 2026-10-11).** The dev machine has no
Docker, no Supabase CLI and no psql, and the hosted project's database
password is not available to Dev, so the migration could not be applied or the
RLS suite run locally. The migration is reviewed by hand and the proof is the
CI job. To apply the migration to the hosted project Haider runs
`npx supabase login`, `npx supabase link --project-ref dpwwzhylcyosnkmlcnnp`
and `npx supabase db push` (or pastes the file into the SQL editor once); this
is a Session B prerequisite.

**D-405 Session B hardening (Dev, 2026-10-11, PO Session A review).**
`supabase/migrations/20261011010000_session_b_hardening.sql` adds the
database-side mirror of the REQ-003 `BusinessStep` schema: `trading_name`
1 to 120 characters, `business_structure` in the six answers, every element
of `states` in the eight codes, `abn` exactly 11 digits or null. One owner
account per user is enforced twice: a unique partial index on
`memberships(user_id) where role = 'owner'` and an explicit check in
`create_account()` that raises `this user already owns an account`. The
app's `createAccountAction` returns the existing account instead of calling
the function twice, so the error is only reachable by calling the RPC directly.

**D-406 Magic-link limiter lives in Postgres.** `auth_rate_limit_hit(key,
limit, window)` is a `security definer` function that upserts one row per
key in `auth_rate_limits` and returns whether the call is within the limit;
it is revoked from `anon` and `authenticated` so only the secret-key client
can call it. Keys are `email:<sha256 of lower-cased email>` (5 per hour) and
`ip:<address>` (20 per hour) per the accepted Dev response; the email
itself never reaches the table or a log. A refused request returns the same
"if that address can sign in" message as a sent one (AC-1, AC-6). The
per-IP key uses the first `x-forwarded-for` entry, which Vercel sets; on a
host that does not, every request shares the `unknown` bucket and the
per-email limit still applies. The limiter fails closed: if the function is
missing or the database is unreachable, no link is sent and the user still
sees the generic message, with the error logged. This is what happened in
the local e2e run against the hosted project before any migration was
applied (PostgREST `PGRST202`, function not found).

**D-407 Session and redirects.** The magic link lands on `/auth/callback`,
which exchanges the code for a cookie session, then sends a user with no
account to `/account/setup` and everyone else to the `next` path. `next`
is accepted only when it is a same-origin path (`/` prefix, no `//` or
`/\`, no line breaks) and falls back to `/account` (SR-3). `signOut`
clears this device's session; `signOutEverywhere` uses Supabase's global
scope, which revokes every refresh token for the user (FR-8). Both end at `/`.

**D-408 Draft storage after sign-in (REQ-003 FR-3, REQ-004 AC-3).** The
questionnaire layout asks for the viewer once per request: with an owned
account the provider is given `mode="server"` and uses a `DraftStore`
wrapping the `loadServerDraft` / `saveServerDraft` / `clearServerDraft`
actions; otherwise the local store from REQ-003 is unchanged. A draft left on
the device is moved to the account at two points: the "about your business"
step (which also prefills from it) and, as a fallback, the provider's first
load in server mode when the account has no draft yet. After a successful move
the local copy is cleared. Drafts are not merged; the account's draft wins
when both exist.

**D-409 CSP `connect-src` gains the Supabase project origin only (SR-2).**
`buildCsp` takes the origin derived from `NEXT_PUBLIC_SUPABASE_URL` at
request time (origin only, no path, null when unset) and appends exactly that
host; no wildcard. Unit tests in `src/proxy.test.ts`.

**D-410 Migrations reach the hosted project through CI (replaces the manual
step in D-404).** `.github/workflows/migrate.yml` runs on a push to `main`
that touches `supabase/migrations/**` (and by hand via
`workflow_dispatch`), links to project `dpwwzhylcyosnkmlcnnp` and runs
`supabase db push --include-all`. It needs the repository secrets
`SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`; while they are absent
the job prints a notice and ends successfully without touching the database.
`SECURITY.md` lists every secret and where it lives. `--include-all`
applies every local migration the remote history does not know about, which
is the right behaviour for the first run against an empty project.

**D-411 Client bundle check (AC-8).** `scripts/ci/check-client-bundle.mjs`
runs after `next build` in CI and locally as `npm run check:bundle`; it
scans `.next/static` for the variable name `SUPABASE_SECRET_KEY`, the
`sb_secret_` prefix and, when set, the secret value itself.

**D-412 Branch stacking.** `req-004-accounts` is now stacked on
`req-003-questionnaire` (D-031) because Session B reuses the REQ-003
`BusinessStep` and `QuestionnaireDraft` schemas, the form primitives and
the `DraftStore` interface. Merge order on GitHub: REQ-002, REQ-003, REQ-004.

**D-413 Still not verified locally (extends D-404).** No Docker, CLI or
database on the dev machine, so the hardening migration, the limiter
function and `tests/integration/session-b.test.ts` have not executed here;
they run in the `supabase-integration` CI job on this push. The magic-link
journey through a real inbox is not covered by an automated test yet: the
local stack's inbox (port 54324) exists only inside that CI job, and the
`e2e/sign-in.spec.ts` tests cover the form, the generic response and the
signed-out redirects on both viewports.
**D-033 (PO, 2026-10-11).** `DECISIONS.md` is excluded from Prettier like the
other prose files. Feature branches may be squashed and force-pushed with
`--force-with-lease` before merge; `main` is never force-pushed.

**D-034 Repository secrets set (Haider, 2026-10-11).** `SUPABASE_ACCESS_TOKEN`
(scoped token: Readyline org, project read, database migrations read-write,
nothing else; expires 2027-01-09, rotate before then) and
`SUPABASE_DB_PASSWORD` (reset on 2026-10-11) exist as GitHub Actions
repository secrets for `migrate.yml`. Values live only in GitHub and
Haider's password manager.

**D-414 Batch 5 happened on a `main` that already carried the branches (Dev, 2026-10-11).**
The PO's batch-5 commit afeab24 captured the whole shared working tree, so
`main` holds the REQ-002, REQ-003 and REQ-004 code at the REQ-004 Session B
state (plus the PO's documents). Dev pushed that `main` before noticing
(fast-forward, D-030 allows pushing the PO's product edits). Rebasing the
three branches onto it conflicted in every file, so each was rebuilt as the
branch below it plus only its batch-5 work, under new names because the
force-push of the old names is refused by Dev's tool in this session:
`req-002-security-baseline-rebuilt` (main + cleanups),
`req-003-questionnaire-rebuilt` (+ PO UI items),
`req-004-accounts-rebuilt` (+ Session C). The old branches and PRs #2 to #4
are unchanged on GitHub; Haider or the PO replaces them (commands in the
batch-5 Dev status). The PR diffs are now small, which is the true review
scope since the rest is already on `main`. Consequence to note: CI on
`main` is red on Prettier for `DECISIONS.md` until PR #2 merges, and
`migrate.yml` ran on that push; the hosted project still answered
`PGRST202` for `auth_rate_limit_hit` during the local e2e run afterwards,
so either the run failed or the secrets were not yet in place; the PO checks
the Actions log.

**D-415 Deletion is a security-definer function; sign-in to a deleted
account is refused at the callback.** `delete_account()` soft-deletes the
caller's live owned account and writes the audit row in one transaction;
`is_member`/`is_owner` then return false so every policy hides the rows
at once. Because RLS hides the deleted row from its owner too, the "account
deleted" state is read with the service key (`getDeletedAccount`, three
fields only). The magic-link callback signs such a user out and shows the
deleted page; the account pages redirect there. The owner's membership row
stays until the purge, so the one-owner cap keeps the user from creating a
replacement account during the retention window (FR-6 "sign-in blocked").

**D-416 Purge job: Vercel Cron, 30 days, idempotent, storage by prefix.**
`vercel.json` schedules `GET /api/jobs/purge` daily at 16:00 UTC (early
morning in Sydney). The route answers 404 unless the `Authorization: Bearer`
header equals `CRON_SECRET` (constant-time compare; unset secret means
nobody); `?dryRun=1` reports without deleting. `runPurge()` is a plain
function taking the admin client, an email provider and a clock, so the
integration test runs it with the clock advanced 31 days (AC-5). It deletes
the account row (cascades memberships and drafts; audit rows keep a null
account id), removes storage objects under the prefix `<accountId>/` in
every bucket (none exist yet; the convention binds later REQs), sends the
"permanently removed" email, deletes the auth user when they hold no other
membership, and writes `account.purged`.

**D-417 Export is built with the owner's session and zipped in memory.**
`buildAccountExport` reads account, memberships, draft and audit rows with
the user's client, so RLS is the proof that nothing from another account can
be included (AC-4). `fflate` (0.8.3, no dependencies) writes the zip; the
archive holds `account.json` and a README stating the no-participant-data
rule. Exports are limited to 5 per account per hour through the same limiter
function as magic links (SR-3) and logged as `account.exported`.

**D-418 Admin role: TOTP through server actions, 404 for everyone else.**
`requireAdmin()` reads `users.platform_admin` with the user's own session
(the self-select policy), then the assurance level and verified TOTP factors;
`resolveAdminAccess` (pure, unit-tested) yields not-found, enrol, verify or
ok. Non-admins and anonymous visitors get Next's 404 so the routes do not
exist for them (AC-7). Enrolment and verification call Supabase MFA from
server actions with the cookie-bound client, so the aal2 session lands in the
cookies and the browser never talks to Supabase; the QR SVG from the enrol
response is rendered once. Admin page views and every MFA step are written to
`audit_log` with the service key (`actor_user_id` set, `account_id`
null). TOTP must be enabled in the hosted project's Auth settings (Haider;
the local stack has it on in `supabase/config.toml`).

**D-419 Confirmation emails behind an interface; nothing is sent yet.**
`EmailProvider` with one implementation, `LogOnlyEmailProvider`, which
records the message and logs a hashed recipient. `accountDeletedEmail` and
`accountPurgedEmail` are pure templates tested for Australian dates, the
general-information line and the claims rules. Choosing the provider remains
D-013; when it lands, `createEmailProvider()` is the only place to change.

**D-420 Members may write their own audit rows.** Session B inserted
`account.updated` rows with the user's client, but `audit_log` had no
insert policy, so those writes were silently rejected. The Session C migration
adds `audit_log_insert_member` (`is_member(account_id)` and
`actor_user_id = auth.uid()`), and the actions now log a warning when an
audit write fails. The integration suite proves a member cannot write a row
as someone else or for another account.
**D-035 Incident: PO commit swept the working tree (2026-10-11).** The PO's
batch-5 commit `afeab24` on `main` was made after a `git checkout main` that
could not remove branch files (deletes are blocked in the connected folder),
and `git add -A` captured REQ-002, REQ-003 and REQ-004 code at their Session B
state. CI on `main` passed on that state (runs 24 and 25), so nothing broken
reached `main`; Dev rebuilt the three branches as deltas on top (`*-rebuilt`).
Cause: PO git hygiene. Fix: rules in `product/README.md`; the PO stages
explicit paths only and never checks out branches in the shared tree. PRs #2
to #4 closed; #5 to #7 opened from the rebuilt branches.

**D-036 Migration deploy without `supabase link` (PO, 2026-10-11).** The
scoped access token lacks `api_gateway_keys_read`, which `supabase link`
needs. Rather than widen the token, `migrate.yml` pushes over a direct
database URL (session pooler, port 5432, user `postgres.<ref>`) using only
`SUPABASE_DB_PASSWORD`; the access token stays for future CLI use.

**D-037 Drafting model: `claude-sonnet-5-5` (PO with Haider, 2026-10-12).**
Prices checked 12 Oct 2026: Sonnet 5.5 $2/$10 per MTok in/out, Opus 5.5 $4/$20,
Haiku 5.5 from $0.10/$0.50, Fable 5.1 $10/$50. Estimated full document set:
about 100 calls, roughly 250k input and 50k output tokens, about $1 on Sonnet.
Opus is the fallback if the PO's review of the first real sets finds the
tailored sections too thin; Haiku is reserved for cheap side tasks. Monthly
spend cap set in the Anthropic console before the key is created. Revisit
with measured token counts from the first recordings (REQ-005 Session B).

## REQ-013: first-time user experience (branch `req-013-first-time-ux`)

Decision numbers D-13xx on this branch.

**D-1301 Validation messages live in the schemas (Dev, 2026-10-12, FR-1).**
Every field of the five step schemas carries its own plain-English message
through zod's `error` option (type, enum, min, max and integer paths), so the
server action, the client form and any future API all say the same thing
and no field-to-message map can drift from the schema. `text()` takes a
required message and defaults its type message to "Enter text only".
`messages.test.ts` drives every step through empty, wrong-type and
out-of-range inputs and rejects anything shaped like zod's defaults.

**D-1302 Accessible names from visible labels (FR-2).** Radios and
checkboxes use `aria-labelledby` pointing at the label span only, with the
class code and help text in `aria-describedby`; every group is a fieldset
with a legend. A Playwright test walks every control on every step, reads
the computed name and legend, and fails on an empty name, a raw value or a
leading class code; it cross-checks one control per step with Playwright's
own accessible-name computation and writes the records to
`product/evidence/req-013` under `EVIDENCE=1`. The manual screen-reader
pass is added to the definition of done; Dev has no screen reader on this
machine, so that pass is owed by Haider and recorded as such.

**D-1303 Everyday groupings and synonyms are Readyline data (FR-3).**
`data/readyline-content/group-categories.json` maps the 38 classes to
eight everyday headings (a test proves each class appears exactly once) and
carries the question and the two-class hint; `synonyms` arrays were added
to `registration-group-descriptions.json` with their own draft status so
the PO's reviewed descriptions stay untouched. Search matches code, name,
description and synonyms. The Commission's names, codes and audit types
stay authoritative; the audit type is shown as a "desk audit" or "site
audit" tag on each row instead of two long lists.

**D-1304 The not-sure helper resolves in the schema (FR-4).** "Not sure"
stays a valid answer (old drafts keep working and resolve to yes with the
assumption shown, as before). A new optional `notSureHelper` with three
booleans is required by the form when "not sure" is chosen;
`resolveRestrictivePractices` turns the three answers into yes (any yes)
or no (all no) and the assumption flag is set only when the resolution is
yes. The adapter and result tests cover both paths; the result page wording
now explains that the helper answers pointed to yes.

**D-1305 Result-page grouping is Readyline data (FR-5).**
`document-groups.json` assigns every document id to one of the four
headings (test: all ids exactly once). The summary line counts documents
and registers from the derived result and the "in practice" sentence per
pathway is plain, claim-free copy.
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
- D-205: dev-only `npm audit` high advisories (test and build toolchain) are
  tracked, not fixed; production dependencies are clean.
- D-038 (PO, 2026-10-12): `migrate.yml` run 3 failed before touching the database
  because `supabase/setup-cli@v1` with `version: latest` calls the GitHub API
  anonymously and shared runners hit the rate limit. Re-run succeeded and applied
  the three migrations on `main`. Decision: pin the CLI version in every workflow
  and pass the job token to the action; `latest` is not used in CI.
- D-039 (PO, 2026-10-12): Anthropic key budget. Haider's personal console key,
  $5 prepaid with a $5 monthly cap, model `claude-sonnet-5-5`. Dev calls the
  API only for recordings that a queue item names, one call per case, never
  from CI, tests or exploratory runs; real token and dollar counts go into
  Delivery evidence after every recording. The cap is the hard stop; the PO
  raises it only after seeing the first cost note.
- D-040 (PO, 2026-10-12): generator output caps. `maxTokens` 4,000 for `steps`
  and `how-we-do-this` sections, 1,500 for all other section types. A reply
  that stops on `max_tokens` is a truncation problem, never retried unchanged.
  A readability `fail` (grade above 11) is a validation problem with one
  retry. Spend approved: $0.11 to date; up to $0.50 for batch 11.
- D-041 (PO, 2026-10-12): approves D-525. `*procedure` extra sections use the
  4,000 cap; `purpose` brief is "two short sentences"; behaviour-support
  `steps` outline split into sub-sections of at most eight steps, one call
  each. Tailored sections never restate statutory timeframes, reportable
  incident lists or Commission definitions (R-7): they refer to the fixed
  section that holds them, and a lint enforces it.
- D-042 (PO, 2026-10-12): review cycles are provider facts in the context
  pack (policy review 12 months, register review 3 months by default, per
  document type in the catalogue); tailored text uses them and never chooses
  its own; a lint enforces it (R-8). Budget: batch 13 up to $0.50 more.
- D-043 (PO, 2026-10-12): approves D-528. `policy-statement` cap 2,500;
  truncation stops the current document only. R-8 lint covers review
  wording only; statutory reporting cadences fall under R-7 and must refer to
  the fixed section. REQ-008 answers: headings numbered from structure and
  hand-typed numbers removed from the copy; `product/legal/refunds.md` is the
  single source of the refund promise and REQ-007's pricing page quotes it
  from there (test asserts identity); the AI page names the provider and the
  model family ("Claude, made by Anthropic"), never the model id.
- D-044 (PO, 2026-10-12): REQ-008 accepted (D-801 to D-803 confirmed). REQ-005
  R-9: cross-references validated against the document's own outline; R-10:
  standards in the context pack intersected with the case's applicable
  modules. Budget: batch 15 up to $0.60 more (cap $1.25).
