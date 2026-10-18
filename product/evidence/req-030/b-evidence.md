# REQ-030 Session B evidence (Dev-2, 18 Oct 2026)

Branch `req-030-session-b`, stacked on Session A (`req-030-session-a` 6f11a93); commits ef336f5 FR-7, 724708f FR-6, e19f736 FR-5, 7c10fc3 FR-2, and the evidence commit (the head) with D-2346 and the ASVS rows. No migration. D-2866 and D-2876 read first: the passphrase is Haider's, generated, never held here; CI's rehearsal uses a committed fixture passphrase. The five answers of 15:57 are built: gpg, the pooler first with the direct host as the fallback, fail over 200 MB, the step for the uptime check (Session A), the cached state.

## FR and AC mapping

- FR-2, AC-3 → `scripts/ops/backup.sh` (data-only `pg_dump -Fc` of `public.*` and `auth.users` piped into gpg symmetric AES-256; the size and the seconds; fail over 200 MB and under 512 bytes; one `jobs.backup.ran` row), `scripts/ops/restore-rehearsal.sh` (gpg streamed into `pg_restore --data-only --disable-triggers`), and CI's Supabase job: after the integration suite, the seeded stack is dumped under the fixture passphrase, `supabase db reset --local --no-seed` makes a fresh migrated stack, the copy is restored into it, and the integration suite runs again. The size and the seconds print in the job's log (the evidence the REQ asks for comes from the PR's first run).
- FR-2, AC-4 → `.github/workflows/backup.yml` and `scripts/ci/workflows.test.ts`: the weekly cron (`0 16 * * 6`, Sunday 03:00 Sydney), the two gated and masked secrets, `contents: read`, `retention-days: 90`, one command (the pooler, then the direct host), no secret key or access token.
- FR-5, AC-8 → `src/lib/ops/data-coverage.test.ts`: every migration's `account_id` table in the export, the pack, the named system list or the pending list; a fixture `public.widgets` fails it naming `widgets`. The first run found fourteen tables in no list, reported to the PO in CHAT-2 with a recommendation each (the pending list in the test file carries the same lines); none joins the export until the PO decides.
- FR-5, AC-9 → `.github/workflows/data-promises.yml`, `scripts/ops/data-promises.mjs` and `data-promises-lib.mjs` with `data-promises.test.ts`: three days old fails naming the age, one day passes, no row and an unreadable time fail.
- FR-6, AC-5 → `launch.ts` and `launch.test.ts`: **Backup within 8 days** set at 7 days, mismatched at 9, unset with no row; `LAUNCH.md` 18b.
- FR-7, AC-11 → `product/legal/privacy.md`, `terms.md`, `questions-for-the-lawyer.md` (5.8) and `legal-copy.test.ts`: the D-2872, D-2873, D-2875 and D-2877 lines verbatim, the old retention line gone, `updated` unchanged.
- SR-2 → the pipe in both scripts; SR-3 → the permissions and the artifact alone (`workflows.test.ts`); SR-4 → the one insert; SR-5 → the fixture passphrase in `ci.yml` and the `secrets.BACKUP_PASSPHRASE` absent there.

## Counts

- `npm run check`: green, 188 files (1 skipped), 1,356 tests, 6 skipped.
- The once-a-session public run (D-2319), every public spec in CI mode on the three projects from a production build of 7c10fc3 on port 3100: 332 passed, 44 skipped, none failed in 16.8 minutes.
- The rehearsal's size and seconds: the PR's Supabase job prints them (`backup: <bytes> bytes in <s> seconds`, `restore: <bytes> bytes restored in <s> seconds`); recorded here by the PO after the first run.

## Said, not built

- AC-12 is Haider's: the real passphrase, the first Sunday artifact, the first green **Backup** row.
- The hosted restore's `--disable-triggers` may need the tables' owner or `--superuser` (UNVERIFIED; DEPLOY.md section 11).
- The fourteen pending tables wait for the PO's decision per table (D-2869).
- The first real run tells whether the pooler accepts `pg_dump` and whether the hosted server's major is 17 (the pinned client).
