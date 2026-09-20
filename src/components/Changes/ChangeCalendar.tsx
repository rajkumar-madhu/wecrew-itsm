import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, X, GitBranch,
  Clock, User, AlertTriangle, LayoutGrid, List, Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useChangeCensus } from '../../hooks/useChanges';
import { Page, Toolbar, Segmented } from '../ui/PageChrome';

interface Change {
  id: string;
  title: string;
  changeNumber: string;
  type: 'NORMAL' | 'STANDARD' | 'EMERGENCY' | 'MAJOR';
  state: string;
  risk: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  assignee?: { firstName: string; lastName: string } | null;
  description?: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  NORMAL:    { bg: 'rgba(43,76,255,0.10)',  border: 'rgba(43,76,255,0.22)',  text: '#2b4cff', label: 'Normal' },
  STANDARD:  { bg: 'rgba(15,122,85,0.10)',  border: 'rgba(15,122,85,0.22)',  text: '#0f7a55', label: 'Standard' },
  EMERGENCY: { bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.22)',  text: '#dc2626', label: 'Emergency' },
  MAJOR:     { bg: 'rgba(217,119,6,0.10)',  border: 'rgba(217,119,6,0.22)',  text: '#d97706', label: 'Major' },
};

const STATE_TONE: Record<string, 'neutral' | 'warn' | 'ok' | 'alert' | 'danger'> = {
  NEW: 'neutral',
  DRAFT: 'neutral',
  ASSESSMENT: 'warn',
  SUBMITTED: 'warn',
  APPROVAL: 'warn',
  APPROVED: 'ok',
  SCHEDULED: 'ok',
  IMPLEMENTING: 'alert',
  REVIEW: 'warn',
  CLOSED: 'neutral',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
};

function riskTone(risk: string): 'danger' | 'warn' | 'ok' {
  if (risk === 'HIGH') return 'danger';
  if (risk === 'MEDIUM') return 'warn';
  return 'ok';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function asCalChange(raw: any): Change {
  const assignee = raw.assignedTo || raw.assignee || null;
  return {
    id: raw.id,
    title: raw.shortDescription || raw.title || '',
    changeNumber: raw.number || raw.changeNumber || '',
    type: raw.type || 'NORMAL',
    state: raw.state || 'DRAFT',
    risk: raw.risk || raw.riskLevel || 'MEDIUM',
    scheduledStart: raw.plannedStartDate || raw.scheduledStart || null,
    scheduledEnd: raw.plannedEndDate || raw.scheduledEnd || null,
    assignee: assignee ? { firstName: assignee.firstName || '', lastName: assignee.lastName || '' } : null,
    description: raw.description || undefined,
  };
}

export default function ChangeCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selected, setSelected] = useState<Change | null>(null);

  // Bound the census to the visible month (±1 for week spill) on
  // plannedStartDate — an unbounded asc sort quietly under-counted large
  // tenants, and createdAt dateFrom would miss rescheduled work.
  const plannedFrom = useMemo(() => new Date(year, month - 1, 1).toISOString(), [year, month]);
  const plannedTo = useMemo(() => new Date(year, month + 2, 0, 23, 59, 59, 999).toISOString(), [year, month]);
  const { data: census, isLoading } = useChangeCensus({
    sortBy: 'plannedStartDate',
    sortOrder: 'asc',
    plannedFrom,
    plannedTo,
  });
  const changes: Change[] = useMemo(
    () => (census?.items ?? []).map(asCalChange),
    [census],
  );
  const truncated = Boolean(census?.truncated);

  const monthCells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const weekStart = useMemo(() => {
    const d = new Date(year, month, 1);
    const dow = d.getDay();
    d.setDate(d.getDate() - dow);
    return d;
  }, [year, month]);

  const weekCells = useMemo(() => {
    const cells: Date[] = [];
    const s = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      cells.push(new Date(s));
      s.setDate(s.getDate() + 1);
    }
    return cells;
  }, [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, Change[]>();
    changes.forEach(c => {
      if (!c.scheduledStart) return;
      const start = new Date(c.scheduledStart);
      const end = c.scheduledEnd ? new Date(c.scheduledEnd) : start;
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setHours(23, 59, 59, 999);
      while (cursor <= endDay) {
        const k = cursor.toISOString().slice(0, 10);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(c);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [changes]);

  function prevMonth() { month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1); }
  function nextMonth() { month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1); }

  const activeCells = view === 'month' ? monthCells : weekCells;

  const typesInMonth = useMemo(() => {
    const seen = new Set<string>();
    activeCells.forEach(day => {
      if (!day) return;
      const k = day.toISOString().slice(0, 10);
      (byDay.get(k) || []).forEach(c => seen.add(c.type));
    });
    return Array.from(seen);
  }, [activeCells, byDay]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const scheduledThisMonth = useMemo(() => {
    let n = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const k = new Date(year, month, d).toISOString().slice(0, 10);
      n += (byDay.get(k) || []).length;
    }
    return n;
  }, [byDay, year, month, daysInMonth]);
  const emergency = changes.filter(c => c.type === 'EMERGENCY').length;

  const kpis = [
    { label: 'On this month', value: isLoading ? '—' : scheduledThisMonth, sub: 'placed on the grid' },
    { label: 'On record', value: isLoading ? '—' : changes.length, sub: 'with a start date or not' },
    { label: 'Emergency', value: isLoading ? '—' : emergency, sub: 'bypassed the calendar', tone: emergency > 0 ? 'danger' : undefined },
    { label: 'Types in view', value: isLoading ? '—' : typesInMonth.length, sub: 'on the current grid' },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Operate · change management</span>
            <h1 className="cx-hero__title">Calendar</h1>
            <p className="cx-hero__deck">
              Every scheduled change, placed on the day it starts. Collision is the question —
              two emergency ticks on the same weekday is what the CAB should see first.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/changes" className="cx-hero__btn cx-hero__btn--ghost">Change register</Link>
            <Link to="/changes/create" className="cx-hero__btn">Raise a change</Link>
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

      {truncated && (
        <p className="cx-posture cx-posture--warn mx-0 text-sm text-ink" role="status">
          More than {census?.items?.length ?? 0} changes fall in this range — the grid may omit some marks.
        </p>
      )}

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <Link to="/changes">Changes</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Calendar</span>
      </nav>

      <Toolbar>
        <Segmented
          value={view}
          onChange={(v) => setView(v as 'month' | 'week')}
          options={[
            { value: 'month', label: 'Month', icon: LayoutGrid },
            { value: 'week', label: 'Week', icon: List },
          ]}
        />
        {isLoading && <Loader2 size={14} className="animate-spin text-dim" />}
      </Toolbar>

      <div className="cx-cal">
        <div className="cx-cal__head">
          <button type="button" onClick={prevMonth} className="cx-cal__nav" aria-label="Previous month">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="select-none">
            <span className="cx-cal__month">{MONTH_NAMES[month]}</span>
            <span className="cx-cal__year">{year}</span>
          </div>
          <button type="button" onClick={nextMonth} className="cx-cal__nav" aria-label="Next month">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="cx-cal__body">
          <div className="cx-cal__dows">
            {DAY_LABELS.map(d => <div key={d} className="cx-cal__dow">{d}</div>)}
          </div>

          <div className="cx-cal__grid">
            {activeCells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="cx-cal__pad" />;

              const key = day.toISOString().slice(0, 10);
              const isToday = day.toDateString() === today.toDateString();
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const dayChanges = byDay.get(key) || [];
              const visible = dayChanges.slice(0, 3);
              const overflow = dayChanges.length - visible.length;
              const isOtherMonth = view === 'week' && day.getMonth() !== month;
              const collide = dayChanges.filter(c => c.type === 'EMERGENCY' || c.risk === 'HIGH').length > 1;

              return (
                <div
                  key={key}
                  className={clsx(
                    'cx-cal__day',
                    isWeekend && 'cx-cal__day--weekend',
                    isToday && 'cx-cal__day--today',
                    collide && 'cx-cal__day--collide',
                    view === 'week' && 'min-h-[160px]',
                  )}
                  style={{ opacity: isOtherMonth ? 0.45 : 1 }}
                >
                  <div className="flex items-center justify-between mb-1 shrink-0">
                    <span className="cx-cal__num">{day.getDate()}</span>
                    {isToday && <span className="cx-cal__today">Today</span>}
                  </div>
                  <div className="cx-cal__chips">
                    {visible.map(c => {
                      const tc = TYPE_COLORS[c.type] || TYPE_COLORS.NORMAL;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelected(c)}
                          className="flex items-center gap-1 rounded-md px-1.5 py-[3px] min-w-0 text-left hover:opacity-80 transition-opacity"
                          style={{ background: tc.bg, border: `1px solid ${tc.border}` }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tc.text }} />
                          <span className="text-[9px] font-semibold truncate leading-tight" style={{ color: tc.text }}>
                            {c.changeNumber}
                          </span>
                        </button>
                      );
                    })}
                    {overflow > 0 && <span className="cx-cal__more">+{overflow} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {typesInMonth.length > 0 && (
          <div className="cx-cal__legend">
            <span className="cx-cal__legend-label">Type</span>
            {typesInMonth.map(t => {
              const tc = TYPE_COLORS[t] || TYPE_COLORS.NORMAL;
              return (
                <div key={t} className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                  style={{ background: tc.bg, border: `1px solid ${tc.border}` }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: tc.text }} />
                  <span className="text-[10px] font-semibold" style={{ color: tc.text }}>{tc.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {changes.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <GitBranch className="w-8 h-8 text-graphite mb-3" strokeWidth={1.75} />
          <p className="text-sm text-dim">No scheduled changes found</p>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end p-4"
          style={{ background: 'var(--argus-overlay)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div
            className="w-full max-w-md h-[90vh] overflow-y-auto flex flex-col animate-fade-in"
            style={{ background: 'var(--argus-surface)', border: '1px solid var(--argus-border)', borderRadius: 'var(--cx-radius)', boxShadow: 'var(--argus-shadow-card)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--argus-border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: (TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).bg,
                    border: `1px solid ${(TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).border}`,
                  }}
                >
                  <GitBranch className="w-4 h-4" style={{ color: (TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).text }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: (TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).text }}>
                    {selected.changeNumber}
                  </p>
                  <p className="text-[14px] font-display font-bold text-ink leading-tight truncate">{selected.title}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)]" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="cx-pill cx-pill--neutral">{selected.type}</span>
                <span className={clsx('cx-pill', `cx-pill--${STATE_TONE[selected.state] || 'neutral'}`)}>{selected.state}</span>
                {selected.risk && (
                  <span className={clsx('cx-pill', `cx-pill--${riskTone(selected.risk)}`)}>Risk: {selected.risk}</span>
                )}
              </div>

              {selected.description && (
                <div>
                  <p className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1">Description</p>
                  <p className="text-[13px] text-ink leading-relaxed">{selected.description}</p>
                </div>
              )}

              <div className="rounded-xl p-4 space-y-3 border border-steel bg-[color:var(--argus-elevated)]">
                <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Schedule</p>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5 text-signal" />
                  <div>
                    <p className="text-[11px] text-muted">Start</p>
                    <p className="text-[13px] font-semibold text-ink">
                      {selected.scheduledStart ? fmtDate(selected.scheduledStart) : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5 text-crimson" />
                  <div>
                    <p className="text-[11px] text-muted">End</p>
                    <p className="text-[13px] font-semibold text-ink">
                      {selected.scheduledEnd ? fmtDate(selected.scheduledEnd) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {selected.assignee && (
                <div className="flex items-center gap-3 rounded-xl p-4 border border-steel bg-[color:var(--argus-elevated)]">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ background: 'var(--argus-ink)', color: 'var(--brand-paper)' }}>
                    {selected.assignee.firstName[0]}{selected.assignee.lastName[0]}
                  </div>
                  <div>
                    <p className="text-[10px] text-dim uppercase tracking-widest font-bold">Assignee</p>
                    <p className="text-[13px] font-semibold text-ink">
                      {selected.assignee.firstName} {selected.assignee.lastName}
                    </p>
                  </div>
                  <User className="w-4 h-4 ml-auto text-graphite" />
                </div>
              )}

              {selected.type === 'EMERGENCY' && (
                <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 bg-crimson-dim text-crimson">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p className="text-[12px] font-semibold">Emergency change — requires expedited approval</p>
                </div>
              )}

              <Link to={`/changes/${selected.id}`} className="cx-btn cx-btn--primary w-full justify-center">
                Open change
              </Link>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
