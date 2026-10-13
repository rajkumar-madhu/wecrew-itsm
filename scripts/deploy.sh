#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Argus ITSM — build and deploy to the wecrew kind cluster
#
# Run on the kind node from the repo root, on the commit you want live:
#   ./scripts/deploy.sh                # build, push, back up DB, migrate, roll out
#   ./scripts/deploy.sh --skip-build   # redeploy an already-pushed TAG
#   TAG=20261013-150ea1b ./scripts/deploy.sh --skip-build
#
# Steps: preflight → ensure MFA key → DB backup → build + push images →
# roll out API → schema sync check (prisma db push) → roll out frontend → health check.
# On any failure it prints the commands that put the previous images back.
# ═══════════════════════════════════════════════════════════
set -euo pipefail

NS="${NS:-linkedeye-core}"
REGISTRY="${REGISTRY:-harbor.wecrew.in/linkedeye}"
APP_SECRET="${APP_SECRET:-linkedeye-secrets}"
PG_POD="${PG_POD:-postgres-0}"
PG_USER="${PG_USER:-linkedeye}"
PG_DB="${PG_DB:-linkedeye}"
HEALTH_URL="${HEALTH_URL:-https://itsm.wecrew.in/health}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/argus-backups}"
SKIP_BUILD=false
SKIP_BACKUP=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --skip-backup) SKIP_BACKUP=true ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
TAG="${TAG:-$(date +%Y%m%d)-$(git rev-parse --short HEAD)}"
API_IMAGE="$REGISTRY/argus-itsm-api:$TAG"
FE_IMAGE="$REGISTRY/argus-itsm-frontend:$TAG"

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ── Preflight ───────────────────────────────────────────
step "Preflight"
command -v kubectl >/dev/null || die "kubectl not found"
$SKIP_BUILD || command -v nerdctl >/dev/null || die "nerdctl not found (or pass --skip-build)"
if ! $SKIP_BUILD && [ -n "$(git status --porcelain)" ]; then
  die "Working tree has uncommitted changes; commit or stash them so the image matches $TAG"
fi
kubectl -n "$NS" get deploy linkedeye-api linkedeye-frontend >/dev/null || die "Cannot see the deployments in namespace $NS"

PREV_API=$(kubectl -n "$NS" get deploy linkedeye-api -o jsonpath='{.spec.template.spec.containers[?(@.name=="api")].image}')
PREV_FE=$(kubectl -n "$NS" get deploy linkedeye-frontend -o jsonpath='{.spec.template.spec.containers[?(@.name=="frontend")].image}')
echo "Commit:   $(git log --oneline -1)"
echo "Deploying $TAG"
echo "Current:  $PREV_API"
echo "          $PREV_FE"

rollback_hint() {
  printf '\n\033[1;33mDeploy stopped. To put the previous images back:\033[0m\n'
  echo "  kubectl -n $NS set image deployment/linkedeye-api api=$PREV_API"
  echo "  kubectl -n $NS set image deployment/linkedeye-frontend frontend=$PREV_FE"
  [ -n "${BACKUP_FILE:-}" ] && echo "Database backup taken before this deploy: $BACKUP_FILE"
}
trap rollback_hint ERR

# ── MFA key (must exist before anyone enrols; never rotate it) ──
step "Checking MFA_ENCRYPTION_KEY in secret/$APP_SECRET"
if kubectl -n "$NS" get secret "$APP_SECRET" -o jsonpath='{.data.MFA_ENCRYPTION_KEY}' | grep -q .; then
  echo "Present."
else
  kubectl -n "$NS" patch secret "$APP_SECRET" -p "{\"stringData\":{\"MFA_ENCRYPTION_KEY\":\"$(openssl rand -hex 32)\"}}"
  echo "Created a new key. Keep it: changing it later invalidates every enrolled authenticator."
fi

# ── Database backup ─────────────────────────────────────
if $SKIP_BACKUP; then
  step "Skipping database backup (--skip-backup)"
else
  step "Backing up $PG_DB from pod/$PG_POD"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/argus-$PG_DB-$TAG-$(date +%H%M%S).sql.gz"
  kubectl -n "$NS" exec "$PG_POD" -- pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$BACKUP_FILE"
  [ -s "$BACKUP_FILE" ] || die "Backup is empty: $BACKUP_FILE"
  echo "Saved $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
fi

# ── Build and push ──────────────────────────────────────
if $SKIP_BUILD; then
  step "Skipping build (--skip-build), using $TAG"
else
  step "Building images"
  sudo nerdctl --namespace k8s.io build -t "$API_IMAGE" ./backend
  sudo nerdctl --namespace k8s.io build -t "$FE_IMAGE" ./frontend-react
  step "Pushing to $REGISTRY"
  sudo nerdctl --namespace k8s.io push "$API_IMAGE"
  sudo nerdctl --namespace k8s.io push "$FE_IMAGE"
fi

# ── API first, then schema, then UI ─────────────────────
# The new API tolerates the old schema only briefly, so migrate right after it is up.
step "Rolling out API"
kubectl -n "$NS" set image deployment/linkedeye-api api="$API_IMAGE"
kubectl -n "$NS" rollout status deployment/linkedeye-api --timeout=300s

# Production schema is managed with `prisma db push`: the API pod already runs it at
# start-up, but with errors hidden (`|| true`) and --accept-data-loss. Run it again
# here WITHOUT --accept-data-loss so a failing or destructive change stops the deploy
# with a visible error instead. It is a no-op when the schema is already in sync.
step "Syncing database schema (prisma db push, no data loss allowed)"
kubectl -n "$NS" exec deploy/linkedeye-api -- npx --no-install prisma db push --skip-generate

step "Rolling out frontend"
kubectl -n "$NS" set image deployment/linkedeye-frontend frontend="$FE_IMAGE"
kubectl -n "$NS" rollout status deployment/linkedeye-frontend --timeout=300s

# ── Smoke check ─────────────────────────────────────────
step "Health check $HEALTH_URL"
for i in 1 2 3 4 5 6; do
  if curl -fsS -m 10 "$HEALTH_URL" >/dev/null; then echo "Healthy."; break; fi
  [ "$i" = 6 ] && die "Health check failed after 6 tries"
  sleep 10
done

trap - ERR
printf '\n\033[1;32m✔ Deployed %s\033[0m\n' "$TAG"
echo "Check: /sla saves an edit · /requests and /catalog load · a Requester lands on /portal · Ctrl+K opens search"
echo "Rollback if needed:"
echo "  kubectl -n $NS set image deployment/linkedeye-api api=$PREV_API"
echo "  kubectl -n $NS set image deployment/linkedeye-frontend frontend=$PREV_FE"
