import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileSearch, Search, X, ChevronLeft, ChevronRight,
  User, Calendar, Globe, Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';
import { Page, Toolbar, GhostButton } from '../ui/PageChrome';

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

const METHOD_PILL: Record<string, { tone: 'ok' | 'warn' | 'danger' | 'alert' | 'neutral'; label: string }> = {
  POST:   { tone: 'ok',      label: 'Create' },
  PATCH:  { tone: 'warn',    label: 'Update' },
  PUT:    { tone: 'warn',    label: 'Update' },
  DELETE: { tone: 'danger',  label: 'Delete' },
  GET:    { tone: 'alert',   label: 'Read' },
  OTHER:  { tone: 'neutral', label: 'Action' },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('ALL');
  const [actionFilter, setAction] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
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
  const totalPages = pagination.totalPages || 1;
  const total = pagination.total || 0;

  function clearFilters() {
    setSearch(''); setEntityType('ALL'); setAction('ALL');
    setStartDate(''); setEndDate(''); setPage(1);
  }

  const hasFilters = Boolean(search || entityType !== 'ALL' || actionFilter !== 'ALL' || startDate || endDate);
  const deletes = logs.filter(e => methodFromAction(e.action) === 'DELETE').length;

  const kpis = [
    { label: 'Entries', value: isLoading && !total ? '—' : total.toLocaleString(), sub: 'matching this query' },
    { label: 'This page', value: isLoading && logs.length === 0 ? '—' : logs.length, sub: `page ${page} of ${totalPages}` },
    { label: 'Deletes here', value: isLoading && logs.length === 0 ? '—' : deletes, sub: 'on the current page', tone: deletes > 0 ? 'danger' : undefined },
    { label: 'Window', value: startDate || endDate ? `${startDate || '…'} → ${endDate || '…'}` : 'All time', sub: hasFilters ? 'filters on' : 'unfiltered' },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Govern · accountability</span>
            <h1 className="cx-hero__title">Audit</h1>
            <p className="cx-hero__deck">
              Who changed what, when, and from where. A delete without a name on this page is the
              failure the log exists to catch.
            </p>
          </div>
        </div>
        <dl className="cx-hero__kpis mt-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={clsx('cx-hero__kpi', kpi.tone && `cx-hero__kpi--${kpi.tone}`)}>
              <dt className="cx-hero__kpi-label">{kpi.label}</dt>
              <dd>
                <div className="cx-hero__kpi-value">{kpi.value}</div>
                <div className="cx-hero__kpi-sub">{kpi.sub}</div>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Audit</span>
      </nav>

      <Toolbar>
        <div className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {isLoading && !total ? '—' : `${total.toLocaleString()} ${total === 1 ? 'entry' : 'entries'}`}
          </span>
          <span className="cx-listhead__count-meta">page {page} of {totalPages}</span>
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search entity ID, type, action…"
            className="input-field pl-8 py-1.5 text-[13px]"
          />
        </div>

        <select
          value={entityType}
          onChange={e => { setEntityType(e.target.value); setPage(1); }}
          className={clsx('filter-select', entityType !== 'ALL' && 'filter-select--active')}
        >
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All entities' : t}</option>)}
        </select>

        <select
          value={actionFilter}
          onChange={e => { setAction(e.target.value); setPage(1); }}
          className={clsx('filter-select', actionFilter !== 'ALL' && 'filter-select--active')}
        >
          {ACTION_METHODS.map(m => <option key={m} value={m}>{m === 'ALL' ? 'All actions' : m}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-dim" />
          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1); }}
            className="input-field py-1.5 text-[12px] w-[138px]"
          />
          <span className="text-dim text-[11px]">→</span>
          <input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(1); }}
            className="input-field py-1.5 text-[12px] w-[138px]"
          />
        </div>

        {hasFilters && (
          <GhostButton onClick={clearFilters}>
            <X size={11} />
            Clear
          </GhostButton>
        )}
      </Toolbar>

      <div className="cx-table-wrap">
        <div className="overflow-x-auto">
          <table className="cx-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>IP address</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <Loader2 size={18} className="mx-auto mb-2 animate-spin text-dim" />
                    <p className="text-xs text-muted font-mono">Loading audit logs…</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <FileSearch size={22} className="mx-auto mb-2 text-graphite" strokeWidth={1.75} />
                    <p className="text-sm text-ink font-medium">No audit entries found</p>
                    <p className="text-xs text-muted mt-1">
                      {hasFilters ? 'Clear the filters to see every recorded action.' : 'Actions will appear here as they happen.'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((entry) => {
                  const method = methodFromAction(entry.action);
                  const ms = METHOD_PILL[method] || METHOD_PILL.OTHER;
                  return (
                    <tr key={entry.id}>
                      <td>
                        <span className="text-[11px] font-mono text-ink">{fmtTime(entry.createdAt)}</span>
                      </td>
                      <td>
                        {entry.user ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                              style={{ background: 'var(--argus-ink)', color: 'var(--brand-paper)' }}
                            >
                              {entry.user.firstName?.[0]}{entry.user.lastName?.[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-ink truncate">
                                {entry.user.firstName} {entry.user.lastName}
                              </p>
                              <p className="text-[9px] text-dim font-mono">{entry.user.role}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-graphite" />
                            <span className="text-[11px] text-dim">System</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={clsx('cx-pill', `cx-pill--${ms.tone}`)}>{ms.label}</span>
                      </td>
                      <td>
                        <span className="text-[11px] font-semibold text-ink">{entry.entityType}</span>
                      </td>
                      <td>
                        <span className="text-[10px] font-mono text-dim truncate block" title={entry.entityId}>
                          {entry.entityId ? `${entry.entityId.slice(0, 8)}…` : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1">
                          <Globe className="w-3 h-3 text-graphite shrink-0" />
                          <span className="text-[10px] font-mono text-dim truncate">
                            {entry.ipAddress || '—'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[color:var(--argus-border)]">
            <span className="text-[12px] text-muted">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="px-2 text-[12px] font-mono text-muted">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
