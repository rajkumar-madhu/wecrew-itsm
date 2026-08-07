import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

// ── Query Hooks (org-aware query keys) ───────────────────

export function usePipelineStatus() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['agent-pipeline', 'status', orgId],
    queryFn: async () => { const { data } = await api.get('/agent/status'); return data.data; },
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function usePipelineActions() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['agent-pipeline', 'actions', orgId],
    queryFn: async () => { const { data } = await api.get('/agent/actions'); return data.data; },
    staleTime: 60000,
  });
}

export function usePipelineNotifications() {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['agent-pipeline', 'notifications', orgId],
    queryFn: async () => { const { data } = await api.get('/agent/notifications'); return data.data; },
    staleTime: 60000,
  });
}

export function usePipelineExecutions(limit = 50, offset = 0) {
  const orgId = useAuthStore((s) => s.selectedOrgId);
  return useQuery({
    queryKey: ['agent-pipeline', 'executions', orgId, limit, offset],
    queryFn: async () => { const { data } = await api.get('/agent/executions', { params: { limit, offset } }); return data.data; },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

// ── Mutation Hooks ───────────────────────────────────────

export function useTogglePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => { const { data } = await api.post('/agent/toggle', { enabled }); return data.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-pipeline'] }),
  });
}

export function useToggleAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => { const { data } = await api.post(`/agent/actions/${id}/toggle`, { enabled }); return data.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-pipeline'] }),
  });
}

export function useToggleNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => { const { data } = await api.post(`/agent/notifications/${id}/toggle`, { enabled }); return data.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-pipeline'] }),
  });
}
