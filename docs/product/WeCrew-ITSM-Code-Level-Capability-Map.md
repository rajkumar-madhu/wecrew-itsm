# WeCrew ITSM — Code-Level Capability Map (Frontend + Backend)

**Date:** 20 September 2026  
**Repos:** `argus-itsm-frontend` · `argus-itsm/backend`  
**Pairs with:** `WeCrew-ITSM-Product-Gap-and-Market-Comparison.md`

This is a **code reality check** against the product gap analysis: what is actually implemented, what is partial, and what is missing at the file level.

---

## Snapshot

| Layer | Strong today | Biggest holes |
|-------|----------------|---------------|
| Backend | Auth, tenancy, RBAC, incidents, changes, problems, assets, alerts/webhooks, on-call, billing, AI/agent pipeline, audit | Service catalog/requests, OpenAPI, real knowledge product, configurable SLA engine, Teams, sandbox |
| Frontend | Command centre, ITIL cores, CMDB UI, on-call, billing, public site, alerts/NOC/k8s | Catalog/requests UI, status admin, discovery UI, workflow builder, deep KB authoring |

**Verdict:** Phase 1 “sellable service desk” is **~70% present in code** for incident/request-shaped work **except service catalog/requests**. Core ITIL + ops integrations exist; competitive P1 modules (builder, discovery, status admin, marketplace) are largely absent.

---

## Backend inventory

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Auth (login, refresh, signup, password reset) | Built | `routes/auth.routes.js`, `auth.controller.js`, `passwordReset.service.js` | JWT + refresh; signup gated |
| MFA / SSO | Partial | `User.mfa*` / `ssoProvider` in Prisma; `speakeasy` dep | No enable/verify routes |
| Tenancy + platform admin | Built | `middleware/auth.js`, `tenant.js`, `organization.routes.js` | `X-Organization-Id`; platform-admin org CRUD |
| RBAC | Built | `Role` enum, `PERMISSIONS`, `checkPermission` | 5 roles × resource matrix |
| Incidents | Built | `incident.routes.js`, `incident.controller.js`, transitions | Timeline, links, email ack |
| SLA engine | Partial | `slaService.js`, `SLADefinition` model, incident SLA fields | Cron exists; `SLADefinition` largely unused; pause/resume not fully wired |
| Service catalog / requests | **Missing** | — | No models/routes |
| Problems | Built | `problem.routes.js`, `problem.controller.js` | RCA, known-error |
| Changes + CAB approvals | Built | `change.routes.js`, `Approval` model | Change-scoped only |
| Knowledge | Partial | Hardcoded `ALERT_KB` in `alert.controller.js` | No article CRUD |
| CMDB / assets | Built | `asset.routes.js`, `ConfigurationItem` | CRUD + stats |
| Discovery | Partial | K8s `sync-assets`, `cmdbResolver.js` | K8s/Prometheus only |
| Alerts + webhooks | Built | `alert.routes.js`, `webhook.routes.js`, `alertWebhookAuth.js` | Token-required by default (post review fix) |
| Correlation | Partial | Dedup + AI narrative | No rules/graph engine |
| On-call / escalation | Built | team on-call routes, `escalationService.js` | Schedules, policies, multi-channel |
| Status page API | Partial | `status.routes.js`, `status.controller.js` | Field/enum mismatches (`title` vs `shortDescription`; CI type names) |
| Billing / Razorpay | Built | `billing.*`, `razorpayWebhook.routes.js` | Subscribe/verify/cancel + locks |
| AI / Gemini / agents | Built | `ai.routes.js`, `aiAgent.*`, `agentPipeline.js`, `geminiService.js` | Chat, classify, remediation pipeline |
| Public leads | Partial | `POST /public/leads` | No admin list/update |
| Notifications | Built | email, SMS, Slack, voice services | **Teams missing** |
| Audit | Built | `middleware/audit.js`, `audit.routes.js` | |
| OpenAPI | **Missing** | — | No swagger mount |
| Workflow builder | Partial | Agent pipeline + N8N/StackStorm types | Not a user-editable builder |
| Sandbox / promotion | **Missing** | `Environment` on org only | |

### Backend P0 code actions

1. **Catalog + requests** — Prisma models + `routes/request.routes.js` + controller (mirror incidents).  
2. **Wire `SLADefinition`** — use in `calculateSLATargetTimes` / `slaService.js`; pause/resume on hold.  
3. **KnowledgeArticle** model + CRUD; keep alert KB as seed.  
4. **Fix `status.controller.js`** field/enum bugs.  
5. **OpenAPI 3.x** mount + admin leads API.

---

## Frontend inventory

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Auth UI | Built | Login/Signup/Forgot/Reset, `authStore`, `useAuth` | |
| Org switcher | Built | `OrgSwitcher.tsx` | `isPlatformAdmin` gated (post review fix) |
| RBAC UI | Partial | `ProtectedRoute`, Sidebar `roles`, `canManage` | No role-matrix admin screen |
| Dashboard | Built | `DashboardOverview` | |
| Incidents / Changes / Problems | Built | `Incidents/*`, `Changes/*`, `Problems/*` | Calendar + census for changes |
| Assets / CMDB | Built | `Assets/*` | |
| Service catalog / requests | **Missing** | Spec only under `docs/superpowers/specs/` | |
| On-call / escalation / maintenance | Built | `OnCall/*`, `Escalation/*`, `Maintenance/*` | |
| Alerts / NOC / K8s / APM / Logs | Built | Sidebar IT Ops | Some pages call `api` directly |
| Knowledge | Partial | `KnowledgeBasePage` | Thin authoring |
| SLA UI | Built | `SLAPolicyPage` | Inline API |
| Teams / Users / Settings / Billing | Built | Admin nav + `useBilling` | |
| AI insights / automation | Partial | `AIInsightsDashboard`, `AutomationDashboard` | Not full agent console |
| Public marketing | Built | `Public/*`, `site.ts` | |
| Public status page | Partial | `/status/:orgSlug` | No admin UI |
| GPRC | Partial | `Gprc/*` + `data/gprc.ts` | Static demo |
| Workflow builder | **Missing** | — | |
| Status admin / Discovery / Marketplace | **Missing** | — | |
| Mobile | Partial | Responsive shell | No native/PWA |

### Frontend P0 UI actions

1. `components/ServiceCatalog/` + `hooks/useServiceCatalog.ts` / `useRequests.ts` + App/Sidebar.  
2. `Status/StatusAdminPage.tsx` under Administration.  
3. `Assets/Discovery*.tsx` + `useDiscovery.ts`.  
4. Expand KB + `useKnowledge.ts`.  
5. (After catalog) `Workflows/` fulfilment builder — distinct from agent pipeline.

---

## Mapped to gap-doc phases

| Phase | Gap-doc intent | Code reality |
|-------|----------------|--------------|
| Phase 1 — Service desk MVP | Identity, tenancy, incident, request, SLA, portal, audit | **Mostly built** except **request/catalog**; SLA needs productization |
| Phase 2 — Core ITSM | Change, problem, knowledge, catalogue, approvals | Change/problem/approvals **built**; knowledge **thin**; catalogue **missing** |
| Phase 3 — Ops-aware | Asset, CMDB, discovery, monitoring | Asset/CMDB/alerts **built**; discovery **partial** |
| Phase 4 — Unified ops | MIM, on-call, status, automation, CI/CD evidence | On-call **built**; status **partial/buggy**; agent pipeline **partial**; MIM war-room **thin** |
| Phase 5 — AI platform | Copilot, routing, governed remediation | AI services **present**; evidence UX/governance **incomplete** |
| Phase 6 — Enterprise platform | ESM, marketplace, XLA, mobile | **Mostly missing** (GPRC is demo only) |

---

## Suggested build sequence (code, not slides)

1. Fix status API field bugs (hours).  
2. Service catalog + request backend + frontend MVP (largest Phase-1 hole).  
3. Wire tenant SLA definitions + pause/resume.  
4. Knowledge article CRUD + UI.  
5. OpenAPI export from existing routes.  
6. Then discovery + status admin + MIM/war-room.

---

## Document control

| Field | Value |
|-------|--------|
| Path | `docs/product/WeCrew-ITSM-Code-Level-Capability-Map.md` |
| Method | Static scan of routes/controllers/components/hooks/schema (Sep 2026) |
| Next | Pick one P0 item to implement in both repos |
