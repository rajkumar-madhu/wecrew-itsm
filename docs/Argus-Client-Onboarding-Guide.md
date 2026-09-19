# Argus ITSM Platform — Client Onboarding Guide

**Document Title:** Argus ITSM Platform — Client Organization Onboarding Guide
**Version:** 1.0
**Platform Version:** 2.0.0
**Date:** 2026-03-03
**Author:** Enterprise Documentation Team
**Classification:** CONFIDENTIAL
**Distribution:** Engineering, Operations, Client Success

---

## Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-03-03 | Enterprise Doc Team | Initial release |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Pre-Onboarding Requirements](#2-pre-onboarding-requirements)
3. [Phase 1 — Infrastructure Preparation](#3-phase-1--infrastructure-preparation)
4. [Phase 2 — Platform Configuration](#4-phase-2--platform-configuration)
5. [Phase 3 — Integration Verification](#5-phase-3--integration-verification)
6. [Phase 4 — User Setup and Training](#6-phase-4--user-setup-and-training)
7. [Post-Onboarding Verification Checklist](#7-post-onboarding-verification-checklist)
8. [Troubleshooting Reference](#8-troubleshooting-reference)
9. [Appendices](#9-appendices)

---

## 1. Overview

This guide covers the end-to-end process for onboarding a new client organization into the Argus ITSM platform. Each client requires:

- **SSH connectivity** from the Argus API pod to the client's K8s server
- **3 Integration records** in the platform database: PROMETHEUS, KUBERNETES_CLUSTER, GRAFANA
- **Organization record** with server IP, FQDN, and environment classification
- **User accounts** with appropriate RBAC roles

### Standard Client Infrastructure

All client servers follow a common architecture:
- Single-node Kubernetes cluster
- Prometheus on port **30000**
- Grafana on port **30010**
- node-exporter on port **9100**
- kube-state-metrics v2.10.1 in `kube-system` namespace
- SSH access via Ed25519 key (default user: `finadmin`)

---

## 2. Pre-Onboarding Requirements

### Network Requirements

- [ ] Client server has a public IP reachable from Argus platform
- [ ] SSH port (typically 2233, 4422, or 5522) is open from Argus API pod IP
- [ ] Ports 30000 (Prometheus), 30010 (Grafana), 9100 (node-exporter) are accessible on localhost from SSH session
- [ ] Client DNS FQDN is resolvable (for Grafana external URL)

### SSH Requirements

- [ ] Argus Ed25519 public key deployed to `~/.ssh/authorized_keys` on client server
- [ ] SSH user account created (default: `finadmin`, exception: `leprod` for some orgs)
- [ ] Passwordless SSH authentication verified
- [ ] SSH user has sudo access for kubectl commands

### Kubernetes Requirements

- [ ] Single-node K8s cluster operational (`kubectl get nodes` shows Ready)
- [ ] `kubectl` accessible to SSH user without sudo
- [ ] Metrics Server installed (`kubectl top nodes` works)

### Monitoring Stack Requirements

- [ ] Prometheus running on NodePort 30000
- [ ] Grafana running on NodePort 30010
- [ ] node-exporter running on port 9100
- [ ] kube-state-metrics v2.10.1 deployed (see Appendix B for manifest)

---

## 3. Phase 1 — Infrastructure Preparation

### Step 1.1 — Deploy SSH Key

From the Argus platform server:
```bash
# Copy the Argus public key to the client server
ssh-copy-id -i /home/finadmin/.ssh/id_ed25519.pub -p <SSH_PORT> <SSH_USER>@<CLIENT_IP>
```

### Step 1.2 — Verify SSH from API Pod

```bash
# SSH into the API pod
kubectl exec -it -n fs-linkedeye deployment/linkedeye-api -- bash

# Test connectivity to client server
ssh -p <SSH_PORT> -i /home/finadmin/.ssh/id_ed25519 \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=8 \
  -o BatchMode=yes \
  <SSH_USER>@<CLIENT_IP> "hostname && kubectl get nodes"
```

Expected output: Client hostname and node status showing `Ready`.

### Step 1.3 — Verify Kubernetes Health

```bash
# From within SSH session to client server
kubectl get nodes -o wide
kubectl get pods --all-namespaces | head -20
kubectl top nodes
```

### Step 1.4 — Deploy kube-state-metrics (if not present)

```bash
# Check if already deployed
kubectl get pods -n kube-system | grep kube-state-metrics

# If not present, deploy (see Appendix B for full manifest)
kubectl apply -f /tmp/kube-state-metrics.yaml
```

### Step 1.5 — Verify Monitoring Stack

```bash
# From SSH session on client server
# Prometheus
curl -s http://localhost:30000/api/v1/query?query=up | python3 -m json.tool | head -10

# Grafana
curl -s http://localhost:30010/api/health

# node-exporter
curl -s http://localhost:9100/metrics | head -5

# kube-state-metrics
curl -s http://localhost:8080/metrics | grep kube_pod_info | head -3
```

---

## 4. Phase 2 — Platform Configuration

### Step 2.1 — Create Organization Record

```bash
# Authenticate as super-admin
TOKEN=$(curl -s -X POST https://itsm.wecrew.in/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@argus.com","password":"<PASSWORD>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Create organization
curl -X POST https://itsm.wecrew.in/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<CLIENT_NAME>",
    "slug": "<client-slug>",
    "environment": "PROD",
    "serverIp": "<CLIENT_IP>",
    "fqdn": "<client.domain.com>"
  }'
```

Save the returned `organizationId` — you will need it for all subsequent steps.

### Step 2.2 — Create Prometheus Integration

```bash
curl -X POST https://itsm.wecrew.in/api/v1/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: <ORG_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<client-slug>-prometheus",
    "type": "PROMETHEUS",
    "isActive": true,
    "config": "{\"accessMethod\":\"ssh\",\"serverIp\":\"<CLIENT_IP>\",\"sshPort\":<SSH_PORT>,\"sshUser\":\"<SSH_USER>\",\"promPort\":30000,\"prometheusUrl\":\"http://localhost:30000\"}"
  }'
```

### Step 2.3 — Create Kubernetes Integration

```bash
curl -X POST https://itsm.wecrew.in/api/v1/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: <ORG_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<client-slug>-k8s",
    "type": "KUBERNETES_CLUSTER",
    "isActive": true,
    "config": "{\"accessMethod\":\"ssh\",\"serverIp\":\"<CLIENT_IP>\",\"sshPort\":<SSH_PORT>,\"sshUser\":\"<SSH_USER>\"}"
  }'
```

### Step 2.4 — Create Grafana Integration

```bash
curl -X POST https://itsm.wecrew.in/api/v1/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: <ORG_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<client-slug>-grafana",
    "type": "GRAFANA",
    "isActive": true,
    "config": "{\"accessMethod\":\"ssh\",\"serverIp\":\"<CLIENT_IP>\",\"sshPort\":<SSH_PORT>,\"sshUser\":\"<SSH_USER>\",\"grafanaPort\":30010,\"grafanaExternalUrl\":\"http://<CLIENT_IP>:30010\"}"
  }'
```

### Step 2.5 — Configure Alertmanager Webhook

On the client's Alertmanager configuration, add the Argus webhook receiver:

```yaml
# alertmanager.yml on client server
global:
  resolve_timeout: 5m

route:
  receiver: 'argus-webhook'
  group_by: ['alertname', 'instance']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 4h

receivers:
  - name: 'argus-webhook'
    webhook_configs:
      - url: 'https://itsm.wecrew.in/api/v1/webhooks/alertmanager?orgSlug=<client-slug>'
        send_resolved: true

# IMPORTANT: Add external label for org routing
# This enables Argus to identify the source organization
```

The webhook controller resolves organization via: `orgSlug` query param → `org_slug` external label → instance IP matching → serverIp lookup.

### Step 2.6 — Configure Grafana Webhook (Optional)

In Grafana Contact Points, create a webhook:
- **Name:** `Argus-Incidents`
- **URL:** `https://itsm.wecrew.in/api/v1/webhooks/grafana?orgId=<ORG_ID>`
- **Method:** POST

---

## 5. Phase 3 — Integration Verification

### Step 3.1 — Test Integration API

```bash
# Test Prometheus integration
curl -s https://itsm.wecrew.in/api/v1/integrations/test/<PROMETHEUS_INTEGRATION_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: <ORG_ID>"

# Test K8s integration
curl -s https://itsm.wecrew.in/api/v1/k8s/overview \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: <ORG_ID>"
```

### Step 3.2 — Verify K8s Dashboard

Navigate to `https://itsm.wecrew.in/k8s` in the browser. Select the new organization from the OrgSwitcher. Verify:
- Node count and status
- Pod count and health
- CPU/Memory metrics populated

### Step 3.3 — Verify Grafana Sync

```bash
curl -s https://itsm.wecrew.in/api/v1/ai/grafana-dashboards \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: <ORG_ID>"
```

### Step 3.4 — End-to-End Alert Pipeline Test

**Method 1 — Test via Alertmanager API:**
```bash
# SSH to client server and fire a test alert
curl -X POST http://localhost:30000/-/reload  # Reload Prometheus rules

# Or directly POST to Alertmanager
curl -X POST http://localhost:32566/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname":"TestAlert","severity":"warning","instance":"test"},
    "annotations": {"summary":"Onboarding test alert"},
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }]'
```

**Method 2 — Test via webhook directly:**
```bash
curl -X POST "https://itsm.wecrew.in/api/v1/webhooks/alertmanager?orgSlug=<client-slug>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "firing",
    "alerts": [{
      "status": "firing",
      "labels": {"alertname":"OnboardingTest","severity":"warning","instance":"test:9100"},
      "annotations": {"summary":"Test alert for onboarding verification"}
    }]
  }'
```

Verify: Alert appears in Argus Alerts page for the new organization. If severity is CRITICAL or WARNING, an Incident should be auto-created.

**Cleanup:** Resolve the test alert/incident after verification.

---

## 6. Phase 4 — User Setup and Training

### Step 6.1 — Create User Accounts

```bash
# Create org-admin user
curl -X POST https://itsm.wecrew.in/api/v1/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: <ORG_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "<user@client.com>",
    "password": "<TEMP_PASSWORD>",
    "firstName": "<First>",
    "lastName": "<Last>",
    "role": "ADMIN"
  }'
```

### Step 6.2 — Role Assignment Guide

| Role | Recommended For | Key Capabilities |
|------|----------------|------------------|
| **ADMIN** | IT Manager, Team Lead | Full CRUD on all modules, user management, integration config |
| **MANAGER** | Senior Engineers | CRUD on incidents/changes/problems, create users, read integrations |
| **ENGINEER** | DevOps, SRE | Create/update incidents/changes/problems/alerts/assets |
| **OPERATOR** | NOC Staff, L1 Support | Create/update incidents and alerts, read-only on other modules |
| **VIEWER** | Stakeholders, Auditors | Read-only access to all modules |

### Step 6.3 — Training Agenda

| Topic | Duration | Content |
|-------|----------|---------|
| Platform Overview | 15 min | Architecture, multi-tenant model, org switching |
| Incident Management | 30 min | Create, triage, escalate, resolve incidents; SLA timers |
| Alert Pipeline | 20 min | Prometheus → Alertmanager → Argus webhook flow |
| K8s Dashboard | 15 min | Cluster overview, pod management, metrics |
| Problem Management | 20 min | Root cause analysis, KEDB, AI-assisted RCA |
| Change Management | 15 min | Change types, approval workflow, risk assessment |
| On-Call & Escalation | 15 min | On-call schedules, escalation policies |
| Reports & Analytics | 10 min | Dashboard analytics, SLA compliance reports |

---

## 7. Post-Onboarding Verification Checklist

### Infrastructure
- [ ] SSH connectivity verified from Argus API pod
- [ ] Prometheus accessible via SSH tunnel (port 30000)
- [ ] Grafana accessible via SSH tunnel (port 30010)
- [ ] node-exporter running (port 9100)
- [ ] kube-state-metrics v2.10.1 deployed and reporting

### Platform Configuration
- [ ] Organization record created with correct serverIp and fqdn
- [ ] PROMETHEUS integration created and active
- [ ] KUBERNETES_CLUSTER integration created and active
- [ ] GRAFANA integration created and active
- [ ] Alertmanager webhook configured with orgSlug parameter

### Integration Verification
- [ ] K8s Dashboard shows nodes and pods for this org
- [ ] Prometheus metrics returning data
- [ ] Grafana dashboards synced
- [ ] Test alert fired and received in Argus
- [ ] Test alert auto-created incident (if CRITICAL/WARNING)
- [ ] Agent Pipeline processes alerts correctly

### User Setup
- [ ] Org-admin account created and login verified
- [ ] Additional user accounts provisioned
- [ ] Users confirmed org-specific view (tenant isolation)
- [ ] OrgSwitcher (admin only) shows correct org

### Handover
- [ ] Training sessions completed
- [ ] Client has documented login credentials
- [ ] Escalation contacts exchanged
- [ ] Monitoring dashboard bookmarked

---

## 8. Troubleshooting Reference

### SSH Connection Failures

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `Connection timed out` | Firewall blocking SSH port | Verify port is open: `telnet <IP> <PORT>` |
| `Permission denied (publickey)` | SSH key not in authorized_keys | Re-deploy key: `ssh-copy-id -i ... -p <PORT> <USER>@<IP>` |
| `Host key verification failed` | Server key changed | Remove old key: `ssh-keygen -R "[<IP>]:<PORT>"` |
| `Connection refused` | SSH service not running | Contact client: `systemctl status sshd` on server |

**Diagnostic command:**
```bash
ssh -vvv -p <PORT> -i /home/finadmin/.ssh/id_ed25519 -o ConnectTimeout=8 <USER>@<IP> "hostname"
```

### Prometheus Unreachable

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `curl: connection refused` on :30000 | Prometheus not running | `kubectl rollout restart deployment/prometheus -n monitoring` |
| SSH works but no metrics data | Prometheus misconfigured | Check `prometheus.yml` targets on client |
| Empty query results | No scrape targets | Verify `node-exporter` and `kube-state-metrics` are up |

### Grafana Auth Issues

| Symptom | Cause | Resolution |
|---------|-------|------------|
| 401 on Grafana API calls | Invalid API key | Create new SA key: Grafana → Administration → Service Accounts |
| Dashboards not syncing | `grafanaExternalUrl` wrong | Update integration config with correct public URL |

### K8s Access Denied

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `error: unknown command` | kubectl not in PATH | Add to PATH: `export PATH=$PATH:/usr/local/bin` |
| `forbidden` errors | RBAC restrictions | Grant cluster-admin: `kubectl create clusterrolebinding` |
| `connection refused` on :6443 | API server down | Check kubelet: `systemctl status kubelet` |

### Alerts Not Creating Incidents

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Alerts arrive but no incidents | Severity is INFO | Only CRITICAL and WARNING auto-create incidents |
| Org not resolved | Missing `orgSlug` param | Add `?orgSlug=<slug>` to Alertmanager webhook URL |
| 404 on webhook endpoint | Wrong URL path | Correct path: `/api/v1/webhooks/alertmanager` |

---

## 9. Appendices

### Appendix A — Alertmanager Webhook Configuration

```yaml
# /etc/alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: 'argus-webhook'
  group_by: ['alertname', 'instance']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'argus-webhook'
      group_wait: 0s
      repeat_interval: 1h

receivers:
  - name: 'argus-webhook'
    webhook_configs:
      - url: 'https://itsm.wecrew.in/api/v1/webhooks/alertmanager?orgSlug=<CLIENT_SLUG>'
        send_resolved: true
        http_config:
          tls_config:
            insecure_skip_verify: false
```

### Appendix B — kube-state-metrics v2.10.1 Deployment

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kube-state-metrics
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kube-state-metrics
rules:
  - apiGroups: [""]
    resources: ["nodes", "pods", "services", "resourcequotas", "replicationcontrollers", "limitranges", "persistentvolumeclaims", "persistentvolumes", "namespaces", "endpoints", "secrets", "configmaps"]
    verbs: ["list", "watch"]
  - apiGroups: ["apps"]
    resources: ["statefulsets", "daemonsets", "deployments", "replicasets"]
    verbs: ["list", "watch"]
  - apiGroups: ["batch"]
    resources: ["cronjobs", "jobs"]
    verbs: ["list", "watch"]
  - apiGroups: ["autoscaling"]
    resources: ["horizontalpodautoscalers"]
    verbs: ["list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["list", "watch"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses", "volumeattachments"]
    verbs: ["list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kube-state-metrics
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kube-state-metrics
subjects:
  - kind: ServiceAccount
    name: kube-state-metrics
    namespace: kube-system
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kube-state-metrics
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kube-state-metrics
  template:
    metadata:
      labels:
        app: kube-state-metrics
    spec:
      serviceAccountName: kube-state-metrics
      containers:
        - name: kube-state-metrics
          image: registry.k8s.io/kube-state-metrics/kube-state-metrics:v2.10.1
          ports:
            - containerPort: 8080
              name: http-metrics
            - containerPort: 8081
              name: telemetry
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: kube-state-metrics
  namespace: kube-system
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
spec:
  selector:
    app: kube-state-metrics
  ports:
    - name: http-metrics
      port: 8080
      targetPort: http-metrics
    - name: telemetry
      port: 8081
      targetPort: telemetry
```

### Appendix C — Integration Config Reference

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `accessMethod` | string | How Argus reaches the server: `ssh`, `direct`, or `local` | `"ssh"` |
| `serverIp` | string | Public IP of the client server | `"154.210.170.126"` |
| `sshPort` | number | SSH port on client server | `4422` |
| `sshUser` | string | SSH username (default: `finadmin`) | `"finadmin"` |
| `promPort` | number | Prometheus NodePort (default: 30000) | `30000` |
| `grafanaPort` | number | Grafana NodePort (default: 30010) | `30010` |
| `prometheusUrl` | string | Prometheus URL from SSH perspective | `"http://localhost:30000"` |
| `grafanaExternalUrl` | string | Public Grafana URL for iframe embeds | `"http://154.210.170.126:30010"` |

### Appendix D — User Role Permission Matrix

| Resource | ADMIN | MANAGER | ENGINEER | OPERATOR | VIEWER |
|----------|-------|---------|----------|----------|--------|
| Incidents | crud | crud | cru | cru | read |
| Changes | crud | crud | cru | read | read |
| Problems | crud | crud | cru | read | read |
| Assets | crud | cru | cru | read | read |
| Alerts | crud | cru | cru | cru | read |
| Teams | crud | cru | read | read | read |
| Integrations | crud | read | read | read | read |
| Users | crud | cru | read | read | read |
| Reports | read | read | read | read | read |

**Legend:** `c` = create, `r` = read, `u` = update, `d` = delete

**Org Switching:** Only ADMIN role users see the OrgSwitcher in the sidebar. Super-admins (ADMIN with no organizationId) can view all orgs. Org-admins default to their own org but can switch via the header.

**Account Lockout:** 5 failed login attempts triggers a 15-minute lockout.

---

*End of Client Onboarding Guide*
