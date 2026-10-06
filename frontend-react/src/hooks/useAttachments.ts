// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Ticket attachments (incidents, changes, problems)
// ═══════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';

export type AttachmentParent = 'incidents' | 'changes' | 'problems';

export interface TicketAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: string; firstName: string; lastName: string } | null;
}

const key = (type: AttachmentParent, id: string) => ['attachments', type, id] as const;

export function useAttachments(type: AttachmentParent, id: string | undefined) {
  return useQuery({
    queryKey: key(type, id || ''),
    queryFn: async (): Promise<TicketAttachment[]> => {
      const { data } = await api.get(`/attachments/${type}/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

// The panel shows upload/delete errors inline; a no-op onError keeps the
// global mutation toast from repeating them.
const inlineErrors = () => {};

export function useUploadAttachments(type: AttachmentParent, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      // Override the instance's JSON default, or axios serialises the FormData
      // to JSON; axios then drops this header so the browser adds the boundary.
      const { data } = await api.post(`/attachments/${type}/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000,
      });
      return data.data as TicketAttachment[];
    },
    onSuccess: (added) => {
      qc.invalidateQueries({ queryKey: key(type, id) });
      toast.success(added.length === 1 ? 'File attached' : `${added.length} files attached`);
    },
    onError: inlineErrors,
  });
}

export function useDeleteAttachment(type: AttachmentParent, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string) => { await api.delete(`/attachments/${attachmentId}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(type, id) }),
    onError: inlineErrors,
  });
}

/** Fetch with the auth header (a plain link can't send it), then save via a blob URL. */
export async function downloadAttachment(att: TicketAttachment) {
  const { data } = await api.get(`/attachments/${att.id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = att.originalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
