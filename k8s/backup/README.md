# Database backup and restore

The nightly dump used to be written **only** to a PersistentVolume on the same
node as the database: one lost node lost both. These pieces add an off-site
copy and a weekly proof that it restores.

| Piece | What it does |
| --- | --- |
| `Dockerfile` | postgres client + `mc` (S3-compatible client) + `openssl` |
| `backup.sh` | dump → gzip → local PVC (30 days) → off-site bucket (90 days) |
| `verify-restore.sh` | weekly: pull the newest object, restore into a scratch database, check core tables, drop it |
| `restore.sh` | manual restore into a new database (never overwrites the live one by default) |

## Off-site is optional until configured

With no `OFFSITE_*` values the nightly job still dumps locally, logs loudly
that there is no off-site copy, and exits 0. Create the secret to turn it on —
works with AWS S3, Backblaze B2, DigitalOcean Spaces, Wasabi, or MinIO:

```bash
kubectl -n <ns> create secret generic db-backup-offsite \
  --from-literal=OFFSITE_ENDPOINT=https://s3.ap-south-1.amazonaws.com \
  --from-literal=OFFSITE_BUCKET=wecrew-itsm-backups \
  --from-literal=OFFSITE_PREFIX=wecrew-itsm \
  --from-literal=OFFSITE_ACCESS_KEY=... \
  --from-literal=OFFSITE_SECRET_KEY=... \
  --from-literal=BACKUP_ENCRYPTION_PASSPHRASE=...   # optional but recommended
```

Use a bucket-scoped key (put/get/list/delete on this prefix only), turn on
versioning, and keep the passphrase somewhere other than this cluster — a dump
holds every customer's data, and an encrypted backup is unrecoverable without it.

## Restoring

```bash
kubectl -n <ns> run restore --rm -it --restart=Never \
  --image=harbor.wecrew.in/linkedeye/argus-itsm-dbbackup:<tag> \
  --overrides='{"spec":{"containers":[{"name":"restore","image":"...","command":["restore.sh","wecrew_20260919_203000.sql.gz"],"envFrom":[{"secretRef":{"name":"linkedeye-secrets"}},{"secretRef":{"name":"db-backup-offsite"}}]}]}}'
```

It restores into `restore_<timestamp>`, prints the name and leaves the live
database untouched. Check the data, then point `DATABASE_URL` at it.
