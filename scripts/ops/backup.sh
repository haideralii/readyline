#!/usr/bin/env bash
# The weekly backup (REQ-030 FR-2, D-2866, D-2876): a data dump of every
# table in `public` and of `auth.users`, piped straight into gpg's symmetric
# AES-256 under the passphrase, never written to disk in clear; then the
# size, the duration, and one audit_log row `jobs.backup.ran` over the same
# database URL (so the switchboard's row is a database read). Nothing here
# prints a value: the URL and the passphrase are masked by the workflow and
# read from the environment only.
#
#   DB_URL=postgresql://... BACKUP_PASSPHRASE=... OUT=readyline-2026-10-18.sql.gpg scripts/ops/backup.sh
#
# Options (environment): MAX_BYTES, the size above which the run fails
# (default 200 MB, the Dev response's answer 3); SKIP_AUDIT=1 for the CI
# rehearsal, which writes no audit row.
set -euo pipefail

: "${DB_URL:?DB_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
OUT="${OUT:-readyline-$(date -u +%Y-%m-%d).sql.gpg}"
MAX_BYTES="${MAX_BYTES:-209715200}"

if [ "${#BACKUP_PASSPHRASE}" -lt 24 ]; then
  echo "FAIL the passphrase is shorter than 24 characters (D-2876)" >&2
  exit 2
fi

started=$(date +%s)
# Data only: the schema comes from the migrations on a restore (restore-rehearsal.sh applies
# them first), so the copy carries rows, not objects, and restores onto any migrated stack.
# `-t 'public.*'` selects every table in public; `-t auth.users` adds the sign-in users.
pg_dump "$DB_URL" -Fc --data-only --no-owner --no-privileges \
  -t 'public.*' -t 'auth.users' \
  | gpg --symmetric --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
      --cipher-algo AES256 -o "$OUT" 3<<<"$BACKUP_PASSPHRASE"
finished=$(date +%s)

bytes=$(stat -c %s "$OUT")
seconds=$((finished - started))
if [ "$bytes" -gt "$MAX_BYTES" ]; then
  echo "FAIL the encrypted dump is ${bytes} bytes, over the ${MAX_BYTES}-byte limit; raise MAX_BYTES only after a look at what grew" >&2
  exit 1
fi
if [ "$bytes" -lt 512 ]; then
  echo "FAIL the encrypted dump is only ${bytes} bytes; pg_dump wrote nothing" >&2
  exit 1
fi
echo "backup: ${bytes} bytes in ${seconds} seconds -> ${OUT}"

if [ "${SKIP_AUDIT:-0}" != "1" ]; then
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c \
    "insert into public.audit_log (account_id, actor_user_id, action, target) values (null, null, 'jobs.backup.ran', 'bytes=${bytes} seconds=${seconds}')"
  echo "audit: jobs.backup.ran recorded"
fi
