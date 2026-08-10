import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useOrganizations(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['organizations', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') params.append(k, String(v)); });
      const { data } = await api.get(`/organizations?${params}`);
      return data;
    },
    staleTime: 60000,
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: ['organizations', 'detail', id],
    queryFn: async () => { const { data } = await api.get(`/organizations/${id}`); return data; },
    staleTime: 60000,
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string; environment?: string; serverIp?: string; fqdn?: string; description?: string }) => {
      const { data } = await api.post('/organizations', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: Record<string, any> }) => {
      const { data } = await api.patch(`/organizations/${id}`, d);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}
