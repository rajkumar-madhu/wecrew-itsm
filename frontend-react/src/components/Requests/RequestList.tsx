import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ClipboardList, Search, ChevronLeft, ChevronRight, Settings2, Inbox, AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  useRequests, useRequestCount, STATE_META, TERMINAL_STATES, OPEN_STATES, personName, apiError,
  type RequestFilters, type RequestState, type ServiceRequest,
} from '../../hooks/useRequests';

// ── Saved views ────────────────────────────────────────────────────────────────
type ViewId = 'approvals' | 'mine' | 'open' | 'all';

const VIEWS: { id: ViewId; label: string; filters: Omit<RequestFilters, 'page' | 'limit' | 'search'> }[] = [
  { id: 'approvals', label: 'Awaiting my approval', filters: { approvals: true } },
  { id: 'mine',      label: 'Assigned to me',       filters: { mine: true } },
  { id: 'open',      label: 'Open',                 filters: { state: OPEN_STATES.join(',') } },
  { id: 'all',       label: 'All',                  filters: {} },
];

const PAGE_SIZE = 20;
const VIEW_STORAGE_KEY = 'argus-requests-view';

function initialView(): ViewId {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v && VIEWS.some((x) => x.id === v)) return v as ViewId;
  } catch { /* storage unavailable */ }
  return 'open';
}

function isOverdue(r: ServiceRequest): boolean {
  return !!r.dueAt && !TERMINAL_STATES.includes(r.state) && new Date(r.dueAt).getTime() < Date.now();
}

function relative(iso: string): string {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return '—'; }
}

function StatePill({ state }: { state: RequestState }) {
  const m = STATE_META[state] ?? STATE_META.SUBMITTED;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} aria-hidden="true" />
      {m.label}
    </span>
  );
}

function ViewChip({ view, active, onSelect }: {
  view: typeof VIEWS[number]; active: boolean; onSelect: () => void;
}) {
  const { data: count } = useRequestCount(view.filters);
  return (
    <button type="button" onClick={onSelect} aria-pressed={active}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors border ${
        active
          ? 'bg-[rgba(99,102,241,0.16)] border-[rgba(99,102,241,0.45)] text-[#E8F1FA]'
          : 'bg-[#0F1B2D] border-[rgba(99,179,255,0.12)] text-[#C5D8E8] hover:border-[rgba(99,179,255,0.3)]'
      }`}>
      {view.label}
      {typeof count === 'number' && (
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
          active ? 'bg-[#6366F1] text-[#FFFFFF]' : 'bg-[#152238] text-[#8AABC4]'
        }`}>{count}</span>
      )}
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function RequestList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canManageCatalog = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [view, setView] = useState<ViewId>(initialView);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  function selectView(id: ViewId) {
    setView(id);
    setPage(1);
    try { localStorage.setItem(VIEW_STORAGE_KEY, id); } catch { /* ignore */ }
  }

  const active = VIEWS.find((v) => v.id === view) ?? VIEWS[2];
  const { data, isLoading, isError, error, isFetching, refetch } = useRequests({
    ...active.filters, search, page, limit: PAGE_SIZE,
  });
  const rows = data?.rows ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="animate-fade-in">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-white shadow-sm border border-stone-200 rounded-2xl mx-4 mt-4">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-72 h-20 pointer-events-none opacity-[0.08]"
          style={{ background: 'radial-gradient(ellipse at 100% 0%, #6366F1 0%, transparent 70%)' }} />
        <div className="relative px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
                <ClipboardList className="w-5 h-5 text-[#818CF8]" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-[#818CF8]">Service Desk</span>
                  <span className="text-[#7590A9]" aria-hidden="true">/</span>
                  <span className="text-[10px] font-mono text-[#8AABC4] tracking-widest uppercase">Requests</span>
                </div>
                <h1 className="text-[22px] font-display font-bold text-[#E8F1FA] tracking-tight">Service requests</h1>
                <p className="text-[12px] text-[#8AABC4] mt-0.5">Catalog requests raised by your users — approve, fulfil and close them out</p>
              </div>
            </div>
            {canManageCatalog && (
              <Link to="/catalog"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium text-[#C5D8E8] bg-[#0F1B2D] border border-[rgba(99,179,255,0.12)] hover:border-[rgba(99,102,241,0.45)] hover:text-[#E8F1FA] transition-colors">
                <Settings2 className="w-4 h-4" aria-hidden="true" /> Manage catalog
              </Link>
            )}
          </div>
        </div>
        <div className="h-px mx-6" style={{ background: 'linear-gradient(90deg, #6366F1, transparent)' }} />
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* ── Views + search ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Saved views">
            {VIEWS.map((v) => (
              <ViewChip key={v.id} view={v} active={v.id === view} onSelect={() => selectView(v.id)} />
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <label htmlFor="request-search" className="sr-only">Search requests</label>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7590A9]" aria-hidden="true" />
            <input id="request-search" type="search" value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              placeholder="Search number or title"
              className="w-full pl-9 pr-3 py-2 text-[13px] rounded-xl bg-[#0F1B2D] text-[#E8F1FA] border border-[rgba(99,179,255,0.12)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] placeholder:text-[#7590A9]" />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl overflow-hidden border border-[rgba(99,179,255,0.12)] bg-[#0B1424]">
          {isLoading ? (
            <div className="divide-y divide-[rgba(99,179,255,0.08)]" aria-busy="true" aria-label="Loading requests">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                  <div className="h-3 w-20 rounded bg-[#152238]" />
                  <div className="h-3 flex-1 rounded bg-[#152238]" />
                  <div className="h-3 w-24 rounded bg-[#152238]" />
                  <div className="h-5 w-20 rounded bg-[#152238]" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-4">
              <AlertTriangle className="w-8 h-8 text-[#FB7185]" aria-hidden="true" />
              <p className="text-[14px] font-semibold text-[#E8F1FA]">Couldn't load requests</p>
              <p className="text-[12px] text-[#8AABC4]">{apiError(error, 'Something went wrong. Try again.')}</p>
              <button type="button" onClick={() => refetch()} className="btn-primary text-sm">Retry</button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <Inbox className="w-6 h-6 text-[#818CF8]" aria-hidden="true" />
              </div>
              <p className="text-[14px] font-semibold text-[#E8F1FA]">
                {search ? 'No requests match your search' :
                  view === 'approvals' ? 'Nothing waiting for your approval' :
                  view === 'mine' ? 'No requests assigned to you' :
                  view === 'open' ? 'No open requests' : 'No service requests yet'}
              </p>
              <p className="text-[12px] text-[#8AABC4] max-w-sm">
                {search ? 'Try a different request number or title.' :
                  'Requests raised from the self-service portal will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[960px]">
                <thead className="bg-[#0F1B2D] border-b border-[rgba(99,179,255,0.12)]">
                  <tr>
                    {['Number', 'Title', 'Catalog item', 'Requester', 'State', 'Assignee', 'Due', 'Created'].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 text-[10px] font-bold text-[#8AABC4] uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y divide-[rgba(99,179,255,0.08)] ${isFetching ? 'opacity-70' : ''}`}>
                  {rows.map((r) => {
                    const overdue = isOverdue(r);
                    return (
                      <tr key={r.id}
                        onClick={() => navigate(`/requests/${r.id}`)}
                        className="cursor-pointer hover:bg-[#0F1B2D] transition-colors">
                        <td className="px-4 py-3">
                          <Link to={`/requests/${r.id}`} onClick={(e) => e.stopPropagation()}
                            className="text-[12px] font-mono font-semibold text-[#A5B4FC] hover:underline">
                            {r.number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 max-w-[260px]">
                          <p className="text-[13px] text-[#E8F1FA] font-medium truncate" title={r.title}>{r.title}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[12px] text-[#C5D8E8]">{r.catalogItem?.name ?? '—'}</p>
                          {r.catalogItem?.category && <p className="text-[10px] text-[#8AABC4]">{r.catalogItem.category}</p>}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#C5D8E8]">{personName(r.requestedBy) || '—'}</td>
                        <td className="px-4 py-3"><StatePill state={r.state} /></td>
                        <td className="px-4 py-3 text-[12px] text-[#C5D8E8]">
                          {personName(r.assignedTo) || <span className="text-[#8AABC4]">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 text-[12px] whitespace-nowrap">
                          {!r.dueAt ? <span className="text-[#8AABC4]">—</span> : overdue ? (
                            <span className="font-semibold text-[#FB7185]" title={format(new Date(r.dueAt), 'PPpp')}>Overdue</span>
                          ) : (
                            <span className="text-[#C5D8E8]" title={format(new Date(r.dueAt), 'PPpp')}>{relative(r.dueAt)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#8AABC4] whitespace-nowrap" title={format(new Date(r.createdAt), 'PPpp')}>
                          {relative(r.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {!isLoading && !isError && rows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(99,179,255,0.12)] bg-[#0F1B2D]">
              <p className="text-[12px] text-[#8AABC4]">
                {pagination
                  ? `Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`
                  : `${rows.length} requests`}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous page" disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg text-[#C5D8E8] hover:bg-[#152238] disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-[12px] font-mono text-[#C5D8E8]">{page} / {Math.max(1, totalPages)}</span>
                <button type="button" aria-label="Next page" disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg text-[#C5D8E8] hover:bg-[#152238] disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
