import type React from 'react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  Clock,
  Users,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Shield,
  Calendar,
  Bell,
  CheckCircle,
  Timer,
  User,
  Zap,
  Mail,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { useTeams } from '../../hooks/useTeams';
import { useOnCallOverview, useOnCallSchedules, useEscalationPolicies, useOnCallHistory } from '../../hooks/useOnCall';

/* ====================================================================
   HELPERS
   ==================================================================== */
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatName(user: any): string {
  if (!user) return '—';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '—';
}

function initials(user: any): string {
  const name = formatName(user);
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'ended';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

const NOTIFY_ICONS: Record<string, any> = {
  PHONE: Phone,
  EMAIL: Mail,
  SLACK: MessageSquare,
  SMS: Phone,
};

// Dark glass level colors for escalation chain
const LEVEL_DARK = [
  { bg: 'rgba(217,119,6,0.15)',   color: '#FCD34D', border: 'rgba(217,119,6,0.4)',   dot: '#D97706' },
  { bg: 'rgba(234,88,12,0.15)',   color: '#FCA5A5', border: 'rgba(234,88,12,0.4)',   dot: '#EA580C' },
  { bg: 'rgba(220,38,38,0.15)',   color: '#FCA5A5', border: 'rgba(220,38,38,0.4)',   dot: '#DC2626' },
  { bg: 'rgba(185,28,28,0.20)',   color: '#FCA5A5', border: 'rgba(185,28,28,0.5)',   dot: '#B91C1C' },
];

function PriorityBadge({ p }: { p: string }) {
  const style: React.CSSProperties =
    p === 'P1' ? { background: 'rgba(220,38,38,0.15)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.35)' } :
    p === 'P2' ? { background: 'rgba(217,119,6,0.15)', color: '#FCD34D', border: '1px solid rgba(217,119,6,0.35)' } :
    p === 'P3' ? { background: 'rgba(14,165,233,0.15)', color: '#7DD3FC', border: '1px solid rgba(14,165,233,0.35)' } :
    { background: 'rgba(100,116,139,0.15)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.3)' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold rounded-md" style={style}>
      {p}
    </span>
  );
}

/* ====================================================================
   MAIN COMPONENT
   ==================================================================== */
export default function OnCallDashboard() {
  const navigate = useNavigate();
  const { data: teamsResponse, isLoading: teamsLoading } = useTeams({});
  const teams: any[] = teamsResponse?.data || [];

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [weekOffset, setWeekOffset] = useState(0);

  const activeTeamId = selectedTeamId || teams[0]?.id || '';

  const { data: overviewData, isLoading: overviewLoading } = useOnCallOverview();
  const { data: schedulesData } = useOnCallSchedules(activeTeamId);
  const { data: escalationData } = useEscalationPolicies(activeTeamId);
  const { data: historyData } = useOnCallHistory(activeTeamId);

  const overview = overviewData?.data;
  const schedules: any[] = schedulesData?.data || [];
  const escalationPolicies: any[] = escalationData?.data || [];
  const history = historyData?.data;
  const recentIncidents: any[] = history?.recentIncidents || [];

  const stats = overview?.stats || { activeResponders: 0, teamsCovered: 0, openCritical: 0, totalSchedules: 0 };
  const allOnCall: any[] = overview?.schedules || [];

  const primarySchedules = schedules.filter((s: any) => s.isPrimary);
  const secondarySchedules = schedules.filter((s: any) => !s.isPrimary);

  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [weekStart]);

  const isToday = (d: Date) => {
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const coverageMatrix = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const sched of allOnCall) {
      const start = new Date(sched.startTime);
      const end = new Date(sched.endTime);
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const cellTime = new Date(weekDates[d]);
          cellTime.setHours(h);
          if (cellTime >= start && cellTime < end) {
            matrix[d][h]++;
          }
        }
      }
    }
    return matrix;
  }, [allOnCall, weekDates]);

  const isLoadingAny = teamsLoading || overviewLoading;

  // Shared dark glass card style
  const glassCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
  };

  const cardHeaderStyle: React.CSSProperties = {
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  };

  return (
    <div className="animate-fade-in space-y-0" style={{ background: 'linear-gradient(180deg, #030B18 0%, #020810 40%, #060606 100%)', minHeight: '100vh', padding: '1.5rem' }}>
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden mb-5" style={{ background: 'linear-gradient(180deg, #030B18 0%, #071428 100%)', border: '1px solid rgba(245,158,11,0.15)' }}>
        {/* 3px accent line */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #F59E0B, #D97706, transparent)' }} />
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        {/* Glow orbs */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)' }} />

        <div className="relative px-6 pt-6 pb-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                <Phone size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold tracking-tight" style={{ color: '#E2EEF9' }}>On-Call Management</h1>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Active responders, escalation policies & incident pages</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10B981' }} />
              <span className="text-xs font-mono font-medium" style={{ color: '#6EE7B7' }}>Live</span>
            </div>
          </div>

          {/* Currently On-Call Banner */}
          {allOnCall.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Currently On-Call</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {allOnCall.slice(0, 8).map((s: any, i: number) => (
                  <div key={s.id || i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl shrink-0 min-w-[200px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: s.isPrimary ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #475569, #64748B)' }}>
                      {initials(s.user)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: '#E2EEF9' }}>{formatName(s.user)}</p>
                      <p className="text-[10px] font-mono truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.team?.name} · {s.isPrimary ? 'Primary' : 'Backup'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hero Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Users,         label: 'Active Responders', value: stats.activeResponders, color: '#FCD34D',  bg: 'rgba(217,119,6,0.15)' },
              { icon: Shield,        label: 'Teams Covered',     value: stats.teamsCovered,     color: '#6EE7B7',  bg: 'rgba(5,150,105,0.15)' },
              { icon: AlertTriangle, label: 'Open P1/P2',        value: stats.openCritical,     color: '#FCA5A5',  bg: 'rgba(220,38,38,0.15)' },
              { icon: Calendar,      label: 'Total Schedules',   value: stats.totalSchedules,   color: '#7DD3FC',  bg: 'rgba(14,165,233,0.15)' },
            ].map((s, i) => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
                    <p className="font-display text-2xl font-extrabold" style={{ color: '#E2EEF9' }}>{isLoadingAny ? '—' : s.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                    <s.icon size={18} style={{ color: s.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' }} />
      </div>

      {/* ── Team Selector ── */}
      <div className="-mt-3 relative z-10 rounded-xl p-3 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-3">
          <Users size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Team</span>
          <select
            value={activeTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="flex-1 max-w-xs px-3 py-1.5 rounded-lg text-sm focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2EEF9' }}
          >
            {teams.map((t: any) => (
              <option key={t.id} value={t.id} style={{ background: '#0C1220' }}>{t.name}</option>
            ))}
          </select>
          {teamsLoading && <Loader2 size={14} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />}
        </div>
      </div>

      {/* ── 3-COLUMN LAYOUT ── */}
      <div className="grid grid-cols-12 gap-5">

        {/* LEFT: Active Roster (col-span-4) */}
        <div className="col-span-4 space-y-4">
          <div className="rounded-xl overflow-hidden" style={glassCard}>
            <div className="px-4 py-3 flex items-center justify-between" style={cardHeaderStyle}>
              <span className="text-[13px] font-bold flex items-center gap-2" style={{ color: '#E2EEF9' }}>
                <User size={14} style={{ color: '#FCD34D' }} />
                Active Roster
              </span>
              <span className="text-[10px] font-mono font-semibold flex items-center gap-1" style={{ color: '#6EE7B7' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
                Live
              </span>
            </div>
            <div className="px-4 py-3 space-y-3">
              {schedules.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>No active on-call schedules</p>
              ) : (
                <>
                  {/* Primary responders */}
                  {primarySchedules.map((s: any) => (
                    <div key={s.id} className="p-3 rounded-xl" style={{ background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.25)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                          {initials(s.user)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-display font-bold" style={{ color: '#E2EEF9' }}>{formatName(s.user)}</p>
                          <p className="text-[10px] font-mono font-semibold" style={{ color: '#FCD34D' }}>Primary On-Call</p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span className="flex items-center gap-1"><Clock size={10} /> Ends in {timeUntil(s.endTime)}</span>
                        {s.user?.phone && (
                          <>
                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                            <span className="flex items-center gap-1"><Phone size={10} /> {s.user.phone}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        {s.user?.phone && <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.2)' }} title="Phone"><Phone size={11} style={{ color: '#FCD34D' }} /></span>}
                        {s.user?.email && <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.2)' }} title="Email"><Mail size={11} style={{ color: '#FCD34D' }} /></span>}
                        <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.2)' }} title="Slack"><MessageSquare size={11} style={{ color: '#FCD34D' }} /></span>
                      </div>
                    </div>
                  ))}

                  {/* Secondary responders */}
                  {secondarySchedules.map((s: any) => (
                    <div key={s.id} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #475569, #64748B)' }}>
                          {initials(s.user)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-display font-bold" style={{ color: '#E2EEF9' }}>{formatName(s.user)}</p>
                          <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>Backup · Ends in {timeUntil(s.endTime)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Team Coverage */}
              {teams.length > 0 && (
                <div className="pt-2 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>All Teams</p>
                  {teams.slice(0, 6).map((team: any) => {
                    const isActive = team.id === activeTeamId;
                    return (
                      <button
                        key={team.id}
                        onClick={() => setSelectedTeamId(team.id)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left"
                        style={isActive
                          ? { background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.3)' }
                          : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div className="flex items-center gap-2">
                          <Users size={12} style={{ color: isActive ? '#FCD34D' : 'rgba(255,255,255,0.35)' }} />
                          <span className="text-xs font-medium truncate max-w-[130px]" style={{ color: isActive ? '#FCD34D' : '#CBD5E1' }}>{team.name}</span>
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{team.members?.length || team._count?.members || '—'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CENTER: Timeline & Schedule (col-span-5) */}
        <div className="col-span-5 space-y-4">
          <div className="rounded-xl overflow-hidden" style={glassCard}>
            <div className="px-4 py-3 flex items-center justify-between" style={cardHeaderStyle}>
              <span className="text-[13px] font-bold flex items-center gap-2" style={{ color: '#E2EEF9' }}>
                <Calendar size={14} style={{ color: '#FCD34D' }} />
                Weekly Schedule
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setWeekOffset(o => o - 1)} className="p-1 rounded-md transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setWeekOffset(0)} className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-md" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                  {weekOffset === 0 ? 'This Week' : `${weekOffset > 0 ? '+' : ''}${weekOffset}w`}
                </button>
                <button onClick={() => setWeekOffset(o => o + 1)} className="p-1 rounded-md transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="space-y-0">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDates.map((d, i) => (
                    <div key={i} className="text-center py-1 rounded-lg" style={isToday(d) ? { background: 'rgba(217,119,6,0.12)' } : {}}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isToday(d) ? '#FCD34D' : 'rgba(255,255,255,0.35)' }}>
                        {DAYS_SHORT[i]}
                      </p>
                      <p className="text-[11px] font-mono" style={{ color: isToday(d) ? '#FCD34D' : 'rgba(255,255,255,0.5)', fontWeight: isToday(d) ? 700 : 400 }}>
                        {d.getDate()}
                      </p>
                      {isToday(d) && <div className="w-4 h-0.5 rounded-full mx-auto mt-0.5" style={{ background: '#F59E0B' }} />}
                    </div>
                  ))}
                </div>

                {/* Schedule blocks per team member */}
                {schedules.length === 0 ? (
                  <div className="py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <Calendar size={28} className="mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }} />
                    No schedules for this team
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {schedules.map((sched: any) => {
                      const schedStart = new Date(sched.startTime);
                      const schedEnd = new Date(sched.endTime);
                      return (
                        <div key={sched.id} className="grid grid-cols-7 gap-1">
                          {weekDates.map((dayDate, di) => {
                            const dayStart = new Date(dayDate);
                            dayStart.setHours(0, 0, 0, 0);
                            const dayEnd = new Date(dayDate);
                            dayEnd.setHours(23, 59, 59, 999);
                            const hasOverlap = schedStart <= dayEnd && schedEnd >= dayStart;
                            const cellStyle: React.CSSProperties = hasOverlap
                              ? sched.isPrimary
                                ? { background: 'rgba(217,119,6,0.20)', border: '1px solid rgba(217,119,6,0.4)', color: '#FCD34D', fontWeight: 700 }
                                : { background: 'rgba(100,116,139,0.20)', border: '1px solid rgba(100,116,139,0.35)', color: '#94A3B8' }
                              : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' };
                            return (
                              <div
                                key={di}
                                className="h-10 rounded-lg flex items-center justify-center text-[9px] font-mono transition-all"
                                style={cellStyle}
                                title={hasOverlap ? `${formatName(sched.user)} (${sched.isPrimary ? 'Primary' : 'Backup'})` : 'No coverage'}
                              >
                                {hasOverlap ? initials(sched.user) : '—'}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    {/* Legend */}
                    <div className="flex items-center gap-4 pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(217,119,6,0.2)', border: '1px solid rgba(217,119,6,0.4)' }} /> Primary
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(100,116,139,0.2)', border: '1px solid rgba(100,116,139,0.35)' }} /> Backup
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }} /> No coverage
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coverage Heatmap */}
          <div className="rounded-xl overflow-hidden" style={glassCard}>
            <div className="px-4 py-3" style={cardHeaderStyle}>
              <span className="text-[13px] font-bold flex items-center gap-2" style={{ color: '#E2EEF9' }}>
                <Zap size={14} style={{ color: '#FCD34D' }} />
                Coverage Heatmap
              </span>
            </div>
            <div className="px-4 py-3 overflow-x-auto">
              <div className="min-w-[500px]">
                {/* Hour headers */}
                <div className="flex gap-px mb-1 ml-10">
                  {HOURS.filter(h => h % 3 === 0).map(h => (
                    <div key={h} className="text-[8px] font-mono text-center" style={{ width: `${100/8}%`, color: 'rgba(255,255,255,0.25)' }}>
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>
                {/* Grid */}
                {DAYS_SHORT.map((day, di) => (
                  <div key={day} className="flex items-center gap-1 mb-px">
                    <span className="w-9 text-[9px] font-bold text-right pr-1" style={{ color: isToday(weekDates[di]) ? '#FCD34D' : 'rgba(255,255,255,0.35)' }}>
                      {day}
                    </span>
                    <div className="flex-1 flex gap-px">
                      {HOURS.map(h => {
                        const count = coverageMatrix[di]?.[h] || 0;
                        const bg = count === 0
                          ? 'rgba(220,38,38,0.15)'
                          : count === 1
                          ? 'rgba(217,119,6,0.30)'
                          : 'rgba(5,150,105,0.30)';
                        return (
                          <div
                            key={h}
                            className="h-4 rounded-[2px] flex-1 transition-colors"
                            style={{ background: bg }}
                            title={`${day} ${String(h).padStart(2, '0')}:00 — ${count} responder${count !== 1 ? 's' : ''}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-3 mt-2 ml-10">
                  <span className="flex items-center gap-1 text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}><span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(220,38,38,0.15)' }} /> Gap</span>
                  <span className="flex items-center gap-1 text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}><span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(217,119,6,0.30)' }} /> Single</span>
                  <span className="flex items-center gap-1 text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}><span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(5,150,105,0.30)' }} /> Covered</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Escalation & History (col-span-3) */}
        <div className="col-span-3 space-y-4">
          {/* Escalation Chain */}
          <div className="rounded-xl overflow-hidden" style={glassCard}>
            <div className="px-4 py-3" style={cardHeaderStyle}>
              <span className="text-[13px] font-bold flex items-center gap-2" style={{ color: '#E2EEF9' }}>
                <Shield size={14} style={{ color: '#FCD34D' }} />
                Escalation Chain
              </span>
            </div>
            <div className="px-4 py-3">
              {escalationPolicies.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>No escalation policies</p>
              ) : (
                escalationPolicies.map((policy: any) => (
                  <div key={policy.id} className="space-y-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{policy.name}</p>
                    {(policy.rules || []).map((rule: any, idx: number) => {
                      const lc = LEVEL_DARK[Math.min(rule.level - 1, 3)];
                      const NotifyIcon = NOTIFY_ICONS[rule.notifyType] || Bell;
                      return (
                        <div key={rule.id} className="relative">
                          <div className="flex items-start gap-2.5 py-2">
                            <div className="flex flex-col items-center shrink-0">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: lc.bg, color: lc.color, border: `2px solid ${lc.border}` }}>
                                L{rule.level}
                              </div>
                              {idx < (policy.rules?.length || 0) - 1 && (
                                <div className="w-px h-5 mt-1 relative" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                  <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ background: lc.dot }} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium truncate" style={{ color: '#CBD5E1' }}>{rule.notifyTargets}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                <span className="flex items-center gap-0.5"><Timer size={9} /> {rule.delayMinutes}m</span>
                                <span className="flex items-center gap-0.5"><NotifyIcon size={9} /> {rule.notifyType}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Pages */}
          <div className="rounded-xl overflow-hidden" style={glassCard}>
            <div className="px-4 py-3 flex items-center justify-between" style={cardHeaderStyle}>
              <span className="text-[13px] font-bold flex items-center gap-2" style={{ color: '#E2EEF9' }}>
                <AlertTriangle size={14} style={{ color: '#FCA5A5' }} />
                Recent Pages
              </span>
              <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{recentIncidents.length}</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto" style={{ borderTop: 'none' }}>
              {recentIncidents.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>No recent P1/P2 incidents</p>
              ) : (
                recentIncidents.map((inc: any, idx: number) => (
                  <button
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className="w-full text-left px-4 py-3 transition-colors"
                    style={{ borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[11px] font-mono" style={{ color: '#818CF8' }}>{inc.number}</span>
                      <PriorityBadge p={inc.priority} />
                    </div>
                    <p className="text-xs truncate mb-1" style={{ color: '#CBD5E1' }}>{inc.shortDescription}</p>
                    <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      <span>{relativeTime(inc.createdAt)}</span>
                      {inc.assignedTo && <span>· {formatName(inc.assignedTo)}</span>}
                    </div>
                    {inc.acknowledgedAt && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#6EE7B7', background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.3)' }}>
                        <CheckCircle size={8} /> Ack: {formatShortDate(inc.acknowledgedAt)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoadingAny && (
        <div className="flex justify-center py-6">
          <Loader2 size={24} className="animate-spin" style={{ color: '#F59E0B' }} />
        </div>
      )}
    </div>
  );
}
