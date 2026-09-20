# Razorpay Trial & Subscription Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every new organization a 20-day card-less trial, then let them subscribe to Starter (₹30,000/year, 10 billable seats) via Razorpay recurring subscriptions, dropping to read-only if they do not.

**Architecture:** The trial lives in our own schema — no Razorpay object exists until the customer upgrades. Access state is derived per request from `Subscription.status` + `trialEndsAt`, never stored as a flag. Razorpay webhooks are the authoritative source of subscription state; the browser callback only makes the UI feel instant. Enforcement is server-side middleware returning HTTP 402; the frontend merely reflects it.

**Tech Stack:** Backend — Node 20, Express 4, Prisma 5, PostgreSQL, `razorpay` SDK, Jest + supertest (CommonJS, no TypeScript). Frontend — React + Vite, TanStack Query, Zustand, Tailwind (`cx-*` component layer).

**Spec:** `docs/superpowers/specs/2026-08-13-razorpay-billing-design.md`

## Global Constraints

- Backend repo is `/root/projects/argus-itsm/backend`; frontend repo is `/root/projects/argus-itsm-frontend`. **Tasks 1–7 and 10 are backend; tasks 8–9 are frontend.**
- Backend is **CommonJS JavaScript** (`require`/`module.exports`). No TypeScript, no ESM.
- Backend file header style: a `// ═══` banner comment naming the module. **Branding: "WeCrew ITSM" only.** Never write "WeCrew" or "WeCrew" into any new or edited file, header, log line, string or comment — even though existing files contain them. Copy the banner *shape* from neighbours, not their product name.
- All money is **paise** (integers). Starter = `3000000` paise = ₹30,000. Currency `INR` only.
- Trial length is **20 days**. Trial seat cap **10**, Starter seat cap **10**.
- **Billable seat** = a `User` with `status: 'ACTIVE'` and `role != 'VIEWER'`.
- Backend response helpers are `success(res, data, status)` / `error(res, message, status)` from `src/utils/response.js` — match surrounding controllers.
- Auth middleware exports: `{ authenticate, authorize, checkPermission, optionalAuth }` from `src/middleware/auth.js`.
- Tenant middleware exports: `{ tenantContext, getCreateOrgId }` from `src/middleware/tenant.js`.
- Prisma client comes from `require('../config/database')` as `{ prisma }`.
- Frontend: use `cx-*` classes and `src/components/ui/PageChrome.tsx` primitives only. **Never** add `stone-*` or `text-white/60`-style utilities — they grow the legacy compatibility shim in `index.css`.
- Frontend verification is `npm run build` (typechecks) + `npm run lint`. There is no frontend test runner.
- **Backend verification is `npx jest` ONLY.** `npm run lint` cannot pass in the backend: `eslint` is
  installed but there is no config file and no `eslintConfig` key, so `eslint src/` errors out on
  any invocation. This is pre-existing and repo-wide — do not treat it as a regression, do not try
  to fix it inside a billing task, and do not gate a task on it. (Frontend lint works fine; tasks 8
  and 9 keep it.)
- **Never commit secrets.** `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` live only in the backend `.env`.

## Decision recorded during planning

`auth.controller.js:82` (`POST /api/v1/auth/signup`) currently creates a `User` with `role: 'VIEWER'` and **`organizationId: null`** — it creates no organization. A trial has nothing to attach to and nothing to bill.

**Task 2 changes signup to create an Organization and make the registrant its `ADMIN`.** This is required for self-serve trials to exist at all. It also means anyone with an email address can create an organization and become an admin *of that organization only* — tenant isolation via `tenantContext` still confines them to their own org, so this does not grant access to anyone else's data. If the product should instead be invite-only, stop and re-plan Task 2 before proceeding.

---

## File Structure

**Backend (`/root/projects/argus-itsm/backend`)**

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | Modify: add `PlanTier`, `SubscriptionStatus`, `Plan`, `Subscription`, `PaymentEvent`; `Organization.subscription` back-relation |
| `scripts/seed-plans.js` | Create: idempotent tier seed |
| `src/services/billing.service.js` | Create: trial creation, derived access state, seat counting — pure DB logic, no HTTP, no Razorpay |
| `src/services/razorpay.service.js` | Create: Razorpay SDK wrapper + both signature verifiers |
| `src/middleware/billing.middleware.js` | Create: `enforceWriteAccess`, `enforceSeatLimit` |
| `src/controllers/billing.controller.js` | Create: plans, subscription, subscribe, verify, cancel |
| `src/routes/billing.routes.js` | Create: authenticated billing routes |
| `src/routes/razorpayWebhook.routes.js` | Create: **unauthenticated, signature-verified** webhook |
| `src/controllers/auth.controller.js` | Modify: signup creates Organization + trial Subscription |
| `src/config/env.js` | Modify: `config.razorpay` block |
| `src/server.js` | Modify: mount webhook with raw body **before** `express.json()`; mount billing routes |
| `scripts/trial-reminders.js` | Create: day-15/19/21 reminder emails |

Billing logic is split deliberately: `billing.service.js` holds DB-only logic that is trivially unit-testable without mocking Razorpay, while `razorpay.service.js` isolates every call to the vendor SDK. The middleware and controller then contain almost no logic worth mocking.

**Frontend (`/root/projects/argus-itsm-frontend`)**

| File | Responsibility |
| --- | --- |
| `src/hooks/useBilling.ts` | Create: query/mutation hooks, `keys` factory |
| `src/lib/api.ts` | Modify: 402 handling before the 401 branch at line 48 |
| `src/components/Billing/BillingPage.tsx` | Create: plan cards, trial state, checkout trigger |
| `src/components/Billing/TrialBanner.tsx` | Create: days-remaining banner |
| `src/components/Layout/Layout.tsx` | Modify: render `TrialBanner` |
| `src/components/Layout/Sidebar.tsx` | Modify: Administration nav entry |
| `src/App.tsx` | Modify: lazy route `/billing` |
| `src/hooks/useRealtime.ts` | Modify: `subscription:updated` → invalidate `['billing']` |

---

## Task 1: Schema, migration, and plan seed

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `scripts/seed-plans.js`

**Interfaces:**
- Consumes: nothing
- Produces: Prisma models `Plan`, `Subscription`, `PaymentEvent`; enums `PlanTier` (`TRIAL|STARTER|ENTERPRISE`), `SubscriptionStatus` (`TRIALING|ACTIVE|PAST_DUE|HALTED|CANCELLED|EXPIRED`)

- [ ] **Step 1: Add enums and models to `prisma/schema.prisma`**

Append after the existing `enum Environment` block:

```prisma
enum PlanTier {
  TRIAL
  STARTER
  ENTERPRISE
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  HALTED
  CANCELLED
  EXPIRED
}
```

Append at the end of the file:

```prisma
model Plan {
  id             String   @id @default(uuid())
  tier           PlanTier @unique
  name           String
  description    String?
  razorpayPlanId String?  @unique
  amount         Int?
  currency       String   @default("INR")
  period         String   @default("yearly")
  seatLimit      Int
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model Subscription {
  id                     String             @id @default(uuid())
  organizationId         String             @unique
  organization           Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  tier                   PlanTier           @default(TRIAL)
  status                 SubscriptionStatus @default(TRIALING)
  seatLimit              Int                @default(10)
  trialStartedAt         DateTime           @default(now())
  trialEndsAt            DateTime
  razorpaySubscriptionId String?            @unique
  razorpayCustomerId     String?
  razorpayPlanId         String?
  currentPeriodEnd       DateTime?
  cancelledAt            DateTime?
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  @@index([status])
  @@index([trialEndsAt])
}

model PaymentEvent {
  id              String    @id @default(uuid())
  razorpayEventId String    @unique
  event           String
  organizationId  String?
  payload         Json
  processedAt     DateTime?
  createdAt       DateTime  @default(now())

  @@index([event])
}
```

Add the back-relation inside the existing `model Organization` block, alongside `slackIntegrations`:

```prisma
  subscription       Subscription?
```

- [ ] **Step 2: Generate and apply the migration**

```bash
cd /root/projects/argus-itsm/backend
npx prisma migrate dev --name add_billing_subscription
```

Expected: migration created and applied, `prisma generate` runs automatically.

- [ ] **Step 3: Write the seed script**

Create `scripts/seed-plans.js`:

```js
// ═══════════════════════════════════════════════════════════
// Seed billing tiers. Idempotent — safe to re-run on deploy.
//
// razorpayPlanId is read from env because the Razorpay plan must be
// created in the dashboard first; without it, STARTER cannot be checked out.
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TIERS = [
  { tier: 'TRIAL', name: 'Trial', amount: null, seatLimit: 10, period: 'none',
    description: '20-day free trial. No card required.', razorpayPlanId: null },
  { tier: 'STARTER', name: 'Starter', amount: 3000000, seatLimit: 10, period: 'yearly',
    description: '10 agent seats. Unlimited viewers.',
    razorpayPlanId: process.env.RAZORPAY_STARTER_PLAN_ID || null },
  { tier: 'ENTERPRISE', name: 'Enterprise', amount: null, seatLimit: 9999, period: 'yearly',
    description: 'Custom seats and terms. Talk to sales.', razorpayPlanId: null },
];

async function main() {
  for (const t of TIERS) {
    await prisma.plan.upsert({
      where: { tier: t.tier },
      update: { name: t.name, amount: t.amount, seatLimit: t.seatLimit,
                period: t.period, description: t.description, razorpayPlanId: t.razorpayPlanId },
      create: t,
    });
    console.log(`[seed] ${t.tier}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Run the seed and verify**

```bash
node scripts/seed-plans.js
npx prisma studio   # confirm 3 Plan rows; or query directly
```

Expected: three rows printed, `STARTER.amount = 3000000`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations scripts/seed-plans.js
git commit -m "feat(billing): add Plan, Subscription, PaymentEvent models and tier seed"
```

---

## Task 2: Signup creates an Organization with a trial

**Files:**
- Create: `src/services/billing.service.js`
- Modify: `src/controllers/auth.controller.js:82-116` (the `signup` function)
- Test: `src/services/__tests__/billing.service.test.js`

**Interfaces:**
- Consumes: Task 1 models
- Produces:
  - `startTrial(prismaOrTx, organizationId)` → `Promise<Subscription>`
  - `getAccessState(organizationId)` → `Promise<{tier, status, isReadOnly, daysRemaining, trialEndsAt, seatsUsed, seatLimit, currentPeriodEnd}>`
  - `countBillableSeats(organizationId)` → `Promise<number>`
  - `TRIAL_DAYS` = `20`

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/billing.service.test.js`:

```js
const mockPrisma = {
  subscription: { create: jest.fn(), findUnique: jest.fn() },
  user: { count: jest.fn() },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));

const { startTrial, getAccessState, countBillableSeats, TRIAL_DAYS } = require('../billing.service');

beforeEach(() => jest.clearAllMocks());

describe('startTrial', () => {
  it('creates a TRIALING subscription ending 20 days out', async () => {
    mockPrisma.subscription.create.mockResolvedValue({ id: 's1' });
    await startTrial(mockPrisma, 'org1');

    const arg = mockPrisma.subscription.create.mock.calls[0][0].data;
    expect(arg.organizationId).toBe('org1');
    expect(arg.tier).toBe('TRIAL');
    expect(arg.status).toBe('TRIALING');
    expect(arg.seatLimit).toBe(10);

    const days = Math.round((arg.trialEndsAt - Date.now()) / 86400000);
    expect(days).toBe(TRIAL_DAYS);
  });
});

describe('countBillableSeats', () => {
  it('counts ACTIVE non-VIEWER users only', async () => {
    mockPrisma.user.count.mockResolvedValue(4);
    const n = await countBillableSeats('org1');
    expect(n).toBe(4);
    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { organizationId: 'org1', status: 'ACTIVE', role: { not: 'VIEWER' } },
    });
  });
});

describe('getAccessState', () => {
  it('is read-only when the trial has expired', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      tier: 'TRIAL', status: 'TRIALING', seatLimit: 10,
      trialEndsAt: new Date(Date.now() - 86400000), currentPeriodEnd: null,
    });
    mockPrisma.user.count.mockResolvedValue(2);

    const s = await getAccessState('org1');
    expect(s.isReadOnly).toBe(true);
    expect(s.daysRemaining).toBe(0);
  });

  it('is writable during an active trial', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      tier: 'TRIAL', status: 'TRIALING', seatLimit: 10,
      trialEndsAt: new Date(Date.now() + 5 * 86400000), currentPeriodEnd: null,
    });
    mockPrisma.user.count.mockResolvedValue(2);

    const s = await getAccessState('org1');
    expect(s.isReadOnly).toBe(false);
    expect(s.daysRemaining).toBe(5);
  });

  it('is writable when ACTIVE regardless of trialEndsAt', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      tier: 'STARTER', status: 'ACTIVE', seatLimit: 10,
      trialEndsAt: new Date(Date.now() - 90 * 86400000),
      currentPeriodEnd: new Date(Date.now() + 300 * 86400000),
    });
    mockPrisma.user.count.mockResolvedValue(7);

    const s = await getAccessState('org1');
    expect(s.isReadOnly).toBe(false);
  });

  it('is read-only when HALTED', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      tier: 'STARTER', status: 'HALTED', seatLimit: 10,
      trialEndsAt: new Date(Date.now() - 90 * 86400000), currentPeriodEnd: null,
    });
    mockPrisma.user.count.mockResolvedValue(7);

    expect((await getAccessState('org1')).isReadOnly).toBe(true);
  });

  it('grants access when an org has no subscription row', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    const s = await getAccessState('org1');
    expect(s.isReadOnly).toBe(false);
    expect(s.status).toBe('NONE');
  });
});
```

The last case matters: organizations created before this feature have no `Subscription` row. Failing open for them prevents a deploy from instantly locking out every existing paying customer. Failing closed here would be an outage.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /root/projects/argus-itsm/backend
npx jest src/services/__tests__/billing.service.test.js
```

Expected: FAIL — `Cannot find module '../billing.service'`.

- [ ] **Step 3: Implement `billing.service.js`**

```js
// ═══════════════════════════════════════════════════════════
// Argus ITSM — Billing service (DB-only)
//
// Access state is DERIVED on every call, never stored. A stored flag
// flipped by a cron means one missed run silently gives expired orgs
// free product — invisible until someone audits revenue.
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');

const TRIAL_DAYS = 20;
const TRIAL_SEATS = 10;
const DAY_MS = 86400000;

async function startTrial(client, organizationId) {
  return client.subscription.create({
    data: {
      organizationId,
      tier: 'TRIAL',
      status: 'TRIALING',
      seatLimit: TRIAL_SEATS,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * DAY_MS),
    },
  });
}

function countBillableSeats(organizationId) {
  return prisma.user.count({
    where: { organizationId, status: 'ACTIVE', role: { not: 'VIEWER' } },
  });
}

async function getAccessState(organizationId) {
  const sub = await prisma.subscription.findUnique({ where: { organizationId } });

  // Pre-existing orgs have no Subscription row. Fail OPEN — failing closed
  // would lock out every legacy customer the moment this deploys.
  if (!sub) {
    return {
      tier: 'NONE', status: 'NONE', isReadOnly: false, daysRemaining: null,
      trialEndsAt: null, currentPeriodEnd: null, seatsUsed: 0, seatLimit: null,
    };
  }

  const now = Date.now();
  const trialExpired = sub.status === 'TRIALING' && sub.trialEndsAt.getTime() < now;
  const periodExpired = sub.status === 'CANCELLED'
    && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() < now);

  const isReadOnly = trialExpired
    || sub.status === 'HALTED'
    || sub.status === 'EXPIRED'
    || periodExpired;

  const daysRemaining = sub.status === 'TRIALING'
    ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now) / DAY_MS))
    : null;

  return {
    tier: sub.tier,
    status: sub.status,
    isReadOnly,
    daysRemaining,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
    seatsUsed: await countBillableSeats(organizationId),
    seatLimit: sub.seatLimit,
  };
}

module.exports = { startTrial, getAccessState, countBillableSeats, TRIAL_DAYS, TRIAL_SEATS };
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/services/__tests__/billing.service.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Change signup to create an Organization**

In `src/controllers/auth.controller.js`, replace the body of `signup` between the duplicate-email check and the token generation. Add `const { startTrial } = require('../services/billing.service');` to the imports at the top.

```js
    const { email, password, firstName, lastName, phone, companyName } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error(res, 'An account with this email already exists', 409);

    const baseSlug = String(companyName || `${firstName}-${lastName}`)
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
      || 'org';

    // Organization.name and .slug are both @unique — suffix until free.
    let slug = baseSlug;
    let orgName = companyName || `${firstName} ${lastName}`;
    for (let i = 2; await prisma.organization.findFirst({
      where: { OR: [{ slug }, { name: orgName }] } }); i += 1) {
      slug = `${baseSlug}-${i}`;
      orgName = `${companyName || `${firstName} ${lastName}`} (${i})`;
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // One transaction: an org without a trial, or a user without an org,
    // are both broken states that would need manual repair.
    const { user, organization } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: orgName, slug } });
      await startTrial(tx, org.id);
      const u = await tx.user.create({
        data: {
          email, password: hashed, firstName, lastName, phone: phone || null,
          role: 'ADMIN', status: 'ACTIVE', organizationId: org.id,
        },
        select: { id: true, email: true, firstName: true, lastName: true,
                  role: true, organizationId: true, createdAt: true },
      });
      return { user: u, organization: org };
    });
```

Then update the response payload at the end of `signup` to return the real org instead of `null`:

```js
    return success(res, {
      accessToken, refreshToken, expiresIn: process.env.JWT_EXPIRY || '15m',
      user: { id: user.id, email: user.email, firstName: user.firstName,
              lastName: user.lastName, role: user.role, avatar: null,
              organizationId: user.organizationId },
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
    }, 201);
```

- [ ] **Step 6: Add `companyName` validation to the signup route**

In `src/routes/auth.routes.js`, find the `POST /signup` validator array and add:

```js
  body('companyName').optional().trim().isLength({ min: 2, max: 100 }),
```

- [ ] **Step 7: Verify signup end to end**

```bash
npm run dev   # in another shell
curl -sS -X POST http://localhost:5001/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"trial1@example.com","password":"Passw0rd!23","firstName":"Test","lastName":"User","companyName":"Acme Test"}' | jq
```

Expected: `201`, `user.role === "ADMIN"`, `user.organizationId` non-null, `organization.slug === "acme-test"`.
Then confirm the trial exists:

```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.subscription.findMany().then(r=>{console.log(r);return p.\$disconnect()})"
```

Expected: one row, `tier: 'TRIAL'`, `status: 'TRIALING'`, `trialEndsAt` ≈ 20 days out.

- [ ] **Step 8: Commit**

```bash
git add src/services/billing.service.js src/services/__tests__/billing.service.test.js \
        src/controllers/auth.controller.js src/routes/auth.routes.js
git commit -m "feat(billing): signup creates an organization with a 20-day trial"
```

---

## Task 3: Razorpay service and signature verification

**Files:**
- Create: `src/services/razorpay.service.js`
- Test: `src/services/__tests__/razorpay.service.test.js`
- Modify: `src/config/env.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `verifySubscriptionSignature({paymentId, subscriptionId, signature})` → `boolean`
  - `verifyWebhookSignature(rawBody, signature)` → `boolean`
  - `createSubscription({planId, organizationId, customerNotify})` → `Promise<{id, short_url, status}>`
  - `createCustomer({name, email, contact})` → `Promise<{id}>`
  - `cancelSubscription(subscriptionId, cancelAtCycleEnd)` → `Promise<object>`
  - `getKeyId()` → `string`

- [ ] **Step 1: Install the SDK**

```bash
cd /root/projects/argus-itsm/backend
npm install razorpay@^2.9.4
```

- [ ] **Step 2: Add config to `src/config/env.js`**

Insert a `razorpay` block alongside the existing `twilio` block:

```js
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    starterPlanId: process.env.RAZORPAY_STARTER_PLAN_ID,
  },
```

Do **not** add these to the `REQUIRED` array — the server must still boot without billing configured, so unrelated environments do not crash.

- [ ] **Step 3: Write the failing test**

Create `src/services/__tests__/razorpay.service.test.js`:

```js
const crypto = require('crypto');

jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({
  customers: { create: jest.fn() },
  subscriptions: { create: jest.fn(), cancel: jest.fn() },
})));

jest.mock('../../config/env', () => ({
  config: { razorpay: { keyId: 'rzp_test_key', keySecret: 'secret123', webhookSecret: 'whsec456' } },
}));

const { verifySubscriptionSignature, verifyWebhookSignature } = require('../razorpay.service');

const sign = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

describe('verifySubscriptionSignature', () => {
  const paymentId = 'pay_IDZNwZZFtnjyym';
  const subscriptionId = 'sub_ID6MOhgkcoHj9I';

  it('accepts payment_id|subscription_id — NOT the orders order_id|payment_id form', () => {
    const good = sign(`${paymentId}|${subscriptionId}`, 'secret123');
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: good })).toBe(true);
  });

  it('rejects the reversed (orders-style) concatenation', () => {
    const wrong = sign(`${subscriptionId}|${paymentId}`, 'secret123');
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: wrong })).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const wrong = sign(`${paymentId}|${subscriptionId}`, 'not-the-secret');
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: wrong })).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: 'zz' })).toBe(false);
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: '' })).toBe(false);
    expect(verifySubscriptionSignature({ paymentId, subscriptionId })).toBe(false);
  });
});

describe('verifyWebhookSignature', () => {
  const raw = Buffer.from(JSON.stringify({ event: 'subscription.charged' }));

  it('accepts a correctly signed raw body', () => {
    expect(verifyWebhookSignature(raw, sign(raw, 'whsec456'))).toBe(true);
  });

  it('rejects a body signed with the payment key secret', () => {
    expect(verifyWebhookSignature(raw, sign(raw, 'secret123'))).toBe(false);
  });

  it('rejects a tampered body', () => {
    const good = sign(raw, 'whsec456');
    expect(verifyWebhookSignature(Buffer.from('{"event":"evil"}'), good)).toBe(false);
  });
});
```

The reversed-concatenation test is the point of this file. The Standard Checkout docs show only the orders form (`order_id|payment_id`); subscriptions use `payment_id|subscription_id`. Getting it backwards produces a verifier that rejects every genuine payment, and the symptom — "customers pay and nothing happens" — looks like a webhook problem, not a signature one.

- [ ] **Step 4: Run the test to verify it fails**

```bash
npx jest src/services/__tests__/razorpay.service.test.js
```

Expected: FAIL — `Cannot find module '../razorpay.service'`.

- [ ] **Step 5: Implement `razorpay.service.js`**

```js
// ═══════════════════════════════════════════════════════════
// Argus ITSM — Razorpay wrapper
//
// Subscriptions and Orders sign DIFFERENT, REVERSED payloads:
//   orders:        hmac(order_id + '|' + payment_id)
//   subscriptions: hmac(payment_id + '|' + subscription_id)
// Verified against razorpay-node/lib/utils/razorpay-utils.js.
// The public Standard Checkout doc shows only the orders form.
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const Razorpay = require('razorpay');
const { config } = require('../config/env');

let client = null;
function getClient() {
  if (!client) {
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
    }
    client = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return client;
}

function getKeyId() {
  return config.razorpay.keyId;
}

/** Constant-time compare that never throws on malformed hex. */
function safeEqual(expected, received) {
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
  } catch {
    return false;
  }
}

function verifySubscriptionSignature({ paymentId, subscriptionId, signature }) {
  if (!paymentId || !subscriptionId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!rawBody || !signature || !config.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return safeEqual(expected, signature);
}

async function createCustomer({ name, email, contact }) {
  return getClient().customers.create({
    name, email, contact: contact || undefined, fail_existing: 0,
  });
}

async function createSubscription({ planId, organizationId, customerNotify = 1 }) {
  return getClient().subscriptions.create({
    plan_id: planId,
    total_count: 10,          // 10 yearly cycles
    quantity: 1,              // flat tier — never per-seat
    customer_notify: customerNotify,
    notes: { organizationId }, // lets the webhook find the org before we persist the id
  });
}

async function cancelSubscription(subscriptionId, cancelAtCycleEnd = true) {
  return getClient().subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}

module.exports = {
  getKeyId, verifySubscriptionSignature, verifyWebhookSignature,
  createCustomer, createSubscription, cancelSubscription,
};
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx jest src/services/__tests__/razorpay.service.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/config/env.js \
        src/services/razorpay.service.js src/services/__tests__/razorpay.service.test.js
git commit -m "feat(billing): add Razorpay client wrapper with subscription and webhook signature verification"
```

---

## Task 4: Access-enforcement middleware

**Files:**
- Create: `src/middleware/billing.middleware.js`
- Test: `src/middleware/__tests__/billing.middleware.test.js`

**Interfaces:**
- Consumes: `getAccessState`, `countBillableSeats` from Task 2
- Produces: `enforceWriteAccess(req,res,next)`, `enforceSeatLimit(req,res,next)`

- [ ] **Step 1: Write the failing test**

Create `src/middleware/__tests__/billing.middleware.test.js`:

```js
const mockGetAccessState = jest.fn();
const mockCountBillableSeats = jest.fn();

jest.mock('../../services/billing.service', () => ({
  getAccessState: (...a) => mockGetAccessState(...a),
  countBillableSeats: (...a) => mockCountBillableSeats(...a),
}));
jest.mock('../../config/database', () => ({
  prisma: { subscription: { findUnique: jest.fn() } },
}));

const { enforceWriteAccess, enforceSeatLimit } = require('../billing.middleware');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('enforceWriteAccess', () => {
  it('passes GET requests through even when read-only', async () => {
    const next = jest.fn();
    await enforceWriteAccess({ method: 'GET', path: '/incidents', user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(mockGetAccessState).not.toHaveBeenCalled();
  });

  it('blocks POST with 402 when read-only', async () => {
    mockGetAccessState.mockResolvedValue({ isReadOnly: true, status: 'TRIALING' });
    const res = mockRes(); const next = jest.fn();
    await enforceWriteAccess({ method: 'POST', path: '/incidents', user: { organizationId: 'o1' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json.mock.calls[0][0].code).toBe('SUBSCRIPTION_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('allows POST /billing even when read-only', async () => {
    mockGetAccessState.mockResolvedValue({ isReadOnly: true, status: 'TRIALING' });
    const next = jest.fn();
    await enforceWriteAccess({ method: 'POST', path: '/billing/subscribe', user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('allows POST when not read-only', async () => {
    mockGetAccessState.mockResolvedValue({ isReadOnly: false });
    const next = jest.fn();
    await enforceWriteAccess({ method: 'POST', path: '/incidents', user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through when the user has no organization', async () => {
    const next = jest.fn();
    await enforceWriteAccess({ method: 'POST', path: '/incidents', user: { organizationId: null } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('enforceSeatLimit', () => {
  it('blocks a billable role at the cap', async () => {
    mockGetAccessState.mockResolvedValue({ seatsUsed: 10, seatLimit: 10 });
    const res = mockRes(); const next = jest.fn();
    await enforceSeatLimit({ body: { role: 'ENGINEER' }, user: { organizationId: 'o1' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json.mock.calls[0][0].code).toBe('SEAT_LIMIT_REACHED');
  });

  it('allows a VIEWER at the cap — viewers are free', async () => {
    mockGetAccessState.mockResolvedValue({ seatsUsed: 10, seatLimit: 10 });
    const next = jest.fn();
    await enforceSeatLimit({ body: { role: 'VIEWER' }, user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('allows a billable role below the cap', async () => {
    mockGetAccessState.mockResolvedValue({ seatsUsed: 3, seatLimit: 10 });
    const next = jest.fn();
    await enforceSeatLimit({ body: { role: 'ENGINEER' }, user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/middleware/__tests__/billing.middleware.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `billing.middleware.js`**

```js
// ═══════════════════════════════════════════════════════════
// Argus ITSM — Billing enforcement
//
// 402 Payment Required is the wire signal for "subscription lapsed".
// The frontend keys its upgrade prompt off this status, so do not
// change it to 403 — 403 is indistinguishable from an RBAC denial.
// ═══════════════════════════════════════════════════════════

const { getAccessState } = require('../services/billing.service');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Billing and auth must stay reachable while locked out, or the customer
// cannot reach the page that takes their money.
const EXEMPT = [/^\/billing/, /^\/auth/, /^\/webhooks/, /^\/public/, /^\/status/];

async function enforceWriteAccess(req, res, next) {
  try {
    if (!WRITE_METHODS.has(req.method)) return next();
    if (EXEMPT.some((re) => re.test(req.path))) return next();

    const orgId = req.user && req.user.organizationId;
    if (!orgId) return next(); // no tenant — nothing to bill

    const state = await getAccessState(orgId);
    if (!state.isReadOnly) return next();

    return res.status(402).json({
      success: false,
      error: state.status === 'TRIALING'
        ? 'Your 20-day trial has ended. Subscribe to continue making changes.'
        : 'Your subscription is inactive. Renew to continue making changes.',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  } catch (err) { return next(err); }
}

async function enforceSeatLimit(req, res, next) {
  try {
    const orgId = req.user && req.user.organizationId;
    if (!orgId) return next();

    const role = req.body && req.body.role;
    if (role === 'VIEWER') return next(); // viewers are free and uncapped

    const state = await getAccessState(orgId);
    if (state.seatLimit == null) return next();

    if (state.seatsUsed >= state.seatLimit) {
      return res.status(402).json({
        success: false,
        error: `Your plan includes ${state.seatLimit} agent seats and all are in use. `
             + 'Upgrade, or add the user as a Viewer (Viewers are free and unlimited).',
        code: 'SEAT_LIMIT_REACHED',
      });
    }
    return next();
  } catch (err) { return next(err); }
}

module.exports = { enforceWriteAccess, enforceSeatLimit };
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/middleware/__tests__/billing.middleware.test.js
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/middleware/billing.middleware.js src/middleware/__tests__/billing.middleware.test.js
git commit -m "feat(billing): add 402 write-access and seat-limit enforcement middleware"
```

---

## Task 5: Billing controller and routes

**Files:**
- Create: `src/controllers/billing.controller.js`, `src/routes/billing.routes.js`
- Test: `src/routes/__tests__/billing.routes.test.js`

**Interfaces:**
- Consumes: Tasks 2 and 3
- Produces: `GET /plans`, `GET /subscription`, `POST /subscribe`, `POST /verify`, `POST /cancel`

- [ ] **Step 1: Write the failing test**

Create `src/routes/__tests__/billing.routes.test.js`:

```js
const express = require('express');
const request = require('supertest');

const mockPrisma = {
  plan: { findMany: jest.fn(), findUnique: jest.fn() },
  subscription: { findUnique: jest.fn(), update: jest.fn() },
  organization: { findUnique: jest.fn() },
};
const mockRzp = {
  createCustomer: jest.fn(), createSubscription: jest.fn(),
  cancelSubscription: jest.fn(), verifySubscriptionSignature: jest.fn(),
  getKeyId: jest.fn(() => 'rzp_test_key'),
};

jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../services/razorpay.service', () => mockRzp);
jest.mock('../../services/billing.service', () => ({
  getAccessState: jest.fn(async () => ({
    tier: 'TRIAL', status: 'TRIALING', isReadOnly: false,
    daysRemaining: 12, seatsUsed: 3, seatLimit: 10,
  })),
}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

// authenticate is replaced with a stub that injects a fixed admin user.
jest.mock('../../middleware/auth', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B',
                 role: 'ADMIN', organizationId: 'org1' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
  checkPermission: () => (_req, _res, next) => next(),
}));

function buildApp() {
  jest.resetModules();
  const routes = require('../billing.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/billing', routes);
  return app;
}

beforeEach(() => jest.clearAllMocks());

it('GET /plans returns active tiers', async () => {
  mockPrisma.plan.findMany.mockResolvedValue([
    { tier: 'STARTER', name: 'Starter', amount: 3000000, seatLimit: 10 },
  ]);
  const res = await request(buildApp()).get('/api/v1/billing/plans');
  expect(res.status).toBe(200);
  expect(res.body.data[0].amount).toBe(3000000);
});

it('GET /subscription returns derived access state', async () => {
  const res = await request(buildApp()).get('/api/v1/billing/subscription');
  expect(res.status).toBe(200);
  expect(res.body.data.daysRemaining).toBe(12);
});

it('POST /subscribe rejects a tier with no Razorpay plan id', async () => {
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'ENTERPRISE', razorpayPlanId: null });
  const res = await request(buildApp()).post('/api/v1/billing/subscribe').send({ tier: 'ENTERPRISE' });
  expect(res.status).toBe(400);
  expect(mockRzp.createSubscription).not.toHaveBeenCalled();
});

it('POST /subscribe creates a subscription and returns the key id', async () => {
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'STARTER', razorpayPlanId: 'plan_x', seatLimit: 10 });
  mockPrisma.subscription.findUnique.mockResolvedValue({ id: 's1', organizationId: 'org1', razorpayCustomerId: null });
  mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1', name: 'Acme' });
  mockRzp.createCustomer.mockResolvedValue({ id: 'cust_1' });
  mockRzp.createSubscription.mockResolvedValue({ id: 'sub_1', short_url: 'https://rzp.io/i/x', status: 'created' });

  const res = await request(buildApp()).post('/api/v1/billing/subscribe').send({ tier: 'STARTER' });
  expect(res.status).toBe(200);
  expect(res.body.data.subscriptionId).toBe('sub_1');
  expect(res.body.data.keyId).toBe('rzp_test_key');
  expect(mockRzp.createSubscription).toHaveBeenCalledWith(
    expect.objectContaining({ planId: 'plan_x', organizationId: 'org1' }));
});

it('POST /verify rejects a bad signature and does not activate', async () => {
  mockRzp.verifySubscriptionSignature.mockReturnValue(false);
  const res = await request(buildApp()).post('/api/v1/billing/verify').send({
    razorpay_payment_id: 'pay_1', razorpay_subscription_id: 'sub_1', razorpay_signature: 'bad',
  });
  expect(res.status).toBe(400);
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
});

it('POST /verify activates on a good signature', async () => {
  mockRzp.verifySubscriptionSignature.mockReturnValue(true);
  mockPrisma.subscription.findUnique.mockResolvedValue({ id: 's1', organizationId: 'org1', razorpaySubscriptionId: 'sub_1' });
  mockPrisma.subscription.update.mockResolvedValue({ id: 's1', status: 'ACTIVE' });

  const res = await request(buildApp()).post('/api/v1/billing/verify').send({
    razorpay_payment_id: 'pay_1', razorpay_subscription_id: 'sub_1', razorpay_signature: 'good',
  });
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update.mock.calls[0][0].data.status).toBe('ACTIVE');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/routes/__tests__/billing.routes.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `billing.controller.js`**

```js
// ═══════════════════════════════════════════════════════════
// Argus ITSM — Billing controller
//
// /verify is a UX nicety only. The webhook is authoritative:
// a customer who closes the tab mid-redirect has still paid.
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { getAccessState } = require('../services/billing.service');
const rzp = require('../services/razorpay.service');

async function listPlans(_req, res, next) {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { amount: 'asc' },
      select: { tier: true, name: true, description: true, amount: true,
                currency: true, period: true, seatLimit: true },
    });
    return success(res, plans);
  } catch (err) { next(err); }
}

async function getSubscription(req, res, next) {
  try {
    if (!req.user.organizationId) return error(res, 'No organization on this account', 400);
    return success(res, await getAccessState(req.user.organizationId));
  } catch (err) { next(err); }
}

async function subscribe(req, res, next) {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) return error(res, 'No organization on this account', 400);

    const { tier } = req.body;
    const plan = await prisma.plan.findUnique({ where: { tier } });
    if (!plan) return error(res, 'Unknown plan tier', 400);
    if (!plan.razorpayPlanId) {
      return error(res, 'This plan is not available for self-serve checkout. Contact sales.', 400);
    }

    const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!sub) return error(res, 'No subscription record for this organization', 404);

    let customerId = sub.razorpayCustomerId;
    if (!customerId) {
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const customer = await rzp.createCustomer({
        name: org.name,
        email: req.user.email,
        contact: req.user.phone || undefined,
      });
      customerId = customer.id;
    }

    const created = await rzp.createSubscription({
      planId: plan.razorpayPlanId,
      organizationId: orgId,
    });

    await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        razorpaySubscriptionId: created.id,
        razorpayCustomerId: customerId,
        razorpayPlanId: plan.razorpayPlanId,
      },
    });

    logger.info(`[billing] subscription ${created.id} created for org ${orgId} (${tier})`);

    return success(res, {
      subscriptionId: created.id,
      shortUrl: created.short_url,
      keyId: rzp.getKeyId(),
      tier: plan.tier,
      amount: plan.amount,
      currency: plan.currency,
    });
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const {
      razorpay_payment_id: paymentId,
      razorpay_subscription_id: subscriptionId,
      razorpay_signature: signature,
    } = req.body;

    if (!rzp.verifySubscriptionSignature({ paymentId, subscriptionId, signature })) {
      logger.warn(`[billing] signature verification FAILED for subscription ${subscriptionId}`);
      return error(res, 'Payment verification failed', 400);
    }

    const sub = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
    });
    if (!sub || sub.razorpaySubscriptionId !== subscriptionId) {
      return error(res, 'Subscription does not belong to this organization', 403);
    }

    const plan = await prisma.plan.findUnique({ where: { razorpayPlanId: sub.razorpayPlanId } });

    // Optimistic. subscription.activated from the webhook is the real transition.
    const updated = await prisma.subscription.update({
      where: { organizationId: req.user.organizationId },
      data: {
        status: 'ACTIVE',
        tier: plan ? plan.tier : sub.tier,
        seatLimit: plan ? plan.seatLimit : sub.seatLimit,
      },
    });

    logger.info(`[billing] org ${req.user.organizationId} activated via checkout callback`);
    return success(res, { status: updated.status });
  } catch (err) { next(err); }
}

async function cancel(req, res, next) {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
    });
    if (!sub || !sub.razorpaySubscriptionId) return error(res, 'No active subscription', 404);

    await rzp.cancelSubscription(sub.razorpaySubscriptionId, true);
    await prisma.subscription.update({
      where: { organizationId: req.user.organizationId },
      data: { cancelledAt: new Date() },
    });

    logger.info(`[billing] org ${req.user.organizationId} cancelled at cycle end`);
    return success(res, { cancelled: true, accessUntil: sub.currentPeriodEnd });
  } catch (err) { next(err); }
}

module.exports = { listPlans, getSubscription, subscribe, verify, cancel };
```

- [ ] **Step 4: Implement `billing.routes.js`**

```js
// ═══════════════════════════════════════════════════════════
// Argus ITSM — Billing Routes
// Mounted at /api/v1/billing. Exempt from enforceWriteAccess so a
// locked-out org can still reach checkout.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const ctrl = require('../controllers/billing.controller');

router.use(authenticate);

router.get('/plans', ctrl.listPlans);
router.get('/subscription', ctrl.getSubscription);

router.post('/subscribe', authorize('ADMIN'), [
  body('tier').isIn(['STARTER', 'ENTERPRISE']),
  validate,
], ctrl.subscribe);

router.post('/verify', authorize('ADMIN'), [
  body('razorpay_payment_id').isString().notEmpty(),
  body('razorpay_subscription_id').isString().notEmpty(),
  body('razorpay_signature').isString().notEmpty(),
  validate,
], ctrl.verify);

router.post('/cancel', authorize('ADMIN'), ctrl.cancel);

module.exports = router;
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest src/routes/__tests__/billing.routes.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/controllers/billing.controller.js src/routes/billing.routes.js \
        src/routes/__tests__/billing.routes.test.js
git commit -m "feat(billing): add billing controller and routes"
```

---

## Task 6: Razorpay webhook with raw body and idempotency

**Files:**
- Create: `src/routes/razorpayWebhook.routes.js`
- Test: `src/routes/__tests__/razorpayWebhook.routes.test.js`

**Interfaces:**
- Consumes: `verifyWebhookSignature` from Task 3
- Produces: `POST /api/v1/webhooks/razorpay`

- [ ] **Step 1: Write the failing test**

Create `src/routes/__tests__/razorpayWebhook.routes.test.js`:

```js
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

const mockPrisma = {
  paymentEvent: { create: jest.fn(), update: jest.fn() },
  subscription: { findFirst: jest.fn(), update: jest.fn() },
  plan: { findUnique: jest.fn() },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../services/razorpay.service', () => ({
  verifyWebhookSignature: (raw, sig) =>
    crypto.createHmac('sha256', 'whsec456').update(raw).digest('hex') === sig,
}));

function buildApp() {
  jest.resetModules();
  const routes = require('../razorpayWebhook.routes');
  const app = express();
  app.use('/api/v1/webhooks', routes);   // router supplies its own raw parser
  return app;
}

const send = (app, payload, secret = 'whsec456') => {
  const raw = Buffer.from(JSON.stringify(payload));
  return request(app)
    .post('/api/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', crypto.createHmac('sha256', secret).update(raw).digest('hex'))
    .send(raw);
};

const activatedPayload = (subId = 'sub_1') => ({
  event: 'subscription.activated',
  payload: { subscription: { entity: {
    id: subId, plan_id: 'plan_x', current_end: 1800000000,
    notes: { organizationId: 'org1' },
  } } },
});

beforeEach(() => jest.clearAllMocks());

it('rejects an unsigned request with 400', async () => {
  const res = await request(buildApp())
    .post('/api/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .send(Buffer.from('{}'));
  expect(res.status).toBe(400);
  expect(mockPrisma.paymentEvent.create).not.toHaveBeenCalled();
});

it('rejects a wrong signature with 400', async () => {
  const res = await send(buildApp(), activatedPayload(), 'wrong-secret');
  expect(res.status).toBe(400);
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
});

it('activates the subscription on subscription.activated', async () => {
  mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'e1' });
  mockPrisma.subscription.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org1' });
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'STARTER', seatLimit: 10 });

  const res = await send(buildApp(), activatedPayload());
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update.mock.calls[0][0].data.status).toBe('ACTIVE');
});

it('ignores a duplicate delivery (unique constraint on razorpayEventId)', async () => {
  mockPrisma.paymentEvent.create.mockRejectedValue({ code: 'P2002' });

  const res = await send(buildApp(), activatedPayload());
  expect(res.status).toBe(200);                        // 200 stops Razorpay retrying
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
});

it('halts the subscription on subscription.halted', async () => {
  mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'e2' });
  mockPrisma.subscription.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org1' });

  const res = await send(buildApp(), {
    event: 'subscription.halted',
    payload: { subscription: { entity: { id: 'sub_1', notes: { organizationId: 'org1' } } } },
  });
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update.mock.calls[0][0].data.status).toBe('HALTED');
});

it('returns 200 for an unknown event without touching the subscription', async () => {
  mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'e3' });
  const res = await send(buildApp(), {
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1' } } },
  });
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
});
```

The duplicate-delivery test is load-bearing: Razorpay retries on any non-2xx, and without the unique constraint a retried `subscription.charged` would extend the paid period twice.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/routes/__tests__/razorpayWebhook.routes.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `razorpayWebhook.routes.js`**

```js
// ═══════════════════════════════════════════════════════════
// Argus ITSM — Razorpay webhook (UNAUTHENTICATED, signature-verified)
//
// This router mounts its OWN express.raw parser. Signature verification
// needs the exact bytes Razorpay signed; once express.json() has parsed
// and re-serialised the body, key order and whitespace can differ and the
// HMAC will never match. Mount this router BEFORE express.json() in
// server.js.
//
// Idempotency: PaymentEvent.razorpayEventId is @unique. Razorpay retries
// on any non-2xx, so a duplicate must be a no-op, not a second charge.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { verifyWebhookSignature } = require('../services/razorpay.service');

const STATUS_BY_EVENT = {
  'subscription.activated': 'ACTIVE',
  'subscription.charged': 'ACTIVE',
  'subscription.pending': 'PAST_DUE',
  'subscription.halted': 'HALTED',
  'subscription.cancelled': 'CANCELLED',
  'subscription.completed': 'EXPIRED',
};

router.post('/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  const raw = req.body; // Buffer

  if (!verifyWebhookSignature(raw, signature)) {
    logger.warn('[billing] rejected webhook with invalid signature');
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, error: 'Malformed JSON' });
  }

  const entity = event.payload
    && event.payload.subscription
    && event.payload.subscription.entity;

  // Razorpay's delivery id; fall back to a deterministic composite so
  // idempotency still holds if the header is absent.
  const eventId = req.get('x-razorpay-event-id')
    || `${event.event}:${entity ? entity.id : 'none'}:${event.created_at || ''}`;

  const organizationId = entity && entity.notes ? entity.notes.organizationId : null;

  try {
    await prisma.paymentEvent.create({
      data: { razorpayEventId: eventId, event: event.event, organizationId, payload: event },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      logger.info(`[billing] duplicate webhook ${eventId} ignored`);
      return res.status(200).json({ success: true, duplicate: true }); // 200 stops retries
    }
    logger.error(`[billing] failed to record webhook: ${err.message}`);
    return res.status(500).json({ success: false });
  }

  const nextStatus = STATUS_BY_EVENT[event.event];
  if (!nextStatus || !entity) {
    return res.status(200).json({ success: true, ignored: true });
  }

  try {
    const sub = await prisma.subscription.findFirst({
      where: organizationId
        ? { OR: [{ razorpaySubscriptionId: entity.id }, { organizationId }] }
        : { razorpaySubscriptionId: entity.id },
    });

    if (!sub) {
      logger.warn(`[billing] webhook ${event.event} for unknown subscription ${entity.id}`);
      return res.status(200).json({ success: true, unmatched: true });
    }

    const data = { status: nextStatus, razorpaySubscriptionId: entity.id };

    if (entity.current_end) data.currentPeriodEnd = new Date(entity.current_end * 1000);

    if (nextStatus === 'ACTIVE' && entity.plan_id) {
      const plan = await prisma.plan.findUnique({ where: { razorpayPlanId: entity.plan_id } });
      if (plan) { data.tier = plan.tier; data.seatLimit = plan.seatLimit; }
    }

    await prisma.subscription.update({ where: { id: sub.id }, data });
    await prisma.paymentEvent.update({
      where: { razorpayEventId: eventId }, data: { processedAt: new Date() },
    });

    logger.info(`[billing] ${event.event} → org ${sub.organizationId} is ${nextStatus}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error(`[billing] webhook processing failed: ${err.message}`);
    return res.status(500).json({ success: false }); // non-2xx → Razorpay retries
  }
});

module.exports = router;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/routes/__tests__/razorpayWebhook.routes.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/routes/razorpayWebhook.routes.js src/routes/__tests__/razorpayWebhook.routes.test.js
git commit -m "feat(billing): add signature-verified, idempotent Razorpay webhook"
```

---

## Task 7: Wire billing into the server

**Files:**
- Modify: `src/server.js`
- Modify: `src/routes/auth.routes.js` (seat limit on admin user creation)
- Create: `.env.example` entries

**Interfaces:**
- Consumes: Tasks 4, 5, 6
- Produces: live `/api/v1/billing/*` and `/api/v1/webhooks/razorpay`

- [ ] **Step 1: Mount the webhook before `express.json()`**

In `src/server.js`, add to the route requires block:

```js
const billingRoutes = require('./routes/billing.routes');
const razorpayWebhookRoutes = require('./routes/razorpayWebhook.routes');
```

Then, immediately **before** the `app.use(express.json({ limit: '10mb' }));` line:

```js
// ── Razorpay webhook (MUST precede express.json) ────────
// The router brings its own express.raw parser; signature verification
// needs the unparsed bytes. Moving this below express.json() silently
// breaks every webhook with a 400.
app.use('/api/v1/webhooks', razorpayWebhookRoutes);
```

- [ ] **Step 2: Mount billing routes and global write enforcement**

In the API routes block, add alongside the other mounts:

```js
app.use('/api/v1/billing', billingRoutes);
```

**Apply `enforceWriteAccess` per-router, not globally in `server.js`.** `req.user` is populated by each router's own `authenticate` call, so a top-level `app.use` would run before any router and always see `req.user === undefined` — every write would sail through and the whole feature would silently do nothing.

For each of `incident.routes.js`, `change.routes.js`, `problem.routes.js`, `alert.routes.js`, `asset.routes.js`, `team.routes.js`, `organization.routes.js`, add directly below the existing `router.use(authenticate);` line:

```js
const { enforceWriteAccess } = require('../middleware/billing.middleware');
router.use(enforceWriteAccess);
```

Because the middleware is only attached to these business routers, its internal `EXEMPT` path list never actually fires here — billing and auth simply never reach it. The list stays as defence in depth in case the middleware is later mounted more broadly.

- [ ] **Step 3: Add the seat check to admin user creation**

In `src/routes/auth.routes.js`, find the `POST /register` route (admin-only user creation) and insert `enforceSeatLimit` after the authorize middleware:

```js
const { enforceSeatLimit } = require('../middleware/billing.middleware');
// ...
router.post('/register', authenticate, authorize('ADMIN'), enforceSeatLimit, [ /* existing validators */ ], ctrl.register);
```

- [ ] **Step 4: Document the env vars**

Append to `.env.example`:

```
# ── Razorpay billing ──────────────────────────────────
# Never commit real values. Subscriptions must be enabled on the account.
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_STARTER_PLAN_ID=plan_xxxxxxxxxxxx
```

- [ ] **Step 5: Set real values in `.env` and confirm it is ignored**

```bash
cd /root/projects/argus-itsm/backend
git check-ignore -v .env    # MUST print a .gitignore rule. If it prints nothing, STOP and add `.env` to .gitignore.
```

Then add the four `RAZORPAY_*` values to `.env`.

- [ ] **Step 6: Run the full backend suite**

```bash
npx jest
npm run lint
```

Expected: all suites pass, lint clean.

- [ ] **Step 7: Smoke-test the running server**

```bash
npm run dev
curl -sS http://localhost:5001/api/v1/billing/plans -H "Authorization: Bearer <token>" | jq
```

Expected: 3 plans. Then verify the webhook rejects an unsigned call:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:5001/api/v1/webhooks/razorpay \
  -H 'Content-Type: application/json' -d '{"event":"test"}'
```

Expected: `400`.

- [ ] **Step 8: Commit**

```bash
git add src/server.js src/routes/*.routes.js .env.example
git commit -m "feat(billing): mount webhook before body parser and enforce write access"
```

---

## Task 8: Frontend billing hook and 402 handling

**Files:**
- Create: `src/hooks/useBilling.ts`
- Modify: `src/lib/api.ts:44-48`
- Modify: `src/hooks/useRealtime.ts`

**Interfaces:**
- Consumes: Task 5 endpoints
- Produces:
  - `useBillingPlans()`, `useSubscription()`, `useSubscribe()`, `useCancelSubscription()`
  - type `AccessState = { tier, status, isReadOnly, daysRemaining, trialEndsAt, currentPeriodEnd, seatsUsed, seatLimit }`

- [ ] **Step 1: Create `src/hooks/useBilling.ts`**

The backend wraps responses as `{ success, data }`; `success()` returns that envelope, so unwrap `.data`.

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const keys = {
  all: ['billing'] as const,
  plans: () => [...keys.all, 'plans'] as const,
  subscription: () => [...keys.all, 'subscription'] as const,
};

export type PlanTier = 'TRIAL' | 'STARTER' | 'ENTERPRISE';

export interface BillingPlan {
  tier: PlanTier;
  name: string;
  description: string | null;
  amount: number | null;      // paise
  currency: string;
  period: string;
  seatLimit: number;
}

export interface AccessState {
  tier: PlanTier | 'NONE';
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'HALTED' | 'CANCELLED' | 'EXPIRED' | 'NONE';
  isReadOnly: boolean;
  daysRemaining: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  seatsUsed: number;
  seatLimit: number | null;
}

export function useBillingPlans() {
  return useQuery({
    queryKey: keys.plans(),
    queryFn: async () => {
      const { data } = await api.get('/billing/plans');
      return data.data as BillingPlan[];
    },
    staleTime: 300000,
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: keys.subscription(),
    queryFn: async () => {
      const { data } = await api.get('/billing/subscription');
      return data.data as AccessState;
    },
    staleTime: 60000,
  });
}

export interface SubscribeResult {
  subscriptionId: string;
  shortUrl: string;
  keyId: string;
  tier: PlanTier;
  amount: number | null;
  currency: string;
}

export function useSubscribe() {
  return useMutation({
    mutationFn: async (tier: PlanTier) => {
      const { data } = await api.post('/billing/subscribe', { tier });
      return data.data as SubscribeResult;
    },
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      razorpay_payment_id: string;
      razorpay_subscription_id: string;
      razorpay_signature: string;
    }) => {
      const { data } = await api.post('/billing/verify', payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/billing/cancel');
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

/** Formats paise as ₹30,000 — no decimals, since all tiers are whole rupees. */
export function formatAmount(paise: number | null, currency = 'INR') {
  if (paise == null) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(paise / 100);
}
```

- [ ] **Step 2: Add 402 handling to `src/lib/api.ts`**

Line 48 currently rejects everything that is not a 401. Insert the 402 branch immediately above it, so it is not swallowed:

```ts
    // 402 = subscription lapsed or seat limit hit. Surface it and stop —
    // it must NOT fall into the 401 refresh path below.
    if (error.response?.status === 402) {
      const code = error.response?.data?.code;
      window.dispatchEvent(new CustomEvent('billing:blocked', {
        detail: { code, message: error.response?.data?.error },
      }));
      return Promise.reject(error);
    }
    if (error.response?.status !== 401 || originalRequest._retry) return Promise.reject(error);
```

A `CustomEvent` is used rather than importing the query client, because `api.ts` is imported by every hook — importing `queryClient` here would create a cycle.

- [ ] **Step 3: Add the realtime mapping in `src/hooks/useRealtime.ts`**

Inside the `useEffect`, alongside the other `s.on(...)` handlers:

```ts
    // Billing events
    s.on('subscription:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    });
```

And add `'subscription:updated'` to the cleanup `s.off(...)` list at the end of the effect, matching how the existing events are torn down.

- [ ] **Step 4: Verify the build and lint**

```bash
cd /root/projects/argus-itsm-frontend
npm run build && npm run lint
```

Expected: typecheck passes, build emits `dist/`, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBilling.ts src/lib/api.ts src/hooks/useRealtime.ts
git commit -m "feat(billing): add billing hooks and 402 subscription-blocked handling"
```

---

## Task 9: Billing page, trial banner, route and nav

**Files:**
- Create: `src/components/Billing/BillingPage.tsx`, `src/components/Billing/TrialBanner.tsx`
- Modify: `src/App.tsx`, `src/components/Layout/Sidebar.tsx`, `src/components/Layout/Layout.tsx`

**Interfaces:**
- Consumes: Task 8 hooks
- Produces: route `/billing`

- [ ] **Step 1: Create `src/components/Billing/TrialBanner.tsx`**

```tsx
import { useSubscription } from '../../hooks/useBilling';
import { Link } from 'react-router-dom';

export default function TrialBanner() {
  const { data } = useSubscription();
  if (!data) return null;

  const { status, isReadOnly, daysRemaining } = data;
  if (status === 'ACTIVE' || status === 'NONE') return null;

  const urgent = isReadOnly || (daysRemaining != null && daysRemaining <= 5);

  const message = isReadOnly
    ? 'Your trial has ended — the workspace is read-only until you subscribe.'
    : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your trial.`;

  return (
    <div className={`cx-pill ${urgent ? 'cx-pill-danger' : ''} flex items-center justify-between gap-3 px-4 py-2`}>
      <span className="text-sm">{message}</span>
      <Link to="/billing" className="cx-eyebrow underline">Upgrade</Link>
    </div>
  );
}
```

If `cx-pill-danger` does not exist in `index.css`, add it in the `@layer components` block next to `cx-pill`, deriving its colour from `--argus-crimson` — do not introduce a `stone-*` or white-opacity utility.

- [ ] **Step 2: Create `src/components/Billing/BillingPage.tsx`**

```tsx
import { useState } from 'react';
import { Page, PageHeader, KpiRow, KpiCard, Panel, PrimaryButton, GhostButton }
  from '../ui/PageChrome';
import {
  useBillingPlans, useSubscription, useSubscribe, useVerifyPayment,
  useCancelSubscription, formatAmount, type PlanTier,
} from '../../hooks/useBilling';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Loads checkout.js on demand. It is deliberately NOT in index.html —
 * a third-party script on every page load is exactly the failure mode
 * the removed voice widget caused.
 */
function loadCheckout(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const s = document.createElement('script');
    s.src = CHECKOUT_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay checkout'));
    document.body.appendChild(s);
  });
}

export default function BillingPage() {
  const { data: plans } = useBillingPlans();
  const { data: sub } = useSubscription();
  const subscribe = useSubscribe();
  const verify = useVerifyPayment();
  const cancel = useCancelSubscription();
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function startCheckout(tier: PlanTier) {
    setErr(null);
    setBusy(tier);
    try {
      await loadCheckout();
      const result = await subscribe.mutateAsync(tier);
      const rzp = new (window as any).Razorpay({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: 'Argus ITSM',
        description: `${result.tier} plan`,
        handler: (r: any) => {
          verify.mutate({
            razorpay_payment_id: r.razorpay_payment_id,
            razorpay_subscription_id: r.razorpay_subscription_id,
            razorpay_signature: r.razorpay_signature,
          });
        },
        modal: { ondismiss: () => setBusy(null) },
        theme: { color: '#ff5b2e' },
      });
      rzp.on('payment.failed', (e: any) =>
        setErr(e?.error?.description || 'Payment failed. No money was taken.'));
      rzp.open();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Could not start checkout');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page>
      <PageHeader eyebrow="Administration" title="Billing"
        description="Your plan, seats and renewal." />

      {sub && (
        <KpiRow>
          <KpiCard label="Plan" value={sub.tier} />
          <KpiCard label="Status" value={sub.status} />
          <KpiCard label="Agent seats"
            value={sub.seatLimit == null ? String(sub.seatsUsed) : `${sub.seatsUsed} / ${sub.seatLimit}`} />
          <KpiCard label={sub.status === 'TRIALING' ? 'Trial days left' : 'Renews'}
            value={sub.status === 'TRIALING'
              ? String(sub.daysRemaining ?? 0)
              : (sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN') : '—')} />
        </KpiRow>
      )}

      {err && <Panel title="Payment problem"><p className="text-sm text-crimson">{err}</p></Panel>}

      <Panel title="Plans">
        <div className="grid gap-4 md:grid-cols-3">
          {plans?.map((p) => {
            const current = sub?.tier === p.tier;
            const price = formatAmount(p.amount, p.currency);
            return (
              <div key={p.tier} className="cx-card p-5 flex flex-col gap-3">
                <div className="cx-eyebrow">{p.name}</div>
                <div className="font-display text-3xl">
                  {price ?? 'Talk to sales'}
                  {price && <span className="text-sm text-muted"> / {p.period}</span>}
                </div>
                <p className="text-sm text-muted">{p.description}</p>
                <p className="text-xs text-dim">
                  {p.seatLimit >= 9999 ? 'Custom agent seats' : `${p.seatLimit} agent seats`} · Viewers free
                </p>
                <div className="mt-auto pt-2">
                  {current
                    ? <GhostButton disabled>Current plan</GhostButton>
                    : p.amount == null
                      ? <GhostButton onClick={() => { window.location.href = 'mailto:info@wecrew.in?subject=Argus%20ITSM%20Enterprise'; }}>
                          Contact sales
                        </GhostButton>
                      : <PrimaryButton disabled={busy === p.tier} onClick={() => startCheckout(p.tier)}>
                          {busy === p.tier ? 'Opening…' : `Upgrade to ${p.name}`}
                        </PrimaryButton>}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {sub?.status === 'ACTIVE' && (
        <Panel title="Cancel">
          <p className="text-sm text-muted mb-3">
            Cancelling keeps access until the end of the paid period.
          </p>
          <GhostButton onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelling…' : 'Cancel subscription'}
          </GhostButton>
        </Panel>
      )}
    </Page>
  );
}
```

Two things to confirm before writing this file:
- Verify the `cx-card` class exists in `index.css`. If the migrated pages use a different card class, use theirs — check `IncidentList.tsx` for the current convention.
- The Enterprise button uses **`info@wecrew.in`** (confirmed by the user, 2026-08-13). Published phone `9363072077` — use it only if the design calls for a visible contact line; the button itself is `mailto:info@wecrew.in`. Use no other address.

- [ ] **Step 3: Add the route in `src/App.tsx`**

With the other lazy imports:

```tsx
const BillingPage = lazy(() => import('./components/Billing/BillingPage'));
```

Inside the protected element route, matching the surrounding `<Suspense>` pattern:

```tsx
<Route path="/billing" element={
  <ProtectedRoute allowedRoles={['ADMIN']}>
    <Suspense fallback={<div className="p-6">Loading…</div>}><BillingPage /></Suspense>
  </ProtectedRoute>
} />
```

Match the exact `fallback` markup used by neighbouring routes rather than the placeholder above.

- [ ] **Step 4: Add the nav entry in `src/components/Layout/Sidebar.tsx`**

Import an icon from `lucide-react` (e.g. `CreditCard`) alongside the existing icon imports, then add to the **Administration** group's `items` array, next to the `/integrations` entry:

```ts
      { to: '/billing', icon: CreditCard, label: 'Billing', roles: ['ADMIN'] },
```

- [ ] **Step 5: Render the banner in `src/components/Layout/Layout.tsx`**

Import and render `<TrialBanner />` directly above the main content area, inside the same wrapper that holds the page outlet.

- [ ] **Step 6: Verify build and lint**

```bash
npm run build && npm run lint
```

Expected: typecheck passes, build emits `dist/`, lint clean.

- [ ] **Step 7: Manual check against the running app**

```bash
npm run dev   # :5174, proxies to backend :5001
```

Sign up a new account, confirm the trial banner shows ~20 days, open `/billing`, confirm three plan cards render with ₹30,000 on Starter and "Talk to sales" on Enterprise.

- [ ] **Step 8: Commit**

```bash
git add src/components/Billing src/App.tsx src/components/Layout/Sidebar.tsx src/components/Layout/Layout.tsx
git commit -m "feat(billing): add billing page, trial banner, route and nav entry"
```

---

## Task 10: Trial reminder job

**Files:**
- Create: `scripts/trial-reminders.js`
- Modify: `package.json` (script entry)

**Interfaces:**
- Consumes: Task 1 models, existing `emailService`
- Produces: `npm run trial:remind`

- [ ] **Step 1: Write the script**

```js
// ═══════════════════════════════════════════════════════════
// Trial reminder emails — day 15, 19 and 21 (expired).
//
// Reminders ONLY. Access is derived at request time, so if this job
// never runs nobody gets free product — they just get no warning.
// Run daily from cron.
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DAY_MS = 86400000;
const NOTIFY_ON = { 5: 'trial-5-days', 1: 'trial-1-day', '-1': 'trial-expired' };

async function main() {
  const subs = await prisma.subscription.findMany({
    where: { status: 'TRIALING' },
    include: { organization: { select: { id: true, name: true } } },
  });

  for (const sub of subs) {
    const daysLeft = Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / DAY_MS);
    const template = NOTIFY_ON[String(daysLeft)];
    if (!template) continue;

    const admins = await prisma.user.findMany({
      where: { organizationId: sub.organizationId, role: 'ADMIN', status: 'ACTIVE' },
      select: { email: true, firstName: true },
    });

    for (const admin of admins) {
      await prisma.emailQueue.create({
        data: {
          to: admin.email,
          subject: daysLeft > 0
            ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your Argus ITSM trial`
            : 'Your Argus ITSM trial has ended',
          body: daysLeft > 0
            ? `Hi ${admin.firstName},\n\nYour trial for ${sub.organization.name} ends in `
              + `${daysLeft} day${daysLeft === 1 ? '' : 's'}. Subscribe to keep full access.\n`
            : `Hi ${admin.firstName},\n\nYour trial for ${sub.organization.name} has ended. `
              + 'Your data is safe and still readable — subscribe to resume making changes.\n',
          status: 'PENDING',
        },
      });
    }
    console.log(`[trial-reminders] ${template} queued for org ${sub.organizationId}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

Before running, confirm the `EmailQueue` model's field names by reading its block in `prisma/schema.prisma` — adjust `to`/`subject`/`body`/`status` to match the actual columns.

- [ ] **Step 2: Add the npm script**

In `package.json` `scripts`:

```json
    "trial:remind": "node scripts/trial-reminders.js",
```

- [ ] **Step 3: Run it against test data**

```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.subscription.updateMany({data:{trialEndsAt:new Date(Date.now()+5*86400000)}}).then(()=>p.\$disconnect())"
npm run trial:remind
```

Expected: prints `trial-5-days queued for org …` and creates `EmailQueue` rows.

- [ ] **Step 4: Commit**

```bash
git add scripts/trial-reminders.js package.json
git commit -m "feat(billing): add trial reminder job"
```

---

## Deployment prerequisites

These are **not code** and block go-live:

1. **Enable Subscriptions** on the Razorpay account (not on by default).
2. **Create the Starter plan** in the Razorpay dashboard: yearly, ₹30,000, then put its `plan_...` id in `RAZORPAY_STARTER_PLAN_ID` and re-run `node scripts/seed-plans.js`.
3. **Register the webhook** at `https://incident.api.wecrew.in/api/v1/webhooks/razorpay` (API host; its ingress routes `/` straight to `linkedeye-api`) with events `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`; copy the signing secret into `RAZORPAY_WEBHOOK_SECRET`.
4. **Expose the host** — `incident.wecrew.in` / `incident.api.wecrew.in` are already in `k8s/wecrew-itsm/90-ingress.yaml`, and `FRONTEND_URL=https://incident.wecrew.in` (reminder-email billing links) is in `10-config.yaml`; nothing new to expose unless another host is used.
5. **Rotate the test keys** before switching to live keys; they were shared in a chat transcript.
6. **Confirm GST treatment** — decide whether ₹30,000 is tax-inclusive before creating the live plan, since the plan amount cannot be edited afterwards.
