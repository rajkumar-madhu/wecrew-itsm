# Argus ITSM Platform — Disaster Recovery Runbook

**Document Title:** Argus ITSM Platform — Disaster Recovery Runbook
**Version:** 1.0
**Platform Version:** 2.0.0
**Date:** 2026-03-03
**Author:** Enterprise Documentation Team
**Classification:** CONFIDENTIAL
**Distribution:** Engineering, Operations, Incident Response Team

---

## Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-03-03 | Enterprise Doc Team | Initial release |

---

## Table of Contents

1. [Recovery Objectives](#1-recovery-objectives)
2. [System Architecture Summary](#2-system-architecture-summary)
3. [Tier Classification](#3-tier-classification)
4. [Failure Scenarios and Recovery](#4-failure-scenarios-and-recovery)
5. [Database Backup and Restore](#5-database-backup-and-restore)
6. [Kubernetes Recovery](#6-kubernetes-recovery)
7. [Communication Plan](#7-communication-plan)
8. [DR Testing Schedule](#8-dr-testing-schedule)
9. [Appendices](#9-appendices)

---

## 1. Recovery Objectives

### RPO/RTO Targets by Tier

| Tier | Components | RPO | RTO | Justification |
|------|-----------|-----|-----|---------------|
| **Tier 1 — Platform Core** | PostgreSQL, API pods, Frontend pods, Redis | 1 hour | 15 minutes | Direct user impact; SLA obligations (P1: 5min response) |
| **Tier 2 — Integration Layer** | SSH connectivity, Prometheus/Grafana links, Webhook endpoints, Socket.IO | 4 hours | 30 minutes | Monitoring data collection; alert pipeline |
| **Tier 3 — Analytics & AI** | Ollama/Qwen3-32B, Flowise, AgentPipeline, Reports | 24 hours | 2 hours | Non-critical; degraded mode acceptable |

---

## 2. System Architecture Summary

### Production Environment

| Component | Location | Details |
|-----------|----------|---------|
| **K8s Namespace** | `fs-linkedeye` | All platform pods |
| **PostgreSQL** | `postgres.fs-linkedeye:5432` (ClusterIP: 10.97.121.123) | Primary production database |
| **Dev PostgreSQL** | `localhost:5432` | Local development only — NOT production |
| **Redis** | `redis.fs-linkedeye:6379` | Sessions + caching; `redis:7-alpine`, maxmemory 512mb, allkeys-lru |
| **API Pods** | `linkedeye-api` deployment | 2-8 replicas (HPA: CPU 70%, Mem 80%) |
| **Frontend Pods** | `linkedeye-frontend` deployment | 2 replicas, nginx on port 80 |
| **Ingress** | `linkedeye-ingress` | NGINX Ingress, TLS via cert-manager (letsencrypt-prod) |
| **Production URL** | `https://fs-le-dev-inc.finspot.in` | |
| **SSH Key** | K8s Secret: `linkedeye-ssh-key` → `/home/finadmin/.ssh/` | Ed25519 key for remote access |
| **DB Backups** | CronJob: `linkedeye-db-backup` | Daily 2:00 AM IST, 30-day retention, 50Gi PVC |

### Background Services (Boot-time)

| Service | Interval | Impact if Down |
|---------|----------|----------------|
| SLA Compliance Checker | 60 seconds | SLA breach alerts delayed |
| Email Queue Processor | 5 minutes | Notification emails queued |
| Agent Pipeline | Event-driven | Auto-remediation disabled |

---

## 3. Tier Classification

### Tier 1 — Platform Core (RTO: 15 min)

- PostgreSQL 16 (production database)
- Express.js API server (linkedeye-api)
- React frontend (linkedeye-frontend)
- Redis 7 (session cache)
- NGINX Ingress controller
- JWT authentication system

### Tier 2 — Integration Layer (RTO: 30 min)

- SSH tunnels to 13 client organizations
- Prometheus/Grafana connectivity per org
- Webhook inbound endpoints (Alertmanager, Grafana, Slack, Twilio)
- Socket.IO real-time events
- PagerDuty Events API v2

### Tier 3 — Analytics & AI (RTO: 2 hr)

- Ollama (Qwen3-32B) AI engine
- Flowise workflow engine
- Agent Pipeline auto-remediation (8 actions)
- Report generation
- Voice IVR (Whisper STT + XTTS v2 on port 8100)

---

## 4. Failure Scenarios and Recovery

### 4.1 PostgreSQL Failure

**Symptoms:** API returns 500 errors, login fails, all CRUD operations fail.

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n fs-linkedeye -l app=postgres

# Check PostgreSQL logs
kubectl logs -n fs-linkedeye deployment/postgres --tail=100

# Test connectivity from API pod
kubectl exec -n fs-linkedeye deployment/linkedeye-api -- \
  node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.\$connect().then(() => console.log('OK')).catch(e => console.error(e))"
```

**Recovery:**
```bash
# Step 1: Restart PostgreSQL pod
kubectl rollout restart deployment/postgres -n fs-linkedeye

# Step 2: Wait for Ready
kubectl rollout status deployment/postgres -n fs-linkedeye --timeout=120s

# Step 3: Verify connectivity
kubectl exec -n fs-linkedeye deployment/linkedeye-api -- \
  node -e "require('./src/config/database').prisma.\$connect().then(() => console.log('DB OK'))"

# Step 4: If corrupt — restore from backup (see Section 5)
```

### 4.2 Redis Failure

**Symptoms:** Slow API responses, session loss, users logged out, rate limiter errors.

**Impact:** Redis uses `emptyDir` volume — data is ephemeral. Loss is acceptable (sessions regenerate, cache rebuilds).

**Diagnosis:**
```bash
kubectl get pods -n fs-linkedeye -l app=redis
kubectl exec -n fs-linkedeye deployment/redis -- redis-cli ping
kubectl exec -n fs-linkedeye deployment/redis -- redis-cli info memory
```

**Recovery:**
```bash
# Step 1: Restart Redis
kubectl rollout restart deployment/redis -n fs-linkedeye

# Step 2: Verify
kubectl exec -n fs-linkedeye deployment/redis -- redis-cli ping
# Expected: PONG

# Step 3: API pods will auto-reconnect (ioredis has built-in retry)
# No manual intervention needed for API pods
```

### 4.3 API Pod Failure

**Symptoms:** 502/503 errors from ingress, WebSocket disconnections, webhook delivery fails.

**Diagnosis:**
```bash
kubectl get pods -n fs-linkedeye -l app=linkedeye-api
kubectl describe pod -n fs-linkedeye -l app=linkedeye-api
kubectl logs -n fs-linkedeye deployment/linkedeye-api --tail=200

# Check health endpoint
kubectl exec -n fs-linkedeye deployment/linkedeye-frontend -- \
  curl -s http://linkedeye-api:5000/health
```

**Recovery:**
```bash
# Step 1: Restart deployment
kubectl rollout restart deployment/linkedeye-api -n fs-linkedeye

# Step 2: If bad image — rollback
kubectl rollout undo deployment/linkedeye-api -n fs-linkedeye

# Step 3: Verify health
kubectl rollout status deployment/linkedeye-api -n fs-linkedeye --timeout=120s

# Step 4: Check HPA is functioning
kubectl get hpa -n fs-linkedeye linkedeye-api-hpa
```

### 4.4 Frontend Pod Failure

**Symptoms:** Users see blank page or NGINX 503, static assets fail to load.

**Diagnosis:**
```bash
kubectl get pods -n fs-linkedeye -l app=linkedeye-frontend
kubectl logs -n fs-linkedeye deployment/linkedeye-frontend --tail=50
```

**Recovery:**
```bash
# Step 1: Restart
kubectl rollout restart deployment/linkedeye-frontend -n fs-linkedeye

# Step 2: If bad build — rollback to previous image
kubectl rollout undo deployment/linkedeye-frontend -n fs-linkedeye

# Step 3: Manual deploy known-good version
sudo nerdctl --namespace k8s.io build --no-cache -t linkedeye/frontend:vN ./frontend-react
sudo kubectl set image deployment/linkedeye-frontend frontend=linkedeye/frontend:vN -n fs-linkedeye
```

### 4.5 SSH Key Compromise

**Symptoms:** Remote K8s/Prometheus access fails across all/some orgs. Suspicious login attempts in auth logs.

**Impact:** CRITICAL — SSH key provides access to all 13 client K8s clusters.

**Immediate Actions:**
```bash
# Step 1: Revoke compromised key on ALL 13 servers
for server in "180.179.253.162:2233" "206.1.32.216:3311" "103.231.42.57:2233" \
  "49.249.139.196:2233" "103.231.79.231:2233" "103.231.79.170:2233" \
  "142.79.253.74:2233" "124.153.73.235:2233" "202.87.54.194:5522" \
  "49.249.139.195:2233" "154.210.170.126:4422" "206.1.27.194:2233" \
  "182.76.252.237:4427"; do
  IP=$(echo $server | cut -d: -f1)
  PORT=$(echo $server | cut -d: -f2)
  echo "Revoking on $IP:$PORT..."
  # Remove the compromised key from authorized_keys (manual step per server)
done

# Step 2: Generate new Ed25519 key pair
ssh-keygen -t ed25519 -f /tmp/new-linkedeye-key -N ""

# Step 3: Deploy new key to all servers (requires out-of-band access)
# For each server: append /tmp/new-linkedeye-key.pub to ~/.ssh/authorized_keys

# Step 4: Update K8s secret
kubectl create secret generic linkedeye-ssh-key \
  --from-file=id_ed25519=/tmp/new-linkedeye-key \
  --from-file=id_ed25519.pub=/tmp/new-linkedeye-key.pub \
  -n fs-linkedeye --dry-run=client -o yaml | kubectl apply -f -

# Step 5: Restart API pods to pick up new key
kubectl rollout restart deployment/linkedeye-api -n fs-linkedeye

# Step 6: Verify connectivity to each server
for server in ...; do
  kubectl exec -n fs-linkedeye deployment/linkedeye-api -- \
    ssh -p $PORT -i /home/finadmin/.ssh/id_ed25519 -o ConnectTimeout=5 finadmin@$IP "hostname"
done
```

### 4.6 K8s Cluster Failure (Platform Cluster)

**Symptoms:** All services unreachable, kubectl commands fail.

**Recovery:**
```bash
# Step 1: Check kubelet status
sudo systemctl status kubelet

# Step 2: Restart kubelet if needed
sudo systemctl restart kubelet

# Step 3: Check etcd health
sudo kubectl get cs  # component status

# Step 4: Verify all platform pods recover
kubectl get pods -n fs-linkedeye -w  # watch for recovery

# Step 5: If cluster unrecoverable — full rebuild from manifests
kubectl apply -f k8s/base/  # Apply all manifests
# Then restore PostgreSQL from backup (Section 5)
```

### 4.7 DNS/Ingress Failure

**Symptoms:** `https://fs-le-dev-inc.finspot.in` unreachable, DNS resolution fails, TLS errors.

**Diagnosis:**
```bash
# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl get ingress -n fs-linkedeye

# Check TLS certificate
kubectl get certificate -n fs-linkedeye
kubectl describe certificate linkedeye-tls -n fs-linkedeye

# Test internal connectivity (bypass ingress)
kubectl port-forward -n fs-linkedeye svc/linkedeye-api 5000:5000
curl http://localhost:5000/health
```

**Recovery:**
```bash
# Step 1: Restart ingress controller
kubectl rollout restart deployment/ingress-nginx-controller -n ingress-nginx

# Step 2: Force TLS cert renewal
kubectl delete certificate linkedeye-tls -n fs-linkedeye
# cert-manager will auto-recreate from Ingress annotation

# Step 3: Verify ingress rules
kubectl describe ingress linkedeye-ingress -n fs-linkedeye
```

### 4.8 Client Org Connectivity Loss

**Symptoms:** K8s Dashboard shows "Connection failed" for specific org, alerts stop flowing, Prometheus metrics stale.

**Diagnosis:**
```bash
# Test SSH to specific org (from API pod)
kubectl exec -n fs-linkedeye deployment/linkedeye-api -- \
  ssh -p <PORT> -i /home/finadmin/.ssh/id_ed25519 -o ConnectTimeout=8 <USER>@<IP> "hostname"

# Test Prometheus on remote server
kubectl exec -n fs-linkedeye deployment/linkedeye-api -- \
  ssh -p <PORT> -i /home/finadmin/.ssh/id_ed25519 <USER>@<IP> \
  "curl -s http://localhost:30000/api/v1/query?query=up | head -c 200"
```

**Recovery:**
```bash
# Step 1: Check if remote server is reachable
ping <SERVER_IP>
telnet <SERVER_IP> <SSH_PORT>

# Step 2: If SSH works but Prometheus down — restart on remote
kubectl exec -n fs-linkedeye deployment/linkedeye-api -- \
  ssh -p <PORT> <USER>@<IP> "kubectl rollout restart deployment/prometheus -n monitoring"

# Step 3: If firewall change — contact client NOC
# Verify port <SSH_PORT> is open from Argus platform IP

# Step 4: Update Integration record if IP changed
# PATCH /api/v1/integrations/:id with new serverIp
```

---

## 5. Database Backup and Restore

### Automated Backups

The `linkedeye-db-backup` CronJob runs daily at **2:00 AM IST** (UTC: 20:30):
- Image: `postgres:16-alpine`
- Command: `pg_dump | gzip` → `/backups/linkedeye_YYYYMMDD_HHMMSS.sql.gz`
- Retention: 30 daily backups (auto-pruned)
- Storage: 50Gi PVC (`linkedeye-db-backups`, storageClass: `nfs-client`)

### Manual Backup

```bash
# From any machine with psql access to production DB
kubectl exec -n fs-linkedeye deployment/postgres -- \
  pg_dump -U linkedeye linkedeye | gzip > /tmp/linkedeye_manual_$(date +%Y%m%d_%H%M%S).sql.gz

# Or via CronJob trigger
kubectl create job --from=cronjob/linkedeye-db-backup manual-backup-$(date +%s) -n fs-linkedeye
```

### Restore Procedure

```bash
# Step 1: Scale down API to prevent writes
kubectl scale deployment/linkedeye-api --replicas=0 -n fs-linkedeye

# Step 2: Identify backup file
kubectl exec -n fs-linkedeye deployment/postgres -- ls -lh /backups/

# Step 3: Restore
kubectl exec -n fs-linkedeye deployment/postgres -- bash -c \
  "gunzip -c /backups/linkedeye_20260303_020030.sql.gz | psql -U linkedeye linkedeye"

# Step 4: Run pending migrations
kubectl exec -n fs-linkedeye deployment/linkedeye-api -- npx prisma migrate deploy

# Step 5: Scale API back up
kubectl scale deployment/linkedeye-api --replicas=2 -n fs-linkedeye

# Step 6: Verify data integrity
curl -s https://fs-le-dev-inc.finspot.in/health
curl -s https://fs-le-dev-inc.finspot.in/api/v1/dashboard/stats -H "Authorization: Bearer <TOKEN>"
```

---

## 6. Kubernetes Recovery

### Pod Recovery Checklist

```bash
# Check all pods
kubectl get pods -n fs-linkedeye -o wide

# Check events for errors
kubectl get events -n fs-linkedeye --sort-by='.lastTimestamp' | tail -20

# Describe failing pod
kubectl describe pod <POD_NAME> -n fs-linkedeye

# Common fixes
kubectl rollout restart deployment/<NAME> -n fs-linkedeye  # Restart
kubectl rollout undo deployment/<NAME> -n fs-linkedeye     # Rollback
```

### Full Namespace Recovery

```bash
# Apply all base manifests
kubectl apply -f k8s/base/

# Verify all deployments
kubectl get deployments -n fs-linkedeye

# Check services
kubectl get svc -n fs-linkedeye

# Verify ingress
kubectl get ingress -n fs-linkedeye

# Restore database from backup (see Section 5)
# Re-create secrets if needed
kubectl get secrets -n fs-linkedeye
```

### Image Rollback

```bash
# View deployment history
kubectl rollout history deployment/linkedeye-api -n fs-linkedeye

# Rollback to specific revision
kubectl rollout undo deployment/linkedeye-api --to-revision=<N> -n fs-linkedeye

# Or set specific known-good image
kubectl set image deployment/linkedeye-api api=linkedeye/api:v55 -n fs-linkedeye
kubectl set image deployment/linkedeye-frontend frontend=linkedeye/frontend:v72 -n fs-linkedeye
```

---

## 7. Communication Plan

### Internal Escalation Matrix

| Severity | First Responder | Escalation (15 min) | Escalation (30 min) |
|----------|----------------|---------------------|---------------------|
| **SEV-1** (Platform down) | On-call Engineer | Engineering Manager | CTO / VP Engineering |
| **SEV-2** (Major feature degraded) | On-call Engineer | Engineering Manager | — |
| **SEV-3** (Minor issue) | On-call Engineer | — | — |

### Client Notification Templates

**SEV-1 — Initial Notification:**
```
Subject: [Argus ITSM] Service Disruption — Investigation in Progress

Dear <CLIENT_NAME> Team,

We are currently investigating a service disruption affecting the Argus ITSM platform.
Impact: <DESCRIPTION>
Start time: <TIMESTAMP> IST
Current status: Under investigation

We will provide updates every 15 minutes until resolution.

— Argus Operations Team
```

**SEV-1 — Resolution:**
```
Subject: [Argus ITSM] Service Restored — Incident Resolved

Dear <CLIENT_NAME> Team,

The service disruption reported at <START_TIME> IST has been resolved.
Root cause: <BRIEF_RCA>
Resolution: <WHAT_WAS_DONE>
Duration: <DURATION>

A full post-incident review will be shared within 48 hours.

— Argus Operations Team
```

---

## 8. DR Testing Schedule

| Test | Frequency | Procedure | Success Criteria |
|------|-----------|-----------|-----------------|
| **Database restore** | Monthly | Restore latest backup to staging DB; verify record counts | All tables populated, counts within 1% of production |
| **Pod restart** | Weekly | Rolling restart of all deployments | Zero-downtime restart, health checks pass |
| **Image rollback** | Monthly | Deploy previous version, verify functionality | Login + CRUD operations work |
| **SSH connectivity** | Weekly | Test SSH to all 13 servers from API pod | All 13 connections succeed within 8s timeout |
| **Full DR simulation** | Quarterly | Simulate complete namespace loss; rebuild from manifests + backup | Platform operational within RTO targets |
| **Certificate renewal** | Monthly | Force-delete TLS certificate; verify auto-renewal | New cert issued within 5 minutes |

---

## 9. Appendices

### Appendix A — SSH Server Reference

| Organization | Server IP | SSH Port | SSH User |
|-------------|-----------|----------|----------|
| fs-blr-indmoney-dr-le | 180.179.253.162 | 2233 | finadmin |
| fs-dr-le | 206.1.32.216 | 3311 | finadmin |
| fs-dx-le | 103.231.42.57 | 2233 | leprod |
| fs-ifsc-le | 49.249.139.196 | 2233 | finadmin |
| fs-le-isv | 103.231.79.231 | 2233 | finadmin |
| fs-le-uat | 103.231.79.170 | 2233 | finadmin |
| fs-mum-indmoney-prod-le | 142.79.253.74 | 2233 | finadmin |
| fs-w2w-le | 124.153.73.235 | 2233 | finadmin |
| ftc-mum-finspot-le | 202.87.54.194 | 5522 | finadmin |
| indmoney-ifsc-le | 49.249.139.195 | 2233 | finadmin |
| lemonn-le | 154.210.170.126 | 4422 | finadmin |
| neo-prod-le | 206.1.27.194 | 2233 | finadmin |
| pl-prod-le | 182.76.252.237 | 4427 | finadmin |

### Appendix B — K8s Resources Inventory

| Resource | Name | Namespace | Replicas | Notes |
|----------|------|-----------|----------|-------|
| Deployment | linkedeye-api | fs-linkedeye | 2-8 (HPA) | Port 5000, openssh-client installed |
| Deployment | linkedeye-frontend | fs-linkedeye | 2 | Port 80, nginx |
| Deployment | postgres | fs-linkedeye | 1 | PostgreSQL 16 |
| Deployment | redis | fs-linkedeye | 1 | Redis 7-alpine, 512mb maxmemory |
| CronJob | linkedeye-db-backup | fs-linkedeye | — | Daily 2:00 AM IST |
| Ingress | linkedeye-ingress | fs-linkedeye | — | TLS via cert-manager |
| HPA | linkedeye-api-hpa | fs-linkedeye | 2-8 | CPU 70%, Mem 80% |
| Secret | linkedeye-ssh-key | fs-linkedeye | — | Ed25519 keypair |
| Secret | linkedeye-secrets | fs-linkedeye | — | DB, JWT, API keys |
| ConfigMap | linkedeye-config | fs-linkedeye | — | Non-sensitive config |
| PVC | linkedeye-db-backups | fs-linkedeye | — | 50Gi, nfs-client |
| PVC | linkedeye-uploads | fs-linkedeye | — | 10Gi, nfs-client, RWX |

### Appendix C — Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Runtime environment (development/production) | Yes |
| `PORT` | API server port (default: 5000) | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `JWT_SECRET` | Access token signing key | Yes |
| `JWT_REFRESH_SECRET` | Refresh token signing key | Yes |
| `JWT_EXPIRY` | Access token TTL (default: 15m) | Yes |
| `JWT_REFRESH_EXPIRY` | Refresh token TTL (default: 7d) | Yes |
| `FRONTEND_URL` | Frontend origin for CORS | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins | Yes |
| `PROMETHEUS_URL` | Local Prometheus endpoint | No |
| `GRAFANA_URL` | Local Grafana endpoint | No |
| `GRAFANA_API_KEY` | Grafana service account token | No |
| `SLACK_BOT_TOKEN` | Slack Bot OAuth token | No |
| `SLACK_SIGNING_SECRET` | Slack request verification | No |
| `OLLAMA_URL` | Ollama API endpoint | No |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | No |
| `OPENAI_API_KEY` | OpenAI API key | No |

### Appendix D — Health Check Endpoints

| Endpoint | Method | Auth | Expected Response |
|----------|--------|------|-------------------|
| `/health` | GET | None | `{ status: 'ok', uptime, memoryUsage }` |
| `/api/v1/auth/me` | GET | Bearer | `{ success: true, data: { user } }` |
| `/api/v1/dashboard/stats` | GET | Bearer | `{ success: true, data: { incidents, changes, ... } }` |

---

*End of Disaster Recovery Runbook*
