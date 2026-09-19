#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Manual restore. DESTRUCTIVE — it replaces the target database.
#
#   restore.sh <object-name|/backups/file.sql.gz> [target-db-name]
#
# With no target it restores into a NEW database named restore_<stamp> and
# prints the name; point the API at it only after checking the data.
# ═══════════════════════════════════════════════════════════
. /usr/local/bin/lib.sh

SRC_ARG="${1:-}"
[ -n "$SRC_ARG" ] || { echo "usage: restore.sh <object|/backups/file.sql.gz> [target-db]"; exit 2; }

WORK=/tmp/restore; rm -rf "$WORK"; mkdir -p "$WORK"
case "$SRC_ARG" in
  /*) DUMP="$SRC_ARG" ;;
  *)  offsite_configured || { log "off-site not configured and no local path given"; exit 1; }
      s3 cp --only-show-errors "$(offsite_path)/${SRC_ARG}" "${WORK}/${SRC_ARG}"; DUMP="${WORK}/${SRC_ARG}" ;;
esac

case "$DUMP" in
  *.enc)
    [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ] || { log "encrypted backup needs BACKUP_ENCRYPTION_PASSPHRASE"; exit 1; }
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$DUMP" -out "${DUMP%.enc}" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
    DUMP="${DUMP%.enc}" ;;
esac

DB_URL="$(db_url)"
wait_for_db
ADMIN_URL="$(printf '%s' "$DB_URL" | sed -E 's#/[^/?]+$#/postgres#')"
TARGET="${2:-restore_$(date -u +%Y%m%d%H%M%S)}"

log "restoring ${DUMP} into ${TARGET}"
if ! psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TARGET}\";" 2>/tmp/create.err; then
  grep -q "already exists" /tmp/create.err && log "database ${TARGET} exists — restoring into it" \
    || { log "cannot create ${TARGET}:"; cat /tmp/create.err; exit 1; }
fi
TARGET_URL="$(printf '%s' "$DB_URL" | sed -E "s#/[^/?]+\$#/${TARGET}#")"
gunzip -c "$DUMP" | psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q
log "restored into ${TARGET}; point DATABASE_URL at it once the data checks out"
