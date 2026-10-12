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
'nonce-ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦' 'strict-dynamic'`, `style-src 'self' 'nonce-ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦'`, `img-src 'self'
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

## REQ-005: document generator (branch `req-005-generator`, Dev response stage)

Decision numbers D-5xx on this branch.

**D-501 Closed block schema for model output (Dev, 2026-10-11).** Tailored
sections are JSON with five block types (paragraph, bullets, steps, table,
callout) validated by zod `strictObject` before rendering; no HTML or
Markdown from the model. One renderer path handles fixed and tailored
sections because fixed text is authored in the same block schema. Snapshot
tests serialise the document model, not the `.docx` binary.

**D-502 Fixture replay keyed by request hash.** Model calls in CI replay
fixtures keyed by SHA-256 of prompt version, model id and the canonical
request; a missing fixture fails the test, so a prompt change is visible as a
diff of re-recorded sections. CI never holds `ANTHROPIC_API_KEY`.

**D-503 Readability measured in-repo.** Flesch-Kincaid grade implemented in
the repo with tests rather than an unmaintained dependency; warn above 9.0
per tailored section, fail the quality gate above 11.0; tables and headings
excluded from the measure.

**D-504 LibreOffice conversion as a separate CI job.** AC-1 is proven by
converting every rendered `.docx` to PDF with headless LibreOffice in a job
that runs only when generator code or fixtures change, and nightly.

**D-505 Catalogue reconciles two document-id schemes.** `document-sets.json`
(PO ids such as `governance-policy`) and the evidence items in
`standards.json` (`policy.governance`) are joined through
`evidenceAliases` in `document-types.json`; neither file is renamed. Gaps
found while drafting (participant money and property; support planning and
transitions; a restrictive practice use register) are flagged for the PO in
the REQ-005 Dev response rather than silently added.

**D-506 Session A document model (Dev, 2026-10-12).** `buildSkeleton` turns
a catalogue entry plus the provider facts into numbered sections: fixed
sections resolved from `fixed-text.ts`, tailored sections left as a
"[Provider to complete]" callout with status `placeholder`. Document
control and the notice are unnumbered front and back matter; every other
section is numbered in order, so headings read "1 Purpose" as the house
style asks. Document-specific extra sections are inserted before the fixed
back matter (records, related documents, review, notice) so the notice is
always last. Structure snapshots record ids, numbers, modes, statuses and
block types only, which keeps them readable (3 cases, about 185 KB).

**D-507 Fixed text is lint-clean by test.** Every fixed section of every
skeleton passes the terminology and claims lint with the Commission's class
names as the only allowed exceptions. Two phrasings had to change for this:
the document-control row is "Approval" rather than "Approved by", and the
worker definition says "people we employ" rather than "employees". The
Code of Conduct section summarises the Code's elements in plain words and
says the Commission's published text applies; no deep link is given because
the Code page is not among the fetched sources.

**D-508 Readability without the "-le" rule.** The Flesch-Kincaid syllable
heuristic counts vowel groups after stripping a silent "e"; the common
"-le adds a syllable" rule double-counts here (table, people) and was
dropped. Tests pin the known words and the two thresholds from the house
style (warn above 9, fail above 11), measured on paragraphs, bullets and
steps only.

**D-509 Provider facts are the whole context vocabulary (SR-3).** The
`ProviderFacts` type has eleven keys (trading name, formatted ABN,
structure, state names, support types, pathway, module names, worker count
band, key personnel count, risk-assessed roles, restrictive practices) and
`FACT_KEYS` is also the enum behind `usedFacts`. A test builds the facts
from answers carrying a canary `servicesNote` and asserts the canary and
the step-5 answers never appear. Worker counts are banded (sole, 2 to 5,
6 to 10, 11 to 25, 26 or more) so the prompt never carries an exact
headcount.

**D-510 Reference cases live in the repo.** `fixtures/reference-cases`
holds three fictional questionnaires (sole trader verification in NSW;
company certification with personal care, transport and verification classes
in NSW and QLD; company with restrictive practices in VIC, bringing in the
implementing behaviour support plans module). They are the input for the
structure snapshots, the LibreOffice job and, later, the recorded model
fixtures.

**D-511 LibreOffice job scope.** The `docx-render` CI job installs
`libreoffice-writer` with apt, writes the skeleton sets through the
skeleton test (`WRITE_SKELETONS=1`), converts every `.docx` to PDF with
`soffice --headless` and fails if any file does not convert, then uploads
the sets as an artifact for the PO. It runs on pushes, on manual dispatch,
and on pull requests from `req-005-generator` or titled REQ-005.
**D-512 Context pack and prompt (Dev, 2026-10-12).** `ContextPack` is a
strict zod object: the eleven facts, the document (id, title, kind,
purpose), the section (id, heading, brief), the mapped standards with the
Commission's outcome and indicators verbatim, and the register titles the
document references. The builder reads only named answer fields; a test
traces property access with a Proxy and proves `supports.servicesNote` and
the step-5 answers are never read, and a canary in the services note never
reaches the pack or either prompt (SR-3). The system prompt is the house
style verbatim plus the output contract; the user prompt carries the pack in
`<<<FACTS>>>`, `<<<STANDARDS>>>` and `<<<REGISTERS>>>` blocks with
length caps, and tells the model that text inside the delimiters is data,
not instructions (SR-2). `PROMPT_VERSION` is `2026-10-12.1` and is bumped
by hand with any prompt change.

**D-513 Replay harness.** `ModelClient` has four implementations:
`ReplayClient` (fixtures at `fixtures/generation/<type>/<section>/<sha256>.json`,
`MissingFixtureError` naming the expected path), `RecordingClient`
(wraps a real client and writes the fixture with request, reply, usage and
time), `FakeClient` (tests) and `AnthropicClient` (the SDK, imported
lazily, constructed only when `GENERATION_RECORD=1` and a key exist). The
hash covers prompt version, model, system, user and max tokens over
canonical JSON. `@anthropic-ai/sdk` 0.133.0 is the runtime dependency.

**D-514 Validate, retry once, fall back.** `generateSection` parses the
reply (code fences tolerated), validates the strict section schema, checks
the section id, and runs the terminology and claims lint with class names
exempt; errors are appended to a second request; a second failure yields two
callouts ("Review and complete" and the placeholder) with status
`fallback` and the problems recorded (AC-5). Readability is measured on
accepted prose. The red-team fixture (injected trading name plus a services
note carrying fake participant details) keeps the clean document structure,
confines the injected text to the FACTS block, keeps the note out entirely,
and a reply that obeys the injection is rejected and falls back without the
claim (AC-4).

**D-515 Waiting for the Anthropic key.** `.env.local` has no
`ANTHROPIC_API_KEY` or `ANTHROPIC_MODEL`, so no real generation was
recorded and `fixtures/generation` holds only its README. The recording
path is `npm run generation:record` with `GENERATION_RECORD=1` and both
variables set; it records every tailored section of the governance policy
for the three reference cases and prints token totals for the cost note.
**D-037 Drafting model: `claude-sonnet-5-5` (PO with Haider, 2026-10-12).**
Prices checked 12 Oct 2026: Sonnet 5.5 $2/$10 per MTok in/out, Opus 5.5 $4/$20,
Haiku 5.5 from $0.10/$0.50, Fable 5.1 $10/$50. Estimated full document set:
about 100 calls, roughly 250k input and 50k output tokens, about $1 on Sonnet.
Opus is the fallback if the PO's review of the first real sets finds the
tailored sections too thin; Haiku is reserved for cheap side tasks. Monthly
spend cap set in the Anthropic console before the key is created. Revisit
with measured token counts from the first recordings (REQ-005 Session B).

**D-516 Session C persistence and tenancy (Dev, 2026-10-12).** Three tables
(`version_sets`, `document_versions` with the resolved model as JSON,
`generation_log` with counts only) and a per-account daily quota
(`accounts.generation_daily_limit`, default 5, raisable by an operator;
`generation_quota_hit()` counts in one statement on the Sydney date).
Members read through RLS; every write goes through `SupabaseGenerationStore`
with the service key after the server action has checked the session and
ownership, so no client insert policy exists. The runner takes the store and
the model client as interfaces and is unit-tested end to end with an
in-memory store and a fake model.

**D-517 Private bucket, account-prefixed paths, two locks.** The
`documents` bucket is private with a 25 MB object limit and four allowed
media types; objects live at `<account_id>/<version_set_id>/<file>`. A
member may read their own prefix (policy on `storage.objects` using
`is_member`); nobody writes through the API. The download route checks
the session, that the set belongs to the account and that the object path is
inside the account (`isOwnedPath`) before asking for a 5-minute signed URL;
anything else is 404 (AC-7). The integration suite proves another tenant can
neither sign nor download the object and that clients cannot upload.

**D-518 What a set contains.** One `.docx` per document in the derived set
plus the Practice Standards self-assessment, a PDF readiness summary
rendered with `pdf-lib` (pathway, modules, documents with drafting status,
registers, notices), a README and `set.zip` holding all of them. The
self-assessment's standards table is fixed text with the Commission's
outcome verbatim, chunked into tables of 20 rows; "how we meet these
standards" is a separate tailored section, so the model never rewrites
Commission text. Regenerating a section renders a new `.docx` as the next
document version (`<type>.v<n>.docx`) and the download route always serves
the latest version; the zip and summary are from the original generation.

**D-519 Reviewer view.** Each section shows its mode and status, the
questionnaire answers it used (fact keys mapped to step and question labels)
and, after a regeneration, a line diff against the previous version computed
with an in-repo longest-common-subsequence (no dependency). Only tailored
sections can be regenerated; each regeneration counts against the daily
quota.

**D-520 Fixed extras written; two UNVERIFIED avoidances.** All
document-specific fixed sections now have house-style text (registers,
forms, checklists, agreement outlines). Two places deliberately avoid
restating regulatory detail: the reportable-incident section names the Rules
and tells the provider to keep the Commission's current list and timeframes
with the procedure, and the retention schedule leaves the periods for the
provider to confirm, because neither the Incident Management Rules text nor
retention periods are among the fetched sources (CLAUDE.md 4.6).

**D-521 Retention extension to the purge job.** `purgeGenerationArtifacts`
removes `generation_log` rows older than two years and superseded version
sets (a newer set exists for the account) older than twelve months, objects
first, then rows by cascade; it runs inside the daily purge route and
supports dry run.

**D-522 Still waiting for the Anthropic key.** `.env.local` has no
`ANTHROPIC_API_KEY` or `ANTHROPIC_MODEL` at the end of batch 8, so the
client defaults to replay, no fixture exists, and a real generation would
mark every tailored section "Review and complete" (AC-5 path). The model id
defaults to `claude-sonnet-5-5` per D-037.
**D-523 First recordings (Dev, 2026-10-12, under D-039).** The recorder
records one named section per reference case, loads the Anthropic variables
from `.env.local` itself, prints an input-token estimate before the first
call and writes a counts-only report beside the fixtures. Two lessons: the
recorder and the review pack must run under vitest's Node environment (the
SDK refuses the default browser-like one), and long-running tests need an
explicit timeout (the default cut one call off mid-flight). Outcome: two
sections validated first time; the behaviour-support `steps` section hit
the 2,000-token output cap twice and fell back, so `maxTokens` for
`steps` and `how-we-do-this` sections will be raised to 4,000 before any
further recording, pending the PO's approval of the spend. The review pack
is rendered from fixtures only through the replay client.
**D-524 Readability gate, truncation and the fixture key (Dev, 2026-10-12;
R-5, R-6, D-040).** A readability `fail` is now a validation problem: the
single retry carries "shorten sentences to under 20 words and use common
words", and a second fail falls back. Replies carry the API's stop reason;
`max_tokens` is reported as "reply truncated at N output tokens" and the
identical request is never retried. Output caps are 4,000 for `steps` and
`how-we-do-this` and 1,500 for every other section. The fixture key no
longer includes the cap, so raising a cap cannot orphan fixtures; the four
existing fixtures were re-keyed once and the recorder re-records a fixture
only when it was cut at a lower cap than today's. Replay tests pin the three
outcomes on the recorded fixtures.

**D-525 Batch-11 recordings (Dev, 2026-10-12).** Seven calls, about `.15`.
The behaviour-support `steps` section truncated again at 4,000 output
tokens, so per the PO that section outline is split in a later session, not
given a bigger cap. The sole-trader incident policy now has real text for
scope, policy statement, how we put this into practice and responsibilities
(grades 6.3 to 8.6); `purpose` failed the readability gate twice (15.8 then
12.2) and the `procedure` extra section was cut at the 1,500 cap. Two
proposals for the PO: give extra sections whose id ends in `procedure` the
4,000 cap (they are step lists), and tighten the "purpose" brief in the
catalogue to "two short sentences" so the model stops writing a dense
paragraph there.
**D-526 R-7 implemented through briefs and a lint, not the system prompt
(Dev, 2026-10-12).** The timeframe rule lives in the catalogue briefs of the
step-style sections and in a lint with a retry instruction that names the
document's fixed rules section; the system prompt is unchanged so existing
fixtures keep their keys. The rule moves into the system prompt at the next
`PROMPT_VERSION` bump, when every fixture is re-recorded anyway. Catalogue
gains `omitSections` and `insertAfter` so one document can replace a
shared outline section with anchored sub-sections (the behaviour-support
steps). Batch-12 recordings: 8 calls, about $0.13; every section passed,
the `purpose` section after its one readability retry.

**D-527 Review cycles are facts in the pack, stated through the briefs, and
linted by subject (Dev, 2026-10-12, R-8, D-042).** The catalogue defaults
carry `reviewCycleMonths` (12) and `registerReviewMonths` (3), overridable
per document type; the context pack has a required `reviewCycles` object
and the briefs of the sections that state cycles (`how-we-do-this`,
`responsibilities`) end with a marker the pack fills in ("policy review
every 12 months; register review every 3 months. Use them and never choose
a cycle"), following the D-526 pattern so the system prompt and the other
fixtures keep their keys. The lint reads every "every N months/weeks/years"
(digits or words, "every month" as one) and decides by subject: a sentence
naming the register must use the register cycle, one naming the policy,
procedure, plan, framework or document must use the policy cycle, one
naming both must fit both, and a sentence naming neither may use either
pack value. In a table, cells are joined by " | " in the flattened text and a
cycle cell with no subject of its own ("At least every 12 months") takes
the row's subject. A hit is a validation problem with the retry instruction
"use the review cycles given ...; never choose your own"; one retry, then
fallback. Reporting cadences ("steps 1 and 2 apply every month") are
flagged too, by the PO's wording; the lint is deliberately strict and the
reviewer sees the fallback callout rather than a silent cycle.

**D-528 Proposed: policy-statement cap 2,500 and a per-document stop rule
(Dev, 2026-10-12, for PO approval).** The sole-trader complaints policy
statement truncated at the 1,500 cap (D-040) on its first and only call; the
incident policy statement had fitted with 103 tokens to spare. The brief asks
for a commitment per quality indicator in a table, so the size scales with the
standard. Proposal: `maxTokensFor("policy-statement")` becomes 2,500 (about
$0.025 per call at most); the recorder's rule that a truncation stops the rest
of the case becomes per document, since the self-assessment sections were
skipped for a truncation in a different document. Not implemented until the
PO approves; the six unrecorded sections of item 3 wait on it.

**D-529 R-8 narrowed to review wording; D-043 implemented (Dev,
2026-10-12).** `maxTokensFor("policy-statement")` is 2,500 (D-043); the
fixture key still excludes the cap, so passing fixtures keep their keys and
the recorder re-records only a fixture that was cut at a lower cap. The
recorder's stop-after-truncation set is keyed by case and document type, so a
truncation in one document no longer skips another document of the same
reference case. The review-cycle lint only examines a sentence (or a table
row) that contains review wording: review, reviews, reviewed, reviewing,
check, checks, checked, checking, look at, looks at, looked at, looking at.
"Steps 1 and 2 apply every month" and "we send the report every month" are
cadences, not review cycles, and fall to R-7 (which requires them to refer to
the fixed section that sets them). "Update" and "revise" are deliberately not
review wording: "we update the Commission every month" is a reporting cadence.

**D-530 Thinking is switched off on every generation call; hidden output had
been eating the caps (Dev, 2026-10-12).** Comparing reply length with
`output_tokens` across all fixtures showed two populations: clean replies at
about 3 characters per output token, and many at 0.6 to 1.5, including one
reply of 1,500 tokens with no text at all (the batch-11 incident procedure)
and the self-assessment "how we meet" reply cut at 1,500 tokens with 1,618
characters. Only `text` blocks are kept, so the rest of those tokens were
non-text output billed and counted against `max_tokens`. The request now
sends `thinking: {type: "between_tools"}`, which the API names as the off
setting for this model (it rejects `{type: "disabled"}`); with no tools there
is nothing between them. Re-recording "how we meet" with that setting gave
721 output tokens for 2,393 characters (3.3 per token), passing first time.
Fixtures record the setting and the content block types the API returned; a
truncated fixture recorded without the setting is re-recorded once. Earlier
fixtures stay valid (their text is unchanged) but their token and dollar
figures overstate what the text cost by roughly half; every truncation before
this batch except the 4,000-token behaviour-support steps is now explained by
it. Caps D-040, D-041 and D-043 stand; they are now generous rather than
tight. The two rejected `disabled` requests cost nothing (HTTP 400 before
any tokens).

**D-531 R-9 and R-10 implemented; the outline re-keys every fixture (Dev,
2026-10-12, D-044).** The context pack carries `outline`, the document's
numbered sections (fixed and tailored) from `outlineFor`, rendered in the
user prompt as an OUTLINE block with the instruction to refer to sections
only by the number and title given there, which overrides the house style's
generic structure. The instruction sits in the user prompt beside the
outline rather than in every brief, because the outline changes the user
text for every section anyway; `PROMPT_VERSION` is 2026-10-12.2 for the
same reason, and the R-7 example in the briefs no longer names "section 7
Reportable incidents" (wrong for every document but the incident policy)
but says "by its number and title in the outline". `lintCrossReferences`
flags "section N" when N is not in the outline, and "section N Title" when
the capitalised run after the number is not that section's heading; the
retry instruction names what section N is, which section carries the title
the model used, and the whole outline. Lowercase prose after a number
("section 3 explains") is not a title. `standardsForType` intersects a
document's listed standards with the standards of the case's applicable
modules (`all-applicable` unchanged). Consequences: the verification
sole-trader case loses the core twin of each verification standard, and the
behaviour-support case loses the five `sbs.*` standards listed on the plan
implementation procedure because that case implements plans (`ibsp`); the
fixed "standards this document supports" text of eleven sole-trader
documents whose standards are all core now renders the "no standard listed"
callout, which the PO should weigh (the documents still ship; they just cite
nothing). Every existing fixture is orphaned by the outline block; the
three sole-trader documents are re-recorded in this batch, the
behaviour-support sub-sections wait for the full-set batch
(`GENERATION_RECORD_CASE` limits a recording run to one case).

**D-532 Two lint false positives found by the batch-15 re-recording (Dev,
2026-10-12; the second for PO confirmation).** (1) The R-8 lint rejected
"We review this policy every 12 months and the incident register every 3
months" and the cell "Policy every 12 months; register every 3 months",
both correct, because it took the subject of every cycle mention from the
whole sentence or row. The subject is now what the sentence (the cell, in a
row) names between the previous cycle mention and this one, falling back to
the sentence and then the row when that span names nothing; one cycle for
both subjects is still rejected. Two sections fell back on this alone and
were re-recorded. (2) The terminology lint flagged "participants, their
families and carers" as the banned worker synonym "carer". That phrase is
the Commission's own and means the participant's family carers, so
"carer(s)" is now allowed when preceded by "families and", "family",
"unpaid" or "informal", or followed by "and families"; "our carers" and "a
carer completes the register" are still rejected. The house style itself is
unchanged; the PO may fold the exception into it or strike it.

**D-533 Purpose briefs ask for sentences under 15 words (Dev, 2026-10-12).**
A purpose section is two sentences, so its reading grade rests on two
sentences alone and the standard's name makes each one long: the incident
purpose scored 16.5, 22 and 15.7 on first replies across batches and 11.4
and 12.0 on retries. The brief now reads "Two short sentences, each under
15 words: ..."; both recorded purpose sections then passed first time
(grades 10.7 and 9.4). This re-keyed only the purpose sections, two of them
recorded.

**D-534 Basis implemented as fixed text only (Dev, 2026-10-12, D-045).**
Every catalogue item carries `basis` (practice-standard, code-of-conduct,
commission-rules, privacy-act or good-practice) and, unless it is a
Practice Standard, a one-line `basisReason`; the schema refuses a non-standard
basis without a reason. The PO's twelve assignments are in the catalogue with
the PO's wording where given and plain reasons where not (privacy: the
Privacy Act 1988 and the Code of Conduct; records: the record-keeping
conditions of registration; continuity: the conditions of registration;
emergency: every provider needs such a plan; the AI pair: the Commission's
2026 position on AI use). The document-control section gains a "Why this
document" paragraph under its table: the standards the document supports for
this case, or "Verification providers are not audited against this document
under the NDIS Practice Standards. We keep it because [reason]." The
records-and-evidence section carries the same sentence plus a record-keeping
sentence instead of the provider-to-complete placeholder. Fixed text is not
in the prompt, so no fixture key moved (the replay suite passes unchanged);
the structure snapshots changed for every document (one paragraph added).
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
- D-045 (PO, 2026-10-12): documents that cite no Practice Standard for a
  verification case stay in the set with a catalogue `basis` (code of
  conduct, Commission rules, Privacy Act, good practice) stated in the fixed
  "Why this document" text and the evidence section; no placeholder, no
  escape to core standards. Batch 16 budget up to $2.00 (cap $2.93).
- D-046 (PO, 2026-10-12): prompt caching. The generator marks the system
  prompt and the per-document context block with `cache_control`
  (ephemeral, 5 minutes), stable parts first; fixture keys unchanged; the
  recorder reports cache read and write tokens per call. Model experiment:
  the three sole-trader review-pack documents are also recorded on
  `claude-haiku-5-5` under a model-keyed fixture directory for a side-by-side
  comparison; production stays on Sonnet 5.5 until the PO decides.
