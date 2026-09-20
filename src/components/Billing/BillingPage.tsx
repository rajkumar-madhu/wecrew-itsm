import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { COMPANY } from '../Public/site';
import { Page, PageHeader, KpiRow, KpiCard, Panel, PrimaryButton, GhostButton } from '../ui/PageChrome';
import {
  useBillingPlans, useSubscription, useSubscribe, useVerifyPayment,
  useCancelSubscription, formatAmount, type PlanTier, type AccessState,
} from '../../hooks/useBilling';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
const TIER_ORDER: PlanTier[] = ['TRIAL', 'STARTER', 'ENTERPRISE'];

const STATUS_LABEL: Record<AccessState['status'], string> = {
  TRIALING: 'Trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Payment failed',
  HALTED: 'Halted',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  NONE: 'No plan',
};

// Minimal surface of Razorpay Checkout we use — see razorpay.com/docs/payments/subscriptions.
interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', cb: (e: { error?: { description?: string } }) => void) => void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;
declare global {
  interface Window { Razorpay?: RazorpayCtor }
}

/**
 * Loads checkout.js on demand. It is deliberately NOT in index.html —
 * a third-party script on every page load is exactly the failure mode
 * the removed voice widget caused.
 */
function loadCheckout(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const settle = (fn: () => void) => {
      clearTimeout(timer);
      fn();
    };
    const done = () =>
      settle(() =>
        window.Razorpay
          ? resolve(window.Razorpay)
          : reject(new Error('Razorpay checkout did not initialise')),
      );
    const fail = (node: HTMLScriptElement) =>
      settle(() => {
        // Drop the dead tag. A failed <script> that stays in the DOM makes the
        // next attempt take the `existing` branch below and wait on load/error
        // events that already fired — the promise would never settle, leaving
        // every Upgrade button disabled until a full page reload.
        node.remove();
        reject(new Error('Could not load Razorpay checkout'));
      });

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const node = existing ?? document.createElement('script');

    // A tag left by an in-flight attempt is fine to wait on; one whose load
    // already completed without defining Razorpay is not, so retry from scratch.
    if (existing && existing.dataset.loaded === 'true') {
      settle(() => reject(new Error('Razorpay checkout did not initialise')));
      existing.remove();
      return;
    }

    const timer = window.setTimeout(() => fail(node), 15000);

    node.addEventListener('load', () => {
      node.dataset.loaded = 'true';
      done();
    });
    node.addEventListener('error', () => fail(node));

    if (!existing) {
      node.src = CHECKOUT_SRC;
      document.body.appendChild(node);
    }
  });
}

function errorMessage(e: unknown, fallback: string): string {
  const resp = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
  if (resp) return resp;
  return e instanceof Error ? e.message : fallback;
}

export default function BillingPage() {
  const { data: plans, isLoading: plansLoading } = useBillingPlans();
  const { data: sub, isLoading: subLoading } = useSubscription();
  const subscribe = useSubscribe();
  const verify = useVerifyPayment();
  const cancel = useCancelSubscription();
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function startCheckout(tier: PlanTier) {
    setErr(null);
    setBusy(tier);
    try {
      const Razorpay = await loadCheckout();
      const result = await subscribe.mutateAsync(tier);
      const rzp = new Razorpay({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: 'WeCrew ITSM',
        description: `${result.tier} plan`,
        handler: (r: RazorpaySuccess) => {
          setBusy(null);
          // The webhook is authoritative; this only makes the UI update instantly.
          verify.mutate({
            razorpay_payment_id: r.razorpay_payment_id,
            razorpay_subscription_id: r.razorpay_subscription_id,
            razorpay_signature: r.razorpay_signature,
          }, {
            onError: (e) => setErr(errorMessage(e, 'Payment received but confirmation failed — refresh in a moment, or contact support if billing stays on trial.')),
          });
        },
        modal: { ondismiss: () => setBusy(null) },
        theme: { color: '#ff5b2e' },
      });
      rzp.on('payment.failed', (e) => {
        setBusy(null);
        setErr(e?.error?.description || 'Payment failed. No money was taken.');
      });
      rzp.open();
    } catch (e) {
      setErr(errorMessage(e, 'Could not start checkout'));
      setBusy(null);
    }
  }

  const sortedPlans = [...(plans ?? [])].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  const trialing = sub?.status === 'TRIALING';
  // Only a healthy paid/trial seat on this tier is "current". Failed/lapsed
  // statuses must still offer Upgrade / Update payment — otherwise PAST_DUE
  // locks the CTA while the banner tells the admin to manage billing.
  const liveOnTier = sub?.status === 'ACTIVE' || sub?.status === 'TRIALING'
    || (sub?.status === 'CANCELLED' && !sub?.isReadOnly);
  const canCancel = sub?.status === 'ACTIVE' || sub?.status === 'PAST_DUE';

  return (
    <Page>
      <PageHeader icon={CreditCard} title="Billing" subtitle="Your plan, agent seats and renewal." />

      <KpiRow>
        <KpiCard label="Plan" value={sub?.tier ?? '—'} loading={subLoading} />
        <KpiCard
          label="Status"
          value={sub ? STATUS_LABEL[sub.status] : '—'}
          loading={subLoading}
          tone={sub?.isReadOnly || sub?.status === 'PAST_DUE' ? 'danger' : sub?.status === 'ACTIVE' ? 'ok' : 'default'}
        />
        <KpiCard
          label="Agent seats"
          value={sub ? (sub.seatLimit == null ? String(sub.seatsUsed) : `${sub.seatsUsed} / ${sub.seatLimit}`) : '—'}
          loading={subLoading}
          tone={sub?.seatLimit != null && sub.seatsUsed >= sub.seatLimit ? 'warn' : 'default'}
        />
        <KpiCard
          label={trialing ? 'Trial days left' : 'Renews'}
          value={trialing
            ? String(sub?.daysRemaining ?? 0)
            : (sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN') : '—')}
          loading={subLoading}
          tone={trialing && (sub?.daysRemaining ?? 0) <= 5 ? 'warn' : 'default'}
        />
      </KpiRow>

      {err && (
        <Panel title="Payment problem">
          <p className="text-sm text-crimson">{err}</p>
        </Panel>
      )}
      {verify.isPending && (
        <Panel title="Confirming payment">
          <p className="text-sm text-muted">Payment received — confirming with Razorpay…</p>
        </Panel>
      )}

      <Panel title="Plans">
        {plansLoading ? (
          <p className="text-sm text-muted">Loading plans…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {sortedPlans.map((p) => {
              const current = liveOnTier && sub?.tier === p.tier;
              const needsPaymentFix = sub?.tier === p.tier && (sub?.status === 'PAST_DUE' || sub?.status === 'HALTED');
              const price = p.tier === 'TRIAL' ? 'Free' : formatAmount(p.amount, p.currency);
              const ctaLabel = needsPaymentFix
                ? (busy === p.tier ? 'Opening…' : 'Update payment')
                : (busy === p.tier ? 'Opening…' : `Upgrade to ${p.name}`);
              return (
                <div key={p.tier} className="cx-panel p-4 flex flex-col gap-2">
                  <div className="cx-eyebrow">{p.name}</div>
                  <div className="font-display text-3xl text-ink">
                    {price ?? 'Talk to sales'}
                    {price && p.tier !== 'TRIAL' && <span className="text-sm text-muted"> / {p.period}</span>}
                  </div>
                  {p.description && <p className="text-sm text-muted">{p.description}</p>}
                  <p className="text-xs text-dim">
                    {p.seatLimit >= 9999 ? 'Custom agent seats' : `${p.seatLimit} agent seats`} · Viewers free
                  </p>
                  <div className="mt-auto pt-2">
                    {current ? (
                      <GhostButton disabled>Current plan</GhostButton>
                    ) : p.tier === 'TRIAL' ? null : p.amount == null ? (
                      <div className="space-y-1.5">
                        <GhostButton onClick={() => { window.location.href = 'mailto:info@wecrew.in?subject=WeCrew%20ITSM%20Enterprise'; }}>
                          Contact sales
                        </GhostButton>
                        <p className="text-xs text-dim">
                          or call{' '}
                          <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="text-signal hover:underline">
                            {COMPANY.phone}
                          </a>
                        </p>
                      </div>
                    ) : (
                      <PrimaryButton disabled={busy !== null} onClick={() => startCheckout(p.tier)}>
                        {ctaLabel}
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {canCancel && (
        <Panel title="Cancel subscription">
          <p className="text-sm text-muted mb-3">
            Cancelling keeps access until the end of the paid period.
          </p>
          <GhostButton
            onClick={() => { if (window.confirm('Cancel the subscription at the end of the paid period?')) cancel.mutate(); }}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel subscription'}
          </GhostButton>
        </Panel>
      )}
    </Page>
  );
}
