import { useState, useMemo } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Filter,
  X,
  Bug,
  Target,
  TrendingUp,
  CheckCircle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { useProblems, useProblemStats } from '../../hooks/useProblems';
import {
  Page,
  PageHeader,
  KpiRow,
  KpiCard,
  PrimaryButton,
} from '../ui/PageChrome';

type Priority = 'P1' | 'P2' | 'P3' | 'P4';
type ProblemState = 'NEW' | 'INVESTIGATION' | 'RCA_IN_PROGRESS' | 'KNOWN_ERROR' | 'RESOLVED' | 'CLOSED';

interface Problem {
  id: string;
  number: string;
  priority: Priority;
  state: ProblemState;
  shortDescription: string;
  assignedTo: string | { firstName?: string; lastName?: string } | null;
  relatedIncidents: number;
  createdAt: string;
}

type SortField = 'number' | 'priority' | 'state' | 'shortDescription' | 'relatedIncidents' | 'createdAt';
type SortDir = 'asc' | 'desc';

const ALL_STATES: ProblemState[] = ['NEW', 'INVESTIGATION', 'RCA_IN_PROGRESS', 'KNOWN_ERROR', 'RESOLVED', 'CLOSED'];
const ALL_PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4'];

const priorityClass: Record<Priority, string> = {
  P1: 'priority-p1',
  P2: 'priority-p2',
  P3: 'priority-p3',
  P4: 'priority-p4',
};

const stateLabel: Record<ProblemState, string> = {
  NEW: 'New',
  INVESTIGATION: 'Investigating',
  RCA_IN_PROGRESS: 'RCA Identified',
  KNOWN_ERROR: 'Known Error',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const stateStyle: Record<ProblemState, React.CSSProperties> = {
  NEW: { background: 'var(--argus-signal-dim)', color: 'var(--argus-signal)', border: '1px solid color-mix(in srgb, var(--argus-signal) 25%, transparent)' },
  INVESTIGATION: { background: 'var(--argus-amber-dim)', color: 'var(--argus-amber)', border: '1px solid color-mix(in srgb, var(--argus-amber) 25%, transparent)' },
  RCA_IN_PROGRESS: { background: 'var(--argus-violet-dim)', color: 'var(--argus-violet)', border: '1px solid color-mix(in srgb, var(--argus-violet) 25%, transparent)' },
  KNOWN_ERROR: { background: 'var(--argus-crimson-dim)', color: 'var(--argus-crimson)', border: '1px solid color-mix(in srgb, var(--argus-crimson) 25%, transparent)' },
  RESOLVED: { background: 'var(--argus-emerald-dim)', color: 'var(--argus-emerald)', border: '1px solid color-mix(in srgb, var(--argus-emerald) 25%, transparent)' },
  CLOSED: { background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' },
};

const priorityWeight: Record<Priority, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ProblemList() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const hasFilters = search || selectedStates.length > 0 || selectedPriorities.length > 0;
  const clearFilters = () => {
    setSearch('');
    setSelectedStates([]);
    setSelectedPriorities([]);
    setPage(1);
  };

  const { data, isLoading, isError } = useProblems({
    page,
    limit: pageSize,
    search: search || undefined,
    state: selectedStates.length > 0 ? selectedStates[0] : undefined,
    priority: selectedPriorities.length > 0 ? selectedPriorities[0] : undefined,
    sortBy: sortField,
    sortDir,
  });

  const { data: statsData } = useProblemStats();
  const stateCounts: Record<string, number> = statsData?.data?.stateCounts || {};
  const knownErrors: any[] = statsData?.data?.knownErrors || [];

  const problems: Problem[] = (data?.data || []) as Problem[];
  const pagination = data?.pagination;
  const totalItems = pagination?.total ?? problems.length;
  const totalPages = pagination?.pages ?? Math.max(1, Math.ceil(totalItems / pageSize));

  const openCount = useMemo(
    () => problems.filter((p) => !['RESOLVED', 'CLOSED'].includes(p.state)).length,
    [problems]
  );
  const knownErrorCount = useMemo(
    () => knownErrors.length || problems.filter((p) => p.state === 'KNOWN_ERROR').length,
    [problems, knownErrors]
  );
  const resolvedCount = useMemo(
    () => problems.filter((p) => p.state === 'RESOLVED').length,
    [problems]
  );
  const totalRelated = useMemo(
    () => problems.reduce((acc, p) => acc + (p.relatedIncidents || 0), 0),
    [problems]
  );

  const sorted = useMemo(() => {
    const list = [...problems];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'priority') cmp = priorityWeight[a.priority] - priorityWeight[b.priority];
      else if (sortField === 'relatedIncidents') cmp = (a.relatedIncidents || 0) - (b.relatedIncidents || 0);
      else if (sortField === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else cmp = String(a[sortField] || '').localeCompare(String(b[sortField] || ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [problems, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp size={14} className="text-[color:var(--argus-dim)] opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp size={14} className="text-[color:var(--argus-signal)]" />
      : <ChevronDown size={14} className="text-[color:var(--argus-signal)]" />;
  };

  const handleStatePipelineClick = (state: string) => {
    setSelectedStates(selectedStates[0] === state ? [] : [state]);
    setPage(1);
  };

  return (
    <Page>
      <PageHeader
        icon={Bug}
        title="Problems"
        subtitle={
          <>
            Root cause analysis & known error tracking ·{' '}
            <span className="font-mono font-medium text-ink">{totalItems}</span> total
          </>
        }
        actions={
          <PrimaryButton onClick={() => navigate('/problems/create')}>
            <Plus size={14} /> New problem
          </PrimaryButton>
        }
      />

      <KpiRow className="!grid-cols-2 sm:!grid-cols-4 lg:!grid-cols-4">
        <KpiCard label="Open" value={openCount} icon={Bug} tone="info" loading={isLoading} />
        <KpiCard label="Known errors" value={knownErrorCount} icon={Target} tone="danger" loading={isLoading} />
        <KpiCard label="Linked incidents" value={totalRelated} icon={TrendingUp} tone="warn" loading={isLoading} />
        <KpiCard label="Resolved" value={resolvedCount} icon={CheckCircle} tone="ok" loading={isLoading} />
      </KpiRow>

      {/* State pipeline */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {ALL_STATES.map((state, idx) => {
          const count = stateCounts[state] ?? 0;
          const st = stateStyle[state];
          const isActive = selectedStates[0] === state;
          return (
            <div key={state} className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => handleStatePipelineClick(state)}
                className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors border text-left"
                style={
                  isActive
                    ? { ...st, boxShadow: '0 0 0 2px color-mix(in srgb, var(--argus-signal) 25%, transparent)' }
                    : { background: 'var(--argus-surface)', borderColor: 'var(--argus-border)', color: 'var(--argus-muted)' }
                }
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.color as string }} />
                <span className="text-[11px] font-semibold" style={{ color: isActive ? (st.color as string) : 'var(--argus-muted)' }}>
                  {stateLabel[state]}
                </span>
                <span
                  className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: isActive ? 'var(--argus-surface)' : 'var(--argus-elevated)',
                    color: isActive ? (st.color as string) : 'var(--argus-dim)',
                  }}
                >
                  {count}
                </span>
              </button>
              {idx < ALL_STATES.length - 1 && (
                <ArrowRight size={12} className="mx-1 shrink-0 text-[color:var(--argus-dim)]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Known error cards */}
      {knownErrors.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={13} style={{ color: 'var(--argus-crimson)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Known error database</span>
            <span className="text-[10px] font-mono text-dim">{knownErrors.length}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {knownErrors.map((ke: any) => (
              <button
                key={ke.id}
                type="button"
                onClick={() => navigate(`/problems/${ke.id}`)}
                className="shrink-0 w-72 rounded-md p-4 text-left border transition-colors hover:border-[color:var(--argus-signal)]"
                style={{ background: 'var(--argus-crimson-dim)', borderColor: 'color-mix(in srgb, var(--argus-crimson) 25%, transparent)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--argus-crimson)' }}>{ke.number}</span>
                  <span className={clsx('badge', priorityClass[ke.priority as Priority])}>{ke.priority}</span>
                </div>
                <p className="text-xs font-medium truncate mb-2 text-ink">{ke.shortDescription}</p>
                {ke.workaround && (
                  <div
                    className="flex items-start gap-1.5 text-[10px] rounded-md px-2 py-1.5"
                    style={{ background: 'var(--argus-amber-dim)', color: 'var(--argus-amber)', border: '1px solid color-mix(in srgb, var(--argus-amber) 20%, transparent)' }}
                  >
                    <Lightbulb size={11} className="shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{ke.workaround}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input
              type="text"
              placeholder="Search problems..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 text-muted text-xs font-semibold uppercase tracking-wide">
            <Filter size={13} /> Filters
          </div>
          <select
            value={selectedStates[0] || ''}
            onChange={(e) => { setSelectedStates(e.target.value ? [e.target.value] : []); setPage(1); }}
            className="filter-select"
          >
            <option value="">All states</option>
            {ALL_STATES.map((s) => (
              <option key={s} value={s}>{stateLabel[s]}</option>
            ))}
          </select>
          <select
            value={selectedPriorities[0] || ''}
            onChange={(e) => { setSelectedPriorities(e.target.value ? [e.target.value] : []); setPage(1); }}
            className="filter-select"
          >
            <option value="">All priorities</option>
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="btn-ghost flex items-center gap-1 text-xs">
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--argus-elevated)', borderBottom: '1px solid var(--argus-border)' }}>
                {([
                  ['number', 'Number'],
                  ['priority', 'Priority'],
                  ['state', 'State'],
                  ['shortDescription', 'Description'],
                  ['relatedIncidents', 'Incidents'],
                  ['createdAt', 'Created'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="px-4 py-2.5 text-left cursor-pointer select-none"
                  >
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {label} <SortIcon field={field} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--argus-border)' }} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded w-3/4" style={{ background: 'var(--argus-elevated)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertTriangle size={36} style={{ color: 'var(--argus-crimson)' }} />
                      <p className="text-base font-medium text-ink">Failed to load problems</p>
                      <p className="text-sm text-muted">Please try again later.</p>
                    </div>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Bug size={36} className="text-dim" />
                      <p className="text-base font-medium text-ink">No problems found</p>
                      <p className="text-sm text-muted">Create a problem or clear filters.</p>
                      <button type="button" onClick={() => navigate('/problems/create')} className="btn-primary mt-1">
                        <Plus size={14} className="inline mr-1" /> New problem
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((prb) => (
                  <tr
                    key={prb.id}
                    onClick={() => navigate(`/problems/${prb.id}`)}
                    className="cursor-pointer transition-colors hover:bg-[color:var(--argus-elevated)]"
                    style={{ borderBottom: '1px solid var(--argus-border)' }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-[color:var(--argus-signal)] font-medium group-hover:underline">
                        {prb.number}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('badge', priorityClass[prb.priority])}>{prb.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border" style={stateStyle[prb.state]}>
                        {stateLabel[prb.state]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-ink">{prb.shortDescription}</td>
                    <td className="px-4 py-3 text-center">
                      {(prb.relatedIncidents || 0) > 0 ? (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                          style={{ background: 'var(--argus-amber-dim)', color: 'var(--argus-amber)', borderColor: 'color-mix(in srgb, var(--argus-amber) 25%, transparent)' }}
                        >
                          {prb.relatedIncidents}
                        </span>
                      ) : (
                        <span className="text-dim">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted text-xs">{relativeTime(prb.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalItems > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 text-sm"
            style={{ borderTop: '1px solid var(--argus-border)' }}
          >
            <span className="text-muted">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md text-muted disabled:opacity-30 hover:bg-[color:var(--argus-elevated)]"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="px-3 text-muted">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md text-muted disabled:opacity-30 hover:bg-[color:var(--argus-elevated)]"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 size={24} className="animate-spin text-[color:var(--argus-signal)]" />
        </div>
      )}
    </Page>
  );
}
