# Argus ITSM Platform — RCA, Incident Lifecycle & Completed Analysis Guide

| Field | Value |
|---|---|
| **Document Title** | Argus ITSM Platform — RCA, Incident Lifecycle & Completed Analysis Guide |
| **Document ID** | ARG-TEC-006 |
| **Version** | 1.0 |
| **Date** | 2026-03-03 |
| **Author** | Enterprise Documentation — Santhira (Terv Pro Technology Pvt Ltd) |
| **Classification** | INTERNAL |
| **Distribution** | IT Operations, Platform Engineering, Incident Management, DevOps |
| **Reviewed By** | Platform Architecture Team |
| **Status** | Approved |

---

## Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 1.0 | 2026-03-03 | Enterprise Doc Team | Initial release — covers RCA, incident lifecycle, and analytics subsystems |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope and Audience](#2-scope-and-audience)
3. [Glossary](#3-glossary)
4. [Part 1: AI-Powered Root Cause Analysis (RCA)](#4-part-1-ai-powered-root-cause-analysis-rca)
   - 4.1 RCA Architecture Overview
   - 4.2 AI RCA Engine
   - 4.3 Alert Knowledge Base (KEDB)
   - 4.4 Manual RCA Entry
   - 4.5 Problem Statistics and KEDB Browser
   - 4.6 Frontend RCA Workspace
5. [Part 2: Incident Ticket Lifecycle](#5-part-2-incident-ticket-lifecycle)
   - 5.1 Incident Data Model
   - 5.2 Incident Creation Methods
   - 5.3 Priority Matrix
   - 5.4 SLA Framework
   - 5.5 State Transitions
   - 5.6 Resolution Codes
   - 5.7 Live Operational Context
   - 5.8 AI Agent Pipeline Integration
   - 5.9 Incident PDF Report Generation
   - 5.10 Frontend Incident Detail
6. [Part 3: Completed Analysis and Reporting](#6-part-3-completed-analysis-and-reporting)
   - 6.1 Analytics Architecture
   - 6.2 Dashboard KPIs
   - 6.3 Incident Trend Analysis
   - 6.4 SLA Compliance Reports
   - 6.5 Team Performance
   - 6.6 Change Analytics
   - 6.7 Executive Summary
   - 6.8 Frontend Analytics Dashboard
   - 6.9 Frontend Hooks
7. [Part 4: Integration Between Systems](#7-part-4-integration-between-systems)
   - 7.1 Alert to Incident to Problem to RCA Flow
   - 7.2 Data Flow Diagram
   - 7.3 API Quick Reference Table
8. [Appendix A — Alert KB Reference](#8-appendix-a--alert-kb-reference)
9. [Appendix B — Incident State Machine Diagram](#9-appendix-b--incident-state-machine-diagram)
10. [Appendix C — Problem State Machine Diagram](#10-appendix-c--problem-state-machine-diagram)
11. [Appendix D — Resolution Codes Reference](#11-appendix-d--resolution-codes-reference)
12. [Appendix E — PDF Report Sections Reference](#12-appendix-e--pdf-report-sections-reference)

---

## 1. Executive Summary

Argus is an enterprise IT Service Management (ITSM) platform developed by Santhira (Terv Pro Technology Pvt Ltd) for large-scale, multi-tenant environments. Three subsystems govern the intelligence and operations lifecycle of the platform: Root Cause Analysis (RCA), Incident Ticket Lifecycle management, and Completed Analysis reporting.

The RCA subsystem combines a 17-entry Alert Knowledge Base (KEDB) with an AI engine backed by Ollama Qwen3-32B to provide structured, confidence-scored root cause determinations for Problem records. The AI reads alert patterns from linked incidents, matches them against the KEDB, constructs a structured prompt, and returns categorized analysis including evidence chains, workarounds, permanent fixes, and blast radius assessments.

The Incident Lifecycle subsystem supports seven state transitions, five creation paths (manual, Prometheus, Grafana, Slack, Voice IVR), an Impact-by-Urgency priority matrix, SLA target enforcement with pause/resume capability, and live Prometheus metric retrieval during incident response. Each incident carries its full operational context — from alert labels to configuration item data — accessible through a dedicated live-context endpoint.

The Reporting subsystem provides real-time dashboard KPIs, period-based trend analysis, SLA compliance tracking by priority class, per-team performance benchmarking, and executive summaries suitable for CTO-level review. All reporting is multi-tenant, filtered via the `req.tenantWhere` middleware pattern.

This guide is the authoritative technical reference for all three subsystems. It documents endpoints, data models, state machines, AI pipeline behavior, and the integration points that connect alerts through to closed-loop RCA.

---

## 2. Scope and Audience

**Scope:** This document covers the following Argus subsystems:

- Problem Management and AI-powered Root Cause Analysis
- Incident ticket lifecycle from creation to closure
- Analytics, reporting, and SLA compliance measurement
- Cross-system data flow from alert ingestion to completed analysis

**Out of scope:** Change Management lifecycle, Asset/CMDB management, on-call scheduling configuration, and integrations administration are documented separately.

**Target Audience:**

| Audience | Relevant Sections |
|---|---|
| Platform Engineers | All sections — implementation reference |
| Incident Managers | Part 2, Appendices B and D |
| Problem Managers | Part 1, Part 4 |
| IT Operations (NOC) | Part 2 (creation methods, state transitions, live context) |
| Management and Compliance | Executive Summary, Part 3, Appendix A |
| Frontend Developers | Sections 4.6, 5.10, 6.8 |

---

## 3. Glossary

| Term | Definition |
|---|---|
| ITSM | IT Service Management — structured framework for delivering IT services |
| ITIL | IT Infrastructure Library — best-practice framework for ITSM |
| RCA | Root Cause Analysis — structured determination of why an incident or problem occurred |
| KEDB | Known Error Database — repository of problems with confirmed root causes and workarounds |
| SLA | Service Level Agreement — contractual obligation defining response and resolution targets |
| MTTR | Mean Time to Resolve — average duration from incident creation to resolution |
| KPI | Key Performance Indicator — measurable value demonstrating performance against objectives |
| P1–P4 | Priority levels 1 (highest/critical) through 4 (lowest) |
| Impact | Breadth of business effect: ENTERPRISE, DEPARTMENT, TEAM, INDIVIDUAL |
| Urgency | Speed at which an issue must be resolved: CRITICAL, HIGH, MEDIUM, LOW |
| CI | Configuration Item — any infrastructure or application component tracked in the CMDB |
| CMDB | Configuration Management Database — inventory of CIs and their relationships |
| KB | Knowledge Base — structured repository of known issue patterns and resolutions |
| Prometheus | Open-source monitoring system providing time-series metrics |
| Alertmanager | Prometheus component that routes, deduplicates, and fires alert notifications |
| Grafana | Metrics visualization and dashboarding platform |
| SSH | Secure Shell — encrypted protocol used by Argus for remote infrastructure access |
| ORM | Object-Relational Mapper — Prisma in Argus's backend |
| JWT | JSON Web Token — authentication token format used by Argus |
| RBAC | Role-Based Access Control — permission system based on user roles |
| Ollama | Self-hosted large language model server used for AI RCA |
| Qwen3-32B | Large language model used for RCA generation (32 billion parameters) |
| Socket.IO | Real-time bidirectional event library for browser-to-server communication |
| PDFKit | Node.js PDF generation library used for incident reports |

---

## 4. Part 1: AI-Powered Root Cause Analysis (RCA)

### 4.1 RCA Architecture Overview

Root Cause Analysis in Argus is anchored to the Problem record, which represents a recurring or underlying cause shared across one or more incidents. The Problem model stores both a free-text `rootCause` field and a structured `rootCauseAnalysis` JSON field for machine-generated or AI-assisted analysis.

**Problem Model Schema** (from `backend/prisma/schema.prisma`, lines 519–553):

```prisma
model Problem {
  id                 String       @id @default(uuid())
  number             String       @unique               // PRB0000001 format
  shortDescription   String
  description        String?
  state              ProblemState @default(NEW)
  priority           Priority     @default(P4)
  category           String?
  assignedToId       String?
  assignmentGroupId  String?
  createdById        String
  rootCause          String?                           // Free-text summary
  rootCauseAnalysis  Json?                             // Structured AI/manual RCA
  workaround         String?
  workaroundEffective Boolean     @default(false)
  permanentFix       String?
  fixImplemented     Boolean      @default(false)
  relatedChangeId    String?
  isKnownError       Boolean      @default(false)      // True when state = KNOWN_ERROR
  knownErrorId       String?
  organizationId     String?
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
  linkedIncidents    IncidentProblem[]
  workNotes          WorkNote[]
  activities         Activity[]
}
```

**ProblemState Pipeline** (from `backend/src/config/constants.js`, line 7):

The Problem lifecycle follows a six-state pipeline that models the ITIL v4 Problem Management process:

```
NEW → INVESTIGATION → RCA_IN_PROGRESS → KNOWN_ERROR → RESOLVED → CLOSED
```

Valid transitions are enforced by the `PROBLEM_TRANSITIONS` map:

```javascript
const PROBLEM_TRANSITIONS = {
  NEW:              ['INVESTIGATION'],
  INVESTIGATION:    ['RCA_IN_PROGRESS', 'KNOWN_ERROR'],
  RCA_IN_PROGRESS:  ['KNOWN_ERROR', 'RESOLVED'],
  KNOWN_ERROR:      ['RESOLVED'],
  RESOLVED:         ['CLOSED'],
  CLOSED:           [],
};
```

**RCA Integration with Problem Lifecycle:**

The RCA process begins when a Problem reaches `INVESTIGATION` state. Engineers gather evidence from linked incidents, review alert patterns, and either trigger the AI RCA engine or enter manual root cause data. When RCA is accepted and state transitions to `KNOWN_ERROR`, the `isKnownError` flag is set automatically (see `problem.controller.js`, line 110). This promotes the Problem to the Known Error Database (KEDB), making its workaround available to future incident responders.

---

### 4.2 AI RCA Engine

The AI RCA engine generates structured root cause analysis for any Problem that has linked incidents. It correlates alert names against the 17-entry Knowledge Base, constructs a rich contextual prompt, and submits it to Ollama Qwen3-32B for analysis.

**Endpoint:**

```
POST /api/v1/problems/:id/ai-rca
Authorization: Bearer <token>
Roles: ADMIN, MANAGER, ENGINEER
```

**Source File:** `backend/src/controllers/problem.controller.js`, lines 155–278

**Processing Pipeline:**

The `aiRCA()` function executes the following eight steps in sequence:

**Step 1 — Load Problem and Linked Incidents**

The function fetches the Problem record with full linked incident data, extracting `alertName` and `labels` fields from each linked incident.

```javascript
const problem = await prisma.problem.findUnique({
  where: { id: req.params.id },
  include: {
    linkedIncidents: {
      include: {
        incident: {
          select: {
            id: true, number: true, shortDescription: true,
            description: true, priority: true, state: true,
            alertName: true, labels: true
          },
        },
      },
    },
    assignmentGroup: { select: { name: true } },
  },
});
```

**Step 2 — KEDB Pattern Matching**

For each linked incident's alert name, the function calls `getAlertKB(alertName)` to find matching Knowledge Base entries. All matches are collected into `kbMatches[]`.

```javascript
const kbMatches = [];
for (const inc of incidents) {
  const alertName = inc.alertName || inc.shortDescription || '';
  const kb = getAlertKB(alertName);
  if (kb) kbMatches.push({ alertName, kb });
}
```

**Step 3 — Prompt Construction**

A structured prompt is built containing the Problem number, title, description, category, priority, a formatted list of all linked incidents with their states and priorities, and the full KB context for each matched alert (root causes, investigation commands, remediation steps).

**Step 4 — AI Call (Ollama Qwen3-32B)**

The prompt is submitted to `ollamaGenerate()` with temperature 0.3 to minimize creative variation and maximize deterministic technical accuracy:

```javascript
response = await ollamaGenerate(prompt, 'qwen3:32b', { temperature: 0.3 });
```

**Step 5 — Fallback (AI Unavailable)**

If the Ollama call fails, the engine builds a KB-based RCA using the first matched KB entry. This fallback assigns a confidence score of 50%, lower than the AI-generated minimum, to signal manual review is required:

```javascript
response = JSON.stringify({
  category: firstKB.kb.cat,
  rootCause: firstKB.kb.rootCause[0],
  evidence: firstKB.kb.rootCause,
  workaround: firstKB.kb.remediate[0] || '',
  permanentFix: firstKB.kb.remediate.slice(-1)[0] || '',
  confidence: 50,
  relatedKBEntries: kbMatches.map(m => m.alertName),
});
```

If AI is unavailable and no KB matches exist, the endpoint returns HTTP 503.

**Step 6 — JSON Parsing**

The response is parsed with regex extraction to handle cases where the model wraps output in markdown code fences:

```javascript
const jsonMatch = response.match(/\{[\s\S]*\}/);
rca = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
```

**Step 7 — KB Enrichment**

The parsed RCA object is enriched with full KB details including investigation commands, remediation steps, escalation procedures, and blast radius descriptions:

```javascript
rca.kbDetails = kbMatches.map(m => ({
  alertName: m.alertName,
  category: m.kb.cat,
  rootCauses: m.kb.rootCause,
  investigate: m.kb.investigate,
  remediate: m.kb.remediate,
  escalation: m.kb.escalation,
  blastRadius: m.kb.blast,
}));
```

**Step 8 — Persist and Log**

The RCA object is saved to `problem.rootCauseAnalysis` (the JSON field) and an activity log entry with action `AI_RCA` is created.

**Response Schema:**

```json
{
  "success": true,
  "data": {
    "category": "Infrastructure",
    "rootCause": "Filesystem usage exceeded threshold due to log accumulation",
    "evidence": [
      "Three linked incidents show NodeDiskRunningFull alerts",
      "Alert fired at 94% usage on /var/log filesystem",
      "KB confirms log accumulation as primary cause pattern"
    ],
    "workaround": "Rotate logs: logrotate -f /etc/logrotate.conf",
    "permanentFix": "Set up automated cleanup cron with log rotation policy",
    "confidence": 87,
    "relatedKBEntries": ["NodeDiskRunningFull", "HostDiskAlmostFull"],
    "kbDetails": [
      {
        "alertName": "NodeDiskRunningFull",
        "category": "Storage",
        "rootCauses": ["Filesystem usage exceeded threshold", "..."],
        "investigate": ["df -hT", "find / -type f -size +100M", "..."],
        "remediate": ["logrotate -f /etc/logrotate.conf", "..."],
        "escalation": "If disk > 95% and growing, escalate to Infrastructure immediately",
        "blastRadius": "High — full disk causes crashes, DB corruption, pod evictions"
      }
    ]
  }
}
```

**Confidence Score Interpretation:**

| Range | Meaning | Recommended Action |
|---|---|---|
| 85–100 | High confidence, strong KB correlation | Accept and advance to KNOWN_ERROR |
| 60–84 | Medium confidence, partial evidence | Review evidence points, validate before accepting |
| 50–59 | Low confidence, AI fallback or sparse KB match | Manual review required |
| 30–49 | Very low confidence, AI parse failure | Treat as starting point only |

---

### 4.3 Alert Knowledge Base (KEDB)

The Alert Knowledge Base is the authoritative reference for known alert patterns. It is defined as a static JavaScript object `ALERT_KB` in `backend/src/controllers/alert.controller.js`, lines 133–238.

**KB Entry Schema:**

Each KB entry contains the following fields:

| Field | Type | Description |
|---|---|---|
| `cat` | String | Category: Storage, Compute, Network, Security, Infrastructure, Kubernetes, Application, Database |
| `rootCause` | String[] | Ordered list of known root causes for this alert type |
| `investigate` | String[] | Step-by-step investigation commands with shell examples |
| `remediate` | String[] | Ordered remediation actions from quick-fix to permanent |
| `escalation` | String | Escalation threshold and target team |
| `blast` | String | Blast radius assessment — scope of impact |

**KB Matching Function:**

The `getAlertKB(name)` function performs case-insensitive substring matching on alert names (source: `backend/src/controllers/alert.controller.js`, lines 240–263):

```javascript
function getAlertKB(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('disk') || n.includes('filesystem')) return ALERT_KB.disk;
  if (n.includes('cpu') || n.includes('load')) return ALERT_KB.cpu;
  if (n.includes('mem') && !n.includes('deploy')) return ALERT_KB.memory;
  if (n.includes('icmp') || n.includes('ping') || n.includes('blackbox')) return ALERT_KB.icmp;
  if (n.includes('switch') || n.includes('snmp') || n.includes('huawei') ||
      n.includes('ifoper') || (n.includes('enabled') && n.includes('down'))) return ALERT_KB.switch;
  if (n.includes('fortigate') || n.includes('firewall')) return ALERT_KB.fortigate;
  if (n.includes('login') || n.includes('ssh')) return ALERT_KB.login;
  if (n.includes('hostdown') || n.includes('host_down')) return ALERT_KB.hostdown;
  // Kubernetes layer
  if (n.includes('crashloop') || n.includes('podcrash')) return ALERT_KB.kubePodCrash;
  if (n.includes('oomkill') || n.includes('oom') || n.includes('outofmemory')) return ALERT_KB.kubePodOOM;
  if (n.includes('podnotready') || (n.includes('pod') && n.includes('notready'))) return ALERT_KB.kubePodNotReady;
  if (n.includes('nodenotready') || (n.includes('node') && n.includes('notready'))) return ALERT_KB.kubeNodeNotReady;
  if (n.includes('replicasmismatch') || n.includes('deploymentmismatch')) return ALERT_KB.kubeDeploymentMismatch;
  if (n.includes('hpamaxreplicas') || n.includes('hpa') || n.includes('autoscal')) return ALERT_KB.kubeHPA;
  // Application layer
  if (n.includes('500') || n.includes('5xx') || n.includes('apperror')) return ALERT_KB.appError;
  if (n.includes('dbconnect') || n.includes('database') || n.includes('postgres')) return ALERT_KB.dbConnection;
  if (n.includes('certif') || n.includes('ssl') || n.includes('tls')) return ALERT_KB.certificate;
  return null;
}
```

> **NOTE:** The function returns `null` for unrecognized alert names. The AI RCA engine handles this gracefully — the KB context section of the prompt is marked as "No KB matches found" and the AI relies on linked incident descriptions.

**KB API Endpoint:**

```
GET /api/v1/alerts/kb
Authorization: Bearer <token>
Response: { success: true, data: { <key>: { cat, rootCause, investigate, remediate, escalation, blast } } }
```

The full KB is exposed as structured JSON, enabling the frontend KB Browser to display all 17 entries with diagnostic commands and remediation steps.

**17 KB Entries by Layer:**

*Infrastructure Layer (8 entries):*
- `disk` — Storage issues (filesystem full, log accumulation)
- `cpu` — CPU saturation, runaway processes
- `memory` — Memory exhaustion, OOM events
- `icmp` — Host unreachable via ping/ICMP
- `switch` — Network switch port anomalies
- `fortigate` — FortiGate firewall alerts
- `login` — SSH/login threshold violations, brute-force
- `hostdown` — Complete host unavailability

*Kubernetes Layer (6 entries):*
- `kubePodCrash` — CrashLoopBackOff pods
- `kubePodOOM` — Out-of-memory pod kills
- `kubePodNotReady` — Readiness probe failures
- `kubeNodeNotReady` — Node kubelet disconnection
- `kubeDeploymentMismatch` — Replica count deficit
- `kubeHPA` — Horizontal Pod Autoscaler at maximum replicas

*Application Layer (3 entries):*
- `appError` — HTTP 5xx application errors
- `dbConnection` — Database connection failures
- `certificate` — TLS/SSL certificate expiry

---

### 4.4 Manual RCA Entry

Engineers can update RCA data directly without invoking the AI engine. This is appropriate when the root cause is already known or when AI output requires correction.

**Endpoint:**

```
PATCH /api/v1/problems/:id/rca
Authorization: Bearer <token>
Roles: ADMIN, MANAGER, ENGINEER
```

**Request Body:**

```json
{
  "rootCause": "Log accumulation in /var/log/application exceeded 90% of disk",
  "rootCauseAnalysis": {
    "category": "Storage",
    "evidence": ["df -h output showed 94% on /dev/sda1", "journalctl showed 45GB of logs"],
    "confidence": 95
  },
  "workaround": "Manually rotate and compress logs: logrotate -f /etc/logrotate.conf",
  "workaroundEffective": true,
  "permanentFix": "Implement log retention policy with 7-day rotation and automatic compression"
}
```

**Source File:** `backend/src/controllers/problem.controller.js`, lines 126–141

The endpoint updates all five RCA fields atomically and logs an `RCA_UPDATED` activity entry. Unlike the AI endpoint, manual RCA accepts any values without validation constraints — this allows engineers to record unstructured findings.

---

### 4.5 Problem Statistics and KEDB Browser

**Endpoint:**

```
GET /api/v1/problems/stats
Authorization: Bearer <token>
```

**Source File:** `backend/src/controllers/problem.controller.js`, lines 281–302

The endpoint returns two datasets for the frontend pipeline visualization:

1. **State distribution counts** — count of problems in each of the six states
2. **Known Errors (KEDB)** — top 10 most recently updated problems with `state = 'KNOWN_ERROR'`, including their workarounds

**Response Schema:**

```json
{
  "success": true,
  "data": {
    "stateCounts": {
      "NEW": 3,
      "INVESTIGATION": 5,
      "RCA_IN_PROGRESS": 2,
      "KNOWN_ERROR": 8,
      "RESOLVED": 41,
      "CLOSED": 120
    },
    "knownErrors": [
      {
        "id": "uuid",
        "number": "PRB0000042",
        "shortDescription": "Recurring disk pressure on Lemonn production nodes",
        "workaround": "Run logrotate -f /etc/logrotate.conf and crictl rmi --prune",
        "category": "Storage",
        "priority": "P2"
      }
    ]
  }
}
```

> **NOTE:** The `stateCounts` object uses the exact state names from the `ProblemState` enum. The frontend pipeline visualization maps these six states to a visual stage indicator.

---

### 4.6 Frontend RCA Workspace

**Source File:** `frontend-react/src/components/Problems/ProblemDetail.tsx`, lines 535–787

The Root Cause tab in the Problem Detail view renders five distinct panels:

**Panel 1 — AI Root Cause Analysis Panel**

The primary RCA interaction surface. It contains:
- An "Analyze with AI" button that triggers `useAiRCA()` mutation (`POST /api/v1/problems/:id/ai-rca`)
- A confidence gauge rendered as an SVG arc (0–100%, color-coded: green above 80, amber above 60, red below 60)
- Categorized root cause description text
- Evidence points rendered as a numbered list
- Workaround card (amber-bordered) with copyable text
- Permanent fix card (green-bordered)
- "Accept RCA and Advance State" button that patches the Problem state to the next valid state via `PROBLEM_TRANSITIONS`

**Panel 2 — Impact and Blast Radius Panel**

Displays:
- Count of linked incidents
- RCA category label
- Team impacted (from `problem.assignmentGroup.name`)

**Panel 3 — Evidence Chain**

Renders a timeline of linked incidents with:
- Incident number and short description
- Priority badge (color-coded P1–P4)
- Current state
- Alert name if available (from `incident.alertName`)

**Panel 4 — Knowledge Base Browser**

Shows all matched KB entries from the RCA response's `kbDetails` array. Each KB card contains:
- Category and alert name header
- Expandable diagnostic commands section (monospace, copyable)
- Expandable remediation steps section
- Blast radius badge
- "Apply to RCA" button that populates the manual fields from KB data

**Panel 5 — Manual Root Cause Section**

Editable text fields for:
- `rootCause` (short free-text summary)
- `permanentFix` (long-form description)
- Save button triggering `PATCH /api/v1/problems/:id/rca`

**Frontend Hooks:**

| Hook | Query | Cache | Description |
|---|---|---|---|
| `useAiRCA()` | `POST /api/v1/problems/:id/ai-rca` | Mutation | Triggers AI analysis, invalidates problem cache |
| `useAlertKB()` | `GET /api/v1/alerts/kb` | 5 minutes | Fetches all 17 KB entries for the browser panel |
| `useProblemStats()` | `GET /api/v1/problems/stats` | 30 seconds | State counts and known errors list |

---

## 5. Part 2: Incident Ticket Lifecycle

### 5.1 Incident Data Model

The `Incident` model is defined in `backend/prisma/schema.prisma`, lines 410–464. It contains the following field categories:

**Identity and Classification:**

| Field | Type | Description |
|---|---|---|
| `id` | String (UUID) | Internal primary key |
| `number` | String (unique) | ITIL number: INC0000001 format |
| `shortDescription` | String | Brief one-line description |
| `description` | String? | Full structured description (multi-line) |
| `state` | IncidentState | Current lifecycle state |
| `impact` | Impact | Business scope: ENTERPRISE, DEPARTMENT, TEAM, INDIVIDUAL |
| `urgency` | Urgency | Resolution speed: CRITICAL, HIGH, MEDIUM, LOW |
| `priority` | Priority | Calculated: P1–P4 |
| `category` | String? | Alert category (from KB or manual) |
| `subcategory` | String? | Sub-classification |

**Assignment:**

| Field | Type | Description |
|---|---|---|
| `assignedToId` | String? | FK to User (individual assignee) |
| `assignmentGroupId` | String? | FK to Team (assignment group) |
| `createdById` | String | FK to User who created the incident |

**SLA Tracking:**

| Field | Type | Description |
|---|---|---|
| `slaBreached` | Boolean | True when resolution time exceeded target |
| `responseTime` | DateTime? | When incident first acknowledged |
| `resolutionTime` | DateTime? | When incident resolved (set on RESOLVED transition) |
| `slaTargetResponse` | DateTime? | Computed SLA response deadline |
| `slaTargetResolution` | DateTime? | Computed SLA resolution deadline |
| `slaPausedAt` | DateTime? | When SLA clock was paused (ON_HOLD) |
| `slaPausedDuration` | Int | Cumulative paused seconds (excluded from SLA calculation) |

**Source Tracking:**

| Field | Type | Description |
|---|---|---|
| `source` | IncidentSource | Creation source: MANUAL, PROMETHEUS, GRAFANA, API, EMAIL, VOICE, SLACK |
| `sourceAlertId` | String? | Alert ID that triggered auto-creation |
| `sourceAlertName` | String? | Alert name for context and KB lookup |

**Resolution:**

| Field | Type | Description |
|---|---|---|
| `resolvedAt` | DateTime? | Timestamp set when state transitions to RESOLVED |
| `closedAt` | DateTime? | Timestamp set when state transitions to CLOSED |
| `resolutionCode` | String? | One of eight resolution codes |
| `resolutionNotes` | String? | Engineer's resolution description |

**Relationships:** The model relates to `Organization` (tenant), `User` (assignee, creator), `Team` (assignment group), `ConfigurationItem` (affected CI), `Alert[]` (related firing alerts), `WorkNote[]`, `Activity[]`, `IncidentChange[]`, and `IncidentProblem[]`.

---

### 5.2 Incident Creation Methods

Argus supports five distinct incident creation paths. All paths ultimately call `prisma.incident.create()` and emit real-time events via Socket.IO.

#### A. Manual Creation

**Endpoint:** `POST /api/v1/incidents`
**Source File:** `backend/src/controllers/incident.controller.js`, lines 91–131
**Authentication:** `authenticate` + any authenticated role

**Processing:**

1. `generateIncidentNumber()` produces the next sequential INC number by querying the highest existing number and incrementing.
2. `calculatePriority(impact, urgency)` maps the Impact-Urgency combination to P1–P4.
3. `calculateSLATargetTimes(priority, createdAt)` computes `slaTargetResponse` and `slaTargetResolution` from the SLA defaults table.
4. The incident is persisted with `source: 'MANUAL'`.
5. Three Socket.IO events are emitted: `incident:created` (broadcast), `incident:assigned` (to the team channel), and `incident:assigned-to-you` (to the individual assignee).

**Request Body:**

```json
{
  "shortDescription": "Database connection failures on production",
  "description": "PostgreSQL reporting max_connections exceeded since 14:32 UTC",
  "impact": "DEPARTMENT",
  "urgency": "HIGH",
  "category": "Database",
  "assignmentGroupId": "team-uuid",
  "assignedToId": "user-uuid",
  "configItemId": "ci-uuid",
  "source": "MANUAL"
}
```

#### B. Automatic Creation from Prometheus Alerts

**Endpoint:** `POST /api/v1/webhooks/alertmanager` (no authentication required)
**Source File:** `backend/src/controllers/webhook.controller.js`, lines 103–211

This endpoint receives the standard Alertmanager webhook payload. Processing occurs per-alert in a loop:

1. **Deduplication:** The alertId (`alertname:instance`) is checked against existing Alert records.
2. **Org Resolution:** The organization is identified through a three-step lookup: `org_slug` label → `organization` label → `client` label → source IP match against `Organization.serverIp`.
3. **Alert Persistence:** The alert is created with severity normalized to CRITICAL, WARNING, or INFO.
4. **Severity Gate:** Only CRITICAL and WARNING alerts auto-create incidents. INFO alerts are saved as alert records only:

   ```javascript
   // Auto-create incident ONLY for CRITICAL and WARNING alerts
   if (alert.severity === 'CRITICAL' || alert.severity === 'WARNING') {
     // ... incident creation
   } else {
     logger.info(`Skipping auto-incident for INFO alert ${alert.name} — only CRITICAL/WARNING create incidents`);
   }
   ```

5. **Team Resolution:** `resolveTeamAndAssignee()` performs a three-tier lookup:
   - Tier 1: CMDB `ConfigurationItem.supportGroupId`
   - Tier 2: Category-to-team pattern matching (`CATEGORY_TEAM_PATTERNS` map)
   - Tier 3: Current on-call user from `OnCallSchedule`, falling back to team manager

6. **AI Agent Pipeline:** `agentPipeline.processAlert()` is called asynchronously after incident creation.

**CATEGORY_TEAM_PATTERNS** (source: `backend/src/controllers/webhook.controller.js`, lines 30–39):

| Category | Team Name Patterns Searched |
|---|---|
| Hardware | Infrastructure, Platform, SRE |
| Cloud Infrastructure | Infrastructure, Platform, SRE |
| Network | Network, NOC |
| Database | DBA, Database |
| Security | Security, SecOps |
| Application | Application, Development, Engineering |
| Monitoring | DevOps, Platform |
| Other | DevOps, Platform |

#### C. Automatic Creation from Grafana Alerts

**Endpoint:** `POST /api/v1/webhooks/grafana?orgId=<uuid>` (no authentication required)
**Source File:** `backend/src/controllers/webhook.controller.js`, lines 214–308

Grafana alerts use a simplified org resolution: `?orgId=` query param → `?orgSlug=` query param → source IP match. All Grafana alerts receive `severity: 'WARNING'` and default to P3. The incident is created with `source: 'GRAFANA'` and `state: 'NEW'`.

When Grafana fires a `state: 'ok'` webhook, the corresponding alert is resolved (`status: 'RESOLVED'`).

#### D. Creation from Slack Integration

Slack slash commands (`POST /api/v1/webhooks/slack/commands`) are handled by `slackService.handleSlashCommand()`. Interactive block actions (`POST /api/v1/webhooks/slack/interactive`) support direct incident state changes from Slack — for example, the `ack_incident_<id>` action_id transitions an incident to `IN_PROGRESS` directly from a Slack message button.

#### E. Creation from Voice IVR

The Voice module (`/api/v1/voice/`) supports inbound call handling through Twilio IVR. Callers report incidents verbally; the IVR captures the description and creates an incident with `source: 'VOICE'`. The voice controller resolves the caller's identity and organization from the calling number.

---

### 5.3 Priority Matrix

Priority is calculated by `calculatePriority(impact, urgency)` using the `PRIORITY_MATRIX` constant from `backend/src/config/constants.js`, lines 14–18:

| | CRITICAL Urgency | HIGH Urgency | MEDIUM Urgency | LOW Urgency |
|---|---|---|---|---|
| **ENTERPRISE Impact** | P1 | P1 | P2 | P3 |
| **DEPARTMENT Impact** | P1 | P2 | P2 | P3 |
| **TEAM Impact** | P2 | P2 | P3 | P4 |
| **INDIVIDUAL Impact** | P2 | P3 | P4 | P4 |

**Impact Definitions:**
- `ENTERPRISE` — Organization-wide service disruption affecting all users or critical revenue systems
- `DEPARTMENT` — Multiple departments or a business-critical function is impaired
- `TEAM` — A single team or non-critical function is affected
- `INDIVIDUAL` — A single user or low-impact function is affected

**Urgency Definitions:**
- `CRITICAL` — Immediate business impact; no workaround available
- `HIGH` — Significant degradation; workaround difficult to apply
- `MEDIUM` — Moderate impact; workaround available but inconvenient
- `LOW` — Minor inconvenience; full workaround available

When impact or urgency fields are updated on an existing incident, priority is recalculated automatically (see `incident.controller.js`, lines 173–175).

---

### 5.4 SLA Framework

SLA targets are calculated at incident creation time from the `SLA_DEFAULTS` constant (`backend/src/config/constants.js`, lines 22–27):

| Priority | Response Target | Resolution Target | Response (min) | Resolution (min) |
|---|---|---|---|---|
| P1 | 5 minutes | 1 hour | 5 | 60 |
| P2 | 15 minutes | 4 hours | 15 | 240 |
| P3 | 1 hour | 24 hours | 60 | 1440 |
| P4 | 4 hours | 72 hours | 240 | 4320 |

**SLA Target Calculation:**

```javascript
function calculateSLATargetTimes(priority, createdAt) {
  const sla = getSLATargets(priority);       // Look up minutes from SLA_DEFAULTS
  const base = new Date(createdAt);
  return {
    slaTargetResponse: new Date(base.getTime() + sla.response * 60000),
    slaTargetResolution: new Date(base.getTime() + sla.resolution * 60000),
  };
}
```

**SLA Pause and Resume:**

When an incident transitions to `ON_HOLD`, the SLA clock pauses. The `slaPausedAt` timestamp records the pause moment. When the incident returns to `IN_PROGRESS`, the elapsed pause duration is added to `slaPausedDuration` and excluded from SLA calculations. This supports scenarios where the incident is waiting for customer confirmation or vendor response.

**SLA Breach Detection:**

A background job runs every 60 seconds at server boot. It identifies incidents where `slaTargetResolution` has passed and `slaBreached` is still `false`, then updates the flag and emits SLA breach notifications.

**SLA Compliance Metric:**

```
SLA Compliance % = (Total Incidents - Breached Incidents) / Total Incidents × 100
```

This metric is computed per priority class and reported in both the dashboard and the dedicated SLA compliance endpoint.

---

### 5.5 State Transitions

The `INCIDENT_TRANSITIONS` map enforces valid state changes (`backend/src/config/constants.js`, lines 30–38):

```javascript
const INCIDENT_TRANSITIONS = {
  NEW:         ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'ESCALATED', 'RESOLVED'],
  ON_HOLD:     ['IN_PROGRESS'],
  ESCALATED:   ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED:    ['CLOSED', 'IN_PROGRESS'],
  CLOSED:      [],
  CANCELLED:   [],
};
```

**Validation Logic** (`backend/src/controllers/incident.controller.js`, lines 144–148):

```javascript
if (req.body.state && req.body.state !== existing.state) {
  const allowed = INCIDENT_TRANSITIONS[existing.state] || [];
  if (!allowed.includes(req.body.state)) {
    return error(res, `Cannot transition from ${existing.state} to ${req.body.state}`, 400);
  }
}
```

**State Transition Side Effects:**

| Transition | Side Effects |
|---|---|
| Any → RESOLVED | Sets `resolvedAt` and `resolutionTime` timestamps |
| Any → CLOSED | Sets `closedAt` timestamp |
| Any → ESCALATED | Emits `INCIDENT_ESCALATED` event via `eventBus` |
| RESOLVED → CLOSED | Terminal — no further transitions possible |
| Any → CANCELLED | Terminal — no further transitions possible |

**Activity Logging:** Every state change creates an `Activity` record with `action: 'STATE_CHANGED'`, capturing `oldValue` and `newValue` for full audit trail.

**Real-time Events:** State changes emit `incident:updated` (broadcast to all) and `incident:detail-updated` (to the incident-specific room). Assignment changes emit `incident:assigned-to-you` to the new assignee.

---

### 5.6 Resolution Codes

The `resolutionCode` field accepts one of eight values. The field is a free string in the schema (not a Prisma enum), allowing forward compatibility.

| Code | Description | When to Use |
|---|---|---|
| `FIXED` | Root cause identified and permanently corrected | Issue is fully resolved with no recurrence expected |
| `WORKAROUND` | Temporary fix applied; permanent fix pending | Service restored via workaround; Problem record should be created |
| `KNOWN_ERROR` | Existing KEDB entry applied | Incident matches a documented known error pattern |
| `DUPLICATE` | Incident is a duplicate of an existing active incident | Merge into parent incident and close |
| `NOT_REPRODUCIBLE` | Cannot reproduce the reported issue | No evidence found after investigation |
| `USER_ERROR` | Caused by incorrect user action or configuration | Requires user communication and training |
| `CONFIGURATION` | Resolved by correcting a configuration setting | Config drift, misconfiguration, wrong parameter |
| `NO_ACTION_REQUIRED` | Investigation confirmed no actual issue | Alert noise, planned maintenance, false positive |

---

### 5.7 Live Operational Context

The live context endpoint provides everything a responder needs during active incident response — alert details, real-time infrastructure metrics, firing alerts, past similar incidents, and CMDB data — in a single API call.

**Endpoint:**

```
GET /api/v1/incidents/:id/live-context
Authorization: Bearer <token>
Timeout: Prometheus queries have a 10-second race condition timeout
```

**Source File:** `backend/src/controllers/incident.controller.js`, lines 295–586

**Response Structure:**

```json
{
  "incident": { "id", "number", "state", "priority", "shortDescription", "organizationId" },
  "organization": { "id", "name", "environment", "slug", "serverIp", "fqdn" },
  "alertContext": {
    "labels": {},
    "annotations": {},
    "alertName": "NodeDiskRunningFull",
    "instance": "10.41.0.110:9100",
    "ip": "10.41.0.110",
    "hostname": "lemonn-mum-le",
    "namespace": "",
    "pod": "",
    "job": "node-exporter",
    "dashboardUrl": "https://grafana.example.com/d/abc",
    "runbookUrl": "https://runbook.example.com/disk",
    "summary": "Disk usage at 94% on lemonn-mum-le",
    "severity": "CRITICAL",
    "alertCount": 1
  },
  "metrics": {
    "available": true,
    "osType": "linux",
    "cpu": { "usagePct": 34.2, "cores": 16 },
    "load": { "m1": 4.1, "m5": 3.8, "m15": 3.2 },
    "memory": { "totalBytes": 67645734912, "availBytes": 22548299776, "usedPct": 66.7, "swapTotalBytes": 0, "swapUsedBytes": 0 },
    "filesystems": [
      { "mountpoint": "/", "device": "/dev/sda1", "fstype": "ext4", "totalBytes": 500107862016, "usedBytes": 470101569536, "usedPct": 94.0 }
    ],
    "diskIOPS": 142.3,
    "interfaces": [
      { "name": "eth0", "status": "UP", "operstate": "up", "mac": "aa:bb:cc:dd:ee:ff", "rxBps": 8388608, "txBps": 4194304, "rxErrors": 0, "txErrors": 0 }
    ],
    "sysInfo": { "hostname": "lemonn-mum-le", "os": "Linux", "kernel": "5.15.0-91-generic", "arch": "x86_64", "uptimeSeconds": 2592000 }
  },
  "firingAlerts": [],
  "relatedAlerts": [],
  "pastIncidents": [],
  "responders": { "assignee": {}, "team": {} },
  "linkedChanges": [],
  "linkedProblems": [],
  "configItem": {},
  "generatedAt": "2026-03-03T10:00:00.000Z"
}
```

**Alert Label Resolution (4-Tier Fallback Chain):**

The endpoint uses a four-step fallback to find the source alert:

1. `incident.relatedAlerts[0]` — directly associated Alert records
2. `prisma.alert.findFirst({ where: { alertId: incident.sourceAlertId } })` — lookup by alert ID
3. `prisma.alert.findFirst({ where: { name: incident.sourceAlertName, organizationId } })` — lookup by name and org
4. IP extraction from `sourceAlertName` field via regex: `/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/`

**OS Detection:**

The endpoint detects whether the target is a Linux or Windows host by examining the Prometheus instance port (`:9182` = Windows `windows_exporter`, `:9100` = Linux `node_exporter`) and the job name. Linux queries use `node_*` metrics; Windows queries use `windows_*` metrics.

**Past Incidents Query:**

The endpoint retrieves up to 5 resolved/closed incidents from the past 30 days that share either the same category, configuration item, or source alert name. This surfaces historical patterns directly in the incident UI.

---

### 5.8 AI Agent Pipeline Integration

The AI Agent Pipeline runs inside the main API process (zero additional pods) and is triggered asynchronously after every alert is created via the Alertmanager webhook.

**Source File:** `backend/src/services/agentPipeline.js`
**Trigger Point:** `backend/src/controllers/webhook.controller.js`, line 201

```javascript
// ── AI Agent Pipeline: async triage → remediate → notify → verify ──
agentPipeline.processAlert(alert, a.labels).catch(pipeErr => {
  logger.error('[AgentPipeline] Async processing failed for %s: %s', alert.name, pipeErr.message);
});
```

**Pipeline Stages:**

The `processAlert()` function executes six stages:

| Stage | Name | Description |
|---|---|---|
| 1 | Detect | Classify alert severity and log receipt |
| 2 | Triage | Match alert against `REMEDIATION_ACTIONS` registry |
| 3 | Enrich | Gather live Prometheus metrics and CMDB context |
| 4 | Act | Execute remediation via SSH if enabled and CRITICAL severity |
| 5 | Notify | Send Slack/PagerDuty notifications per `NOTIFICATION_RULES` |
| 6 | Verify | Run post-remediation Prometheus query to confirm improvement |

**Remediation Actions Registry (8 actions):**

| Action ID | Name | Category | Trigger Severities | Alert Patterns |
|---|---|---|---|---|
| `disk-cleanup` | Disk Space Cleanup | Storage | CRITICAL, WARNING | NodeDiskRunningFull, HostDiskAlmostFull, NodeFilesystemAlmostOutOfSpace |
| `pod-restart` | Restart CrashLooping Pod | Kubernetes | CRITICAL, WARNING | KubePodCrashLooping, KubePodNotReady |
| `service-restart` | Restart System Service | Infrastructure | CRITICAL | KubeNodeNotReady |
| `memory-release` | Release Memory Cache | Compute | CRITICAL, WARNING | HostHighMemoryUsage, NodeMemoryHighUtilization |
| `log-rotate` | Force Log Rotation | Storage | CRITICAL, WARNING | NodeDiskRunningFull, HostDiskAlmostFull |
| `container-prune` | Prune Container Images | Kubernetes | WARNING | NodeDiskRunningFull, KubeNodeDiskPressure |
| `deployment-scale` | Scale Deployment Replicas | Kubernetes | WARNING | KubeDeploymentReplicasMismatch |
| `ssl-check` | Certificate Expiry Check | Security | WARNING, CRITICAL | CertificateExpiringSoon, SSLCertificateExpiry |

**Auto-Remediation Gate:**

Automatic SSH execution requires all three conditions to be true:
1. Alert severity is CRITICAL
2. SSH access is available for the organization (Integration Hub `accessMethod: 'ssh'`)
3. The matched remediation action is enabled for that organization

**Notification Rules (4 rules):**

| Rule ID | Name | Trigger | Channel |
|---|---|---|---|
| `critical-slack` | Critical Alert → Slack | CRITICAL severity | Slack |
| `critical-pagerduty` | Critical Alert → PagerDuty | CRITICAL severity | PagerDuty |
| `warning-slack` | Warning Alert → Slack | WARNING severity | Slack |
| `incident-created-slack` | New Incident → Slack | incident:created event | Slack |

**Pipeline State Storage:**

Pipeline state (execution counts, enabled/disabled flags, execution log) is stored in in-memory Maps — not persisted to the database. This means pipeline stats reset on API pod restart. The execution log is a ring buffer capped at 100 entries per organization.

**API Endpoints:**

```
GET  /api/v1/agent/status                    — Pipeline status and stats
POST /api/v1/agent/toggle                    — Enable/disable pipeline globally
GET  /api/v1/agent/actions                   — List all remediation actions
POST /api/v1/agent/actions/:id/toggle        — Enable/disable specific action
GET  /api/v1/agent/notifications             — List notification rules
POST /api/v1/agent/notifications/:id/toggle — Enable/disable notification rule
GET  /api/v1/agent/executions               — Recent execution log
```

---

### 5.9 Incident PDF Report Generation

**Source File:** `backend/src/controllers/incident-report.controller.js` (approximately 1162 lines)
**Dependency:** PDFKit (`npm install pdfkit`)

**Endpoints:**

```
GET  /api/v1/incidents/:id/report                    — Single incident PDF or JSON
GET  /api/v1/incidents/:id/report?format=json        — Structured JSON data (no PDF)
GET  /api/v1/incidents/:id/report?sections=summary,sla — Selective sections
POST /api/v1/incidents/bulk-report                   — Batch up to 50 incidents
```

**Report ID Format:** `RPT-{incident.number}-{timestamp}` (for example, `RPT-INC0000127-3K9MZXY2`)

**PDF Layout — 14 Sections** (rendered by `IncidentReportBuilder.build()`):

| # | Section Method | Content |
|---|---|---|
| 1 | `buildCoverBanner()` | Priority color banner, incident number, short description, priority/state badges, organization name |
| 2 | `buildExecutiveSummary()` | Priority, state, impact, urgency, category, source, creation date, duration |
| 3 | `buildPeopleSection()` | Assignee name and email, assignment group, created by |
| 4 | `buildDescriptionSection()` | Full description with monospace formatting |
| 5 | `buildConfigItemSection()` | CI name, type, IP address, hostname (if linked) |
| 6 | `buildSLASection()` | SLA status badge (MET/BREACHED/AT RISK/ON TRACK), response/resolution targets, actual times, compliance indicator |
| 7 | `buildResolutionSection()` | Resolution code, resolution notes, resolved by, resolution timestamp |
| 8 | `buildActivityTimeline()` | Chronological activity log with action, description, user, and timestamp |
| 9 | `buildWorkNotesSection()` | All work notes with author, timestamp, and internal flag |
| 10 | `buildRelatedAlertsSection()` | Related Alert records with name, severity, status, and fired time |
| 11 | `buildLinkedItemsSection()` | Linked Change and Problem records with their states |
| 12 | `buildAttachmentsSection()` | Attachment file list with sizes and upload timestamps |
| 13 | `buildSourceAlertSection()` | Source alert ID and name, parsed labels and annotations |
| 14 | `buildSignatureBlock()` | Report ID, generation timestamp, classification |

**PDF Styling:**

The PDF uses a branded color palette:
- Primary/header color: Cyan-600 (`#0891B2`)
- Priority colors: P1=Red-600, P2=Amber-600, P3=Blue-600, P4=Emerald-600
- SLA met: Emerald (`#10B981`), SLA breached: Red-500 (`#EF4444`)
- Striped tables with Cyan-50 alternating rows

**SLA Status Logic in PDF** (source: `incident-report.controller.js`, lines 127–138):

```javascript
function getSLAStatus(incident) {
  if (incident.slaBreached) return { text: 'BREACHED', color: COLORS.danger };
  if (incident.state === 'CLOSED' || incident.state === 'RESOLVED') {
    return { text: 'MET', color: COLORS.success };
  }
  if (incident.slaTargetResolution) {
    const remaining = new Date(incident.slaTargetResolution) - new Date();
    if (remaining < 3600000) return { text: 'AT RISK', color: COLORS.warning };
  }
  return { text: 'ON TRACK', color: COLORS.success };
}
```

**Bulk Report:**

`POST /api/v1/incidents/bulk-report` accepts a JSON body `{ "incidentIds": ["uuid1", "uuid2", ...] }` with a maximum of 50 incident IDs. The response is a multi-incident summary report with a bulk report ID formatted as `BULK-RPT-{timestamp}`.

---

### 5.10 Frontend Incident Detail

**Source File:** `frontend-react/src/components/Incidents/IncidentDetail.tsx`

The Incident Detail view renders six tabs:

| Tab | Content |
|---|---|
| Overview | Priority, state, impact, urgency, SLA timeline, assignee, category, description |
| Timeline | Merged activity log and work notes in chronological order |
| Work Notes | Note input form + note history with internal/external flag |
| Live Metrics | Real-time data from `useIncidentLiveContext` (CPU, memory, disk, network, firing alerts, past incidents) |
| Related | Linked Changes, linked Problems, related Alerts |
| AI Agent | Pipeline status, recent executions, action controls |

**Real-time Updates:**

The Live Metrics tab refetches the live context endpoint every 30 seconds via TanStack Query's `refetchInterval`.

**Socket.IO Events Consumed:**

| Event | Action |
|---|---|
| `incident:created` | Shows toast notification |
| `incident:updated` | Refetches incident data |
| `incident:assigned` | Updates assignee display |
| `incident:detail-updated` | Refreshes all detail data |
| `incident:note-added` | Appends new work note |

---

## 6. Part 3: Completed Analysis and Reporting

### 6.1 Analytics Architecture

The reporting subsystem is built across two backend controllers and one large frontend component:

| Component | File | Lines | Purpose |
|---|---|---|---|
| Dashboard Controller | `backend/src/controllers/dashboard.controller.js` | 102 | Real-time KPIs, state charts, recent activity |
| Report Controller | `backend/src/controllers/report.controller.js` | 271 | Period-based trend analysis, team performance, executive summary |
| Analytics Dashboard | `frontend-react/src/components/Reports/ReportsDashboard.tsx` | ~1026 | PagerDuty-style 5-section analytics UI |

**Multi-Tenant Filtering:**

All reporting queries spread `req.tenantWhere` into Prisma ORM queries. Raw SQL queries use the `rawOrgFilter()` helper function which builds a conditional SQL fragment:

```javascript
function rawOrgFilter(tw, table = '') {
  const prefix = table ? `${table}.` : '';
  if (tw?.organizationId) {
    return Prisma.sql`AND ${Prisma.raw(`${prefix}"organizationId"`)} = ${tw.organizationId}`;
  }
  return Prisma.sql``;
}
```

**Caching Strategy:**

| Layer | Method | TTL |
|---|---|---|
| Backend | Redis `deletePattern('incidents:*')` on mutations | Invalidation on change |
| Frontend | TanStack Query `staleTime` | 30–60 seconds per hook |
| Dashboard | 30-second stale time | Suitable for NOC displays |
| Reports | 60-second stale time | Appropriate for analysis views |

---

### 6.2 Dashboard KPIs

**Endpoint:** `GET /api/v1/dashboard/stats`
**Source File:** `backend/src/controllers/dashboard.controller.js`, lines 9–60

All counts are tenant-scoped and computed in a single `prisma.$transaction()` for efficiency.

**KPI Metrics:**

| Metric | Query Definition |
|---|---|
| `openIncidents` | Incidents in NEW, IN_PROGRESS, ON_HOLD, or ESCALATED states |
| `p1Active` | P1 incidents in NEW, IN_PROGRESS, or ESCALATED states |
| `p2Active` | P2 incidents in NEW, IN_PROGRESS, or ESCALATED states |
| `slaBreached` | Incidents with `slaBreached = true` not in CLOSED or CANCELLED |
| `firingAlerts` | Alerts with `status = 'FIRING'` |
| `activeChanges` | Changes in IMPLEMENTING or SCHEDULED states |
| `slaCompliance` | 7-day compliance percentage (see formula below) |
| `totalIncidents` | All-time incident count for tenant |
| `resolvedLast7d` | Incidents resolved in last 7 days |

**SLA Compliance Calculation:**

```javascript
const slaCompliance = totalOpenAndRecent > 0
  ? Math.round(((totalOpenAndRecent - breachedRecent) / totalOpenAndRecent) * 100)
  : 100;
```

**Distribution Charts:**

- `incidentsByState` — group-by state with counts
- `incidentsByPriority` — group-by priority with counts
- `incidentsByCategory` — top 10 categories by incident count

**Recent Items:**

- `recentIncidents` — 10 most recent from the last 7 days
- `recentAlerts` — 10 currently firing alerts

---

### 6.3 Incident Trend Analysis

**Endpoint:** `GET /api/v1/reports/incident-trend?period=7d|30d|90d`
**Source File:** `backend/src/controllers/report.controller.js`, lines 205–268

This endpoint provides four datasets for trend visualization:

1. **Daily Counts** — incident and resolved counts per calendar day, formatted as "Mon DD"
2. **MTTR by Day** — average time to resolve (in minutes) per resolution date
3. **SLA Compliance by Priority** — compliance percentage for P1–P4 over the period, with a target line of 95%
4. **Changes by Type** — breakdown by NORMAL, STANDARD, and EMERGENCY with predefined colors

**MTTR Calculation (raw SQL):**

```sql
SELECT
  TO_CHAR(DATE("resolvedAt"), 'Mon DD') as day,
  AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))/60)::int as mttr
FROM "Incident"
WHERE "resolvedAt" IS NOT NULL AND "resolvedAt" >= $since
GROUP BY DATE("resolvedAt")
ORDER BY DATE("resolvedAt") ASC
```

**SLA Compliance by Priority (raw SQL):**

```sql
SELECT
  priority,
  ROUND(
    COUNT(CASE WHEN "slaBreached" = false THEN 1 END)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )::float as compliance
FROM "Incident"
WHERE "createdAt" >= $since
GROUP BY priority
ORDER BY priority ASC
```

**Period Parameter:** Accepts `7d`, `30d`, or `90d`. Parsed by `parseInt(period)` — the numeric prefix is extracted. Default is 30 days.

---

### 6.4 SLA Compliance Reports

**Endpoint:** `GET /api/v1/dashboard/sla-compliance`
**Source File:** `backend/src/controllers/dashboard.controller.js`, lines 84–98

The endpoint computes SLA compliance for each priority class across all resolved and closed incidents in the tenant:

```javascript
for (const p of priorities) {
  const total = await prisma.incident.count({
    where: { ...tw, priority: p, state: { in: ['RESOLVED', 'CLOSED'] } }
  });
  const breached = await prisma.incident.count({
    where: { ...tw, priority: p, slaBreached: true, state: { in: ['RESOLVED', 'CLOSED'] } }
  });
  compliance[p] = {
    total,
    breached,
    met: total - breached,
    percentage: total > 0 ? Math.round(((total - breached) / total) * 100) : 100
  };
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "P1": { "total": 42, "breached": 3, "met": 39, "percentage": 93 },
    "P2": { "total": 187, "breached": 12, "met": 175, "percentage": 94 },
    "P3": { "total": 453, "breached": 18, "met": 435, "percentage": 96 },
    "P4": { "total": 122, "breached": 2, "met": 120, "percentage": 98 }
  }
}
```

**Frontend Compliance Thresholds:**

| Compliance | Color | Classification |
|---|---|---|
| >= 95% | Green (`#059669`) | Healthy |
| >= 85% | Amber (`#D97706`) | At Risk |
| < 85% | Red (`#DC2626`) | Breached |

The frontend renders this data as four priority rings with the compliance percentage inside each ring, plus a compliance table showing targets versus actuals.

---

### 6.5 Team Performance

**Endpoint:** `GET /api/v1/reports/team-performance`
**Source File:** `backend/src/controllers/report.controller.js`, lines 107–131
**Auth:** ADMIN or MANAGER role required

This endpoint uses a single raw SQL join to aggregate per-team incident metrics:

```sql
SELECT
  t.name as team_name,
  COUNT(DISTINCT i.id)::int as incident_count,
  COUNT(DISTINCT CASE WHEN i.state IN ('RESOLVED', 'CLOSED') THEN i.id END)::int as resolved_count,
  AVG(CASE WHEN i."resolvedAt" IS NOT NULL
    THEN EXTRACT(EPOCH FROM (i."resolvedAt" - i."createdAt"))/60 END)::int as avg_mttr_minutes,
  ROUND(
    COUNT(DISTINCT CASE WHEN i."slaBreached" = false THEN i.id END)::numeric
    / NULLIF(COUNT(DISTINCT i.id), 0) * 100, 1
  ) as sla_compliance
FROM "Team" t
LEFT JOIN "Incident" i ON i."assignmentGroupId" = t.id AND i."createdAt" >= $since
WHERE 1=1 $orgFilter
GROUP BY t.id, t.name
ORDER BY incident_count DESC
```

**Metrics per Team:**

| Metric | Description |
|---|---|
| `incident_count` | Total incidents assigned to team in period |
| `resolved_count` | Incidents in RESOLVED or CLOSED state |
| `avg_mttr_minutes` | Average resolution time in minutes |
| `sla_compliance` | Percentage of incidents meeting SLA |
| Resolution Rate | `resolved_count / incident_count × 100` (computed frontend) |

**Frontend Badge Thresholds:**

| SLA Compliance | Badge Color |
|---|---|
| >= 90% | Emerald |
| >= 70% | Amber |
| < 70% | Red |

---

### 6.6 Change Analytics

**Endpoint:** `GET /api/v1/reports/changes`
**Source File:** `backend/src/controllers/report.controller.js`, lines 78–103

Returns a breakdown of changes over the requested period:

- `byType` — counts by ChangeType: NORMAL, STANDARD, EMERGENCY
- `byState` — counts by ChangeState across the 8-state lifecycle
- `byRisk` — counts by RiskLevel: HIGH, MEDIUM, LOW
- `successRate` — raw SQL computing successful close rate

**Success Rate Calculation:**

```sql
SELECT
  COUNT(*)::int as total_completed,
  COUNT(CASE WHEN "closureCode" = 'SUCCESSFUL' THEN 1 END)::int as successful,
  ROUND(
    COUNT(CASE WHEN "closureCode" = 'SUCCESSFUL' THEN 1 END)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  ) as success_rate
FROM "Change"
WHERE state = 'CLOSED' AND "createdAt" >= $since
```

**Note:** Only CLOSED changes with `closureCode = 'SUCCESSFUL'` count toward success. FAILED and PARTIAL closure codes reduce the success rate.

**Frontend Color Coding:**

| Risk Level | Color |
|---|---|
| HIGH | Red (`#DC2626`) |
| MEDIUM | Amber (`#D97706`) |
| LOW | Green (`#059669`) |

---

### 6.7 Executive Summary

**Endpoint:** `GET /api/v1/reports/executive-summary`
**Source File:** `backend/src/controllers/report.controller.js`, lines 134–201

The executive summary aggregates the most critical operational metrics across a 30-day rolling window. This endpoint is designed for CTO and IT Director review.

**Metrics Returned:**

| Field | Calculation Window | Description |
|---|---|---|
| `totalIncidents` | Last 30 days | All incidents created |
| `currentlyOpen` | Current | Incidents in active states |
| `p1Last7Days` | Last 7 days | P1 incidents (critical for weekly review) |
| `slaBreached30d` | Last 30 days | Incidents that breached SLA |
| `totalChanges` | Last 30 days | All changes submitted |
| `openProblems` | Current | Problems in active states |
| `firingAlerts` | Current | Actively firing Prometheus/Grafana alerts |
| `avgMttr` | Last 30 days | Average resolution time, formatted as "Xh Ym" |
| `slaCompliancePct` | Last 30 days | Overall SLA compliance across all priorities |
| `changeSuccessPct` | Last 30 days | Percentage of closed changes marked SUCCESSFUL |

**MTTR Formatting:**

```javascript
const avgMttrFormatted = avgMttrMinutes != null
  ? `${Math.floor(avgMttrMinutes / 60)}h ${avgMttrMinutes % 60}m`
  : null;
```

---

### 6.8 Frontend Analytics Dashboard

**Source File:** `frontend-react/src/components/Reports/ReportsDashboard.tsx` (~1026 lines)

The analytics dashboard follows the Argus dark UI design system: dark obsidian hero header (`bg-[#0F172A]`), gradient accent line, period selector, and a left sidebar navigation for 5 sections.

**Period Selector:** Buttons for 7d, 30d, and 90d. The selected period is passed as a query parameter to all report endpoints.

**Priority Color Palette (consistent across all charts):**

| Priority | Hex Color |
|---|---|
| P1 | `#DC2626` (Red) |
| P2 | `#D97706` (Amber) |
| P3 | `#4F46E5` (Indigo) |
| P4 | `#059669` (Emerald) |

**5 Dashboard Sections:**

**Section 1 — Overview**
- 10 KPI cards: total incidents, open incidents, P1 count, P2 count, SLA breached, avg MTTR, total changes, open problems, firing alerts, SLA compliance
- 5 charts: incident volume over time (area), MTTR trend (line), priority distribution (bar), source distribution (donut), change type distribution (donut)

**Section 2 — Incidents**
- 4 KPIs: total, P1 count, avg MTTR, SLA compliance
- 4 charts: incidents created over time, state distribution, MTTR by priority, top categories by incident count

**Section 3 — SLA**
- Large SLA score card (52px font)
- Four priority rings (P1–P4) with compliance percentage inside each
- Compliance by priority bar chart with 95% target line
- Compliance breakdown table with total, met, breached, and compliance % per priority

**Section 4 — Teams** (ADMIN/MANAGER only)
- 4 KPIs: total teams, avg MTTR across teams, best SLA team, resolution rate
- Performance table with per-team metrics and SLA badges
- MTTR comparison bar chart

**Section 5 — Changes**
- 4 KPIs: total changes, success rate, emergency count, pending count
- Success rate hero card with large percentage display
- Change type pie chart
- Change state bar chart
- Risk level bar chart

**PDF Export:**

The analytics dashboard uses `window.print()` to trigger the browser's print dialog. The print stylesheet converts the dark UI to a light print-friendly layout. Users save as PDF via the browser's built-in PDF printer.

---

### 6.9 Frontend Hooks

| Hook | Endpoint | Stale Time | Notes |
|---|---|---|---|
| `useDashboard()` | `GET /api/v1/dashboard/stats` | 30 seconds | Used on main dashboard |
| `useDashboardTrends(days)` | `GET /api/v1/dashboard/incident-trend?days=N` | 60 seconds | Line chart data |
| `useSLACompliance()` | `GET /api/v1/dashboard/sla-compliance` | 60 seconds | Priority ring charts |

All hooks are defined in `frontend-react/src/hooks/useDashboard.ts` and follow the TanStack Query pattern. The `days` parameter to `useDashboardTrends` accepts 7, 30, or 90.

---

## 7. Part 4: Integration Between Systems

### 7.1 Alert to Incident to Problem to RCA Flow

The complete ITIL-aligned flow from alert ingestion to closed-loop root cause analysis spans five system components and follows this sequence:

**Step 1 — Alert Ingestion**

Prometheus Alertmanager fires a webhook to `POST /api/v1/webhooks/alertmanager`. The webhook controller resolves the organization, creates an Alert record, and determines whether the severity warrants incident creation.

**Step 2 — KB Classification**

`buildIncidentFromAlert()` calls `getAlertKB(alert.name)` to classify the alert and build a structured incident description including root cause, investigation steps, recommended actions, and blast radius from the KEDB.

**Step 3 — Incident Auto-Creation**

For CRITICAL and WARNING severity alerts, an Incident is created with:
- Auto-generated number (INC0000001 format)
- Priority calculated from mapped impact and urgency
- SLA targets computed from priority
- Assignment group resolved via 3-tier CMDB → category → on-call lookup
- Source set to `'PROMETHEUS'` or `'GRAFANA'`
- `sourceAlertId` and `sourceAlertName` populated for live context lookups

**Step 4 — AI Agent Pipeline**

Concurrently with incident creation, `agentPipeline.processAlert()` runs asynchronously:
- Stage 2 (Triage) matches the alert to a remediation action
- Stage 3 (Enrich) fetches live Prometheus metrics via SSH
- Stage 4 (Act) executes remediation commands for CRITICAL alerts with SSH access
- Stage 5 (Notify) sends Slack and/or PagerDuty notifications
- Stage 6 (Verify) re-queries Prometheus to confirm improvement

**Step 5 — Incident Response**

Engineers use the Incident Detail view to review live context, update state, add work notes, and link related changes or problems. The live context endpoint provides real-time Prometheus metrics, firing alerts, and similar past incidents in a single API call.

**Step 6 — Problem Creation**

When multiple incidents share the same root cause or alert pattern, engineers create a Problem record (`POST /api/v1/problems`) and link the related incidents (`POST /api/v1/incidents/:id/problems`).

**Step 7 — RCA Execution**

With linked incidents in place, engineers trigger AI RCA (`POST /api/v1/problems/:id/ai-rca`). The engine:
1. Matches alert names against the 17-entry KEDB
2. Sends enriched context to Ollama Qwen3-32B
3. Returns structured RCA with confidence score
4. Saves to `problem.rootCauseAnalysis` JSON field
5. Logs `AI_RCA` activity

**Step 8 — State Progression**

Engineers accept the RCA and advance the Problem state:
- `INVESTIGATION → RCA_IN_PROGRESS` (AI analysis running or complete)
- `RCA_IN_PROGRESS → KNOWN_ERROR` (RCA accepted, added to KEDB)
- `KNOWN_ERROR → RESOLVED` (permanent fix implemented)
- `RESOLVED → CLOSED` (closed after monitoring period)

When `state = 'KNOWN_ERROR'`, `isKnownError = true` is set automatically, promoting the Problem to the KEDB.

**Step 9 — Reporting and Compliance**

With incidents resolved and problems closed, all data feeds into:
- Dashboard KPIs (open counts, SLA compliance, firing alerts)
- Incident trend analysis (MTTR, volume, priority distribution)
- SLA compliance reports (P1–P4 compliance percentages)
- Team performance (MTTR per team, resolution rate)
- Executive summary (30-day aggregate for leadership review)

---

### 7.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ALERT INGESTION                             │
│                                                                     │
│  Prometheus ──► Alertmanager ──► POST /webhooks/alertmanager        │
│  Grafana    ──────────────────► POST /webhooks/grafana?orgId=       │
│  Manual     ──────────────────► POST /incidents (source: MANUAL)    │
│  Voice IVR  ──────────────────► POST /incidents (source: VOICE)     │
│  Slack      ──────────────────► POST /webhooks/slack/commands       │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       ALERT PROCESSING                              │
│                                                                     │
│  webhook.controller.js                                              │
│  ├── Org Resolution (slug → label → IP lookup)                      │
│  ├── KEDB Classification: getAlertKB(name) ──────────► 17 KB entries│
│  ├── Severity Gate: CRITICAL/WARNING → Incident                     │
│  │                  INFO → Alert only                               │
│  └── Team Resolution (CMDB → Category → On-Call)                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
               ┌─────────────┴───────────────┐
               ▼                             ▼ (async)
┌──────────────────────┐         ┌──────────────────────────────────┐
│   INCIDENT CREATED   │         │      AI AGENT PIPELINE           │
│                      │         │                                  │
│  INC0000001          │         │  Stage 1: Detect                 │
│  Priority: P1–P4     │         │  Stage 2: Triage (match action)  │
│  SLA Targets set     │         │  Stage 3: Enrich (Prometheus)    │
│  State: NEW          │         │  Stage 4: Act (SSH remediation)  │
│  Socket.IO events    │         │  Stage 5: Notify (Slack/PD)      │
│                      │         │  Stage 6: Verify (re-query)      │
└──────────┬───────────┘         └──────────────────────────────────┘
           │
           │  (multiple related incidents)
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PROBLEM MANAGEMENT                               │
│                                                                     │
│  PRB0000001 created → link incidents                                │
│  State: NEW → INVESTIGATION → RCA_IN_PROGRESS                       │
│                                                                     │
│  POST /problems/:id/ai-rca                                          │
│  ├── getAlertKB() matches KEDB entries                              │
│  ├── Qwen3-32B prompt (temperature: 0.3)                            │
│  ├── Returns: category, rootCause, evidence[], confidence           │
│  ├── Enriched with KB investigate/remediate commands                │
│  └── Saved to rootCauseAnalysis (JSON field)                        │
│                                                                     │
│  State: RCA_IN_PROGRESS → KNOWN_ERROR (isKnownError = true)        │
│         KNOWN_ERROR → RESOLVED → CLOSED                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   REPORTING AND ANALYSIS                            │
│                                                                     │
│  GET /dashboard/stats          ─── Open KPIs, SLA compliance       │
│  GET /dashboard/sla-compliance ─── P1-P4 compliance percentages    │
│  GET /reports/incidents        ─── Period-based trend + MTTR        │
│  GET /reports/incident-trend   ─── Daily counts, MTTR by day        │
│  GET /reports/team-performance ─── Per-team metrics (ADMIN only)   │
│  GET /reports/changes          ─── Change success rate, by type    │
│  GET /reports/executive-summary─── 30-day aggregate (CTO view)     │
│  GET /incidents/:id/report     ─── Professional PDF (14 sections)  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7.3 API Quick Reference Table

All endpoints require `Authorization: Bearer <token>` unless marked otherwise. Roles listed are the minimum required.

| Method | Endpoint | Min Role | Description |
|---|---|---|---|
| **Problems / RCA** | | | |
| GET | `/api/v1/problems` | VIEWER | List problems with filtering |
| GET | `/api/v1/problems/stats` | VIEWER | State counts and KEDB top-10 |
| GET | `/api/v1/problems/:id` | VIEWER | Problem detail with linked incidents |
| POST | `/api/v1/problems` | ENGINEER | Create new problem |
| PATCH | `/api/v1/problems/:id` | ENGINEER | Update problem fields and state |
| PATCH | `/api/v1/problems/:id/rca` | ENGINEER | Save manual RCA data |
| POST | `/api/v1/problems/:id/notes` | ENGINEER | Add work note |
| POST | `/api/v1/problems/:id/ai-rca` | ENGINEER | Trigger AI root cause analysis |
| **Alerts / KEDB** | | | |
| GET | `/api/v1/alerts` | VIEWER | List alerts with filtering |
| GET | `/api/v1/alerts/kb` | VIEWER | Full Alert Knowledge Base (17 entries) |
| GET | `/api/v1/alerts/stats` | VIEWER | Alert statistics |
| GET | `/api/v1/alerts/:id` | VIEWER | Alert detail |
| POST | `/api/v1/alerts/:id/acknowledge` | OPERATOR | Acknowledge alert |
| POST | `/api/v1/alerts/:id/silence` | OPERATOR | Silence alert |
| POST | `/api/v1/alerts/:id/create-incident` | ENGINEER | Manually create incident from alert |
| **Incidents** | | | |
| GET | `/api/v1/incidents` | VIEWER | List incidents with filtering and pagination |
| GET | `/api/v1/incidents/:id` | VIEWER | Incident detail with all relations |
| POST | `/api/v1/incidents` | ENGINEER | Create incident manually |
| PATCH | `/api/v1/incidents/:id` | ENGINEER | Update state, assignment, resolution |
| DELETE | `/api/v1/incidents/:id` | ADMIN | Delete incident |
| GET | `/api/v1/incidents/:id/live-context` | VIEWER | Live Prometheus metrics + alert context |
| GET | `/api/v1/incidents/:id/timeline` | VIEWER | Activity log merged with work notes |
| POST | `/api/v1/incidents/:id/notes` | ENGINEER | Add work note |
| POST | `/api/v1/incidents/:id/changes` | ENGINEER | Link to a change record |
| POST | `/api/v1/incidents/:id/problems` | ENGINEER | Link to a problem record |
| GET | `/api/v1/incidents/:id/report` | VIEWER | Generate PDF or JSON incident report |
| POST | `/api/v1/incidents/bulk-report` | VIEWER | Bulk report for up to 50 incidents |
| **Webhooks (no auth)** | | | |
| POST | `/api/v1/webhooks/alertmanager` | None | Prometheus Alertmanager webhook |
| POST | `/api/v1/webhooks/grafana` | None | Grafana alert webhook |
| **Dashboard** | | | |
| GET | `/api/v1/dashboard/stats` | VIEWER | Real-time KPIs and charts |
| GET | `/api/v1/dashboard/incident-trend` | VIEWER | Daily incident trend by priority |
| GET | `/api/v1/dashboard/sla-compliance` | VIEWER | SLA compliance per priority class |
| **Reports** | | | |
| GET | `/api/v1/reports/incidents` | VIEWER | Incident analytics for period |
| GET | `/api/v1/reports/incident-trend` | VIEWER | MTTR trend, daily counts, SLA by priority |
| GET | `/api/v1/reports/changes` | VIEWER | Change analytics for period |
| GET | `/api/v1/reports/team-performance` | MANAGER | Team performance metrics (ADMIN/MANAGER) |
| GET | `/api/v1/reports/executive-summary` | VIEWER | 30-day executive summary |
| **AI Agent Pipeline** | | | |
| GET | `/api/v1/agent/status` | VIEWER | Pipeline status and execution stats |
| POST | `/api/v1/agent/toggle` | ADMIN | Enable/disable pipeline globally |
| GET | `/api/v1/agent/actions` | VIEWER | List remediation actions |
| POST | `/api/v1/agent/actions/:id/toggle` | ADMIN | Enable/disable specific action |
| GET | `/api/v1/agent/notifications` | VIEWER | List notification rules |
| POST | `/api/v1/agent/notifications/:id/toggle` | ADMIN | Enable/disable notification rule |
| GET | `/api/v1/agent/executions` | VIEWER | Recent execution log |

---

## 8. Appendix A — Alert KB Reference

The following table lists all 17 entries in the Alert Knowledge Base. The full entry is available via `GET /api/v1/alerts/kb`. Source: `backend/src/controllers/alert.controller.js`, lines 133–238.

| KB Key | Category | First Root Cause | First Investigation Command | First Remediation Step | Blast Radius |
|---|---|---|---|---|---|
| `disk` | Storage | Filesystem usage exceeded threshold | `df -hT` — identify full mount point | Rotate logs: `logrotate -f /etc/logrotate.conf` | High — full disk causes crashes, DB corruption, pod evictions |
| `cpu` | Compute | CPU utilization exceeded threshold | `top -bn1 -o %CPU \| head -20` | Identify and restart runaway processes | Medium-High — causes latency, timeouts, SLA breaches |
| `memory` | Compute | Memory utilization crossed threshold | `free -h` — check available column | Restart offending process | High — OOM kills terminate services unpredictably |
| `icmp` | Network | Host not responding to ICMP probes | Ping from different network segments | Remote power-on via IPMI/iLO/iDRAC | Critical — all services on host affected |
| `switch` | Network | Switch ports reporting abnormal states | `show interface status` (Cisco) | Err-disabled: `shutdown` then `no shutdown` | Medium — depends on affected port type |
| `fortigate` | Security | FortiGate reporting config or firmware change | `get system status` | Unauthorized change: investigate, roll back firmware | High — firewall affects all traffic through device |
| `login` | Security | SSH session count exceeded threshold | `who` or `w` to view active sessions | Block offending IPs via firewall/fail2ban | Medium-Critical — depends on access level achieved |
| `hostdown` | Infrastructure | Host completely unreachable — all probes failing | `ipmitool -I lanplus chassis status` | Remote power on via IPMI | Critical — all services on host affected |
| `kubePodCrash` | Kubernetes | Pod repeatedly crashing (CrashLoopBackOff) | `kubectl logs <pod> -n <ns> --previous` | Fix application error from logs | Medium — affects single service, may cascade |
| `kubePodOOM` | Kubernetes | Container exceeded memory limit — OOM killed | `kubectl get events -n <ns> --field-selector reason=OOMKilling` | Increase memory limits in deployment spec | Medium — service restart causes brief outage |
| `kubePodNotReady` | Kubernetes | Pod readiness probe failing — removed from endpoints | `kubectl describe pod <pod> -n <ns>` | Fix underlying dependency issue | Medium — reduced capacity, service degradation |
| `kubeNodeNotReady` | Kubernetes | Node kubelet lost contact with API server | `kubectl describe node <node>` — check Conditions | Restart kubelet: `systemctl restart kubelet` | Critical — entire node workload affected |
| `kubeDeploymentMismatch` | Kubernetes | Deployment has fewer ready replicas than desired | `kubectl describe deployment <name> -n <ns>` | Fix image pull errors (tag, registry auth) | Medium-High — reduced service capacity |
| `kubeHPA` | Kubernetes | HPA at maximum replicas — cannot scale further | `kubectl describe hpa <name> -n <ns>` | Increase HPA maxReplicas | Medium — service at capacity ceiling |
| `appError` | Application | Application returning HTTP 5xx errors | Check application logs for stack traces | Roll back if error coincides with deployment | High — user-facing errors, SLA impact |
| `dbConnection` | Database | Database connection failures detected | `pg_isready` or `mysqladmin ping` | Kill idle connections: `SELECT pg_terminate_backend(pid)...` | Critical — all application services using this DB |
| `certificate` | Security | TLS/SSL certificate approaching expiry or expired | `openssl s_client -connect <host>:443 \| openssl x509 -noout -dates` | Force renewal: `kubectl delete secret <tls-secret> -n <ns>` | High — HTTPS service outage when expired |

---

## 9. Appendix B — Incident State Machine Diagram

The following ASCII diagram shows all valid incident state transitions as defined in `INCIDENT_TRANSITIONS` (`backend/src/config/constants.js`, lines 30–38):

```
                    ┌─────────┐
         ┌──────────►  NEW    │
         │          └────┬────┘
         │               │
         │    ┌──────────┼──────────────┐
         │    ▼          ▼              ▼
         │ ┌──────────┐ ┌───────┐  ┌───────────┐
         │ │IN_PROGRESS│ │ON_HOLD│  │ CANCELLED │ (terminal)
         │ └──┬────────┘ └──┬───┘  └───────────┘
         │    │    ▲         │
         │    │    └─────────┘ (ON_HOLD → IN_PROGRESS only)
         │    │
         │    ├─────────────────────┐
         │    ▼                     ▼
         │ ┌──────────┐       ┌──────────┐
         │ │ ESCALATED│       │ RESOLVED │
         │ └──┬───────┘       └──┬───┬──┘
         │    │    ▲              │   │
         │    └────┘              │   └──────┐
         │ (→IN_PROGRESS)         │          ▼
         │                        │      ┌───────────┐
         └────────────────────────┘      │  CLOSED   │ (terminal)
           (ESCALATED → RESOLVED)        └───────────┘

Legend:
  ► Arrow direction = valid transition
  (terminal) = no further transitions allowed
  RESOLVED → IN_PROGRESS = re-open for additional investigation
```

**State Descriptions:**

| State | Description |
|---|---|
| NEW | Incident just created; not yet accepted |
| IN_PROGRESS | Actively being worked on by assigned engineer |
| ON_HOLD | Paused, waiting for external input (SLA clock pauses) |
| ESCALATED | Elevated to senior team or management |
| RESOLVED | Fix applied; monitoring period active |
| CLOSED | Confirmed resolved; no further action needed (terminal) |
| CANCELLED | Incident voided — duplicate, false positive, or withdrawn (terminal) |

---

## 10. Appendix C — Problem State Machine Diagram

The following ASCII diagram shows all valid problem state transitions as defined in `PROBLEM_TRANSITIONS` (`backend/src/config/constants.js`, lines 51–58):

```
         ┌──────────┐
         │   NEW    │
         └────┬─────┘
              │
              ▼
         ┌─────────────┐
         │ INVESTIGATION│
         └──────┬───┬──┘
                │   │
          ┌─────┘   └───────────────┐
          ▼                         ▼
   ┌──────────────┐          ┌─────────────┐
   │RCA_IN_PROGRESS│          │ KNOWN_ERROR │◄──┐
   └──────┬────┬──┘          └──────┬──────┘   │
          │    │                    │           │
          │    └────────────────────┘           │
          │      (→ KNOWN_ERROR)                │
          │                                     │
          └──────────────────────────┐          │
            (→ RESOLVED)            ▼          │
                               ┌──────────┐   │
                               │ RESOLVED │───┘
                               └────┬─────┘  (KNOWN_ERROR → RESOLVED)
                                    │
                                    ▼
                               ┌──────────┐
                               │  CLOSED  │ (terminal)
                               └──────────┘

Legend:
  ► Arrow = valid transition
  isKnownError flag set to true automatically on → KNOWN_ERROR
  (terminal) = no further transitions allowed
```

**State Descriptions:**

| State | Description |
|---|---|
| NEW | Problem record created; not yet investigated |
| INVESTIGATION | Root cause investigation in progress |
| RCA_IN_PROGRESS | AI or manual RCA analysis underway |
| KNOWN_ERROR | Root cause confirmed; workaround documented in KEDB; `isKnownError = true` |
| RESOLVED | Permanent fix implemented; monitoring for recurrence |
| CLOSED | Problem confirmed closed; KEDB entry archived (terminal) |

---

## 11. Appendix D — Resolution Codes Reference

The `resolutionCode` field is set when an incident transitions to RESOLVED state. It provides standardized classification for post-incident analysis and reporting.

| Code | Label | Description | When to Use |
|---|---|---|---|
| `FIXED` | Permanently Fixed | Root cause identified and permanently corrected | Issue fully resolved with no recurrence expected; fix tested and validated |
| `WORKAROUND` | Workaround Applied | Temporary fix applied; service restored; permanent fix is pending | Service is restored but underlying issue remains; a Problem record should be created |
| `KNOWN_ERROR` | Known Error Applied | Existing KEDB workaround was applied | Incident matches a previously documented known error; reference the PRB number in resolution notes |
| `DUPLICATE` | Duplicate Incident | This incident is a duplicate of another active incident | Parent incident is the primary; note parent INC number in resolution notes before closing |
| `NOT_REPRODUCIBLE` | Not Reproducible | Investigation complete; issue could not be confirmed or reproduced | No evidence of actual disruption found after thorough investigation |
| `USER_ERROR` | User Error | Issue was caused by incorrect user action, training gap, or process non-compliance | User action caused the incident; include communication and training recommendations |
| `CONFIGURATION` | Configuration Change | Issue resolved by correcting a misconfiguration or applying correct settings | Config drift, wrong parameter, or environment mismatch was the cause |
| `NO_ACTION_REQUIRED` | No Action Required | Investigation confirmed no actual incident occurred | Alert noise, planned maintenance window, or test that generated a false alert |

---

## 12. Appendix E — PDF Report Sections Reference

The `IncidentReportBuilder` class in `backend/src/controllers/incident-report.controller.js` generates a professional A4 PDF using PDFKit. Sections are rendered in this order:

| # | Section Method | Content | Data Sources |
|---|---|---|---|
| 1 | `buildCoverBanner()` | Full-width priority-colored banner with incident number, short description, priority/state badges, organization name | `incident.number`, `incident.priority`, `incident.state`, `incident.organization.name` |
| 2 | `buildExecutiveSummary()` | Summary table: priority, state, impact, urgency, category, source, created date, current duration | All core `Incident` fields |
| 3 | `buildPeopleSection()` | Assignee full name and email, assignment group name, created-by user name | `incident.assignedTo`, `incident.assignmentGroup`, `incident.createdBy` |
| 4 | `buildDescriptionSection()` | Full incident description in monospace block | `incident.description` |
| 5 | `buildConfigItemSection()` | CI name, CI type, IP address, hostname | `incident.configItem` |
| 6 | `buildSLASection()` | SLA status badge (MET/BREACHED/AT RISK/ON TRACK), response target, resolution target, actual response time, actual resolution time | `slaTargetResponse`, `slaTargetResolution`, `responseTime`, `resolvedAt`, `slaBreached` |
| 7 | `buildResolutionSection()` | Resolution code, resolution notes, resolved-by user, resolved timestamp | `resolutionCode`, `resolutionNotes`, `resolvedAt` |
| 8 | `buildActivityTimeline()` | Chronological list of all activity records: action type, description, user, timestamp | `incident.activities[]` |
| 9 | `buildWorkNotesSection()` | All work notes with author, timestamp, internal/external flag, content | `incident.workNotes[]` |
| 10 | `buildRelatedAlertsSection()` | Table of related alerts: name, severity, status, fired time | `incident.relatedAlerts[]` |
| 11 | `buildLinkedItemsSection()` | Linked Change records with number and state; linked Problem records with number and state | `incident.linkedChanges[]`, `incident.linkedProblems[]` |
| 12 | `buildAttachmentsSection()` | File list with names, sizes, and upload timestamps | `incident.attachments[]` |
| 13 | `buildSourceAlertSection()` | Source alert ID and name, full labels JSON, full annotations JSON | `incident.sourceAlertId`, `incident.sourceAlertName`, `firstAlert.labels`, `firstAlert.annotations` |
| 14 | `buildSignatureBlock()` | Report ID (`RPT-INC0000001-XXXXX`), generation timestamp, classification label | Computed at render time |

**A4 Page Specifications:**

| Property | Value |
|---|---|
| Page width | 595.28 points |
| Page height | 841.89 points |
| Left/right margin | 50 points |
| Content width | 495.28 points |
| Header top bar | 8-point Cyan-600 accent bar |
| Page header font | Helvetica-Bold 16pt (branding), Helvetica 9pt (title) |
| Body font | Helvetica 9pt |
| Table stripe | Cyan-50 (`#F0FDFA`) alternating rows |
| Table border | Gray-300 (`#D1D5DB`) |

---

*End of Document*

---

**Document Control:**

| Field | Value |
|---|---|
| Document ID | ARG-TEC-006 |
| Version | 1.0 |
| Next Review | 2026-06-03 |
| Classification | INTERNAL |
| Owner | Platform Engineering — Santhira (Terv Pro Technology Pvt Ltd) |

**Source Files Referenced:**

- `backend/src/controllers/problem.controller.js`
- `backend/src/controllers/alert.controller.js`
- `backend/src/controllers/incident.controller.js`
- `backend/src/controllers/webhook.controller.js`
- `backend/src/controllers/dashboard.controller.js`
- `backend/src/controllers/report.controller.js`
- `backend/src/controllers/incident-report.controller.js`
- `backend/src/controllers/aiAgent.controller.js`
- `backend/src/services/agentPipeline.js`
- `backend/src/config/constants.js`
- `backend/src/utils/helpers.js`
- `backend/prisma/schema.prisma`
- `frontend-react/src/components/Problems/ProblemDetail.tsx`
- `frontend-react/src/components/Incidents/IncidentDetail.tsx`
- `frontend-react/src/components/Reports/ReportsDashboard.tsx`
