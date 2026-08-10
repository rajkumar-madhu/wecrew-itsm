import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../lib/socket';

/**
 * Hook that connects Socket.IO events to TanStack Query cache invalidation.
 * Mount once in Layout.tsx to enable real-time updates across all pages.
 */
export function useRealtime() {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = socket;

    // Incident events
    s.on('incident:created', () => {
      queryClient.invalidateQueries({ queryKey: ['incidents', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });
    s.on('incident:updated', (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['incidents', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['incidents', 'detail', data?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    // Change events
    s.on('change:created', () => {
      queryClient.invalidateQueries({ queryKey: ['changes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });
    s.on('change:updated', (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['changes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['changes', 'detail', data?.id] });
    });

    // Problem events
    s.on('problem:created', () => {
      queryClient.invalidateQueries({ queryKey: ['problems', 'list'] });
    });
    s.on('problem:updated', (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['problems', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['problems', 'detail', data?.id] });
    });

    // Alert events
    s.on('alert:fired', () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });
    s.on('alert:resolved', () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    });
    s.on('alert:acknowledged', () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    });

    // Asset events
    s.on('asset:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    });

    // Voice events
    s.on('voice:call-completed', () => {
      queryClient.invalidateQueries({ queryKey: ['voice'] });
      queryClient.invalidateQueries({ queryKey: ['incidents', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    // Notification events
    s.on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      s.off('incident:created');
      s.off('incident:updated');
      s.off('change:created');
      s.off('change:updated');
      s.off('problem:created');
      s.off('problem:updated');
      s.off('alert:fired');
      s.off('alert:resolved');
      s.off('alert:acknowledged');
      s.off('asset:updated');
      s.off('voice:call-completed');
      s.off('notification:new');
    };
  }, [socket, queryClient]);
}
