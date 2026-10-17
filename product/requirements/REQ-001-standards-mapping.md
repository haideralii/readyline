# REQ-001: Standards and registration-group mapping (`data/standards.json`)
Status: accepted
Phase: 1   Priority: must   Owner: Dev

## Why
Every later feature (questionnaire, generator, checklist, registers) depends on an accurate, sourced, versioned model of the NDIS Practice Standards, the registration groups, which modules apply to which groups, and which audit pathway results. This is the product's core knowledge asset and the main defence against "just ask ChatGPT". It must be right, traceable and easy to update when the Commission changes something.

## Scope
In: the data model, the fixture data populated from Commission sources, derivation rules (applicable modules, verification vs certification), unit tests, a `data/SOURCES.md` listing every source URL with retrieval date and a content hash, and a small CLI/report that prints the mapping for a given set of registration groups.
Out: UI, database, AI. No persistence beyond the repo.

## Domain rules that apply
`product/domain/ndis-registration-primer.md` sections on the Practice Standards structure, registration groups and audit pathway. All seed lists there are `UNVERIFIED`; this REQ exists to replace them with sourced data.

## Functional requirements
- FR-1 Model: `Module` (id, name, kind: core | supplementary | verification), `Outcome` (id, module, title, text), `QualityIndicator` (id, outcome, text), `RegistrationGroup` (code, name, riskTier: lower | higher, modules[], auditPathway: verification | certification, mandatoryRegistration: {required: bool, from: date | null, notes}), `EvidenceExpectation` (indicator, typical documents[], typical records[]), plus `Source` (url, title, retrievedAt, version or publication date, sha256 of the fetched text). *(Retro review 15 Oct 2026: the delivered shape in `src/lib/standards/schema.ts` differs as accepted in PO review item 1: indicators are an ordered `string[]` on the standard with derivable ids `<standardId>#<index>`, evidence hangs off the standard, `auditType` replaces `riskTier`, `requiresCore` plus `rules` replace a flat `modules[]`, and `Source.fetchedAt` is the retrieval date.)*
- FR-2 Every Outcome, QualityIndicator, RegistrationGroup and mandatory-registration fact references at least one `Source`. Entries without a source cannot exist (schema-enforced).
- FR-3 Derivation function `deriveApplicability(groups[]) -> { modules[], pathway, mandatoryRegistrationNotes[] }`: union of modules for the groups; pathway is certification if any group is higher-risk, else verification; the verification module applies only when pathway is verification. *(Retro review 15 Oct 2026: delivered, as accepted in PO review item 2, as `deriveApplicability(dataset, { groups, businessStructure, usesRestrictivePractices, silEligibility })` in `src/lib/standards/derive.ts`, returning `groups`, `pathway`, `modifiedCertification`, `modules`, `coreStandardIds`, `midTermAudit` and `reasons[]` with the rule and source id for every decision; `mandatoryRegistrationNotes[]` lives on the registration groups' `notes` and `mandatoryFrom` fields.)*
- FR-4 Evidence expectations per indicator are a first pass written by Dev from the Commission's quality-indicator guidance, marked `draft: true` until the PO reviews them (they feed REQ-005).
- FR-5 `npm run standards:report -- 0120 0107` prints the applicable modules, pathway, outcomes count and any `UNVERIFIED` flags.
- FR-6 A `version` field at the top of `standards.json` (semver) and a `CHANGELOG` section in `data/SOURCES.md`.

## Security and privacy requirements
- SR-1 Fetching sources is a one-off developer action, not a runtime dependency; store the fetched text under `data/sources/` for diffing. No network calls at runtime.
- SR-2 CI runs `npm audit --omit=dev --audit-level=high` and a secrets-pattern grep (see threat model); both must pass on this branch.

## Data
As in FR-1. Retention not applicable (repo data).

## Acceptance criteria
- AC-1 Given the fixture, when the schema test runs, then every Outcome, QualityIndicator, RegistrationGroup and mandatory-registration fact has at least one Source with url, retrievedAt and sha256.
- AC-2 Given each RegistrationGroup in the fixture, when `deriveApplicability([group])` runs, then it returns at least one module and a pathway, and higher-risk groups return certification.
- AC-3 Given groups [0120] (lower-risk only), when derived, then pathway is verification and the verification module is included; given [0120, 0107], then pathway is certification and the verification module is not included.
- AC-4 Given groups [0138], when derived, then `mandatoryRegistrationNotes` states the 1 July 2026 commencement and the enrolment cut-off, each with a source.
- AC-5 Given the full fixture, when the completeness test runs, then every supplementary module is referenced by at least one group and every core division has at least one outcome with at least one indicator.
- AC-6 Given a source file under `data/sources/`, when its sha256 differs from the one recorded in `standards.json`, then `npm run standards:verify` fails with the changed source named.
- AC-7 `UNVERIFIED` items are listed in `data/SOURCES.md` and in `DECISIONS.md`, each with what would resolve it.

## Test expectations
Unit (Vitest) for schema, derivation, completeness, hash verification. No e2e. Report script smoke-tested in CI.

## Evidence required on delivery
Test output; `data/SOURCES.md`; the report for three example group sets ([0120], [0120,0107], [0138]); the list of `UNVERIFIED` items; a short note on anything in the Commission's current material that contradicts the primer.

## Questions for Dev to answer before building
1. Which Commission pages or PDFs are the authoritative current sources for (a) the Practice Standards and Quality Indicators, (b) registration groups and audit requirements, (c) mandatory registration? List the URLs you will use, with publication dates. If a page is behind a search or JS, say so.
2. Proposed JSON shape for `standards.json` (a 30-line sample) before populating.
3. Do you see any registration group whose pathway depends on something other than the group itself (e.g. provider type or the participant's age)? If so, propose how to model it.
4. Estimate in sessions.

## Dev response

Written 2026-10-11 on branch `req-001-standards-mapping`. Sources were fetched and snapshotted the same day (`data/sources/`, hashed in `manifest.json`); the schema and a verified sample are in the repo for PO review before the full dataset is populated. Decisions D-101 to D-111 in `DECISIONS.md` carry the detail.

### Q1. Authoritative sources (all on ndiscommission.gov.au, fetched 2026-10-11)

(a) Practice Standards and Quality Indicators

- Online version, hub page: `/rules-and-standards/ndis-practice-standards`. No date shown. Links the consolidated PDF.
- Consolidated PDF "NDIS Practice Standards and Quality Indicators", **Version 4, November 2021** (file uploaded 2024-10): `/sites/default/files/2024-10/ndis-practice-standards-and-quality-indicators.pdf`. 45 pages. Still the current legacy text.
- One page per module: four core-module pages, six supplementary-module pages, the verification-module page. Same text as the PDF, no dates shown.
- **SIL module (new):** `/rules-and-standards/ndis-practice-standards/sil` plus four sub-pages; PDF `/sites/default/files/2026-06/SIL-Practice-Standards-PDF.pdf` (June 2026, applies from 1 July 2026); Evidence Guide for Providers and Workers PDF (June 2026).
- Practice Standards reform page: confirms the wider review is still at consultation and no other new instrument exists.

(b) Registration groups and audit requirements

- Registration groups table: `/provider-registration/apply-registration/registration-groups-or-classes-support`. 38 classes 0101 to 0138 with audit type, plus the mixed-application rule. No date shown.
- "Registration Requirements by Supports and Services" PDF (reference 200312, uploaded 2022-02): the only Commission document mapping classes to modules. Predates 0137 and 0138.
- Types of audits page: `/provider-registration/apply-registration/types-audits`. Audit types, mid-term audit rule and exemptions, ratings 3/2/1/0, report timeframes, "no cost to register, auditor sets price".

(c) Mandatory registration

- `/about-us/ndis-commission-reform-hub/mandatory-registration` and its SIL and digital-platform transition sub-pages. 1 July 2026 commencement, class definitions, support coordination paused.
- Regulatory Expectations for Approved Quality Auditors, V1 June 2026 (auditor independence; referral fees prohibited).

Not yet fetched, needed to close two `UNVERIFIED` items: the Provider Registration and Practice Standards Rules 2018 as amended (legislation.gov.au F2018L00631) and the Quality Indicators Guidelines 2018 as amended, to confirm which modules apply to 0137 and whether the core module applies to 0138 alongside SIL.

Access note: every page is server-rendered HTML with no search or JS wall, but the site times out for the hosted fetch tool. Direct download with a browser user agent works; HTML was reduced to main-content text, PDFs extracted with pypdf.

### Q2. Proposed shape

`src/lib/standards/schema.ts` (zod) and `data/standards.example.json` (removed when the full `data/standards.json` landed in Session A; retro review 15 Oct 2026) (verified sample: one core standard, one verification standard, the SIL supported decision-making standard with intent and expectation statements, five registration groups including 0137 and 0138, and the rules block). Shape in brief:

```
{ schemaVersion: 1, version: "0.1.0", generatedAt, evidenceDisclaimer,
  sources[]:  { id, title, publisher, url, versionLabel, effectiveFrom, fetchedAt, snapshotPath, sha256 }
  modules[]:  { id, kind: core|supplementary|verification, name, divisions[] (core only), appliesTo, effectiveFrom, sourceIds[], verification }
  standards[]:{ id "core.rights.person-centred-supports", moduleId, divisionId?, name,
                outcome (verbatim), indicators[] (verbatim, in order), intent?, expectationStatements? (SIL),
                sourceId, sourceLocator, evidence[]: { draft, kind, title, note?, documentTypeId?, sourceId? }, verification }
  registrationGroups[]: { code "0107", name, auditType, moduleIds[] (own supplementary modules), requiresCore, mandatoryFrom, notes?, sourceIds[], verification }
  rules: { mixedAuditResolvesTo, restrictivePracticesModuleId, coreExemptWhenSole[], modifiedCertification{}, registrationPeriodYears, midTermAudit{}, ratings[] }  // each with a sourceId
  verification (on every record): { status: verified|unverified, note (required when unverified), checkedAt } }
```

Differences from FR-1, with reasons:

- Quality indicators are an ordered `string[]` on the standard rather than separate entities. The Commission does not number them on the web pages, so an indicator id would be ours; `<standardId>#<index>` is derivable when the self-assessment needs one. Happy to split them out if the PO prefers explicit ids.
- Evidence expectations hang off the standard, not the indicator, with a `draft` flag (default true) per FR-4. Indicator-level evidence can be added later with an `indicatorIndexes` field without breaking the shape.
- `riskTier` is expressed as `auditType` because that is the word the Commission's table uses.
- `requiresCore` plus `rules` replace a flat `modules[]` per group so the SDA-only and modified-certification cases are data, not code.
- Source integrity: FR-6 and AC-6 are met by `sources[].sha256` matching `data/sources/manifest.json`; a `standards:verify` script will re-hash and fail on drift.

### Q3. Pathway or modules depending on more than the group

Yes, four cases, all from the Commission's mapping document and modelled in `rules`:

1. **SDA (0131) alone**: SDA module only, no core module. SDA with any other group: core plus SDA. Needs the full group set, not one group at a time.
2. **Early childhood (0118) delivered by an individual or partnership** with no other certification group: "modified certification", core module limited to the freedom from violence, abuse, neglect, exploitation and discrimination outcome plus the early childhood module. Needs business structure from the questionnaire.
3. **Restrictive practices used in any support**: implementing behaviour support plans module is added regardless of groups. Needs a questionnaire answer.
4. **Whether 0138 applies at all** depends on the service pattern (support most of the day, provider manages and delivers the package) rather than only on what the provider calls it; the questionnaire must ask the Commission's two exclusion questions. Also 0127 plan management is verification but carries extra worker evidence requirements.

So the derivation signature becomes `deriveApplicability(groups[], { businessStructure, usesRestrictivePractices })`. Pathway itself (verification vs certification) depends only on the group set.

Contradictions with the primer, for the PO: 0125 participation in community, 0117 development of daily living and life skills, and 0106 life stage transitions are all **certification** in the Commission's table, not lower-risk as the primer's seed list suggests. 0115 is certification as the primer says. There is no "platform" supplementary module; 0137 maps to certification with modules unstated (`UNVERIFIED`).

### Q4. Estimate

Two sessions after this one. Session A: populate every standard verbatim (23 core, 4 verification, 4 SIL, 6 legacy supplementary modules), all 38 groups, `data/SOURCES.md`, completeness and mapping tests. Session B: `deriveApplicability`, `standards:report` and `standards:verify` scripts, remaining tests, delivery evidence. Fetching the two legislation instruments to close the 0137 and 0138 items happens in session A.

## Delivery evidence

### Session A (2026-10-11): dataset built; derivation and report scripts follow in Session B

**Built**

- `data/standards.json` (generated): 26 sources, 9 modules, 70 standards (core 24, high intensity 8, specialist behaviour support 7, implementing behaviour support plans 8, early childhood 7, specialised support coordination 3, SDA 5, SIL 4, verification 4), 38 registration classes, rules block including the SIL definition and exclusions.
- `data/standards.meta.json` (hand-maintained inputs), `scripts/standards/build.mjs` (parser and builder), `scripts/standards/verify.mjs` (hash and source checks), `data/SOURCES.md` (generated: source table with hashes, UNVERIFIED items, changelog).
- Schema additions: `version` (semver), `note` on standards, `draft` on evidence, `coreExemptWhenSoleSourceId`, `registrationPeriodSourceId`, `silDefinition` with `applicationDeadline`; publisher may be the Federal Register of Legislation.
- New snapshots: Commission "About registration" (registration period) and the legislation register landing page (compilation F2026C00527, table of contents).

**PO review items addressed**

1. Indicator ids are `<standardId>#<index>`; a test asserts each standard's indicator order matches its snapshot, so an index cannot silently change.
2. `rules.silDefinition` carries the Commission's SIL definition and the two exclusions verbatim plus the 1 October 2026 application deadline, ready for the derivation input and REQ-003.
5. D-104 closed: both 0137 and 0138 are `verified` from the Commission's transition pages (DECISIONS D-112). The Rules' full text could not be captured (script-rendered); its table of contents was.
6. AC-8: every rule has a source id and `checkIntegrity` fails if any is unknown. AC-9: `npm run standards:verify` fails on hash drift, missing snapshots, manifest mismatch, verified records without a source, or placeholder text; it runs in CI before the unit tests.

**Test output (local, 2026-10-11)**

```
standards:verify ok: 26 sources match their snapshots and the manifest
Test Files  3 passed (3)   Tests  56 passed (56)
npm run lint: clean   npm run typecheck: clean   npm run format:check: clean
```

Tests covering the acceptance criteria so far: AC-1 (`every standard has verbatim text, a source and at least one evidence item`, `every source hash matches the snapshot on disk and the manifest`), AC-5 (`every supplementary module is brought in by a group or by the restrictive-practices rule`, `every core division has at least one standard with at least one indicator`), AC-4 data (`the two mandatory classes carry the 1 July 2026 commencement and SIL carries the application cut-off`), AC-8 (`every rule names a source that exists`), AC-9 (`standards:verify`). AC-2, AC-3, AC-7 and AC-10 need `deriveApplicability` and the report script (Session B). AC-6 is met by `standards:verify`; a drift demonstration will be attached in Session B.

**Deviations and notes for the PO**

- Core module has 24 standards, not the 23 stated in the Dev response (emergency and disaster management was missed in the count).
- The severe dysphagia training restriction on the Commission's web page is not in the Version 4 PDF; stored as `note`, not an indicator (D-115).
- `FR-5` report script and `AC-6` drift demonstration: Session B.
- Evidence items are a first pass and all `draft: true` (FR-4).

### Session B (2026-10-11): derivation, report, drift demonstration, review items

PR: https://github.com/haideralii/readyline/pull/1 (branch `req-001-standards-mapping`). CI: https://github.com/haideralii/readyline/actions (the run for the Session B push is the latest on that branch; the workflow runs lint, format check, typecheck, `standards:verify`, unit tests, build and Playwright on both projects).

**Built**

- `src/lib/standards/derive.ts`: `deriveApplicability(dataset, { groups, businessStructure, usesRestrictivePractices, silEligibility })` returning `groups` (after SIL exclusion), `pathway`, `modifiedCertification`, `modules` (dataset order), `coreStandardIds` (null unless limited), `midTermAudit { applies, exemptReason?, monthsAfterRegistration, prepareFromMonth, assessedDivisionIds, sourceId }` and `reasons[] { rule, effect, target?, sourceId, text, unverified? }`; plus `applicableStandards(dataset, result)`. Decision D-119 lists the rule order.
- `scripts/standards/report.ts` (`npm run standards:report -- <codes> [--structure=…] [--restrictive] [--sil-few-hours] [--sil-self-managed] [--no-evidence]`): prints inputs, pathway, modules with standard counts, outcomes to self-assess, mid-term audit, the reasons with source ids, UNVERIFIED flags, the `evidenceDisclaimer`, and every evidence item prefixed `[draft]` until reviewed. Exit code 2 on a derivation error (for example 0138 with an exclusion and no other class).
- `data/SOURCES.md` now has a generated Contents section; `data/sources.test.ts` asserts it agrees with the dataset (review item 1, AC-7). `data/README.md` has the snapshot refresh procedure (review item 5).

**PO Session A review items**

1. Changelog count: number removed from the changelog note; counts generated and tested.
2. `silEligibility` input, `reasons[]` with rule and source ids, `midTermAudit { applies, exemptReason? }`: delivered, see `derive.test.ts` ("SIL eligibility", "AC-10", "AC-3").
3. Report prints the evidence disclaimer and `[draft]` markers: see outputs below.
4. AC-6 drift demonstration: below.
5. `data/README.md` refresh paragraph: added.

**Test output (local, 2026-10-11)**

```
npm run check: lint clean, format clean, typecheck clean
Test Files  5 passed (5)   Tests  121 passed (121)
standards:verify ok: 26 sources match their snapshots and the manifest
npm run build: compiled, 2 static routes
```

AC mapping: AC-1 `data/standards.test.ts` (verbatim text, source, evidence; hashes); AC-2 `derive.test.ts` "AC-2: every registration group on its own" (38 cases, pathway equals the table's audit type, every reason has a known source); AC-3 `derive.test.ts` "[0120] alone…", "[0120, 0107]…"; AC-4 `data/standards.test.ts` mandatory classes and the 1 October 2026 cut-off; AC-5 `data/standards.test.ts` supplementary modules referenced and core divisions populated; AC-6 `standards:verify` plus the demonstration below; AC-7 `data/sources.test.ts` and the DECISIONS.md UNVERIFIED register; AC-8 `data/standards.test.ts` "every rule names a source that exists"; AC-9 `standards:verify` (hash drift, manifest mismatch, missing snapshot, verified without source, placeholder text); AC-10 `derive.test.ts` "[0131] alone…", "[0118] as a sole trader…".

**Report outputs (`--no-evidence` shown for brevity; the full runs include the disclaimer and `[draft]` evidence)**

`[0120]`: pathway verification; modules: verification (4 standards); outcomes 4; mid-term does not apply; reasons: verification-pathway (registration-groups), verification-module (registration-requirements), mid-term-audit (types-of-audits).

`[0120, 0107]`: pathway certification; modules: core (24); outcomes 24; mid-term applies at 18 months (prepare from 12), governance division; reasons: mixed-audit (registration-groups), core-module (registration-requirements), mid-term-audit.

`[0138]` with both exclusions answered no: pathway certification; modules: core (24), sil (4); outcomes 28; mid-term applies; reasons: sil-definition info (mandatory-sil), certification-pathway, core-module, group-module (mandatory-sil), mid-term-audit. With `--sil-few-hours` and no other class: exit 2, "Class 0138 was excluded by the SIL definition and no other group was selected."

`[0131]` (AC-10): pathway certification; modules: sda (5) only, no core; mid-term does not apply (SDA only); reasons include sda-only (registration-requirements).

`[0118] --structure=sole-trader` (AC-10): pathway certification (modified certification); modules: core limited to `core.rights.violence-abuse-neglect-exploitation-and-discrimination` (1 standard), ec (7); outcomes 8; mid-term does not apply (individual or partnership, early childhood only).

Every run ends with the evidence section headed by: "Evidence items are {{BRAND}} guidance on what auditors typically ask to see. They are not part of the NDIS Practice Standards and do not replace the auditor's own scope of audit." and "Items marked [draft] have not yet been reviewed by the product owner."

**AC-6 drift demonstration**

One word changed in `data/sources/verification.txt` ("Appropriate insurance is in place" to "is NOT in place"), then:

```
standards:verify found 2 problem(s):
  - source verification: snapshot data/sources/verification.txt changed (recorded 842f6704079e, now 29526a258dcd)
  - source verification: manifest hash for data/sources/verification.txt differs from the file
exit code: 1
```

File reverted; `standards:verify ok: 26 sources match their snapshots and the manifest`. The same check runs in CI before the unit tests.

**UNVERIFIED and notes**

- Whether restrictive practice use changes a verification audit into certification: not stated in the material held; the derivation keeps the pathway and emits an `unverified` reason (D-119, register updated).
- Transitioned-provider mid-term exemption is not an input; the reason text names it.
- Evidence items remain `draft: true` pending the PO's standard-by-standard pass (REQ-005).
- No new dependency: the report runs on Node's built-in type stripping (D-120).

**Merged to main:** PR #1 merged on GitHub (39fd178). The PO's batch-2 commits, queue item 0 (Readyline brand, D-027) and the Session B review notes were then merged from `req-001-standards-mapping` into `main` with `--no-ff` as 1232a73 on 2026-10-11 on Haider's instruction, without re-confirming CI from the dev machine (no GitHub CLI or API token there; the branch's last PO-confirmed run was CI #5 green).

## PO review

**11 Oct 2026, interim review of the Dev response: approved to proceed to Sessions A and B.** Good sourcing discipline; the snapshots-plus-hash approach is exactly what AC-6 needs. Decisions on your questions:

1. **Q2 schema deviations: all accepted.** Indicators as an ordered `string[]` with derivable ids `<standardId>#<index>` is fine, with one rule: the index is stable once published, so a future Commission reorder must append or version, never renumber (write a test that the example's indicator order matches the snapshot). Evidence on the standard with `draft: true` is fine. `auditType` instead of `riskTier` accepted; use the Commission's words throughout. `requiresCore` plus `rules` accepted.
2. **Q3 derivation signature accepted**: `deriveApplicability(groups[], { businessStructure, usesRestrictivePractices })`. Add a third input for the SIL exclusion questions (or document that 0138 inclusion is decided before the call), and make the function return the reasons (which rule fired) so the questionnaire can show them. These inputs are now required fields for REQ-003 (noted in the backlog).
3. **Primer corrections accepted** and applied (0125, 0117, 0106 are certification; no platform module; SIL module added; verification module content confirmed; mid-term audit details; auditor referral fees prohibited).
4. **D-109 changes the product**: paid auditor referrals are removed from CLAUDE.md, the backlog and the shariah section. Good catch.
5. **Priority for Session A**: close the two D-104 items by fetching the Provider Registration and Practice Standards Rules 2018 (as amended) and the Quality Indicators Guidelines; if the amended Rules do not yet state 0137 modules, keep the `UNVERIFIED` flag and add a user-facing note in the data (`notes`) that the module set for digital platforms is pending the Commission's instrument.
6. **Additional acceptance criteria for delivery**: AC-8 the `rules` block has a source for each rule; AC-9 `standards:verify` fails when any snapshot hash drifts or any verified record lacks a source; AC-10 the report for [0131] alone shows SDA module without core, and for [0118] with `businessStructure: individual` shows modified certification.
7. **Branch**: keep working on `req-001-standards-mapping`; open the PR when Delivery evidence is filled in. REQ-002 may proceed in parallel.

Status set to `in progress`.

**11 Oct 2026, Session A review: ACCEPTED for Session A scope; REQ stays `in progress` pending Session B.**

Independent PO checks (Linux VM, same commit `bf2f197`): `node scripts/standards/verify.mjs` reports 26 sources matching snapshots and manifest; a script of mine confirmed all 70 standards' `outcome` text and sampled indicators appear verbatim in their cited snapshot (0 mismatches); spot-checked group audit types and modules for 0106, 0117, 0120, 0125, 0127, 0131, 0137, 0138; `rules.silDefinition` carries the Commission's applies-when and not-SIL-when text with the 1 Oct 2026 deadline; `modifiedCertification` and `coreExemptWhenSole` are data with sources. Vitest could not run in the PO's VM (Windows-built binaries), so the 56-test result is accepted on Dev's output and must be confirmed by CI on the pushed branch.

Changes requested (small, fold into Session B):

1. `data/SOURCES.md` changelog says "core module (23 standards)"; the dataset and your evidence say 24. Fix the generated text and add a test that the changelog count equals the dataset count, or drop the number from the changelog.
2. `deriveApplicability` (Session B) must take `silEligibility` (answers to the two not-SIL-when questions) alongside `businessStructure` and `usesRestrictivePractices`, return `reasons[]` naming the rule and source id for every module added or removed and for the pathway, and return `midTermAudit: { applies, exemptReason? }` using D-106.
3. Report script output must print the `evidenceDisclaimer` and mark evidence items `draft`, so nobody mistakes the first-pass evidence list for Commission text.
4. Attach the AC-6 drift demonstration (edit one snapshot, show `standards:verify` failing and naming it, revert).
5. `data/README.md`: one paragraph on how to refresh snapshots when the Commission updates a page (bump `version`, update manifest, re-run build and verify, record in SOURCES changelog), since this is the process a future you will follow at 11pm.

Not blocking, noted for REQ-005: the evidence items (all `draft: true`) need a PO pass standard-by-standard before they drive generated documents; I will do that as part of the REQ-005 domain rules.

**11 Oct 2026, Session B review: ACCEPTED. REQ-001 is complete.**

CI run #5 on PR #1 is green (lint, format, typecheck, `standards:verify`, 121 unit tests, build, Playwright on both projects). The derivation returns reasons with rule and source ids, SIL eligibility is an input, mid-term audit applicability carries its exemption reason, the report prints the evidence disclaimer and `[draft]` markers, the drift demonstration names the changed file, and all five Session A items are closed. The PR is marked ready; merge per the queue.

Two notes, neither blocking: (a) "[0118, 0120] as a partnership is still modified certification" is the Dev's reading of the mapping document; the Commission text does not say whether a verification group alongside early childhood keeps the modified scope. Tag the reason `unverified` for that combination and add it to the register. (b) The restrictive-practices-on-verification-pathway case is already tagged `unverified`; keep it visible in the questionnaire result.

