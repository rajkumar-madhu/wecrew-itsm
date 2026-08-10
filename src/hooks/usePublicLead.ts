import { useMutation } from '@tanstack/react-query';
import publicApi from '../lib/publicApi';

/*
  Pilot / demo request submission for the public marketing pages.

  Endpoint contract expected of the backend — NOT yet implemented in
  argus-itsm/backend. It must be reachable without authentication:

    POST /api/v1/public/leads
    body:    { name, email, company, phone?, interest, teamSize?, message? }
    200/201: { data: { id: string } }
    400:     { error: string }            // shown inline on the form

  Uses `publicApi` rather than the shared `api` instance so a 401/403 from an
  unconfigured backend cannot trigger the auth refresh path and bounce a
  visitor to /login.

  The no-op `onError` is load-bearing: the global MutationCache in
  src/lib/queryClient.ts toasts only for mutations that declare no `onError`,
  so declaring one opts this mutation out of the toast. The form renders the
  failure inline instead — a marketing page should not fire a red toast over
  the layout.
*/

export type LeadInterest = 'pilot' | 'demo';

export interface LeadInput {
  name: string;
  email: string;
  company: string;
  phone?: string;
  interest: LeadInterest;
  teamSize?: string;
  message?: string;
}

export interface LeadResponse {
  id: string;
}

export function usePublicLead() {
  return useMutation<LeadResponse, unknown, LeadInput>({
    mutationFn: async (input: LeadInput) => {
      const { data } = await publicApi.post<{ data: LeadResponse }>('/public/leads', input);
      return data.data;
    },
    // Opts out of the global error toast; the form shows the message inline.
    onError: () => {},
    // No cache to invalidate — the public site reads nothing from the API.
  });
}

/** Best-effort extraction of a server-provided message for inline display. */
export function leadErrorMessage(error: unknown): string {
  const fallback = 'Something went wrong sending your request. Please email us instead.';
  if (typeof error !== 'object' || error === null) return fallback;
  const response = (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response;
  const payload = response?.data;
  if (typeof payload?.error === 'string' && payload.error) return payload.error;
  if (typeof payload?.message === 'string' && payload.message) return payload.message;
  return fallback;
}
