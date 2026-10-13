import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
export type ArticleState = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'RETIRED';
export type ArticleAudience = 'INTERNAL' | 'PORTAL';
export type ArticleAction = 'submit' | 'publish' | 'reject' | 'retire' | 'restore';

export interface ArticlePerson {
  id: string;
  firstName: string;
  lastName: string;
}

export interface KnowledgeArticleSummary {
  id: string;
  number: string;
  title: string;
  category: string | null;
  tags: string[];
  state: ArticleState;
  audience: ArticleAudience;
  version: number;
  helpfulYes: number;
  helpfulNo: number;
  viewCount: number;
  updatedAt: string;
  publishedAt: string | null;
  author: ArticlePerson | null;
}

export interface KnowledgeArticle extends KnowledgeArticleSummary {
  body: string;
  authorId: string | null;
  sourceIncidentId: string | null;
  myFeedback: boolean | null;
  createdAt?: string;
}

export interface KnowledgeFilters {
  q?: string;
  state?: ArticleState[];
  audience?: ArticleAudience | '';
  page?: number;
  limit?: number;
}

export interface KnowledgeListResponse {
  success: boolean;
  data: KnowledgeArticleSummary[];
  pagination?: { total: number; page: number; limit: number; totalPages: number };
}

export interface ArticleInput {
  title: string;
  body: string;
  category?: string;
  tags?: string[];
  audience?: ArticleAudience;
  sourceIncidentId?: string;
}

export const STATE_LABEL: Record<ArticleState, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  PUBLISHED: 'Published',
  RETIRED: 'Retired',
};

export const AUDIENCE_LABEL: Record<ArticleAudience, string> = { INTERNAL: 'Internal', PORTAL: 'Portal' };

/** Pulls the user-readable message out of an API error. */
export function knowledgeErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: unknown } }; message?: string };
  const msg = e?.response?.data?.error;
  return typeof msg === 'string' && msg ? msg : fallback;
}

const keys = {
  all: ['knowledge'] as const,
  list: (f: KnowledgeFilters) => [...keys.all, 'list', f] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────
export function useKnowledgeArticles(filters: KnowledgeFilters = {}) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async (): Promise<KnowledgeListResponse> => {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.state && filters.state.length) params.set('state', filters.state.join(','));
      if (filters.audience) params.set('audience', filters.audience);
      if (filters.page) params.set('page', String(filters.page));
      params.set('limit', String(filters.limit ?? 50));
      const { data } = await api.get(`/knowledge?${params}`);
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });
}

export function useKnowledgeArticle(id: string | null | undefined) {
  return useQuery({
    queryKey: keys.detail(id || ''),
    queryFn: async (): Promise<KnowledgeArticle> => {
      const { data } = await api.get(`/knowledge/${id}`);
      return data.data;
    },
    enabled: !!id,
    staleTime: 30000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ArticleInput): Promise<KnowledgeArticle> => {
      const { data } = await api.post('/knowledge', input);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ArticleInput> }): Promise<KnowledgeArticle> => {
      const { data } = await api.patch(`/knowledge/${id}`, input);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useArticleTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: ArticleAction }): Promise<KnowledgeArticle> => {
      const { data } = await api.post(`/knowledge/${id}/${action}`);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useArticleFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }): Promise<{ helpfulYes: number; helpfulNo: number }> => {
      const { data } = await api.post(`/knowledge/${id}/feedback`, { helpful });
      return data.data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: keys.detail(v.id) });
      qc.invalidateQueries({ queryKey: [...keys.all, 'list'] });
    },
  });
}

/** Creates a DRAFT article from a RESOLVED/CLOSED incident. */
export function useArticleFromIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incidentId: string): Promise<KnowledgeArticle> => {
      const { data } = await api.post(`/knowledge/from-incident/${incidentId}`);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
