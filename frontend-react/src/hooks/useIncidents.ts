import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const keys = {
  all: ['incidents'] as const,
  list: (f: any) => [...keys.all, 'list', f] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
  timeline: (id: string) => [...keys.all, 'timeline', id] as const,
  liveContext: (id: string) => [...keys.all, 'live-context', id] as const,
  escalationLogs: (id: string) => [...keys.all, 'escalation-logs', id] as const,
};

export function useIncidents(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') params.append(k, String(v)); });
      const { data } = await api.get(`/incidents?${params}`);
      return data;
    },
    staleTime: 30000,
  });
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => { const { data } = await api.get(`/incidents/${id}`); return data; },
    staleTime: 60000,
    enabled: !!id,
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => { const { data } = await api.post('/incidents', input); return data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: any }) => { const { data } = await api.patch(`/incidents/${id}`, d); return data; },
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: keys.detail(v.id) }); qc.invalidateQueries({ queryKey: keys.all }); },
  });
}

export function useAddWorkNote(incidentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: { content: string; isInternal?: boolean }) => { const { data } = await api.post(`/incidents/${incidentId}/notes`, note); return data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.detail(incidentId) }); qc.invalidateQueries({ queryKey: keys.timeline(incidentId) }); },
  });
}

export function useIncidentTimeline(id: string) {
  return useQuery({
    queryKey: keys.timeline(id),
    queryFn: async () => { const { data } = await api.get(`/incidents/${id}/timeline`); return data; },
    staleTime: 30000,
    enabled: !!id,
  });
}

export function useIncidentLiveContext(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: keys.liveContext(id),
    queryFn: async () => { const { data } = await api.get(`/incidents/${id}/live-context`); return data.data; },
    staleTime: 15000,
    refetchInterval: 30000,
    enabled: !!id && enabled,
    retry: 1,
  });
}

export function useEscalationLogs(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: keys.escalationLogs(id),
    queryFn: async () => { const { data } = await api.get(`/incidents/${id}/escalation-logs`); return data.data; },
    staleTime: 15000,
    refetchInterval: 30000,
    enabled: !!id && enabled,
    retry: 1,
  });
}
