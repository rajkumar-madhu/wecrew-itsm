#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Weekly proof that the newest OFF-SITE backup actually restores.
#
# Pulls the latest object, restores it into a scratch database on the same
# server, checks core tables have rows, then drops the scratch database.
# An unverified backup is not a backup; this job is the verification.
# ═══════════════════════════════════════════════════════════
. /usr/local/bin/lib.sh

offsite_configured || { log "off-site not configured — nothing to verify"; exit 0; }
SRC="$(offsite_path)"

LATEST="$(s3 ls "${SRC}/" | awk '{print $4}' | grep -E '^wecrew_.*\.sql\.gz(\.enc)?$' | sort | tail -1)"
[ -n "$LATEST" ] || { log "FAIL: no backup objects found off-site"; exit 1; }
log "verifying ${LATEST}"

WORK=/tmp/verify; rm -rf "$WORK"; mkdir -p "$WORK"
s3 cp --only-show-errors "${SRC}/${LATEST}" "${WORK}/${LATEST}"

DUMP="${WORK}/${LATEST}"
case "$LATEST" in
  *.enc)
    [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ] || { log "FAIL: object is encrypted but no passphrase is set"; exit 1; }
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$DUMP" -out "${DUMP%.enc}" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
    DUMP="${DUMP%.enc}" ;;
esac

DB_URL="$(db_url)"
wait_for_db
SCRATCH="verify_restore_$(date -u +%Y%m%d%H%M%S)"
ADMIN_URL="$(printf '%s' "$DB_URL" | sed -E 's#/[^/?]+$#/postgres#')"

log "restoring into scratch database ${SCRATCH}"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${SCRATCH}\";"
trap 'psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS \"'"${SCRATCH}"'\";" >/dev/null 2>&1 || true' EXIT

SCRATCH_URL="$(printf '%s' "$DB_URL" | sed -E "s#/[^/?]+\$#/${SCRATCH}#")"
gunzip -c "$DUMP" | psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -q

for t in "User" "Organization" "Incident"; do
  n="$(psql "$SCRATCH_URL" -tAc "SELECT count(*) FROM \"${t}\";")" || { log "FAIL: table ${t} missing"; exit 1; }
  log "restored ${t}: ${n} row(s)"
  [ "$t" = "User" ] && [ "$n" -lt 1 ] && { log "FAIL: no users in the restored database"; exit 1; }
done

log "RESTORE VERIFIED from ${LATEST}"
