# REQ-001: Standards and registration-group mapping (`data/standards.json`)
Status: ready
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
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)
