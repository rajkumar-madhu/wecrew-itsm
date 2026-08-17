# Razorpay billing: 20-day trial and paid upgrade

**Date:** 2026-08-13
**Status:** Design — awaiting review
**Spans two repos:** `/root/projects/argus-itsm-frontend` (this one) and `/root/projects/argus-itsm/backend`

## Goal

Every new organization gets a 20-day free trial with no card required. At the end of the
trial the organization either subscribes via Razorpay recurring subscriptions or drops to
read-only access.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Payment model | Razorpay **Subscriptions** (auto-debit mandate) | Razorpay handles recurring charges and dunning; we do not build renewal reminders or retry logic. |
| Pricing unit | Flat tier with a **billable-seat cap** | True per-seat means a subscription-quantity update on every user add/remove, plus proration and mid-cycle reconciliation. Every failure there is a billing bug. A cap gives the same upsell lever for one integer comparison. |
| Billable seat | Active users whose role is **not `VIEWER`** | Standard agents-pay / requesters-free split. Customers can onboard the whole company as viewers, which grows the account rather than blocking it. |
| Trial expiry | **Read-only lockout** | Reads and export keep working, all writes blocked. Customers can still see their own data, which converts better than a hard wall and generates far fewer support tickets. |
| Trial ownership | **Ours, not Razorpay's** | No Razorpay subscription exists during the trial, so no card, no mandate, and nothing to clean up if they never convert. |

### Tiers

| Tier | Price | Billable seats | Checkout |
| --- | --- | --- | --- |
| `TRIAL` | free, 20 days | 10 | n/a |
| `STARTER` | **₹30,000 / year** (`3000000` paise) | 10 | self-serve |
| `ENTERPRISE` | not displayed — "Talk to sales" | negotiated | manual |

Amounts are stored in **paise**. Razorpay plan `period: 'yearly'`, `interval: 1`.
A price may be shown for Enterprise later; the schema already supports it (`amount` is
nullable for that tier).

## Data model (`backend/prisma/schema.prisma`)

`Organization` currently has no plan, trial, or subscription fields. Add:

```prisma
enum PlanTier           { TRIAL STARTER ENTERPRISE }
enum SubscriptionStatus { TRIALING ACTIVE PAST_DUE HALTED CANCELLED EXPIRED }

model Plan {
  id             String   @id @default(uuid())
  tier           PlanTier @unique
  name           String
  razorpayPlanId String?  @unique          // null for TRIAL and ENTERPRISE
  amount         Int?                      // paise; null when not displayed
  currency       String   @default("INR")
  period         String   @default("yearly")
  seatLimit      Int
  isActive       Boolean  @default(true)
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
  razorpayEventId String    @unique         // idempotency key
  event           String
  organizationId  String?
  payload         Json
  processedAt     DateTime?
  createdAt       DateTime  @default(now())
}
```

`Organization` gains `subscription Subscription?`.

`PaymentEvent.razorpayEventId` is unique because **Razorpay retries webhooks**. Without it,
a retried `subscription.charged` extends the billing period twice.

## Trial lifecycle

On organization creation (signup), create a `Subscription` with `tier: TRIAL`,
`status: TRIALING`, `seatLimit: 10`, `trialEndsAt: now + 20 days`.

The trial carries the **Starter seat cap**, so the trial is a true Starter trial. A smaller
trial cap would block a team from onboarding enough people to actually evaluate the product,
which costs more in lost conversions than it gains in upgrade pressure.

**Access state is derived per request, never stored as a flag.**

```
isReadOnly =
  (status === TRIALING && trialEndsAt < now) ||
  status IN (HALTED, EXPIRED) ||
  (status === CANCELLED && currentPeriodEnd < now)
```

A stored boolean flipped by a nightly cron means one missed run silently grants every
expired organization free access — invisible until someone audits revenue. Derived state
cannot drift.

A cron job still exists, but only to send day-15 / day-19 / day-21 reminder emails via the
existing `EmailQueue`. If it fails, nobody gets free product.

## Backend

New files: `src/routes/billing.routes.js`, `src/controllers/billing.controller.js`,
`src/services/razorpay.service.js`, `src/middleware/billing.middleware.js`.
The backend is **CommonJS JavaScript** (`src/server.js`), not TypeScript — match that.

### Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/billing/plans` | any | Tier list for pricing UI |
| GET | `/api/v1/billing/subscription` | any | `{tier, status, daysRemaining, seatsUsed, seatLimit, isReadOnly}` |
| POST | `/api/v1/billing/subscribe` | ADMIN | Create Razorpay customer + subscription → `{subscriptionId, keyId}` |
| POST | `/api/v1/billing/verify` | ADMIN | Verify checkout signature, optimistic activate |
| POST | `/api/v1/billing/cancel` | ADMIN | Cancel at period end |
| POST | `/api/v1/webhooks/razorpay` | none (signed) | Authoritative subscription state |

### Subscription creation

```js
const sub = await razorpay.subscriptions.create({
  plan_id: plan.razorpayPlanId,
  total_count: 10,            // 10 yearly cycles
  quantity: 1,                // always 1 — flat tier, not per-seat
  customer_notify: 1,
  notes: { organizationId },  // correlates the webhook back to the org
});
```

`notes.organizationId` is how the webhook finds the organization when
`razorpaySubscriptionId` has not been persisted yet (browser closed mid-flow).

### Signature verification — the critical detail

Subscriptions and orders use **different, reversed** concatenations. Verified against
`razorpay-node/lib/utils/razorpay-utils.js`:

```js
// Orders (what the linked Standard Checkout doc shows):
hmac_sha256(order_id + '|' + razorpay_payment_id, KEY_SECRET)

// Subscriptions (what we need):
hmac_sha256(razorpay_payment_id + '|' + razorpay_subscription_id, KEY_SECRET)
```

The docs page linked in the original request only documents the Orders form. Following it
literally for subscriptions produces a verifier that rejects every valid payment.

Compare with `crypto.timingSafeEqual`, not `===`.

### Webhooks are the source of truth

`/billing/verify` exists only so the UI can react instantly. Activation must not depend on
it: a customer who closes the laptop mid-redirect has paid and would otherwise never get
access.

Handled events: `subscription.activated`, `subscription.charged`, `subscription.pending`,
`subscription.halted`, `subscription.cancelled`, `subscription.completed`.

Webhook signature is `hmac_sha256(rawBody, RAZORPAY_WEBHOOK_SECRET)` against the
`x-razorpay-signature` header.

> **Landmine:** `server.js` currently has **no raw-body handling anywhere**. Signature
> verification needs the unparsed bytes, so this one route must mount
> `express.raw({ type: 'application/json' })` **before** the global `express.json()`.
> Otherwise the HMAC never matches and every webhook 400s.

> **Landmine:** the webhook URL must be publicly reachable. Per `/root/CLAUDE.md` that means
> a cluster ingress plus a `HostSNI(...)` rule in the host Traefik config — the host Traefik
> owns `:80`/`:443` and forwards by SNI passthrough.

### Enforcement middleware

- `enforceWriteAccess` — on mutating verbs (POST/PUT/PATCH/DELETE), returns **402** with
  `{ error, code: 'SUBSCRIPTION_REQUIRED' }` when `isReadOnly`.
  **Allowlist `/billing/*` and `/auth/*`** — otherwise the lockout blocks the very page that
  takes the customer's money.
- `enforceSeatLimit` — on user create/invite, counts active non-`VIEWER` users against
  `seatLimit`, returns 402 with `code: 'SEAT_LIMIT_REACHED'`.

## Frontend (this repo)

Follows existing conventions from `CLAUDE.md`:

- `src/hooks/useBilling.ts` — domain hook with a local `keys` factory, explicit `staleTime`,
  mutations that `invalidateQueries`. The only place `api` is imported for billing.
- `src/components/Billing/BillingPage.tsx` — built from `src/components/ui/PageChrome.tsx`
  primitives (`Page`, `PageHeader`, `KpiRow`, `Panel`, `PrimaryButton`). Uses `cx-*` classes
  only; no `stone-*` or white-opacity utilities (they grow the legacy shim).
- `src/App.tsx` — `lazy()` import + `<Route>` inside the protected element route.
- `src/components/Layout/Sidebar.tsx` — entry in `navGroups` under **Administration**,
  `roles: ['ADMIN']`.
- `src/hooks/useRealtime.ts` — map `subscription:updated` → invalidate `['billing']`.
  Key prefixes are hardcoded string arrays; keep them in sync with the hook's `keys`.
- `TrialBanner` in `Layout` — days remaining, tone escalating past day 15.
- `useRazorpayCheckout` — lazily injects `https://checkout.razorpay.com/v1/checkout.js` on
  button click (not in `index.html`; see the voice-widget landmine), opens with
  `subscription_id`, not `order_id`.

Read-only mode disables write affordances from `useBilling` state, with a **402 handler in
`src/lib/api.ts`'s response interceptor as the backstop** — UI gating is bypassable with
devtools, so the server decides and the UI only reflects it. The 402 branch sits alongside
the existing 401-refresh logic and must not trigger a token refresh.

## Configuration and secrets

Backend `.env` (gitignored), created imperatively, never committed:

```
RAZORPAY_KEY_ID=rzp_test_…
RAZORPAY_KEY_SECRET=…
RAZORPAY_WEBHOOK_SECRET=…
```

The frontend receives the **key id in the `/billing/subscribe` response**, not as a `VITE_`
variable. Baking it into the bundle would require a rebuild to switch test→live, and this
repo's `.env` **is committed** (a documented landmine), so keys placed there would be
published.

The key secret and webhook secret never leave the backend.

**Credential hygiene:** the key material shared during this design discussion was exposed in
a chat transcript. The test keys must be rotated before go-live, and any live key from that
conversation must be rotated immediately in the Razorpay dashboard.

## Testing

The backend has `src/routes/__tests__`; the frontend has **no test runner** — verification
there is `npm run build` (typechecks) plus `npm run lint`.

1. Razorpay **test mode** with test cards / UPI success and failure flows.
2. Unit tests for both signature verifiers, including a **known-good fixture** to prove the
   subscription concatenation order is right.
3. Webhook idempotency test: replay the same `razorpayEventId` twice, assert the billing
   period advances once.
4. Trial expiry: set `trialEndsAt` in the past, assert writes 402 and reads still 200.
5. Seat limit: fill to cap, assert the 11th non-`VIEWER` user is rejected and a `VIEWER` is not.

## Prerequisites (blocking, outside the code)

1. **Razorpay Subscriptions must be enabled on the account** — it is not on by default.
2. **Plans created in the Razorpay dashboard** before `razorpayPlanId` can be seeded.
3. **Webhook endpoint registered** in the dashboard with the events listed above.

## Out of scope

- Proration and mid-cycle tier changes.
- Invoice PDF generation (Razorpay emails its own).
- Multi-currency — INR only.
- Self-serve Enterprise checkout (sales-assisted).
- GST/tax handling — confirm whether Razorpay plan amounts are tax-inclusive before launch.

## Open items

- Confirm whether ₹30,000 is intended to be tax-inclusive.
- Decide the grace behaviour for `PAST_DUE` (Razorpay retries a failed mandate before
  `halted`); current design keeps access until `halted` arrives.
