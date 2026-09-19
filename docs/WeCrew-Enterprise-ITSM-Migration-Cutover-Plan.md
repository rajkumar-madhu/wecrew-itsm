# WeCrew Enterprise ITSM Migration and Cutover Plan

**Phased Migration, Coexistence, Validation, and Rollback Playbook**

| Field | Value |
| --- | --- |
| **Product** | WeCrew ITSM, powered by AEGIS Incident Intelligence and JobWatch |
| **Company** | WeCrew Technologies |
| **Document type** | Enterprise implementation and cutover plan |
| **Version** | 1.0 |
| **Status** | Template / controlled delivery blueprint |
| **Date** | September 18, 2026 |

---

## 1. Purpose

This document defines how an enterprise customer can migrate from a legacy ITSM environment—such as ServiceNow, Jira Service Management, BMC Helix, Freshservice, ManageEngine, a custom service desk, or spreadsheet/email workflows—to WeCrew ITSM without disrupting support, incident response, change governance, or compliance evidence.

The plan is designed for a phased rollout. It avoids a high-risk big-bang replacement and begins with the operational workflows that create immediate value:

- AEGIS Incident Intelligence and incident response.
- WeCrew JobWatch scheduled-workload operations.
- Service/asset/ownership context and knowledge.
- Request catalog and fulfillment workflows.
- Problem, change, SLA, CMDB enrichment, and governed automation.

### Migration principle

Migrate service operations by workflow and service domain—not by database table or legacy-tool feature list.

The customer should be able to continue operating during every migration stage. Core incident handling and critical operational notifications must never depend on a migration job succeeding.

---

## 2. Migration Objectives

### Business objectives

- Preserve uninterrupted incident, request, major-incident, and change operations.
- Reduce operational complexity rather than reproducing unnecessary legacy customizations.
- Establish an accurate minimum service/ownership foundation.
- Deliver measurable value early through JobWatch, alert-to-incident enrichment, and evidence-first response workflows.
- Preserve legally, contractually, and operationally necessary records.
- Enable staged user adoption with training, workflow support, and clear ownership.
- Maintain a controlled rollback path until each migrated domain is accepted.

### Technical objectives

- Migrate or federate required data with traceability and reconciliation.
- Maintain source-to-target identity mapping and original identifiers.
- Support coexistence with legacy ITSM and monitoring systems during transition.
- Securely transfer data and protect restricted records, attachments, PII, credentials, and customer information.
- Validate data quality, record counts, relationship integrity, attachment accessibility, and workflow behavior.
- Avoid duplicate ticket creation, lost updates, or conflicting ownership during dual-running periods.

### Success criteria

| Outcome | Acceptance target |
| --- | --- |
| Critical incident continuity | No missed SEV-1/SEV-2 incident or failed escalation caused by migration |
| Data reconciliation | 100% of scoped critical records accounted for: migrated, federated, archived, excluded, or failed with approved disposition |
| Service ownership | 100% of pilot services/jobs have a named technical owner and escalation path |
| Operational readiness | Support teams successfully complete agreed day-in-the-life scenarios in WeCrew ITSM |
| Cutover stability | No unresolved Priority 1 cutover defects; agreed Priority 2 defects have owners/workarounds |
| Business acceptance | Customer process owners formally sign off each migration wave |
| Rollback readiness | Rollback tested before production cutover and executable within approved window |

---

## 3. Scope Model

### In-scope domains

| Domain | Typical migration treatment | Initial priority |
| --- | --- | --- |
| Users, teams, roles | Migrate/synchronize from identity source | High |
| Services and owners | Cleanse, import, and enrich | High |
| Incidents | Migrate active; archive/federate historical by policy | High |
| Major incidents | Migrate active and relevant postmortem history | High |
| Monitoring alerts | Do not bulk migrate; establish new connector flow | High |
| JobWatch jobs/executions | Register critical jobs; import selected history if valuable | High |
| Knowledge/runbooks | Curate and migrate approved articles first | High |
| Requests/catalog | Rebuild prioritized catalog items; do not copy every legacy form | Medium |
| SLAs, calendars, escalation | Reconfigure from validated policy; do not blindly copy legacy settings | Medium |
| Problems/known errors | Migrate open and recently active records | Medium |
| Changes | Migrate open/upcoming changes; archive closed history | Medium |
| Assets/CIs/relationships | Import minimum viable service graph; federate/phase broader CMDB | Medium |
| Attachments | Migrate only required active/audit records; validate malware/security policy | Medium |
| Audit history | Retain/export/archival according to regulatory and contractual requirement | High |
| Full legacy history | Archive/federate unless business case requires full migration | Low |

### Explicit non-goals for first cutover

- Rebuilding every legacy custom field, report, workflow, or approval chain.
- Migrating low-value closed tickets that are beyond retention or operational relevance.
- Achieving perfect CMDB accuracy before incident/JobWatch value is proven.
- Replacing all monitoring, CI/CD, or collaboration tools.
- Enabling high-risk production automation during the initial cutover.

---

## 4. Migration Governance

### Governance structure

| Role | Customer / WeCrew | Responsibility |
| --- | --- | --- |
| Executive sponsor | Customer | Funding, business decision escalation, acceptance authority |
| Program sponsor | Customer | Owns transformation outcome and cross-team alignment |
| Program manager | Customer or joint | Plan, dependencies, risks, cadence, cutover governance |
| ITSM process owner | Customer | Defines incident/request/problem/change policy and acceptance |
| Service desk manager | Customer | Agent readiness, queues, staffing, day-one support model |
| Platform/SRE lead | Customer | Monitoring, AEGIS/JobWatch integration, operational validation |
| Security/compliance lead | Customer | Data classification, retention, access, legal/audit approval |
| Data migration lead | Joint | Extraction, mapping, reconciliation, defect management |
| Integration lead | Joint | API/webhook/sync design, connector readiness, monitoring |
| WeCrew solution architect | WeCrew | Target design, platform configuration, technical risk management |
| WeCrew implementation lead | WeCrew | Configuration, migration runs, testing, training coordination |
| Cutover manager | Joint | Go/no-go decision process, runbook, command center |
| Hypercare lead | Joint | Post-cutover triage, defect prioritization, support communication |

### Cadence

- Daily technical migration stand-up during build, mock migration, and cutover weeks.
- Weekly steering committee for scope, risk, and decision escalation.
- Weekly data-quality/reconciliation review.
- Weekly integration readiness review.
- Formal readiness review before each mock cutover and production wave.
- Cutover command-center bridge during freeze, migration, validation, and stabilization.

### Decision log

Maintain a controlled decision log with:

```
Decision ID
Date
Decision owner
Decision statement
Options considered
Business/technical impact
Affected wave and systems
Approval evidence
Follow-up actions
```

---

## 5. Target-State Operating Model

### Service-management operating boundary

```
Monitoring / JobWatch / user portal / email / API
  -> AEGIS signal and ticket intake
  -> service, asset, owner, SLA, and knowledge enrichment
  -> ITSM workflow: incident/request/problem/change
  -> collaboration, approval, fulfilment, and communications
  -> verified recovery, postmortem, corrective action, reporting
```

### Minimum viable operating model

Before a service or workflow moves to WeCrew ITSM, it must have:

- Named technical owner and escalation group.
- Business owner or accountable stakeholder for critical services.
- Service criticality/tier and supported environment(s).
- Incident priority/severity mapping.
- Support hours, on-call/escalation policy, and notification contacts.
- At least one resolution runbook or clear investigation starting point for critical workflows.
- Defined SLA/calendar rule where SLA reporting is in scope.
- A data classification and access policy for the service/tickets.

### Operating responsibility model

| Activity | Customer | WeCrew |
| --- | --- | --- |
| Define business processes, SLAs, priorities, and approval policy | A/R | C |
| Configure standard platform capabilities | C | A/R |
| Provide/extract source data | A/R | C |
| Build migration mapping and validation tooling | C | A/R |
| Approve source-data quality and record disposition | A/R | C |
| Configure connectors and integration credentials | A/R | C |
| Execute migration runbook | C | A/R |
| Execute business/UAT acceptance | A/R | C |
| Hypercare support | A/R | A/R |
| Ongoing platform operation and enhancement | A/R | C or A/R per contract |

*A = Accountable, R = Responsible, C = Consulted.*

---

## 6. Migration Strategy

### Recommended strategy: progressive coexistence

Use a controlled strangler migration rather than a big bang.

```
Existing workflows and historical records
New operational signals
New workflows
Selected sync / deep links / migration
Resolved workflow domains
Retained historical archive / read-only access
Legacy ITSM
Coexistence Period
Monitoring / Schedulers / CI-CD
AEGIS + WeCrew ITSM
Selected requesters / pilot teams
Legacy module retirement
Archive or federation
```

### Coexistence principles

- Only one system is authoritative for each workflow domain at a time.
- Do not permit unmanaged bidirectional synchronization of all ticket fields.
- Sync only explicitly approved fields and states.
- Use source-system IDs and deep links in both systems.
- Establish duplicate detection and a human conflict-resolution policy.
- Route new operational signals deliberately; do not send the same alert to both systems unless the temporary duplicate policy is explicit.
- Keep the legacy system read-only for migrated domains after acceptance, except for approved synchronization exceptions.
- Archive rather than migrate historical data when operational/search need is low and legal retention is satisfied.

---

## 7. Coexistence Patterns

### Pattern A: Alert-to-incident migration first

**Use when:** Customer has a legacy service desk but needs faster operational response and scheduled-workload visibility.

```
Prometheus / JobWatch / Kubernetes / scheduler
  -> AEGIS creates enriched incident in WeCrew ITSM
  -> optional linked reference ticket in legacy ITSM
  -> teams resolve in WeCrew ITSM
  -> legacy retains reference/closure sync during transition
```

**Benefit:** Delivers AEGIS/JobWatch differentiation early without replacing the full service desk.

### Pattern B: Ticket synchronization during phased service migration

**Use when:** Teams/services migrate one business domain at a time.

```
Migrated service -> new incidents/requests originate in WeCrew ITSM
Non-migrated service -> work remains in legacy ITSM
Cross-domain work -> explicit linked tickets with defined master system
```

**Benefit:** Limits migration scope and reduces organizational disruption.

### Pattern C: Federated CMDB/service graph

**Use when:** Existing CMDB remains authoritative but operational context is required in WeCrew ITSM.

```
Legacy CMDB / cloud inventory / Kubernetes discovery
  -> scheduled import/API synchronization
  -> WeCrew service graph read model and relationship enrichment
  -> AEGIS incident impact and ownership resolution
```

**Benefit:** Avoids a risky CMDB replacement while improving operational context.

### Pattern D: Archive-first history

**Use when:** The source system contains many years of closed data.

```
Open/current records -> migrate
Recently closed operationally useful records -> selectively migrate
Long-tail historical records -> immutable archive + search/deep link
```

**Benefit:** Reduces migration risk, cost, and data-quality issues.

---

## 8. Phased Delivery Plan

### Phase 0 — Mobilize and discover (Weeks 0–2)

**Objectives**

- Establish governance, scope, delivery method, environments, and success criteria.
- Inventory source systems, integrations, data volumes, customizations, and retention obligations.
- Select pilot services/workflows and define a migration-wave plan.

**Activities**

- Kickoff and stakeholder map.
- Legacy ITSM assessment: modules, custom fields, workflows, queues, groups, SLA policies, reports, catalogs, APIs, attachments, and data quality.
- Integration assessment: monitoring, schedulers, identity, email, chat, CI/CD, cloud, CMDB, HR/ERP, and work-management systems.
- Security/privacy assessment: data classification, PII, restricted/security records, data residency, retention, export, and AI policy.
- Service portfolio prioritization.
- Baseline operational metrics.
- Pilot selection.

**Deliverables**

- Migration charter and RACI.
- Source-system inventory.
- Migration scope matrix.
- Initial target operating model.
- Pilot-service definition.
- Data classification/retention matrix.
- High-level timeline, risk register, and decision log.

**Exit criteria**

- Executive sponsor approves scope and pilot.
- Customer provides data/API access path.
- Customer names process owners and technical counterparts.
- Agreed success metrics and acceptance authority are documented.

### Phase 1 — Foundation and target design (Weeks 2–5)

**Objectives**

- Configure the baseline WeCrew ITSM environment.
- Define canonical data model, mapping rules, identity approach, workflow policies, and coexistence pattern.

**Activities**

- Create organization/workspace, identity integration, RBAC, teams, and notification baseline.
- Configure priority/severity model, service tiers, incident states, update template, closure codes, and audit settings.
- Define service/asset/job schema and relationship taxonomy.
- Configure initial SLA calendar/rules for pilot scope.
- Define archive, migration, federation, and exclusion decisions per data domain.
- Configure development/sandbox, staging/UAT, and production environments.
- Define API, webhook, connector, and synchronization designs.

**Deliverables**

- Target configuration workbook.
- Canonical data dictionary and mapping workbook.
- Source-to-target ID crosswalk design.
- Integration architecture and credential plan.
- Security model and test plan.
- Test strategy and acceptance criteria.

**Exit criteria**

- Process owners sign off target workflow design.
- Security approves connectivity/identity approach.
- Mapping and data-disposition rules are approved.

### Phase 2 — Data preparation and connector build (Weeks 4–8)

**Objectives**

- Extract, profile, cleanse, transform, and prepare scoped data.
- Build/validate selected integrations.

**Activities**

- Extract source records using API/export/database-supported method.
- Profile completeness, duplicates, orphaned records, bad references, invalid dates, stale users, and attachment risks.
- Cleanse mappings: users, teams, services, categories, priorities, statuses, SLA calendars, custom fields, and references.
- Resolve source data-quality exceptions with customer owners.
- Build Prometheus/Alertmanager and JobWatch ingestion paths.
- Build initial identity, email, chat/work-management, and source-ticket coexistence integration as required.
- Set up migration staging area, encrypted transfer, logging, and quarantine process.

**Deliverables**

- Data profile report.
- Data cleansing/backlog tracker.
- Connector readiness report.
- Migration transformation scripts/jobs.
- Test datasets and masked/synthetic test data.

**Exit criteria**

- Minimum data quality thresholds achieved for pilot scope.
- Critical connectors pass technical tests.
- Migration tooling performs idempotently against test data.

### Phase 3 — Configure, migrate, and test in non-production (Weeks 7–10)

**Objectives**

- Run end-to-end functional, integration, migration, performance, security, and operational tests.

**Activities**

- Configure pilot queues, routing, service mappings, JobWatch jobs, alert rules, SLA rules, knowledge, and notification templates.
- Run initial mock migration in sandbox/staging.
- Execute data reconciliation.
- Conduct role-based UAT.
- Conduct day-in-the-life operational scenarios.
- Test incident escalation, major incident response, change approval, request fulfillment, and JobWatch exception workflow as applicable.
- Test role restrictions, private records, audit export, backup/restore, and connector failure handling.
- Record defects and complete remediation.

**Deliverables**

- Mock migration results.
- Reconciliation report.
- UAT evidence and defect log.
- Operational readiness checklist.
- Training materials and support model.

**Exit criteria**

- UAT pass criteria met.
- Mock cutover duration fits approved cutover window.
- No unresolved critical/high-severity defects.
- Rollback plan tested.

### Phase 4 — Pilot production cutover (Weeks 10–12)

**Objectives**

- Move one critical service/workflow to production under controlled support.

**Activities**

- Freeze pilot-domain configuration changes in legacy system.
- Final delta extract and migration.
- Enable selected production connectors and notification paths.
- Run cutover validation.
- Direct pilot team to WeCrew ITSM for defined workflow scope.
- Run hypercare command center.
- Measure outcomes and collect feedback.

**Deliverables**

- Cutover completion report.
- Initial operational metrics report.
- Defect/issue log and improvement backlog.
- Formal pilot acceptance or remediation plan.

**Exit criteria**

- Pilot business/process owner signs acceptance.
- Incident/request operations remain stable for agreed hypercare period.
- No open critical migration defect.
- Wave 2 scope and changes approved.

### Phase 5 — Wave-based rollout (Weeks 12+)

**Objectives**

- Expand by service domain, business unit, geography, or workflow module.

**Suggested wave order**

| Wave | Scope | Primary outcome |
| --- | --- | --- |
| Wave 1 | AEGIS incidents + JobWatch for pilot service | Operational proof and response workflow |
| Wave 2 | Additional critical services and knowledge/runbooks | Repeatable incident/knowledge model |
| Wave 3 | Service request portal and top catalog items | Requester/agent adoption |
| Wave 4 | Problem management, SLA reporting, corrective actions | Continual improvement loop |
| Wave 5 | Change enablement and deployment correlation | Governed delivery operations |
| Wave 6 | Broader service graph/CMDB/asset enrichment | Cross-service impact and risk context |
| Wave 7 | Advanced AI, automation, status pages, enterprise controls | Scale and differentiated automation |

---

## 9. Data Migration Strategy

### Data disposition categories

Every source object must have one approved disposition:

| Disposition | Meaning |
| --- | --- |
| Migrate | Import into WeCrew ITSM and make operationally active |
| Federate | Keep source authoritative; synchronize/read through selected fields |
| Archive | Retain in immutable/read-only store with search or deep-link access |
| Exclude | Do not move because expired, duplicate, invalid, out of retention, or no business value |
| Transform | Rebuild as a different target object, such as legacy category to service/catalog taxonomy |
| Quarantine | Hold because data is invalid, restricted, unmapped, or awaiting customer decision |

### Recommended record handling

| Source object | Recommended treatment |
| --- | --- |
| Open incidents | Migrate with full history, comments, active attachments, linked CI/service, SLA state, and owner |
| Incidents closed within prior 12–24 months | Selectively migrate based on support/search/postmortem value |
| Older closed incidents | Archive unless regulatory/contractual requirement demands migration |
| Active major incidents/problems/changes | Migrate fully and validate manually |
| Closed problems/changes | Archive/selectively migrate linked records with continuing value |
| Knowledge articles | Migrate only approved/current articles; clean ownership/review dates first |
| Runbooks | Migrate approved active runbooks; preserve version/source reference |
| Users | Synchronize from IdP/directory where possible; avoid stale direct import |
| Groups/teams | Import and rationalize; map to target ownership and escalation model |
| CIs/assets | Import minimum viable in-scope CIs; enrich via connectors after cutover |
| Attachments | Migrate only scoped classes; virus scan, classify, and preserve hash/reference |
| Audit records | Export/retain in archive unless mandated for online target-system access |

### Data mapping workbook

Maintain a controlled mapping workbook with these columns:

```
Source system
Source table/object
Source field
Source data type
Source allowed values
Target entity
Target field
Target data type
Transformation rule
Default value
Validation rule
Required/optional
Data owner
Disposition
Test sample
Mapping status
```

### ID crosswalk

Never lose original record references. Create an immutable crosswalk:

```
source_system
source_record_type
source_record_id
target_entity_type
target_entity_id
migration_batch_id
migrated_at
migration_status
source_url
checksum/version
```

The crosswalk supports traceability, coexistence, audit, duplicate prevention, and support investigation.

---

## 10. Data Quality and Reconciliation

### Data-quality dimensions

| Dimension | Test |
| --- | --- |
| Completeness | Required fields and mappings are present |
| Validity | Values match allowed formats/ranges/states |
| Consistency | Related records, states, owners, and timestamps align |
| Uniqueness | Duplicate ticket/job/service/CI records are resolved or explicitly linked |
| Referential integrity | References resolve to valid target user/team/service/CI/parent record |
| Timeliness | Active/open records and current ownership are current |
| Security classification | Restricted/PII data is handled under target access policy |
| Traceability | Source ID and migration batch are retained |

### Reconciliation levels

**Level 1: Volume reconciliation**

```
Source scoped records
= migrated successfully
+ archived/federated
+ excluded with approved reason
+ quarantined/open exception
```

**Level 2: Field reconciliation**

Validate key fields: ID, state, priority, severity, timestamps, requester, assignee/group, service, CI, SLA, parent links, comments, attachments, and closure data.

**Level 3: Relationship reconciliation**

Validate incident-to-service, incident-to-CI, request-to-task, change-to-service, problem-to-incident, knowledge-to-service, and job-to-service/owner links.

**Level 4: Business scenario reconciliation**

Validate end-to-end user experience:

- A migrated open incident can be found, assigned, updated, escalated, and resolved.
- A migrated change retains its implementation/rollback context.
- A migrated knowledge article is found only by authorized users.
- A selected job failure creates/links to the correct service and owner.

### Reconciliation thresholds

| Category | Target threshold | Exception handling |
| --- | --- | --- |
| Open critical records | 100% | Manual verification required |
| Open standard records | 99.5%+ | Exceptions triaged and approved |
| Required key-field accuracy | 99.5%+ | Correct before cutover |
| Referential integrity | 99%+ for pilot scope | Orphan records quarantined or remediated |
| Attachments | 100% for active critical records | Hash/count validation |
| Historical archive | 100% accounted for | Sampling plus archive integrity proof |

---

## 11. Integration Cutover Plan

### Integration inventory

| Integration | Direction | Cutover method | Validation |
| --- | --- | --- | --- |
| Identity provider | Inbound authentication/provisioning | Enable in staging, then production | Login, RBAC, joiner/mover/leaver tests |
| Email | Inbound/outbound | Parallel mailbox testing then route switch | Create/update/reply/notification tests |
| Prometheus Alertmanager | Inbound webhook | Shadow mode, then production endpoint switch | Alert creates/deduplicates correct incident |
| JobWatch | Inbound events | Register pilot jobs, enable event flow | Failure/late/missed job detection and ownership |
| Slack/Teams | Bi-directional notification/commands | Pilot channel, then approved production channels | Update delivery, deep links, permission tests |
| Jira/Asana | Bi-directional selective sync | Field mapping and replay test | Task/incident link, loop prevention, conflict policy |
| CI/CD | Inbound deployment events / approved actions | Read-only evidence first | Deployment appears in change/incident timeline |
| Legacy ITSM | One-way or restricted two-way transition sync | Controlled cutover map per workflow | No duplicate ticket/state conflicts |
| CMDB/cloud inventory | Inbound sync/read model | Scheduled import and reconciliation | CI/ownership/relationship sampling |

### Shadow mode

For critical operational connectors, use shadow mode before making WeCrew ITSM authoritative.

```
Source sends event to WeCrew ITSM
-> WeCrew processes and records it
-> notifications/actions remain disabled or non-authoritative
-> compare result with legacy workflow
-> resolve mapping/correlation/routing defects
-> enable production authority after approval
```

### Integration cutover criteria

- Authentication and least-privilege access validated.
- Error rate and latency meet agreed thresholds.
- Retry/idempotency behavior tested.
- Alerts/events are not silently dropped.
- Duplicate prevention and loop prevention validated.
- Monitoring and alerting for connector health enabled.
- Support ownership and escalation for each connector agreed.

---

## 12. Testing Strategy

### Test stages

| Stage | Purpose | Owner |
| --- | --- | --- |
| Unit/component test | Validate transformation, workflow, and integration logic | WeCrew |
| System integration test | Validate connected services and API/webhook paths | Joint |
| Data migration test | Validate extraction, transform, load, crosswalk, and reconciliation | Joint |
| Security test | Validate RBAC, data isolation, secrets, audit, restricted records | Joint |
| Performance test | Validate expected ticket/event volume and portal/agent usability | WeCrew with customer data assumptions |
| User acceptance test | Validate customer processes and business outcomes | Customer |
| Operational readiness test | Validate on-call, escalation, incident, cutover, backup/restore, support | Joint |
| Mock cutover | Rehearse production sequence, timing, validation, rollback | Joint |
| Hypercare test | Validate triage, defect routing, communications, and support handoff | Joint |

### Day-in-the-life scenarios

At minimum, test:

1. Monitoring alert arrives, creates an incident, resolves service/owner, and pages/alerts the right team.
2. A Kubernetes CronJob fails; JobWatch detects it and shows downstream business impact.
3. Responder acknowledges, assigns, communicates, uses runbook, and resolves incident.
4. Major incident is declared; roles, update cadence, and stakeholder communications operate correctly.
5. Employee submits catalog request; approval, task fulfillment, notification, and closure meet SLA.
6. Recurring incident becomes a problem; known error and corrective action are created.
7. Normal change is created, risk assessed, approved, scheduled, implemented, verified, and reviewed.
8. Restricted/security ticket is visible only to authorized roles.
9. Connector failure/retry does not lose or duplicate source events.
10. AI summary cites only authorized evidence and does not expose protected data.
11. Approved automation action requires the defined policy/approval and records verification evidence.
12. Backup/restore or event replay meets documented operational requirement.

---

## 13. Training and Change Management

### Audience-based enablement

| Audience | Training content | Delivery method |
| --- | --- | --- |
| Requesters | Portal, search, catalog requests, status tracking, knowledge | Short videos, guides, portal walkthrough |
| Service desk agents | Queues, triage, templates, notes, SLA, knowledge, routing | Hands-on workshop and sandbox scenarios |
| Responders/SRE/app support | Incident workspace, JobWatch, evidence, communication, escalation | Simulation exercises and runbook labs |
| Incident commanders | Major incident roles, updates, decisions, stakeholder communications | Tabletop exercises |
| Change/problem managers | Workflow, approvals, risk, PIR, known errors, action tracking | Role-specific workshops |
| Service owners | Service graph, ownership, SLA/SLO, scorecards, data-quality responsibilities | Dashboard and governance session |
| Administrators | RBAC, catalog/workflow configuration, integrations, audit, retention | Admin lab and operational runbook |
| Executives | Outcome dashboards, escalation, governance, decision path | Briefing and drill participation |

### Adoption approach

- Publish a clear "what changes and when" communication plan.
- Use champions from each pilot team.
- Provide office hours during pilot and hypercare.
- Keep legacy references/deep links available during transition.
- Publish quick-reference guides for frequent tasks.
- Measure adoption: login, ticket creation, queue use, knowledge use, response time, user feedback.
- Feed recurring adoption problems into a prioritized change backlog.

---

## 14. Production Cutover Runbook

### Cutover approach

A production cutover is executed per migration wave. The pilot cutover should occur during a low-risk business window but with appropriate technical and business support available.

### Cutover timeline example

| Relative time | Activity | Owner | Evidence / exit condition |
| --- | --- | --- | --- |
| T-10 business days | Final readiness review and go/no-go pre-check | Joint steering group | Risks accepted; cutover plan approved |
| T-5 business days | Final mock cutover and rollback rehearsal | Joint cutover team | Duration and reconciliation pass |
| T-3 business days | Confirm user/agent training, communications, support roster | Customer + WeCrew | Attendance and support plan confirmed |
| T-2 business days | Freeze target configuration except approved cutover changes | Joint | Change log locked |
| T-1 business day | Freeze scoped legacy workflow/configuration; announce cutover | Customer | Stakeholders notified |
| T-0 start | Open command center; verify backup/export and connector status | Cutover manager | Bridge active, owners present |
| T-0 + 0–2h | Final delta extract and load | Migration lead | Technical completion and batch report |
| T-0 + 2–3h | Reconciliation and functional smoke tests | Joint | Critical record and integration checks pass |
| T-0 + 3–4h | Switch pilot routing/authoritative workflow | Integration/process owners | Source events and user entry points route correctly |
| T-0 + 4–8h | Stabilization monitoring and business validation | Hypercare lead | No P1/P2 blocker; acceptance checkpoint |
| T+1 day | Day-one review and defect triage | Joint | Defects prioritized, communications issued |
| T+5 business days | Hypercare exit review | Joint steering group | Pilot acceptance/next wave decision |

### Pre-cutover checklist

**Governance**

- [ ] Scope, record disposition, and acceptance criteria approved.
- [ ] Cutover manager, command-center contacts, and escalation path confirmed.
- [ ] Go/no-go authority and decision deadline confirmed.
- [ ] Business, technical, security, and service-desk representatives scheduled.

**Data**

- [ ] Final source backup/export completed and verified.
- [ ] Migration batch/version approved.
- [ ] Source-to-target crosswalk ready.
- [ ] Data-quality exceptions accepted or remediated.
- [ ] Open critical records identified for manual validation.

**Platform**

- [ ] Production environment health verified.
- [ ] RBAC, identity, and restricted-record policy tested.
- [ ] Audit/event retention enabled.
- [ ] Backup/restore and monitoring checks complete.
- [ ] Capacity/performance thresholds verified.

**Integrations**

- [ ] Connector credentials active and validated.
- [ ] Source endpoints/DNS/webhooks ready for route switch.
- [ ] Connector health dashboards and alerts enabled.
- [ ] Duplicate/loop-prevention configuration verified.
- [ ] Notification channels and fallback contacts tested.

**Operations**

- [ ] Pilot service owners, agents, responders, and on-call schedule confirmed.
- [ ] Knowledge/runbooks published and access checked.
- [ ] Support/hypercare model communicated.
- [ ] User/agent communications sent.

### Cutover validation checklist

- [ ] Authorized users can sign in and see correct role/workspace.
- [ ] Pilot services, owners, queues, and escalation paths are correct.
- [ ] Open critical tickets/incidents are present and manually validated.
- [ ] Source alert creates or updates a WeCrew incident as designed.
- [ ] JobWatch test event shows correct job, service, owner, state, and SLA behavior.
- [ ] Email/portal/chat entry paths create/update the intended record.
- [ ] Notifications deliver to agreed channel/contact.
- [ ] SLA clock starts/stops/pauses correctly in test scenarios.
- [ ] Audit events are generated for updates and approvals.
- [ ] A knowledge article is visible only to authorized audience.
- [ ] Operational dashboards display current data.
- [ ] Reconciliation report is signed by data/process owners.

---

## 15. Go/No-Go Criteria

### Go criteria

Proceed only if all conditions are met:

- No unresolved Severity 1 defect.
- No unresolved defect that blocks incident intake, routing, acknowledgement, escalation, or critical job detection.
- Open SEV-1/SEV-2 legacy records are migrated/linked and manually verified.
- Identity/RBAC and restricted-record access pass.
- Production connector health and smoke tests pass.
- Data reconciliation meets thresholds or exceptions have written approval.
- Rollback plan, backup, contacts, and decision authority are ready.
- User communications and hypercare staffing are complete.

### No-go criteria

Delay cutover if any condition applies:

- Critical incident/alert path is untested or unreliable.
- Source/target data contains unresolved high-impact mapping errors.
- Required security or compliance approval is missing.
- Production connectivity/credentials are not validated.
- Rollback has not been rehearsed.
- The cutover window cannot accommodate migration plus validation plus rollback buffer.
- Major business blackout/change freeze conflicts with the planned window.

---

## 16. Rollback Plan

### Rollback principle

Rollback returns the authoritative workflow routing to the legacy system. It does not attempt to delete all target migrated records during a live incident window.

### Rollback triggers

- P1 defect prevents incident intake, acknowledgement, assignment, escalation, or critical notification.
- Data integrity error affects open critical records or creates unsafe routing.
- Security/RBAC failure exposes restricted records.
- Connector failure causes lost/duplicated operational events without safe mitigation.
- Required business acceptance fails within the approved decision window.
- Cutover exceeds timebox and threatens normal operations.

### Rollback steps

1. Cutover manager declares rollback using agreed authority.
2. Freeze target routing and disable newly enabled production connector actions/notifications as appropriate.
3. Restore legacy intake routes, email routing, webhook endpoint, and ticket master workflow.
4. Notify service desk, responders, stakeholders, and leadership using rollback communication template.
5. Record all target-created records/events during cutover in the crosswalk for later reconciliation.
6. Preserve target audit data; do not delete evidence.
7. Reconcile work created during the partial cutover and link/import into the restored authoritative system as required.
8. Conduct incident review and root-cause analysis before rescheduling.

### Rollback acceptance

- Legacy authoritative workflow is confirmed operational.
- Critical notifications/incident routing are restored.
- No active critical work is orphaned.
- Stakeholders have received communication.
- Partial migration evidence is retained for investigation.

---

## 17. Hypercare Plan

### Duration

Recommended: 5–10 business days after each wave, adjusted by service criticality and workflow scope.

### Hypercare operating model

| Area | Hypercare practice |
| --- | --- |
| Command center | Daily joint triage meeting; always-on escalation channel for critical issues |
| Support | Named WeCrew implementation/support contact and customer process/technical owners |
| Defects | Severity-based triage, workarounds, ETA, and customer communication |
| Data | Daily reconciliation for active/new records during first days |
| Integrations | Monitor delivery, latency, errors, retries, duplicates, and auth failures |
| Adoption | Track queue use, portal adoption, knowledge search, training questions |
| Metrics | Compare baseline and post-cutover MTTA, MTTU, SLA, JobWatch detection, backlog, and manual checks |
| Change control | Restrict configuration changes; bundle approved fixes through controlled release window |

### Hypercare exit criteria

- No unresolved P1/P2 defect.
- Incidents/requests meet agreed operational workflow standards.
- Connector health stable for agreed period.
- Data reconciliation exceptions resolved/accepted.
- Support team demonstrates independent operation.
- Wave acceptance signed.
- Improvement backlog is prioritized for the next release/wave.

---

## 18. Security, Privacy, and Compliance Controls

### Data handling

- Classify source data before extraction: public, internal, confidential, restricted, PII, credentials, security evidence, customer data.
- Exclude secrets/credentials from migration unless a controlled technical design explicitly requires reference migration.
- Encrypt data in transit and at rest.
- Use access-controlled staging storage with time-bound access and audit logs.
- Mask/anonymize production data in non-production environments wherever possible.
- Virus-scan attachments and apply file-type/size policy.
- Preserve legal hold/retention obligations before excluding or deleting records.
- Document data residency and subprocessors where managed AI or SaaS services are used.

### AI migration controls

- Do not ingest legacy tickets/knowledge into AI retrieval until access controls and data classification are validated.
- Index only approved/authorized knowledge for the initial AI pilot.
- Redact secrets, tokens, PII, and restricted fields before model invocation.
- Maintain AI feature toggles by workspace/team.
- Record model/prompt/retrieval version and source evidence for all AI outputs.
- Use a controlled evaluation set before enabling AI assistance broadly.

---

## 19. Communications Plan

### Stakeholder messages

| Audience | Message | Timing |
| --- | --- | --- |
| Executive sponsors | Outcomes, risk, decision points, adoption metrics | Weekly and go/no-go |
| Service owners | Service scope, ownership actions, test/UAT, cutover readiness | Weekly; intensified pre-cutover |
| Service desk/responder teams | What changes, workflow guidance, training, support contacts | 2–3 weeks before cutover; reminders |
| Requesters/end users | Portal/service catalog changes, access, support guidance | 1 week and 1 day before go-live |
| Security/compliance | Data handling, access, audit, evidence, approval status | At design and readiness gates |
| Customers/external stakeholders | Service impact/maintenance notice where applicable | Per communication policy |

### Cutover announcement template

```
Subject: WeCrew ITSM pilot cutover for [service/workflow] — [date/time]

What is changing:
[Brief description of the workflow/service moving to WeCrew ITSM.]

Who is affected:
[Teams, users, or customers in scope.]

When:
[Cutover window, time zone, expected service-desk impact if any.]

What you need to do:
[New portal URL, queue/channel, training guide, or no action required.]

Support:
[Hypercare channel/contact and escalation process.]

Fallback:
[What to do if the new workflow is unavailable during stabilization.]
```

---

## 20. Metrics and Outcome Reporting

### Baseline metrics before pilot

- Monthly incident volume by service/priority.
- Mean time to acknowledge, understand, mitigate, and resolve.
- SLA breach count and breach reasons.
- Critical-job failure, missed-run, late-run, and manual-check frequency.
- Percentage of services/jobs with documented owner and runbook.
- Alert volume, duplicate/noisy alert rate, escalation rate, after-hours burden.
- Request volume, first-contact resolution, backlog aging, fulfillment time.
- Change success/failure/rollback rate.
- Knowledge use and deflection, if existing data exists.

### Post-cutover measures

- Adoption by role and workflow.
- Incident/JobWatch detection earlier than business/user report.
- Ownership resolution time.
- Job SLA compliance.
- Service desk queue health and SLA trend.
- Change/PIR completeness.
- Data-quality score for service/CI/owner relationships.
- AI usefulness/grounding measures where enabled.
- Automation action success and verification rate where enabled.

### Pilot outcome report

The report should contain:

- Scope and implementation summary.
- Baseline versus post-pilot metrics.
- Representative incident/job cases.
- Data-quality and connector health results.
- User/adoption feedback.
- Defects and resolved issues.
- ROI narrative: manual checks avoided, faster ownership, faster detection, fewer escalations.
- Recommended next migration wave and commercial expansion plan.

---

## 21. Risks and Mitigations

| Risk | Likely impact | Mitigation |
| --- | --- | --- |
| Big-bang scope pressure | Failed adoption and business disruption | Enforce phased workflow/service-domain migration |
| Poor source data quality | Incorrect ownership, ticket state, SLA, or CI context | Data profiling, disposition rules, exception ownership, pilot scope |
| Legacy customization replication | Long project and weak differentiation | Re-engineer against target outcomes; approve exceptions only with business case |
| Bidirectional sync loops | Duplicate/conflicting tickets | Single-system authority, field-level sync scope, idempotency, monitoring |
| Incomplete identity/RBAC mapping | Security exposure or blocked user access | Early identity testing, role matrix, restricted-record tests |
| Missed alert during routing switch | Incident response failure | Shadow mode, parallel monitoring, controlled endpoint cutover, rollback |
| Inadequate user training | Workarounds and low adoption | Role-based training, champions, hypercare, quick guides |
| Attachment/PII migration issue | Compliance or security risk | Classification, scan, encryption, restricted access, selective migration |
| Cutover exceeds window | Operational disruption | Mock cutovers, timing buffer, delta strategy, clear rollback trigger |
| AI exposes unauthorized content | Trust/security failure | ACL-aware retrieval, redaction, feature gates, evaluation before rollout |
| Connector scope expansion | Delivery delay | Prioritize based on pilot value; generic API/webhook first |
| Self-hosted/VPC demands too early | Margin/support strain | Use paid enterprise scope; standardize delivery before commitment |

---

## 22. Deliverables Checklist

### Mobilization

- [ ] Migration charter and RACI
- [ ] Scope/disposition matrix
- [ ] Stakeholder and communications plan
- [ ] Risk, issue, assumption, and decision logs

### Design

- [ ] Target operating model
- [ ] Process design and configuration workbook
- [ ] Data dictionary and mapping workbook
- [ ] Security/privacy/data-retention design
- [ ] Integration architecture and connector plan
- [ ] Coexistence and source-of-truth policy

### Build and test

- [ ] Configured non-production environment
- [ ] Migration tooling and ID crosswalk
- [ ] Connector configuration and health monitoring
- [ ] Test strategy, test cases, UAT evidence
- [ ] Mock migration and reconciliation report
- [ ] Rollback rehearsal result

### Cutover

- [ ] Cutover runbook and command-center roster
- [ ] Go/no-go checklist and approvals
- [ ] Production migration batch/reconciliation report
- [ ] Smoke-test evidence
- [ ] Cutover/hypercare communications

### Closure and expansion

- [ ] Hypercare exit report
- [ ] Pilot outcome report
- [ ] Customer acceptance sign-off
- [ ] Lessons learned and improvement backlog
- [ ] Next-wave scope, timeline, and commercial proposal

---

## 23. Final Recommendation

The safest and most commercially effective enterprise migration path is:

```
1. Establish identity, service ownership, minimum service graph, and governance.
2. Introduce AEGIS incident intelligence and JobWatch for one critical workflow.
3. Run shadow mode and prove signal-to-incident-to-resolution value.
4. Cut over one service domain with active records, controlled routing, and hypercare.
5. Expand to service requests, knowledge, problem, change, and SLA workflows in waves.
6. Migrate/federate CMDB and historical data only to the level required for operational value and compliance.
7. Add AI and governed automation after evidence, access control, and runbook maturity are proven.
```

A successful migration is not defined by copying the greatest number of legacy records. It is defined by a stable operational cutover in which teams can identify impact, route work to the right owner, recover services safely, meet service commitments, and progressively retire unnecessary legacy complexity.
