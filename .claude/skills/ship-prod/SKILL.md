---
name: ship-prod
description: Build and deploy the Argus ITSM frontend to production (host wecrew-prod, k3s, in-cluster kaniko), or touch its k8s manifests. Use before any image build, `kubectl set image`, manifest apply, or namespace cutover.
---

# Shipping the frontend to production

Production is host `wecrew-prod`, **k3s** — not the `kind-wecrew` cluster the parent `/root/CLAUDE.md`
describes. There is no docker on the host; use `KUBECONFIG=~/.kube/config` (the default k3s config is
root-only). Serves `itsm.`, `incident.` and `alert.wecrew.in`. No Argo CD app owns these namespaces.

## Which namespace is live

**Two manifest sets, mid-migration.** `k8s/wecrew-itsm/` (number-prefixed, with its own `README.md`) is
the new production home — namespace `wecrew-itsm`, generated 2026-09-19 from the *live* objects, full
stack (Postgres, Redis, one-shot `db-init` Job instead of `prisma db push` on every start,
`bootstrap-admins.js` instead of the demo seed). As of 2026-09-19 its Deployments are up but the old
`itsm-wecrew` Ingress still claims every host — the README's step 6 cutover hasn't happened. Before
deploying, check who owns the hosts (`kubectl get ingress -A | grep itsm`) and target that namespace; once
cut over, `itsm-wecrew` and the top-level `k8s/*.yml` files below are dead.

Top-level `k8s/*.yml` are the older manifests for namespace `itsm-wecrew` (all resources still named
`linkedeye-*`): `linkedeye-frontend` Deployment + Service (image
`harbor.wecrew.in/linkedeye/argus-itsm-frontend:<date-tag>`, pull secret `harbor-linkedeye-pull` created
imperatively), an Ingress for `itsm.wecrew.in` (`/api`, `/socket.io`, `/health` → `linkedeye-api:5000`,
`/` → frontend) and `itsm.api.wecrew.in` (all → API), plus API-side pieces this repo doesn't build: a
placeholder `linkedeye-api` Service, an HPA for it, a Postgres backup CronJob, and ingress-only
NetworkPolicies keyed on `app:` labels. The Ingress uses ClusterIssuer `letsencrypt-prod-dns01`; check
that name against the cluster's issuers before applying.

## Before building: diff the live bundle

Compare `kubectl exec … ls /usr/share/nginx/html/assets` against local `dist/assets` — Vite names are
content hashes. Prod was previously built from a diverged non-git copy (`~/argus-itsm/frontend-react`, plus
`backend/` and `k8s/` beside it — archived 2026-09-19 to
`~/archive/argus-itsm-2026-09-19-frontend-react-backend-k8s.tgz` and removed). This repo is now the only
frontend source; the live API image may still have been built from that archived `backend/`. If the
bundles diverge in ways this repo doesn't explain, ask which tree wins before shipping.

## Build and roll out

Images are built **in-cluster with kaniko** in namespace `linkedeye-build`:

1. Stage the source (minus `node_modules`, `dist`, `.git`) onto a fresh `local-path` PVC via a
   `busybox:1.36` pod — `kubectl cp` + md5 check (piping into `kubectl exec -i` truncated).
2. Run `gcr.io/kaniko-project/executor:v1.23.2` with secret `harbor-linkedeye-push` mounted as
   `/kaniko/.docker/config.json`.
3. `kubectl -n <live ns> set image deploy/linkedeye-frontend frontend=<tag>` (same Deployment/container
   name in both namespaces), and bump the tag in whichever manifest set is live
   (`k8s/wecrew-itsm/45-frontend.yaml` or `k8s/frontend-deployment.yml`).
