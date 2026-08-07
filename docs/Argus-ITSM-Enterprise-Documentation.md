# Argus ITSM Platform — Enterprise Documentation Package

**Document Title:** Argus ITSM Platform — Complete Technical Reference
**Version:** 1.0
**Platform Version:** 2.0.0
**Date:** 2026-03-03
**Author:** Enterprise Documentation Team
**Classification:** Internal — Restricted
**Distribution:** Engineering, Operations, Client Success, Compliance

---

## Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-03-03 | Enterprise Doc Team | Initial release — full platform documentation |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Overview and Architecture](#2-platform-overview-and-architecture)
   - 2.1 [System Components](#21-system-components)
   - 2.2 [Component Interaction Diagram](#22-component-interaction-diagram)
   - 2.3 [Data Flow Diagram](#23-data-flow-diagram)
   - 2.4 [Technology Stack](#24-technology-stack)
3. [Multi-Tenant Architecture](#3-multi-tenant-architecture)
   - 3.1 [Tenant Isolation Model](#31-tenant-isolation-model)
   - 3.2 [User Role Hierarchy](#32-user-role-hierarchy)
   - 3.3 [Organization Switching](#33-organization-switching)
   - 3.4 [Controller Pattern](#34-controller-pattern)
4. [API Reference](#4-api-reference)
   - 4.1 [Authentication](#41-authentication)
   - 4.2 [Standard Response Format](#42-standard-response-format)
   - 4.3 [Authentication Endpoints](#43-authentication-endpoints)
   - 4.4 [Incident Management Endpoints](#44-incident-management-endpoints)
   - 4.5 [Change Management Endpoints](#45-change-management-endpoints)
   - 4.6 [Problem Management Endpoints](#46-problem-management-endpoints)
   - 4.7 [Alert Endpoints](#47-alert-endpoints)
   - 4.8 [Asset / CMDB Endpoints](#48-asset--cmdb-endpoints)
   - 4.9 [Team and On-Call Endpoints](#49-team-and-on-call-endpoints)
   - 4.10 [Dashboard Endpoints](#410-dashboard-endpoints)
   - 4.11 [Reports Endpoints](#411-reports-endpoints)
   - 4.12 [Webhook Inbound Endpoints](#412-webhook-inbound-endpoints)
   - 4.13 [Notification Endpoints](#413-notification-endpoints)
   - 4.14 [Integration Endpoints](#414-integration-endpoints)
   - 4.15 [Kubernetes Endpoints](#415-kubernetes-endpoints)
   - 4.16 [AI and Intelligence Endpoints](#416-ai-and-intelligence-endpoints)
   - 4.17 [AI Agent Pipeline Endpoints](#417-ai-agent-pipeline-endpoints)
   - 4.18 [PagerDuty Endpoints](#418-pagerduty-endpoints)
   - 4.19 [APM Endpoints](#419-apm-endpoints)
   - 4.20 [SMS Endpoints](#420-sms-endpoints)
   - 4.21 [Voice Endpoints](#421-voice-endpoints)
   - 4.22 [Organization Endpoints](#422-organization-endpoints)
   - 4.23 [Search Endpoint](#423-search-endpoint)
   - 4.24 [Health Check](#424-health-check)
5. [AI Agent Pipeline](#5-ai-agent-pipeline)
   - 5.1 [Pipeline Overview](#51-pipeline-overview)
   - 5.2 [Stage Descriptions](#52-stage-descriptions)
   - 5.3 [Remediation Actions Registry](#53-remediation-actions-registry)
   - 5.4 [Notification Rules](#54-notification-rules)
   - 5.5 [Alert Knowledge Base](#55-alert-knowledge-base)
   - 5.6 [Multi-Tenant Pipeline State](#56-multi-tenant-pipeline-state)
   - 5.7 [PagerDuty Events API Integration](#57-pagerduty-events-api-integration)
6. [Infrastructure and Deployment](#6-infrastructure-and-deployment)
   - 6.1 [Kubernetes Deployment Architecture](#61-kubernetes-deployment-architecture)
   - 6.2 [Container Build Process](#62-container-build-process)
   - 6.3 [Database Management](#63-database-management)
   - 6.4 [Background Jobs](#64-background-jobs)
   - 6.5 [Graceful Shutdown](#65-graceful-shutdown)
7. [Integration Guide](#7-integration-guide)
   - 7.1 [Onboarding a New Client Organization](#71-onboarding-a-new-client-organization)
   - 7.2 [SSH Connectivity Requirements](#72-ssh-connectivity-requirements)
   - 7.3 [Prometheus Integration](#73-prometheus-integration)
   - 7.4 [Grafana Integration](#74-grafana-integration)
   - 7.5 [Kubernetes Cluster Integration](#75-kubernetes-cluster-integration)
   - 7.6 [Slack Integration](#76-slack-integration)
   - 7.7 [PagerDuty Integration](#77-pagerduty-integration)
   - 7.8 [SMS Provider Integration](#78-sms-provider-integration)
   - 7.9 [Voice / IVR Integration](#79-voice--ivr-integration)
8. [Security Architecture](#8-security-architecture)
   - 8.1 [Authentication Flow](#81-authentication-flow)
   - 8.2 [Role-Based Access Control](#82-role-based-access-control)
   - 8.3 [Tenant Isolation Security](#83-tenant-isolation-security)
   - 8.4 [Transport Security](#84-transport-security)
   - 8.5 [Rate Limiting](#85-rate-limiting)
   - 8.6 [SSH Key Management](#86-ssh-key-management)
   - 8.7 [Webhook Security](#87-webhook-security)
9. [Database Schema](#9-database-schema)
   - 9.1 [Schema Overview](#91-schema-overview)
   - 9.2 [Core Models](#92-core-models)
   - 9.3 [ITIL Module Models](#93-itil-module-models)
   - 9.4 [Supporting Models](#94-supporting-models)
   - 9.5 [Enumerations Reference](#95-enumerations-reference)
   - 9.6 [ITIL Numbering Convention](#96-itil-numbering-convention)
10. [Frontend Architecture](#10-frontend-architecture)
    - 10.1 [Application Structure](#101-application-structure)
    - 10.2 [Routing and Code Splitting](#102-routing-and-code-splitting)
    - 10.3 [State Management](#103-state-management)
    - 10.4 [API Layer](#104-api-layer)
    - 10.5 [Design System and Color Tokens](#105-design-system-and-color-tokens)
    - 10.6 [Component Architecture](#106-component-architecture)
11. [Operational Runbook](#11-operational-runbook)
    - 11.1 [SLA Definitions](#111-sla-definitions)
    - 11.2 [Health Check Procedure](#112-health-check-procedure)
    - 11.3 [Deployment Procedure](#113-deployment-procedure)
    - 11.4 [Database Migration Procedure](#114-database-migration-procedure)
    - 11.5 [Incident Response Procedure](#115-incident-response-procedure)
    - 11.6 [Troubleshooting Guide](#116-troubleshooting-guide)
12. [Glossary](#12-glossary)
13. [Appendices](#13-appendices)
    - A. [Client Organization SSH Reference](#appendix-a-client-organization-ssh-reference)
    - B. [Integration Configuration Schema](#appendix-b-integration-configuration-schema)
    - C. [Environment Variables Reference](#appendix-c-environment-variables-reference)

---

## 1. Executive Summary

Argus is an enterprise-grade IT Service Management (ITSM) platform developed by Santhira (Terv Pro Technology Pvt Ltd). The platform provides a unified command center for managing IT operations across multiple client organizations, replacing fragmented point tools with a single, AI-augmented platform that handles the full ITIL v4 service management lifecycle.

Argus serves 13 active client organizations — primarily financial institutions — providing incident management, change control, problem investigation, asset/CMDB tracking, alerting, on-call scheduling, and automated remediation. The platform ingests real-time telemetry from Prometheus and Grafana, performs AI-assisted root cause analysis using the Qwen3-32B large language model, and executes remediation actions autonomously on remote infrastructure via SSH tunneling.

The platform's AI Agent Pipeline processes alerts end-to-end — from detection through triage, enrichment, remediation, notification, and verification — entirely within the API process with zero additional infrastructure. This approach eliminates the operational overhead of external automation engines while delivering sub-minute response times to critical infrastructure events.

Argus is deployed on Kubernetes (namespace: `fs-linkedeye`) and is accessible at `https://fs-le-dev-inc.finspot.in`. The platform is designed for financial-grade reliability and maintains strict tenant isolation: every data record is scoped to an organization, and all API queries enforce this boundary at the middleware layer.

---

## 2. Platform Overview and Architecture

### 2.1 System Components

Argus consists of the following major components:

**Backend API Server**
The core application server built on Node.js 20 and Express.js. It exposes a REST API under `/api/v1/`, handles all business logic through a layered controller-service-ORM architecture, and runs background jobs for SLA compliance checking and email processing.

**PostgreSQL Database**
The primary data store, managed through Prisma ORM. Two separate instances are in use: a local development database (`localhost:5432`) and the Kubernetes production database (`postgres.fs-linkedeye:5432`, ClusterIP `10.97.121.123`). The schema contains 28 enumerations and 20+ models, all tenant-scoped via `organizationId`.

**Redis Cache**
Redis 7 provides session caching and response caching for performance-critical endpoints. Cache middleware is applied at the route level with configurable TTLs (30 to 300 seconds depending on endpoint sensitivity).

**React Frontend**
A single-page application built with React 19 and TypeScript. All routes are lazy-loaded with React.lazy for optimal performance. The frontend communicates with the backend exclusively through a centralized Axios instance (`frontend-react/src/lib/api.ts`) that handles authentication tokens and multi-tenant organization headers automatically.

**Socket.IO Real-Time Layer**
WebSocket connections via Socket.IO provide real-time event delivery for alerts, incidents, and pipeline execution updates. The Socket.IO server is initialized on the same HTTP server as the Express application.

**AI Agent Pipeline**
An in-process automation engine (no additional pods required) that processes incoming alerts through a six-stage pipeline: Detect → Triage → Enrich → Act → Notify → Verify. The pipeline maintains per-organization state in memory and supports granular enable/disable controls for each remediation action and notification rule.

**SSH Infrastructure Gateway**
The backend acts as an SSH proxy to reach remote client infrastructure. Using the `k8sService.js` module and an Ed25519 key mounted from a Kubernetes secret, the API executes `kubectl` commands and Prometheus PromQL queries on remote servers behind client firewalls.

**Voice IVR System**
A Twilio-based inbound and outbound voice system with speech-to-text (Whisper STT) and text-to-speech (XTTS v2 via a FastAPI server on port 8100). Inbound calls are routed through an IVR flow that announces incident details and enables escalation.

**AgentForge Sub-Project**
A separate FastAPI (Python) backend and React frontend in the `agentforge/` directory. AgentForge is an AI Agent Hub with its own Docker Compose configuration. It is not part of the main Argus build pipeline.

### 2.2 Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT ORGANIZATIONS (13)                    │
│  Prometheus  Grafana  Kubernetes  StackStorm  Apprise  node-exporter │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ SSH (Ed25519) / HTTPS Webhooks
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Kubernetes Namespace: fs-linkedeye                  │
│                                                                      │
│  ┌──────────────────────────┐    ┌──────────────────────────────┐   │
│  │   React Frontend (v19)   │    │   Express API Server (v2)    │   │
│  │   Port: 80/443 (Ingress) │◄──►│   Port: 5000                 │   │
│  │   Vite / TailwindCSS     │    │                              │   │
│  │   Zustand / TanStack Q   │    │   ┌──────────────────────┐   │   │
│  └──────────────────────────┘    │   │  AI Agent Pipeline   │   │   │
│                                  │   │  (in-process)        │   │   │
│  ┌──────────────────────────┐    │   └──────────────────────┘   │   │
│  │       Redis 7             │◄──►│                              │   │
│  │   Session / Cache         │    │   ┌──────────────────────┐   │   │
│  └──────────────────────────┘    │   │  SSH Gateway         │   │   │
│                                  │   │  k8sService.js       │   │   │
│  ┌──────────────────────────┐    │   └──────────────────────┘   │   │
│  │    PostgreSQL 16          │◄──►│                              │   │
│  │  postgres.fs-linkedeye    │    │   ┌──────────────────────┐   │   │
│  │    Port: 5432             │    │   │  Socket.IO (WS)      │   │   │
│  └──────────────────────────┘    │   └──────────────────────┘   │   │
│                                  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
        │                │                │                │
    Slack          PagerDuty         Twilio SMS/Voice    Ollama AI
   Webhooks        Events API v2       IVR/STT/TTS      Qwen3-32B
```

### 2.3 Data Flow Diagram

**Alert Ingestion Flow:**

```
Prometheus Alertmanager
        │
        │ POST /api/v1/webhooks/alertmanager
        ▼
 Org Resolution
 (org_slug label → IP match → organizationId)
        │
        ▼
  Alert Created in DB ──► Socket.IO: alert:fired ──► Frontend
        │
        │ (async, non-blocking)
        ▼
  AI Agent Pipeline
  ┌─────────────────────────────────────────────────────┐
  │  Detect → Triage → Enrich → Act → Notify → Verify  │
  └─────────────────────────────────────────────────────┘
        │                    │
        │ (CRITICAL/WARNING) │ (all severities)
        ▼                    ▼
  Auto-Incident        Slack Notification
  Created in DB        PagerDuty Event
        │
        ▼
  Team Auto-Assignment
  (CMDB → Category → On-Call Schedule)
```

**API Request Flow:**

```
Client Request
      │
      ▼
   helmet → cors → compression → express.json → cookieParser
      │
      ▼
   morganMiddleware (request logging)
      │
      ▼
   globalLimiter (rate limiting)
      │
      ▼
   Route Handler
      │
      ▼
   authenticate() middleware
   ├── Verify JWT (Bearer header or accessToken cookie)
   ├── Load user from DB
   └── Set req.tenantWhere + req.organizationId
      │
      ▼
   authorize() or checkPermission() (RBAC)
      │
      ▼
   Controller → Service → Prisma ORM → PostgreSQL
      │
      ▼
   { success, data, pagination? }
```

### 2.4 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 20+ | Backend API server |
| Framework | Express.js | 4.x | HTTP routing and middleware |
| ORM | Prisma | 5.x | Database access layer |
| Database | PostgreSQL | 16 | Primary data store |
| Cache | Redis | 7 | Session and response caching |
| Frontend Framework | React | 19 | Single-page application |
| Frontend Language | TypeScript | 5.9 | Type-safe frontend code |
| Frontend Build | Vite | 7 | Development server and bundler |
| Frontend Styling | TailwindCSS | 3.4 | Utility-first CSS framework |
| State Management | Zustand | 5 | Client-side state |
| Server State | TanStack Query | 5 | Server data fetching and caching |
| Frontend Routing | React Router | v6 | Client-side routing |
| WebSocket | Socket.IO | — | Real-time event delivery |
| Authentication | JWT | — | Stateless authentication |
| Container Runtime | nerdctl / containerd | — | Container builds |
| Orchestration | Kubernetes | — | Production deployment |
| AI (Local) | Ollama / Qwen3-32B | — | Root cause analysis, chat |
| AI (Cloud) | OpenAI / Anthropic SDKs | — | Fallback AI provider |
| Voice | Twilio | — | Inbound/outbound IVR |
| STT | Whisper | — | Speech-to-text |
| TTS | XTTS v2 (FastAPI) | — | Text-to-speech (port 8100) |
| HTTP Client | Axios | — | Frontend API calls |
| Charts | Recharts | — | Data visualization |
| Icons | lucide-react | — | UI icon library |
| Forms | react-hook-form + zod | — | Form validation |

---

## 3. Multi-Tenant Architecture

### 3.1 Tenant Isolation Model

Argus implements organization-level multi-tenancy. Every data model that contains client data includes an `organizationId String?` field that references the `Organization` model. Tenant isolation is enforced at the middleware layer on every authenticated request.

The tenant context is injected by the `authenticate()` function in `backend/src/middleware/auth.js`. It sets two properties on the Express request object:

- `req.organizationId` — the effective organization UUID for this request
- `req.tenantWhere` — a Prisma `where` clause fragment to be spread into all database queries

This design ensures that tenant isolation cannot be bypassed by controller logic because the filter is applied before any controller code executes.

**Tenant Resolution Logic:**

```javascript
// From backend/src/middleware/auth.js

if (user.role === 'ADMIN') {
  const headerOrgId = req.query.orgId || req.headers['x-organization-id'];
  if (user.organizationId) {
    // Org-admin: defaults to own org; header can override
    const effectiveOrgId = headerOrgId || user.organizationId;
    req.organizationId = effectiveOrgId;
    req.tenantWhere = { organizationId: effectiveOrgId };
  } else {
    // Super-admin (no org): sees all unless header specifies
    req.organizationId = headerOrgId || null;
    req.tenantWhere = headerOrgId ? { organizationId: headerOrgId } : {};
  }
} else {
  // All non-ADMIN roles: locked to their organization
  req.organizationId = user.organizationId || null;
  req.tenantWhere = user.organizationId ? { organizationId: user.organizationId } : {};
}
```

### 3.2 User Role Hierarchy

| Role | Description | Org Scope | Example Permissions |
|------|-------------|-----------|---------------------|
| ADMIN (no org) | Super-administrator | All organizations | Full access to all tenants, org management |
| ADMIN (with org) | Organization administrator | Own org + switchable | Full access within org, can switch via header |
| MANAGER | Team/operations manager | Own org only | Create/edit incidents, changes; manage teams |
| ENGINEER | Technical engineer | Own org only | Create/update incidents, changes, problems |
| OPERATOR | Operations analyst | Own org only | Acknowledge alerts, add work notes |
| VIEWER | Read-only user | Own org only | Read-only access to all modules |

### 3.3 Organization Switching

Admin users can filter data by organization using one of two mechanisms:

1. **HTTP Header:** Include `X-Organization-Id: <org-uuid>` in every request
2. **Query Parameter:** Append `?orgId=<org-uuid>` to any request URL

The frontend stores the selected organization in Zustand (`selectedOrgId` in `authStore.ts`, persisted to `localStorage` under the key `linkedeye-auth`) and automatically attaches the `X-Organization-Id` header via the Axios request interceptor in `frontend-react/src/lib/api.ts`.

The frontend OrgSwitcher component (located in the sidebar, visible only to ADMIN users) calls `setSelectedOrg(orgId)` on the Zustand store, which immediately updates the header for all subsequent API calls without requiring re-login.

### 3.4 Controller Pattern

Every controller that queries tenant-scoped data follows this mandatory pattern:

```javascript
// Correct pattern — spread tenantWhere into every Prisma query
const incidents = await prisma.incident.findMany({
  where: {
    ...req.tenantWhere,   // { organizationId: 'xxx' } or {}
    state: 'OPEN',
  },
  orderBy: { createdAt: 'desc' },
});
```

WARNING: Any controller that omits `...req.tenantWhere` from a Prisma query creates a tenant data leak. All new controllers must follow this pattern without exception.

---

## 4. API Reference

### 4.1 Authentication

All API endpoints except the following require a valid JWT Bearer token:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /health`
- `POST /api/v1/webhooks/alertmanager`
- `POST /api/v1/webhooks/grafana`
- `POST /api/v1/webhooks/slack/commands`
- `POST /api/v1/webhooks/slack/interactive`
- `POST /api/v1/webhooks/servicenow`
- `POST /api/v1/webhooks/generic`
- `POST /api/v1/webhooks/twilio/*`
- `POST /api/v1/webhooks/msg91/delivery`
- `POST /api/v1/webhooks/kaleyra/delivery`
- `POST /api/v1/alerts/webhook`
- `POST /api/v1/pagerduty/webhook`

**Token Delivery:**

Provide the JWT in one of two ways:

```
Authorization: Bearer <access_token>
```

or as an `accessToken` HTTP cookie.

**Multi-Tenant Header:**

```
X-Organization-Id: <organization-uuid>
```

Include this header (or use `?orgId=<uuid>`) whenever an admin user needs to operate in a specific organization context.

### 4.2 Standard Response Format

All API responses follow this envelope:

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Resource created |
| 400 | Validation error or bad request |
| 401 | Authentication required or token expired |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable (health check failure) |

### 4.3 Authentication Endpoints

**Base path:** `/api/v1/auth`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/login` | No | — | Authenticate with email and password |
| POST | `/register` | Yes | ADMIN | Create a new user account |
| POST | `/refresh` | No | — | Refresh access token using refresh token |
| POST | `/logout` | Yes | Any | Invalidate current session |
| GET | `/me` | Yes | Any | Get current user profile |
| PUT | `/me` | Yes | Any | Update current user profile |
| POST | `/change-password` | Yes | Any | Change own password |
| GET | `/users` | Yes | ADMIN, MANAGER | List all users |

**POST /api/v1/auth/login — Request:**

```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123"
}
```

**POST /api/v1/auth/login — Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "organizationId": "org-uuid-or-null"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "organization": { "id": "...", "name": "...", "slug": "...", "environment": "PROD" }
  }
}
```

NOTE: The `authLimiter` rate limiter is applied to `POST /login` to prevent brute-force attacks. Accounts are locked after repeated failed login attempts (`loginAttempts` and `lockedUntil` fields on the User model).

**POST /api/v1/auth/register — Request:**

```json
{
  "email": "engineer@client.com",
  "password": "MinEight8Chars",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "ENGINEER",
  "organizationId": "org-uuid"
}
```

**POST /api/v1/auth/refresh — Request:**

```json
{
  "refreshToken": "eyJhbGci..."
}
```

### 4.4 Incident Management Endpoints

**Base path:** `/api/v1/incidents`
**Auth:** Required (all endpoints)
**Permission resource:** `incidents`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/` | read | List incidents with pagination and filtering |
| GET | `/:id` | read | Get single incident with full detail |
| POST | `/` | create | Create a new incident |
| PATCH | `/:id` | update | Update incident fields or state |
| DELETE | `/:id` | delete | Delete an incident |
| POST | `/:id/notes` | update | Add a work note to an incident |
| GET | `/:id/timeline` | read | Get full activity timeline |
| GET | `/:id/live-context` | read | Get live Prometheus metrics for incident CI |
| POST | `/:id/changes` | update | Link a Change to this incident |
| POST | `/:id/problems` | update | Link a Problem to this incident |
| POST | `/bulk-report` | read | Generate a bulk incident report |
| GET | `/:id/report` | read | Generate a single incident PDF report |

**GET /api/v1/incidents — Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default: 1) |
| limit | integer | Records per page (default: 20, max: 100) |
| state | string | Filter by IncidentState enum value |
| priority | string | Filter by Priority (P1, P2, P3, P4) |
| assignedToId | uuid | Filter by assigned user |
| search | string | Full-text search on description |

**POST /api/v1/incidents — Request Body:**

```json
{
  "shortDescription": "Database connection pool exhausted on prod-db-01",
  "description": "Detailed description of the incident",
  "impact": "DEPARTMENT",
  "urgency": "HIGH",
  "category": "Database",
  "subcategory": "Connection",
  "assignedToId": "user-uuid",
  "assignmentGroupId": "team-uuid",
  "configItemId": "ci-uuid"
}
```

**Incident State Transitions:**

```
NEW → IN_PROGRESS → ON_HOLD → ESCALATED → RESOLVED → CLOSED
                                                    → CANCELLED
```

**Priority Calculation:**
Priority is determined by the combination of Impact and Urgency:

| Impact \ Urgency | CRITICAL | HIGH | MEDIUM | LOW |
|-----------------|----------|------|--------|-----|
| ENTERPRISE | P1 | P1 | P2 | P3 |
| DEPARTMENT | P1 | P2 | P3 | P3 |
| TEAM | P2 | P3 | P3 | P4 |
| INDIVIDUAL | P3 | P3 | P4 | P4 |

**Incident Source Values:**
`MANUAL`, `PROMETHEUS`, `GRAFANA`, `API`, `EMAIL`, `VOICE`, `SLACK`

### 4.5 Change Management Endpoints

**Base path:** `/api/v1/changes`
**Auth:** Required
**Permission resource:** `changes`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/` | read | List changes with pagination |
| GET | `/:id` | read | Get single change with approvals |
| POST | `/` | create | Create a new change request |
| PATCH | `/:id` | update | Update change details |
| POST | `/:id/submit` | update | Submit change for approval |
| POST | `/:id/approve` | (authenticated) | Approve the change |
| POST | `/:id/reject` | (authenticated) | Reject the change |

**Change State Lifecycle:**

```
NEW → ASSESSMENT → APPROVAL → SCHEDULED → IMPLEMENTING → REVIEW → CLOSED
                                                                → CANCELLED
```

**Change Types:** `NORMAL`, `STANDARD`, `EMERGENCY`
**Risk Levels:** `HIGH`, `MEDIUM`, `LOW`

**POST /api/v1/changes — Key Request Fields:**

```json
{
  "shortDescription": "Upgrade PostgreSQL from 15 to 16",
  "type": "NORMAL",
  "riskLevel": "HIGH",
  "justification": "Security patches and performance improvements",
  "implementationPlan": "Step-by-step implementation plan",
  "rollbackPlan": "Restore from snapshot taken pre-upgrade",
  "testPlan": "Run integration test suite post-upgrade",
  "plannedStartDate": "2026-03-10T02:00:00Z",
  "plannedEndDate": "2026-03-10T04:00:00Z",
  "affectedServices": "Payment Gateway, Reporting Service"
}
```

### 4.6 Problem Management Endpoints

**Base path:** `/api/v1/problems`
**Auth:** Required
**Permission resource:** `problems`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/` | read | List problems with pagination |
| GET | `/stats` | read | Aggregate problem statistics |
| GET | `/:id` | read | Get single problem with RCA data |
| POST | `/` | create | Create a new problem record |
| PATCH | `/:id` | update | Update problem fields |
| PATCH | `/:id/rca` | update | Update root cause analysis fields |
| POST | `/:id/notes` | update | Add a work note |
| POST | `/:id/ai-rca` | update | Trigger AI-assisted root cause analysis |

**Problem State Lifecycle:**

```
NEW → INVESTIGATION → RCA_IN_PROGRESS → KNOWN_ERROR → RESOLVED → CLOSED
```

**POST /api/v1/problems/:id/ai-rca**

Triggers an asynchronous root cause analysis using Ollama (Qwen3-32B) with fallback to the ALERT_KB pattern-matching knowledge base. The response includes the structured RCA stored in the `rootCauseAnalysis` JSON field of the Problem model.

NOTE: The AI RCA endpoint may take 15–60 seconds to complete depending on model load. The result is written back to the Problem record and returned in the response.

### 4.7 Alert Endpoints

**Base path:** `/api/v1/alerts`
**Auth:** Required (except `/webhook`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhook` | No (rate-limited) | Receive raw alert webhook |
| GET | `/` | Yes | List alerts with filtering |
| GET | `/stats` | Yes | Alert count statistics by severity/status |
| GET | `/kb` | Yes | Retrieve the Alert Knowledge Base entries |
| GET | `/:id` | Yes | Get single alert detail |
| POST | `/:id/acknowledge` | Yes | Acknowledge a firing alert |
| POST | `/:id/silence` | Yes | Silence an alert for a duration |
| POST | `/:id/create-incident` | Yes (incidents:create) | Manually create incident from alert |

**GET /api/v1/alerts — Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| severity | string | CRITICAL, WARNING, INFO |
| status | string | FIRING, RESOLVED, ACKNOWLEDGED, SILENCED |
| source | string | PROMETHEUS, GRAFANA, CUSTOM |
| page | integer | Pagination page |
| limit | integer | Records per page |

### 4.8 Asset / CMDB Endpoints

**Base path:** `/api/v1/assets`
**Auth:** Required
**Permission resource:** `assets`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/` | read | List configuration items |
| GET | `/stats` | read | Asset statistics by type and status |
| GET | `/:id` | read | Get single CI with full detail |
| POST | `/` | create | Create a new configuration item |
| PATCH | `/:id` | update | Update CI attributes |
| DELETE | `/:id` | delete | Delete a CI |

**CI Types:** `SERVER`, `KUBERNETES_CLUSTER`, `DATABASE`, `APPLICATION`, `NETWORK`, `STORAGE`, `CONTAINER`, `VM`, `LOAD_BALANCER`
**CI Statuses:** `LIVE`, `MAINTENANCE`, `DECOMMISSIONED`, `PLANNED`

**Live Metrics:** For CIs linked to monitored assets, use `GET /api/v1/ai/assets/:id/live-metrics` and `GET /api/v1/ai/assets/:id/metrics-history` for real-time and historical Prometheus data.

### 4.9 Team and On-Call Endpoints

**Base path:** `/api/v1/teams`
**Auth:** Required
**Permission resource:** `teams`

| Method | Path | Permission/Role | Description |
|--------|------|----------------|-------------|
| GET | `/` | read | List all teams in organization |
| GET | `/on-call/overview` | read | Overview of all teams' current on-call status |
| GET | `/:id` | read | Get team with members and schedules |
| POST | `/` | create | Create a new team |
| PATCH | `/:id` | update | Update team details |
| POST | `/:id/members` | update | Add a member to a team |
| DELETE | `/:id/members/:userId` | update | Remove a member from a team |
| GET | `/:id/on-call` | read | Current on-call schedule for team |
| GET | `/:id/on-call/history` | read | Historical on-call schedule |
| POST | `/:id/on-call` | ADMIN, MANAGER | Create an on-call schedule entry |
| GET | `/:id/escalation` | read | Get escalation policies for team |

**POST /api/v1/teams/:id/on-call — Request Body:**

```json
{
  "userId": "user-uuid",
  "startTime": "2026-03-10T00:00:00Z",
  "endTime": "2026-03-17T00:00:00Z",
  "isPrimary": true
}
```

**Team Member Roles:** `LEAD`, `MEMBER`, `OBSERVER`

### 4.10 Dashboard Endpoints

**Base path:** `/api/v1/dashboard`
**Auth:** Required
**Cache:** Responses are cached in Redis (30–60 second TTL)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Aggregate counts: open incidents, alerts by severity, SLA breaches, changes in progress |
| GET | `/incident-trend` | Incident count trend data for the past 30 days |
| GET | `/sla-compliance` | SLA compliance percentage by priority across all incidents |

### 4.11 Reports Endpoints

**Base path:** `/api/v1/reports`
**Auth:** Required

| Method | Path | Role Restriction | Description |
|--------|------|-----------------|-------------|
| GET | `/incidents` | Any | Incident report with date range filtering |
| GET | `/incident-trend` | Any | Trend data for charting |
| GET | `/changes` | Any | Change report with filtering |
| GET | `/team-performance` | ADMIN, MANAGER | Team SLA and resolution metrics |
| GET | `/executive-summary` | Any | High-level summary for executive stakeholders |

### 4.12 Webhook Inbound Endpoints

**Base path:** `/api/v1/webhooks`
**Auth:** None (webhooks use their own verification mechanisms)

| Method | Path | Source | Description |
|--------|------|--------|-------------|
| POST | `/alertmanager` | Prometheus Alertmanager | Ingest firing/resolved alerts |
| POST | `/grafana` | Grafana | Ingest Grafana alert notifications |
| POST | `/slack/commands` | Slack | Handle Slack slash commands |
| POST | `/slack/interactive` | Slack | Handle Slack interactive components |
| POST | `/servicenow` | ServiceNow | Receive ServiceNow event payloads |
| POST | `/generic` | Any | Generic webhook receiver |
| POST | `/twilio/sms` | Twilio | Inbound SMS (HMAC-SHA1 verified) |
| POST | `/twilio/voice` | Twilio | Inbound voice call (HMAC-SHA1 verified) |
| POST | `/twilio/speech` | Twilio | Speech recognition result callback |
| POST | `/twilio/gather` | Twilio | DTMF gather result callback |
| POST | `/twilio/status` | Twilio | Call status callback |
| POST | `/msg91/delivery` | MSG91 | SMS delivery status callback |
| POST | `/kaleyra/delivery` | Kaleyra | SMS delivery status callback |

**Prometheus Alertmanager Webhook Payload:**

```json
{
  "status": "firing",
  "groupLabels": { "alertname": "NodeDiskRunningFull" },
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "NodeDiskRunningFull",
        "severity": "critical",
        "instance": "10.41.0.110:9100",
        "org_slug": "lemonn-le"
      },
      "annotations": {
        "summary": "Disk almost full on node",
        "description": "Node disk at 92% capacity",
        "value": "92.3"
      },
      "startsAt": "2026-03-03T10:00:00Z",
      "fingerprint": "abc123"
    }
  ]
}
```

**Organization Resolution Order (Alertmanager):**
1. `org_slug` label → lookup by `Organization.slug`
2. `organization` or `client` label → lookup by `Organization.slug`
3. Instance IP extracted from `instance` label → lookup by `Organization.serverIp`

**Grafana Webhook URL Pattern:**

```
POST https://fs-le-dev-inc.finspot.in/api/v1/webhooks/grafana?orgId=<org-uuid>
```

or

```
POST https://fs-le-dev-inc.finspot.in/api/v1/webhooks/grafana?orgSlug=<slug>
```

### 4.13 Notification Endpoints

**Base path:** `/api/v1/notifications`
**Auth:** Required

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List notifications for current user |
| GET | `/unread-count` | Get count of unread notifications |
| PATCH | `/:id/read` | Mark a notification as read |
| POST | `/read-all` | Mark all notifications as read |

### 4.14 Integration Endpoints

**Base path:** `/api/v1/integrations`
**Auth:** Required
**Permission resource:** `integrations`

| Method | Path | Permission/Role | Description |
|--------|------|----------------|-------------|
| GET | `/` | read | List all integrations for org |
| GET | `/:id` | read | Get integration with configuration |
| POST | `/` | ADMIN | Create a new integration |
| PATCH | `/:id` | ADMIN | Update integration configuration |
| POST | `/:id/test` | ADMIN, MANAGER | Test integration connectivity |

**Integration Types:** `SLACK`, `SERVICENOW`, `PROMETHEUS`, `GRAFANA`, `LOKI`, `EMAIL`, `TWILIO`, `MSG91`, `KALEYRA`, `WEBHOOK`, `N8N`, `KUBERNETES_CLUSTER`, `STACKSTORM`, `PAGERDUTY`, `APPRISE`

**Integration Configuration JSON Schema (Infrastructure):**

```json
{
  "accessMethod": "ssh",
  "serverIp": "154.210.170.126",
  "sshPort": 4422,
  "sshUser": "finadmin",
  "promPort": 30000,
  "grafanaPort": 30010,
  "prometheusUrl": "http://154.210.170.126:30000",
  "grafanaExternalUrl": "http://lemonn.finspot.in:30010"
}
```

### 4.15 Kubernetes Endpoints

**Base path:** `/api/v1/k8s`
**Auth:** Required (authenticate + tenantContext middleware)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Cluster overview: nodes, pod counts, namespace summary |
| GET | `/pods` | List pods in a namespace (default: `fs-linkedeye`) |
| GET | `/deployments` | List deployments with replica health |
| GET | `/events` | Warning events (last 20, most recent first) |
| GET | `/services` | List services with port mappings |

**Query Parameters for `/pods`, `/deployments`, `/events`, `/services`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| namespace | string | Kubernetes namespace (defaults to `fs-linkedeye`) |

NOTE: All Kubernetes API calls execute kubectl commands on the remote client server via SSH. The target server and credentials are resolved from the organization's `KUBERNETES_CLUSTER` integration record. Response times depend on SSH round-trip latency (typically 1–3 seconds).

### 4.16 AI and Intelligence Endpoints

**Base path:** `/api/v1/ai`
These endpoints are split across two route files that both mount on `/api/v1/ai`.

**From `ai.routes.js` (AI chat and classification):**

| Method | Path | Cache TTL | Description |
|--------|------|-----------|-------------|
| GET | `/stats` | 30s | AI system usage statistics |
| GET | `/classifications` | — | Recent AI incident classifications |
| GET | `/suggestions` | — | AI-generated resolution suggestions |
| POST | `/chat` | — | Chat with AI assistant (Ollama/OpenAI) |

**From `aiAgent.routes.js` (Infrastructure intelligence):**

| Method | Path | Cache TTL | Description |
|--------|------|-----------|-------------|
| GET | `/cluster-health` | 60s | K8s cluster health analysis |
| GET | `/server-analysis` | 60s | Server metrics analysis via Prometheus |
| GET | `/db-analysis` | 60s | Database performance analysis |
| GET | `/log-analysis` | 30s | Log pattern analysis via Loki |
| GET | `/incidents/:id/resolution-details` | — | Resolution context for an incident |
| GET | `/tips` | 120s | Operational tips and recommendations |
| GET | `/assets/:id/live-metrics` | 30s | Live Prometheus metrics for a CI |
| GET | `/assets/:id/metrics-history` | 60s | Historical metric trend data (range query) |
| GET | `/grafana-dashboards` | 300s | List Grafana dashboards for org |
| GET | `/infrastructure-metrics` | 30s | Infrastructure-wide metrics snapshot |

**GET /api/v1/ai/assets/:id/live-metrics — Response (example):**

```json
{
  "success": true,
  "data": {
    "cpu": { "usage": 7.3 },
    "memory": { "usedBytes": 12884901888, "totalBytes": 33822867456, "usedPercent": 38.1 },
    "disk": { "usedPercent": 45.2, "readBytesPerSec": 1234567, "writeBytesPerSec": 987654 },
    "network": { "receiveBytesPerSec": 5000000, "transmitBytesPerSec": 3000000 },
    "load": { "1m": 0.45, "5m": 0.52, "15m": 0.48 },
    "uptime": 2592000
  }
}
```

### 4.17 AI Agent Pipeline Endpoints

**Base path:** `/api/v1/agent`
**Auth:** Required

| Method | Path | Role Restriction | Description |
|--------|------|-----------------|-------------|
| GET | `/status` | Any | Pipeline status and statistics for current org |
| POST | `/toggle` | ADMIN, MANAGER | Enable or disable the pipeline for current org |
| GET | `/actions` | Any | List all remediation actions with enabled state |
| POST | `/actions/:actionId/toggle` | ADMIN, MANAGER | Enable or disable a remediation action |
| GET | `/notifications` | Any | List all notification rules with enabled state |
| POST | `/notifications/:ruleId/toggle` | ADMIN, MANAGER | Enable or disable a notification rule |
| GET | `/executions` | Any | Paginated execution log |
| GET | `/executions/:id` | Any | Get a single execution record with step details |

**POST /api/v1/agent/toggle — Request Body:**

```json
{ "enabled": true }
```

**POST /api/v1/agent/actions/:actionId/toggle — Request Body:**

```json
{ "enabled": false }
```

**GET /api/v1/agent/status — Response (abbreviated):**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "totalExecutions": 142,
    "successfulExecutions": 138,
    "failedExecutions": 4,
    "successRate": "97.2",
    "lastExecutionAt": "2026-03-03T09:45:00.000Z",
    "remediationActions": [...],
    "notificationRules": [...],
    "recentExecutions": [...]
  }
}
```

### 4.18 PagerDuty Endpoints

**Base path:** `/api/v1/pagerduty`
**Auth:** Required (except `/webhook`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/webhook` | No auth | Receive PagerDuty webhook events |
| POST | `/validate` | ADMIN, MANAGER | Validate PagerDuty API key |
| POST | `/connect` | ADMIN | Connect PagerDuty integration |
| DELETE | `/disconnect` | ADMIN | Disconnect PagerDuty integration |
| GET | `/status` | Any | Connection status |
| GET | `/overview` | Any | Summary overview |
| GET | `/services` | Any | List PagerDuty services |
| GET | `/incidents` | Any | List PagerDuty incidents |
| GET | `/oncall` | Any | Current on-call users |
| GET | `/escalation-policies` | Any | Escalation policies |
| GET | `/users` | Any | PagerDuty users |
| GET | `/stats` | Any | Statistics |

### 4.19 APM Endpoints

**Base path:** `/api/v1/apm`
**Auth:** Required

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Full APM snapshot: all metrics in one response |
| GET | `/process-status` | Running process health |
| GET | `/url-status` | HTTP endpoint health checks |
| GET | `/infra-metrics` | Infrastructure resource metrics |
| GET | `/network` | Network connectivity status |
| GET | `/k8s-health` | Kubernetes cluster health summary |
| GET | `/services` | Application service health |
| GET | `/active-alerts` | Currently firing alerts |
| POST | `/annotations` | Add a deployment or event annotation |

### 4.20 SMS Endpoints

**Base path:** `/api/v1/sms`
**Auth:** Required

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/send` | ADMIN, MANAGER, ENGINEER | Send a single SMS |
| POST | `/bulk` | ADMIN, MANAGER | Send bulk SMS |
| GET | `/logs` | Any | Paginated SMS log |
| GET | `/logs/:id` | Any | Single SMS log entry |
| GET | `/stats` | Any | SMS delivery statistics |
| GET | `/providers` | ADMIN | SMS provider status |
| GET | `/delivery-status/:messageId` | Any | Check delivery status |

**SMS Providers:** Twilio, MSG91, Kaleyra

### 4.21 Voice Endpoints

**Base path:** `/api/v1/voice`
**Auth:** Required

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/transcribe` | Any | Transcribe audio file to text (Whisper STT) |
| POST | `/synthesize` | Any | Convert text to speech (XTTS v2) |
| POST | `/chat` | Any | Voice-based AI chat (audio in, audio out) |
| POST | `/call` | ADMIN, MANAGER | Initiate an outbound Twilio call |
| GET | `/calls` | Any | Paginated call logs |
| GET | `/calls/:id` | Any | Single call log with transcript |
| GET | `/stats` | Any | Voice system statistics |
| GET | `/languages` | Any | List supported STT/TTS languages |
| GET | `/health` | Any | Voice service health check |

**POST /api/v1/voice/transcribe:**
Accepts multipart/form-data with a single `audio` file field. Supported formats: WAV, MP3, OGG, WebM, FLAC. Maximum file size: 25 MB.

### 4.22 Organization Endpoints

**Base path:** `/api/v1/organizations`
**Auth:** Required
**Role:** ADMIN only (all endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all organizations |
| GET | `/:id` | Get single organization |
| POST | `/` | Create a new organization |
| PATCH | `/:id` | Update organization details |

**POST /api/v1/organizations — Request Body:**

```json
{
  "name": "Acme Financial Services",
  "slug": "acme-fin",
  "environment": "PROD",
  "serverIp": "203.0.113.10",
  "fqdn": "acme.finspot.in",
  "description": "Primary production environment for Acme Financial"
}
```

**Environment Values:** `PROD`, `DR`, `UAT`, `DEV`

### 4.23 Search Endpoint

**Base path:** `/api/v1/search`
**Auth:** Required

| Method | Path | Description |
|--------|------|-------------|
| GET | `/?q=<term>` | Global full-text search across incidents, changes, problems, assets |

The search endpoint respects tenant isolation — results are filtered to the current user's organization context.

### 4.24 Health Check

```
GET /health
```

No authentication required. Returns service status and database connectivity.

**Response:**

```json
{
  "status": "healthy",
  "service": "linkedeye-api",
  "version": "2.0.0",
  "uptime": 86400.5,
  "timestamp": "2026-03-03T10:00:00.000Z",
  "database": "connected"
}
```

Returns HTTP 503 with `"status": "unhealthy"` if the database is unreachable.

---

## 5. AI Agent Pipeline

### 5.1 Pipeline Overview

The AI Agent Pipeline is an event-driven automation engine embedded directly within the Argus API process. It replaces external automation platforms (such as StackStorm) with zero additional infrastructure pods. The pipeline is triggered asynchronously every time a new alert is persisted to the database via any webhook endpoint.

The pipeline executes six sequential stages for each alert:

```
DETECT → TRIAGE → ENRICH → ACT → NOTIFY → VERIFY
```

Execution records are stored in an in-memory ring buffer (last 100 per organization) and broadcast to connected clients via Socket.IO on the `pipeline:execution` event channel.

NOTE: Pipeline state (enabled/disabled, action overrides, execution log) is held in process memory and is NOT persisted to the database. A pod restart resets all overrides to their global defaults.

### 5.2 Stage Descriptions

**Stage 1: DETECT**
The incoming alert is received from the webhook controller with its name, severity, labels, and organization context. The stage logs the alert receipt and passes it to triage.

**Stage 2: TRIAGE**
The pipeline attempts to match the alert to a remediation action from the `REMEDIATION_ACTIONS` registry. Matching is performed in two passes:

1. Exact match: alert name compared against each action's `matchAlerts` array (case-insensitive substring matching)
2. Fuzzy match: alert name keywords (`disk`, `mem`, `oom`, `crash`, `pod`, `node`) matched to action categories

If no action is matched, the pipeline continues in notification-only mode.

**Stage 3: ENRICH**
Context is gathered from two sources:
- Prometheus integration config for the organization (resolves access method: `ssh`, `direct`, or `local`)
- CMDB (`configurationItems` table) by matching the alert's `instance` IP to a stored `ipAddress`

The enrichment result includes: IP, hostname, Kubernetes namespace, pod name, organization name, environment, and access method details.

**Stage 4: ACT**
Auto-remediation executes only when all three conditions are satisfied:
1. Alert severity is `CRITICAL`
2. The matched action has executable commands defined (not diagnostic-only)
3. The organization's integration `accessMethod` is `ssh`

Commands are executed sequentially via SSH using `k8sService.sshCmd()`. The output of each command (truncated to 500 characters) is recorded. After execution, the result is appended as an internal work note (source: `AI`) to the linked incident if one exists.

**Stage 5: NOTIFY**
Notification rules are evaluated against the alert severity. Active rules trigger:
- Slack notifications via the `slackService`
- PagerDuty Events API v2 calls (if a PAGERDUTY integration is ACTIVE for the organization)

**Stage 6: VERIFY**
If a remediation action was executed successfully and has a `verifyQuery` defined, the pipeline waits 5 seconds and then executes the PromQL verification query against the remote Prometheus instance. The result is compared against the `verifyThreshold` to determine success.

### 5.3 Remediation Actions Registry

Eight remediation actions are built into the pipeline. All can be toggled globally or per-organization.

| Action ID | Name | Category | Target Severity | Matched Alert Patterns |
|-----------|------|----------|-----------------|----------------------|
| `disk-cleanup` | Disk Space Cleanup | Storage | CRITICAL, WARNING | NodeDiskRunningFull, HostDiskAlmostFull, NodeFilesystemAlmostOutOfSpace, NodeFilesystemSpaceFillingUp |
| `pod-restart` | Restart CrashLooping Pod | Kubernetes | CRITICAL, WARNING | KubePodCrashLooping, KubePodNotReady |
| `service-restart` | Restart System Service | Infrastructure | CRITICAL | KubeNodeNotReady |
| `memory-release` | Release Memory Cache | Compute | CRITICAL, WARNING | HostHighMemoryUsage, NodeMemoryHighUtilization, HostMemoryUnderMemoryPressure |
| `log-rotate` | Force Log Rotation | Storage | CRITICAL, WARNING | NodeDiskRunningFull, HostDiskAlmostFull |
| `container-prune` | Prune Container Images | Kubernetes | WARNING | NodeDiskRunningFull, KubeNodeDiskPressure |
| `deployment-scale` | Scale Deployment Replicas | Kubernetes | WARNING | KubeDeploymentReplicasMismatch |
| `ssl-check` | Certificate Expiry Check | Security | WARNING, CRITICAL | CertificateExpiringSoon, SSLCertificateExpiry |

**Action Command Details:**

`disk-cleanup` executes four commands sequentially:
```bash
sudo journalctl --vacuum-time=3d
sudo apt-get clean 2>/dev/null || sudo yum clean all 2>/dev/null
sudo find /var/log -name "*.gz" -mtime +7 -delete
sudo find /tmp -mtime +7 -delete
```

`memory-release` executes:
```bash
sudo sync && sudo sh -c "echo 3 > /proc/sys/vm/drop_caches"
```

`pod-restart` builds the command dynamically from alert labels:
```bash
sudo kubectl delete pod <pod-name> -n <namespace> --grace-period=30
```

`service-restart` executes:
```bash
sudo systemctl restart kubelet
```

`ssl-check` and `deployment-scale` are diagnostic or dynamically constructed — they have no static commands.

**Verification Queries:**

| Action | Verify PromQL | Success Threshold |
|--------|--------------|-------------------|
| disk-cleanup | `node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs\|devtmpfs\|overlay"}` | 15% free |
| pod-restart | `kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}` | 0 |
| service-restart | `kube_node_status_condition{condition="Ready",status="true"}` | 1 |
| memory-release | `node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes` | 10% available |
| log-rotate | `node_filesystem_avail_bytes{mountpoint="/var/log"}` | 10% free |
| container-prune | `node_filesystem_avail_bytes{mountpoint="/"}` | 15% free |
| deployment-scale | `kube_deployment_status_replicas_available` | 1 |

### 5.4 Notification Rules

Four notification rules govern automatic alert routing:

| Rule ID | Name | Trigger | Channel |
|---------|------|---------|---------|
| `critical-slack` | Critical Alert → Slack | Severity = CRITICAL | Slack |
| `critical-pagerduty` | Critical Alert → PagerDuty | Severity = CRITICAL | PagerDuty Events API v2 |
| `warning-slack` | Warning Alert → Slack | Severity = WARNING | Slack |
| `incident-created-slack` | New Incident → Slack | Event: incident:created | Slack |

All four rules are enabled by default. Each can be disabled globally or per-organization via `POST /api/v1/agent/notifications/:ruleId/toggle`.

### 5.5 Alert Knowledge Base

The Alert Knowledge Base (ALERT_KB) contains 17 pattern entries used by the AI RCA system to provide structured context for known alert types. The KB entries cover:

**Infrastructure Categories:**
- `disk` — Disk space full/filling
- `cpu` — High CPU utilization
- `memory` — Memory pressure/OOM
- `icmp` — Network reachability failures
- `switch` — Network switch anomalies
- `fortigate` — Firewall events
- `login` — Authentication failures
- `hostdown` — Host unreachable

**Kubernetes Categories:**
- `kubePodCrash` — Pod CrashLoopBackOff
- `kubePodOOM` — Pod OOMKilled
- `kubePodNotReady` — Pod not reaching Ready state
- `kubeNodeNotReady` — Node NotReady condition
- `kubeDeploymentMismatch` — Deployment replica count mismatch
- `kubeHPA` — Horizontal Pod Autoscaler issues

**Application Categories:**
- `appError` — Application error rate exceeded
- `dbConnection` — Database connection pool exhaustion
- `certificate` — TLS/SSL certificate expiry

The KB is accessible via `GET /api/v1/alerts/kb`.

### 5.6 Multi-Tenant Pipeline State

Pipeline state is maintained in three in-memory Maps:

```
orgPipelineStates  Map<orgId | '__global__', PipelineState>
orgActionOverrides Map<orgId | '__global__', Map<actionId, boolean>>
orgNotifOverrides  Map<orgId | '__global__', Map<ruleId, boolean>>
```

New organizations inherit the global enabled state (`true`) lazily on first alert. The global state (`__global__`) aggregates execution counts from all organizations, allowing super-admins to see platform-wide statistics.

### 5.7 PagerDuty Events API Integration

When a CRITICAL alert fires and the organization has an ACTIVE `PAGERDUTY` integration with a `routingKey` or `integrationKey` in its configuration JSON, the pipeline sends an event to `https://events.pagerduty.com/v2/enqueue` with the following payload structure:

```json
{
  "routing_key": "<org-routing-key>",
  "event_action": "trigger",
  "dedup_key": "<alert-alertId>",
  "payload": {
    "summary": "[CRITICAL] NodeDiskRunningFull on lemonn-mum-le",
    "severity": "critical",
    "source": "lemonn-mum-le",
    "component": "kube-system",
    "group": "Lemonn Financial",
    "class": "PROMETHEUS"
  }
}
```

The `dedup_key` is set to the alert's `alertId` field, enabling PagerDuty to deduplicate repeated firings of the same alert.

---

## 6. Infrastructure and Deployment

### 6.1 Kubernetes Deployment Architecture

Argus runs in the `fs-linkedeye` Kubernetes namespace. The following deployments are maintained:

| Deployment | Image | Description |
|-----------|-------|-------------|
| `linkedeye-api` | `linkedeye/api:vN` | Backend API server (port 5000) |
| `linkedeye-frontend` | `linkedeye/frontend:vN` | React SPA served by nginx (port 80) |

**Supporting Services (ClusterIP):**
- `postgres.fs-linkedeye` — PostgreSQL 16 on port 5432 (ClusterIP: 10.97.121.123)
- Redis 7 for caching

**SSH Key Secret:**
The Ed25519 private key for remote client SSH access is stored as the Kubernetes secret `linkedeye-ssh-key` and mounted into the API pod at `/home/finadmin/.ssh/`. This key provides passwordless access to all 13 client server environments.

**Backend Dockerfile (multi-stage build):**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl openssh-client

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM deps AS prisma
COPY prisma ./prisma/
RUN npx prisma generate

FROM base AS runner
ENV NODE_ENV=production
COPY --from=prisma /app/node_modules ./node_modules
COPY --from=prisma /app/prisma ./prisma
COPY package*.json ./
COPY src ./src
COPY public ./public

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
```

NOTE: `openssh-client` must be present in the runner image. Without it, the SSH-based K8s and Prometheus access features fail silently. This package is included in the base stage so all subsequent stages inherit it.

### 6.2 Container Build Process

**Frontend build and deploy:**

```bash
# Build
sudo nerdctl --namespace k8s.io build --no-cache \
  -t linkedeye/frontend:vN ./frontend-react

# Deploy
sudo kubectl set image deployment/linkedeye-frontend \
  frontend=linkedeye/frontend:vN -n fs-linkedeye
```

**Backend build and deploy:**

```bash
# Build
sudo nerdctl --namespace k8s.io build --no-cache \
  -t linkedeye/api:vN ./backend

# Deploy
sudo kubectl set image deployment/linkedeye-api \
  api=linkedeye/api:vN -n fs-linkedeye
```

Replace `vN` with the semantic version number (e.g., `v73`). Version numbers are tracked in team memory and incremented sequentially.

**Verify deployment:**

```bash
sudo kubectl get pods -n fs-linkedeye
sudo kubectl rollout status deployment/linkedeye-api -n fs-linkedeye
```

### 6.3 Database Management

**Two separate PostgreSQL instances exist:**

| Instance | Connection String | Usage |
|----------|------------------|-------|
| Local development | `postgresql://user:pass@localhost:5432/linkedeye` | Development and testing |
| Kubernetes production | `postgresql://user:pass@postgres.fs-linkedeye:5432/linkedeye` | Production data |

WARNING: These are completely separate databases. Migrations and seed data applied to the local database are NOT automatically reflected in the Kubernetes production database. Always apply schema changes to both databases independently.

**Prisma Commands:**

```bash
cd backend

# Generate Prisma client after schema changes
npx prisma generate

# Apply migrations to local development DB
npx prisma migrate dev --name "describe_your_migration"

# Apply migrations to production (K8s postgres) — use deploy, not dev
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Open visual database browser (local DB only)
npx prisma studio

# Seed the database with test data
npx prisma db seed

# Manual database health check
npm run db:health
```

### 6.4 Background Jobs

Two background jobs start automatically when the server boots:

**SLA Compliance Checker**
- Interval: every 60 seconds
- Service: `backend/src/services/slaService.js` — `checkSLACompliance()`
- Function: Scans open incidents for SLA breaches, sets `slaBreached = true`, emits Socket.IO events for breached incidents, and triggers escalation notifications

**Email Queue Processor**
- Interval: every 5 minutes
- Service: `backend/src/services/emailService.js` — `processEmailQueue()`
- Function: Processes records in the `EmailQueue` table with status `PENDING`, attempts delivery, updates status to `SENT` or `FAILED`, and retries failed records up to a configured limit

### 6.5 Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals by:
1. Stopping the HTTP server from accepting new connections
2. Allowing in-flight requests to complete
3. Disconnecting Prisma from PostgreSQL
4. Exiting with code 0

A hard timeout of 10 seconds forces exit if graceful shutdown stalls.

```bash
# Force pod restart (triggers graceful shutdown)
sudo kubectl rollout restart deployment/linkedeye-api -n fs-linkedeye
```

---

## 7. Integration Guide

### 7.1 Onboarding a New Client Organization

Follow this procedure to onboard a new client organization onto Argus.

**Prerequisites:**
- SSH access from the Argus API pod to the client server (Ed25519 key pre-authorized on client)
- Prometheus and Grafana running on the client's K8s cluster (standard ports: 30000 and 30010)
- node-exporter deployed on client nodes (port 9100)

**Step 1: Create the Organization Record**

```bash
POST /api/v1/organizations
Authorization: Bearer <admin-token>

{
  "name": "Client Organization Name",
  "slug": "client-org-slug",
  "environment": "PROD",
  "serverIp": "203.0.113.10",
  "fqdn": "client.finspot.in",
  "description": "Brief description"
}
```

Save the returned `id` — this is the `organizationId` for all subsequent records.

**Step 2: Create Integration Records**

Create three integration records for the standard infrastructure stack:

```bash
# Prometheus Integration
POST /api/v1/integrations
{
  "name": "client-prometheus",
  "type": "PROMETHEUS",
  "organizationId": "<org-id>",
  "config": "{\"accessMethod\":\"ssh\",\"serverIp\":\"203.0.113.10\",\"sshPort\":2233,\"sshUser\":\"finadmin\",\"promPort\":30000,\"prometheusUrl\":\"http://203.0.113.10:30000\"}"
}

# Kubernetes Cluster Integration
POST /api/v1/integrations
{
  "name": "client-k8s",
  "type": "KUBERNETES_CLUSTER",
  "organizationId": "<org-id>",
  "config": "{\"accessMethod\":\"ssh\",\"serverIp\":\"203.0.113.10\",\"sshPort\":2233,\"sshUser\":\"finadmin\"}"
}

# Grafana Integration
POST /api/v1/integrations
{
  "name": "client-grafana",
  "type": "GRAFANA",
  "organizationId": "<org-id>",
  "config": "{\"accessMethod\":\"ssh\",\"serverIp\":\"203.0.113.10\",\"sshPort\":2233,\"sshUser\":\"finadmin\",\"grafanaPort\":30010,\"grafanaExternalUrl\":\"http://client.finspot.in:30010\"}"
}
```

**Step 3: Set Integration Status to ACTIVE**

```bash
PATCH /api/v1/integrations/<integration-id>
{ "status": "ACTIVE" }
```

**Step 4: Configure Prometheus Alertmanager**

Add a webhook receiver in the client's Alertmanager configuration pointing to:

```
https://fs-le-dev-inc.finspot.in/api/v1/webhooks/alertmanager
```

Include an `org_slug` label in the alert labels to enable automatic organization routing:

```yaml
# In prometheus/rules.yml — add org_slug to every alert's labels
groups:
  - name: example
    rules:
      - alert: NodeDiskRunningFull
        labels:
          org_slug: client-org-slug
          severity: critical
```

**Step 5: Configure Grafana Webhook (optional)**

In Grafana, create a contact point of type "Webhook" pointing to:

```
https://fs-le-dev-inc.finspot.in/api/v1/webhooks/grafana?orgId=<org-id>
```

**Step 6: Verify SSH Connectivity**

```bash
# From the Argus API pod
kubectl exec -it <api-pod-name> -n fs-linkedeye -- \
  ssh -p 2233 -i /home/finadmin/.ssh/id_ed25519 \
  -o StrictHostKeyChecking=accept-new \
  finadmin@203.0.113.10 "kubectl get nodes"
```

**Step 7: Create an Admin User for the Organization**

```bash
POST /api/v1/auth/register
{
  "email": "admin@client.com",
  "password": "SecureP@ssw0rd",
  "firstName": "Client",
  "lastName": "Admin",
  "role": "ADMIN",
  "organizationId": "<org-id>"
}
```

**Step 8: Seed Initial Assets (Optional)**

Create `ConfigurationItem` records via `POST /api/v1/assets` for the client's known servers, clusters, and applications to enable CMDB-based alert routing and live metrics.

### 7.2 SSH Connectivity Requirements

| Requirement | Specification |
|-------------|--------------|
| Key type | Ed25519 |
| Key location in API pod | `/home/finadmin/.ssh/id_ed25519` |
| Key source | Kubernetes secret `linkedeye-ssh-key` |
| Connection timeout | 8 seconds |
| Host key policy | `StrictHostKeyChecking=accept-new` |
| Batch mode | Enabled (`BatchMode=yes` — no interactive prompts) |
| Default SSH port | 4422 (configurable per org via integration config) |
| Default SSH user | `finadmin` (configurable per org via integration config) |

All SSH commands are constructed by `k8sService.sshCmd()` in `backend/src/services/k8sService.js`.

### 7.3 Prometheus Integration

Argus fetches Prometheus data using batch PromQL queries. For remote client organizations, queries are executed via a Python 3 one-liner script transmitted over SSH:

```python
# Executes on remote server via SSH
import json, urllib.request, urllib.parse, sys, base64
queries = json.loads(base64.b64decode(sys.argv[1]).decode())
results = {}
for label, query in queries.items():
    url = "http://localhost:30000/api/v1/query?" + urllib.parse.urlencode({"query": query})
    resp = urllib.request.urlopen(url, timeout=8)
    data = json.loads(resp.read())
    results[label] = data.get("data", {}) if data.get("status") == "success" else {}
print(json.dumps(results))
```

This approach executes all metrics queries in a single SSH round-trip, minimizing latency.

**Prometheus Ports:**
- Default NodePort: 30000
- Alertmanager NodePort: 32566 (for Lemonn org reference)

### 7.4 Grafana Integration

Grafana dashboard lists and panel data are retrieved via the Grafana HTTP API. For remote organizations, the API calls are proxied via SSH:

```bash
# On the remote server via SSH
curl -sf -H 'Authorization: Bearer <api-key>' \
  'http://localhost:30010/api/dashboards/home'
```

The `grafanaExternalUrl` in the integration config provides the public-facing URL for iframe embedding in the Argus frontend.

**Grafana Lemonn Reference:**
- Internal: `http://localhost:30010` (via SSH proxy)
- External: `http://lemonn.finspot.in:30010`
- Service Account: `linkedeye-integration`
- API Key: stored in the Grafana integration `config` JSON field

### 7.5 Kubernetes Cluster Integration

Kubernetes operations use `kubectl` commands executed remotely:

```bash
ssh -p <port> finadmin@<server-ip> "kubectl get pods --all-namespaces -o json"
```

The default namespace queried for pod and deployment details is `fs-linkedeye`. Pass a `?namespace=` query parameter to the K8s API endpoints to query a different namespace.

### 7.6 Slack Integration

Slack integration supports two modes:

**Inbound (Slash Commands):** Configure a Slack app slash command pointing to `POST /api/v1/webhooks/slack/commands`. Supported commands trigger incident lookups, alert acknowledgement, and status queries.

**Outbound (Notifications):** The `slackService` sends formatted messages to configured Slack channels when incidents are created or alerts fire. Configure via the `SlackIntegration` model (Organization → SlackIntegration with `botToken` and `channelId`).

### 7.7 PagerDuty Integration

Two integration paths exist for PagerDuty:

**Outbound (Alert forwarding):** The AI Agent Pipeline sends CRITICAL alerts to PagerDuty Events API v2 using the `routingKey` stored in the organization's PAGERDUTY integration config.

**Inbound (Bidirectional sync):** PagerDuty webhooks are received at `POST /api/v1/pagerduty/webhook` to sync incident updates back to Argus.

**Required PagerDuty configuration JSON:**

```json
{
  "routingKey": "R014JLGZXXXXXXXXXXXXXX",
  "apiKey": "Bearer pagerduty-api-key",
  "subdomain": "yourcompany"
}
```

### 7.8 SMS Provider Integration

Argus supports three SMS providers. Provider selection is determined by the active integration configuration. All providers share the same API surface (`POST /api/v1/sms/send`).

| Provider | Integration Type | Configuration Keys |
|----------|-----------------|-------------------|
| Twilio | `TWILIO` | `accountSid`, `authToken`, `fromNumber` |
| MSG91 | `MSG91` | `apiKey`, `senderId`, `templateId` |
| Kaleyra | `KALEYRA` | `apiKey`, `sid`, `senderId` |

### 7.9 Voice / IVR Integration

The voice system uses Twilio for carrier connectivity and a local FastAPI Python server (port 8100) for Whisper STT and XTTS v2 TTS processing.

**Inbound Call Flow:**
1. Caller dials the Twilio number
2. Twilio sends `POST /api/v1/webhooks/twilio/voice` (HMAC-SHA1 verified)
3. IVR announces the client organization name and current incident summary
4. DTMF input routes to specific incident detail or escalation
5. Speech input is transcribed via `POST /api/v1/webhooks/twilio/speech`

**Outbound Call Trigger:**

```bash
POST /api/v1/voice/call
Authorization: Bearer <admin-or-manager-token>

{
  "to": "+919876543210",
  "message": "Critical incident INC0000042 requires immediate attention"
}
```

---

## 8. Security Architecture

### 8.1 Authentication Flow

```
1. Client sends POST /api/v1/auth/login with credentials

2. Server:
   a. Validates email format and password length
   b. Looks up user by email (case-normalized)
   c. Verifies bcrypt password hash
   d. Checks user.status === 'ACTIVE'
   e. Checks lockedUntil (account lockout)
   f. Resets loginAttempts on success
   g. Creates Session record with refreshToken
   h. Signs accessToken (short-lived) and refreshToken (long-lived)
   i. Returns both tokens

3. Client stores tokens in localStorage ('linkedeye-auth' key via Zustand persist)

4. Subsequent requests attach: Authorization: Bearer <accessToken>

5. On 401 response, frontend auto-retries with refreshToken:
   POST /api/v1/auth/refresh { refreshToken }
   New tokens replace old tokens in localStorage

6. On refresh failure, localStorage is cleared and user is redirected to /login
```

### 8.2 Role-Based Access Control

RBAC is enforced at two levels:

**Level 1 — Role Enforcement (`authorize(...roles)`):**
Used for administrative operations. The calling user's role must be in the allowed roles list.

```javascript
router.post('/toggle', authorize('ADMIN', 'MANAGER'), ctrl.togglePipeline);
```

**Level 2 — Resource Permission (`checkPermission(resource, action)`):**
Used for ITIL module CRUD operations. Permissions are defined in `backend/src/config/constants.js` in a `PERMISSIONS` map:

```javascript
// Conceptual — read from constants.js
PERMISSIONS = {
  ADMIN:    { incidents: 'rcud', changes: 'rcud', problems: 'rcud', ... },
  MANAGER:  { incidents: 'rcud', changes: 'rcud', problems: 'rcud', ... },
  ENGINEER: { incidents: 'rcu',  changes: 'rcu',  problems: 'rcu',  ... },
  OPERATOR: { incidents: 'ru',   alerts: 'ru',    ...                  },
  VIEWER:   { incidents: 'r',    changes: 'r',    problems: 'r',    ... },
}
// r=read, c=create, u=update, d=delete
```

### 8.3 Tenant Isolation Security

The `req.tenantWhere` pattern provides defense-in-depth for tenant isolation:

1. The filter is set in `authenticate()` — before any controller code runs
2. The filter is a Prisma `where` clause fragment — incompatible with raw SQL injection
3. Controllers must explicitly spread `...req.tenantWhere` — accidental omission makes the code obviously incomplete, not silently insecure
4. Super-admins (no org) get an empty `{}` filter — this is intentional and expected behavior for platform management

**Cross-tenant access control:**

Non-ADMIN users whose JWT is tampered to include a different `organizationId` cannot access other tenants' data because `req.tenantWhere` is set from the database-loaded user record, not from the JWT payload.

### 8.4 Transport Security

- All production traffic is TLS-terminated at the Kubernetes ingress
- The Helmet middleware sets the following security headers:
  - `Content-Security-Policy` — restricts script, style, font, and image sources
  - `X-Frame-Options` — prevents clickjacking
  - `Strict-Transport-Security` — enforces HTTPS
  - `X-Content-Type-Options` — prevents MIME sniffing
- CORS is configured with an explicit allowlist (`config.corsOrigins`) — not a wildcard
- Allowed request headers are explicitly enumerated: `Content-Type`, `Authorization`, `X-Organization-Id`

### 8.5 Rate Limiting

| Limiter | Applied To | Limit |
|---------|-----------|-------|
| `globalLimiter` | All routes | Configurable window/max via env vars |
| `authLimiter` | `POST /auth/login` | Stricter limit to prevent brute force |
| `webhookLimiter` | `POST /alerts/webhook` | Prevents webhook flooding |

Rate limit responses return HTTP 429 with a standard error response.

### 8.6 SSH Key Management

| Property | Value |
|----------|-------|
| Key algorithm | Ed25519 |
| Storage | Kubernetes secret `linkedeye-ssh-key` |
| Mount path in pod | `/home/finadmin/.ssh/` |
| Key rotation procedure | Update K8s secret, restart API pod, re-authorize on all client servers |
| Host key policy | `StrictHostKeyChecking=accept-new` — accepts new hosts, rejects changed host keys |
| Connection mode | BatchMode (no interactive prompts, fails fast if auth fails) |

WARNING: The Ed25519 private key grants root-equivalent access to all 13 client servers. Treat it with the highest level of confidentiality. Rotate immediately if any compromise is suspected.

### 8.7 Webhook Security

| Webhook Source | Verification Method |
|---------------|--------------------:|
| Twilio SMS/Voice | HMAC-SHA1 signature in `X-Twilio-Signature` header, verified by `twilioAuth.js` middleware |
| Prometheus Alertmanager | Network-level trust (internal webhook; optionally add a shared secret to the URL) |
| Grafana | `?orgId=` query parameter for routing; no cryptographic verification |
| PagerDuty | Token in request header (configurable) |
| Slack | Slack signing secret verification |

---

## 9. Database Schema

### 9.1 Schema Overview

The Argus database schema is defined in `backend/prisma/schema.prisma`. It contains:

- **28 enumerations** covering all state machines, type classifications, and reference lists
- **20+ models** organized into logical groups: Core, ITIL Modules, CMDB, Communication, Integrations, and Scheduling
- **Universal tenant scoping** via `organizationId String?` on all client-data models
- **Soft-delete pattern** via `status` fields (no hard-delete for ITIL records)
- **Automatic timestamps** via `@default(now())` and `@updatedAt` on all major models

**Prisma Configuration:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

The `linux-musl-openssl-3.0.x` binary target is required for the Alpine Linux-based Kubernetes containers.

### 9.2 Core Models

**Organization**

The root entity for multi-tenancy. All other models reference this via `organizationId`.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| name | String (unique) | Display name |
| slug | String (unique) | URL-safe identifier for webhook routing |
| environment | Environment enum | PROD, DR, UAT, DEV |
| serverIp | String? | Public IP for SSH connectivity |
| fqdn | String? | Fully qualified domain name |
| isActive | Boolean | Soft-delete flag |

**User**

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| email | String (unique) | Login email |
| password | String | bcrypt hash |
| role | Role enum | ADMIN, MANAGER, ENGINEER, OPERATOR, VIEWER |
| status | UserStatus enum | ACTIVE, INACTIVE, LOCKED |
| organizationId | String? | Tenant reference (null = super-admin) |
| loginAttempts | Int | Brute force counter |
| lockedUntil | DateTime? | Account lockout expiry |
| mfaEnabled | Boolean | MFA configuration flag |
| timezone | String | Default: Asia/Kolkata |

**Session**

Stores refresh tokens with expiry for token invalidation on logout.

### 9.3 ITIL Module Models

**Incident**

| Field | Type | Notes |
|-------|------|-------|
| number | String (unique) | Format: INC0000001 |
| state | IncidentState | NEW → CLOSED lifecycle |
| impact | Impact | ENTERPRISE, DEPARTMENT, TEAM, INDIVIDUAL |
| urgency | Urgency | CRITICAL, HIGH, MEDIUM, LOW |
| priority | Priority | P1–P4 (auto-derived from impact × urgency) |
| source | IncidentSource | MANUAL, PROMETHEUS, GRAFANA, API, EMAIL, VOICE, SLACK |
| sourceAlertId | String? | Link to originating Alert.alertId |
| slaBreached | Boolean | Set by SLA compliance checker |
| slaTargetResponse | DateTime? | Calculated at creation |
| slaTargetResolution | DateTime? | Calculated at creation |

**Change**

| Field | Type | Notes |
|-------|------|-------|
| number | String (unique) | Format: CHG0000001 |
| type | ChangeType | NORMAL, STANDARD, EMERGENCY |
| state | ChangeState | NEW → CLOSED lifecycle |
| riskLevel | RiskLevel | HIGH, MEDIUM, LOW |
| rollbackPlan | String? | Required for NORMAL and EMERGENCY changes |
| gitRepoUrl | String? | DevOps integration fields |
| gitCommitHash | String? | |
| closureCode | ClosureCode? | SUCCESSFUL, FAILED, PARTIAL |

**Problem**

| Field | Type | Notes |
|-------|------|-------|
| number | String (unique) | Format: PRB0000001 |
| state | ProblemState | NEW → CLOSED lifecycle |
| rootCauseAnalysis | Json? | Structured AI RCA output |
| isKnownError | Boolean | KEDB integration flag |
| workaroundEffective | Boolean | Workaround validation flag |
| fixImplemented | Boolean | Permanent fix status |

### 9.4 Supporting Models

| Model | Purpose |
|-------|---------|
| `ConfigurationItem` | CMDB — servers, clusters, applications, databases, network devices |
| `Alert` | Normalized alert records from Prometheus/Grafana |
| `WorkNote` | Time-stamped notes on incidents/changes/problems (MANUAL, AI, SYSTEM, SLACK sources) |
| `Activity` | Immutable audit trail of field changes |
| `Attachment` | File uploads linked to ITIL records |
| `Notification` | User-targeted in-app and multi-channel notifications |
| `AuditLog` | System-level audit log with before/after JSON snapshots |
| `SLADefinition` | Per-priority SLA targets, configurable per organization |
| `EscalationPolicy` | Multi-level escalation rules for teams |
| `EscalationRule` | Individual rule: level, delay, notification targets |
| `OnCallSchedule` | User on-call time windows for teams |
| `Integration` | External system connections with JSON config storage |
| `SlackIntegration` | Dedicated Slack workspace connection per org |
| `EmailQueue` | Async email delivery queue |
| `SMSLog` | Inbound and outbound SMS records |
| `VoiceCallLog` | Call records with transcript and sentiment |
| `ScheduledJob` | Metadata for background job tracking |

**ConfigurationItem Key Fields:**

| Field | Type | Notes |
|-------|------|-------|
| type | CIType | SERVER, KUBERNETES_CLUSTER, DATABASE, APPLICATION, etc. |
| status | CIStatus | LIVE, MAINTENANCE, DECOMMISSIONED, PLANNED |
| ipAddress | String? | Used for alert-to-CI correlation |
| prometheusJob | String? | Links CI to Prometheus scrape job |
| grafanaDashboard | String? | Links CI to Grafana dashboard UID |
| monitoringEnabled | Boolean | Controls live-metrics availability |

### 9.5 Enumerations Reference

| Enum | Values |
|------|--------|
| Role | ADMIN, MANAGER, ENGINEER, OPERATOR, VIEWER |
| UserStatus | ACTIVE, INACTIVE, LOCKED |
| TeamMemberRole | LEAD, MEMBER, OBSERVER |
| IncidentState | NEW, IN_PROGRESS, ON_HOLD, ESCALATED, RESOLVED, CLOSED, CANCELLED |
| Impact | ENTERPRISE, DEPARTMENT, TEAM, INDIVIDUAL |
| Urgency | CRITICAL, HIGH, MEDIUM, LOW |
| Priority | P1, P2, P3, P4 |
| IncidentSource | MANUAL, PROMETHEUS, GRAFANA, API, EMAIL, VOICE, SLACK |
| ChangeType | NORMAL, STANDARD, EMERGENCY |
| ChangeState | NEW, ASSESSMENT, APPROVAL, SCHEDULED, IMPLEMENTING, REVIEW, CLOSED, CANCELLED |
| RiskLevel | HIGH, MEDIUM, LOW |
| ProblemState | NEW, INVESTIGATION, RCA_IN_PROGRESS, KNOWN_ERROR, RESOLVED, CLOSED |
| ApprovalState | PENDING, APPROVED, REJECTED |
| CIType | SERVER, KUBERNETES_CLUSTER, DATABASE, APPLICATION, NETWORK, STORAGE, CONTAINER, VM, LOAD_BALANCER |
| CIStatus | LIVE, MAINTENANCE, DECOMMISSIONED, PLANNED |
| AlertSeverity | CRITICAL, WARNING, INFO |
| AlertStatus | FIRING, RESOLVED, ACKNOWLEDGED, SILENCED |
| AlertSource | PROMETHEUS, GRAFANA, CUSTOM |
| WorkNoteSource | MANUAL, AI, SYSTEM, SLACK |
| NotificationType | INCIDENT, CHANGE, PROBLEM, ALERT, SLA, SYSTEM |
| NotificationChannel | WEB, EMAIL, SMS, SLACK, VOICE |
| IntegrationType | SLACK, SERVICENOW, PROMETHEUS, GRAFANA, LOKI, EMAIL, TWILIO, MSG91, KALEYRA, WEBHOOK, N8N, KUBERNETES_CLUSTER, STACKSTORM, PAGERDUTY, APPRISE |
| IntegrationStatus | ACTIVE, INACTIVE, ERROR |
| EmailStatus | PENDING, SENT, FAILED |
| SMSProvider | TWILIO, MSG91, KALEYRA |
| SMSDirection | OUTBOUND, INBOUND |
| VoiceDirection | INBOUND, OUTBOUND |
| VoiceHandler | AI_BOT, HUMAN, IVR |
| LinkType | CAUSED_BY, RESOLVED_BY, RELATED |
| ProblemLinkType | CAUSED_BY, RELATED, SYMPTOM_OF |
| ClosureCode | SUCCESSFUL, FAILED, PARTIAL |
| NotifyType | SMS_NOTIFY, EMAIL_NOTIFY, SLACK_NOTIFY, VOICE_NOTIFY, ALL |
| Environment | PROD, DR, UAT, DEV |

### 9.6 ITIL Numbering Convention

ITIL record numbers are generated by the `generateIncidentNumber()` helper in `backend/src/utils/helpers.js`. Numbers are sequential and zero-padded to 7 digits:

| Module | Prefix | Example |
|--------|--------|---------|
| Incidents | INC | INC0000001 |
| Changes | CHG | CHG0000001 |
| Problems | PRB | PRB0000001 |

---

## 10. Frontend Architecture

### 10.1 Application Structure

The frontend is a React 19 Single-Page Application located in `frontend-react/src/`. Key directories:

```
frontend-react/src/
├── App.tsx                  # Route definitions (30+ routes)
├── components/
│   ├── Auth/                # Login, ProtectedRoute
│   ├── Layout/              # Layout, Sidebar, Header
│   ├── Dashboard/           # DashboardOverview
│   ├── Incidents/           # IncidentList, IncidentDetail, IncidentCreate
│   ├── Changes/             # ChangeList, ChangeDetail, ChangeCreate
│   ├── Problems/            # ProblemList, ProblemDetail, ProblemCreate
│   ├── Alerts/              # AlertList
│   ├── Assets/              # AssetList, AssetDetail, AssetCreate
│   ├── Teams/               # TeamList
│   ├── OnCall/              # OnCallDashboard
│   ├── K8s/                 # K8sClusterDashboard
│   ├── APM/                 # APMDashboard
│   ├── AI/                  # AIInsightsDashboard
│   ├── Automation/          # AutomationDashboard
│   ├── Integrations/        # IntegrationHub, PagerDutyDashboard
│   ├── Metrics/             # MetricsDashboard
│   ├── Network/             # NetworkTopology
│   ├── Reports/             # ReportsDashboard
│   ├── SMS/                 # SMSDashboard
│   ├── Voice/               # VoiceDashboard
│   ├── Users/               # UserList
│   ├── Settings/            # SettingsPage
│   ├── Docs/                # DeveloperDocs
│   └── Landing/             # LandingPage
├── hooks/                   # 18 TanStack Query hook files
├── stores/                  # authStore.ts, uiStore.ts
├── lib/
│   ├── api.ts               # Axios instance
│   └── socket.ts            # Socket.IO client
└── config/                  # App configuration
```

### 10.2 Routing and Code Splitting

All component routes are lazy-loaded using `React.lazy` with `Suspense` fallbacks. This produces separate JavaScript chunks for each page, minimizing initial bundle size.

**Public Routes (no auth required):**

| Path | Component |
|------|-----------|
| `/` | HomeRoute (redirects to /dashboard if authenticated, else LandingPage) |
| `/landing` | LandingPage |
| `/login` | LoginPage |
| `/docs` | DeveloperDocs |

**Protected Routes (auth required):**

| Path | Component | Role Restriction |
|------|-----------|-----------------|
| `/dashboard` | DashboardOverview | Any |
| `/incidents` | IncidentList | Any |
| `/incidents/create` | IncidentCreate | Any |
| `/incidents/:id` | IncidentDetail | Any |
| `/changes` | ChangeList | Any |
| `/changes/create` | ChangeCreate | Any |
| `/changes/:id` | ChangeDetail | Any |
| `/problems` | ProblemList | Any |
| `/problems/create` | ProblemCreate | Any |
| `/problems/:id` | ProblemDetail | Any |
| `/oncall` | OnCallDashboard | Any |
| `/alerts` | AlertList | Any |
| `/assets` | AssetList | Any |
| `/assets/create` | AssetCreate | Any |
| `/assets/:id` | AssetDetail | Any |
| `/network` | NetworkTopology | Any |
| `/metrics` | MetricsDashboard | Any |
| `/ai-insights` | AIInsightsDashboard | Any |
| `/automation` | AutomationDashboard | Any |
| `/users` | UserList | ADMIN, MANAGER |
| `/integrations` | IntegrationHub | ADMIN |
| `/teams` | TeamList | Any |
| `/reports` | ReportsDashboard | Any |
| `/sms` | SMSDashboard | Any |
| `/voice` | VoiceDashboard | Any |
| `/k8s` | K8sClusterDashboard | Any |
| `/pagerduty` | PagerDutyDashboard | Any |
| `/apm` | APMDashboard | Any |
| `/settings` | SettingsPage | Any |

### 10.3 State Management

**Zustand Auth Store (`frontend-react/src/stores/authStore.ts`):**

Persisted to `localStorage` under the key `linkedeye-auth`. Persisted fields: `token`, `refreshToken`, `selectedOrgId`, `organization`.

| State Field | Type | Purpose |
|-------------|------|---------|
| `user` | User or null | Current authenticated user with role |
| `token` | string or null | JWT access token |
| `refreshToken` | string or null | JWT refresh token |
| `organization` | Organization or null | User's home organization |
| `selectedOrgId` | string or null | Admin's currently selected org filter |
| `isAuthenticated` | boolean | Auth state flag |
| `isLoading` | boolean | Login/checkAuth loading state |

**Key Store Actions:**

| Action | Description |
|--------|-------------|
| `login(email, password)` | POST /auth/login, store tokens and user |
| `logout()` | POST /auth/logout, clear store and localStorage, disconnect Socket.IO |
| `checkAuth()` | On app init: validate stored token via GET /auth/me |
| `setSelectedOrg(orgId)` | Update org filter (admin org-switching) |

**uiStore.ts:** Manages sidebar collapse state, global search query, and notification queue. Not persisted.

### 10.4 API Layer

All API calls go through `frontend-react/src/lib/api.ts` — a pre-configured Axios instance.

**Base URL:** `import.meta.env.VITE_API_BASE_URL || '/api/v1'`

**Request Interceptor (automatic on every request):**
1. Reads `linkedeye-auth` from localStorage
2. If `state.token` exists: sets `Authorization: Bearer <token>`
3. If `state.selectedOrgId` exists: sets `X-Organization-Id: <orgId>`

**Response Interceptor (401 auto-refresh):**
1. On 401 response, attempts token refresh via `POST /api/v1/auth/refresh`
2. If refresh succeeds: updates localStorage, retries original request with new token
3. If refresh fails: clears localStorage, redirects to `/login`
4. Concurrent 401 responses are queued and resolved after a single refresh (prevents multiple refresh calls)

**TanStack Query Integration:**
All 18 hook files in `frontend-react/src/hooks/` use TanStack Query v5 (`useQuery`, `useMutation`, `useInfiniteQuery`) on top of the Axios instance. Query keys include organization context to ensure proper cache invalidation on org switches.

### 10.5 Design System and Color Tokens

The Tailwind configuration in `frontend-react/tailwind.config.js` overrides standard Tailwind color palettes with a flat semantic token system. This is a critical constraint for all UI development.

WARNING: Standard Tailwind shade classes (`slate-900`, `emerald-600`, `amber-500`, etc.) do not function as expected. The `slate` palette is overridden to `#FFFFFF` (white), and `emerald`, `amber`, and `violet` have only a `DEFAULT` value (no shade variants). All dark-themed hero sections and backgrounds MUST use arbitrary hex values.

**Semantic Color Tokens:**

| Token Class | Hex Value | Usage |
|-------------|-----------|-------|
| `bg-void` | `#F5F5F4` | Page background |
| `bg-obsidian` | `#FFFFFF` | Card and panel surfaces |
| `bg-slate` | `#FFFFFF` | Overridden to white — do not use for dark backgrounds |
| `bg-gunmetal` | `#FAFAF9` | Subtle background differentiation |
| `border-steel` | `#E7E5E4` | Borders and dividers |
| `text-graphite` | `#D6D3D1` | Muted text and inactive icons |
| `text-signal` | `#4F46E5` | Primary action color (indigo) |
| `text-crimson` | `#DC2626` | Error and danger states |
| `text-emerald` | `#059669` | Success states (DEFAULT only) |
| `text-amber` | `#D97706` | Warning states (DEFAULT only) |
| `text-violet` | `#7C3AED` | Accent (DEFAULT only) |
| `bg-signal-dim` | `#EEF2FF` | Light indigo badge backgrounds |
| `bg-emerald-dim` | `#ECFDF5` | Light green badge backgrounds |
| `bg-amber-dim` | `#FFFBEB` | Light amber badge backgrounds |
| `bg-crimson-dim` | `#FEF2F2` | Light red badge backgrounds |
| `bg-violet-dim` | `#F5F3FF` | Light violet badge backgrounds |

**Dark Theme Pattern (mandatory for hero sections):**

```jsx
// Correct approach — use arbitrary hex values
<div className="bg-[#0F172A] text-[#94A3B8]">
  <h1 className="text-white">Page Title</h1>
  <span className="text-[#059669]">Success text</span>
</div>

// Incorrect — these render incorrectly due to config overrides
<div className="bg-slate-900 text-slate-300">
  <span className="text-emerald-600">Text</span>
</div>
```

**Typography Tokens:**

| Font Family Class | Font | Usage |
|------------------|------|-------|
| `font-display` | Outfit | Page headings, hero text |
| `font-body` | DM Sans | Body copy, descriptions |
| `font-mono` | JetBrains Mono | Code, metric values, IDs |

**Module Accent Colors:**

| Module | Hero Background | Accent Color |
|--------|----------------|-------------|
| Dashboard | `#0F172A` | indigo (`signal`) |
| Incidents | `#0F172A` | amber |
| Changes | `#0F172A` | indigo + violet |
| Problems | `#0F172A` | violet |
| Alerts | `#0F172A` | red (`crimson`) |
| Assets/CMDB | `#0F172A` | emerald |
| Teams | `#0F172A` | violet |
| Users | `#0F172A` | indigo |

### 10.6 Component Architecture

All components are functional with React hooks. No class components are used.

**Standard page structure:**

```
<Page>
  <Hero Section>          ← Dark (#0F172A) with dot-grid texture and ambient glow
    <Stat Cards>          ← Glassmorphic: bg-white/[0.06] backdrop-blur-sm
  </Hero Section>
  <Gradient Accent Line>  ← Module-specific color gradient
  <Filter Bar>            ← White floating bar with search and filter controls
  <Content Area>          ← Table or card grid on white/void background
</Page>
```

**Form validation pattern:** `react-hook-form` for form state management, `zod` for schema validation. All forms are TypeScript typed.

**Data fetching pattern:** TanStack Query `useQuery` hooks in `/hooks/` directory. Cache is automatically invalidated after mutations. Loading and error states are handled at the hook level, not in components.

---

## 11. Operational Runbook

### 11.1 SLA Definitions

Default SLA targets are defined per priority. These can be overridden per organization via the `SLADefinition` model.

| Priority | Trigger Condition | Response Target | Resolution Target |
|----------|------------------|-----------------|-------------------|
| P1 | CRITICAL urgency or ENTERPRISE impact | 5 minutes | 1 hour |
| P2 | HIGH urgency or DEPARTMENT impact | 15 minutes | 4 hours |
| P3 | MEDIUM urgency or TEAM impact | 1 hour | 24 hours |
| P4 | LOW urgency or INDIVIDUAL impact | 4 hours | 72 hours |

SLA targets are calculated at incident creation time and stored as `slaTargetResponse` and `slaTargetResolution` timestamps on the Incident record. The SLA compliance checker runs every 60 seconds and sets `slaBreached = true` on any incident whose resolution target has passed without closure.

### 11.2 Health Check Procedure

**Platform health check:**

```bash
# External health check
curl https://fs-le-dev-inc.finspot.in/health

# Expected response
{
  "status": "healthy",
  "service": "linkedeye-api",
  "version": "2.0.0",
  "database": "connected"
}
```

**Kubernetes pod health:**

```bash
sudo kubectl get pods -n fs-linkedeye
sudo kubectl describe pod <pod-name> -n fs-linkedeye
sudo kubectl logs <api-pod-name> -n fs-linkedeye --tail=100
```

**Database health:**

```bash
cd backend && npm run db:health
# or
npx prisma studio  # Opens visual browser on port 5555
```

**SLA compliance check (manual trigger):**

```bash
cd backend && npm run sla:check
```

### 11.3 Deployment Procedure

1. **Build the new image:**
   ```bash
   sudo nerdctl --namespace k8s.io build --no-cache \
     -t linkedeye/api:vN ./backend
   ```

2. **Verify the build succeeds** — check for Prisma generation errors.

3. **Deploy to Kubernetes:**
   ```bash
   sudo kubectl set image deployment/linkedeye-api \
     api=linkedeye/api:vN -n fs-linkedeye
   ```

4. **Monitor rollout:**
   ```bash
   sudo kubectl rollout status deployment/linkedeye-api -n fs-linkedeye
   ```

5. **Verify health:**
   ```bash
   curl https://fs-le-dev-inc.finspot.in/health
   ```

6. **Rollback if health check fails:**
   ```bash
   sudo kubectl rollout undo deployment/linkedeye-api -n fs-linkedeye
   ```

### 11.4 Database Migration Procedure

**Development database migration:**

```bash
cd backend
npx prisma migrate dev --name "add_new_field"
npx prisma generate
```

**Production database migration (Kubernetes PostgreSQL):**

```bash
cd backend
# Set DATABASE_URL to K8s postgres connection string
export DATABASE_URL="postgresql://user:pass@10.97.121.123:5432/linkedeye"

# Apply pending migrations only (no schema generation, no prompts)
npx prisma migrate deploy

# Rebuild and deploy the API with updated Prisma client
sudo nerdctl --namespace k8s.io build --no-cache -t linkedeye/api:vN ./backend
sudo kubectl set image deployment/linkedeye-api api=linkedeye/api:vN -n fs-linkedeye
```

WARNING: Never run `prisma migrate dev` against the production database. Use `prisma migrate deploy` for production. The `dev` command may prompt for resets and drops data.

### 11.5 Incident Response Procedure

**P1 Incident Response (5-minute response target):**

1. Acknowledge the incident in Argus: `POST /api/v1/incidents/:id` with `state: 'IN_PROGRESS'`
2. Check if the AI Agent Pipeline has already executed remediation: `GET /api/v1/agent/executions`
3. Check live infrastructure metrics: `GET /api/v1/ai/infrastructure-metrics`
4. Check K8s cluster status: `GET /api/v1/k8s/overview`
5. If automated remediation was insufficient, SSH to the affected server directly
6. Add work notes to the incident documenting all actions taken
7. Update the incident state to `RESOLVED` with resolution notes when resolved

**Alert Investigation:**

1. Acknowledge the alert: `POST /api/v1/alerts/:id/acknowledge`
2. Check alert KB for known patterns: `GET /api/v1/alerts/kb`
3. Review linked incident (if auto-created): check work notes for AI remediation results
4. Check asset live metrics: `GET /api/v1/ai/assets/:id/live-metrics`

### 11.6 Troubleshooting Guide

**Problem: API pod returns 503 from health check**

1. Check pod status: `sudo kubectl get pods -n fs-linkedeye`
2. Check pod logs: `sudo kubectl logs <api-pod> -n fs-linkedeye --tail=200`
3. Verify database connectivity: test connection to `postgres.fs-linkedeye:5432`
4. Check Redis connectivity

**Problem: SSH commands to client server time out**

1. Verify the SSH key secret is mounted: `sudo kubectl exec -it <api-pod> -n fs-linkedeye -- ls /home/finadmin/.ssh/`
2. Test SSH manually from the pod: `sudo kubectl exec -it <api-pod> -n fs-linkedeye -- ssh -p <port> finadmin@<ip> "echo ok"`
3. Verify the client server's firewall allows inbound SSH from the Argus cluster's egress IP
4. Check that `openssh-client` is installed in the API container (verify the Dockerfile)

**Problem: Prometheus metrics return empty results**

1. Verify the org's PROMETHEUS integration has `status: ACTIVE`
2. Check the integration config has correct `serverIp`, `sshPort`, `sshUser`, `promPort`
3. Test Prometheus access from the pod: `sudo kubectl exec -it <api-pod> -n fs-linkedeye -- ssh -p <port> finadmin@<ip> "curl -sf http://localhost:30000/-/healthy"`

**Problem: Alerts not routing to correct organization**

1. Verify Alertmanager rule labels include `org_slug` matching the organization's slug field
2. Alternatively, verify the `instance` IP in alert labels matches `Organization.serverIp`
3. Check the webhook endpoint is reachable: `curl -X POST https://fs-le-dev-inc.finspot.in/api/v1/webhooks/alertmanager`

**Problem: PagerDuty events not being sent**

1. Verify the organization has a PAGERDUTY integration with `status: ACTIVE`
2. Verify the integration config contains `routingKey`
3. Check the AI Agent Pipeline status: `GET /api/v1/agent/status` — confirm `enabled: true` and the `critical-pagerduty` notification rule is enabled
4. Check recent execution logs: `GET /api/v1/agent/executions` for `pagerduty: failed` entries

**Problem: Token refresh loop (users repeatedly redirected to login)**

1. Check that Redis is running and reachable (session storage)
2. Verify `JWT_SECRET` and `REFRESH_TOKEN_SECRET` environment variables have not changed between deployments
3. Check the Session table for the user's refresh token expiry

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| ITSM | IT Service Management — the practice of managing IT services to meet defined service levels |
| ITIL | Information Technology Infrastructure Library — a framework of best practices for ITSM |
| CMDB | Configuration Management Database — the authoritative record of all IT assets (Configuration Items) |
| CI | Configuration Item — any IT component managed in the CMDB |
| SLA | Service Level Agreement — defines response and resolution time targets by priority |
| SLO | Service Level Objective — specific measurable targets within an SLA |
| P1–P4 | Priority levels: P1 = Critical (highest), P4 = Low (lowest) |
| RBAC | Role-Based Access Control — permission system based on user roles |
| JWT | JSON Web Token — a compact, signed token format used for authentication |
| ORM | Object-Relational Mapper — Prisma maps database tables to JavaScript objects |
| Multi-tenant | A single platform instance serving multiple isolated client organizations |
| Tenant | An individual client organization in the multi-tenant platform |
| SSH | Secure Shell — encrypted protocol for remote command execution |
| PromQL | Prometheus Query Language — used to query time-series metrics |
| IVR | Interactive Voice Response — automated phone system for call routing |
| STT | Speech-to-Text — converts audio to text (Whisper) |
| TTS | Text-to-Speech — converts text to audio (XTTS v2) |
| KEDB | Known Error Database — a record of known errors with documented workarounds |
| RCA | Root Cause Analysis — investigation to identify the underlying cause of an incident/problem |
| On-call | A schedule where team members are designated as the primary contact for incidents |
| Escalation | The process of involving higher levels of support when an issue is not resolved |
| Agent Pipeline | Argus's built-in automated remediation engine (replaces StackStorm) |
| node-exporter | Prometheus exporter for hardware and OS metrics on Linux nodes |
| kube-state-metrics | Kubernetes metrics exporter for pod, deployment, and node state |
| Alertmanager | Prometheus component that routes and deduplicates alerts |
| nerdctl | Container CLI compatible with Docker, used with containerd in K8s environments |
| Prisma | TypeScript-first ORM used by Argus for database access |
| Zustand | Lightweight React state management library |
| TanStack Query | Data fetching and caching library for React (formerly React Query) |
| Socket.IO | Real-time bidirectional event-based communication library |
| Helm | Kubernetes package manager (not currently used by Argus — direct kubectl) |
| CSP | Content Security Policy — HTTP header restricting resource loading |
| HMAC | Hash-based Message Authentication Code — used for webhook signature verification |
| Ring buffer | Fixed-size circular buffer — used for the pipeline execution log (last 100 entries) |

---

## 13. Appendices

### Appendix A: Client Organization SSH Reference

The following 13 client organizations have active SSH connectivity as of 2026-03-03:

| Organization Slug | Server IP | SSH Port | SSH User | Notes |
|------------------|-----------|---------|---------|-------|
| `fs-blr-indmoney-dr-le` | 180.179.253.162 | 2233 | finadmin | |
| `fs-dr-le` | 206.1.32.216 | 3311 | finadmin | |
| `fs-dx-le` | 103.231.42.57 | 2233 | leprod | Different SSH user |
| `fs-ifsc-le` | 49.249.139.196 | 2233 | finadmin | |
| `fs-le-isv` | 103.231.79.231 | 2233 | finadmin | |
| `fs-le-uat` | 103.231.79.170 | 2233 | finadmin | |
| `fs-mum-indmoney-prod-le` | 142.79.253.74 | 2233 | finadmin | |
| `fs-w2w-le` | 124.153.73.235 | 2233 | finadmin | |
| `ftc-mum-finspot-le` | 202.87.54.194 | 5522 | finadmin | Different SSH port |
| `indmoney-ifsc-le` | 49.249.139.195 | 2233 | finadmin | |
| `lemonn-le` | 154.210.170.126 | 4422 | finadmin | Primary test org |
| `neo-prod-le` | 206.1.27.194 | 2233 | finadmin | |
| `pl-prod-le` | 182.76.252.237 | 4427 | finadmin | Different SSH port |

**Lemonn Organization Reference Details:**
- FQDN: `lemonn.finspot.in`
- Organization ID (K8s postgres): `78b981f8-4df8-4c74-8a59-c9ea3fd8be6c`
- Prometheus: `http://154.210.170.126:30000`
- Grafana: `http://154.210.170.126:30010`
- Alertmanager: `http://154.210.170.126:32566`
- Grafana API Key: stored in Integration config (SA: `linkedeye-integration`)
- Node count: 14 nodes
- Pod count: ~59 pods (Grafana 12.1.0, Prometheus 2.44, StackStorm, Elasticsearch, MySQL, Vault, RabbitMQ, Apprise, node-exporter, kube-state-metrics v2.10.1)

### Appendix B: Integration Configuration Schema

**PROMETHEUS / KUBERNETES_CLUSTER / GRAFANA Integration Config:**

```json
{
  "accessMethod": "ssh",
  "serverIp": "203.0.113.10",
  "sshPort": 2233,
  "sshUser": "finadmin",
  "promPort": 30000,
  "grafanaPort": 30010,
  "prometheusUrl": "http://203.0.113.10:30000",
  "grafanaExternalUrl": "http://client.finspot.in:30010",
  "apiKey": "glsa_xxxxxxxxxxxx"
}
```

**PAGERDUTY Integration Config:**

```json
{
  "routingKey": "R014JLGZxxxxxxxxxxxxxxxxxx",
  "apiKey": "Bearer u+xxxxxxxxxxx",
  "subdomain": "client-subdomain"
}
```

**SLACK Integration Config:**

```json
{
  "webhookUrl": "https://hooks.slack.com/services/T.../B.../xxx",
  "botToken": "xoxb-...",
  "channelId": "C0123456789"
}
```

**TWILIO Integration Config:**

```json
{
  "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "authToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "fromNumber": "+12025551234"
}
```

**STACKSTORM Integration Config:**

```json
{
  "url": "http://154.210.170.126:32099",
  "apiKey": "st2-api-key",
  "webhookToken": "st2-webhook-token"
}
```

### Appendix C: Environment Variables Reference

The backend requires these environment variables, validated on startup by `backend/src/config/env.js`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Secret for signing access tokens |
| `REFRESH_TOKEN_SECRET` | Yes | Secret for signing refresh tokens |
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | API server port (default: 5000) |
| `CORS_ORIGINS` | Yes | Comma-separated list of allowed origins |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID for SMS/Voice |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_FROM_NUMBER` | No | Twilio outbound number |
| `OPENAI_API_KEY` | No | OpenAI API key (AI fallback) |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (AI fallback) |
| `OLLAMA_BASE_URL` | No | Ollama server URL (default: local) |
| `SMTP_HOST` | No | Email server hostname |
| `SMTP_PORT` | No | Email server port |
| `SMTP_USER` | No | Email server username |
| `SMTP_PASS` | No | Email server password |

A template with all required variables is available at `backend/.env.example`.

---

*End of Document*

**Document Classification:** Internal — Restricted
**Next Review Date:** 2026-06-03
**Document Owner:** Santhira Engineering Team
**Platform:** Argus ITSM v2.0.0 (formerly LinkedEye)
**Prepared by:** Enterprise Documentation Team
**Copyright:** © 2026 Santhira (Terv Pro Technology Pvt Ltd). All rights reserved.
