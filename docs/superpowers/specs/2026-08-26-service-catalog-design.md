# Service Catalog and Request Fulfilment

**Date:** 2026-08-26
**Status:** Design — awaiting review (schema verified with `prisma validate`)
**Spans two repos:** `/root/projects/argus-itsm-frontend` (this one) and `/root/projects/argus-itsm/backend`

## Goal

Close the one ServiceNow ITSM pillar Argus does not have. Incident, Problem, Change, CMDB and
Knowledge all ship today; **Request Fulfilment and the Service Catalog do not** — there is no
route, no `use<Domain>` hook, and no Prisma model. This spec defines the data model, the API
contract and the frontend surface for that pillar.

Scope is deliberately the *fulfilment spine*: browse a catalog, submit a request, approve it,
work it, close it. Not in scope: catalog versioning, a workflow designer, cost/chargeback,
or a supplier catalog.

## Why this is a spec and not a branch

Both repos currently carry substantial uncommitted work on `razorpay-billing` (47 files here,
33 in the backend). Adding a greenfield feature on top of that would tangle two unrelated
changes in one working tree. The schema decisions below also need a human call before any
Prisma migration touches the `argus-postgres` dev database, which holds real seeded data.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Request shape | **Two-level: `Request` (REQ) -> `RequestItem` (RITM)** | Matches ServiceNow and the way people actually order: one submission, several items, each with its own approval and fulfiler. A flat model forces one request per item and makes "order a laptop and a phone" two unrelated tickets. |
| Catalog item form | **`variables Json` on `CatalogItem`, answers in `RequestItem.variables Json`** | Catalog forms are user-authored and change constantly; a typed column per field means a migration every time someone adds a dropdown. The schema already uses `Json` for `Problem.rootCauseAnalysis`. |
| Approvals | **New `RequestApproval` model, do not widen `Approval`** | `Approval.changeId` is required and non-nullable, and change-approval code reads it unconditionally. Making it optional to hang requests off it would silently weaken every existing change query. |
| Approval trigger | **Per `CatalogItem`, via `approvalRequired Boolean`** | Most catalog items (password reset, software access) need none. Gating at the item is one boolean; gating by rules engine is a project. |
| Fulfilment state | **`RequestItemState` enum on the item, `RequestState` derived on the parent** | The parent's state is a function of its items — a request is only `CLOSED_COMPLETE` when every item is. Storing it independently invites the two disagreeing. |
| Numbering | **`REQ` / `RITM`, org-scoped, allocated in a transaction** | See "Numbering" below — the existing generators have a race and leak volume across tenants. Do not copy them. |
| SLA | **Reuse `SLADefinition` keyed by catalog item** | Request SLAs are the same clock as incident SLAs. A second SLA engine is a second thing to get wrong. |

## Numbering

The existing generators in `src/utils/helpers.js` do a read-then-increment with no lock:

```js
const last = await prisma.incident.findFirst({ orderBy: { number: 'desc' }, ... });
const seq  = last ? parseInt(last.number.replace('INC', ''), 10) + 1 : 1;
```

Two concurrent creates read the same `last` and both write the same number, which collides on
the `@unique` constraint. The ordering is also global rather than per-organization, so gaps in a
tenant's sequence reveal other tenants' volume.

**This spec does not add a fourth copy of that.** Introduce a `Counter` table and allocate inside
the same transaction as the insert:

```prisma
model Counter {
  organizationId String
  kind           String   // "REQ" | "RITM" | later: INC, CHG, PRB
  value          Int      @default(0)
  @@id([organizationId, kind])
}
```

Allocation becomes an atomic `update ... { value: { increment: 1 } }` returning the new value.
Backfilling `INC`/`CHG`/`PRB` onto this is a follow-up, not a prerequisite.

## Schema

Additions to `prisma/schema.prisma`. Field style follows `Problem`: uuid PK, `number String @unique`,
nullable `organizationId` with an `Organization?` relation, `@@index` on state / number / org.

```prisma
model CatalogCategory {
  id             String  @id @default(uuid())
  name           String
  description    String?
  icon           String?
  sortOrder      Int     @default(0)
  active         Boolean @default(true)
  organizationId String?

  organization Organization? @relation(fields: [organizationId], references: [id])
  items        CatalogItem[]

  @@index([organizationId])
  @@index([active])
}

model CatalogItem {
  id               String   @id @default(uuid())
  name             String
  shortDescription String
  description      String?
  categoryId       String
  icon             String?
  approvalRequired Boolean  @default(false)
  approverId       String?
  fulfilmentTeamId String?
  slaDefinitionId  String?
  variables        Json?    // [{ name, label, type, required, options[] }]
  active           Boolean  @default(true)
  organizationId   String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  category       CatalogCategory @relation(fields: [categoryId], references: [id])
  approver       User?           @relation("CatalogApprover", fields: [approverId], references: [id])
  fulfilmentTeam Team?           @relation(fields: [fulfilmentTeamId], references: [id])
  organization   Organization?   @relation(fields: [organizationId], references: [id])
  requestItems   RequestItem[]

  @@index([categoryId])
  @@index([organizationId])
  @@index([active])
}

model Request {
  id             String       @id @default(uuid())
  number         String       @unique          // REQ0000001
  requestedForId String                        // who it is for
  createdById    String                        // who submitted it
  state          RequestState @default(SUBMITTED)
  organizationId String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  closedAt       DateTime?

  requestedFor User          @relation("RequestedFor", fields: [requestedForId], references: [id])
  createdBy    User          @relation("RequestCreator", fields: [createdById], references: [id])
  organization Organization? @relation(fields: [organizationId], references: [id])
  items        RequestItem[]
  activities   Activity[]

  @@index([state])
  @@index([number])
  @@index([organizationId])
  @@index([requestedForId])
}

model RequestItem {
  id               String           @id @default(uuid())
  number           String           @unique     // RITM0000001
  requestId        String
  catalogItemId    String
  state            RequestItemState @default(PENDING_APPROVAL)
  priority         Priority         @default(P4)
  assignedToId     String?
  fulfilmentTeamId String?
  variables        Json?            // the submitted answers
  quantity         Int              @default(1)
  slaBreached      Boolean          @default(false)
  dueAt            DateTime?
  closedAt         DateTime?
  closureNotes     String?
  organizationId   String?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  request        Request           @relation(fields: [requestId], references: [id], onDelete: Cascade)
  catalogItem    CatalogItem       @relation(fields: [catalogItemId], references: [id])
  assignedTo     User?             @relation("RequestItemAssignee", fields: [assignedToId], references: [id])
  fulfilmentTeam Team?             @relation(fields: [fulfilmentTeamId], references: [id])
  organization   Organization?     @relation(fields: [organizationId], references: [id])
  approvals      RequestApproval[]
  workNotes      WorkNote[]
  attachments    Attachment[]

  @@index([requestId])
  @@index([state])
  @@index([assignedToId])
  @@index([organizationId])
}

model RequestApproval {
  id            String        @id @default(uuid())
  requestItemId String
  approverId    String
  state         ApprovalState @default(PENDING)
  comments      String?
  approvedAt    DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  requestItem RequestItem @relation(fields: [requestItemId], references: [id], onDelete: Cascade)
  approver    User        @relation(fields: [approverId], references: [id])

  @@index([requestItemId])
  @@index([approverId])
}

enum RequestState {
  SUBMITTED
  IN_PROCESS
  CLOSED_COMPLETE
  CLOSED_INCOMPLETE
  CANCELLED
}

enum RequestItemState {
  PENDING_APPROVAL
  APPROVED
  REJECTED
  IN_PROCESS
  CLOSED_COMPLETE
  CLOSED_INCOMPLETE
  CANCELLED
}
```

### Back-relations required on existing models

Prisma requires **both sides** of every relation. The models above were validated against the
live `schema.prisma` with `prisma validate`, which rejected them with 14 errors until these
reverse fields were added. They are part of the change, not an afterthought:

```prisma
// model Organization
  catalogCategories CatalogCategory[]
  catalogItems      CatalogItem[]
  requests          Request[]
  requestItems      RequestItem[]

// model User
  catalogApprovals     CatalogItem[]     @relation("CatalogApprover")
  requestsRequestedFor Request[]         @relation("RequestedFor")
  requestsCreated      Request[]         @relation("RequestCreator")
  requestItemsAssigned RequestItem[]     @relation("RequestItemAssignee")
  requestApprovals     RequestApproval[]

// model Team
  catalogItems     CatalogItem[]
  requestItemsTeam RequestItem[]

// model WorkNote
  requestItemId String?
  requestItem   RequestItem? @relation(fields: [requestItemId], references: [id])

// model Attachment
  requestItemId String?
  requestItem   RequestItem? @relation(fields: [requestItemId], references: [id])

// model Activity
  requestId String?
  request   Request? @relation(fields: [requestId], references: [id])
```

With these in place the combined schema passes `prisma validate` cleanly. The `WorkNote` and
`Attachment` additions mirror how those models already hang off incidents and problems.

### Parent state derivation

`Request.state` is recomputed whenever any child item changes:

| Condition on items | Parent state |
| --- | --- |
| every item `CANCELLED` | `CANCELLED` |
| every item in a closed state, at least one `CLOSED_INCOMPLETE`/`REJECTED` | `CLOSED_INCOMPLETE` |
| every item `CLOSED_COMPLETE` | `CLOSED_COMPLETE` |
| any item past approval | `IN_PROCESS` |
| otherwise | `SUBMITTED` |

## API contract

All routes org-scoped by `req.tenantWhere`, envelope `{ data: ... }`, mounted under `/api/v1`.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| `GET` | `/catalog/categories` | any | Active categories with item counts |
| `GET` | `/catalog/items` | any | Browse/filter by `categoryId`, `q` |
| `GET` | `/catalog/items/:id` | any | Item detail incl. `variables` schema |
| `POST` | `/catalog/items` | ADMIN, MANAGER | Create a catalog item |
| `PATCH` | `/catalog/items/:id` | ADMIN, MANAGER | Edit / deactivate |
| `POST` | `/requests` | any | Submit `{ requestedForId?, items: [{ catalogItemId, quantity, variables }] }` |
| `GET` | `/requests` | any | Own requests; ADMIN/MANAGER see all |
| `GET` | `/requests/:id` | any | Request + items + approvals |
| `GET` | `/requests/items` | ENGINEER+ | Fulfilment queue, filter by state/assignee |
| `PATCH` | `/requests/items/:id` | ENGINEER+ | Assign, change state, close |
| `POST` | `/requests/items/:id/approve` | approver | Approve / reject with comments |
| `GET` | `/requests/stats` | any | Counts by state, top items, open by team |

`POST /requests` validates submitted `variables` against the catalog item's `variables` schema
and rejects on missing required fields — server-side, not just in the form.

## Frontend

Follows the repo's own conventions: one `use<Domain>` hook per domain, `cx-*` classes and
`PageChrome` primitives only, routes `lazy()` + `<Suspense>` in `App.tsx`, nav entries in
`Sidebar.tsx`.

| Route | Component | Nav group |
| --- | --- | --- |
| `/catalog` | `Catalog/CatalogBrowse.tsx` | Self-Service |
| `/catalog/:id` | `Catalog/CatalogItemForm.tsx` | — |
| `/requests` | `Requests/RequestList.tsx` | Self-Service |
| `/requests/:id` | `Requests/RequestDetail.tsx` | — |
| `/requests/queue` | `Requests/FulfilmentQueue.tsx` | Service delivery (ENGINEER+) |

New hooks `src/hooks/useCatalog.ts` and `src/hooks/useRequests.ts`. Both need entries in
`useRealtime.ts` — the invalidation key prefixes there are hardcoded string arrays, so the
event mapping has to be added at the same time or realtime silently misses requests.

### Dashboard

Once requests exist, the dashboard gains the widgets that were dropped from the ServiceNow-parity
pass for lack of data: open requests by state, and average fulfilment time. Both come from
`/requests/stats`.

## Also outstanding from the dashboard pass

Two backend gaps were identified while building the ServiceNow-parity dashboard and belong in
this same backend change:

- **MTTR** — `dashboard.controller.js` returns no resolution-duration aggregate, and
  `recentIncidents` does not select `resolvedAt`. An `avgResolutionMinutes` over the last 30 days
  would fill the KPI tile that is currently absent.
- **Change success rate** — only `activeChanges` is counted; there is no closed/successful split.

Unrelated but found in the same pass: **`backend/.env` sets `PORT=5001`, but the server binds
`5000`** — dotenv is not reaching the port. `vite.config.ts` proxies to `5001`, so following the
documented dev setup in both repos yields a proxy pointing at nothing.

## Open questions

1. **Requested-for.** Can a user submit on behalf of someone else on day one, or is every request
   self-service until an approval model for delegation exists? The schema supports it; the UI is
   simpler without it.
2. **Approver selection.** `approvalRequired` says *whether*, not *who*. Options: the requester's
   manager (needs a `managerId` on `User`, which does not exist), the fulfilment team's lead, or a
   fixed approver per catalog item. **This spec assumes a fixed `approverId` per item** as the
   smallest thing that works — say if you want manager-based instead.
3. **Counter backfill.** Migrate `INC`/`CHG`/`PRB` onto `Counter` in this change, or leave them on
   the racy generators and only use `Counter` for `REQ`/`RITM`?
4. **Seed data.** Ship a starter catalog (access request, hardware, software, onboarding) so the
   page is not empty on first load?
