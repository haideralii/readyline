#!/usr/bin/env bash
# The restore (REQ-030 FR-2, D-2866; INCIDENTS.md section 6), rehearsed in CI
# on every Supabase job and run by Haider on the day: decrypt the backup with
# the passphrase and pour its rows into a stack whose migrations are already
# applied (the dump carries data only). The plaintext never touches disk: gpg
# streams into pg_restore. Prints the size and the seconds, nothing else.
#
#   DB_URL=postgresql://... BACKUP_PASSPHRASE=... IN=readyline-2026-10-18.sql.gpg scripts/ops/restore-rehearsal.sh
#
# The rows land in any order under the foreign keys because the session runs
# with `session_replication_role = replica`, which is how Supabase's own
# restore guide loads a data dump (psql --command 'SET session_replication_role
# = replica' --file data.sql, as the project's `postgres` user): Supabase lets
# `postgres` set it although it is not a superuser. `pg_restore
# --disable-triggers` was the first version and refused at once on the local
# stack (#115 at dea7a21): DISABLE TRIGGER ALL on a table with foreign keys
# needs a superuser, which `postgres` is not, locally or hosted. So pg_restore
# writes the archive out as SQL (`-f -`) and psql runs it in one session and
# one transaction, so a failure leaves the stack as it was, never part-filled.
set -euo pipefail

: "${DB_URL:?DB_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
: "${IN:?IN is not set (the .sql.gpg file)}"

pg_restore --version
bytes=$(stat -c %s "$IN")
started=$(date +%s)
{
  echo "set session_replication_role = replica;"
  gpg --decrypt --batch --quiet --pinentry-mode loopback --passphrase-fd 3 "$IN" 3<<<"$BACKUP_PASSPHRASE" \
    | pg_restore --data-only --no-owner --no-privileges -f -
} | psql "$DB_URL" --single-transaction -v ON_ERROR_STOP=1 -q -o /dev/null
finished=$(date +%s)
echo "restore: ${bytes} bytes restored in $((finished - started)) seconds"
