import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

const orgKey = () => ['pagerduty', useAuthStore.getState().selectedOrgId];

export function usePdStatus() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['pagerduty', 'status', orgId],
    queryFn: async () => { const { data } = await api.get('/pagerduty/status'); return data.data; },
    staleTime: 60000,
    retry: false,
  });
}

export function usePdOverview() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['pagerduty', 'overview', orgId],
    queryFn: async () => { const { data } = await api.get('/pagerduty/overview'); return data.data; },
    staleTime: 30000,
    refetchInterval: 60000,
    retry: false,
  });
}

export function usePdServices() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['pagerduty', 'services', orgId],
    queryFn: async () => { const { data } = await api.get('/pagerduty/services'); return data.data; },
    staleTime: 120000,
    retry: false,
  });
}

export function usePdIncidents(status?: string) {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['pagerduty', 'incidents', orgId, status],
    queryFn: async () => {
      const { data } = await api.get('/pagerduty/incidents', { params: status ? { status } : {} });
      return data.data;
    },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
}

export function usePdOnCalls() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['pagerduty', 'oncall', orgId],
    queryFn: async () => { const { data } = await api.get('/pagerduty/oncall'); return data.data; },
    staleTime: 60000,
    retry: false,
  });
}

export function usePdEscalationPolicies() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['pagerduty', 'escalation-policies', orgId],
    queryFn: async () => { const { data } = await api.get('/pagerduty/escalation-policies'); return data.data; },
    staleTime: 300000,
    retry: false,
  });
}

export function usePdUsers() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['pagerduty', 'users', orgId],
    queryFn: async () => { const { data } = await api.get('/pagerduty/users'); return data.data; },
    staleTime: 300000,
    retry: false,
  });
}

export function usePdStats() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['pagerduty', 'stats', orgId],
    queryFn: async () => { const { data } = await api.get('/pagerduty/stats'); return data.data; },
    staleTime: 60000,
    refetchInterval: 120000,
    retry: false,
  });
}

export function useConnectPagerDuty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { apiKey: string; routingKey?: string; serviceId?: string; autoSync?: boolean; autoCreateIncidents?: boolean }) => {
      const { data } = await api.post('/pagerduty/connect', payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pagerduty'] }),
  });
}

export function useDisconnectPagerDuty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { const { data } = await api.delete('/pagerduty/disconnect'); return data.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pagerduty'] }),
  });
}

export function useValidatePdKey() {
  return useMutation({
    mutationFn: async (apiKey: string) => {
      const { data } = await api.post('/pagerduty/validate', { apiKey });
      return data.data;
    },
  });
}
