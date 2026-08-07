import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useClusterHealth() {
  return useQuery({
    queryKey: ['ai-agent', 'cluster-health'],
    queryFn: async () => {
      const { data } = await api.get('/ai/cluster-health');
      return data;
    },
    retry: 1,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useServerAnalysis() {
  return useQuery({
    queryKey: ['ai-agent', 'server-analysis'],
    queryFn: async () => {
      const { data } = await api.get('/ai/server-analysis');
      return data;
    },
    retry: 1,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useDBAnalysis() {
  return useQuery({
    queryKey: ['ai-agent', 'db-analysis'],
    queryFn: async () => {
      const { data } = await api.get('/ai/db-analysis');
      return data;
    },
    retry: 1,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useLogAnalysis() {
  return useQuery({
    queryKey: ['ai-agent', 'log-analysis'],
    queryFn: async () => {
      const { data } = await api.get('/ai/log-analysis');
      return data;
    },
    retry: 1,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useResolutionDetails(incidentId: string | undefined) {
  return useQuery({
    queryKey: ['ai-agent', 'resolution-details', incidentId],
    queryFn: async () => {
      const { data } = await api.get(`/ai/incidents/${incidentId}/resolution-details`);
      return data;
    },
    enabled: !!incidentId,
    retry: 1,
    staleTime: 300_000,
  });
}

export function useAITips() {
  return useQuery({
    queryKey: ['ai-agent', 'tips'],
    queryFn: async () => {
      const { data } = await api.get('/ai/tips');
      return data;
    },
    retry: 1,
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

export function useGrafanaDashboards() {
  return useQuery({
    queryKey: ['ai', 'grafana-dashboards'],
    queryFn: async () => {
      const { data } = await api.get('/ai/grafana-dashboards');
      return data;
    },
    retry: 1,
    staleTime: 300_000,
  });
}

export function useInfrastructureMetrics(enabled = true) {
  return useQuery({
    queryKey: ['ai', 'infrastructure-metrics'],
    queryFn: async () => {
      const { data } = await api.get('/ai/infrastructure-metrics');
      return data;
    },
    enabled,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
