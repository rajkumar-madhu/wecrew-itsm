import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Calendar, Users, Plus, X,
  Check, AlertCircle, CalendarDays,
} from 'lucide-react';
import api from '../../lib/api';
import { useCreateOnCallSchedule } from '../../hooks/useOnCall';

// ── Types ──────────────────────────────────────────────────────────────────────
interface OnCallUser { id: string; firstName: string; lastName: string; phone?: string; email?: string; }
interface Schedule {
  id: string; userId: string; teamId: string;
  startTime: string; endTime: string; isPrimary: boolean;
  user: OnCallUser;
}
interface TeamMember { user: { id: string; firstName: string; lastName: string; email: string } }
interface Team { id: string; name: string; members?: TeamMember[] }

// ── Color palette — deterministic by userId ────────────────────────────────────
const COLORS = [
  { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.3)',  text: '#4F46E5' },
  { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)',  text: '#059669' },
  { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)',  text: '#D97706' },
  { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',   text: '#DC2626' },
  { bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)',  text: '#7C3AED' },
  { bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.3)',  text: '#0D9488' },
  { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)',  text: '#EA580C' },
  { bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.3)',  text: '#DB2777' },
];
function personColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function initials(u: OnCallUser | { firstName: string; lastName: string }) {
  return `${u.firstName[0] || ''}${u.lastName[0] || ''}`.toUpperCase();
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocalDT(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OnCallCalendar() {
  const today = new Date();
  const [year, setYear]         = useState(today.getFullYear());
  const [month, setMonth]       = useState(today.getMonth());
  const [teamId, setTeamId]     = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selDay, setSelDay]     = useState<Date | null>(null);
  const [form, setForm]         = useState({ userId: '', startTime: '', endTime: '', isPrimary: true });
  const [saveErr, setSaveErr]   = useState('');

  const qc = useQueryClient();
  const createShift = useCreateOnCallSchedule();

  // Teams
  const { data: teamsResp } = useQuery({
    queryKey: ['teams-list-cal'],
    queryFn: async () => { const { data } = await api.get('/teams?limit=50'); return data; },
    staleTime: 60000,
  });
  const teams: Team[] = teamsResp?.data || [];

  // Team detail (members)
  const { data: teamDetailResp } = useQuery({
    queryKey: ['team-detail-cal', teamId],
    queryFn: async () => { const { data } = await api.get(`/teams/${teamId}`); return data; },
    enabled: !!teamId,
    staleTime: 60000,
  });
  const members: TeamMember[] = teamDetailResp?.data?.members || [];

  // All schedules for selected team
  const { data: historyResp, isLoading } = useQuery({
    queryKey: ['oncall-cal-history', teamId],
    queryFn: async () => { const { data } = await api.get(`/teams/${teamId}/on-call/history?limit=500&page=1`); return data; },
    enabled: !!teamId,
    staleTime: 30000,
  });
  const schedules: Schedule[] = historyResp?.data?.schedules || [];

  // Build calendar grid
  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  // Index schedules by calendar day key (YYYY-MM-DD)
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

  // Unique engineers in this month's visible schedules
  const legend = useMemo(() => {
    const seen = new Map<string, OnCallUser>();
    byDay.forEach(list => list.forEach(s => { if (!seen.has(s.userId)) seen.set(s.userId, s.user); }));
    return Array.from(seen.entries());
  }, [byDay]);

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

  return (
    <div className="animate-fade-in">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-white shadow-card border border-stone-200 rounded-2xl mx-4 mt-4">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative px-6 py-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <CalendarDays className="w-5 h-5" style={{ color: '#A78BFA' }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono text-[#7C3AED] tracking-widest uppercase">On-Call</span>
                  <span className="text-stone-300">/</span>
                  <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">Calendar</span>
                </div>
                <h1 className="text-[22px] font-display font-bold text-stone-900 tracking-tight">On-Call Rotation Calendar</h1>
                <p className="text-[12px] text-stone-500 mt-0.5">Visualize and assign shifts across your team's monthly rotation</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className="text-[13px] rounded-xl px-3 py-2 font-medium focus:outline-none"
                style={{ background: '#FAFAF9', border: '1px solid #E7E5E4', color: teamId ? '#44403C' : '#44403C', minWidth: 180 }}
              >
                <option value="">Select team…</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>

              {teamId && (
                <button
                  onClick={() => openModal()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
                  style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', color: '#7C3AED' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.15)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}
                >
                  <Plus className="w-4 h-4" />
                  Assign Shift
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Month nav ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-stone-200">
        <button onClick={prevMonth} className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center select-none">
          <span className="text-xl font-display font-bold text-stone-900">{MONTH_NAMES[month]}</span>
          <span className="text-xl font-display font-bold text-stone-400 ml-2">{year}</span>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ── Calendar ── */}
      <div className="px-4 pb-6 pt-3">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center py-1.5 text-[10px] font-bold tracking-[0.18em] text-stone-400 uppercase font-mono">{d}</div>
          ))}
        </div>

        {/* Grid cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) {
              return (
                <div key={`e-${idx}`} className="h-[110px] rounded-xl bg-stone-50/50" />
              );
            }

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
                onClick={() => teamId && openModal(day)}
                className="h-[110px] rounded-xl p-2 flex flex-col transition-all group"
                style={{
                  background: isToday
                    ? 'rgba(124,58,237,0.06)'
                    : isWeekend
                    ? '#FAFAF9'
                    : '#FFFFFF',
                  border: isToday
                    ? '1px solid rgba(124,58,237,0.3)'
                    : '1px solid #E7E5E4',
                  cursor: teamId ? 'pointer' : 'default',
                }}
                onMouseEnter={e => { if (teamId) (e.currentTarget as HTMLElement).style.background = isToday ? 'rgba(124,58,237,0.1)' : '#F5F5F4'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isToday ? 'rgba(124,58,237,0.06)' : isWeekend ? '#FAFAF9' : '#FFFFFF'; }}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <span className={`text-[13px] font-bold font-mono leading-none ${isToday ? 'text-[#7C3AED]' : isWeekend ? 'text-stone-400' : 'text-stone-500'}`}>
                    {day.getDate()}
                  </span>
                  {isToday && (
                    <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-[#7C3AED] bg-[#7C3AED]/15 px-1.5 py-0.5 rounded-full border border-[#7C3AED]/30">
                      TODAY
                    </span>
                  )}
                </div>

                {/* Engineer chips */}
                <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                  {visible.map(s => {
                    const c = personColor(s.userId);
                    return (
                      <div key={s.id}
                        className="flex items-center gap-1 rounded-md px-1.5 py-[3px] min-w-0"
                        style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                        <div className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[7px] font-black"
                          style={{ background: c.border, color: '#FFFFFF' }}>
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

                  {overflow > 0 && (
                    <span className="text-[8px] text-stone-400 font-mono px-1">+{overflow} more</span>
                  )}

                  {/* Hover "add" hint when empty */}
                  {teamId && daySched.length === 0 && (
                    <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-3.5 h-3.5 text-stone-300" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {legend.length > 0 && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-[9px] text-stone-400 font-mono uppercase tracking-widest mr-1">Engineers:</span>
            {legend.map(([uid, user]) => {
              const c = personColor(uid);
              return (
                <div key={uid} className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                    style={{ background: c.border, color: '#FFFFFF' }}>
                    {initials(user)}
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: c.text }}>{user.firstName} {user.lastName}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!teamId && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <Users className="w-7 h-7 text-[#7C3AED]" />
            </div>
            <p className="text-[13px] text-stone-500 font-mono">Select a team to view the on-call calendar</p>
          </div>
        )}

        {teamId && isLoading && (
          <div className="flex items-center justify-center py-8 gap-2">
            <div className="w-4 h-4 border border-[#7C3AED]/40 border-t-[#7C3AED] rounded-full animate-spin" />
            <span className="text-[11px] text-stone-400 font-mono">Loading schedules…</span>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E7E5E4', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E7E5E4' }}>
              <div>
                <h3 className="text-[15px] font-display font-bold text-stone-900">Assign On-Call Shift</h3>
                {selDay && (
                  <p className="text-[11px] text-stone-500 mt-0.5 font-mono">
                    {selDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
              <button onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Engineer select */}
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Engineer</label>
                <select
                  value={form.userId}
                  onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-[13px] text-stone-900 focus:outline-none"
                  style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}
                >
                  <option value="">Select engineer…</option>
                  {members.map((m: TeamMember) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.firstName} {m.user.lastName} — {m.user.email}
                    </option>
                  ))}
                </select>
                {members.length === 0 && (
                  <p className="text-[10px] text-stone-400 mt-1 font-mono">No members found — add members to this team first.</p>
                )}
              </div>

              {/* Start / End times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Start</label>
                  <input type="datetime-local" value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-[12px] text-stone-900 focus:outline-none"
                    style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">End</label>
                  <input type="datetime-local" value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-[12px] text-stone-900 focus:outline-none"
                    style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}
                  />
                </div>
              </div>

              {/* Primary toggle */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                <div>
                  <p className="text-[12px] font-semibold text-stone-900">Primary Responder</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">First point of contact for incidents</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, isPrimary: !f.isPrimary }))}
                  className="w-10 h-6 rounded-full relative shrink-0 transition-all"
                  style={{ background: form.isPrimary ? '#7C3AED' : 'rgba(255,255,255,0.1)' }}
                >
                  <span className="absolute top-[4px] w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: form.isPrimary ? 'calc(100% - 20px)' : '4px' }} />
                </button>
              </div>

              {saveErr && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {saveErr}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #E7E5E4' }}>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-[13px] font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createShift.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
                style={{ background: '#7C3AED', border: '1px solid #7C3AED', color: '#FFFFFF' }}
              >
                <Check className="w-3.5 h-3.5" />
                {createShift.isPending ? 'Saving…' : 'Assign Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
