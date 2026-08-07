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
  GitBranch,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useChanges } from '../../hooks/useChanges';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChangeType = 'NORMAL' | 'STANDARD' | 'EMERGENCY';
type ChangeState = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'SCHEDULED' | 'IMPLEMENTING' | 'COMPLETED' | 'CANCELLED';
type Risk = 'HIGH' | 'MEDIUM' | 'LOW';

interface Change {
  id: string;
  number: string;
  type: ChangeType;
  state: ChangeState;
  risk: Risk;
  shortDescription: string;
  requestedBy: string | { firstName?: string; lastName?: string } | null;
  plannedStartDate: string;
  createdAt: string;
}

type SortField = 'number' | 'type' | 'state' | 'risk' | 'shortDescription' | 'plannedStartDate';
type SortDir = 'asc' | 'desc';

const ALL_STATES: ChangeState[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SCHEDULED', 'IMPLEMENTING', 'COMPLETED', 'CANCELLED'];
const ALL_TYPES: ChangeType[] = ['NORMAL', 'STANDARD', 'EMERGENCY'];
const ALL_RISKS: Risk[] = ['HIGH', 'MEDIUM', 'LOW'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const typeStyle: Record<ChangeType, React.CSSProperties> = {
  NORMAL: { background: 'rgba(79,70,229,0.15)', color: '#A5B4FC', border: '1px solid rgba(79,70,229,0.3)' },
  STANDARD: { background: 'rgba(124,58,237,0.15)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.3)' },
  EMERGENCY: { background: 'rgba(220,38,38,0.15)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.3)' },
};

const stateStyle: Record<ChangeState, React.CSSProperties> = {
  DRAFT: { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' },
  SUBMITTED: { background: 'rgba(217,119,6,0.15)', color: '#FCD34D', border: '1px solid rgba(217,119,6,0.3)' },
  APPROVED: { background: 'rgba(79,70,229,0.15)', color: '#A5B4FC', border: '1px solid rgba(79,70,229,0.3)' },
  SCHEDULED: { background: 'rgba(124,58,237,0.15)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.3)' },
  IMPLEMENTING: { background: 'rgba(217,119,6,0.15)', color: '#FCD34D', border: '1px solid rgba(217,119,6,0.3)' },
  COMPLETED: { background: 'rgba(5,150,105,0.15)', color: '#6EE7B7', border: '1px solid rgba(5,150,105,0.3)' },
  CANCELLED: { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' },
};

const riskStyle: Record<Risk, React.CSSProperties> = {
  HIGH: { background: 'rgba(220,38,38,0.15)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.3)' },
  MEDIUM: { background: 'rgba(217,119,6,0.15)', color: '#FCD34D', border: '1px solid rgba(217,119,6,0.3)' },
  LOW: { background: 'rgba(5,150,105,0.15)', color: '#6EE7B7', border: '1px solid rgba(5,150,105,0.3)' },
};

// Keep old Tailwind classes for any non-table badge use (none currently)
const typeClass: Record<ChangeType, string> = { NORMAL: '', STANDARD: '', EMERGENCY: '' };
const stateClass: Record<ChangeState, string> = { DRAFT: '', SUBMITTED: '', APPROVED: '', SCHEDULED: '', IMPLEMENTING: '', COMPLETED: '', CANCELLED: '' };
const riskClass: Record<Risk, string> = { HIGH: '', MEDIUM: '', LOW: '' };

const riskWeight: Record<Risk, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function getDisplayName(requestedBy: string | { firstName?: string; lastName?: string } | null): string {
  if (!requestedBy) return 'Unknown';
  if (typeof requestedBy === 'string') return requestedBy;
  const first = requestedBy.firstName || '';
  const last = requestedBy.lastName || '';
  return `${first} ${last}`.trim() || 'Unknown';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChangeList() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedRisks, setSelectedRisks] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('plannedStartDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const hasFilters = search || selectedStates.length > 0 || selectedTypes.length > 0 || selectedRisks.length > 0;

  const clearFilters = () => {
    setSearch('');
    setSelectedStates([]);
    setSelectedTypes([]);
    setSelectedRisks([]);
    setPage(1);
  };

  // ─── API Call ────────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useChanges({
    page,
    limit: pageSize,
    search: search || undefined,
    state: selectedStates.length > 0 ? selectedStates[0] : undefined,
    type: selectedTypes.length > 0 ? selectedTypes[0] : undefined,
    risk: selectedRisks.length > 0 ? selectedRisks[0] : undefined,
    sortBy: sortField,
    sortDir,
  });

  const changes: Change[] = data?.data || [];
  const pagination = data?.pagination;
  const totalItems = pagination?.total ?? changes.length;
  const totalPages = pagination?.pages ?? Math.max(1, Math.ceil(totalItems / pageSize));

  // ─── Compute KPI from real data ──────────────────────────────────────────────
  const kpiData = useMemo(() => {
    const open = changes.filter((c: Change) => !['COMPLETED', 'CANCELLED'].includes(c.state)).length;
    const implementing = changes.filter((c: Change) => c.state === 'IMPLEMENTING').length;
    const scheduledThisWeek = changes.filter((c: Change) => {
      if (c.state !== 'SCHEDULED') return false;
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      const scheduled = new Date(c.plannedStartDate);
      return scheduled >= startOfWeek && scheduled < endOfWeek;
    }).length;
    const completedThisMonth = changes.filter((c: Change) => {
      if (c.state !== 'COMPLETED') return false;
      const now = new Date();
      const created = new Date(c.createdAt);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    const emergencyCount = changes.filter((c: Change) => c.type === 'EMERGENCY' && !['COMPLETED', 'CANCELLED'].includes(c.state)).length;
    return { open, implementing, scheduledThisWeek, completedThisMonth, emergencyCount };
  }, [changes]);

  // ─── Client-side sort for the current page (backend may already sort) ───────
  const sorted = useMemo(() => {
    const arr = [...changes];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'number': cmp = a.number.localeCompare(b.number); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'state': cmp = a.state.localeCompare(b.state); break;
        case 'risk': cmp = riskWeight[a.risk] - riskWeight[b.risk]; break;
        case 'shortDescription': cmp = a.shortDescription.localeCompare(b.shortDescription); break;
        case 'plannedStartDate': cmp = new Date(a.plannedStartDate).getTime() - new Date(b.plannedStartDate).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [changes, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />;
    return sortDir === 'asc' ? <ChevronUp size={14} style={{ color: '#C4B5FD' }} /> : <ChevronDown size={14} style={{ color: '#C4B5FD' }} />;
  };

  return (
    <div className="animate-fade-in space-y-0" style={{ background: 'linear-gradient(180deg, #0A0514 0%, #08041C 40%, #060606 100%)', minHeight: '100vh', margin: '-1.5rem', padding: '1.5rem' }}>
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #0A0514 0%, #08041C 40%, #060606 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #7C3AED, transparent)' }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full blur-[80px] -translate-y-1/2 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full blur-[60px] translate-y-1/2 translate-x-1/4 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.20) 0%, transparent 70%)' }} />
        <div className="relative px-6 pt-6 pb-14">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <GitBranch size={16} className="text-indigo-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-white tracking-tight">Change Management</h1>
              </div>
              <p className="text-slate-400 text-sm ml-[42px]">Plan, approve, and track infrastructure changes &middot; <span className="font-mono text-slate-300">{totalItems}</span> total</p>
            </div>
            <button onClick={() => navigate('/changes/create')} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.02]">
              <Plus size={15} /> New Change
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
            {[
              { label: 'Open', value: kpiData.open, icon: GitBranch, color: 'text-indigo-400' },
              { label: 'Implementing', value: kpiData.implementing, icon: Clock, color: 'text-amber-400' },
              { label: 'Scheduled', value: kpiData.scheduledThisWeek, icon: Calendar, color: 'text-violet-400' },
              { label: 'Completed', value: kpiData.completedThisMonth, icon: CheckCircle, color: 'text-emerald-400' },
              { label: 'Emergency', value: kpiData.emergencyCount, icon: AlertTriangle, color: 'text-red-400' },
            ].map((s, i) => (
              <div key={s.label} className="bg-white/[0.06] backdrop-blur-sm rounded-xl border border-white/[0.08] p-4 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className="font-display text-2xl font-extrabold text-white">{s.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center">
                    <s.icon size={18} className={s.color} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

      {/* ── FILTER BAR ── */}
      <div className="-mt-3 relative z-10 rounded-xl p-3 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <input type="text" placeholder="Search changes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2EEF9' }} />
          </div>
          <div className="w-px h-7 hidden sm:block" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Filter size={13} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">Filters</span>
          </div>
          <select value={selectedTypes[0] || ''} onChange={(e) => setSelectedTypes(e.target.value ? [e.target.value] : [])} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2EEF9' }}>
            <option value="" style={{ background: '#1E1B4B' }}>All Types</option>
            {ALL_TYPES.map((t) => <option key={t} value={t} style={{ background: '#1E1B4B' }}>{t}</option>)}
          </select>
          <select value={selectedStates[0] || ''} onChange={(e) => setSelectedStates(e.target.value ? [e.target.value] : [])} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2EEF9' }}>
            <option value="" style={{ background: '#1E1B4B' }}>All States</option>
            {ALL_STATES.map((s) => <option key={s} value={s} style={{ background: '#1E1B4B' }}>{s}</option>)}
          </select>
          <select value={selectedRisks[0] || ''} onChange={(e) => setSelectedRisks(e.target.value ? [e.target.value] : [])} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2EEF9' }}>
            <option value="" style={{ background: '#1E1B4B' }}>All Risks</option>
            {ALL_RISKS.map((r) => <option key={r} value={r} style={{ background: '#1E1B4B' }}>{r}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all" style={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.1)' }}><X size={13} /> Clear</button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {([['number', 'Number'], ['type', 'Type'], ['state', 'State'], ['risk', 'Risk'], ['shortDescription', 'Description'], ['plannedStartDate', 'Scheduled']] as [SortField, string][]).map(([field, label]) => (
                  <th key={field} onClick={() => handleSort(field)} className="px-4 py-2.5 text-left cursor-pointer select-none transition-colors">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)' }}>{label} <SortIcon field={field} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded w-3/4" style={{ background: 'rgba(255,255,255,0.08)' }} /></td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={40} style={{ color: '#DC2626' }} />
                    <p className="text-lg font-medium" style={{ color: '#CBD5E1' }}>Failed to load changes</p>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Please try again later.</p>
                  </div>
                </td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <GitBranch size={40} style={{ color: 'rgba(255,255,255,0.2)' }} />
                    <p className="text-lg font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>No changes found</p>
                  </div>
                </td></tr>
              ) : sorted.map((chg) => (
                <tr key={chg.id} onClick={() => navigate(`/changes/${chg.id}`)} className="cursor-pointer transition-colors group" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4 py-3"><span className="font-mono group-hover:underline" style={{ color: '#A5B4FC' }}>{chg.number}</span></td>
                  <td className="px-4 py-3"><span className="badge text-[10px] px-2 py-0.5 rounded-md font-mono" style={typeStyle[chg.type]}>{chg.type}</span></td>
                  <td className="px-4 py-3"><span className="badge text-[10px] px-2 py-0.5 rounded-md" style={stateStyle[chg.state]}>{chg.state.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3"><span className="badge text-[10px] px-2 py-0.5 rounded-md" style={riskStyle[chg.risk]}>{chg.risk}</span></td>
                  <td className="px-4 py-3 max-w-xs truncate" style={{ color: '#CBD5E1' }}>{chg.shortDescription}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-mono" style={{ color: 'rgba(255,255,255,0.40)' }}>{formatShortDate(chg.plannedStartDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-3 text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ color: 'rgba(255,255,255,0.40)' }}>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of {totalItems}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg transition-colors" style={{ color: page === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)' }}><ChevronLeft size={18} /></button>
              <span className="px-3" style={{ color: 'rgba(255,255,255,0.40)' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg transition-colors" style={{ color: page === totalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)' }}><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 size={28} className="text-signal animate-spin" />
        </div>
      )}
    </div>
  );
}
