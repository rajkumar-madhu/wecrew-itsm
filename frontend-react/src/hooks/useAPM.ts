import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export function useApmOverview() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['apm', 'overview', orgId],
    queryFn: async () => { const { data } = await api.get('/apm/overview'); return data.data; },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
}

export function useApmProcessStatus() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['apm', 'process-status', orgId],
    queryFn: async () => { const { data } = await api.get('/apm/process-status'); return data.data; },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
}

export function useApmUrlStatus() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['apm', 'url-status', orgId],
    queryFn: async () => { const { data } = await api.get('/apm/url-status'); return data.data; },
    staleTime: 20000,
    refetchInterval: 60000,
    retry: false,
  });
}

export function useApmInfraMetrics() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['apm', 'infra', orgId],
    queryFn: async () => { const { data } = await api.get('/apm/infra-metrics'); return data.data; },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
}

export function useApmNetwork() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['apm', 'network', orgId],
    queryFn: async () => { const { data } = await api.get('/apm/network'); return data.data; },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
}

export function useApmK8sHealth() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['apm', 'k8s', orgId],
    queryFn: async () => { const { data } = await api.get('/apm/k8s-health'); return data.data; },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
}

export function useApmServices() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['apm', 'services', orgId],
    queryFn: async () => { const { data } = await api.get('/apm/services'); return data.data; },
    staleTime: 20000,
    refetchInterval: 60000,
    retry: false,
  });
}

export function useApmActiveAlerts() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['apm', 'alerts', orgId],
    queryFn: async () => { const { data } = await api.get('/apm/active-alerts'); return data.data; },
    staleTime: 10000,
    refetchInterval: 15000,
    retry: false,
  });
}

export function useAddApmAnnotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { processKey: string; subsite: string; processName: string; message: string; statusCode: number }) => {
      const { data } = await api.post('/apm/annotations', payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apm'] }),
  });
}
