import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

// Prefix ['billing'] is invalidated by useRealtime on `subscription:updated` —
// keep the two in sync.
const keys = {
  all: ['billing'] as const,
  plans: () => [...keys.all, 'plans'] as const,
  subscription: () => [...keys.all, 'subscription'] as const,
};

export const billingKeys = keys;

export type PlanTier = 'TRIAL' | 'STARTER' | 'ENTERPRISE';

export interface BillingPlan {
  tier: PlanTier;
  name: string;
  description: string | null;
  amount: number | null; // paise
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

export interface SubscribeResult {
  subscriptionId: string;
  shortUrl: string;
  keyId: string;
  tier: PlanTier;
  amount: number | null;
  currency: string;
}

// Billing endpoints return the `{ success, data }` envelope — hooks unwrap it.

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
  // Mounted in Layout for every page: skip the request entirely for an
  // account with no organization (e.g. platform staff) — the API answers 400.
  // selectedOrgId is in the key so a platform-admin org switch cannot keep
  // showing the previous tenant's billing state from cache.
  const homeOrgId = useAuthStore((s) => s.user?.organizationId ?? null);
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const orgKey = selectedOrgId || homeOrgId;
  return useQuery({
    queryKey: [...keys.subscription(), orgKey],
    queryFn: async () => {
      const { data } = await api.get('/billing/subscription');
      return data.data as AccessState;
    },
    enabled: !!orgKey,
    staleTime: 60000,
    // 400 = account has no organization; retrying cannot fix that.
    retry: false,
  });
}

export function useSubscribe() {
  return useMutation({
    mutationFn: async (tier: PlanTier) => {
      const { data } = await api.post('/billing/subscribe', { tier });
      return data.data as SubscribeResult;
    },
    // BillingPage renders the error inline; the no-op opts out of the global toast.
    onError: () => {},
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
      return data.data as { status: AccessState['status'] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/billing/cancel');
      return data.data as { cancelled: boolean; accessUntil: string | null };
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
