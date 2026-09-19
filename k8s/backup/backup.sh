#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Nightly dump → local PVC → off-site bucket.
#
# The local copy alone is not a backup: it lives on the same node as the
# database, so one lost node loses both. Off-site upload is what makes this
# a backup; it is skipped (exit 0, loud log) until OFFSITE_* is configured.
# ═══════════════════════════════════════════════════════════
. /usr/local/bin/lib.sh

DB_URL="$(db_url)"
wait_for_db

STAMP="$(date -u +%Y%m%d_%H%M%S)"
FILE="/backups/wecrew_${STAMP}.sql.gz"

log "dumping to ${FILE}"
pg_dump --no-owner --no-privileges "$DB_URL" | gzip -9 > "$FILE"
sha256sum "$FILE" | tee "${FILE}.sha256"
log "dump complete: $(du -h "$FILE" | cut -f1)"

# Local retention: keep 30 days for a fast restore.
ls -t /backups/wecrew_*.sql.gz 2>/dev/null | tail -n +31 | while read -r old; do rm -f "$old" "${old}.sha256"; done

if ! offsite_configured; then
  log "OFF-SITE UPLOAD NOT CONFIGURED — this copy lives on the same node as the database."
  log "Set OFFSITE_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY (secret db-backup-offsite) to fix that."
  exit 0
fi

UPLOAD="$(encrypt_if_configured "$FILE")"
DEST="$(offsite_path)"
log "uploading $(basename "$UPLOAD") to ${OFFSITE_BUCKET}/${OFFSITE_PREFIX:-wecrew-itsm}"
s3 cp --only-show-errors "$UPLOAD" "${DEST}/$(basename "$UPLOAD")"
[ -f "${FILE}.sha256" ] && s3 cp --only-show-errors "${FILE}.sha256" "${DEST}/$(basename "${FILE}.sha256")" || true

# Off-site retention: drop objects older than the window (default 90 days).
CUTOFF="$(date -u -d "-${OFFSITE_RETENTION_DAYS:-90} days" +%Y-%m-%d 2>/dev/null || true)"
if [ -n "$CUTOFF" ]; then
  s3 ls "${DEST}/" | awk -v cut="$CUTOFF" '$1 < cut && $4 != "" {print $4}' | while read -r old; do
    log "expiring ${old}"
    s3 rm --only-show-errors "${DEST}/${old}" || true
  done
fi

log "off-site copy complete"
