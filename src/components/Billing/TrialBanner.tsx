import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { useSubscription, billingKeys, type AccessState } from '../../hooks/useBilling';
import { useAuth } from '../../hooks/useAuth';

function bannerMessage(s: AccessState): string | null {
  if (s.status === 'TRIALING') {
    if (s.isReadOnly) return 'Your trial has ended — the workspace is read-only until you subscribe.';
    return `${s.daysRemaining} day${s.daysRemaining === 1 ? '' : 's'} left in your trial.`;
  }
  if (s.status === 'PAST_DUE') return 'Your last payment failed — Razorpay will retry. Update your payment method to keep access.';
  if (s.status === 'CANCELLED' && !s.isReadOnly) {
    const until = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString('en-IN') : 'the end of the period';
    return `Subscription cancelled — full access until ${until}.`;
  }
  if (s.isReadOnly) return 'Your subscription has lapsed — the workspace is read-only until you subscribe.';
  return null;
}

export default function TrialBanner() {
  const { data } = useSubscription();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  // api.ts raises `billing:blocked` on any 402 — refetch so the banner flips
  // to read-only immediately instead of waiting out staleTime.
  useEffect(() => {
    const onBlocked = () => qc.invalidateQueries({ queryKey: billingKeys.all });
    window.addEventListener('billing:blocked', onBlocked);
    return () => window.removeEventListener('billing:blocked', onBlocked);
  }, [qc]);

  if (!data) return null;
  const message = bannerMessage(data);
  if (!message) return null;

  const urgent = data.isReadOnly
    || data.status === 'PAST_DUE'
    || (data.daysRemaining != null && data.daysRemaining <= 5);

  return (
    <div
      role="status"
      className={clsx('cx-posture shrink-0 justify-between mx-3 mt-2 md:mx-4', urgent ? 'cx-posture--danger' : 'cx-posture--warn')}
    >
      <span className={clsx('text-sm', urgent ? 'text-crimson' : 'text-ink')}>{message}</span>
      {isAdmin
        ? <Link to="/billing" className="cx-eyebrow underline">{data.status === 'TRIALING' ? 'Upgrade' : 'Manage billing'}</Link>
        : <span className="text-xs text-muted">Ask an admin to manage billing.</span>}
    </div>
  );
}
