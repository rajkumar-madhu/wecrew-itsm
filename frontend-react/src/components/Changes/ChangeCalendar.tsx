import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, X, GitBranch,
  Clock, User, AlertTriangle, LayoutGrid, List,
} from 'lucide-react';
import { useChanges } from '../../hooks/useChanges';

// ── Types ──────────────────────────────────────────────────────────────────────
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

// ── Constants ──────────────────────────────────────────────────────────────────
const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  NORMAL:    { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.3)',  text: '#4F46E5', label: 'Normal' },
  STANDARD:  { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)',  text: '#059669', label: 'Standard' },
  EMERGENCY: { bg: 'rgba(220,38,38,0.1)',  border: 'rgba(220,38,38,0.3)',   text: '#DC2626', label: 'Emergency' },
  MAJOR:     { bg: 'rgba(217,119,6,0.1)',  border: 'rgba(217,119,6,0.3)',   text: '#D97706', label: 'Major' },
};

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  NEW:          { bg: '#F1F5F9', text: '#475569' },
  ASSESSMENT:   { bg: 'rgba(99,102,241,0.1)', text: '#4F46E5' },
  APPROVAL:     { bg: 'rgba(217,119,6,0.1)', text: '#D97706' },
  SCHEDULED:    { bg: 'rgba(16,185,129,0.1)', text: '#059669' },
  IMPLEMENTING: { bg: 'rgba(245,158,11,0.1)', text: '#B45309' },
  REVIEW:       { bg: 'rgba(124,58,237,0.1)', text: '#7C3AED' },
  CLOSED:       { bg: '#F1F5F9', text: '#6B7280' },
  CANCELLED:    { bg: 'rgba(220,38,38,0.08)', text: '#DC2626' },
};

function riskBadge(risk: string) {
  if (risk === 'HIGH') return { bg: 'rgba(220,38,38,0.1)', text: '#DC2626', border: 'rgba(220,38,38,0.2)' };
  if (risk === 'MEDIUM') return { bg: 'rgba(217,119,6,0.1)', text: '#D97706', border: 'rgba(217,119,6,0.2)' };
  return { bg: 'rgba(16,185,129,0.1)', text: '#059669', border: 'rgba(16,185,129,0.2)' };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ChangeCalendar() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView]   = useState<'month' | 'week'>('month');
  const [selected, setSelected] = useState<Change | null>(null);

  const { data, isLoading } = useChanges({ limit: 500, page: 1 });
  const changes: Change[] = data?.data || [];

  // Build calendar grid for month view
  const monthCells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  // Week view: Mon–Sun of the current week (first week of selected month by default)
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

  // Index changes by YYYY-MM-DD
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

  // Legend: types present in this month
  const typesInMonth = useMemo(() => {
    const seen = new Set<string>();
    activeCells.forEach(day => {
      if (!day) return;
      const k = day.toISOString().slice(0, 10);
      (byDay.get(k) || []).forEach(c => seen.add(c.type));
    });
    return Array.from(seen);
  }, [activeCells, byDay]);

  return (
    <div className="animate-fade-in">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-white shadow-sm border border-stone-200 rounded-2xl mx-4 mt-4">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-64 h-16 opacity-[0.06] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 100% 0%, #4F46E5 0%, transparent 70%)' }} />

        <div className="relative px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.25)' }}>
                <CalendarDays className="w-5 h-5" style={{ color: '#4F46E5' }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#4F46E5' }}>Changes</span>
                  <span className="text-stone-300">/</span>
                  <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">Calendar</span>
                </div>
                <h1 className="text-[22px] font-display font-bold text-stone-900 tracking-tight">Change Calendar</h1>
                <p className="text-[12px] text-stone-500 mt-0.5">Visualize scheduled changes by date</p>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #E7E5E4' }}>
                <button
                  onClick={() => setView('month')}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors"
                  style={view === 'month' ? { background: '#4F46E5', color: '#FFFFFF' } : { background: '#FAFAF9', color: '#78716C' }}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Month
                </button>
                <button
                  onClick={() => setView('week')}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors"
                  style={view === 'week' ? { background: '#4F46E5', color: '#FFFFFF' } : { background: '#FAFAF9', color: '#78716C' }}
                >
                  <List className="w-3.5 h-3.5" />
                  Week
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Month nav ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-stone-200 bg-white">
        <button onClick={prevMonth} className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center select-none flex items-center gap-3">
          <span className="text-xl font-display font-bold text-stone-900">{MONTH_NAMES[month]}</span>
          <span className="text-xl font-display font-bold text-stone-400">{year}</span>
          {isLoading && (
            <div className="w-4 h-4 border border-[#4F46E5]/30 border-t-[#4F46E5] rounded-full animate-spin" />
          )}
        </div>
        <button onClick={nextMonth} className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ── Calendar Grid ── */}
      <div className="px-4 pb-6 pt-3 bg-white min-h-[600px]">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center py-1.5 text-[10px] font-bold tracking-[0.18em] text-stone-400 uppercase font-mono">{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 gap-1">
          {activeCells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} className="h-[120px] rounded-xl" style={{ background: '#FAFAF9' }} />;

            const key = day.toISOString().slice(0, 10);
            const isToday = day.toDateString() === today.toDateString();
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const dayChanges = byDay.get(key) || [];
            const visible = dayChanges.slice(0, 3);
            const overflow = dayChanges.length - visible.length;
            const isOtherMonth = view === 'week' && (day.getMonth() !== month);

            return (
              <div
                key={key}
                className="h-[120px] rounded-xl p-2 flex flex-col"
                style={{
                  background: isToday ? 'rgba(79,70,229,0.05)' : isWeekend ? '#FAFAF9' : '#FFFFFF',
                  border: isToday ? '1px solid rgba(79,70,229,0.25)' : '1px solid #E7E5E4',
                  opacity: isOtherMonth ? 0.4 : 1,
                }}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <span className={`text-[13px] font-bold font-mono leading-none ${isToday ? 'text-[#4F46E5]' : isWeekend ? 'text-stone-400' : 'text-stone-500'}`}>
                    {day.getDate()}
                  </span>
                  {isToday && (
                    <span className="text-[8px] font-bold font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                      style={{ color: '#4F46E5', background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.3)' }}>
                      TODAY
                    </span>
                  )}
                </div>

                {/* Change chips */}
                <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                  {visible.map(c => {
                    const tc = TYPE_COLORS[c.type] || TYPE_COLORS.NORMAL;
                    return (
                      <button
                        key={c.id}
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
                  {overflow > 0 && (
                    <span className="text-[8px] text-stone-400 font-mono px-1">+{overflow} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {typesInMonth.length > 0 && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-[9px] text-stone-400 font-mono uppercase tracking-widest">Type:</span>
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

        {/* Empty state */}
        {changes.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.15)' }}>
              <GitBranch className="w-6 h-6" style={{ color: '#4F46E5' }} />
            </div>
            <p className="text-[13px] text-stone-500 font-mono">No scheduled changes found</p>
          </div>
        )}
      </div>

      {/* ── Side Panel ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-4"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="w-full max-w-md h-[90vh] overflow-y-auto rounded-2xl flex flex-col"
            style={{ background: '#FFFFFF', border: '1px solid #E7E5E4', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.2)' }}>

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid #E7E5E4' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: (TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).bg, border: `1px solid ${(TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).border}` }}>
                  <GitBranch className="w-4 h-4" style={{ color: (TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).text }} />
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: (TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).text }}>
                    {selected.changeNumber}
                  </p>
                  <p className="text-[14px] font-display font-bold text-stone-900 leading-tight">{selected.title}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel body */}
            <div className="px-5 py-5 space-y-4 flex-1">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold font-mono px-2 py-1 rounded-lg"
                  style={{
                    background: (TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).bg,
                    color: (TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).text,
                    border: `1px solid ${(TYPE_COLORS[selected.type] || TYPE_COLORS.NORMAL).border}`,
                  }}>
                  {selected.type}
                </span>
                <span className="text-[10px] font-bold font-mono px-2 py-1 rounded-lg"
                  style={{
                    background: (STATE_COLORS[selected.state] || STATE_COLORS.NEW).bg,
                    color: (STATE_COLORS[selected.state] || STATE_COLORS.NEW).text,
                    border: '1px solid transparent',
                  }}>
                  {selected.state}
                </span>
                {selected.risk && (
                  <span className="text-[10px] font-bold font-mono px-2 py-1 rounded-lg"
                    style={{
                      background: riskBadge(selected.risk).bg,
                      color: riskBadge(selected.risk).text,
                      border: `1px solid ${riskBadge(selected.risk).border}`,
                    }}>
                    Risk: {selected.risk}
                  </span>
                )}
              </div>

              {/* Description */}
              {selected.description && (
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Description</p>
                  <p className="text-[13px] text-stone-700 leading-relaxed">{selected.description}</p>
                </div>
              )}

              {/* Schedule */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Schedule</p>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#4F46E5' }} />
                  <div>
                    <p className="text-[11px] text-stone-500">Start</p>
                    <p className="text-[13px] font-semibold text-stone-900">
                      {selected.scheduledStart ? fmtDate(selected.scheduledStart) : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
                  <div>
                    <p className="text-[11px] text-stone-500">End</p>
                    <p className="text-[13px] font-semibold text-stone-900">
                      {selected.scheduledEnd ? fmtDate(selected.scheduledEnd) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Assignee */}
              {selected.assignee && (
                <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                    {selected.assignee.firstName[0]}{selected.assignee.lastName[0]}
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Assignee</p>
                    <p className="text-[13px] font-semibold text-stone-900">
                      {selected.assignee.firstName} {selected.assignee.lastName}
                    </p>
                  </div>
                  <User className="w-4 h-4 ml-auto" style={{ color: '#D6D3D1' }} />
                </div>
              )}

              {/* Risk alert for EMERGENCY */}
              {selected.type === 'EMERGENCY' && (
                <div className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#DC2626' }} />
                  <p className="text-[12px] font-semibold" style={{ color: '#DC2626' }}>
                    Emergency change — requires expedited approval
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
