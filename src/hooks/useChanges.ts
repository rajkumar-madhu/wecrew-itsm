import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { fetchCensus } from '../lib/census';
import type { Change } from '../types';

const keys = {
  all: ['changes'] as const,
  list: (f: any) => [...keys.all, 'list', f] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
  census: (f: Record<string, unknown>) => [...keys.all, 'census', f] as const,
};

export function useChanges(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') params.append(k, String(v)); });
      const { data } = await api.get(`/changes?${params}`);
      return data;
    },
    staleTime: 30000,
  });
}

export function useChange(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => { const { data } = await api.get(`/changes/${id}`); return data; },
    staleTime: 60000, enabled: !!id,
  });
}

export function useCreateChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => { const { data } = await api.post('/changes', input); return data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: any }) => { const { data } = await api.patch(`/changes/${id}`, d); return data; },
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: keys.detail(v.id) }); qc.invalidateQueries({ queryKey: keys.all }); },
  });
}

/**
 * Every change matching `filters`, for the forward window and the calendar —
 * both draw one mark per change across a date range, so neither can work from a
 * single page. Bounded; see `lib/census.ts`.
 *
 * Note `sortOrder`, not `sortDir`: the controller reads `sortOrder` and
 * `validatePagination` only accepts that name.
 */
export function useChangeCensus<T = Change>(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: keys.census(filters),
    queryFn: () => fetchCensus<T>('/changes', filters),
    staleTime: 30000,
  });
}
