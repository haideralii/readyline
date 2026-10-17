# Pull request: REQ-020 Session A, the audit pack and the auditor link

Base: `next`. Head: `req-020-audit-pack` (cut from `next` after #58). Compare link: https://github.com/haideralii/readyline/compare/next...req-020-audit-pack?expand=1

Title: `REQ-020 Session A: the audit pack and the auditor link`

---

## REQ

REQ-020: Registers for the audit day and for the team, Session A (`product/requirements/REQ-020-registers-audit-pack.md`, FR-1, FR-2, FR-3, FR-10, SR-1, SR-2, SR-4, AC-1, AC-2). Decision D-2214 (Dev) in `DECISIONS.md`. Base branch: `next` (D-2205).

## What changed

1. FR-1 and FR-10, the audit pack. "Download my audit pack" on the audit-day page and the registers index (`/registers/audit-pack.zip`) builds one zip on request, nothing stored: every register as CSV (incidents and complaints with their event trails, worker checks, policy reviews, and the nine audit-day registers with every stored column but the hidden ones), the document control register as CSV, the readiness summary PDF and the adopted documents' current `.docx` from the newest ready set, and a one-page cover sheet (pdf-lib, the summary's renderer) that lists each of the twelve records with its row count, last entry date and state (present, incomplete, missing) in the audit-day order, then the files. No scores, no "ready", nothing about the outcome. Under the register export limit (five an hour per account); one audit line `audit_pack.downloaded`. The single export and the pack share `registerFiles()` in `src/server/registers/export.ts`.
2. FR-2, FR-3, SR-1, SR-2, the auditor link. From the account page the owner creates one read-only link for 24, 48 or 72 hours (72 the default); a live link is revoked first, so there is one at a time. The token is 32 random bytes (base64url), shown to the owner once and stored only as SHA-256 hex (migration `20261015040000_auditor_links.sql`: member select, owner insert and update, no delete through the API). The signed-out page `/auditor/<token>` and its `/audit-pack.zip` route resolve the token through `auditor_link_lookup`, a `security definer` function the service key alone may execute, which answers the live link's id, account and trading name or no row (unknown, revoked, expired and a deleted account all look the same); the reads that follow use the admin client scoped to that account (D-2214). The page carries the banner ("Read-only view shared by <name> for its audit; it expires on <date>."), the records table first, the pack download, the document control register and each register's rows with codes only; `noindex`; no account id, email or user id in the HTML. Every open and pack download writes `auditor_link.opened` or `.pack-downloaded` with the link id and the viewer's hashed address; creating, replacing and revoking write theirs. The account page shows the live link's expiry, open count and last open, and a revoke button. Nothing names, lists or recommends an auditor; the owner copies the link and sends it (FR-3, CLAUDE.md 4.4).
3. Retention: the purge job deletes auditor link rows 30 days after they ended.

Not in this session: Sessions B (the worker role, the report link) and C (hazards, import, the self-check).

## Security checklist (REQ-002 FR-7; tick or explain)

- [x] The two new route handlers parse their (empty) query with `parseInput` and a `strictObject`; the two server actions parse `hours` (an enum) and `id` (a UUID) the same way; the token in the path is matched against a fixed 43-character pattern before any lookup.
- [x] No secrets, tokens or `.env` files in the diff; no new environment variable. The token is generated server-side, returned once to the owner's page, and stored only as its hash.
- [x] Logs carry account ids, link ids, file counts and error codes; never a token, an address in clear, register text or an email.
- [x] Security headers and CSP unchanged; the signed-out page is dynamic and nonced like every other; `noindex` on the page and `X-Robots-Tag` on the pack.
- [x] No new external origin; no new dependency (`pdf-lib` and `fflate` were already used).
- [x] No participant data: the pack and the page carry the codes the registers already hold; hidden columns (`id`, `account_id`, `created_by`, version ids) never leave the server (`PACK_HIDDEN_COLUMNS`, tested).
- [x] Tenant data: the new table is under RLS with explicit grants (D-052); the lookup function is executable by `service_role` only (the integration suite asserts 42501 for anon and authenticated); the auditor path reads one account, the one the token resolved to.

## Tests and evidence

- `npm run check`: green on the branch head (121 files, 866 tests, 6 skipped; 12 new unit tests across `auditor-link.test.ts` and `audit-pack.test.ts`, the cover sheet rendered and paginated).
- Integration (CI's Supabase job): `tests/integration/auditor-links-rls.test.ts`: the owner creates and revokes; the hash CHECK; another account and anon see and change nothing; the lookup answers the live row to the service key only and nothing for unknown, revoked or expired hashes; no delete through the API.
- E2E (three projects, CI's Supabase job): `e2e/signed-in/audit-pack.spec.ts`: the link created on the account page, opened in a fresh signed-out context (banner, records table, codes only, no email, user id or account id in the HTML, `noindex`), the pack downloaded through the link and its file names checked, 404 after revocation on the page and the pack, the four audit actions present; the owner's download from the audit-day page, the file names, and the sixth download in an hour refused with 429.
- Public (local, against a production build, desktop and Android): `e2e/admin.spec.ts` (an unknown token is 404 on the page and the pack, a short token too) and `e2e/legal-pages.spec.ts`: 16 passed, 2 skipped.
- ASVS rows: `product/security/asvs-l1-check-2026-10-14.md`, "REQ-020 Session A additions".
- Screenshots at 360 px and desktop: the spec saves `auditor-link-created` and `auditor-view` under `product/evidence/req-020/` when `EVIDENCE=1` (CI's Supabase job uploads them); the PO's phone check of an auditor link is the manual item.
- Delivery evidence: `product/requirements/REQ-020-registers-audit-pack.md`, "Delivery evidence".

## Claims, brand, privacy

- [x] New copy passed `findProhibitedClaims` and the copy lint; the cover sheet and the page say what is inside and nothing about the outcome; no auditor is named, listed or paid.

🤖 Generated with [Claude Code](https://claude.com/claude-code)