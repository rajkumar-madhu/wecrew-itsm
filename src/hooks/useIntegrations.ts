import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useIntegrations(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['integrations', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') params.append(k, String(v)); });
      const { data } = await api.get(`/integrations?${params}`);
      return data;
    },
    staleTime: 30000,
  });
}

export function useIntegration(id: string) {
  return useQuery({
    queryKey: ['integrations', 'detail', id],
    queryFn: async () => { const { data } = await api.get(`/integrations/${id}`); return data; },
    staleTime: 60000,
    enabled: !!id,
  });
}

export function useCreateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; type: string; config?: string }) => {
      const { data } = await api.post('/integrations', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useUpdateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: Record<string, any> }) => {
      const { data } = await api.patch(`/integrations/${id}`, d);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/integrations/${id}/test`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}
