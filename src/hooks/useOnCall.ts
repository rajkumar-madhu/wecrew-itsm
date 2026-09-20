import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { fetchCensus } from '../lib/census';

/**
 * An on-call schedule row as the API returns it — not a domain type.
 * `/teams/on-call/overview` includes `team`; `/on-call/history` does not, so
 * that field is optional here.
 */
export interface OnCallScheduleRow {
  id: string;
  teamId: string;
  userId: string;
  isPrimary: boolean;
  startTime: string;
  endTime: string;
  user?: { id: string; firstName?: string; lastName?: string };
  team?: { id: string; name?: string };
}

const keys = {
  overview: ['oncall', 'overview'] as const,
  schedules: (teamId: string) => ['oncall', 'schedules', teamId] as const,
  escalation: (teamId: string) => ['oncall', 'escalation', teamId] as const,
  history: (teamId: string, page?: number) => ['oncall', 'history', teamId, page] as const,
  roster: (teamId: string) => ['oncall', 'roster', teamId] as const,
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

/**
 * A team's whole rota — every shift, past and future — walked a page at a time.
 *
 * The coverage ribbon cannot be built from `/teams/on-call/overview`: that
 * endpoint filters to `startTime <= now && endTime >= now`, so it only ever
 * returns the shifts running at this instant. Painting a week from it reports a
 * fully-staffed team as almost entirely uncovered, and every week other than the
 * current one as 168/168 uncovered.
 */
export function useOnCallRota<T = unknown>(teamId: string) {
  return useQuery({
    queryKey: keys.rota(teamId),
    queryFn: () =>
      fetchAllPages<T>(`/teams/${teamId}/on-call/history`, {
        // This endpoint wraps its array: `{ data: { schedules, recentIncidents } }`.
        select: (body) => (body?.data as { schedules?: T[] } | undefined)?.schedules ?? [],
        maxPages: 10,
      }),
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

/**
 * A team's whole rota, for the week coverage ribbon.
 *
 * `/teams/on-call/overview` and `/teams/{id}/on-call` both filter to
 * `startTime <= now <= endTime` — they answer "who holds the pager right now".
 * Drawing a 168-hour week from them reported almost every hour as uncovered
 * even for a team with clean 24x7 cover. `/on-call/history` is the only
 * endpoint that returns the roster unfiltered by date.
 */
export function useOnCallRoster(teamId: string) {
  return useQuery({
    queryKey: keys.roster(teamId),
    queryFn: () =>
      fetchCensus<OnCallScheduleRow>(
        `/teams/${teamId}/on-call/history`,
        {},
        (d) => (d as { schedules?: OnCallScheduleRow[] })?.schedules ?? [],
      ),
    staleTime: 60000,
    enabled: !!teamId,
  });
}
