import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const keys = {
  all: ['problems'] as const,
  list: (f: any) => [...keys.all, 'list', f] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
};

export function useProblems(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') params.append(k, String(v)); });
      const { data } = await api.get(`/problems?${params}`);
      return data;
    },
    staleTime: 30000,
  });
}

export function useProblem(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => { const { data } = await api.get(`/problems/${id}`); return data; },
    staleTime: 60000, enabled: !!id,
  });
}

export function useCreateProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => { const { data } = await api.post('/problems', input); return data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: any }) => { const { data } = await api.patch(`/problems/${id}`, d); return data; },
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: keys.detail(v.id) }); qc.invalidateQueries({ queryKey: keys.all }); },
  });
}

export function useProblemStats() {
  return useQuery({
    queryKey: ['problems', 'stats'] as const,
    queryFn: async () => { const { data } = await api.get('/problems/stats'); return data; },
    staleTime: 30000,
  });
}

export function useAiRCA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (problemId: string) => { const { data } = await api.post(`/problems/${problemId}/ai-rca`); return data; },
    onSuccess: (_, problemId) => { qc.invalidateQueries({ queryKey: keys.detail(problemId) }); },
  });
}

export function useAlertKB() {
  return useQuery({
    queryKey: ['alerts', 'kb'] as const,
    queryFn: async () => { const { data } = await api.get('/alerts/kb'); return data; },
    staleTime: 300000,
  });
}

export function useKnowledgeBase() {
  return useQuery({
    queryKey: ['problems', 'kb'] as const,
    queryFn: async () => {
      const { data } = await api.get('/problems?limit=100&state=KNOWN_ERROR');
      return data;
    },
    staleTime: 60000,
  });
}
