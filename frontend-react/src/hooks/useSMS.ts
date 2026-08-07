import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useSMSLogs(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['sms', 'logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') params.append(k, String(v)); });
      const { data } = await api.get(`/sms/logs?${params}`);
      return data;
    },
    staleTime: 30000,
  });
}

export function useSMSStats() {
  return useQuery({
    queryKey: ['sms', 'stats'],
    queryFn: async () => { const { data } = await api.get('/sms/stats'); return data; },
    staleTime: 30000,
  });
}

export function useSMSProviders() {
  return useQuery({
    queryKey: ['sms', 'providers'],
    queryFn: async () => { const { data } = await api.get('/sms/providers'); return data; },
    staleTime: 60000,
  });
}

export function useSendSMS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { recipient: string; message: string; provider?: string; incidentId?: string }) => {
      const { data } = await api.post('/sms/send', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms'] });
    },
  });
}

export function useSendBulkSMS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { recipients: string[]; message: string; provider?: string }) => {
      const { data } = await api.post('/sms/bulk', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms'] });
    },
  });
}
