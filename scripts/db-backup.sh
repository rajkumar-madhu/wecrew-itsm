#!/bin/bash
# ═══════════════════════════════════════════════════════════
# WeCrew ITSM — Database Backup Script
# Compatible with Kubernetes CronJob and standalone execution
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ──
BACKUP_DIR="${BACKUP_DIR:-/backups}"
S3_BUCKET="${S3_BUCKET:-linkedeye-backups}"
S3_ENDPOINT="${S3_ENDPOINT:-}"  # e.g., http://minio:9000 for MinIO
DAILY_RETENTION="${DAILY_RETENTION:-30}"
WEEKLY_RETENTION="${WEEKLY_RETENTION:-4}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"

# ── Parse DATABASE_URL ──
# Format: postgresql://user:password@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\(.*\):\([0-9]*\)/.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@\(.*\):\([0-9]*\)/.*|\2|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\(.*\):.*@.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\(.*\)@.*|\1|p')

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
BACKUP_FILE="linkedeye_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# ── Functions ──
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

send_slack() {
  local status="$1"
  local message="$2"
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    local color="good"
    local emoji=":white_check_mark:"
    if [ "$status" = "failure" ]; then
      color="danger"
      emoji=":x:"
    fi
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{
        \"attachments\": [{
          \"color\": \"${color}\",
          \"text\": \"${emoji} *WeCrew DB Backup* — ${message}\",
          \"footer\": \"WeCrew ITSM | $(hostname)\",
          \"ts\": $(date +%s)
        }]
      }" > /dev/null 2>&1 || true
  fi
}

upload_to_s3() {
  local file="$1"
  local key="daily/${BACKUP_FILE}"

  if [ -n "$S3_ENDPOINT" ]; then
    # MinIO / S3-compatible
    aws s3 cp "$file" "s3://${S3_BUCKET}/${key}" \
      --endpoint-url "$S3_ENDPOINT" \
      --no-verify-ssl 2>/dev/null || true
  elif command -v aws &> /dev/null; then
    aws s3 cp "$file" "s3://${S3_BUCKET}/${key}" 2>/dev/null || true
  fi

  # Weekly backup copy (Sundays)
  if [ "$DAY_OF_WEEK" = "7" ]; then
    local weekly_key="weekly/linkedeye_week_$(date +%Y_%W).sql.gz"
    if [ -n "$S3_ENDPOINT" ]; then
      aws s3 cp "$file" "s3://${S3_BUCKET}/${weekly_key}" \
        --endpoint-url "$S3_ENDPOINT" \
        --no-verify-ssl 2>/dev/null || true
    elif command -v aws &> /dev/null; then
      aws s3 cp "$file" "s3://${S3_BUCKET}/${weekly_key}" 2>/dev/null || true
    fi
  fi
}

cleanup_old_backups() {
  log "Cleaning up old backups..."

  # Local: retain last N daily backups
  if [ -d "$BACKUP_DIR" ]; then
    local count
    count=$(ls -1 "${BACKUP_DIR}"/linkedeye_*.sql.gz 2>/dev/null | wc -l)
    if [ "$count" -gt "$DAILY_RETENTION" ]; then
      ls -t "${BACKUP_DIR}"/linkedeye_*.sql.gz | tail -n +$((DAILY_RETENTION + 1)) | xargs -r rm
      log "Removed $((count - DAILY_RETENTION)) old local backups"
    fi
  fi

  # S3: retain last N daily + M weekly
  if command -v aws &> /dev/null; then
    local s3_opts=""
    [ -n "$S3_ENDPOINT" ] && s3_opts="--endpoint-url $S3_ENDPOINT --no-verify-ssl"

    # Clean daily
    aws s3 ls "s3://${S3_BUCKET}/daily/" $s3_opts 2>/dev/null \
      | sort -r | tail -n +$((DAILY_RETENTION + 1)) \
      | awk '{print $4}' \
      | while read -r f; do
          aws s3 rm "s3://${S3_BUCKET}/daily/${f}" $s3_opts 2>/dev/null || true
        done

    # Clean weekly
    aws s3 ls "s3://${S3_BUCKET}/weekly/" $s3_opts 2>/dev/null \
      | sort -r | tail -n +$((WEEKLY_RETENTION + 1)) \
      | awk '{print $4}' \
      | while read -r f; do
          aws s3 rm "s3://${S3_BUCKET}/weekly/${f}" $s3_opts 2>/dev/null || true
        done
  fi
}

# ── Main ──
log "Starting WeCrew database backup..."
log "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"

mkdir -p "$BACKUP_DIR"

START_TIME=$(date +%s)

# Run pg_dump with compression
export PGPASSWORD="$DB_PASS"
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl --clean --if-exists \
  | gzip > "$BACKUP_PATH"; then

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  FILE_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)

  log "Backup successful: ${BACKUP_FILE} (${FILE_SIZE}) in ${DURATION}s"

  # Upload to S3
  upload_to_s3 "$BACKUP_PATH"

  # Cleanup old backups
  cleanup_old_backups

  REMAINING=$(ls -1 "${BACKUP_DIR}"/linkedeye_*.sql.gz 2>/dev/null | wc -l)
  log "Done. ${REMAINING} local backups retained."

  send_slack "success" "Backup completed: \`${BACKUP_FILE}\` (${FILE_SIZE}) in ${DURATION}s"
else
  log "ERROR: Backup failed!"
  send_slack "failure" "Backup FAILED for database \`${DB_NAME}\`"
  exit 1
fi
