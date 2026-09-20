# wecrew-itsm namespace

Production home for Argus ITSM on host `wecrew-prod` (k3s), replacing `itsm-wecrew`.
Generated 2026-09-19 from the **live** `itsm-wecrew` objects (not the older files in `../`),
with cluster-assigned fields stripped. Serves `itsm.`, `incident.`, `alert.wecrew.in` and the
two `.api.` hosts. Starts with a **fresh database** — no data is migrated from `itsm-wecrew`.

Use `KUBECONFIG=~/.kube/config` (the default k3s config is root-only).

## What changed versus itsm-wecrew

- The API starts with `node src/server.js` only. The old `prisma db push --accept-data-loss`
  on every pod start (errors discarded) is gone; the schema is created once by `30-db-init.yaml`.
- `prisma/seed.js` is **not** used: it creates 10 demo users sharing a password that is in git.

## Order

1. **Privileged prerequisites** (done by an operator, not in these files because they grant
   permissions or carry credentials): create the namespace and ServiceAccount, add
   `ServiceAccount wecrew-itsm/linkedeye-k8s-viewer` as a subject of ClusterRoleBinding
   `linkedeye-k8s-viewer`, and copy Secrets `linkedeye-secrets`, `postgres-secret`,
   `harbor-linkedeye-pull`, `incident-wecrew-tls` from `itsm-wecrew`.
2. `kubectl apply -f 00-namespace.yaml -f 10-config.yaml -f 20-postgres.yaml -f 25-redis.yaml -f 50-networkpolicy.yaml`
3. `kubectl apply -f 30-db-init.yaml` and wait for `job/linkedeye-db-init` to complete.
4. **First admins** (operator-run; it grants access): once the API is up,
   `kubectl -n wecrew-itsm exec -i deploy/linkedeye-api -- node - < bootstrap-admins.js` recreates
   the WeCrew org and the two ADMINs from `itsm-wecrew` with new random passwords, printed once.
   It refuses to run on a non-empty database. Never commit its output.
5. `kubectl apply -f 40-api.yaml -f 45-frontend.yaml -f 60-backup.yaml`
6. **Cutover**: delete Ingress `linkedeye-itsm-ingress` in `itsm-wecrew`, then
   `kubectl apply -f 90-ingress.yaml` (two ingresses cannot claim the same hosts).
   TLS is served immediately from the copied `incident-wecrew-tls`; cert-manager renews it here.
7. Verify all five hosts, then delete namespace `itsm-wecrew` and remove its subject from the
   ClusterRoleBinding.

## After the move

Re-enter the integrations (15 existed in `itsm-wecrew`) in the Integration Hub. Backups are still
written to a node-local volume; see Bet 2 in the gap-workshop kit.
