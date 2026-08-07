# Argus ITSM Platform — Security Hardening Guide

**Document Title:** Argus ITSM Platform — Security Hardening Guide
**Version:** 1.0
**Platform Version:** 2.0.0
**Date:** 2026-03-03
**Author:** Enterprise Documentation Team
**Classification:** CONFIDENTIAL
**Distribution:** Engineering, Security, Compliance

---

## Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-03-03 | Enterprise Doc Team | Initial release — security posture assessment and hardening recommendations |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Security Posture](#2-current-security-posture)
3. [Compliance Mapping](#3-compliance-mapping)
4. [Authentication and Authorization](#4-authentication-and-authorization)
5. [Network Security](#5-network-security)
6. [Database Security](#6-database-security)
7. [Redis Security](#7-redis-security)
8. [Kubernetes Security](#8-kubernetes-security)
9. [SSH Hardening](#9-ssh-hardening)
10. [Application Security](#10-application-security)
11. [Monitoring and Logging](#11-monitoring-and-logging)
12. [Security Incident Response](#12-security-incident-response)
13. [Implementation Priority Matrix](#13-implementation-priority-matrix)
14. [Appendices](#14-appendices)

---

## 1. Executive Summary

### Security Posture Assessment

The Argus ITSM platform demonstrates a **moderate security posture** with several strong foundational controls and identifiable gaps requiring remediation. The platform handles sensitive IT operations data for 13+ client organizations, making multi-tenant isolation a critical security requirement.

**Overall Rating:** 6.5/10

**Strengths:** 9 implemented controls
**Gaps:** 8 Critical/High findings requiring remediation

### Key Findings Summary

| Severity | Finding | Status |
|----------|---------|--------|
| CRITICAL | MFA scaffolded (speakeasy) but not enforced | Open |
| CRITICAL | Webhook endpoints lack signature verification (except Twilio) | Open |
| HIGH | JWT algorithm not explicitly pinned (should use RS256 or pin HS256) | Open |
| HIGH | Tokens stored in localStorage (XSS vulnerability) | Open |
| HIGH | Redis has no authentication configured | Open |
| HIGH | SSH StrictHostKeyChecking=accept-new (TOFU risk) | Open |
| HIGH | No Kubernetes Pod Security Standards | Open |
| HIGH | PostgreSQL appears to use single-user, no SSL | Open |

---

## 2. Current Security Posture

### Implemented Security Controls

| Control | Implementation | File Reference |
|---------|---------------|----------------|
| **Helmet.js** | HTTP security headers (X-Frame-Options, X-Content-Type-Options, HSTS, etc.) | `server.js` |
| **CORS Policy** | Configurable origins via `CORS_ORIGINS` env var | `server.js` |
| **Rate Limiting** | Global + per-route limits with `express-rate-limit`; Redis-backed in production | `middleware/rateLimiter.js` |
| **JWT Authentication** | Access (15min) + Refresh (7d) token pattern | `middleware/auth.js`, `utils/jwt.js` |
| **RBAC Authorization** | 5-role hierarchy: ADMIN, MANAGER, ENGINEER, OPERATOR, VIEWER | `middleware/auth.js`, `config/constants.js` |
| **Prisma ORM** | Parameterized queries prevent SQL injection | All controllers |
| **bcryptjs** | Password hashing with salt rounds | `controllers/auth.controller.js` |
| **express-validator** | Input validation on all mutation endpoints | `middleware/validator.js` |
| **Multi-tenant Isolation** | `req.tenantWhere` enforced on every authenticated request | `middleware/auth.js` |

### Authentication Flow

```
Client → POST /api/v1/auth/login (email + password)
  → bcrypt.compare() → JWT access (15min) + refresh (7d)
  → Access token: Authorization: Bearer <token> OR accessToken cookie
  → Refresh: POST /api/v1/auth/refresh
  → Tenant context: X-Organization-Id header
```

---

## 3. Compliance Mapping

### SOC 2 Type II Mapping

| Trust Criteria | Current Status | Gap |
|---------------|----------------|-----|
| **CC6.1** — Logical access | JWT + RBAC implemented | MFA not enforced |
| **CC6.2** — User provisioning | Admin-only user creation | No approval workflow |
| **CC6.3** — Credential management | bcrypt hashing, 8-char min | No password complexity rules |
| **CC6.6** — System boundaries | CORS, rate limiting | WAF not deployed |
| **CC6.7** — Threat detection | Audit middleware exists | No SIEM integration |
| **CC6.8** — Incident response | Platform manages incidents | No security-specific playbook |
| **CC7.1** — Change management | Change module with approvals | No automated deployment gates |
| **CC7.2** — Infrastructure monitoring | Prometheus + Grafana per org | No centralized security monitoring |
| **CC8.1** — Data integrity | Prisma ORM, validators | No database audit trail |

### ISO 27001:2022 Annex A Mapping

| Control | Description | Status |
|---------|-------------|--------|
| A.5.15 | Access control | Implemented (RBAC) |
| A.5.17 | Authentication | Partial (no MFA) |
| A.8.3 | Information access restriction | Implemented (tenant isolation) |
| A.8.5 | Secure authentication | Partial (localStorage tokens) |
| A.8.9 | Configuration management | Partial (no IaC enforcement) |
| A.8.24 | Use of cryptography | Partial (no DB SSL, no Redis TLS) |
| A.8.25 | Software development lifecycle | Partial (no automated security testing) |

### RBI IT Framework Alignment

| Requirement | Status | Notes |
|-------------|--------|-------|
| Strong authentication | Partial | MFA scaffolded but not enforced |
| Access control | Implemented | RBAC with 5 roles |
| Data encryption in transit | Partial | TLS on ingress, no internal TLS |
| Data encryption at rest | Not implemented | PostgreSQL not encrypted |
| Audit logging | Partial | Middleware exists, not comprehensive |
| Incident management | Implemented | Full ITIL incident management |

---

## 4. Authentication and Authorization

### 4.1 JWT Algorithm Pinning

**Current Risk:** JWT algorithm is not explicitly pinned, potentially allowing algorithm confusion attacks.

**Recommendation:**
```javascript
// utils/jwt.js — Pin algorithm explicitly
const jwt = require('jsonwebtoken');

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',  // Explicitly pin algorithm
    expiresIn: process.env.JWT_EXPIRY || '15m',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],  // Only accept HS256
  });
}
```

**Priority:** HIGH | **Effort:** Low (1 hour)

### 4.2 MFA Enforcement

**Current State:** `speakeasy` package is installed but TOTP setup/verification is not enforced.

**Recommendation:**
1. Add TOTP setup endpoint: `POST /api/v1/auth/mfa/setup`
2. Add TOTP verification to login flow
3. Enforce MFA for ADMIN and MANAGER roles at minimum
4. Store TOTP secrets encrypted in database

**Priority:** CRITICAL | **Effort:** Medium (2-3 days)

### 4.3 Token Storage

**Current Risk:** JWT tokens stored in `localStorage` are vulnerable to XSS attacks.

**Recommendation:** Migrate to `httpOnly` + `Secure` + `SameSite=Strict` cookies:
```javascript
// auth.controller.js — Set tokens as httpOnly cookies
res.cookie('accessToken', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000, // 15 minutes
});

res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

**Note:** Backend already supports cookie-based tokens (`req.cookies?.accessToken` in auth.js line 12). Frontend needs to stop storing in localStorage.

**Priority:** HIGH | **Effort:** Medium (1-2 days)

### 4.4 Password Policy Enhancement

**Current:** Minimum 8 characters only.

**Recommendation:** Add complexity requirements:
```javascript
body('password')
  .isLength({ min: 12 })
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  .withMessage('Password: 12+ chars, uppercase, lowercase, number, special char')
```

**Priority:** MEDIUM | **Effort:** Low (2 hours)

### 4.5 Session Management

**Current:** 7-day refresh token with no rotation.

**Recommendation:**
1. Implement refresh token rotation (new refresh token on each use)
2. Maintain a token blacklist in Redis for revoked tokens
3. Add session listing: `GET /api/v1/auth/sessions`
4. Add remote session termination: `DELETE /api/v1/auth/sessions/:id`

**Priority:** MEDIUM | **Effort:** Medium (2 days)

---

## 5. Network Security

### 5.1 TLS Configuration

**Current:** TLS terminated at NGINX Ingress via cert-manager (Let's Encrypt).

**Recommendation:**
- Enforce TLS 1.2+ minimum
- Configure strong cipher suites
- Enable HSTS preloading

```yaml
# Ingress annotation additions
metadata:
  annotations:
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
    nginx.ingress.kubernetes.io/hsts: "true"
    nginx.ingress.kubernetes.io/hsts-max-age: "31536000"
    nginx.ingress.kubernetes.io/hsts-include-subdomains: "true"
    nginx.ingress.kubernetes.io/hsts-preload: "true"
```

**Priority:** MEDIUM | **Effort:** Low (1 hour)

### 5.2 CORS Hardening

**Current:** Origins configurable via `CORS_ORIGINS` env var.

**Recommendation:**
- Restrict to exact production origins (no wildcards)
- Disable credentials for non-authenticated endpoints
- Add `Access-Control-Max-Age` header

**Priority:** LOW | **Effort:** Low (1 hour)

### 5.3 Rate Limiting Tuning

**Current:** Global rate limiter + auth-specific limiter (`authLimiter`).

**Recommendation:**
- Add per-user rate limiting (keyed by JWT subject)
- Add webhook-specific rate limiting (prevent abuse)
- Log rate limit violations to SIEM

**Priority:** MEDIUM | **Effort:** Low (3 hours)

### 5.4 WAF Deployment

**Recommendation:** Deploy ModSecurity or cloud WAF in front of NGINX Ingress:
- OWASP Core Rule Set (CRS)
- Bot detection
- Geographic filtering (if applicable)

**Priority:** MEDIUM | **Effort:** High (1 week)

---

## 6. Database Security

### 6.1 PostgreSQL SSL

**Current Risk:** No SSL for PostgreSQL connections.

**Recommendation:**
```bash
# PostgreSQL configuration
ssl = on
ssl_cert_file = '/var/lib/postgresql/server.crt'
ssl_key_file = '/var/lib/postgresql/server.key'
ssl_min_protocol_version = 'TLSv1.2'
```

Update `DATABASE_URL`:
```
postgresql://linkedeye:PASSWORD@postgres:5432/linkedeye?sslmode=require
```

**Priority:** HIGH | **Effort:** Medium (4 hours)

### 6.2 Role-Based Database Access

**Current Risk:** Single database user (`linkedeye`) for all operations.

**Recommendation:** Create separate database roles:
```sql
-- Application role (limited privileges)
CREATE ROLE linkedeye_app WITH LOGIN PASSWORD 'xxx';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO linkedeye_app;

-- Migration role (schema changes)
CREATE ROLE linkedeye_migrate WITH LOGIN PASSWORD 'xxx';
GRANT ALL ON SCHEMA public TO linkedeye_migrate;

-- Read-only role (for reporting)
CREATE ROLE linkedeye_readonly WITH LOGIN PASSWORD 'xxx';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO linkedeye_readonly;
```

**Priority:** MEDIUM | **Effort:** Medium (1 day)

### 6.3 Database Encryption at Rest

**Recommendation:** Enable PostgreSQL TDE or use encrypted PVCs:
```yaml
# PVC with encrypted storage class
storageClassName: encrypted-nfs-client
```

**Priority:** MEDIUM | **Effort:** High (depends on storage provider)

### 6.4 Connection Pooling

**Current:** Prisma client singleton with 5-retry connection logic.

**Recommendation:** Configure explicit connection pool limits:
```
DATABASE_URL=postgresql://...?connection_limit=20&pool_timeout=10
```

**Priority:** LOW | **Effort:** Low (1 hour)

---

## 7. Redis Security

### 7.1 Redis Authentication

**Current Risk:** Redis runs without authentication (`redis:7-alpine` with no `requirepass`).

**Recommendation:**
```yaml
# redis-deployment.yml
command: ["redis-server",
  "--maxmemory", "512mb",
  "--maxmemory-policy", "allkeys-lru",
  "--appendonly", "yes",
  "--requirepass", "$(REDIS_PASSWORD)"  # Add auth
]
env:
  - name: REDIS_PASSWORD
    valueFrom:
      secretKeyRef:
        name: linkedeye-secrets
        key: REDIS_PASSWORD
```

Update `REDIS_URL`:
```
redis://:PASSWORD@redis:6379
```

**Priority:** HIGH | **Effort:** Low (2 hours)

### 7.2 Redis Network Isolation

**Recommendation:** Apply Kubernetes NetworkPolicy to restrict Redis access to only the API pods:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: redis-access
  namespace: fs-linkedeye
spec:
  podSelector:
    matchLabels:
      app: redis
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: linkedeye-api
      ports:
        - port: 6379
```

**Priority:** MEDIUM | **Effort:** Low (1 hour)

### 7.3 Redis Data Persistence

**Current Risk:** Redis uses `emptyDir` — data lost on pod restart.

**Assessment:** Acceptable for current use case (session cache). If Redis begins storing sensitive state, migrate to PVC-backed storage.

---

## 8. Kubernetes Security

### 8.1 Pod Security Standards

**Recommendation:** Apply Pod Security Standards (PSS) at namespace level:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: fs-linkedeye
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

Add security contexts to all deployments:
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault
containers:
  - securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
```

**Priority:** HIGH | **Effort:** Medium (1 day)

### 8.2 NetworkPolicies

**Recommendation:** Implement default-deny + explicit allow:
```yaml
# Default deny all ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: fs-linkedeye
spec:
  podSelector: {}
  policyTypes:
    - Ingress

# Allow ingress to API from ingress controller
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-ingress
  namespace: fs-linkedeye
spec:
  podSelector:
    matchLabels:
      app: linkedeye-api
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - port: 5000
```

**Priority:** HIGH | **Effort:** Medium (4 hours)

### 8.3 Secrets Management

**Current:** Secrets stored as K8s Secrets (base64 encoded, not encrypted).

**Recommendation:**
1. Enable K8s encryption at rest for Secrets
2. Consider HashiCorp Vault or Sealed Secrets for production
3. Rotate secrets on a quarterly schedule

**Priority:** MEDIUM | **Effort:** High (1 week)

### 8.4 Image Security

**Recommendation:**
- Scan container images with Trivy or Grype before deployment
- Use distroless or Alpine base images (already using Alpine for Redis)
- Pin image versions (avoid `:latest` tag)
- Implement image pull policy: `IfNotPresent` for production

**Priority:** MEDIUM | **Effort:** Medium (2 days)

---

## 9. SSH Hardening

### 9.1 Host Key Verification

**Current Risk:** `StrictHostKeyChecking=accept-new` trusts first connection (TOFU — Trust On First Use).

**Recommendation:**
1. Pre-populate known_hosts with verified fingerprints for all 13 servers
2. Mount known_hosts as a ConfigMap
3. Change to `StrictHostKeyChecking=yes` in `k8sService.js`

```yaml
# ConfigMap with known host keys
apiVersion: v1
kind: ConfigMap
metadata:
  name: ssh-known-hosts
  namespace: fs-linkedeye
data:
  known_hosts: |
    [180.179.253.162]:2233 ssh-ed25519 AAAA...
    [206.1.32.216]:3311 ssh-ed25519 AAAA...
    # ... all 13 servers
```

**Priority:** HIGH | **Effort:** Medium (4 hours)

### 9.2 SSH Key Rotation

**Recommendation:**
- Rotate Ed25519 key pair annually
- Implement key rotation procedure (documented in DR Runbook Section 4.5)
- Monitor for unauthorized key usage via SSH audit logs

**Priority:** MEDIUM | **Effort:** Low (documented procedure exists)

### 9.3 SSH Audit Logging

**Recommendation:** Log all SSH command executions:
```javascript
// k8sService.js — Add audit logging
async function remoteKubectl(serverIp, kubectlArgs, sshPort, sshUser) {
  logger.info(`[SSH] Executing on ${serverIp}:${sshPort} as ${sshUser}: kubectl ${kubectlArgs}`);
  // ... existing logic
}
```

**Priority:** MEDIUM | **Effort:** Low (2 hours)

---

## 10. Application Security

### 10.1 Webhook Signature Verification

**Current Risk:** Alertmanager, Grafana, ServiceNow, and generic webhook endpoints lack signature verification. Only Twilio webhooks are verified (`validateTwilioSignature` middleware).

**Recommendation:** Implement HMAC signature verification for each webhook source:
```javascript
// middleware/webhookAuth.js
function validateAlertmanagerSignature(req, res, next) {
  const signature = req.headers['x-alertmanager-signature'];
  const secret = process.env.ALERTMANAGER_WEBHOOK_SECRET;
  if (!secret) return next(); // Skip if not configured

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(req.body));
  const expected = hmac.digest('hex');

  if (signature !== expected) {
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }
  next();
}
```

**Priority:** CRITICAL | **Effort:** Medium (1 day)

### 10.2 Content Security Policy

**Recommendation:** Add CSP header via Helmet configuration:
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:", process.env.FRONTEND_URL],
      frameSrc: ["'self'"],  // For Grafana iframes if needed
    },
  },
}));
```

**Priority:** MEDIUM | **Effort:** Low (2 hours)

### 10.3 Dependency Scanning

**Recommendation:**
- Run `npm audit` weekly
- Integrate `snyk` or `npm audit` into CI/CD pipeline
- Pin dependency versions in `package-lock.json`
- Review and update dependencies quarterly

**Priority:** MEDIUM | **Effort:** Low (ongoing)

### 10.4 Request Body Size

**Current:** `express.json({ limit: '10mb' })` — generous limit.

**Recommendation:** Reduce to 1mb for general API, keep 10mb only for file upload endpoints:
```javascript
app.use(express.json({ limit: '1mb' }));
// File upload routes use multer with specific limits
```

**Priority:** LOW | **Effort:** Low (30 minutes)

---

## 11. Monitoring and Logging

### 11.1 Log Integrity

**Current:** Winston logger with daily rotate files.

**Recommendation:**
- Ship logs to centralized SIEM (ELK, Splunk, or Loki)
- Enable log integrity verification (hash chaining)
- Set log retention policy: 90 days minimum for compliance

### 11.2 Security Event Monitoring

**Recommendation:** Monitor and alert on:
- Failed login attempts (>3 per user per 5min)
- Privilege escalation attempts (403 errors from non-admin users)
- Tenant isolation violations (cross-org data access attempts)
- Webhook flood detection (>100 webhooks per minute)
- SSH key usage anomalies

### 11.3 Audit Trail

**Current:** `middleware/audit.js` exists but usage is inconsistent.

**Recommendation:** Standardize audit logging for:
- All CRUD operations on sensitive data
- User authentication events (login, logout, password change)
- Configuration changes (integration create/update)
- Admin actions (user provisioning, org switching)

---

## 12. Security Incident Response

### Response Playbook

#### Phase 1 — Detection and Triage (0-15 min)

1. Identify the security event type (data breach, unauthorized access, DoS, etc.)
2. Assess blast radius (single tenant, multi-tenant, platform-wide)
3. Determine severity level (SEV-1 through SEV-3)
4. Assign incident commander

#### Phase 2 — Containment (15-60 min)

| Event Type | Containment Action |
|-----------|-------------------|
| **Compromised user account** | Disable user: `UPDATE "User" SET status='SUSPENDED'` |
| **Compromised SSH key** | Revoke key on all servers (see DR Runbook 4.5) |
| **API token leak** | Rotate JWT secrets, force re-authentication |
| **Data exfiltration** | Enable WAF block rules, review access logs |
| **DDoS** | Scale HPA max replicas, enable rate limit strict mode |

#### Phase 3 — Eradication (1-4 hours)

1. Identify root cause
2. Patch vulnerability
3. Deploy fix via standard K8s deployment pipeline
4. Verify fix with security testing

#### Phase 4 — Recovery (4-24 hours)

1. Restore normal operations
2. Verify tenant data isolation integrity
3. Monitor for recurrence
4. Clear containment measures

#### Phase 5 — Post-Incident (48 hours)

1. Conduct post-incident review
2. Document lessons learned
3. Update security controls
4. Notify affected clients (if data breach)
5. File regulatory reports if required

---

## 13. Implementation Priority Matrix

### Critical (Implement within 2 weeks)

| Item | Effort | Impact |
|------|--------|--------|
| MFA enforcement for ADMIN/MANAGER roles | 2-3 days | Prevents credential-based attacks |
| Webhook signature verification | 1 day | Prevents unauthorized alert injection |

### High (Implement within 1 month)

| Item | Effort | Impact |
|------|--------|--------|
| JWT algorithm pinning | 1 hour | Prevents algorithm confusion attacks |
| Token storage migration (localStorage → httpOnly cookies) | 1-2 days | Mitigates XSS token theft |
| Redis authentication | 2 hours | Prevents unauthorized cache access |
| SSH host key pinning (known_hosts) | 4 hours | Eliminates TOFU risk |
| K8s Pod Security Standards | 1 day | Reduces container escape risk |
| PostgreSQL SSL | 4 hours | Encrypts DB traffic |

### Medium (Implement within 3 months)

| Item | Effort | Impact |
|------|--------|--------|
| TLS hardening (Ingress annotations) | 1 hour | Stronger encryption |
| Password policy enhancement | 2 hours | Reduces brute-force risk |
| Session management improvements | 2 days | Better session control |
| K8s NetworkPolicies | 4 hours | Network segmentation |
| CSP headers | 2 hours | XSS mitigation |
| Database role separation | 1 day | Least-privilege DB access |
| SSH audit logging | 2 hours | Forensic capability |
| Dependency scanning pipeline | 3 hours | Supply chain security |

### Low (Implement within 6 months)

| Item | Effort | Impact |
|------|--------|--------|
| CORS fine-tuning | 1 hour | Reduced attack surface |
| Request body size reduction | 30 min | DoS mitigation |
| WAF deployment | 1 week | Comprehensive web protection |
| K8s Secrets encryption / Vault | 1 week | Secrets management |
| Database encryption at rest | Variable | Data protection |

---

## 14. Appendices

### Appendix A — Security Configuration Template

```yaml
# Recommended Ingress security annotations
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256"
    nginx.ingress.kubernetes.io/hsts: "true"
    nginx.ingress.kubernetes.io/hsts-max-age: "31536000"
    nginx.ingress.kubernetes.io/hsts-include-subdomains: "true"
    nginx.ingress.kubernetes.io/server-snippet: |
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Appendix B — Security Compliance Checklist

#### Authentication
- [ ] JWT algorithm explicitly pinned to HS256
- [ ] MFA enabled for ADMIN and MANAGER roles
- [ ] Tokens stored in httpOnly cookies (not localStorage)
- [ ] Password policy: 12+ chars, uppercase, lowercase, number, special
- [ ] Refresh token rotation implemented
- [ ] Account lockout after 5 failed attempts (already implemented)

#### Network
- [ ] TLS 1.2+ enforced on ingress
- [ ] HSTS enabled with preload
- [ ] CORS restricted to production origins
- [ ] WAF deployed with OWASP CRS
- [ ] Rate limiting on all public endpoints

#### Database
- [ ] PostgreSQL SSL enabled (sslmode=require)
- [ ] Separate DB roles for app/migrate/readonly
- [ ] Connection pooling configured
- [ ] Database encryption at rest

#### Kubernetes
- [ ] Pod Security Standards enforced (restricted)
- [ ] NetworkPolicies: default-deny + explicit allow
- [ ] Secrets encrypted at rest
- [ ] Image scanning in CI/CD pipeline
- [ ] No `:latest` tags in production

#### SSH
- [ ] Known hosts pre-populated (no TOFU)
- [ ] Key rotation on annual schedule
- [ ] SSH command audit logging enabled
- [ ] Unused SSH access revoked

#### Application
- [ ] Webhook signature verification on all endpoints
- [ ] CSP headers configured
- [ ] Request body limits tuned
- [ ] Dependencies scanned weekly
- [ ] Audit trail for all sensitive operations

---

*End of Security Hardening Guide*
