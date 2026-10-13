import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────
export type RequestState =
  | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_FULFILLMENT'
  | 'FULFILLED' | 'REJECTED' | 'CANCELLED';

export type FormFieldType = 'text' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox';

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
}

export interface TeamRef { id: string; name: string }
export interface UserRef { id: string; firstName: string; lastName: string; email?: string }

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  formSchema: FormField[] | null;
  requiresApproval: boolean;
  approverTeamId: string | null;
  fulfillmentTeamId: string | null;
  fulfillmentHours: number | null;
  isActive: boolean;
  approverTeam?: TeamRef | null;
  fulfillmentTeam?: TeamRef | null;
  _count?: { requests: number };
}

export type CatalogItemInput = Omit<CatalogItem, 'id' | 'approverTeam' | 'fulfillmentTeam' | '_count'>;

export interface RequestApproval {
  id: string;
  state: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  comments: string | null;
  decidedAt: string | null;
  approver: UserRef;
}

export interface RequestComment {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: UserRef | null;
}

export interface ServiceRequest {
  id: string;
  number: string;
  title: string;
  state: RequestState;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  formData: Record<string, unknown> | null;
  description: string | null;
  resolutionNotes: string | null;
  csatScore: number | null;
  csatComment?: string | null;
  catalogItem: { id: string; name: string; category: string | null; formSchema: FormField[] | null } | null;
  requestedBy: UserRef | null;
  assignedTo?: UserRef | null;
  assignedToId?: string | null;
  fulfillmentTeam?: TeamRef | null;
  fulfillmentTeamId?: string | null;
  approvals?: RequestApproval[];
  comments?: RequestComment[];
}

export interface Pagination { total: number; page: number; limit: number; totalPages: number }

export interface RequestFilters {
  page?: number;
  limit?: number;
  state?: string;
  mine?: boolean;
  approvals?: boolean;
  search?: string;
}

export interface AgentOption { id: string; firstName: string; lastName: string; role: string }

export const TERMINAL_STATES: RequestState[] = ['FULFILLED', 'REJECTED', 'CANCELLED'];
export const OPEN_STATES: RequestState[] = ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'IN_FULFILLMENT'];

/** Agent PATCH transitions (approve/reject of PENDING_APPROVAL goes through /decision). */
export const NEXT_STATES: Record<RequestState, RequestState[]> = {
  SUBMITTED: ['IN_FULFILLMENT', 'CANCELLED'],
  PENDING_APPROVAL: ['CANCELLED'],
  APPROVED: ['IN_FULFILLMENT', 'FULFILLED', 'CANCELLED'],
  IN_FULFILLMENT: ['FULFILLED', 'CANCELLED'],
  FULFILLED: [],
  REJECTED: [],
  CANCELLED: [],
};

/** Label + colours for the state pill (text is always shown, colour is secondary). */
export const STATE_META: Record<RequestState, { label: string; color: string; bg: string; border: string }> = {
  SUBMITTED:        { label: 'Submitted',        color: '#93C5FD', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)' },
  PENDING_APPROVAL: { label: 'Pending approval', color: '#FCD34D', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  APPROVED:         { label: 'Approved',         color: '#A5B4FC', bg: 'rgba(99,102,241,0.14)',  border: 'rgba(99,102,241,0.4)' },
  IN_FULFILLMENT:   { label: 'In fulfilment',    color: '#C4B5FD', bg: 'rgba(139,92,246,0.14)',  border: 'rgba(139,92,246,0.4)' },
  FULFILLED:        { label: 'Fulfilled',        color: '#6EE7B7', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)' },
  REJECTED:         { label: 'Rejected',         color: '#FDA4AF', bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.35)' },
  CANCELLED:        { label: 'Cancelled',        color: '#A9BCCD', bg: 'rgba(138,171,196,0.1)',  border: 'rgba(138,171,196,0.3)' },
};

export function personName(u: { firstName?: string; lastName?: string } | null | undefined): string {
  if (!u) return '';
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
}

export function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error || fallback;
}

const keys = {
  requests: ['requests'] as const,
  list: (f: RequestFilters) => ['requests', 'list', f] as const,
  detail: (id: string) => ['requests', 'detail', id] as const,
  catalog: ['catalog'] as const,
  catalogList: (activeOnly: boolean) => ['catalog', 'list', activeOnly] as const,
};

function toParams(filters: object): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== '' && v !== false) params.append(k, String(v));
  });
  return params.toString();
}

// ── Requests ───────────────────────────────────────────────────────────────────
export function useRequests(filters: RequestFilters = {}) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () => {
      const { data } = await api.get(`/requests?${toParams(filters)}`);
      return {
        rows: (data.data ?? []) as ServiceRequest[],
        pagination: (data.pagination ?? null) as Pagination | null,
      };
    },
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });
}

/** Cheap count for a saved-view chip (fetches a single row and reads pagination.total). */
export function useRequestCount(filters: Omit<RequestFilters, 'page' | 'limit'>) {
  return useQuery({
    queryKey: ['requests', 'count', filters] as const,
    queryFn: async () => {
      const { data } = await api.get(`/requests?${toParams({ ...filters, page: 1, limit: 1 })}`);
      const p = data.pagination as Pagination | undefined;
      return p?.total ?? (Array.isArray(data.data) ? data.data.length : 0);
    },
    staleTime: 60000,
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/requests/${id}`);
      return data.data as ServiceRequest;
    },
    enabled: !!id,
    staleTime: 15000,
  });
}

export interface RequestUpdate {
  state?: RequestState;
  assignedToId?: string | null;
  fulfillmentTeamId?: string | null;
  resolutionNotes?: string;
}

export function useUpdateRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: RequestUpdate) => {
      const { data } = await api.patch(`/requests/${id}`, body);
      return data.data as ServiceRequest;
    },
    onSuccess: (req) => {
      if (req) qc.setQueryData(keys.detail(id), req);
      qc.invalidateQueries({ queryKey: keys.requests });
    },
  });
}

export function useRequestDecision(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { decision: 'approve' | 'reject'; comments?: string }) => {
      const { data } = await api.post(`/requests/${id}/decision`, body);
      return data.data as ServiceRequest;
    },
    onSuccess: (req) => {
      if (req) qc.setQueryData(keys.detail(id), req);
      qc.invalidateQueries({ queryKey: keys.requests });
    },
  });
}

export function useAddRequestComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { body: string; isInternal: boolean }) => {
      const { data } = await api.post(`/requests/${id}/comments`, body);
      return data.data as RequestComment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.detail(id) }),
  });
}

// ── Catalog ────────────────────────────────────────────────────────────────────
export function useCatalogItems(activeOnly = false) {
  return useQuery({
    queryKey: keys.catalogList(activeOnly),
    queryFn: async () => {
      const { data } = await api.get(`/catalog${activeOnly ? '?active=true' : ''}`);
      const d = data.data;
      return (Array.isArray(d) ? d : d?.items ?? []) as CatalogItem[];
    },
    staleTime: 30000,
  });
}

export function useCreateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CatalogItemInput) => {
      const { data } = await api.post('/catalog', body);
      return data.data as CatalogItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.catalog }),
  });
}

export function useUpdateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: body }: { id: string; data: Partial<CatalogItemInput> }) => {
      const { data } = await api.patch(`/catalog/${id}`, body);
      return data.data as CatalogItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.catalog }),
  });
}

// ── Pickers ────────────────────────────────────────────────────────────────────
/** Teams for selects. `/teams` returns either an array or `{ teams: [...] }`. */
export function useTeamOptions() {
  return useQuery({
    queryKey: ['teams', 'options'] as const,
    queryFn: async () => {
      const { data } = await api.get('/teams?limit=100');
      const d = data.data;
      const list = (Array.isArray(d) ? d : d?.teams ?? []) as TeamRef[];
      return list.map((t) => ({ id: t.id, name: t.name }));
    },
    staleTime: 120000,
  });
}

/** Agents (every user except REQUESTER) for the assignee picker. */
export function useAgentOptions() {
  return useQuery({
    queryKey: ['users', 'agent-options'] as const,
    queryFn: async () => {
      const { data } = await api.get('/auth/users?limit=100');
      const d = data.data;
      const list = (Array.isArray(d) ? d : d?.users ?? []) as AgentOption[];
      return list.filter((u) => u.role !== 'REQUESTER');
    },
    staleTime: 120000,
  });
}
