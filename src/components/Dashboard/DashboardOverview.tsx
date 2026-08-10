import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import {
  AlertTriangle, Zap, CheckCircle2,
  Server, Database, Shield, Globe, HardDrive, Container, Cpu, Network,
  ArrowRight, Users, Calendar, Activity, Phone,
  RefreshCw, ChevronRight, GitMerge, Tag,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useDashboard, useDashboardTrends, useSLACompliance } from '../../hooks/useDashboard';
import { useIncidents } from '../../hooks/useIncidents';
import { useAlerts } from '../../hooks/useAlerts';
import { useAssets } from '../../hooks/useAssets';
import { useChanges } from '../../hooks/useChanges';
import { useTeams } from '../../hooks/useTeams';
import { useOnCallOverview } from '../../hooks/useOnCall';
import { useAuthStore } from '../../stores/authStore';

/* ===================================================================
   HELPERS
   =================================================================== */
function mapPriority(priority: string | number | undefined): string {
  if (!priority) return 'P4';
  const p = String(priority).toUpperCase();
  if (p.startsWith('P')) return p;
  const n = Number(priority);
  if (n >= 1 && n <= 4) return `P${n}`;
  return 'P4';
}

function mapStatus(status: string | undefined): { key: string; label: string } {
  if (!status) return { key: 'open', label: 'Open' };
  const s = status.toLowerCase().replace(/[_-]/g, '');
  if (s === 'inprogress' || s === 'investigating' || s === 'working') return { key: 'progress', label: 'In Progress' };
  if (s === 'open' || s === 'new' || s === 'triggered') return { key: 'open', label: 'Open' };
  if (s === 'pending' || s === 'waiting' || s === 'onhold') return { key: 'pending', label: 'Pending' };
  if (s === 'resolved' || s === 'closed') return { key: 'resolved', label: 'Resolved' };
  return { key: 'open', label: status };
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2);
}

function timeSince(date: string | undefined): string {
  if (!date) return '--';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatDate(date: string | undefined): string {
  if (!date) return '--';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const AVATAR_TONES = [
  '#2563eb', '#059669', '#d97706', '#dc2626', '#0e7490', '#52525b',
];

/* ===================================================================
   SUBCOMPONENTS
   =================================================================== */
function LiveDot({ color = 'emerald' }: { color?: 'emerald' | 'crimson' | 'amber' }) {
  const bg = color === 'crimson' ? 'bg-crimson' : color === 'amber' ? 'bg-amber' : 'bg-emerald';
  return (
    <span className="relative flex h-[7px] w-[7px] flex-shrink-0">
      <span className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', bg)} />
      <span className={clsx('relative inline-flex rounded-full h-[7px] w-[7px]', bg)} />
    </span>
  );
}

function Panel({ title, titleExtra, actions, children, className, noPad = false }: {
  title: React.ReactNode; titleExtra?: React.ReactNode; actions?: React.ReactNode;
  children: React.ReactNode; className?: string; noPad?: boolean;
}) {
  return (
    <div className={clsx('cx-panel', className)}>
      <div className="cx-panel__head">
        <span className="cx-panel__title">{title}</span>
        <div className="cx-panel__actions">
          {titleExtra}
          {actions}
        </div>
      </div>
      <div className={noPad ? '' : 'cx-panel__body'}>{children}</div>
    </div>
  );
}

function PanelBtn({ children, onClick, variant = 'default' }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'default' | 'primary';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'cx-btn !min-h-[28px] !text-[11px] !px-2.5',
        variant === 'primary' ? 'cx-btn--primary' : 'cx-btn--ghost'
      )}
    >
      {children}
    </button>
  );
}

function SLARing({ value, label }: { value: number; label: string }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 95 ? '#059669' : value >= 90 ? '#D97706' : '#DC2626';
  return (
    <div className="relative w-[96px] h-[96px] mx-auto">
      <svg className="-rotate-90" width="96" height="96" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#F5F5F4" strokeWidth="8" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-[1.5s] ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold font-mono" style={{ color }}>{value}%</span>
        <span className="text-[9px] font-semibold text-stone-400 text-center leading-tight">{label}</span>
      </div>
    </div>
  );
}

function AlertSeverityRing({ count, total, label, color, stroke }: {
  count: number; total: number; label: string; color: string; stroke: string;
}) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? count / total : 0;
  const offset = circ - pct * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[68px] h-[68px]">
        <svg className="-rotate-90" width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={r} fill="none" stroke="#E7E5E4" strokeWidth="6" />
          <circle cx="34" cy="34" r={r} fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[15px] font-extrabold font-mono" style={{ color: stroke }}>{count}</span>
        </div>
      </div>
      <span className={clsx('text-[10px] font-bold uppercase tracking-wide', color)}>{label}</span>
    </div>
  );
}

function AvatarCircle({ name, idx, size = 'md' }: { name: string; idx: number; size?: 'sm' | 'md' }) {
  const tone = AVATAR_TONES[idx % AVATAR_TONES.length];
  const dim = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[10px]';
  return (
    <span
      className={clsx('rounded-full flex items-center justify-center font-bold text-white flex-shrink-0', dim)}
      style={{ background: tone }}
    >
      {getInitials(name)}
    </span>
  );
}

function SkeletonRow({ cols = 7 }: { cols?: number }) {
  return (
    <tr className="border-b border-stone-100 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3.5 py-2.5"><div className="h-4 bg-stone-100 rounded" style={{ width: `${40 + (i * 17) % 60}%` }} /></td>
      ))}
    </tr>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-7 text-stone-400">
      {icon && <span className="opacity-40">{icon}</span>}
      <p className="text-sm">{message}</p>
    </div>
  );
}

/* ===================================================================
   MAIN DASHBOARD
   =================================================================== */
export default function DashboardOverview() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  const organization = useAuthStore((s) => s.organization);
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'ADMIN' && !user?.organizationId;

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => { const { data } = await api.get('/organizations?limit=50'); return data; },
    staleTime: 120000,
    enabled: isSuperAdmin,
  });
  const orgs: { id: string; name: string; environment: string }[] = orgsData?.data || [];
  const selectedOrg = selectedOrgId ? orgs.find((o) => o.id === selectedOrgId) : null;
  const heroOrgName = selectedOrg?.name || organization?.name || null;
  const heroEnv = selectedOrg?.environment || organization?.environment || 'DEV';

  /* ── Core data ── */
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDash } = useDashboard();
  const { data: incidentData, isLoading: incidentsLoading } = useIncidents({ limit: 8 });
  const { data: alertsData } = useAlerts({ limit: 50, status: 'FIRING' });
  const { data: assetsData } = useAssets({ limit: 100 });
  const { data: trendData } = useDashboardTrends(7);
  const { data: slaData } = useSLACompliance();
  const { data: changesData } = useChanges({ limit: 5, status: 'PLANNED' });
  const { data: teamsData } = useTeams({ limit: 10 });
  const { data: onCallData } = useOnCallOverview();

  /* ── KPI ── */
  const stats = dashboardData?.data;
  const kpi = stats?.kpi;
  const activeIncidents = kpi?.openIncidents ?? 0;
  const p1Critical = kpi?.p1Active ?? 0;
  const slaBreached = kpi?.slaBreached ?? 0;
  const openChanges = kpi?.activeChanges ?? 0;
  const firingAlerts = kpi?.firingAlerts ?? 0;
  const slaCompliance = kpi?.slaCompliance ?? 0;

  /* ── Incidents ── */
  const apiIncidents = incidentData?.data;
  const incidentRows = Array.isArray(apiIncidents) && apiIncidents.length > 0
    ? apiIncidents.slice(0, 8).map((inc: any, idx: number) => {
        const statusInfo = mapStatus(inc.state || inc.status);
        const p = mapPriority(inc.priority);
        const assigneeName = inc.assignedTo?.firstName
          ? `${inc.assignedTo.firstName} ${inc.assignedTo.lastName || ''}`.trim()
          : (inc.assignee?.name || inc.assigneeName || '');
        return {
          id: inc.number || inc.incidentNumber || `INC-${inc.id}`,
          rawId: inc.id,
          p,
          desc: inc.shortDescription || inc.title || inc.subject || inc.description || 'No description',
          status: statusInfo.key,
          statusLabel: statusInfo.label,
          assignee: getInitials(assigneeName),
          assigneeName: assigneeName || 'Unassigned',
          avatarIdx: idx,
          slaPercent: inc.slaPercent ?? 50,
          slaColor: (inc.slaPercent ?? 50) > 75 ? 'crimson' : (inc.slaPercent ?? 50) > 40 ? 'amber' : 'emerald',
          slaTime: inc.slaRemaining || '--',
          age: timeSince(inc.createdAt),
        };
      })
    : [];

  /* ── Alerts ── */
  const liveAlerts: any[] = alertsData?.data ?? [];
  const critCount = liveAlerts.filter(a => a.severity === 'CRITICAL').length;
  const warnCount = liveAlerts.filter(a => a.severity === 'WARNING').length;
  const infoCount = liveAlerts.filter(a => a.severity !== 'CRITICAL' && a.severity !== 'WARNING').length;
  const alertTotal = liveAlerts.length;

  /* ── Assets ── */
  const allAssets: any[] = assetsData?.data ?? [];
  const totalAssets = assetsData?.pagination?.total ?? allAssets.length;
  const assetsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    allAssets.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allAssets]);

  const serviceHealth = useMemo(() => {
    if (allAssets.length === 0) return [];
    const typeMap: Record<string, { total: number; live: number }> = {};
    allAssets.forEach(a => {
      if (!typeMap[a.type]) typeMap[a.type] = { total: 0, live: 0 };
      typeMap[a.type].total++;
      if (a.status === 'LIVE') typeMap[a.type].live++;
    });
    return Object.entries(typeMap).map(([type, { total, live }]) => ({
      type, total, live, pct: total > 0 ? Math.round((live / total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [allAssets]);

  /* ── Trend ── */
  const trendChartData = useMemo(() => {
    const raw = trendData?.data;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return null;
  }, [trendData]);
  const trendTotal = trendChartData?.reduce((s: number, d: any) => s + (d.count || d.total || 0), 0) ?? 0;

  /* ── Changes ── */
  const upcomingChanges: any[] = changesData?.data ?? [];

  /* ── Teams ── */
  const teams: any[] = teamsData?.data ?? [];

  /* ── On-Call ── */
  const onCallTeams: any[] = onCallData?.data ?? [];

  /* ── Infra metrics ── */
  const { data: infraData } = useQuery({
    queryKey: ['dashboard', 'infra-metrics'],
    queryFn: async () => { const { data } = await api.get('/ai/infrastructure-metrics'); return data; },
    staleTime: 30000, retry: 1,
  });
  const infraMetrics = useMemo(() => {
    const d = infraData?.data;
    if (!d || d.noDataForOrg) return [];
    const items: { label: string; value: string | number; suffix: string; unit: string; color: string }[] = [];
    const cpuPct = d.cpu?.avgUsagePct ?? d.cpu?.current;
    if (cpuPct != null) items.push({ label: 'CPU', value: parseFloat(String(cpuPct)).toFixed(1), suffix: '%', unit: `${d.cpu?.totalCores || '--'} cores`, color: cpuPct > 80 ? '#DC2626' : cpuPct > 60 ? '#D97706' : '#059669' });
    const memPct = d.memory?.usedPct ?? d.memory?.current;
    if (memPct != null) items.push({ label: 'Memory', value: parseFloat(String(memPct)).toFixed(1), suffix: '%', unit: `${d.memory?.usedGB || '--'}/${d.memory?.totalGB || '--'} GB`, color: memPct > 80 ? '#DC2626' : memPct > 60 ? '#D97706' : '#059669' });
    const diskPct = d.disk?.totalUsedPct ?? d.disk?.current;
    if (diskPct != null) items.push({ label: 'Disk', value: parseFloat(String(diskPct)).toFixed(1), suffix: '%', unit: 'usage', color: diskPct > 85 ? '#DC2626' : diskPct > 70 ? '#D97706' : '#059669' });
    if (d.network?.totalRx) items.push({ label: 'Net RX', value: d.network.totalRx, suffix: '', unit: '/s', color: '#2563eb' });
    if (d.network?.totalTx) items.push({ label: 'Net TX', value: d.network.totalTx, suffix: '', unit: '/s', color: '#2563eb' });
    const pods = d.virtualization?.podSummary;
    if (pods?.running != null) items.push({ label: 'Pods', value: pods.running, suffix: '', unit: `${pods.total || pods.running} total`, color: '#059669' });
    const alertCount = d.alerts?.length ?? 0;
    if (d.alerts) items.push({ label: 'Alerts', value: alertCount, suffix: '', unit: 'firing', color: alertCount > 10 ? '#DC2626' : alertCount > 0 ? '#D97706' : '#059669' });
    const nodes = d.virtualization?.nodes?.length ?? d.cpu?.perNode?.length ?? 0;
    if (nodes > 0) items.push({ label: 'Hosts', value: nodes, suffix: '', unit: 'monitored', color: '#2563eb' });
    return items;
  }, [infraData]);

  /* ── Activity feed (derived from incidents + alerts) ── */
  const activityFeed = useMemo(() => {
    const items: { type: 'incident' | 'alert' | 'change'; title: string; sub: string; time: string; severity?: string }[] = [];
    liveAlerts.slice(0, 4).forEach(a => {
      items.push({ type: 'alert', title: a.name || a.alertName || 'Alert fired', sub: a.severity || 'INFO', time: timeSince(a.firedAt), severity: a.severity });
    });
    incidentRows.slice(0, 4).forEach(i => {
      items.push({ type: 'incident', title: i.desc, sub: `${i.p} • ${i.statusLabel}`, time: i.age });
    });
    upcomingChanges.slice(0, 2).forEach((c: any) => {
      items.push({ type: 'change', title: c.title || c.shortDescription || 'Scheduled change', sub: c.type || 'STANDARD', time: formatDate(c.plannedStartTime || c.scheduledAt) });
    });
    return items.sort(() => Math.random() - 0.5).slice(0, 8);
  }, [liveAlerts, incidentRows, upcomingChanges]);

  /* ── Clock ── */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── System health banner ── */
  const systemStatus = p1Critical > 0
    ? { label: 'Major Incident Active', color: '#DC2626', dot: 'crimson' as const, bg: 'bg-crimson/5 border-crimson/20' }
    : firingAlerts > 10
    ? { label: 'Elevated Alerts', color: '#D97706', dot: 'amber' as const, bg: 'bg-amber/5 border-amber/20' }
    : { label: 'All Systems Operational', color: '#059669', dot: 'emerald' as const, bg: 'bg-emerald/5 border-emerald/20' };

  return (
    <div className="cx-page">

      {/* ═══════════════════════════════════════════════
          COMMAND CENTRE HERO — ink panel, serif display
          ═══════════════════════════════════════════════ */}
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="cx-eyebrow">Unified service operations</span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded border border-white/20 text-white/70">
                {heroEnv}
              </span>
            </div>

            <h1 className="cx-hero__title">
              {heroOrgName || 'Service workspace'}
            </h1>

            <p className="cx-hero__deck">
              Incidents, changes, problems, alerts and assets for the estate in one plane —
              then dig into timeline and evidence when something breaks.
            </p>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <LiveDot color={systemStatus.dot} />
              <span className="text-[12px] font-medium text-white/90">{systemStatus.label}</span>
              <span className="text-white/30">·</span>
              <span className="font-mono text-[11px] text-white/60">
                {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
              <span className="text-white/30">·</span>
              <span className="font-mono text-[11px] text-white/50">
                {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <button type="button" onClick={() => navigate('/incidents/create')} className="cx-hero__btn">
                <AlertTriangle size={13} /> New incident
              </button>
              <button type="button" onClick={() => navigate('/alerts')} className="cx-hero__btn cx-hero__btn--ghost">
                <Zap size={13} />
                Alerts
                {firingAlerts > 0 && (
                  <span className="bg-coral text-white rounded-full px-1.5 text-[9px] font-bold leading-none py-0.5">{firingAlerts}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => refetchDash()}
                className="cx-hero__btn cx-hero__btn--ghost !px-2"
                aria-label="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="cx-hero__kpis">
            <div className="cx-hero__kpi">
              <div className="cx-hero__kpi-label">Health</div>
              <div className="cx-hero__kpi-value">{dashboardLoading ? '—' : slaCompliance || 0}</div>
              <div className="cx-hero__kpi-sub">sla index</div>
            </div>
            <div className={clsx('cx-hero__kpi', p1Critical > 0 && 'cx-hero__kpi--danger')}>
              <div className="cx-hero__kpi-label">P1 open</div>
              <div className="cx-hero__kpi-value">{dashboardLoading ? '—' : p1Critical}</div>
              <div className="cx-hero__kpi-sub">critical</div>
            </div>
            <div className="cx-hero__kpi">
              <div className="cx-hero__kpi-label">Assets</div>
              <div className="cx-hero__kpi-value">{dashboardLoading ? '—' : totalAssets}</div>
              <div className="cx-hero__kpi-sub">in cmdb</div>
            </div>
          </div>
        </div>
      </div>

      {/* Signal strip — hairline divided stat columns */}
      <div className="cx-signals">
        {[
          { label: 'Incidents',  value: activeIncidents, sub: 'active',  tone: activeIncidents > 0 ? '' : '' },
          { label: 'P1',         value: p1Critical,      sub: 'critical', tone: p1Critical > 0 ? 'danger' : '' },
          { label: 'Alerts',     value: firingAlerts,    sub: 'firing',   tone: firingAlerts > 5 ? 'danger' : firingAlerts > 0 ? 'warn' : '' },
          { label: 'SLA risks',  value: slaBreached,     sub: 'breached', tone: slaBreached > 0 ? 'warn' : '' },
          { label: 'Changes',    value: openChanges,     sub: 'open',     tone: '' },
          { label: 'Assets',     value: totalAssets,     sub: 'cmdb',     tone: '' },
          { label: 'SLA',        value: `${slaCompliance || 0}%`, sub: 'compliance', tone: '' },
          { label: 'On-call',    value: onCallTeams.length,       sub: 'teams',      tone: '' },
        ].map((s) => (
          <div key={s.label} className="cx-signals__cell">
            <div className="cx-signals__label">{s.label}</div>
            <div className={clsx('cx-signals__value', s.tone && `cx-signals__value--${s.tone}`)}>
              {dashboardLoading ? '—' : s.value}
            </div>
            <div className="cx-signals__sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════
          ON-CALL ROSTER STRIP
          ═══════════════════════════════════════════════ */}
      {onCallTeams.length > 0 && (
        <div className="cx-panel overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-2.5 border-b border-[color:var(--argus-border)]">
            <span className="text-[13px] font-bold text-ink flex items-center gap-2">
              <Phone size={13} className="text-signal" /> On-Call Now
            </span>
            <button onClick={() => navigate('/oncall')} className="text-[11px] text-signal font-semibold hover:underline flex items-center gap-1">
              Full schedule <ChevronRight size={11} />
            </button>
          </div>
          <div className="flex gap-3 px-[18px] py-3 overflow-x-auto">
            {onCallTeams.map((team: any, i: number) => {
              const primary = team.currentOnCall?.primary;
              const name = primary?.user?.firstName
                ? `${primary.user.firstName} ${primary.user.lastName || ''}`.trim()
                : (team.currentOnCall?.name || 'Unassigned');
              return (
                <div key={team.id || i} className="flex items-center gap-2.5 flex-shrink-0 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg hover:border-[color:var(--argus-signal)]/25 transition-colors cursor-pointer" onClick={() => navigate('/oncall')}>
                  <AvatarCircle name={name} idx={i} size="sm" />
                  <div>
                    <p className="text-[11px] font-semibold text-stone-800">{name}</p>
                    <p className="text-[10px] text-stone-400">{team.name || `Team ${i + 1}`}</p>
                  </div>
                  <span className="ml-1 flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ROW A: SERVICE HEALTH + ALERT SEVERITY RINGS
          ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <Panel
          title={<><LiveDot /> Service Health</>}
          actions={<><PanelBtn onClick={() => navigate('/network')}>Topology</PanelBtn><PanelBtn onClick={() => navigate('/assets')}>All Assets</PanelBtn></>}
        >
          {serviceHealth.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {serviceHealth.map(s => {
                const icons: Record<string, React.ReactNode> = {
                  SERVER: <Server size={15} />, DATABASE: <Database size={15} />,
                  KUBERNETES_CLUSTER: <Container size={15} />, APPLICATION: <Globe size={15} />,
                  NETWORK: <Network size={15} />, STORAGE: <HardDrive size={15} />,
                  VM: <Cpu size={15} />, LOAD_BALANCER: <Shield size={15} />,
                  CONTAINER: <Container size={15} />,
                };
                const pctColor = s.pct >= 95 ? 'text-emerald' : s.pct >= 80 ? 'text-amber' : 'text-crimson';
                const barColor = s.pct >= 95 ? 'bg-emerald' : s.pct >= 80 ? 'bg-amber' : 'bg-crimson';
                return (
                  <div key={s.type} className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-stone-50 border border-stone-100 hover:border-[color:var(--argus-signal)]/25 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-400">{icons[s.type] || <Server size={15} />}</span>
                      <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wide truncate">{s.type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={clsx('text-lg font-extrabold font-mono', pctColor)}>{s.pct}%</span>
                      <span className="text-[10px] text-stone-400">{s.live}/{s.total}</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div className={clsx('h-full rounded-full transition-all duration-1000', barColor)} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No asset data — select an organization" icon={<Server size={28} />} />
          )}
        </Panel>

        {/* Alert Severity Breakdown */}
        <Panel
          title={<><LiveDot color={critCount > 0 ? 'crimson' : 'emerald'} /> Alert Severity</>}
          titleExtra={<span className="text-[10px] text-stone-400 font-mono">{alertTotal} firing</span>}
          actions={<PanelBtn onClick={() => navigate('/alerts')}>View All</PanelBtn>}
        >
          {alertTotal > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-around py-2">
                <AlertSeverityRing count={critCount} total={alertTotal} label="Critical" color="text-crimson" stroke="#DC2626" />
                <AlertSeverityRing count={warnCount} total={alertTotal} label="Warning" color="text-amber" stroke="#D97706" />
                <AlertSeverityRing count={infoCount} total={alertTotal} label="Info" color="text-signal" stroke="#2563eb" />
              </div>
              <div className="space-y-2 border-t border-stone-100 pt-3">
                {liveAlerts.slice(0, 3).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 rounded-lg px-1 py-0.5 -mx-1 transition-colors" onClick={() => navigate('/alerts')}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0',
                      a.severity === 'CRITICAL' ? 'bg-crimson animate-pulse' : a.severity === 'WARNING' ? 'bg-amber' : 'bg-signal'
                    )} />
                    <p className="text-[11px] text-stone-700 truncate flex-1">{a.name}</p>
                    <span className="text-[10px] text-stone-400 font-mono flex-shrink-0">{timeSince(a.firedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-7">
              <CheckCircle2 size={28} className="text-emerald" />
              <p className="text-sm text-stone-400 font-medium">All clear — no alerts</p>
            </div>
          )}
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════
          ROW B: TREND + TOPOLOGY + CMDB
          ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Incident Trend (7 Days)" titleExtra={<span className="text-[10px] text-stone-400 font-mono">{trendTotal || activeIncidents} total</span>}>
          {trendChartData && trendChartData.length > 0 ? (
            <div className="h-[150px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#A8A29E' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => { try { return new Date(String(v)).toLocaleDateString('en-IN', { weekday: 'short' }); } catch { return String(v); } }} />
                  <YAxis tick={{ fontSize: 10, fill: '#A8A29E' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E7E5E4', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                    labelFormatter={(v) => { try { return new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch { return String(v); } }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {trendChartData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={idx === trendChartData.length - 1 ? '#2563eb' : '#bfdbfe'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex items-end gap-1 h-[80px]">
                {[3, 5, 2, 7, 4, 6, activeIncidents || 1].map((v, i) => (
                  <div key={i} className={clsx('w-6 rounded-t-sm transition-all duration-700', i === 6 ? 'bg-signal' : 'bg-[color:var(--argus-signal-dim)]')}
                    style={{ height: `${Math.max(8, (v / 8) * 80)}px` }} />
                ))}
              </div>
              <span className="text-[10px] text-stone-400">Active: {activeIncidents} incidents</span>
            </div>
          )}
        </Panel>

        <Panel title="Service Topology" actions={<PanelBtn onClick={() => navigate('/network')}>Full Map</PanelBtn>}>
          {allAssets.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {assetsByType.slice(0, 6).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-stone-700 w-[90px] truncate flex-shrink-0">{type.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-signal transition-all duration-1000"
                      style={{ width: `${Math.min(100, (count / (assetsByType[0]?.[1] || 1)) * 100)}%` }} />
                  </div>
                  <span className="text-[11px] font-bold font-mono text-stone-700 w-6 text-right">{count}</span>
                </div>
              ))}
              <button onClick={() => navigate('/network')} className="text-[11px] text-signal font-semibold hover:underline mt-1 self-end flex items-center gap-1">
                View full topology <ArrowRight size={11} />
              </button>
            </div>
          ) : (
            <EmptyState message="No topology data" icon={<Network size={24} />} />
          )}
        </Panel>

        <Panel title="CMDB Overview" titleExtra={<span className="text-[10px] text-stone-400 font-mono">{totalAssets.toLocaleString()} CIs</span>}>
          {allAssets.length > 0 ? (
            <div className="space-y-2">
              {assetsByType.map(([type, count]) => {
                const pct = totalAssets > 0 ? Math.round((count / totalAssets) * 100) : 0;
                const colors: Record<string, string> = {
                  SERVER: '#2563eb', DATABASE: '#0e7490', KUBERNETES_CLUSTER: '#0ea5e9',
                  APPLICATION: '#059669', NETWORK: '#d97706', STORAGE: '#ea580c',
                  VM: '#52525b', LOAD_BALANCER: '#0f766e', CONTAINER: '#0891b2',
                };
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-[80px] text-right text-[10px] font-semibold text-stone-500 truncate flex-shrink-0">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-2 bg-stone-100 rounded overflow-hidden">
                      <div className="h-full rounded transition-all duration-1000"
                        style={{ width: `${pct}%`, backgroundColor: colors[type] || '#78716C' }} />
                    </div>
                    <span className="w-7 text-[10px] font-bold font-mono text-stone-700 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No CMDB data" icon={<Database size={24} />} />
          )}
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════
          ROW C: INCIDENTS TABLE + ACTIVITY FEED
          ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-4">
        <Panel
          title="🔥 Active Incidents"
          noPad
          actions={
            <>
              <PanelBtn onClick={() => navigate('/incidents/create')}>+ New</PanelBtn>
              <PanelBtn onClick={() => navigate('/incidents')}>View All</PanelBtn>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60">
                  {['ID', 'Priority', 'Subject', 'Status', 'Assignee', 'SLA', 'Age'].map(h => (
                    <th key={h} className="text-left px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.07em] text-stone-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidentsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : incidentRows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-stone-400">No active incidents</td></tr>
                ) : (
                  incidentRows.map((inc) => (
                    <tr key={inc.id} onClick={() => navigate(`/incidents/${inc.rawId}`)}
                      className="border-b border-stone-100 hover:bg-[color:var(--argus-signal-dim)]/40 cursor-pointer transition-colors">
                      <td className="px-3.5 py-2.5 font-mono font-semibold text-signal text-[11px]">{inc.id}</td>
                      <td className="px-3.5 py-2.5">
                        <span className={clsx('badge',
                          inc.p === 'P1' && 'priority-p1', inc.p === 'P2' && 'priority-p2',
                          inc.p === 'P3' && 'priority-p3', inc.p === 'P4' && 'priority-p4')}>
                          ● {inc.p}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-stone-800 font-medium max-w-[260px] truncate">{inc.desc}</td>
                      <td className="px-3.5 py-2.5">
                        <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold',
                          inc.status === 'progress' && 'bg-[color:var(--argus-signal-dim)] text-signal',
                          inc.status === 'open' && 'bg-crimson/10 text-crimson',
                          inc.status === 'pending' && 'bg-amber/10 text-amber',
                          inc.status === 'resolved' && 'bg-emerald/10 text-emerald',
                        )}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full',
                            inc.status === 'progress' ? 'bg-signal animate-pulse' :
                            inc.status === 'open' ? 'bg-crimson' : inc.status === 'pending' ? 'bg-amber' : 'bg-emerald'
                          )} />
                          {inc.statusLabel}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <AvatarCircle name={inc.assigneeName} idx={inc.avatarIdx} size="sm" />
                          <span className="text-stone-500 text-[11px] truncate max-w-[80px]">{inc.assigneeName}</span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                            <div className={clsx('h-full rounded-full transition-all duration-1000',
                              inc.slaColor === 'emerald' ? 'bg-emerald' : inc.slaColor === 'amber' ? 'bg-amber' : 'bg-crimson'
                            )} style={{ width: `${inc.slaPercent}%` }} />
                          </div>
                          <span className={clsx('text-[10px] font-semibold whitespace-nowrap',
                            inc.slaColor === 'emerald' ? 'text-emerald' : inc.slaColor === 'amber' ? 'text-amber' : 'text-crimson'
                          )}>{inc.slaTime}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-stone-400">{inc.age}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Activity Feed */}
        <Panel title={<><Activity size={13} className="text-signal" /> Activity Feed</>}>
          {activityFeed.length > 0 ? (
            <div className="space-y-3">
              {activityFeed.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={clsx('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                    item.type === 'alert' ? 'bg-crimson/10' : item.type === 'change' ? 'bg-emerald/10' : 'bg-[color:var(--argus-signal-dim)]'
                  )}>
                    {item.type === 'alert' ? <Zap size={11} className="text-crimson" /> :
                     item.type === 'change' ? <GitMerge size={11} className="text-emerald" /> :
                     <AlertTriangle size={11} className="text-signal" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-stone-800 leading-tight truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={clsx('text-[9px] font-bold uppercase px-1 py-0.5 rounded',
                        item.type === 'alert' ? 'bg-crimson/10 text-crimson' :
                        item.type === 'change' ? 'bg-emerald/10 text-emerald' : 'bg-[color:var(--argus-signal-dim)] text-signal'
                      )}>{item.sub}</span>
                      <span className="text-[10px] text-stone-400 font-mono">{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No recent activity" icon={<Activity size={24} />} />
          )}
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════
          ROW D: TEAM PERFORMANCE + UPCOMING CHANGES + SLA
          ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Team Performance — real data from useTeams */}
        <Panel title={<><Users size={13} className="text-signal" /> Team Performance</>}
          titleExtra={<span className="text-[10px] text-stone-400">This month</span>}
          actions={<PanelBtn onClick={() => navigate('/teams')}>All Teams</PanelBtn>}>
          {teams.length > 0 ? (
            <div className="space-y-2.5">
              {teams.slice(0, 6).map((team: any, i: number) => {
                const memberCount = team._count?.members ?? team.memberCount ?? team.members?.length ?? 0;
                const incidentCount = team._count?.incidents ?? team.incidentCount ?? 0;
                const maxInc = Math.max(...teams.map((t: any) => t._count?.incidents ?? t.incidentCount ?? 1), 1);
                return (
                  <div key={team.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 cursor-pointer transition-colors" onClick={() => navigate(`/teams/${team.id}`)}>
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }}
                    >
                      <span className="text-[10px] font-bold text-white">{getInitials(team.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-stone-800 truncate">{team.name}</span>
                        <span className="text-[10px] font-mono text-stone-500 ml-1 flex-shrink-0">{memberCount}m</span>
                      </div>
                      <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-signal transition-all duration-700"
                          style={{ width: `${Math.min(100, (incidentCount / maxInc) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold font-mono text-stone-700 flex-shrink-0">{incidentCount}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No team data available" icon={<Users size={24} />} />
          )}
        </Panel>

        {/* Upcoming Changes — real data from useChanges */}
        <Panel title={<><Calendar size={13} className="text-emerald" /> Upcoming Changes</>}
          actions={<PanelBtn onClick={() => navigate('/changes')}>Calendar</PanelBtn>}>
          {upcomingChanges.length > 0 ? (
            <div className="space-y-2.5">
              {upcomingChanges.map((c: any, i: number) => {
                const changeType = c.changeType || c.type || 'STANDARD';
                const typeColor: Record<string, string> = {
                  STANDARD: 'bg-[color:var(--argus-signal-dim)] text-signal', EMERGENCY: 'bg-crimson/10 text-crimson', NORMAL: 'bg-stone-100 text-stone-600',
                };
                return (
                  <div key={c.id || i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-stone-50 border border-stone-100 hover:border-emerald/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/changes/${c.id}`)}>
                    <div className="w-7 h-7 rounded-lg bg-emerald/10 flex items-center justify-center flex-shrink-0">
                      <Tag size={12} className="text-emerald" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-stone-800 truncate">{c.title || c.shortDescription || 'Scheduled change'}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={clsx('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', typeColor[changeType] || typeColor.STANDARD)}>
                          {changeType}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">{formatDate(c.plannedStartTime || c.scheduledAt)}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-stone-300 flex-shrink-0 mt-0.5" />
                  </div>
                );
              })}
              <button onClick={() => navigate('/changes')} className="text-[11px] text-signal font-semibold hover:underline w-full text-right flex items-center justify-end gap-1">
                View all changes <ArrowRight size={11} />
              </button>
            </div>
          ) : (
            <EmptyState message="No upcoming changes scheduled" icon={<Calendar size={24} />} />
          )}
        </Panel>

        {/* SLA Compliance */}
        <Panel title="SLA Compliance" titleExtra={<span className="text-[10px] text-stone-400 font-mono">{slaCompliance ? `${slaCompliance}%` : '--'}</span>}>
          {(() => {
            const sla = slaData?.data;
            const overall = sla?.overall ?? slaCompliance ?? 0;
            const byPriority = sla?.byPriority || [];
            return (
              <div className="flex flex-col items-center gap-4">
                <SLARing value={overall} label="Overall SLA" />
                <div className="w-full space-y-2">
                  {byPriority.length > 0 ? byPriority.map((s: any) => {
                    const val = s.value ?? s.compliance ?? 0;
                    return (
                      <div key={s.priority || s.label} className="flex items-center gap-3">
                        <span className="w-8 text-[10px] font-bold text-stone-500 flex-shrink-0">{s.priority || s.label}</span>
                        <div className="flex-1 h-2 bg-stone-100 rounded overflow-hidden">
                          <div className={clsx('h-full rounded transition-all duration-[1.5s]',
                            val >= 95 ? 'bg-emerald' : val >= 85 ? 'bg-amber' : 'bg-crimson'
                          )} style={{ width: `${val}%` }} />
                        </div>
                        <span className="w-10 text-[10px] font-bold font-mono text-stone-700 text-right">{val.toFixed(0)}%</span>
                      </div>
                    );
                  }) : (
                    <p className="text-[11px] text-stone-400 text-center py-1">
                      {overall > 0 ? `Overall: ${overall}%` : 'No SLA data'}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════
          ROW E: INFRASTRUCTURE METRICS STRIP
          ═══════════════════════════════════════════════ */}
      <div className="cx-panel overflow-hidden">
        <div className="flex items-center justify-between px-[18px] py-2.5 border-b border-[color:var(--argus-border)]">
          <span className="text-[13px] font-bold text-ink flex items-center gap-2">
            <LiveDot /> Infrastructure Metrics
          </span>
          <span className="text-[10px] text-stone-400 font-mono">
            {now.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' })} IST · Live
          </span>
        </div>
        {infraMetrics.length > 0 ? (
          <div className="flex gap-0 divide-x divide-stone-100 overflow-x-auto">
            {infraMetrics.map(m => (
              <div key={m.label} className="flex flex-col items-center px-5 py-3 flex-shrink-0">
                <span className="text-[10px] text-stone-400 font-semibold mb-0.5">{m.label}</span>
                <span className="text-[17px] font-extrabold font-mono leading-none" style={{ color: m.color }}>
                  {m.value}{m.suffix}
                </span>
                <span className="text-[10px] text-stone-400 mt-0.5">{m.unit}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-400 py-4 px-[18px] text-center">
            Connect Prometheus to see live infrastructure metrics
          </p>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="text-center py-5 text-stone-400 text-[11px]">
        WeCrew — Intelligent Operations Platform — © 2026 FinSpot Technology Solutions Private Limited &nbsp;·&nbsp; No.55B, First Main, Electronic City Phase – 1, Bengaluru – 560 100 &nbsp;·&nbsp; 9176772077
        <br />
        <span className="font-mono text-[10px]">Kubernetes · React · PostgreSQL · Ollama AI · Prometheus · Grafana</span>
      </div>
    </div>
  );
}
