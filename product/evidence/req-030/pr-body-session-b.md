# REQ-030 Session B: the weekly encrypted backup with its rehearsal, the export and purge checks, the legal lines, the backup row

Branch `req-030-session-b`, stacked on Session A; PR to `next`. Dev-2, 18 Oct 2026. One commit per FR with its tests, then the evidence. No migration. The passphrase is Haider's (D-2876); CI rehearses with a fixture.

## What this PR does

- **FR-2, the backup (D-2866, D-2876).** `backup.yml` every Sunday 03:00 Sydney: `migrate.yml`'s gate-and-mask pattern, the PostgreSQL 17 client, the pooler URL then the direct host, `scripts/ops/backup.sh` (a data-only `pg_dump` of `public.*` and `auth.users` piped into gpg's AES-256, never on disk in clear; size, seconds, a 200 MB cap, one `jobs.backup.ran` row), the encrypted copy as a 90-day artifact under `contents: read`. `restore-rehearsal.sh` streams gpg into `pg_restore`; CI's Supabase job rehearses it on every run (dump under a fixture passphrase, reset the stack, restore, the integration suite again). `DEPLOY.md` section 11.
- **FR-5, the checks (D-2869, D-2898).** `data-coverage.test.ts` holds every `account_id` table to the export, the pack, a named system table or a named pending decision; the fourteen tables of the first run are placed per D-2898 (six into `account.json`, read as the owner under RLS and seeded in the AC-4 integration test; two event trails the pack already wrote; six system tables with their line); `data-promises.yml` monthly judges the purge's age with `data-promises.mjs`.
- **FR-7, the legal lines (D-2870 to D-2873, D-2875, D-2877, D-2871).** Verbatim, pinned, `updated` unmoved; QL 5.8 for the practising lawyer.
- **FR-6, the row.** **Backup within 8 days**; `LAUNCH.md` 18b.

## Checks

- `npm run check`: green, 188 files (1 skipped), 1,356 tests, 6 skipped.
- Every public spec in CI mode on the three projects from a production build: 332 passed, 44 skipped, none failed in 16.8 minutes.
- Evidence: `product/evidence/req-030/b-evidence.md`; D-2346 and the ASVS rows under "REQ-030 Session B additions".

## For the PO

- The restore follows Supabase's own guide (`set session_replication_role = replica`, one psql transaction) after `pg_restore --disable-triggers` was refused on the local stack (not a superuser); the first hosted restore is the proof that `postgres` may set it there too, as the guide says (DEPLOY.md section 11).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
