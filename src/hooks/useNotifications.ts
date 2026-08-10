// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Notifications Hook
// ═══════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const keys = {
  list:  (page: number) => ['notifications', 'list', page] as const,
  count: ()             => ['notifications', 'unread-count']  as const,
};

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// ── Unread count ──────────────────────────────────────────

export function useUnreadCount() {
  return useQuery({
    queryKey: keys.count(),
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return (data.data?.count ?? 0) as number;
    },
    staleTime: 30000,
    refetchInterval: 60000,   // poll every 60s as fallback
  });
}

// ── Notification list ─────────────────────────────────────

export function useNotifications(page = 1) {
  return useQuery({
    queryKey: keys.list(page),
    queryFn: async () => {
      const { data } = await api.get(`/notifications?page=${page}&limit=20`);
      return data as {
        data: { notifications: Notification[]; unreadCount: number };
        pagination: { total: number; pages: number };
      };
    },
    staleTime: 15000,
  });
}

// ── Mark single as read ───────────────────────────────────

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/notifications/${id}/read`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ── Mark all as read ──────────────────────────────────────

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/notifications/read-all');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
