# ═══════════════════════════════════════════════════════════
# WeCrew ITSM — database backup runner
#
# postgres client (pg_dump/psql/pg_isready) + aws-cli, which speaks to any
# S3-compatible endpoint (AWS, Backblaze B2, Spaces, Wasabi, MinIO) via
# --endpoint-url + openssl for optional at-rest encryption.
# ═══════════════════════════════════════════════════════════
FROM postgres:16-alpine
RUN apk add --no-cache bash aws-cli openssl ca-certificates
COPY lib.sh backup.sh restore.sh verify-restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/verify-restore.sh
ENTRYPOINT ["/usr/local/bin/backup.sh"]
