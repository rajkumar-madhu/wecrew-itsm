import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useAssets(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['assets', 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') params.append(k, String(v)); });
      const { data } = await api.get(`/assets?${params}`);
      return data;
    },
    staleTime: 30000,
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: ['assets', 'detail', id],
    queryFn: async () => { const { data } = await api.get(`/assets/${id}`); return data; },
    staleTime: 60000, enabled: !!id,
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => { const { data } = await api.post('/assets', input); return data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets', 'list'] }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: any }) => { const { data } = await api.patch(`/assets/${id}`, d); return data; },
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ['assets', 'detail', v.id] }); qc.invalidateQueries({ queryKey: ['assets', 'list'] }); },
  });
}

export function useAssetLiveMetrics(id: string) {
  return useQuery({
    queryKey: ['assets', 'live-metrics', id],
    queryFn: async () => { const { data } = await api.get(`/ai/assets/${id}/live-metrics`); return data; },
    staleTime: 15000,
    refetchInterval: 30000,
    enabled: !!id,
  });
}

export function useAssetMetricsHistory(id: string, duration = '6h') {
  return useQuery({
    queryKey: ['assets', 'metrics-history', id, duration],
    queryFn: async () => { const { data } = await api.get(`/ai/assets/${id}/metrics-history`, { params: { duration } }); return data; },
    staleTime: 60000,
    enabled: !!id,
  });
}

export function useAssetStats() {
  return useQuery({
    queryKey: ['assets', 'stats'],
    queryFn: async () => { const { data } = await api.get('/assets/stats'); return data; },
    staleTime: 60000,
  });
}
