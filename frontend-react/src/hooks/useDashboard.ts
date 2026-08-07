import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => { const { data } = await api.get('/dashboard/stats'); return data; },
    staleTime: 30000,
  });
}

export function useDashboardTrends(days: number = 7) {
  return useQuery({
    queryKey: ['dashboard', 'incident-trend', days],
    queryFn: async () => { const { data } = await api.get(`/dashboard/incident-trend?days=${days}`); return data; },
    staleTime: 60000,
  });
}

export function useSLACompliance() {
  return useQuery({
    queryKey: ['dashboard', 'sla-compliance'],
    queryFn: async () => { const { data } = await api.get('/dashboard/sla-compliance'); return data; },
    staleTime: 60000,
  });
}
