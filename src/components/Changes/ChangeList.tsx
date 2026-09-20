import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  CalendarRange,
  AlertTriangle,
} from 'lucide-react';
import { useChanges, useChangeCensus } from '../../hooks/useChanges';
import { Page, Toolbar } from '../ui/PageChrome';

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

/** Changes that have not yet run. Everything else is history. */
const LIVE_STATES: ChangeState[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SCHEDULED', 'IMPLEMENTING'];

const WINDOW_DAYS = 14;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const stateTone: Record<ChangeState, 'neutral' | 'warn' | 'ok' | 'alert' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warn',
  APPROVED: 'ok',
  SCHEDULED: 'ok',
  IMPLEMENTING: 'alert',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
};

const stateLabel: Record<ChangeState, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting approval',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  IMPLEMENTING: 'Implementing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const riskWeight: Record<Risk, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
const riskLabel: Record<Risk, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}

function formatWindow(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function getDisplayName(requestedBy: Change['requestedBy']): string {
  if (!requestedBy) return 'Unassigned';
  if (typeof requestedBy === 'string') return requestedBy;
  const name = `${requestedBy.firstName || ''} ${requestedBy.lastName || ''}`.trim();
  return name || 'Unassigned';
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function StateBadge({ state }: { state: ChangeState }) {
  return <span className={clsx('cx-pill', `cx-pill--${stateTone[state]}`)}>{stateLabel[state]}</span>;
}

/** Risk reads as the same rule used for a tick in the forward window, so the
    table and the window share one visual vocabulary. */
function RiskRule({ risk }: { risk: Risk }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={clsx(
          'block w-5 h-[5px] rounded-sm',
          risk === 'HIGH' && 'bg-crimson',
          risk === 'MEDIUM' && 'bg-amber',
          risk === 'LOW' && 'bg-emerald'
        )}
      />
      <span className="text-[12px] text-muted">{riskLabel[risk]}</span>
    </span>
  );
}

// ─── Forward window ──────────────────────────────────────────────────────────

interface WindowDay {
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
  changes: Change[];
  highCount: number;
}

/**
 * A fortnight of calendar as columns, one tick per change. The CAB's standing
 * question is collision — two risky changes touching the same estate on the
 * same night — so a day carrying more than one high-risk change tints coral
 * instead of leaving the reader to count ticks.
 */
function ForwardWindow({ changes, onSelect }: { changes: Change[]; onSelect: (id: string) => void }) {
  const days: WindowDay[] = useMemo(() => {
    const today = startOfDay(new Date());
    const byDay = new Map<string, Change[]>();
    for (const c of changes) {
      const k = dayKey(c.plannedStartDate);
      const list = byDay.get(k);
      if (list) list.push(c);
      else byDay.set(k, [c]);
    }
    return Array.from({ length: WINDOW_DAYS }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayChanges = (byDay.get(dayKey(date)) || []).sort(
        (a, b) => riskWeight[a.risk] - riskWeight[b.risk]
      );
      return {
        date,
        isToday: i === 0,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        changes: dayChanges,
        highCount: dayChanges.filter((c) => c.risk === 'HIGH').length,
      };
    });
  }, [changes]);

  const collisions = days.filter((d) => d.highCount >= 2).length;
  const planned = days.reduce((n, d) => n + d.changes.length, 0);

  return (
    <div className="cx-window">
      <div className="cx-window__head">
        <span className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {planned} change{planned === 1 ? '' : 's'} in the next {WINDOW_DAYS} days
          </span>
          <span className="cx-listhead__count-meta">
            {collisions > 0
              ? `${collisions} day${collisions === 1 ? '' : 's'} carrying two or more high-risk changes`
              : 'no high-risk collisions'}
          </span>
        </span>
        <span className="cx-window__legend">
          <span className="cx-window__key">
            <span className="cx-window__swatch bg-crimson" /> High
          </span>
          <span className="cx-window__key">
            <span className="cx-window__swatch bg-amber" /> Medium
          </span>
          <span className="cx-window__key">
            <span className="cx-window__swatch bg-emerald" /> Low
          </span>
        </span>
      </div>

      <div className="cx-window__scroll">
        <div className="cx-window__track">
          {days.map((day) => {
            const collide = day.highCount >= 2;
            const shown = day.changes.slice(0, 6);
            const overflow = day.changes.length - shown.length;
            return (
              <div
                key={day.date.toISOString()}
                className={clsx(
                  'cx-window__day',
                  day.isWeekend && !collide && !day.isToday && 'cx-window__day--weekend',
                  day.isToday && !collide && 'cx-window__day--today',
                  collide && 'cx-window__day--collide'
                )}
              >
                <div>
                  <div className="cx-window__dow">{day.isToday ? 'Today' : DOW[day.date.getDay()]}</div>
                  <div className="cx-window__date">{day.date.getDate()}</div>
                </div>

                {day.changes.length === 0 ? (
                  <div className="cx-window__none">—</div>
                ) : (
                  <div className="cx-window__stack">
                    {shown.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelect(c.id)}
                        title={`${c.number} · ${riskLabel[c.risk]} risk · ${c.shortDescription}`}
                        aria-label={`${c.number}, ${riskLabel[c.risk]} risk, ${c.shortDescription}`}
                        className={clsx('cx-window__tick', `cx-window__tick--${c.risk.toLowerCase()}`)}
                      />
                    ))}
                    {overflow > 0 && <span className="cx-window__none">+{overflow}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChangeList() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedRisk, setSelectedRisk] = useState('');
  const [sortField, setSortField] = useState<SortField>('plannedStartDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const hasFilters = Boolean(search || selectedState || selectedType || selectedRisk);

  const clearFilters = () => {
    setSearch('');
    setSelectedState('');
    setSelectedType('');
    setSelectedRisk('');
    setPage(1);
  };

  // The register — one page of whatever the reader has filtered to.
  // Param names are the server's: `riskLevel` (not `risk`) and `sortOrder`
  // (not `sortDir`); both are dropped silently by the controller if misnamed.
  const { data, isLoading, isError } = useChanges({
    page,
    limit: pageSize,
    search: search || undefined,
    state: selectedState || undefined,
    type: selectedType || undefined,
    riskLevel: selectedRisk || undefined,
    sortBy: sortField,
    sortOrder: sortDir,
  });

  // The window and the hero counts describe the whole schedule, not the current
  // filter — a forward window that moved every time someone typed in the search
  // box would answer nobody's question. Paged at the API's cap of 100 rather
  // than requested in one oversized page, which the API rejects with a 400.
  const { data: census } = useChangeCensus<Change>({
    sortBy: 'plannedStartDate',
    sortOrder: 'asc',
  });

  const changes: Change[] = data?.data || [];
  const pagination = data?.pagination;
  const totalItems = pagination?.total ?? changes.length;
  const totalPages = pagination?.totalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));

  const schedule: Change[] = useMemo(() => census?.items ?? [], [census]);
  const scheduleTruncated = Boolean(census?.truncated);

  const upcoming = useMemo(() => {
    const from = startOfDay(new Date());
    const to = new Date(from);
    to.setDate(from.getDate() + WINDOW_DAYS);
    return schedule.filter((c) => {
      if (!LIVE_STATES.includes(c.state)) return false;
      const t = new Date(c.plannedStartDate);
      return t >= from && t < to;
    });
  }, [schedule]);

  const stats = useMemo(() => {
    const live = schedule.filter((c) => LIVE_STATES.includes(c.state));
    const weekEnd = startOfDay(new Date());
    weekEnd.setDate(weekEnd.getDate() + 7);
    return {
      live: live.length,
      awaiting: live.filter((c) => c.state === 'SUBMITTED').length,
      thisWeek: upcoming.filter((c) => new Date(c.plannedStartDate) < weekEnd).length,
      implementing: live.filter((c) => c.state === 'IMPLEMENTING').length,
      emergency: live.filter((c) => c.type === 'EMERGENCY').length,
    };
  }, [schedule, upcoming]);

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
    if (sortField !== field) return <ChevronsIcon />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-signal" />
      : <ChevronDown size={12} className="text-signal" />;
  };

  const kpis = [
    { label: 'Open', value: stats.live, sub: 'not yet run' },
    { label: 'Awaiting approval', value: stats.awaiting, sub: 'needs a CAB decision', tone: stats.awaiting > 0 ? 'warn' : undefined },
    { label: 'Lands this week', value: stats.thisWeek, sub: 'next 7 days' },
    { label: 'Implementing', value: stats.implementing, sub: 'running now' },
    { label: 'Emergency', value: stats.emergency, sub: 'bypassed the calendar', tone: stats.emergency > 0 ? 'danger' : undefined },
  ];

  return (
    <Page>
      {/* ── Hero ── */}
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Operate · change management</span>
            <h1 className="cx-hero__title">Changes</h1>
            <p className="cx-hero__deck">
              Every planned change to the estate, its risk class, and where it sits between draft and
              done. The forward window below is what the CAB reads before it approves anything.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => navigate('/changes/calendar')} className="cx-hero__btn cx-hero__btn--ghost">
              <CalendarRange size={14} strokeWidth={1.75} />
              Calendar
            </button>
            <button type="button" onClick={() => navigate('/changes/create')} className="cx-hero__btn">
              <Plus size={14} strokeWidth={1.75} />
              Raise a change
            </button>
          </div>
        </div>

        <dl className="cx-hero__kpis cx-hero__kpis--5 mt-6">
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
        <span className="cx-crumb__current">Changes</span>
      </nav>

      {/* ── Signature: the forward window ── */}
      <div className="cx-sectionhead">
        <div>
          <h2 className="cx-sectionhead__title">Forward window</h2>
          <p className="cx-sectionhead__deck">
            The next {WINDOW_DAYS} days of the schedule. Each rule is one change, placed on the day it
            starts and coloured by risk. Select a rule to open the change.
            {scheduleTruncated && (
              <> The schedule is larger than this view reads in one pass, so the window may omit the
              furthest-out changes.</>
            )}
          </p>
        </div>
      </div>

      <ForwardWindow changes={upcoming} onSelect={(id) => navigate(`/changes/${id}`)} />

      {/* ── Register ── */}
      <div className="cx-sectionhead">
        <div>
          <h2 className="cx-sectionhead__title">Register</h2>
          <p className="cx-sectionhead__deck">
            Every change on record, including those already completed or cancelled.
          </p>
        </div>
      </div>

      <Toolbar>
        <div className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {isLoading ? '—' : `${totalItems} change${totalItems === 1 ? '' : 's'}`}
          </span>
          <span className="cx-listhead__count-meta">page {page} of {totalPages}</span>
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search changes..."
            className="input-field pl-8 py-1.5 text-[13px]"
          />
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <select
          aria-label="Filter by type"
          value={selectedType}
          onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
          className={clsx('filter-select', selectedType && 'filter-select--active')}
        >
          <option value="">All types</option>
          {ALL_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
        </select>

        <select
          aria-label="Filter by state"
          value={selectedState}
          onChange={(e) => { setSelectedState(e.target.value); setPage(1); }}
          className={clsx('filter-select', selectedState && 'filter-select--active')}
        >
          <option value="">All states</option>
          {ALL_STATES.map((s) => <option key={s} value={s}>{stateLabel[s]}</option>)}
        </select>

        <select
          aria-label="Filter by risk"
          value={selectedRisk}
          onChange={(e) => { setSelectedRisk(e.target.value); setPage(1); }}
          className={clsx('filter-select', selectedRisk && 'filter-select--active')}
        >
          <option value="">All risk</option>
          {ALL_RISKS.map((r) => <option key={r} value={r}>{riskLabel[r]}</option>)}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-[11px] text-dim hover:text-coral transition-colors ml-auto"
          >
            <X size={11} />
            Clear filters
          </button>
        )}
      </Toolbar>

      <div className="cx-table-wrap">
        <div className="overflow-x-auto">
          <table className="cx-table">
            <thead>
              <tr>
                {([
                  ['number', 'Change'],
                  ['risk', 'Risk'],
                  ['state', 'State'],
                  ['shortDescription', 'Summary'],
                  ['plannedStartDate', 'Planned start'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th key={field}>
                    <button
                      type="button"
                      onClick={() => handleSort(field)}
                      className="inline-flex items-center gap-1 hover:text-ink transition-colors"
                    >
                      {label}
                      <SortIcon field={field} />
                    </button>
                  </th>
                ))}
                <th>Requested by</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j}><div className="h-3.5 rounded bg-[color:var(--argus-elevated)] w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <AlertTriangle size={22} className="mx-auto mb-2 text-crimson" strokeWidth={1.75} />
                    <p className="text-sm text-ink font-medium">Changes did not load</p>
                    <p className="text-xs text-muted mt-1">Reload the page to try again.</p>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <p className="text-sm text-ink font-medium">No changes match these filters</p>
                    <p className="text-xs text-muted mt-1">
                      {hasFilters ? 'Clear the filters to see the full register.' : 'Raise a change to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                sorted.map((chg) => (
                  <tr key={chg.id} onClick={() => navigate(`/changes/${chg.id}`)} className="cursor-pointer">
                    <td>
                      <span className="font-mono text-[12px] text-signal">{chg.number}</span>
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-dim mt-0.5">
                        {chg.type.toLowerCase()}
                      </span>
                    </td>
                    <td><RiskRule risk={chg.risk} /></td>
                    <td><StateBadge state={chg.state} /></td>
                    <td className="max-w-md">
                      <span className="block truncate text-ink">{chg.shortDescription}</span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-[12px] text-muted">
                      {formatWindow(chg.plannedStartDate)}
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-muted">{getDisplayName(chg.requestedBy)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalItems > 0 && (
          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[color:var(--argus-border)]">
            <span className="text-[12px] text-muted">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="px-2 text-[12px] font-mono text-muted">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

/** Neutral sort affordance for a column that is not currently sorted. */
function ChevronsIcon() {
  return (
    <span className="inline-flex flex-col -space-y-1 text-graphite" aria-hidden>
      <ChevronUp size={10} />
      <ChevronDown size={10} />
    </span>
  );
}
