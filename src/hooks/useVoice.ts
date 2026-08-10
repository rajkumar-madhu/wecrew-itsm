import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useVoiceCallLogs(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['voice', 'calls', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') params.append(k, String(v)); });
      const { data } = await api.get(`/voice/calls?${params}`);
      return data;
    },
    staleTime: 30000,
  });
}

export function useVoiceStats() {
  return useQuery({
    queryKey: ['voice', 'stats'],
    queryFn: async () => { const { data } = await api.get('/voice/stats'); return data; },
    staleTime: 30000,
  });
}

export function useVoiceLanguages() {
  return useQuery({
    queryKey: ['voice', 'languages'],
    queryFn: async () => { const { data } = await api.get('/voice/languages'); return data; },
    staleTime: 300000,
  });
}

export function useVoiceHealth() {
  return useQuery({
    queryKey: ['voice', 'health'],
    queryFn: async () => { const { data } = await api.get('/voice/health'); return data; },
    staleTime: 15000,
  });
}

export function useTranscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ audio, language }: { audio: File; language?: string }) => {
      const form = new FormData();
      form.append('audio', audio);
      if (language) form.append('language', language);
      const { data } = await api.post('/voice/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice'] }); },
  });
}

export function useSynthesize() {
  return useMutation({
    mutationFn: async (payload: { text: string; language?: string; voice?: string }) => {
      const { data } = await api.post('/voice/synthesize', payload, {
        responseType: 'blob',
        timeout: 60000,
      });
      return data;
    },
  });
}

export function useMakeCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { to: string; record?: boolean }) => {
      const { data } = await api.post('/voice/call', payload);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice'] }); },
  });
}
