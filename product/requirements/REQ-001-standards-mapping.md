# REQ-001: Standards and registration-group mapping (`data/standards.json`)
Status: in progress
Phase: 1   Priority: must   Owner: Dev

## Why
Every later feature (questionnaire, generator, checklist, registers) depends on an accurate, sourced, versioned model of the NDIS Practice Standards, the registration groups, which modules apply to which groups, and which audit pathway results. This is the product's core knowledge asset and the main defence against "just ask ChatGPT". It must be right, traceable and easy to update when the Commission changes something.

## Scope
In: the data model, the fixture data populated from Commission sources, derivation rules (applicable modules, verification vs certification), unit tests, a `data/SOURCES.md` listing every source URL with retrieval date and a content hash, and a small CLI/report that prints the mapping for a given set of registration groups.
Out: UI, database, AI. No persistence beyond the repo.

## Domain rules that apply
`product/domain/ndis-registration-primer.md` sections on the Practice Standards structure, registration groups and audit pathway. All seed lists there are `UNVERIFIED`; this REQ exists to replace them with sourced data.

## Functional requirements
- FR-1 Model: `Module` (id, name, kind: core | supplementary | verification), `Outcome` (id, module, title, text), `QualityIndicator` (id, outcome, text), `RegistrationGroup` (code, name, riskTier: lower | higher, modules[], auditPathway: verification | certification, mandatoryRegistration: {required: bool, from: date | null, notes}), `EvidenceExpectation` (indicator, typical documents[], typical records[]), plus `Source` (url, title, retrievedAt, version or publication date, sha256 of the fetched text).
- FR-2 Every Outcome, QualityIndicator, RegistrationGroup and mandatory-registration fact references at least one `Source`. Entries without a source cannot exist (schema-enforced).
- FR-3 Derivation function `deriveApplicability(groups[]) -> { modules[], pathway, mandatoryRegistrationNotes[] }`: union of modules for the groups; pathway is certification if any group is higher-risk, else verification; the verification module applies only when pathway is verification.
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

`src/lib/standards/schema.ts` (zod) and `data/standards.example.json` (verified sample: one core standard, one verification standard, the SIL supported decision-making standard with intent and expectation statements, five registration groups including 0137 and 0138, and the rules block). Shape in brief:

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
(Dev fills in.)

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
