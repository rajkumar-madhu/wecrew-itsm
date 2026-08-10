import type React from 'react';
import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, LineChart, Line, RadialBarChart,
  RadialBar, PieChart, Pie, Legend,
} from 'recharts';
import {
  Download, BarChart3, TrendingUp, Shield, FileText, Loader2,
  AlertTriangle, CheckCircle2, Clock, Zap, Users, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, Activity, Target,
  GitMerge, Bell, ChevronRight,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

// ─── Types ─────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d';
type Section = 'overview' | 'incidents' | 'sla' | 'teams' | 'changes';

// ─── Color constants ────────────────────────────────────────────────────────

const P_COLORS: Record<string, string> = {
  P1: '#DC2626', P2: '#D97706', P3: '#4F46E5', P4: '#059669',
};
const STATE_COLORS: Record<string, string> = {
  NEW: '#4F46E5', IN_PROGRESS: '#D97706', ESCALATED: '#DC2626',
  RESOLVED: '#059669', CLOSED: '#78716C', PENDING: '#8B5CF6',
};
const SOURCE_COLORS = ['#4F46E5','#8B5CF6','#D97706','#DC2626','#059669','#0EA5E9','#78716C'];
const CHANGE_COLORS: Record<string, string> = {
  Normal: '#4F46E5', Standard: '#059669', Emergency: '#DC2626',
};

const TT = {
  contentStyle: {
    background: 'var(--argus-surface)', border: '1px solid rgba(255,91,46,0.28)',
    borderRadius: '10px', fontSize: '11px', color: 'var(--argus-ink)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
  },
  labelStyle: { color: 'var(--argus-muted)', fontWeight: 600 },
  cursor: { stroke: 'rgba(255,91,46,0.28)', strokeWidth: 1 },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, suffix = ''): string {
  if (n == null) return '–';
  return `${n.toLocaleString()}${suffix}`;
}

function fmtMttr(mins: number | null | undefined): string {
  if (mins == null) return '–';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg', className)} style={{ background: 'var(--argus-elevated)' }} />;
}

// Color token map for KpiCard accent colors
const KPI_ACCENT: Record<string, { color: string; bg: string }> = {
  'bg-signal':  { color: 'var(--argus-signal)', bg: 'rgba(255,91,46,0.14)' },
  'bg-amber-500':   { color: 'var(--argus-amber)', bg: 'rgba(217,119,6,0.15)' },
  'bg-red-500':     { color: 'var(--argus-crimson)', bg: 'rgba(220,38,38,0.15)' },
  'bg-red-400':     { color: 'var(--argus-crimson)', bg: 'rgba(220,38,38,0.12)' },
  'bg-violet-500':  { color: 'var(--argus-signal)', bg: 'rgba(139,92,246,0.15)' },
  'bg-violet-400':  { color: 'var(--argus-signal)', bg: 'rgba(139,92,246,0.12)' },
  'bg-emerald-500': { color: 'var(--argus-emerald)', bg: 'rgba(5,150,105,0.15)' },
  'bg-sky-500':     { color: '#7DD3FC', bg: 'rgba(14,165,233,0.15)' },
  'bg-rose-500':    { color: 'var(--argus-crimson)', bg: 'rgba(244,63,94,0.15)' },
};

function KpiCard({
  label, value, sub, icon: Icon, trend, trendVal, color, loading,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  trend?: 'up' | 'down' | 'flat'; trendVal?: string;
  color: string; loading?: boolean;
}) {
  const trendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const TrendIcon = trendIcon;
  const trendStyle: React.CSSProperties = trend === 'up'
    ? { color: 'var(--argus-emerald)', background: 'rgba(5,150,105,0.12)' }
    : trend === 'down'
    ? { color: 'var(--argus-crimson)', background: 'rgba(220,38,38,0.12)' }
    : { color: 'var(--argus-muted)', background: 'var(--argus-elevated)' };
  const accent = KPI_ACCENT[color] || { color: 'var(--argus-signal)', bg: 'rgba(99,102,241,0.12)' };

  return (
    <div className="rounded-2xl p-5 relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: accent.color }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: accent.bg }}>
          <Icon size={16} style={{ color: accent.color }} />
        </div>
        {trendVal && (
          <span className="flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={trendStyle}>
            <TrendIcon size={11} /> {trendVal}
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <>
          <div className="text-[28px] font-extrabold leading-none font-mono tracking-tight mb-1.5" style={{ color: 'var(--argus-ink)' }}>
            {value}
          </div>
          <div className="text-[11px] font-medium" style={{ color: 'var(--argus-muted)' }}>{label}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--argus-dim)' }}>{sub}</div>
        </>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle, loading }: { title: string; subtitle?: string; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className="text-base font-bold" style={{ color: 'var(--argus-ink)' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--argus-muted)' }}>{subtitle}</p>}
      </div>
      {loading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--argus-signal)' }} />}
    </div>
  );
}

function ChartCard({ title, subtitle, children, loading, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; loading?: boolean; className?: string;
}) {
  return (
    <div className={clsx('rounded-2xl p-5', className)} style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-bold" style={{ color: 'var(--argus-ink)' }}>{title}</h3>
          {subtitle && <p className="text-[11px] mt-0.5" style={{ color: 'var(--argus-muted)' }}>{subtitle}</p>}
        </div>
        {loading && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--argus-signal)' }} />}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ message = 'No data available for this period' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--argus-dim)' }}>
      <BarChart3 size={28} />
      <p className="text-xs font-medium text-center">{message}</p>
    </div>
  );
}

function SlaRing({ value, label, size = 90 }: { value: number; label: string; size?: number }) {
  const circ = 2 * Math.PI * 36;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  const color = value >= 95 ? '#059669' : value >= 85 ? '#D97706' : '#DC2626';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle cx="44" cy="44" r="36" fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[15px] font-extrabold font-mono" style={{ color }}>{value}%</span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>{label}</span>
    </div>
  );
}

// ─── OVERVIEW SECTION ──────────────────────────────────────────────────────

function OverviewSection({ period }: { period: Period }) {
  const { data: sumData, isLoading: sumL } = useQuery({
    queryKey: ['reports', 'executive-summary', period],
    queryFn: async () => { const { data } = await api.get('/reports/executive-summary'); return data; },
    staleTime: 60000,
  });

  const { data: trendData, isLoading: trendL } = useQuery({
    queryKey: ['reports', 'incident-trend', period],
    queryFn: async () => { const { data } = await api.get(`/reports/incident-trend?period=${period}`); return data; },
    staleTime: 60000,
  });

  const { data: incData, isLoading: incL } = useQuery({
    queryKey: ['reports', 'incidents', period],
    queryFn: async () => { const { data } = await api.get(`/reports/incidents?period=${period}`); return data; },
    staleTime: 60000,
  });

  const s = sumData?.data || {};
  const trend = trendData?.data || {};
  const inc = incData?.data || {};

  const dailyCounts = trend.dailyCounts || [];
  const mttrTrend = trend.mttrTrend || [];
  const slaData = trend.slaCompliance || [];
  const changesByType = trend.changesByType || [];
  const bySource = (inc.bySource || []).map((r: any, i: number) => ({
    name: r.source || r._source || 'Unknown',
    value: r._count || r.count || 0,
    color: SOURCE_COLORS[i % SOURCE_COLORS.length],
  }));
  const byPriority = (inc.byPriority || []).map((r: any) => ({
    priority: r.priority,
    count: r._count || r.count || 0,
    color: P_COLORS[r.priority] || '#78716C',
  }));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <KpiCard label="Total Incidents" value={fmt(s.totalIncidents)} sub={`Last ${period}`}
          icon={AlertTriangle} color="bg-signal" loading={sumL}
          trend={s.totalIncidents > 20 ? 'up' : 'down'} trendVal={`${period}`} />
        <KpiCard label="Currently Open" value={fmt(s.currentlyOpen)} sub="Active incidents"
          icon={Activity} color="bg-amber-500" loading={sumL}
          trend={s.currentlyOpen > 5 ? 'up' : 'flat'} />
        <KpiCard label="P1 Critical" value={fmt(s.p1Last7Days)} sub="Last 7 days"
          icon={Zap} color="bg-red-500" loading={sumL}
          trend={s.p1Last7Days > 0 ? 'down' : 'flat'} trendVal={s.p1Last7Days > 0 ? 'Active' : 'Clear'} />
        <KpiCard label="Avg MTTR" value={fmtMttr(s.avgMttrMinutes)} sub="Mean time to resolve"
          icon={Clock} color="bg-violet-500" loading={sumL} />
        <KpiCard label="SLA Compliance" value={s.slaCompliancePct != null ? `${s.slaCompliancePct}%` : '–'} sub="Target: 95%"
          icon={Shield} color={s.slaCompliancePct >= 95 ? 'bg-emerald-500' : 'bg-amber-500'} loading={sumL}
          trend={s.slaCompliancePct >= 95 ? 'up' : 'down'} trendVal={s.slaCompliancePct >= 95 ? 'On target' : 'Below'} />
        <KpiCard label="Change Success" value={s.changeSuccessPct != null ? `${s.changeSuccessPct}%` : '–'} sub="Successful changes"
          icon={GitMerge} color="bg-emerald-500" loading={sumL}
          trend={s.changeSuccessPct >= 80 ? 'up' : 'down'} />
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'SLA Breached', value: fmt(s.slaBreached30d), sub: `Last ${period}`, icon: Target, color: 'bg-red-400' },
          { label: 'Open Changes', value: fmt(s.totalChanges), sub: `Last ${period}`, icon: GitMerge, color: 'bg-sky-500' },
          { label: 'Open Problems', value: fmt(s.openProblems), sub: 'Under investigation', icon: FileText, color: 'bg-violet-400' },
          { label: 'Firing Alerts', value: fmt(s.firingAlerts), sub: 'Right now', icon: Bell, color: 'bg-rose-500' },
        ].map(k => (
          <KpiCard key={k.label} {...k} loading={sumL} />
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Incident Volume" subtitle={`Daily incidents vs resolved — ${period}`} loading={trendL}>
          <div className="h-52">
            {dailyCounts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyCounts} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} interval={Math.floor(dailyCounts.length / 6)} />
                  <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} />
                  <Tooltip {...TT} />
                  <Area type="monotone" dataKey="incidents" name="Incidents" stroke="#4F46E5" fill="url(#gInc)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#059669" fill="url(#gRes)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
          <div className="flex gap-4 mt-3">
            {[['#4F46E5', 'Incidents'], ['#059669', 'Resolved']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5 text-[11px] text-stone-400">
                <span className="w-3 h-1.5 rounded-full inline-block" style={{ background: c }} />{l}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Mean Time to Resolve" subtitle="MTTR trend by day (minutes)" loading={trendL}>
          <div className="h-52">
            {mttrTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mttrTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} interval={Math.floor(mttrTrend.length / 6)} />
                  <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} />
                  <Tooltip {...TT} formatter={(v: any) => [`${v}m`, 'MTTR']} />
                  <Line type="monotone" dataKey="mttr" stroke="#8B5CF6" strokeWidth={2.5} dot={false}
                    activeDot={{ r: 4, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Priority breakdown */}
        <ChartCard title="Incidents by Priority" loading={incL}>
          <div className="space-y-3 mt-1">
            {byPriority.length > 0 ? byPriority.sort((a: any, b: any) => a.priority.localeCompare(b.priority)).map((p: any) => {
              const max = Math.max(...byPriority.map((x: any) => x.count), 1);
              return (
                <div key={p.priority}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold" style={{ color: p.color }}>{p.priority}</span>
                    <span className="text-[11px] font-mono font-semibold text-stone-700">{p.count}</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(p.count / max) * 100}%`, background: p.color }} />
                  </div>
                </div>
              );
            }) : <EmptyChart message="No incident priority data" />}
          </div>
        </ChartCard>

        {/* Source breakdown */}
        <ChartCard title="Incidents by Source" loading={incL}>
          {bySource.length > 0 ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bySource} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={35} outerRadius={60} paddingAngle={3}>
                    {bySource.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip {...TT} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-44"><EmptyChart /></div>}
          <div className="flex flex-wrap gap-2 mt-2">
            {bySource.map((s: any) => (
              <span key={s.name} className="flex items-center gap-1 text-[10px] text-stone-500">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </ChartCard>

        {/* Change types */}
        <ChartCard title="Changes by Type" loading={trendL}>
          {changesByType.length > 0 ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={changesByType} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={35} outerRadius={60} paddingAngle={3}>
                    {changesByType.map((e: any, i: number) => (
                      <Cell key={i} fill={CHANGE_COLORS[e.name] || e.color || SOURCE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip {...TT} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-44"><EmptyChart /></div>}
          <div className="flex flex-wrap gap-2 mt-2">
            {changesByType.map((c: any) => (
              <span key={c.name} className="flex items-center gap-1 text-[10px] text-stone-500">
                <span className="w-2 h-2 rounded-full" style={{ background: CHANGE_COLORS[c.name] || c.color }} />
                {c.name} ({c.value})
              </span>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ─── INCIDENTS SECTION ─────────────────────────────────────────────────────

function IncidentsSection({ period }: { period: Period }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'incidents', period],
    queryFn: async () => { const { data } = await api.get(`/reports/incidents?period=${period}`); return data; },
    staleTime: 60000,
  });

  const d = data?.data || {};
  const byState = (d.byState || []).map((r: any) => ({
    state: r.state,
    count: r._count || 0,
    color: STATE_COLORS[r.state] || '#78716C',
  }));
  const byCategory = (d.byCategory || []).map((r: any) => ({
    name: r.category || 'Uncategorized',
    count: r._count || 0,
  }));
  const createdOverTime = d.createdOverTime || [];
  const mttr = (d.mttr || []).map((r: any) => ({
    priority: r.priority,
    mttr: r.avg_mttr_minutes || 0,
    resolved: r.resolved_count || 0,
    color: P_COLORS[r.priority] || '#78716C',
  }));
  const slaCompliance = (d.slaCompliance || []).map((r: any) => ({
    priority: r.priority,
    total: r.total || 0,
    met: r.met || 0,
    pct: Number(r.compliance_pct) || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'Total', value: fmt(d.total), color: 'bg-signal', icon: AlertTriangle },
          { label: 'Resolved', value: fmt((d.byState || []).find((s: any) => s.state === 'RESOLVED')?._count || 0), color: 'bg-emerald-500', icon: CheckCircle2 },
          { label: 'Avg MTTR (P1)', value: fmtMttr(mttr.find((m: any) => m.priority === 'P1')?.mttr), color: 'bg-red-500', icon: Clock },
          { label: 'SLA Met', value: slaCompliance.reduce((s: number, r: any) => s + r.met, 0).toString(), color: 'bg-violet-500', icon: Shield },
        ].map(k => <KpiCard key={k.label} {...k} sub="" loading={isLoading} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Created Over Time" subtitle="Daily incident creation" loading={isLoading}>
          <div className="h-52">
            {createdOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={createdOverTime} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    interval={Math.floor(createdOverTime.length / 6)} />
                  <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                  <Tooltip {...TT} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={8}>
                    {createdOverTime.map((_: any, i: number) => (
                      <Cell key={i} fill={`rgba(79,70,229,${0.5 + (i / createdOverTime.length) * 0.5})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </ChartCard>

        <ChartCard title="State Distribution" loading={isLoading}>
          <div className="space-y-2.5 mt-1">
            {byState.length > 0 ? byState.map((s: any) => {
              const max = Math.max(...byState.map((x: any) => x.count), 1);
              return (
                <div key={s.state} className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold text-stone-500 w-24 shrink-0">{s.state.replace('_', ' ')}</span>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: s.color }} />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-stone-700 w-6 text-right">{s.count}</span>
                </div>
              );
            }) : <EmptyChart message="No state data" />}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="MTTR by Priority" subtitle="Average minutes to resolve" loading={isLoading}>
          <div className="h-52">
            {mttr.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mttr} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 60 ? `${Math.floor(v / 60)}h` : `${v}m`} />
                  <YAxis dataKey="priority" type="category" tick={{ fontSize: 11, fill: '#44403C', fontWeight: 700 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip {...TT} formatter={(v: any) => [fmtMttr(v), 'Avg MTTR']} />
                  <Bar dataKey="mttr" radius={[0, 6, 6, 0]} barSize={18}>
                    {mttr.map((m: any) => <Cell key={m.priority} fill={m.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </ChartCard>

        <ChartCard title="Top Categories" subtitle="Incident categories (top 10)" loading={isLoading}>
          <div className="h-52 overflow-y-auto space-y-2 pr-1">
            {byCategory.length > 0 ? byCategory.slice(0, 10).map((c: any, i: number) => {
              const max = byCategory[0]?.count || 1;
              return (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-stone-300 w-4">{i + 1}</span>
                  <span className="text-[11px] text-stone-600 truncate w-36">{c.name}</span>
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(c.count / max) * 100}%` }} />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-stone-700">{c.count}</span>
                </div>
              );
            }) : <EmptyChart message="No category data" />}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ─── SLA SECTION ───────────────────────────────────────────────────────────

function SLASection({ period }: { period: Period }) {
  const { data: trendData, isLoading: trendL } = useQuery({
    queryKey: ['reports', 'incident-trend', period],
    queryFn: async () => { const { data } = await api.get(`/reports/incident-trend?period=${period}`); return data; },
    staleTime: 60000,
  });

  const { data: incData, isLoading: incL } = useQuery({
    queryKey: ['reports', 'incidents', period],
    queryFn: async () => { const { data } = await api.get(`/reports/incidents?period=${period}`); return data; },
    staleTime: 60000,
  });

  const slaRings = (trendData?.data?.slaCompliance || []).map((r: any) => ({
    priority: r.priority,
    value: Number(r.compliance) || 0,
    target: r.target || 95,
  }));

  const slaTable = (incData?.data?.slaCompliance || []).map((r: any) => ({
    priority: r.priority,
    total: r.total || 0,
    met: r.met || 0,
    pct: Number(r.compliance_pct) || 0,
  }));

  const overallPct = slaTable.length > 0
    ? Math.round(slaTable.reduce((s: number, r: any) => s + r.pct, 0) / slaTable.length)
    : null;

  const SLA_DEFS: Record<string, string> = {
    P1: '5min acknowledge · 1hr resolve',
    P2: '15min acknowledge · 4hr resolve',
    P3: '1hr acknowledge · 24hr resolve',
    P4: '4hr acknowledge · 72hr resolve',
  };

  return (
    <div className="space-y-6">
      {/* Overall SLA score */}
      <div className="bg-gradient-to-r from-[color:var(--argus-surface)] to-[color:var(--argus-elevated)] rounded-2xl p-6 flex items-center gap-8">
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Overall SLA Score</p>
          <p className="text-[52px] font-extrabold font-mono leading-none text-ink">
            {overallPct != null ? `${overallPct}%` : '–'}
          </p>
          <p className="text-slate-400 text-sm mt-2">
            {overallPct != null
              ? overallPct >= 95 ? '✓ Meeting SLA target' : '⚠ Below SLA target'
              : 'No data for this period'}
          </p>
        </div>
        <div className="h-16 w-px bg-white/10" />
        <div className="flex gap-6">
          {(trendL || !slaRings.length
            ? [{ priority: 'P1', value: 0 }, { priority: 'P2', value: 0 }, { priority: 'P3', value: 0 }, { priority: 'P4', value: 0 }]
            : slaRings
          ).map((r: any) => (
            <SlaRing key={r.priority} value={r.value} label={r.priority} />
          ))}
        </div>
        <div className="ml-auto hidden xl:block">
          <p className="text-slate-400 text-xs mb-2 font-semibold uppercase tracking-wider">SLA Definitions</p>
          {['P1', 'P2', 'P3', 'P4'].map(p => (
            <p key={p} className="text-[11px] text-slate-400 leading-6">
              <span className="font-bold" style={{ color: P_COLORS[p] }}>{p}</span> &nbsp; {SLA_DEFS[p]}
            </p>
          ))}
        </div>
      </div>

      {/* SLA Bar chart + target line */}
      <ChartCard title="SLA Compliance by Priority" subtitle="Compliance % vs 95% target" loading={trendL}>
        <div className="h-56">
          {slaRings.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slaRings} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="priority" tick={{ fontSize: 12, fill: '#44403C', fontWeight: 700 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip {...TT} formatter={(v: any) => [`${v}%`, 'Compliance']} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={44}>
                  {slaRings.map((r: any) => (
                    <Cell key={r.priority} fill={r.value >= 95 ? '#059669' : r.value >= 85 ? '#D97706' : '#DC2626'} />
                  ))}
                </Bar>
                {/* Target reference line rendered as overlay */}
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No SLA data available" />}
        </div>
      </ChartCard>

      {/* SLA Detail Table */}
      <ChartCard title="SLA Breakdown by Priority" loading={incL}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
              {['Priority', 'Total Incidents', 'SLA Met', 'Breached', 'Compliance', 'Target'].map(h => (
                <th key={h} className="text-left pb-3 font-semibold pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slaTable.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-stone-400">No SLA data for this period</td></tr>
            ) : slaTable.map((r: any) => (
              <tr key={r.priority} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                <td className="py-3 pr-4">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ color: P_COLORS[r.priority], background: P_COLORS[r.priority] + '15' }}>
                    {r.priority}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono font-semibold text-stone-700">{r.total}</td>
                <td className="py-3 pr-4 font-mono text-emerald-600 font-semibold">{r.met}</td>
                <td className="py-3 pr-4 font-mono text-red-500 font-semibold">{r.total - r.met}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.pct >= 95 ? '#059669' : r.pct >= 85 ? '#D97706' : '#DC2626' }} />
                    </div>
                    <span className="text-[11px] font-bold font-mono" style={{ color: r.pct >= 95 ? '#059669' : r.pct >= 85 ? '#D97706' : '#DC2626' }}>
                      {r.pct}%
                    </span>
                  </div>
                </td>
                <td className="py-3 text-[11px] text-stone-400">95%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>
    </div>
  );
}

// ─── TEAMS SECTION ─────────────────────────────────────────────────────────

function TeamsSection({ period }: { period: Period }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'team-performance', period],
    queryFn: async () => { const { data } = await api.get(`/reports/team-performance?period=${period}`); return data; },
    staleTime: 60000,
  });

  const teams: any[] = data?.data?.teams || [];
  const maxIncidents = Math.max(...teams.map(t => t.incident_count || 0), 1);

  return (
    <div className="space-y-6">
      {/* Team KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'Total Teams', value: teams.length.toString(), icon: Users, color: 'bg-signal' },
          { label: 'Total Assigned', value: fmt(teams.reduce((s, t) => s + (t.incident_count || 0), 0)), icon: AlertTriangle, color: 'bg-amber-500' },
          { label: 'Total Resolved', value: fmt(teams.reduce((s, t) => s + (t.resolved_count || 0), 0)), icon: CheckCircle2, color: 'bg-emerald-500' },
          { label: 'Best MTTR', value: fmtMttr(Math.min(...teams.filter(t => t.avg_mttr_minutes).map(t => t.avg_mttr_minutes))), icon: Clock, color: 'bg-violet-500' },
        ].map(k => <KpiCard key={k.label} {...k} sub="" loading={isLoading} />)}
      </div>

      {/* Team performance table */}
      <ChartCard title="Team Performance" subtitle={`Incident resolution stats — ${period}`} loading={isLoading}>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : teams.length === 0 ? (
          <div className="py-12 text-center"><EmptyChart message="No team performance data for this period" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                  {['Team', 'Incidents', 'Resolved', 'Avg MTTR', 'SLA Compliance', 'Resolution Rate'].map(h => (
                    <th key={h} className="text-left pb-3 font-semibold pr-6 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((t: any) => {
                  const name = t.team_name || '–';
                  const assigned = t.incident_count || 0;
                  const resolved = t.resolved_count || 0;
                  const mttr = t.avg_mttr_minutes;
                  const sla = Number(t.sla_compliance) || 0;
                  const resPct = assigned > 0 ? Math.round((resolved / assigned) * 100) : 0;
                  return (
                    <tr key={name} className="border-b border-stone-50 hover:bg-[color:var(--argus-signal-dim)]/30 transition-colors group">
                      <td className="py-3.5 pr-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-[color:var(--argus-signal)]">
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-stone-800 text-[12px]">{name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 pr-6">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(assigned / maxIncidents) * 100}%` }} />
                          </div>
                          <span className="font-mono text-[12px] font-bold text-stone-700">{assigned}</span>
                        </div>
                      </td>
                      <td className="py-3.5 pr-6 font-mono text-[12px] font-bold text-emerald-600">{resolved}</td>
                      <td className="py-3.5 pr-6 font-mono text-[11px] text-stone-500">{fmtMttr(mttr)}</td>
                      <td className="py-3.5 pr-6">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${sla}%`, background: sla >= 95 ? '#059669' : sla >= 80 ? '#D97706' : '#DC2626' }} />
                          </div>
                          <span className="text-[11px] font-bold font-mono" style={{ color: sla >= 95 ? '#059669' : sla >= 80 ? '#D97706' : '#DC2626' }}>
                            {sla}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span className={clsx(
                          'text-[11px] font-bold px-2.5 py-1 rounded-full',
                          resPct >= 90 ? 'bg-emerald-50 text-emerald-700' : resPct >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                        )}>
                          {resPct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* MTTR comparison bar */}
      {teams.filter(t => t.avg_mttr_minutes).length > 0 && (
        <ChartCard title="MTTR Comparison Across Teams" subtitle="Lower is better (minutes)">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teams.filter(t => t.avg_mttr_minutes)} layout="vertical"
                margin={{ top: 0, right: 30, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 60 ? `${Math.floor(v / 60)}h` : `${v}m`} />
                <YAxis dataKey="team_name" type="category" tick={{ fontSize: 10, fill: '#44403C' }} tickLine={false} axisLine={false} width={78} />
                <Tooltip {...TT} formatter={(v: any) => [fmtMttr(v), 'Avg MTTR']} />
                <Bar dataKey="avg_mttr_minutes" radius={[0, 6, 6, 0]} barSize={14}>
                  {teams.map((_: any, i: number) => (
                    <Cell key={i} fill={`hsl(${245 - i * 20}, 70%, ${55 + i * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}
    </div>
  );
}

// ─── CHANGES SECTION ───────────────────────────────────────────────────────

function ChangesSection({ period }: { period: Period }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'changes', period],
    queryFn: async () => { const { data } = await api.get(`/reports/changes?period=${period}`); return data; },
    staleTime: 60000,
  });

  const d = data?.data || {};
  const successRate = d.successRate?.[0] || {};
  const byType = (d.byType || []).map((r: any, i: number) => ({
    name: r.type?.charAt(0) + r.type?.slice(1).toLowerCase(),
    value: r._count || 0,
    color: Object.values(CHANGE_COLORS)[i] || SOURCE_COLORS[i],
  }));
  const byState = (d.byState || []).map((r: any) => ({
    state: r.state?.replace(/_/g, ' '),
    count: r._count || 0,
    color: STATE_COLORS[r.state] || '#78716C',
  }));
  const byRisk = (d.byRisk || []).map((r: any) => ({
    risk: r.riskLevel,
    count: r._count || 0,
    color: r.riskLevel === 'HIGH' ? '#DC2626' : r.riskLevel === 'MEDIUM' ? '#D97706' : '#059669',
  }));

  const successPct = Number(successRate.success_rate) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'Total Changes', value: fmt(d.total), icon: GitMerge, color: 'bg-signal' },
          { label: 'Completed', value: fmt(successRate.total_completed), icon: CheckCircle2, color: 'bg-emerald-500' },
          { label: 'Successful', value: fmt(successRate.successful), icon: TrendingUp, color: 'bg-violet-500' },
          { label: 'Success Rate', value: successPct ? `${successPct}%` : '–', icon: Target, color: successPct >= 80 ? 'bg-emerald-500' : 'bg-amber-500' },
        ].map(k => <KpiCard key={k.label} {...k} sub="" loading={isLoading} />)}
      </div>

      {/* Success rate gauge */}
      <div className="bg-gradient-to-r from-[color:var(--argus-surface)] to-[color:var(--argus-elevated)] rounded-2xl p-6 flex items-center gap-8">
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Change Success Rate</p>
          <p className="text-[52px] font-extrabold font-mono leading-none text-ink">{successPct}%</p>
          <p className={clsx('text-sm mt-2', successPct >= 80 ? 'text-emerald-400' : 'text-amber-400')}>
            {successPct >= 80 ? '✓ Above target' : '⚠ Below 80% target'}
          </p>
        </div>
        <div className="h-16 w-px bg-white/10" />
        <div className="flex gap-8 text-slate-400 text-sm">
          {[
            ['Total Completed', successRate.total_completed],
            ['Successful', successRate.successful],
            ['Failed/Cancelled', (successRate.total_completed || 0) - (successRate.successful || 0)],
          ].map(([l, v]) => (
            <div key={l as string}>
              <p className="text-2xl font-bold text-ink font-mono">{fmt(v as number)}</p>
              <p className="text-[11px]">{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* By Type */}
        <ChartCard title="Changes by Type" loading={isLoading}>
          {byType.length > 0 ? (
            <>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={30} outerRadius={55} paddingAngle={3}>
                      {byType.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip {...TT} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-1">
                {byType.map((t: any) => (
                  <div key={t.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] text-stone-600">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} />{t.name}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-stone-700">{t.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="h-40"><EmptyChart /></div>}
        </ChartCard>

        {/* By State */}
        <ChartCard title="Changes by State" loading={isLoading}>
          <div className="space-y-2.5 mt-1">
            {byState.length > 0 ? byState.map((s: any) => {
              const max = Math.max(...byState.map((x: any) => x.count), 1);
              return (
                <div key={s.state} className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-500 w-24 shrink-0 truncate">{s.state}</span>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: s.color }} />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-stone-700 w-5 text-right">{s.count}</span>
                </div>
              );
            }) : <EmptyChart message="No state data" />}
          </div>
        </ChartCard>

        {/* By Risk */}
        <ChartCard title="Changes by Risk Level" loading={isLoading}>
          <div className="space-y-4 mt-3">
            {byRisk.length > 0 ? byRisk.map((r: any) => (
              <div key={r.risk} className="flex items-center gap-3">
                <span className="text-[11px] font-bold w-16" style={{ color: r.color }}>{r.risk}</span>
                <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(r.count / Math.max(...byRisk.map((x: any) => x.count), 1)) * 100}%`, background: r.color }} />
                </div>
                <span className="font-mono text-[12px] font-bold text-stone-700">{r.count}</span>
              </div>
            )) : <EmptyChart message="No risk data" />}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

const SECTIONS: { id: Section; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'sla', label: 'SLA', icon: Shield },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'changes', label: 'Changes', icon: GitMerge },
];

export default function ReportsDashboard() {
  const [section, setSection] = useState<Section>('overview');
  const [period, setPeriod] = useState<Period>('30d');

  const organization = useAuthStore((s) => s.organization);
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'ADMIN' && !user?.organizationId;

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => { const { data } = await api.get('/organizations?limit=50'); return data; },
    staleTime: 120000, enabled: isSuperAdmin,
  });
  const orgs = orgsData?.data || [];
  const selectedOrg = selectedOrgId ? orgs.find((o: any) => o.id === selectedOrgId) : null;
  const heroOrgName = selectedOrg?.name || organization?.name || null;
  const heroEnv: string = selectedOrg?.environment || organization?.environment || 'DEV';

  const envBadge = {
    PROD: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    DR:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
    UAT:  'bg-sky-500/20 text-sky-400 border-sky-500/30',
    DEV:  'bg-violet-500/20 text-violet-400 border-violet-500/30',
  }[heroEnv] || 'bg-violet-500/20 text-violet-400 border-violet-500/30';

  function handleExport() {
    const prev = document.title;
    document.title = `WeCrew Analytics — ${heroOrgName || 'All Orgs'} — ${period} — ${new Date().toLocaleDateString('en-IN')}`;
    window.print();
    document.title = prev;
  }

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO ── */}
      <div className="relative rounded-2xl overflow-hidden bg-obsidian text-ink border border-[color:var(--argus-border)] mb-5">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-[color:var(--argus-signal-dim)]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/6 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-[color:var(--argus-elevated)] flex items-center justify-center">
                  <BarChart3 size={16} className="text-signal" />
                </div>
                <h1 className="font-display text-2xl font-bold text-ink tracking-tight">
                  {heroOrgName ? `${heroOrgName} — Analytics` : 'Analytics & Reports'}
                </h1>
                <span className={clsx('px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase border', envBadge)}>
                  {heroEnv}
                </span>
              </div>
              <p className="text-slate-400 text-sm ml-[42px]">
                Operational intelligence · Incidents · SLA · Teams · Changes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[color:var(--argus-elevated)] rounded-lg border border-[color:var(--argus-border)] p-0.5">
                {(['7d', '30d', '90d'] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={clsx('px-3 py-1 rounded-md text-xs font-semibold transition-all',
                      period === p ? 'bg-[color:var(--argus-signal-dim)]/30 text-signal' : 'text-slate-400 hover:text-ink')}>
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={handleExport}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[color:var(--argus-signal)] to-[color:var(--argus-signal-bright)] text-white rounded-xl text-xs font-bold shadow-lg hover:shadow-indigo-500/25 transition-all hover:scale-[1.02]">
                <Download size={13} /> Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-coral opacity-60 to-transparent -mt-5 mb-5" />

      {/* ── LAYOUT: sidebar + content ── */}
      <div className="flex gap-5">
        {/* Left nav */}
        <aside className="w-[168px] shrink-0">
          <nav className="bg-white rounded-2xl border border-stone-200 overflow-hidden sticky top-4">
            <div className="px-3 py-2.5 border-b border-stone-100">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Sections</p>
            </div>
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setSection(id)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-semibold transition-all group',
                  section === id
                    ? 'bg-[color:var(--argus-signal-dim)] text-[color:var(--argus-signal)] border-r-2 border-indigo-500'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                )}>
                <Icon size={13} className={section === id ? 'text-[color:var(--argus-signal)]' : 'text-stone-400 group-hover:text-stone-600'} />
                {label}
                {section === id && <ChevronRight size={10} className="ml-auto text-signal" />}
              </button>
            ))}
            <div className="px-3 py-3 border-t border-stone-100">
              <p className="text-[9px] text-stone-300 text-center">WeCrew Analytics v2</p>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {section === 'overview'  && <OverviewSection  period={period} />}
          {section === 'incidents' && <IncidentsSection period={period} />}
          {section === 'sla'       && <SLASection       period={period} />}
          {section === 'teams'     && <TeamsSection     period={period} />}
          {section === 'changes'   && <ChangesSection   period={period} />}
        </main>
      </div>
    </div>
  );
}
