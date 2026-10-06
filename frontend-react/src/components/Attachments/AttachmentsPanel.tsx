import { useRef, useState } from 'react';
import {
  Paperclip, Upload, Download, Trash2, Loader2, AlertTriangle,
  FileText, FileImage, FileSpreadsheet, FileCode,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  useAttachments, useUploadAttachments, useDeleteAttachment, downloadAttachment,
  type AttachmentParent, type TicketAttachment,
} from '../../hooks/useAttachments';
import apiErrorMessage from '../Auth/apiErrorMessage';

// Mirrors backend ALLOWED_FILE_TYPES / MAX_FILE_SIZE so most mistakes are caught
// before the upload; the server still decides.
const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.log,.json,.yaml,.yml';
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

// Roles that may edit (and so attach to) each kind of ticket — see PERMISSIONS.
const CAN_ATTACH: Record<AttachmentParent, string[]> = {
  incidents: ['ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR'],
  changes: ['ADMIN', 'MANAGER', 'ENGINEER'],
  problems: ['ADMIN', 'MANAGER', 'ENGINEER'],
};
const CAN_DELETE_ANY = ['ADMIN', 'MANAGER'];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return FileImage;
  if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv') return FileSpreadsheet;
  if (mime.includes('json') || mime.includes('yaml')) return FileCode;
  return FileText;
}

export default function AttachmentsPanel({ type, id }: { type: AttachmentParent; id: string }) {
  const user = useAuthStore((s) => s.user);
  const { data: files = [], isLoading, isError } = useAttachments(type, id);
  const upload = useUploadAttachments(type, id);
  const remove = useDeleteAttachment(type, id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canAttach = !!user && CAN_ATTACH[type].includes(user.role);
  const canDelete = (f: TicketAttachment) =>
    !!user && (CAN_DELETE_ANY.includes(user.role) || (f.uploadedBy?.id === user.id && canAttach));

  const send = async (list: FileList | File[]) => {
    const chosen = Array.from(list);
    if (!chosen.length) return;
    setError('');
    if (chosen.length > MAX_FILES) { setError(`Upload up to ${MAX_FILES} files at a time`); return; }
    const tooBig = chosen.find((f) => f.size > MAX_BYTES);
    if (tooBig) { setError(`${tooBig.name} is larger than 10 MB`); return; }
    try {
      await upload.mutateAsync(chosen);
    } catch (err) {
      setError(apiErrorMessage(err, 'Upload failed. Try again.'));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDownload = async (f: TicketAttachment) => {
    setBusyId(f.id); setError('');
    try { await downloadAttachment(f); } catch { setError(`Could not download ${f.originalName}`); }
    finally { setBusyId(null); }
  };

  const onDelete = async (f: TicketAttachment) => {
    if (!window.confirm(`Delete ${f.originalName}? This can't be undone.`)) return;
    setBusyId(f.id); setError('');
    try { await remove.mutateAsync(f.id); } catch (err) { setError(apiErrorMessage(err, 'Could not delete the file')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3 rounded-xl bg-[#FAFBFC] border border-[#E2E8F0] p-4">
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-[#64748B]" />
        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-display">
          Files {files.length > 0 && `(${files.length})`}
        </h4>
      </div>

      {canAttach && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); send(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${dragging ? 'border-[#4F46E5] bg-[#EEF2FF]' : 'border-[#CBD5E1] bg-[#FFFFFF]'}`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files && send(e.target.files)}
            aria-label="Choose files to attach"
          />
          {upload.isPending ? (
            <p className="text-xs text-[#475569] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</p>
          ) : (
            <>
              <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary text-sm inline-flex items-center gap-2">
                <Upload className="w-4 h-4" /> Attach files
              </button>
              <p className="text-[11px] text-[#94A3B8] mt-2">
                or drop them here · up to {MAX_FILES} files, 10 MB each · images, PDF, Office, text, logs, JSON, YAML
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-[#EF4444] flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-[#94A3B8] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading files…</p>
      ) : isError ? (
        <p className="text-xs text-[#EF4444]">Couldn't load files.</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-[#94A3B8]">No files attached yet.</p>
      ) : (
        <ul className="divide-y divide-[#F1F5F9] rounded-xl border border-[#F1F5F9] bg-[#FFFFFF]">
          {files.map((f) => {
            const Icon = iconFor(f.mimeType);
            const busy = busyId === f.id;
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon className="w-4 h-4 shrink-0 text-[#64748B]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F172A] truncate" title={f.originalName}>{f.originalName}</p>
                  <p className="text-[11px] text-[#94A3B8]">
                    {formatSize(f.size)}
                    {f.uploadedBy && ` · ${f.uploadedBy.firstName} ${f.uploadedBy.lastName}`}
                    {` · ${new Date(f.createdAt).toLocaleString()}`}
                  </p>
                </div>
                <button type="button" onClick={() => onDownload(f)} disabled={busy} aria-label={`Download ${f.originalName}`}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#4F46E5] hover:bg-[#EEF2FF] disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
                {canDelete(f) && (
                  <button type="button" onClick={() => onDelete(f)} disabled={busy} aria-label={`Delete ${f.originalName}`}
                    className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
