# SecurityScorecard Integration

**Date:** 2026-09-19
**Status:** Design — awaiting review (schema verified with `prisma validate`, Prisma 5.22.0)
**Spans two repos:** `/root/projects/argus-itsm-frontend` (this one) and `/root/projects/argus-itsm/backend`

## Goal

Give an organization's IT and security teams their SecurityScorecard rating inside Argus, and turn
rating changes into incidents automatically. The reference is SecurityScorecard's own ServiceNow
app ("SecurityScorecard for IT Service Management", support article 9125914113947), which does
three things:

1. **Self-monitoring only** — pulls the scorecard for the org's own domain, not vendors.
2. **Shows** the current scorecard, score history, and an event log.
3. **Incident Creation Rules** — a rule picks a *basis* (overall score / factor score / new issue
   findings) and a *variation* (points drop, percent change, threshold; or issue type / category),
   and sets the priority and assignee of the incident it opens.

This spec matches that feature set. It is scoped to one domain per organization.

## Why this is a spec and not a branch

- Both repos carry uncommitted `razorpay-billing` work. A new integration on top would tangle two
  unrelated changes.
- The design surfaced **security defects in the existing integrations API** (see Prerequisites).
  They must be fixed first, and on their own, because they affect every integration and not just
  this one. Storing a SecurityScorecard token in today's `Integration.config` would make it
  readable by every VIEWER in the org.

## Prerequisites (fix before this lands)

All are in `backend/src/controllers/integration.controller.js` and `routes/integration.routes.js`.

| # | Defect | Evidence | Fix |
| --- | --- | --- | --- |
| P1 | **Integration secrets are readable by every role.** `config` is returned verbatim by list/get, and `integrations: 'read'` is granted to MANAGER, ENGINEER, OPERATOR and **VIEWER** (`config/constants.js:64-67`). PagerDuty routing keys, Grafana API keys and K8s tokens stored today are all exposed this way. The hub's `type: 'password'` inputs only hide what the API already sent. | `integration.controller.js:12-35`; `IntegrationHub.tsx:52` | Return `config` only to ADMIN; others get `config: null`. Safe: the only UI consumer is `IntegrationHub`, which is already `allowedRoles={['ADMIN']}` (`App.tsx:176`), and backend services read the table through Prisma, not the API. |
| P2 | **No tenant check on PATCH or test.** `getIntegration` checks the org (line 32); `updateIntegration` (line 47) and `testConnection` (line 57) take any id. | as cited | Same org guard as `getIntegration` on both. |
| P3 | **Mass assignment.** create spreads `req.body` (line 41) and update passes `req.body` whole (line 50), so a client can set `status`, `lastSyncAt`, `errorMessage` — and, once it exists, `secret` in plaintext. | as cited | Whitelist with the existing `sanitizeObject` helper (`utils/helpers.js:76`): `name, type, config, status` (+ `secret` via the path below). |
| P4 | **No place for a secret.** `Integration.config` is a plain `String?` holding JSON. | `schema.prisma` `model Integration` | New write-only `Integration.secret` column, encrypted at rest (see Decisions). |

P1–P3 are one small backend PR. Migrating existing plaintext secrets (PagerDuty, Grafana, K8s,
StackStorm) out of `config` and into `secret` is a **follow-up**, not part of this feature — see
Open questions.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Transport | **Poll the SSC REST API; do not use SSC webhooks** | SSC webhooks are unsigned: no custom headers, auth is "a token in the query string". The payload is documented as **beta and subject to change at any time**. Failed deliveries retry only every 6 h for 36 h, so a deploy window can drop events. Polling needs no public ingress, matching why `alertSyncService` exists ("remote orgs can't push webhooks"). |
| Poll interval | **60 min** (`SCORECARD_SYNC_INTERVAL_MIN`) | SSC scores have a daily effective date, so faster polling finds nothing new. Cost is 3 requests per org per poll against a limit of 5,000/hour per token. |
| Scheduling | **`setInterval` in `server.js` + Redis `SET NX EX` lock** | Same pattern as the five existing loops (`server.js:188-212`). `cronScheduler.js` is an empty stub; don't build on it. The lock matters because `k8s/hpa.yml:15` allows **3 API replicas**, each running every interval. |
| Correctness under concurrency | **Database unique constraints, not the lock** | The lock only avoids wasted work. If Redis is down the sync proceeds, and `ScorecardEvent @@unique([organizationId, externalId])` plus `ScorecardRuleFiring @@unique([ruleId, triggerKey])` still guarantee one row and one incident per trigger. |
| Token storage | **`Integration.secret`: AES-256-GCM via Node `crypto`, key from `INTEGRATION_SECRET_KEY`** | No new dependency. Stored as `v1:<iv>:<tag>:<ciphertext>` (base64) so the key can be rotated later. The key is a k8s Secret created imperatively, per cluster convention. Losing the key means re-entering tokens, nothing worse. |
| Secret API semantics | **Write-only.** Responses carry `hasSecret: boolean`, never the value. PATCH changes it only when a non-empty `secret` is sent. | The hub saves by PATCHing the *whole* form back (`IntegrationHub.tsx:183`). A masked read-back would otherwise overwrite the real token with the mask. |
| One scorecard per org | **One `Integration` row of type `SECURITYSCORECARD` per org, `config = { domain }`** | Matches the SSC app (self-monitoring). The hub already assumes one integration per type (`apiIntegrations.find(a => a.type === def.type)`). |
| Where rules create work | **Incidents directly, not via `Alert`** | This is what the SSC app does. The `Alert` table carries Prometheus-specific jobs: the 6-hourly stale-alert expiry resolves any `WARNING` older than 7 days regardless of source. A score drop isn't a firing alert. |
| Incident priority | **Rule stores `impact` + `urgency`; priority = `calculatePriority`** | One priority matrix in the codebase (`constants.js:14`). SLA targets derive from priority via `calculateSLATargetTimes`, like every other incident. The rule form shows the resulting P-level live. |
| Incident creator | **`rule.createdById`** | `alertSyncService.getSystemUserId()` picks the *first ADMIN globally*, which in a multi-tenant DB can belong to a different org. The rule's author is in-org and auditable. |
| Assignment | **Exactly what the rule says; unassigned if blank** | Don't reuse `CATEGORY_TEAM_PATTERNS` in `alertSyncService.js`: it maps `'Security'` to a team named like `Network` (line 41), a Finspot-specific routing. |
| Rules are forward-looking | **Never fire on history** | Connecting backfills 30 days, and creating a rule must not open a month of incidents. Guards: `ScorecardEvent.backfill`, and `scoreDate / event.createdAt >= rule.createdAt`. |
| Threshold rules | **Edge-triggered**: fire when the score *crosses* below, not while it stays below | Level-triggered would open an incident every day the score sits under the line. |
| Overlapping rules | **Each rule fires independently** | Two matching rules open two incidents, which mirrors ServiceNow. The rules panel warns when a new rule overlaps an existing one by basis + variation + target. |

## SecurityScorecard API surface used

Base `https://api.securityscorecard.io` (overridable by `SSC_API_BASE` for tests). Header
`Authorization: Token <token>`. The limit is 5,000 requests/hour, rolling; a `429` carries
`Retry-After`. SSC notes that endpoints "are configured on a per client basis", so the connection
test must exercise every endpoint below, not just one.

| Call | Used for |
| --- | --- |
| `GET /companies/{domain}` | Connection test: 401 = bad token, 404 = domain not on a scorecard |
| `GET /companies/{domain}/summary-factors` | Current `score`, `grade`, and `factors[]` with `{name, score, grade, issue_summary[{type, count, severity}]}` |
| `GET /companies/{domain}/history/score?timing=daily&from=&to=` | Authoritative dated overall scores; the 30-day backfill |
| `GET /companies/{domain}/history/factors/score` | Factor score backfill |
| `GET /companies/{domain}/history/events/?date_from=&date_to=` | Event log. `entries[]` of `{id, date, event_type, group_status, issue_type, factor, severity, issue_count, total_score_impact, detail_url, breach_data}`. **No pagination** — bound it with the date window. |
| `GET /metadata/factors`, `GET /metadata/issue-types` | Rule-form dropdowns; cached in Redis for 24 h |

## Schema

Additions only. Validated by appending them to a copy of the current `schema.prisma` and running
`prisma validate`.

```prisma
enum IntegrationType { /* existing … */ SECURITYSCORECARD }
enum IncidentSource  { /* existing … */ SECURITYSCORECARD }

model Integration {
  // existing fields …
  secret String? // AES-256-GCM ciphertext; never serialized
}

enum ScorecardRuleBasis {
  OVERALL_SCORE
  FACTOR_SCORE
  NEW_ISSUES
}

enum ScorecardVariation {
  POINTS_DROP     // score fell by >= threshold points over windowDays
  PERCENT_DROP    // score fell by >= threshold percent over windowDays
  BELOW_THRESHOLD // score crossed from >= threshold to < threshold
  ISSUE_TYPE      // new active findings of issueType
  ISSUE_FACTOR    // new active findings in factor (ServiceNow's "issue category")
  ISSUE_SEVERITY  // new active findings at or above minSeverity
}

model ScorecardSnapshot {           // one row per org per SSC score date
  id             String   @id @default(uuid())
  organizationId String
  scoreDate      DateTime @db.Date
  score          Int
  grade          String?            // null on backfilled rows
  factors        Json?              // [{ name, score, grade?, issueCount? }]
  fetchedAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@unique([organizationId, scoreDate])
}

model ScorecardEvent {              // mirror of /history/events
  id               String   @id @default(uuid())
  organizationId   String
  externalId       String            // SSC's numeric event id
  eventDate        DateTime
  eventType        String            // issues | breach | recalibration (SSC may add more)
  groupStatus      String?           // active | resolved | departed
  issueType        String?
  factor           String?
  severity         String?           // positive | info | low | medium | high
  issueCount       Int?
  totalScoreImpact Float?
  detailUrl        String?
  raw              Json
  backfill         Boolean  @default(false)   // ingested by the first sync; never fires rules
  createdAt        DateTime @default(now())
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@unique([organizationId, externalId])
  @@index([organizationId, eventDate])
}

model ScorecardRule {
  id                String             @id @default(uuid())
  organizationId    String
  name              String
  basis             ScorecardRuleBasis
  variation         ScorecardVariation
  threshold         Float?             // points, percent or score, per variation
  windowDays        Int                @default(1)
  factor            String?            // FACTOR_SCORE basis, ISSUE_FACTOR variation
  issueType         String?            // ISSUE_TYPE
  minSeverity       String?            // ISSUE_SEVERITY: low | medium | high
  impact            Impact             @default(DEPARTMENT)
  urgency           Urgency            @default(MEDIUM)
  assignmentGroupId String?
  assignedToId      String?
  isActive          Boolean            @default(true)
  createdById       String
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  assignmentGroup Team?        @relation(fields: [assignmentGroupId], references: [id], onDelete: SetNull)
  assignedTo      User?        @relation("ScorecardRuleAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  createdBy       User         @relation("ScorecardRuleCreator", fields: [createdById], references: [id])
  firings         ScorecardRuleFiring[]
  @@index([organizationId, isActive])
}

model ScorecardRuleFiring {         // the idempotency record
  id         String   @id @default(uuid())
  ruleId     String
  triggerKey String                   // score:<YYYY-MM-DD> | event:<externalId>
  incidentId String?  @unique
  firedAt    DateTime @default(now())
  rule       ScorecardRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  incident   Incident?     @relation(fields: [incidentId], references: [id], onDelete: SetNull)
  @@unique([ruleId, triggerKey])
}
```

**Back-relations:**
- `Organization`: `scorecardSnapshots`, `scorecardEvents`, `scorecardRules`
- `Team`: `scorecardRules`
- `User`: `scorecardRulesAssigned @relation("ScorecardRuleAssignee")` and `scorecardRulesCreated @relation("ScorecardRuleCreator")`
- `Incident`: `scorecardFiring ScorecardRuleFiring?`

**Enum migration note:** extending `IntegrationType` also matters for the hub. Many cards it
lists (`DATADOG`, `JIRA`, `OPSGENIE`, …) have no enum value today, so saving them fails at Prisma.
That's out of scope here, but don't be surprised by it.

## Sync algorithm (`services/securityScorecardService.js`)

Each run, if the Redis lock `scorecard:sync` is acquired or Redis is unavailable, loop over
`Integration` rows with `type = SECURITYSCORECARD` and `status != INACTIVE`. For each org:

1. **Credentials.** Decrypt `secret`. If it is missing or fails to decrypt, set status `ERROR`
   ("Token missing — re-enter in Integration Hub") and skip. If the last run hit 401/403, skip
   until `updatedAt > lastSyncAt`, i.e. until an admin saves the integration again.
2. **First sync** (no snapshots for the org yet): backfill 30 days of `history/score` and
   `history/factors/score` into snapshots, and 30 days of events with `backfill = true`. Evaluate
   no rules.
3. **Scores.** Fetch `history/score` for the last 3 days and upsert snapshots by `scoreDate`.
   Fetch `summary-factors` and write `grade` + `factors` onto the newest date's row.
4. **Events.** `date_from = max(eventDate) − 2 days` (the overlap absorbs late-arriving SSC
   events), `date_to = now`. Use `createManyAndReturn({ skipDuplicates: true })`, which is
   available in the installed client and returns only the newly inserted rows.
5. **Evaluate** active rules over the new events and over snapshots whose `scoreDate` changed this
   run (see below).
6. **Record** `lastSyncAt`, `syncStatus` (for example "Score 84 (B), 2 new events, 1 incident"),
   status `ACTIVE`, and clear `errorMessage`.

**Errors:**
- `429`: honour `Retry-After` and end this org's run without changing status.
- `401`/`403`: status `ERROR` and stop polling (step 1).
- `5xx` or network failure: status `ERROR` with the message; retry on the next interval.

Emit `scorecard:updated` with an **empty payload**: `emitToAll` is cross-tenant and there are no
org rooms (`config/socket.js`), so clients just refetch their own scoped data.

## Rule semantics (`services/scorecardRules.js`, pure functions)

**Score rules.** `value(d)` is the overall score, or `factors[name = rule.factor].score` for
FACTOR_SCORE. Evaluate snapshot day `d` only when `d >= date(rule.createdAt)`.
- **POINTS_DROP:** fires when `value(d − windowDays) − value(d) >= threshold`.
- **PERCENT_DROP:** fires when `(prev − cur) / prev × 100 >= threshold`.
- **BELOW_THRESHOLD:** fires when `value(d − 1) >= threshold && value(d) < threshold`.
  `windowDays` is ignored.
- If the comparison snapshot or factor is missing, the rule **does not fire** and no error is
  raised.
- `triggerKey = score:<d>`.

**Issue rules** (NEW_ISSUES basis). Consider events with `eventType = 'issues'`,
`groupStatus = 'active'`, `backfill = false`, and `createdAt >= rule.createdAt`. Then match:
- **ISSUE_TYPE:** `issueType = rule.issueType`
- **ISSUE_FACTOR:** `factor = rule.factor`
- **ISSUE_SEVERITY:** severity rank (`low < medium < high`) is at least `minSeverity`. `positive`
  and `info` never match.
- `triggerKey = event:<externalId>`.

**Firing** happens in one interactive transaction:
1. Insert the `ScorecardRuleFiring`. A `P2002` means another replica or run already fired it, so
   skip.
2. Create the incident.
3. Set `firing.incidentId`.

If the incident insert fails, the transaction rolls back and the trigger is free to fire on the
next run. `generateIncidentNumber()` has a known read-then-increment race (see the
service-catalog spec's *Numbering*). Retry the transaction up to 3 times on a `P2002` against
`Incident.number`, or use the `Counter` table if that spec has landed by then.

**Incident fields:**
- **`shortDescription`:** "SecurityScorecard: overall score fell 6 points (84 → 78)" or
  "SecurityScorecard: 12 new high-severity findings — `tls_weak_cipher`".
- **`description`:** the rule name, the before and after values or event fields, and SSC's
  `detail_url`.
- **`category`:** `Security`, with the factor as `subcategory`.
- **Source fields:** `source = SECURITYSCORECARD`, `sourceAlertId = triggerKey`,
  `sourceAlertName = rule.name`.
- **Priority and SLA:** priority from `calculatePriority`, SLA targets from
  `calculateSLATargetTimes`.
- **`createdById`:** `rule.createdById`.
- **Events emitted:** `incident:created`, plus `incident:assigned` / `incident:assigned-to-you`,
  exactly as `alertSyncService` does.

## API contract (`routes/scorecard.routes.js`, all tenant-scoped)

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/scorecard` | ADMIN, MANAGER, ENGINEER | `{ configured, domain, score, grade, change30d, factors, lastSyncAt, syncStatus, status }`. `configured: false` when no integration exists. |
| GET | `/api/v1/scorecard/history?days=90` | same | Snapshots, ascending |
| GET | `/api/v1/scorecard/events?page&limit&eventType&severity` | same | Paginated with the existing `paginate` / `paginationMeta` helpers |
| GET | `/api/v1/scorecard/metadata` | same | `{ factors, issueTypes }` from SSC, cached in Redis for 24 h |
| GET/POST | `/api/v1/scorecard/rules` | GET: same · POST: ADMIN, MANAGER | The validator enforces per-variation required fields and that the team and user are in the org |
| PATCH/DELETE | `/api/v1/scorecard/rules/:id` | ADMIN, MANAGER | Deleting a rule cascades its firings; incidents keep existing (`SetNull`) |
| POST | `/api/v1/scorecard/sync` | ADMIN, MANAGER | Runs one org's sync now; rate-limited to 1 per minute per org |

`testConnection` gets a `SECURITYSCORECARD` case. It calls `GET /companies/{domain}`, then
`summary-factors` and `history/events` for one day, and reports the first endpoint the plan
doesn't include, if any.

## Frontend (this repo)

- **Integration Hub:**
  - Add a `SECURITYSCORECARD` entry to `INTEGRATION_DEFS` (`IntegrationHub.tsx:24`), in category
    `monitoring` with `dashboardRoute: '/scorecard'`.
  - Add a `CONFIG_FIELDS` entry with `domain`, plus an `apiToken` field flagged `secret: true`.
  - Generalize `handleSave` (line 183): fields flagged `secret` go into the request's `secret`
    property instead of `config`. When the response says `hasSecret`, show the input empty with
    the placeholder "•••••• saved — enter a new token to replace".
  - This benefits the PagerDuty/Grafana/K8s migration later.
- **Page `/scorecard`** (`src/components/Scorecard/ScorecardPage.tsx`). Not `/security`, which is
  the public marketing page (`App.tsx:134`).
  - Nav entry under **Intelligence**, roles ADMIN/MANAGER/ENGINEER.
  - Built from `PageChrome` with `DashboardOverview` as the reference:
    - **KPI row:** score + grade, 30-day change, active high-severity findings, open
      SecurityScorecard incidents.
    - **Score history:** a Recharts line with an optional factor overlay.
    - **Factor grid:** grade pills built from `cx-pill`.
    - **Event log:** a table with a severity filter.
    - **Rules panel:** create/edit is limited to ADMIN/MANAGER through `canManage`. The rule
      drawer's fields depend on basis → variation, and it shows the computed P-level and an
      overlap warning.
  - **Unconfigured state:** ADMIN gets a link to the hub; everyone else sees "ask an admin".
- **Hook** `src/hooks/useScorecard.ts`: a `keys` factory rooted at `['scorecard', …]`. It
  consistently returns `data.data`, so the page never has to guess.
- **Realtime:** map `scorecard:updated` → `invalidateQueries(['scorecard'])` in `useRealtime.ts`.
- **Types:** add `'SECURITYSCORECARD'` to `IncidentSource` (`src/types/index.ts:13`) plus the
  new interfaces. Check the incident list's source filter and badge for the new value.

## Verification

- **Backend (jest):**
  - Table-driven tests for `scorecardRules.js`: crossing vs. staying below, points and percent
    drops, a missing comparison snapshot, missing factor data, the backfill guard, and the
    `rule.createdAt` guard.
  - A sync test with mocked axios: running the same fixture twice creates **one** incident, and
    two concurrent runs with the lock bypassed still create one.
  - Tests for P1–P3: a VIEWER gets `config: null`; PATCH across orgs returns 404; `secret` never
    appears in a response.
- **Frontend:** `npm run build` + `npm run lint`, then a manual pass through the configured,
  unconfigured and ERROR states.
- **End to end:** needs a real SSC bot token (see Open questions).

## Out of scope

- Vendor / portfolio monitoring.
- Ingesting SSC webhooks. A possible v2 is a URL-token endpoint beside the poller, used only to
  trigger an early sync, never as the source of truth.
- Breach events as a rule basis.
- Mapping individual findings to CMDB CIs.
- Auto-resolving incidents.
- Moving the other integrations' plaintext secrets out of `config`.

## Open questions

1. **Do we have SSC API access, and which plan?** Endpoints vary per contract. Build and test
   need a bot-user token for a domain we control.
2. When findings for an incident's issue type **depart or resolve**, should the sync add a work
   note to the open incident? Proposed: yes, work note only, no auto-resolve.
3. Should breach events be a v1 rule basis? SSC's ServiceNow app doesn't offer it.
4. Should OPERATOR and VIEWER see `/scorecard`? The score is arguably sensitive. Proposed: no.
5. Should the migration of existing plaintext secrets (PagerDuty, Grafana, K8s, StackStorm) into
   `Integration.secret` ship with P1–P3 or right after? P1 already hides them from non-admins, so
   the remaining exposure is ADMIN-only plus database-at-rest.
6. Should the poll interval be one global env var, or configurable per org on the integration?
