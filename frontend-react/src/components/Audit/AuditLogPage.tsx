import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSearch, Search, X, Filter, ChevronLeft, ChevronRight,
  User, Calendar, Globe,
} from 'lucide-react';
import api from '../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  newData?: any;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const ENTITY_TYPES = [
  'ALL', 'Incident', 'Change', 'Problem', 'Alert', 'Asset',
  'Team', 'User', 'Integration', 'Organization',
];

const ACTION_METHODS = ['ALL', 'POST', 'PATCH', 'PUT', 'DELETE'];

function methodFromAction(action: string): 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'GET' | 'OTHER' {
  if (action.startsWith('POST')) return 'POST';
  if (action.startsWith('PATCH')) return 'PATCH';
  if (action.startsWith('PUT')) return 'PUT';
  if (action.startsWith('DELETE')) return 'DELETE';
  if (action.startsWith('GET')) return 'GET';
  return 'OTHER';
}

const METHOD_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  POST:   { bg: 'rgba(16,185,129,0.1)',  text: '#059669', label: 'CREATE' },
  PATCH:  { bg: 'rgba(217,119,6,0.1)',   text: '#D97706', label: 'UPDATE' },
  PUT:    { bg: 'rgba(217,119,6,0.1)',   text: '#D97706', label: 'UPDATE' },
  DELETE: { bg: 'rgba(220,38,38,0.1)',   text: '#DC2626', label: 'DELETE' },
  GET:    { bg: 'rgba(99,102,241,0.1)',  text: '#4F46E5', label: 'READ' },
  OTHER:  { bg: '#F1F5F9',              text: '#64748B', label: 'ACTION' },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function shortAgent(ua?: string): string {
  if (!ua) return '—';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('axios') || ua.includes('node')) return 'API/Node';
  return ua.slice(0, 20);
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AuditLogPage() {
  const [search, setSearch]         = useState('');
  const [entityType, setEntityType] = useState('ALL');
  const [actionFilter, setAction]   = useState('ALL');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [page, setPage]             = useState(1);
  const LIMIT = 50;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(LIMIT),
    ...(search ? { search } : {}),
    ...(entityType !== 'ALL' ? { entityType } : {}),
    ...(actionFilter !== 'ALL' ? { action: actionFilter } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, entityType, actionFilter, startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get(`/audit?${params}`);
      return data;
    },
    staleTime: 10000,
    placeholderData: (prev) => prev,
  });

  const logs: AuditEntry[] = data?.data || [];
  const pagination = data?.pagination || { total: 0, totalPages: 1 };

  function clearFilters() {
    setSearch(''); setEntityType('ALL'); setAction('ALL');
    setStartDate(''); setEndDate(''); setPage(1);
  }

  const hasFilters = search || entityType !== 'ALL' || actionFilter !== 'ALL' || startDate || endDate;

  return (
    <div className="animate-fade-in">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-white shadow-sm border border-stone-200 rounded-2xl mx-4 mt-4">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-72 h-20 pointer-events-none opacity-[0.05]"
          style={{ background: 'radial-gradient(ellipse at 100% 0%, #475569 0%, transparent 70%)' }} />

        <div className="relative px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(71,85,105,0.1)', border: '1px solid rgba(71,85,105,0.25)' }}>
              <FileSearch className="w-5 h-5" style={{ color: '#475569' }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#475569' }}>Platform</span>
                <span className="text-stone-300">/</span>
                <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">Audit Log</span>
              </div>
              <h1 className="text-[22px] font-display font-bold text-stone-900 tracking-tight">Audit Log Browser</h1>
              <p className="text-[12px] text-stone-500 mt-0.5">
                Track all changes and actions performed in the platform
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] font-mono text-stone-400">
                {pagination.total.toLocaleString()} entries
              </span>
              {isLoading && (
                <div className="w-4 h-4 border border-[#475569]/30 border-t-[#475569] rounded-full animate-spin" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="px-4 pt-4">
        <div className="rounded-xl p-4 flex flex-wrap items-center gap-3"
          style={{ background: '#FFFFFF', border: '1px solid #E7E5E4' }}>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search entity ID, type, action…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-[12px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
              style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}
            />
          </div>

          {/* Entity type */}
          <select
            value={entityType}
            onChange={e => { setEntityType(e.target.value); setPage(1); }}
            className="rounded-lg px-3 py-2 text-[12px] text-stone-700 focus:outline-none"
            style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All Entities' : t}</option>)}
          </select>

          {/* Action method */}
          <select
            value={actionFilter}
            onChange={e => { setAction(e.target.value); setPage(1); }}
            className="rounded-lg px-3 py-2 text-[12px] text-stone-700 focus:outline-none"
            style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
            {ACTION_METHODS.map(m => <option key={m} value={m}>{m === 'ALL' ? 'All Actions' : m}</option>)}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="rounded-lg px-2 py-2 text-[12px] text-stone-700 focus:outline-none"
              style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}
            />
            <span className="text-stone-400 text-[11px]">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="rounded-lg px-2 py-2 text-[12px] text-stone-700 focus:outline-none"
              style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors"
              style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)' }}>
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="px-4 pt-3 pb-6">
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E7E5E4' }}>
          {/* Header row */}
          <div className="grid px-4 py-3"
            style={{
              gridTemplateColumns: '1fr 1.2fr 0.8fr 0.9fr 0.7fr 0.7fr',
              background: '#FAFAF9',
              borderBottom: '1px solid #E7E5E4',
            }}>
            {['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'IP Address'].map(h => (
              <p key={h} className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{h}</p>
            ))}
          </div>

          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <div className="w-5 h-5 border border-[#475569]/30 border-t-[#475569] rounded-full animate-spin" />
              <span className="text-[12px] text-stone-500 font-mono">Loading audit logs…</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <FileSearch className="w-10 h-10 mb-3" style={{ color: '#D6D3D1' }} />
              <p className="text-[13px] text-stone-500 font-mono">No audit entries found</p>
            </div>
          ) : (
            logs.map((entry, idx) => {
              const method = methodFromAction(entry.action);
              const ms = METHOD_STYLES[method] || METHOD_STYLES.OTHER;
              return (
                <div
                  key={entry.id}
                  className="grid px-4 py-3 items-center group hover:bg-stone-50 transition-colors"
                  style={{
                    gridTemplateColumns: '1fr 1.2fr 0.8fr 0.9fr 0.7fr 0.7fr',
                    borderBottom: idx < logs.length - 1 ? '1px solid #F5F5F4' : 'none',
                  }}>
                  {/* Timestamp */}
                  <div>
                    <p className="text-[11px] font-mono text-stone-900">{fmtTime(entry.createdAt)}</p>
                  </div>

                  {/* User */}
                  <div className="flex items-center gap-2">
                    {entry.user ? (
                      <>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                          {entry.user.firstName?.[0]}{entry.user.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-stone-900 truncate">
                            {entry.user.firstName} {entry.user.lastName}
                          </p>
                          <p className="text-[9px] text-stone-400 font-mono">{entry.user.role}</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-stone-300" />
                        <span className="text-[11px] text-stone-400">System</span>
                      </div>
                    )}
                  </div>

                  {/* Action badge */}
                  <div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md"
                      style={{ background: ms.bg, color: ms.text }}>
                      {ms.label}
                    </span>
                  </div>

                  {/* Entity type */}
                  <div>
                    <span className="text-[11px] font-semibold text-stone-700">{entry.entityType}</span>
                  </div>

                  {/* Entity ID */}
                  <div>
                    <span className="text-[10px] font-mono text-stone-500 truncate block" title={entry.entityId}>
                      {entry.entityId ? entry.entityId.slice(0, 8) + '…' : '—'}
                    </span>
                  </div>

                  {/* IP */}
                  <div className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-stone-300 shrink-0" />
                    <span className="text-[10px] font-mono text-stone-500 truncate">
                      {entry.ipAddress || '—'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-[11px] text-stone-500 font-mono">
              Page {page} of {pagination.totalPages} · {pagination.total.toLocaleString()} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg disabled:opacity-40 transition-colors hover:bg-stone-100"
                style={{ border: '1px solid #E7E5E4' }}>
                <ChevronLeft className="w-4 h-4 text-stone-600" />
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(pagination.totalPages - 4, page - 2)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-8 h-8 rounded-lg text-[12px] font-medium transition-colors"
                    style={p === page
                      ? { background: '#475569', color: '#FFFFFF' }
                      : { background: '#FFFFFF', color: '#78716C', border: '1px solid #E7E5E4' }}>
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1.5 rounded-lg disabled:opacity-40 transition-colors hover:bg-stone-100"
                style={{ border: '1px solid #E7E5E4' }}>
                <ChevronRight className="w-4 h-4 text-stone-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
