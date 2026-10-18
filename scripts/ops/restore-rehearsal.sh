#!/usr/bin/env bash
# The restore (REQ-030 FR-2, D-2866; INCIDENTS.md section 6), rehearsed in CI
# on every Supabase job and run by Haider on the day: decrypt the backup with
# the passphrase and pour its rows into a stack whose migrations are already
# applied (the dump carries data only). The plaintext never touches disk: gpg
# streams into pg_restore. Prints the size and the seconds, nothing else.
#
#   DB_URL=postgresql://... BACKUP_PASSPHRASE=... IN=readyline-2026-10-18.sql.gpg scripts/ops/restore-rehearsal.sh
#
# `--disable-triggers` lets the rows land in any order under the foreign keys
# and the row-level policies' triggers; it needs a superuser or the table
# owner, which the local stack's `postgres` role is. On the hosted project the
# `postgres` role is not a superuser (UNVERIFIED): if a hosted restore refuses,
# run it as the owner of each table or with `--superuser`, DEPLOY.md section 11.
set -euo pipefail

: "${DB_URL:?DB_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
: "${IN:?IN is not set (the .sql.gpg file)}"

bytes=$(stat -c %s "$IN")
started=$(date +%s)
gpg --decrypt --batch --quiet --pinentry-mode loopback --passphrase-fd 3 "$IN" 3<<<"$BACKUP_PASSPHRASE" \
  | pg_restore --data-only --disable-triggers --no-owner --no-privileges \
      --exit-on-error -d "$DB_URL"
finished=$(date +%s)
echo "restore: ${bytes} bytes restored in $((finished - started)) seconds"
