# Shared helpers for the backup/restore scripts. Sourced, never run directly.
# Off-site is OPTIONAL: with no OFFSITE_* values the scripts still keep local
# dumps and exit 0, so the cluster keeps backing up before credentials exist.

set -euo pipefail

# Prisma URLs carry ?schema=public — libpq/pg_dump reject it.
db_url() { printf '%s' "${DATABASE_URL%%\?*}"; }

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# A pod's network policy rules are programmed a moment AFTER it starts, so the
# first connection from a fresh pod is dropped. Every entry point waits.
wait_for_db() {
  local url i
  url="$(db_url)"
  for i in $(seq 1 40); do
    pg_isready -d "$url" >/dev/null 2>&1 && { log "database reachable"; return 0; }
    sleep 2
  done
  log "FAIL: database not reachable after 80s"
  return 1
}

offsite_configured() {
  [ -n "${OFFSITE_ENDPOINT:-}" ] && [ -n "${OFFSITE_BUCKET:-}" ] \
    && [ -n "${OFFSITE_ACCESS_KEY:-}" ] && [ -n "${OFFSITE_SECRET_KEY:-}" ]
}

# aws-cli reads credentials from the environment; the endpoint is passed per
# call so any S3-compatible provider works. Nothing lands on the command line.
s3() {
  AWS_ACCESS_KEY_ID="$OFFSITE_ACCESS_KEY" \
  AWS_SECRET_ACCESS_KEY="$OFFSITE_SECRET_KEY" \
  AWS_DEFAULT_REGION="${OFFSITE_REGION:-us-east-1}" \
  aws --endpoint-url "$OFFSITE_ENDPOINT" s3 "$@"
}

offsite_path() { printf 's3://%s/%s' "$OFFSITE_BUCKET" "${OFFSITE_PREFIX:-wecrew-itsm}"; }

# Encryption is optional but recommended: a dump holds every customer's data.
encrypt_if_configured() { # <plain file> → prints the file to upload
  local f="$1"
  if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
      -in "$f" -out "${f}.enc" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
    rm -f "$f"
    printf '%s' "${f}.enc"
  else
    printf '%s' "$f"
  fi
}
