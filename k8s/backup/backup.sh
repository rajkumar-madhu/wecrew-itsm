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
# The glob must cover BOTH extensions. encrypt_if_configured replaces
# wecrew_*.sql.gz with wecrew_*.sql.gz.enc and deletes the plaintext, so a
# `*.sql.gz`-only glob pruned nothing at all once a passphrase was set and the
# 10Gi PVC grew without bound.
ls -t /backups/wecrew_*.sql.gz /backups/wecrew_*.sql.gz.enc 2>/dev/null \
  | tail -n +31 | while read -r old; do rm -f "$old" "${old}.sha256"; done

if ! offsite_configured; then
  log "OFF-SITE UPLOAD NOT CONFIGURED — this copy lives on the same node as the database."
  log "Set OFFSITE_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY (secret db-backup-offsite) to fix that."
  exit 0
fi

UPLOAD="$(encrypt_if_configured "$FILE")"
DEST="$(offsite_path)"

# Checksum the artifact that is actually uploaded. The dump was hashed before
# encryption, and encrypt_if_configured then deleted that plaintext — so the
# old sidecar described a file nobody could ever fetch and verify nothing.
if [ "$UPLOAD" != "$FILE" ]; then
  sha256sum "$UPLOAD" | tee "${UPLOAD}.sha256" >/dev/null
fi

log "uploading $(basename "$UPLOAD") to ${OFFSITE_BUCKET}/${OFFSITE_PREFIX:-wecrew-itsm}"
s3 cp --only-show-errors "$UPLOAD" "${DEST}/$(basename "$UPLOAD")"
[ -f "${UPLOAD}.sha256" ] && s3 cp --only-show-errors "${UPLOAD}.sha256" "${DEST}/$(basename "${UPLOAD}.sha256")" || true

# Off-site retention: drop objects older than the window (default 90 days).
#
# This image is postgres:16-alpine, so date(1) is busybox and does NOT accept
# GNU relative offsets ("-90 days"). That made CUTOFF empty and the guard below
# skipped expiry silently, forever. Compute the epoch ourselves and try the
# forms busybox, GNU and BSD each understand — then say so if none work.
RETENTION_DAYS="${OFFSITE_RETENTION_DAYS:-90}"
CUTOFF_EPOCH=$(( $(date -u +%s) - RETENTION_DAYS * 86400 ))
CUTOFF="$(date -u -d "@${CUTOFF_EPOCH}" +%Y-%m-%d 2>/dev/null \
       || date -u -r "${CUTOFF_EPOCH}" +%Y-%m-%d 2>/dev/null \
       || true)"

if [ -n "$CUTOFF" ]; then
  log "expiring off-site objects older than ${CUTOFF} (${RETENTION_DAYS}d)"
  s3 ls "${DEST}/" | awk -v cut="$CUTOFF" '$1 < cut && $4 != "" {print $4}' | while read -r old; do
    log "expiring ${old}"
    s3 rm --only-show-errors "${DEST}/${old}" || true
  done
else
  log "WARNING: date(1) in this image computes no retention cutoff — off-site objects are NOT being expired."
  log "WARNING: bucket growth is unbounded until this is fixed (add coreutils, or set a bucket lifecycle rule)."
fi

log "off-site copy complete"
