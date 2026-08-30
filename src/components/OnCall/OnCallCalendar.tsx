import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Users, Plus, X,
  Check, AlertCircle, Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';
import { useCreateOnCallSchedule, useOnCallRota } from '../../hooks/useOnCall';
import { Page, Toolbar } from '../ui/PageChrome';

interface OnCallUser { id: string; firstName: string; lastName: string; phone?: string; email?: string; }
interface Schedule {
  id: string; userId: string; teamId: string;
  startTime: string; endTime: string; isPrimary: boolean;
  user: OnCallUser;
}
interface TeamMember { user: { id: string; firstName: string; lastName: string; email: string } }
interface Team { id: string; name: string; members?: TeamMember[] }

const COLORS = [
  { bg: 'rgba(43,76,255,0.10)',  border: 'rgba(43,76,255,0.22)',  text: '#2b4cff' },
  { bg: 'rgba(15,122,85,0.10)',  border: 'rgba(15,122,85,0.22)',  text: '#0f7a55' },
  { bg: 'rgba(217,119,6,0.10)',  border: 'rgba(217,119,6,0.22)',  text: '#d97706' },
  { bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.22)',  text: '#dc2626' },
  { bg: 'rgba(255,91,46,0.10)',  border: 'rgba(255,91,46,0.22)',  text: '#ff5b2e' },
  { bg: 'rgba(14,116,144,0.10)', border: 'rgba(14,116,144,0.22)', text: '#0e7490' },
  { bg: 'rgba(14,17,22,0.06)',   border: 'rgba(14,17,22,0.12)',   text: '#5c5a56' },
];
function personColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function initials(u: OnCallUser | { firstName: string; lastName: string }) {
  return `${u.firstName[0] || ''}${u.lastName[0] || ''}`.toUpperCase();
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocalDT(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OnCallCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [teamId, setTeamId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selDay, setSelDay] = useState<Date | null>(null);
  const [form, setForm] = useState({ userId: '', startTime: '', endTime: '', isPrimary: true });
  const [saveErr, setSaveErr] = useState('');

  const qc = useQueryClient();
  const createShift = useCreateOnCallSchedule();

  const { data: teamsResp } = useQuery({
    queryKey: ['teams-list-cal'],
    queryFn: async () => { const { data } = await api.get('/teams?limit=50'); return data; },
    staleTime: 60000,
  });
  const teams: Team[] = teamsResp?.data || [];

  const { data: teamDetailResp } = useQuery({
    queryKey: ['team-detail-cal', teamId],
    queryFn: async () => { const { data } = await api.get(`/teams/${teamId}`); return data; },
    enabled: !!teamId,
    staleTime: 60000,
  });
  const members: TeamMember[] = teamDetailResp?.data?.members || [];

  // `limit=500` was refused outright — the API caps limit at 100 — so the grid
  // stayed empty for every team. The rota is walked a page at a time instead.
  const { data: rotaResp, isLoading } = useOnCallRota<Schedule>(teamId);
  const schedules: Schedule[] = rotaResp?.items || [];

  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    schedules.forEach(s => {
      const cursor = new Date(s.startTime);
      cursor.setHours(0, 0, 0, 0);
      const end = new Date(s.endTime);
      while (cursor <= end) {
        if (cursor.getFullYear() === year && cursor.getMonth() === month) {
          const k = cursor.toISOString().slice(0, 10);
          if (!map.has(k)) map.set(k, []);
          map.get(k)!.push(s);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [schedules, year, month]);

  const legend = useMemo(() => {
    const seen = new Map<string, OnCallUser>();
    byDay.forEach(list => list.forEach(s => { if (!seen.has(s.userId)) seen.set(s.userId, s.user); }));
    return Array.from(seen.entries());
  }, [byDay]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const coveredDays = byDay.size;

  function prevMonth() { month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1); }
  function nextMonth() { month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1); }

  function openModal(day?: Date) {
    const base = day || new Date();
    const s = new Date(base); s.setHours(9, 0, 0, 0);
    const e = new Date(base); e.setHours(9, 0, 0, 0); e.setDate(e.getDate() + 1);
    setSelDay(base);
    setForm({ userId: '', startTime: toLocalDT(s), endTime: toLocalDT(e), isPrimary: true });
    setSaveErr('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.userId || !form.startTime || !form.endTime) {
      setSaveErr('Engineer, start time, and end time are required.');
      return;
    }
    try {
      await createShift.mutateAsync({
        teamId,
        userId: form.userId,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        isPrimary: form.isPrimary,
      });
      setShowModal(false);
      qc.invalidateQueries({ queryKey: ['oncall-cal-history', teamId] });
    } catch (e: any) {
      setSaveErr(e?.response?.data?.error || 'Failed to save shift');
    }
  }

  const kpis = [
    { label: 'Days covered', value: teamId ? (isLoading ? '—' : coveredDays) : '—', sub: `of ${daysInMonth} this month`, tone: teamId && !isLoading && coveredDays < daysInMonth ? 'warn' : undefined },
    { label: 'Engineers', value: teamId ? (isLoading ? '—' : legend.length) : '—', sub: 'on this month’s grid' },
    { label: 'Shifts', value: teamId ? (isLoading ? '—' : schedules.length) : '—', sub: 'on record for the team' },
    { label: 'Teams', value: teams.length, sub: 'that can hold a rota' },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Respond · on-call</span>
            <h1 className="cx-hero__title">Calendar</h1>
            <p className="cx-hero__deck">
              Who holds the pager on which day. An empty weekday on this grid is the same failure
              the coverage ribbon exists to catch — just read month-first.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/oncall" className="cx-hero__btn cx-hero__btn--ghost">Coverage ribbon</Link>
            {teamId && (
              <button type="button" onClick={() => openModal()} className="cx-hero__btn">
                <Plus size={14} strokeWidth={1.75} />
                Assign a shift
              </button>
            )}
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
        <Link to="/oncall">On-call</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Calendar</span>
      </nav>

      <Toolbar>
        <select
          value={teamId}
          onChange={e => setTeamId(e.target.value)}
          className={clsx('filter-select min-w-[200px]', teamId && 'filter-select--active')}
        >
          <option value="">— choose a team —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {teamId && isLoading && <Loader2 size={14} className="animate-spin text-dim" />}
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
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="cx-cal__pad" />;

              const key = day.toISOString().slice(0, 10);
              const isToday = day.toDateString() === today.toDateString();
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const daySched = byDay.get(key) || [];
              const primary = daySched.find(s => s.isPrimary);
              const backups = daySched.filter(s => !s.isPrimary);
              const visible = ([primary, ...backups].filter(Boolean) as Schedule[]).slice(0, 3);
              const overflow = daySched.length - visible.length;

              return (
                <div
                  key={key}
                  role={teamId ? 'button' : undefined}
                  tabIndex={teamId ? 0 : undefined}
                  onClick={() => teamId && openModal(day)}
                  onKeyDown={e => { if (teamId && (e.key === 'Enter' || e.key === ' ')) openModal(day); }}
                  className={clsx(
                    'cx-cal__day',
                    teamId && 'cx-cal__day--click',
                    isWeekend && 'cx-cal__day--weekend',
                    isToday && 'cx-cal__day--today',
                  )}
                >
                  <div className="flex items-center justify-between mb-1 shrink-0">
                    <span className="cx-cal__num">{day.getDate()}</span>
                    {isToday && <span className="cx-cal__today">Today</span>}
                  </div>

                  <div className="cx-cal__chips">
                    {visible.map(s => {
                      const c = personColor(s.userId);
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-1 rounded-md px-1.5 py-[3px] min-w-0"
                          style={{ background: c.bg, border: `1px solid ${c.border}` }}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[7px] font-black"
                            style={{ background: c.text, color: 'var(--brand-paper)' }}
                          >
                            {initials(s.user)}
                          </div>
                          <span className="text-[9px] font-semibold truncate leading-tight" style={{ color: c.text }}>
                            {s.user.firstName} {s.user.lastName}
                          </span>
                          {s.isPrimary && (
                            <span className="ml-auto text-[7px] font-black shrink-0 opacity-70" style={{ color: c.text }}>P</span>
                          )}
                        </div>
                      );
                    })}

                    {overflow > 0 && <span className="cx-cal__more">+{overflow} more</span>}

                    {teamId && daySched.length === 0 && (
                      <div className="cx-cal__add"><Plus className="w-3.5 h-3.5" /></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {legend.length > 0 && (
          <div className="cx-cal__legend">
            <span className="cx-cal__legend-label">Engineers</span>
            {legend.map(([uid, user]) => {
              const c = personColor(uid);
              return (
                <div key={uid} className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                    style={{ background: c.text, color: 'var(--brand-paper)' }}>
                    {initials(user)}
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: c.text }}>
                    {user.firstName} {user.lastName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!teamId && (
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="w-8 h-8 text-graphite mb-3" strokeWidth={1.75} />
          <p className="text-sm text-dim">Select a team to view the on-call calendar</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0" style={{ background: 'var(--argus-overlay)' }} />
          <div
            className="relative w-full max-w-md animate-fade-in"
            style={{ background: 'var(--argus-surface)', border: '1px solid var(--argus-border)', borderRadius: 'var(--cx-radius)', boxShadow: 'var(--argus-shadow-card)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--argus-border)' }}>
              <div>
                <p className="cx-eyebrow">On-call · shift</p>
                <h2 className="cx-sectionhead__title" style={{ fontSize: '1.25rem' }}>Assign a shift</h2>
                {selDay && (
                  <p className="text-[11px] text-dim mt-0.5 font-mono">
                    {selDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)]" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Engineer</label>
                <select
                  value={form.userId}
                  onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                  className="filter-select w-full"
                >
                  <option value="">Select engineer…</option>
                  {members.map((m: TeamMember) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.firstName} {m.user.lastName} — {m.user.email}
                    </option>
                  ))}
                </select>
                {members.length === 0 && (
                  <p className="text-[10px] text-dim mt-1 font-mono">No members found — add members to this team first.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Start</label>
                  <input type="datetime-local" value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="input-field text-[12px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">End</label>
                  <input type="datetime-local" value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="input-field text-[12px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl px-4 py-3 border border-steel bg-[color:var(--argus-elevated)]">
                <div>
                  <p className="text-[12px] font-semibold text-ink">Primary responder</p>
                  <p className="text-[10px] text-muted mt-0.5">First point of contact for incidents</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isPrimary: !f.isPrimary }))}
                  className="w-10 h-6 rounded-full relative shrink-0 transition-all"
                  style={{ background: form.isPrimary ? 'var(--argus-coral)' : 'var(--argus-steel)' }}
                  aria-pressed={form.isPrimary}
                  aria-label="Primary responder"
                >
                  <span className="absolute top-[4px] w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: form.isPrimary ? 'calc(100% - 20px)' : '4px' }} />
                </button>
              </div>

              {saveErr && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] bg-crimson-dim text-crimson">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {saveErr}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--argus-border)' }}>
              <button type="button" onClick={() => setShowModal(false)} className="cx-btn cx-btn--ghost">Cancel</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={createShift.isPending}
                className="cx-btn cx-btn--primary disabled:opacity-50"
              >
                {createShift.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {createShift.isPending ? 'Saving…' : 'Assign shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
