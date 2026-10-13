import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox';

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
}

export type RequestState =
  | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_FULFILLMENT' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';

export type IncidentState =
  | 'NEW' | 'IN_PROGRESS' | 'ON_HOLD' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export type Urgency = 'low' | 'medium' | 'high';

export interface PersonRef {
  id?: string;
  firstName: string;
  lastName?: string;
}

export interface PortalCatalogItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  formSchema: FormField[] | null;
  requiresApproval: boolean;
  fulfillmentHours: number | null;
}

export interface PortalRequestSummary {
  id: string;
  number: string;
  title: string;
  state: RequestState;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  csatScore: number | null;
  catalogItem: { name: string; category: string | null } | null;
}

export interface PortalComment {
  id: string;
  body: string;
  createdAt: string;
  author: PersonRef | null;
}

export interface PortalRequestDetail extends PortalRequestSummary {
  formData: Record<string, unknown> | null;
  description: string | null;
  resolutionNotes: string | null;
  csatComment?: string | null;
  catalogItem: { name: string; category: string | null; formSchema: FormField[] | null } | null;
  assignedTo?: PersonRef | null;
  approvals: { state: string; decidedAt: string | null }[];
  comments: PortalComment[];
}

export interface PortalIncidentSummary {
  id: string;
  number: string;
  shortDescription: string;
  state: IncidentState;
  priority: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  csatScore: number | null;
}

export interface PortalWorkNote {
  id: string;
  content: string;
  createdAt: string;
  author: PersonRef | null;
}

export interface PortalIncidentDetail extends PortalIncidentSummary {
  description: string | null;
  resolutionNotes: string | null;
  csatComment: string | null;
  assignedTo?: PersonRef | null;
  workNotes: PortalWorkNote[];
}

export interface PortalArticleSummary {
  id: string;
  number: string;
  title: string;
  category: string | null;
  tags: string[] | null;
  updatedAt: string;
  helpfulYes: number;
}

export interface PortalArticle extends PortalArticleSummary {
  body: string;
  myFeedback: boolean | null;
}

export interface CreatePortalRequestInput {
  catalogItemId: string;
  title?: string;
  description?: string;
  formData: Record<string, unknown>;
}

export interface CreatePortalIncidentInput {
  shortDescription: string;
  description?: string;
  urgency: Urgency;
  category?: string;
}

export interface RatingInput {
  id: string;
  score: number;
  comment?: string;
}

/** Pull a user-readable message out of an axios error. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as { response?: { data?: { error?: unknown } }; message?: string };
  const msg = e?.response?.data?.error;
  return typeof msg === 'string' && msg ? msg : fallback;
}

function asArray<T>(d: unknown, key: string): T[] {
  if (Array.isArray(d)) return d as T[];
  const inner = (d as Record<string, unknown> | null)?.[key];
  return Array.isArray(inner) ? (inner as T[]) : [];
}

// ── Keys ─────────────────────────────────────────────────────────────────

export const portalKeys = {
  all: ['portal'] as const,
  catalog: () => ['portal', 'catalog'] as const,
  requests: () => ['portal', 'requests'] as const,
  request: (id: string) => ['portal', 'requests', id] as const,
  incidents: () => ['portal', 'incidents'] as const,
  incident: (id: string) => ['portal', 'incidents', id] as const,
  knowledge: (q: string) => ['portal', 'knowledge', 'list', q] as const,
  article: (id: string) => ['portal', 'knowledge', 'detail', id] as const,
};

// ── Catalog ──────────────────────────────────────────────────────────────

export function usePortalCatalog() {
  return useQuery({
    queryKey: portalKeys.catalog(),
    queryFn: async () => {
      const { data } = await api.get('/portal/catalog');
      return asArray<PortalCatalogItem>(data.data, 'items');
    },
    staleTime: 5 * 60_000,
  });
}

// ── Requests ─────────────────────────────────────────────────────────────

export function usePortalRequests() {
  return useQuery({
    queryKey: portalKeys.requests(),
    queryFn: async () => {
      const { data } = await api.get('/portal/requests');
      return asArray<PortalRequestSummary>(data.data, 'requests');
    },
    staleTime: 30_000,
  });
}

export function usePortalRequest(id: string | undefined) {
  return useQuery({
    queryKey: portalKeys.request(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/portal/requests/${id}`);
      return data.data as PortalRequestDetail;
    },
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreatePortalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePortalRequestInput) => {
      const { data } = await api.post('/portal/requests', input);
      return data.data as { id: string; number: string; state: RequestState };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portalKeys.requests() }),
  });
}

export function useAddPortalRequestComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { data } = await api.post(`/portal/requests/${id}/comments`, { body });
      return data.data as PortalComment;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: portalKeys.request(v.id) }),
  });
}

export function useCancelPortalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/portal/requests/${id}/cancel`);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portalKeys.requests() }),
  });
}

export function useRatePortalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, score, comment }: RatingInput) => {
      const { data } = await api.post(`/portal/requests/${id}/rating`, { score, ...(comment ? { comment } : {}) });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portalKeys.requests() }),
  });
}

// ── Incidents ────────────────────────────────────────────────────────────

export function usePortalIncidents() {
  return useQuery({
    queryKey: portalKeys.incidents(),
    queryFn: async () => {
      const { data } = await api.get('/portal/incidents');
      return asArray<PortalIncidentSummary>(data.data, 'incidents');
    },
    staleTime: 30_000,
  });
}

export function usePortalIncident(id: string | undefined) {
  return useQuery({
    queryKey: portalKeys.incident(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/portal/incidents/${id}`);
      return data.data as PortalIncidentDetail;
    },
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreatePortalIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePortalIncidentInput) => {
      const { data } = await api.post('/portal/incidents', input);
      return data.data as { id: string; number: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portalKeys.incidents() }),
  });
}

export function useAddPortalIncidentComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { data } = await api.post(`/portal/incidents/${id}/comments`, { body });
      return data.data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: portalKeys.incident(v.id) }),
  });
}

export function useRatePortalIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, score, comment }: RatingInput) => {
      const { data } = await api.post(`/portal/incidents/${id}/rating`, { score, ...(comment ? { comment } : {}) });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portalKeys.incidents() }),
  });
}

// ── Knowledge ────────────────────────────────────────────────────────────

/** Portal knowledge search. Pass `enabled: false` to skip fetching (e.g. empty search box). */
export function usePortalKnowledge(q: string, enabled = true) {
  return useQuery({
    queryKey: portalKeys.knowledge(q),
    queryFn: async () => {
      const params = q ? `?q=${encodeURIComponent(q)}` : '';
      const { data } = await api.get(`/portal/knowledge${params}`);
      return asArray<PortalArticleSummary>(data.data, 'articles');
    },
    enabled,
    staleTime: 60_000,
  });
}

export function usePortalArticle(id: string | undefined) {
  return useQuery({
    queryKey: portalKeys.article(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/portal/knowledge/${id}`);
      return data.data as PortalArticle;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function usePortalArticleFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => {
      const { data } = await api.post(`/portal/knowledge/${id}/feedback`, { helpful });
      return data.data as { helpfulYes: number; helpfulNo: number };
    },
    onSuccess: (_, v) => qc.setQueryData<PortalArticle>(portalKeys.article(v.id), (old) =>
      old ? { ...old, myFeedback: v.helpful } : old),
  });
}
