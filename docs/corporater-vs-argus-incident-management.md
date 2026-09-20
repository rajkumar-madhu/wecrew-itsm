# Corporater vs Argus Incident Management

Competitive analysis of [Corporater Incident Management Software](https://corporater.com/solution/incident-management-software/) against the Argus / WeCrew ITSM frontend in this repo. **No product code changes** — analysis only.

---

## 1. Corporater positioning (GRC vs ITSM)

Corporater sells **GRC-oriented** incident and non-conformity management as an extension of Enterprise Risk Management — not an IT service desk.

| Dimension | Corporater | Argus / WeCrew |
| --- | --- | --- |
| Domain | Risk, compliance, non-conformities, near-misses | IT operations incidents (alerts, SLA, on-call) |
| Core loop | Detect → investigate → root cause → CAPA → controls → compliance report | Alert/manual → prioritize → escalate → resolve/close |
| Success metric | Prevent recurrence; demonstrate regulatory compliance | Restore service; meet response/resolution SLAs |
| Typical buyer | Risk / compliance / audit | SRE / NOC / ITSM operators |
| Frameworks named | COSO, ICS, ISO 31000, ISO 27001, Basel, Solvency, SOX | ITIL-style ops (impact×urgency → P1–P4); no GRC framework binding in UI |

### Corporater feature list (from the product page)

- Enterprise overview of incidents and near-loss events
- Incident dashboards, registers, form/report templates
- Automated workflows, alerts, notifications, threshold escalation
- Risk assessment and risk–incident interconnection
- Root cause analysis; corrective and preventive action (CAPA); control measures
- Incident categorization; impact assessment; KPIs / KRIs / metrics
- Configurable forms, branding, roles, SSO, data integration
- Compliance reporting (Word / Excel / PPT / PDF) with heat maps and charts
- AI (UnifAI / Tiva): pattern detection, link risks/controls, conversational assistant — governance-first, human-in-the-loop
- Deployment: SaaS, on-premise, or private cloud

### Corporater core loop

```
Risk register → Incident / non-conformity → Root cause → CAPA + controls → Compliance report
```

### Argus / WeCrew core loop

```
Alert or manual → Ops incident (P1–P4) → SLA + escalation → Resolve / close
```

These products overlap on the word “incident” and on dashboards / workflows / alerts. They do **not** compete on the same primary job-to-be-done.

---

## 2. Capability gap map (tied to Argus files)

| Corporater capability | Argus / WeCrew today | Gap | Evidence |
| --- | --- | --- | --- |
| Enterprise incident overview / dashboards | List, command dashboard, NOC | **Partial** — strong ops views; no GRC rollups by business unit / risk domain | [`IncidentList.tsx`](../src/components/Incidents/IncidentList.tsx), [`DashboardOverview.tsx`](../src/components/Dashboard/DashboardOverview.tsx), [`NOCView.tsx`](../src/components/NOC/NOCView.tsx) |
| Categorization, forms, templates | Fixed create form; optional `category` / `subcategory` on type | **Large** — no configurable form builder or report templates | [`IncidentCreate.tsx`](../src/components/Incidents/IncidentCreate.tsx), [`Incident`](../src/types/index.ts) |
| Root cause analysis | Timeline, work notes, AI resolution tab; Problems domain has `RCA_IN_PROGRESS` | **Large** on incidents — no structured RCA object on the incident record; Problem RCA is a separate ITIL track | [`IncidentDetail.tsx`](../src/components/Incidents/IncidentDetail.tsx), `ProblemState` in [`types/index.ts`](../src/types/index.ts) |
| CAPA (corrective / preventive actions) | Resolve notes + work notes | **Missing** as first-class entities | `resolutionNotes` / `useAddWorkNote` in [`useIncidents.ts`](../src/hooks/useIncidents.ts) |
| Risk assessment / risk–incident link | None in frontend | **Missing** | No risk register routes or hooks |
| Near-miss / non-conformity types | Ops `IncidentSource` only | **Missing** | `IncidentSource = MANUAL \| PROMETHEUS \| …` in [`types/index.ts`](../src/types/index.ts) |
| Workflow automation / thresholds | Escalation policies, realtime invalidation, state → `ESCALATED` | **Partial** — ops escalation exists; CAPA / approval workflows do not | [`EscalationPolicyBuilder.tsx`](../src/components/Escalation/EscalationPolicyBuilder.tsx), `useEscalationLogs`, [`useRealtime.ts`](../src/hooks/useRealtime.ts) |
| Compliance reports (Word/Excel/PPT/PDF) | Per-incident and bulk PDF/JSON reports | **Partial** — ops incident reports, not regulator packs | [`IncidentReportGenerator.tsx`](../src/components/Incidents/IncidentReportGenerator.tsx) |
| Access control / roles / SSO | `ADMIN \| MANAGER \| ENGINEER \| OPERATOR \| VIEWER`; org tenancy; `ProtectedRoute` | **Partial** — RBAC present; SSO is backend / IdP dependent | [`useAuth.ts`](../src/hooks/useAuth.ts), [`App.tsx`](../src/App.tsx) |
| AI incident intelligence | AI resolution details on incident (`/ai/incidents/:id/resolution-details`) | **Partial** — ops assist vs Corporater GRC UnifAI posture | [`IncidentDetail.tsx`](../src/components/Incidents/IncidentDetail.tsx); marketing claims in [`site.ts`](../src/components/Public/site.ts) |
| Customizable branding | Sovereign `cx-*` brand system (paper / ink / coral) | **Different surface** — product brand, not per-tenant white-label | [`index.css`](../src/index.css), [`PageChrome.tsx`](../src/components/ui/PageChrome.tsx) |

### Argus incident surface (what is real)

| Surface | Path / hook | Role |
| --- | --- | --- |
| List / board / timeline | `/incidents` → `IncidentList` | Queue, filters, inspector |
| Create | `/incidents/create` → `IncidentCreate` | Impact×urgency → priority matrix |
| Detail | `/incidents/:id` → `IncidentDetail` | State machine, SLA rings, notes, related, AI, escalation logs |
| API wrappers | [`useIncidents.ts`](../src/hooks/useIncidents.ts) | `GET/POST/PATCH /incidents`, notes, timeline, live-context, escalation-logs |
| Alert → incident | `useCreateIncidentFromAlert` (alerts hook) | `POST /alerts/:id/create-incident` |
| Public status | `/status/:orgSlug` | `activeIncidents` for anonymous viewers |
| Marketing | [`site.ts`](../src/components/Public/site.ts) | ITSM narrative (correlation, SLA, on-call, AI) — **not** GRC/CAPA |

States: `NEW | IN_PROGRESS | ON_HOLD | ESCALATED | RESOLVED | CLOSED | CANCELLED`.  
Priority: `P1–P4` (there is no separate incident “severity”; severity belongs to alerts).

---

## 3. Argus ops stubs (parity within ITSM — independent of GRC)

These were the ops-depth gaps called out in the original gap analysis. **Status after the ITSM parity pass (2026-09-18):**

| Stub / inconsistency | Where | Status |
| --- | --- | --- |
| Bulk assign / escalate / export empty | [`IncidentList.tsx`](../src/components/Incidents/IncidentList.tsx) | **Fixed** — assign modal, escalate via `state: ESCALATED`, export via `downloadBulkReport` |
| No delete / link-problem hooks | [`useIncidents.ts`](../src/hooks/useIncidents.ts) | **Fixed** — `useDeleteIncident`, `useLinkProblem`; wired in detail UI |
| SLA clocks ignored incident deadlines | [`IncidentDetail.tsx`](../src/components/Incidents/IncidentDetail.tsx) | **Fixed** — clocks derive minutes from `slaTargetResponse` / `slaTargetResolution` when set; fallback defaults match backend `SLA_DEFAULTS` |
| NOC `state=OPEN` | [`NOCView.tsx`](../src/components/NOC/NOCView.tsx) | **Fixed** — expands to `NEW \| IN_PROGRESS \| ON_HOLD \| ESCALATED` parallel queries |
| `CANCELLED` weak in list board | List columns | Still open (lifecycle UX) |
| Style drift create/detail | Legacy `stone-*` | Still open (visual debt) |
| Marketing vs SPA depth | [`site.ts`](../src/components/Public/site.ts) | Still open (copy vs feature depth) |

---

## 4. Recommendation

**Do not clone Corporater.** Keep Argus / WeCrew focused on **ITSM operational incident management** and differentiate on strengths Corporater does not emphasize:

1. **Alert → incident correlation** and monitoring-source provenance (`PROMETHEUS`, `GRAFANA`, live-context).
2. **On-call + escalation + SLA clocks** as the primary remediation path.
3. **NOC / realtime** (`incident:created` / `incident:updated` → query invalidation).
4. **Public status page** for customer-facing outage communication.
5. **AI as evidence on the record** (human accepts/rejects), not as a GRC UnifAI suite.

### If product work follows later (out of scope for this doc)

| Choice | When it makes sense | First moves |
| --- | --- | --- |
| **Deepen ITSM parity** (default) | Competing with ServiceNow / PagerDuty-adjacent tools | Wire bulk actions; policy-driven SLA clocks; delete / link-problem hooks; fix NOC `OPEN` filter |
| **Add a thin GRC/CAPA slice** | Enterprise RFP that requires non-conformity / CAPA language | Explicit near-miss type + CAPA tasks linked to Problems RCA — still not a full risk platform |
| **Sharpen marketing only** | Positioning confusion with GRC vendors | Keep [`site.ts`](../src/components/Public/site.ts) on ops language; explicitly contrast “IT service incidents” vs “GRC non-conformities” |

Default path: **deepen ITSM parity** and **clarify positioning**. Cloning Corporater’s risk-register → CAPA → compliance stack would be a different product and a different backend domain.

---

## Sources

- Corporater product page: https://corporater.com/solution/incident-management-software/
- Argus frontend: `src/components/Incidents/*`, `src/hooks/useIncidents.ts`, `src/types/index.ts`, `src/components/Public/site.ts`
