import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const keys = {
  overview: ['oncall', 'overview'] as const,
  schedules: (teamId: string) => ['oncall', 'schedules', teamId] as const,
  escalation: (teamId: string) => ['oncall', 'escalation', teamId] as const,
  history: (teamId: string, page?: number) => ['oncall', 'history', teamId, page] as const,
};

export function useOnCallOverview() {
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => {
      const { data } = await api.get('/teams/on-call/overview');
      return data;
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });
}

export function useOnCallSchedules(teamId: string) {
  return useQuery({
    queryKey: keys.schedules(teamId),
    queryFn: async () => {
      const { data } = await api.get(`/teams/${teamId}/on-call`);
      return data;
    },
    staleTime: 30000,
    enabled: !!teamId,
  });
}

export function useEscalationPolicies(teamId: string) {
  return useQuery({
    queryKey: keys.escalation(teamId),
    queryFn: async () => {
      const { data } = await api.get(`/teams/${teamId}/escalation`);
      return data;
    },
    staleTime: 60000,
    enabled: !!teamId,
  });
}

export function useOnCallHistory(teamId: string, page: number = 1) {
  return useQuery({
    queryKey: keys.history(teamId, page),
    queryFn: async () => {
      const { data } = await api.get(`/teams/${teamId}/on-call/history?page=${page}&limit=20`);
      return data;
    },
    staleTime: 30000,
    enabled: !!teamId,
  });
}

export function useCreateOnCallSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, ...body }: { teamId: string; userId: string; startTime: string; endTime: string; isPrimary?: boolean }) => {
      const { data } = await api.post(`/teams/${teamId}/on-call`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oncall'] });
    },
  });
}
