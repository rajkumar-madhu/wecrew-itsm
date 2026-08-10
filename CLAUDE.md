# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Argus** (formerly LinkedEye) is an enterprise ITSM (IT Service Management) platform built by Santhira (Terv Pro Technology Pvt Ltd). It manages Incidents, Changes, Problems, Assets/CMDB, Alerts, Teams, On-Call, and integrates with Prometheus, Grafana, Loki, Slack, PagerDuty, and ServiceNow. The platform is multi-tenant with 13+ client organizations.

## Tech Stack

- **Backend:** Node.js 20+ / Express.js / Prisma ORM / PostgreSQL 16
- **Frontend:** React 19 / TypeScript 5.9 / Vite 7 / TailwindCSS 3.4 / Zustand 5 / TanStack Query 5 / React Router v6
- **Auth:** JWT with RBAC (roles: ADMIN, MANAGER, ENGINEER, OPERATOR, VIEWER)
- **Real-time:** Socket.IO
- **Cache:** Redis 7 (sessions + caching)
- **AI:** Ollama (Qwen3-32B) + Flowise + OpenAI/Anthropic SDKs
- **Voice:** Whisper STT + XTTS v2 TTS (FastAPI Python server on port 8100)
- **Deployment:** Kubernetes (namespace: `linkedeye-core` on the wecrew kind cluster) + nerdctl container builds

## Common Commands

### Backend Development
```bash
cd backend
npm install
npx prisma generate          # Generate Prisma client
npx prisma migrate dev       # Run migrations (local dev DB)
npx prisma db seed           # Seed test data (password: LinkedEye@2026)
npm run dev                  # Start with nodemon on port 5000
```

### Frontend Development
```bash
cd frontend-react
npm install
npm run dev                  # Vite dev server on port 3000 (proxies /api → :5000)
npm run build                # tsc -b && vite build → outputs to dist/
```

### K8s Build & Deploy

Live on the `wecrew` kind cluster: namespace **`linkedeye-core`**, host `https://itsm.wecrew.in`
(API also at `https://itsm.api.wecrew.in`). Images live in Harbor project `linkedeye`
(private — pulled with the `harbor-linkedeye-pull` Secret, a pull-only Harbor robot).

```bash
TAG=$(date +%Y%m%d)-$(git rev-parse --short HEAD)

# Build inside the kind node's containerd, then push to Harbor
sudo nerdctl --namespace k8s.io build -t harbor.wecrew.in/linkedeye/argus-itsm-frontend:$TAG ./frontend-react
sudo nerdctl --namespace k8s.io build -t harbor.wecrew.in/linkedeye/argus-itsm-api:$TAG ./backend
sudo nerdctl --namespace k8s.io push harbor.wecrew.in/linkedeye/argus-itsm-{frontend,api}:$TAG

kubectl -n linkedeye-core set image deployment/linkedeye-frontend \
  frontend=harbor.wecrew.in/linkedeye/argus-itsm-frontend:$TAG
kubectl -n linkedeye-core set image deployment/linkedeye-api \
  api=harbor.wecrew.in/linkedeye/argus-itsm-api:$TAG
```

The node runs at ~99% CPU requests, so both Deployments use `maxSurge: 0` — a rollout
replaces the pod in place (a few seconds of downtime) rather than scheduling a surge pod.

Full apply (`kubectl apply -k k8s/overlays/kind`) requires `k8s/overlays/kind/secrets.yml`
to exist first — it is gitignored; copy `secrets.example.yml` and fill in real values.

### Database
```bash
# Local dev: localhost:5432
# K8s production: postgres.linkedeye-core:5432 (ClusterIP 10.97.121.123)
# These are SEPARATE databases — always update K8s postgres for production changes

npx prisma migrate deploy     # Production migration (non-interactive, safe for K8s)
# npm run prisma:migrate:prod  # Alias for the above
```

### Linting
```bash
cd backend && npm run lint       # eslint src/
cd frontend-react && npm run lint  # eslint .
```

### Tests
```bash
cd backend && npm test           # jest --coverage — 39 tests across 3 suites:
                                 #   services/__tests__/k8sService.test.js      (kubectl failure handling)
                                 #   controllers/__tests__/public.controller.test.js (lead validation)
                                 #   routes/__tests__/public.routes.test.js     (public route + rate limit)
                                 # No ESLint config exists, so `npm run lint` fails.
cd backend && npm run test:watch # jest --watch
```

### Useful Backend Scripts
```bash
cd backend
npx prisma studio               # Visual DB browser on port 5555
npm run sla:check                # Manual SLA compliance check
npm run db:health                # Database health check
```

## Code Architecture

### Backend (`backend/src/`)

**Middleware chain** (in order in `server.js`): helmet → cors → compression → express.json (10mb) → cookieParser → morgan → rateLimiter → static files → route handlers → 404 handler → errorHandler

**Route structure** — all under `/api/v1/`:
```
/auth, /incidents, /changes, /problems, /alerts, /assets, /teams,
/notifications, /integrations, /dashboard, /search, /webhooks,
/reports, /sms, /voice, /ai, /organizations, /k8s, /agent, /pagerduty, /apm
```

**Key layers:**
- `controllers/` (23 files) — Request handling, Prisma queries, response formatting
- `services/` (16 files) — Business logic: AI, Prometheus, Grafana, K8s (SSH-proxied), SLA checker, email queue, Slack, PagerDuty, agent pipeline
- `middleware/` (8 files):
  - `auth.js` — JWT authentication + RBAC authorization + **inline tenant context** (sets `req.tenantWhere` and `req.organizationId`)
  - `tenant.js` — Standalone tenant middleware (only used in `k8s.routes.js`; most routes use inline tenant from `auth.js`)
  - `rateLimiter.js` — Global + per-route rate limiting
  - `errorHandler.js` — Centralized error response formatting
  - `validator.js` — express-validator helpers
  - `upload.js` — Multer file upload config
  - `audit.js` — Audit logging middleware
  - `twilioAuth.js` — Twilio webhook signature validation
- `config/database.js` — Prisma client singleton
- `utils/helpers.js` — Pagination helper, standard response format: `{ success, data, pagination, error }`

**Note:** `aiAgent.routes.js` and `ai.routes.js` both mount on `/api/v1/ai` — they share the prefix but handle different endpoints. Health check lives at `GET /health` (no auth required).

**Background jobs** started at boot: SLA compliance checker (60s interval), Email queue processor (5min interval).

### Frontend (`frontend-react/src/`)

**Routing** (`App.tsx`): 30+ routes, all lazy-loaded with `React.lazy` + `Suspense`. RBAC-gated: `/users` (ADMIN/MANAGER), `/integrations` (ADMIN).

**State management:**
- `stores/authStore.ts` — Zustand with localStorage persistence (key: `linkedeye-auth`): user, tokens, selectedOrgId
- `stores/uiStore.ts` — Sidebar state, search, notifications queue

**API layer** (`lib/api.ts`): Axios instance with Bearer token interceptor, `X-Organization-Id` header for multi-tenant routing, 401 auto-refresh flow.

**Hooks** (18 files): All use TanStack Query for data fetching. Each ITIL module has a dedicated hook file (e.g., `useIncidents.ts`, `useProblems.ts`).

**Dev server** (`vite.config.ts`): Port 3000, path alias `@` → `./src`, proxies `/api` and `/socket.io` to `http://localhost:5000`.

### AgentForge (`agentforge/`)

Separate AI Agent Hub sub-project. FastAPI (Python) backend + React/Vite frontend. Has its own `docker-compose.yml`. Not part of the main Argus build pipeline.

## Multi-Tenant Architecture

Every data model has `organizationId`. Tenant isolation is enforced via:

1. **`middleware/auth.js`** sets `req.tenantWhere` on every authenticated request (inline, not via separate middleware)
2. **Two ADMIN subtypes** (distinguished by whether user has `organizationId`):
   - **Super-admin** (ADMIN + `organizationId: null`): sees ALL orgs by default; `X-Organization-Id` or `?orgId=` scopes to one
   - **Org-admin** (ADMIN + has `organizationId`): defaults to own org; header/query can override
3. **Non-ADMIN users** are locked to their `user.organizationId`
4. **All controllers** spread `...req.tenantWhere` into Prisma `where` clauses
5. **Frontend `OrgSwitcher`** (admin-only, in Sidebar) sets `selectedOrgId` in Zustand → sent as `X-Organization-Id` header

**Example pattern in controllers:**
```js
const items = await prisma.incident.findMany({
  where: { ...req.tenantWhere, state: 'OPEN' },
});
```

## Critical: Tailwind Color Override Gotcha

`frontend-react/tailwind.config.js` overrides standard Tailwind palettes with a **flat semantic color system** — no shade variants exist:

| Token | Hex | Use |
|-------|-----|-----|
| `void` | `#F5F5F4` | Page background |
| `obsidian` | `#FFFFFF` | Card surfaces |
| `slate` | `#FFFFFF` | **Overridden to white!** |
| `gunmetal` | `#FAFAF9` | Subtle backgrounds |
| `steel` | `#E7E5E4` | Borders, dividers |
| `graphite` | `#D6D3D1` | Muted text, icons |
| `signal` | `#4F46E5` | Primary action (indigo) |
| `crimson` | `#DC2626` | Error/danger |
| `emerald` | `#059669` | Success (DEFAULT only) |
| `amber` | `#D97706` | Warning (DEFAULT only) |
| `violet` | `#7C3AED` | Accent (DEFAULT only) |

Dim variants exist for light badges: `signal-dim`, `emerald-dim`, `amber-dim`, `crimson-dim`, `violet-dim`.

**All dark-themed UI (hero sections, etc.) must use arbitrary hex values**, not Tailwind shade classes:
```jsx
// WRONG — slate-900 renders white due to config override, emerald-600 doesn't exist
<div className="bg-slate-900 text-slate-300">
<span className="text-emerald-600">

// CORRECT — use hex values directly
<div className="bg-[#0F172A] text-[#94A3B8]">
<span className="text-[#059669]">
```

Custom fonts: `font-display` (Outfit), `font-body` (DM Sans), `font-mono` (JetBrains Mono).

## UI Design System

All pages follow a consistent premium dark pattern:
- Dark obsidian hero header (`bg-[#0F172A]`) with module-specific accent color
- Gradient accent line below hero
- Glassmorphic stat cards: `bg-white/[0.06] backdrop-blur-sm`
- Dot-grid texture and ambient glow blurs in heroes
- Module accent colors: Dashboard=indigo, Incidents=amber, Changes=indigo+violet, Problems=violet, Alerts=red, Assets=emerald, Teams=violet

## AI Agent Pipeline (`backend/src/services/agentPipeline.js`)

Automated incident response: Detect → Triage → Enrich → Act (SSH) → Notify (Slack/PagerDuty) → Verify

- 8 remediation actions (disk-cleanup, pod-restart, service-restart, memory-release, etc.)
- 17 ALERT_KB entries for pattern matching
- Integrated into `webhook.controller.js`: `processAlert()` called async after alert creation
- Only CRITICAL/WARNING severity alerts auto-create incidents (INFO → alert only)

## SSH-Based Remote Infrastructure Access

K8s and Prometheus data for remote client orgs is accessed via SSH tunneling:
- `k8sService.js` — `sshCmd()` executes kubectl/curl via SSH to remote servers
- `aiAgent.controller.js` — `resolvePrometheusAccess()` determines ssh/direct/local access method per org
- SSH key mounted as K8s secret: `linkedeye-ssh-key` → `/home/finadmin/.ssh/` in the API pod
- Each org's Integration record stores: `accessMethod`, `serverIp`, `sshPort`, `sshUser`

## Database Schema Highlights

28 enums, 20+ models. Key relationships:
- `Organization` → all tenant-scoped models
- `Incident` has: source enum (MANUAL/PROMETHEUS/GRAFANA/API/EMAIL/VOICE/SLACK), auto-calculated priority from Impact × Urgency
- `Problem` has: `rootCauseAnalysis` (JSON), KEDB integration
- `ConfigurationItem` (CMDB): type enum (SERVER, K8s_CLUSTER, DATABASE, APPLICATION, etc.)
- `Integration`: type enum includes PROMETHEUS, GRAFANA, KUBERNETES_CLUSTER, PAGERDUTY, STACKSTORM, APPRISE; config stored as JSON string
- `EscalationPolicy` + `EscalationRule` — multi-level escalation with delay
- ITIL numbering: INC0000001, CHG0000001, PRB0000001
- SLA by priority: P1 (5min/1hr), P2 (15min/4hr), P3 (1hr/24hr), P4 (4hr/72hr)

## Coding Conventions

### Backend
- CommonJS modules (`require`/`module.exports`)
- Express middleware pattern with `authenticate` + `authorize('ADMIN', 'MANAGER')` guards
- Prisma ORM for all DB operations — never raw SQL
- Winston logger (`utils/logger.js`)
- Input validation with `express-validator`
- Standard response: `res.json({ success: true, data, pagination })`

### Frontend
- TypeScript strict mode, functional components + hooks only
- Zustand for client state, TanStack Query for server state
- `react-hook-form` + `zod` for form validation
- Recharts for all charts/graphs
- `lucide-react` for icons
- All API calls go through `lib/api.ts` Axios instance (never raw fetch)

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `backend/src/server.js` | Express app setup, middleware chain, route mounting |
| `backend/src/middleware/auth.js` | JWT auth + RBAC + tenant context injection |
| `backend/prisma/schema.prisma` | Complete database schema (28 enums, 20+ models) |
| `backend/src/utils/helpers.js` | Pagination, response formatting |
| `backend/src/services/agentPipeline.js` | AI agent auto-remediation pipeline |
| `backend/src/services/k8sService.js` | SSH-proxied K8s/Prometheus access |
| `frontend-react/src/lib/api.ts` | Axios instance with auth + org headers |
| `frontend-react/src/stores/authStore.ts` | Auth state + org selection (Zustand) |
| `frontend-react/src/App.tsx` | Route definitions (30+ lazy-loaded routes) |
| `frontend-react/tailwind.config.js` | **Color overrides — read before styling** |
| `frontend-react/vite.config.ts` | Dev proxy, path aliases |

## Domain & Infrastructure

- Production URL: https://fs-le-dev-inc.finspot.in
- K8s namespace: `linkedeye-core`
- 13 client orgs with SSH connectivity (see memory for full server mapping)
- Lemonn Mumbai: 154.210.170.126:4422 (primary test org)
