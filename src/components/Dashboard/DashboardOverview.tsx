import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import {
  AlertTriangle, Zap, CheckCircle2,
  Server, Database, Shield, Globe, HardDrive, Container, Cpu, Network,
  ArrowRight, Users, Calendar, Activity, Phone, ShieldCheck,
  RefreshCw, ChevronRight, Tag, ClipboardCheck, Bell,
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
import { EnterpriseHero, EnterprisePosture } from '../ui/PageChrome';

/* ===================================================================
   DASHBOARD PAYLOAD TYPES
   Shapes returned by /dashboard/stats and /dashboard/sla-compliance.
   =================================================================== */
type GroupCount = number | Record<string, number>;
interface CategoryGroup { category?: string | null; _count?: GroupCount }
interface StateGroup { state?: string | null; _count?: GroupCount }
interface BreakdownRow { label: string; count: number; pct: number }
interface SlaBucket { percentage?: number; total?: number; breached?: number; met?: number }
interface SlaPriorityRow { priority: string; value: number; total: number; breached: number }
interface SlaLegacyRow { priority?: string; label?: string; value?: number; compliance?: number; total?: number; breached?: number }
interface SlaResponse {
  overall?: number;
  byPriority?: SlaLegacyRow[];
  P1?: SlaBucket; P2?: SlaBucket; P3?: SlaBucket; P4?: SlaBucket;
}

const BRAND_BLUE = '#2b4cff';
const BRAND_BLUE_SOFT = '#8fa0ff';

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
  BRAND_BLUE, '#059669', '#d97706', '#dc2626', '#0e7490', '#52525b',
];

const CI_COLORS: Record<string, string> = {
  SERVER: BRAND_BLUE, DATABASE: '#0e7490', KUBERNETES_CLUSTER: '#0ea5e9',
  APPLICATION: '#059669', NETWORK: '#d97706', STORAGE: '#ea580c',
  VM: '#52525b', LOAD_BALANCER: '#0f766e', CONTAINER: '#0891b2',
};

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
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--argus-border)" strokeWidth="8" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-[1.5s] ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold font-mono" style={{ color }}>{value}%</span>
        <span className="text-[9px] font-semibold text-dim text-center leading-tight">{label}</span>
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
          <circle cx="34" cy="34" r={r} fill="none" stroke="var(--argus-border)" strokeWidth="6" />
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
    <tr className="border-b border-steel animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3.5 py-2.5">
          <div className="h-4 rounded bg-obsidian border border-steel" style={{ width: `${40 + (i * 17) % 60}%` }} />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({
  message,
  icon,
  action,
}: {
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-7 text-dim">
      {icon && <span className="opacity-40">{icon}</span>}
      <p className="text-sm text-muted">{message}</p>
      {action}
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
  const resolvedLast7d = kpi?.resolvedLast7d ?? 0;
  const totalIncidents = kpi?.totalIncidents ?? 0;

  /* Hero third KPI: SLA risks when present, else firing alerts (still an outcome). */
  const heroRiskValue = slaBreached > 0 ? slaBreached : firingAlerts;
  const heroRiskSub = slaBreached > 0 ? 'breached' : 'firing alerts';
  const heroRiskDanger = heroRiskValue > 0;

  /* ── ServiceNow-parity breakdowns ── */
  const countOf = (c: GroupCount | undefined): number => {
    if (typeof c === 'number') return c;
    if (c && typeof c === 'object') return Number(Object.values(c)[0]) || 0;
    return 0;
  };

  const categoryRows = useMemo<BreakdownRow[]>(() => {
    const raw: CategoryGroup[] = stats?.charts?.incidentsByCategory ?? [];
    const rows = raw
      .map((r) => ({ label: r.category || 'Uncategorised', count: countOf(r._count) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    const max = rows.length ? rows[0].count : 0;
    return rows.slice(0, 8).map((r) => ({ ...r, pct: max > 0 ? (r.count / max) * 100 : 0 }));
  }, [stats]);

  const stateRows = useMemo(() => {
    const raw: StateGroup[] = stats?.charts?.incidentsByState ?? [];
    const rows = raw
      .map((r) => ({ label: String(r.state || 'UNKNOWN'), count: countOf(r._count) }))
      .filter((r) => r.count > 0);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return { rows: rows.sort((a, b) => b.count - a.count), total };
  }, [stats]);

  const slaByPriority = useMemo<SlaPriorityRow[]>(() => {
    const raw = slaData?.data as SlaResponse | undefined;
    if (!raw) return [];
    if (Array.isArray(raw.byPriority) && raw.byPriority.length) {
      return raw.byPriority.map((s) => ({
        priority: s.priority || s.label || '—',
        value: s.value ?? s.compliance ?? 0,
        total: s.total ?? 0,
        breached: s.breached ?? 0,
      }));
    }
    return (['P1', 'P2', 'P3', 'P4'] as const)
      .filter((k) => raw[k])
      .map((k) => {
        const b = raw[k] as SlaBucket;
        return { priority: k, value: b.percentage ?? 0, total: b.total ?? 0, breached: b.breached ?? 0 };
      });
  }, [slaData]);

  const slaOverall = useMemo<number>(() => {
    const raw = slaData?.data as SlaResponse | undefined;
    if (raw?.overall != null) return raw.overall;
    const scored = slaByPriority.filter((s) => s.total > 0);
    if (!scored.length) return slaCompliance ?? 0;
    const met = scored.reduce((sum, s) => sum + (s.total - s.breached), 0);
    const tot = scored.reduce((sum, s) => sum + s.total, 0);
    return tot > 0 ? Math.round((met / tot) * 100) : (slaCompliance ?? 0);
  }, [slaData, slaByPriority, slaCompliance]);

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
    if (d.network?.totalRx) items.push({ label: 'Net RX', value: d.network.totalRx, suffix: '', unit: '/s', color: BRAND_BLUE });
    if (d.network?.totalTx) items.push({ label: 'Net TX', value: d.network.totalTx, suffix: '', unit: '/s', color: BRAND_BLUE });
    const pods = d.virtualization?.podSummary;
    if (pods?.running != null) items.push({ label: 'Pods', value: pods.running, suffix: '', unit: `${pods.total || pods.running} total`, color: '#059669' });
    const alertCount = d.alerts?.length ?? 0;
    if (d.alerts) items.push({ label: 'Alerts', value: alertCount, suffix: '', unit: 'firing', color: alertCount > 10 ? '#DC2626' : alertCount > 0 ? '#D97706' : '#059669' });
    const nodes = d.virtualization?.nodes?.length ?? d.cpu?.perNode?.length ?? 0;
    if (nodes > 0) items.push({ label: 'Hosts', value: nodes, suffix: '', unit: 'monitored', color: BRAND_BLUE });
    return items;
  }, [infraData]);

  /* ── Clock ── */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── System health banner ── */
  const systemStatus = p1Critical > 0
    ? { label: 'Major Incident Active', color: '#DC2626', dot: 'crimson' as const }
    : firingAlerts > 10
    ? { label: 'Elevated Alerts', color: '#D97706', dot: 'amber' as const }
    : { label: 'All Systems Operational', color: '#059669', dot: 'emerald' as const };

  const signalQueues: {
    label: string;
    value: string | number;
    sub: string;
    tone: string;
    to: string;
  }[] = [
    { label: 'Incidents', value: activeIncidents, sub: 'active', tone: '', to: '/incidents' },
    { label: 'P1', value: p1Critical, sub: 'critical', tone: p1Critical > 0 ? 'danger' : '', to: '/incidents' },
    { label: 'Alerts', value: firingAlerts, sub: 'firing', tone: firingAlerts > 5 ? 'danger' : firingAlerts > 0 ? 'warn' : '', to: '/alerts' },
    { label: 'SLA risks', value: slaBreached, sub: 'breached', tone: slaBreached > 0 ? 'warn' : '', to: '/incidents' },
    { label: 'Changes', value: openChanges, sub: 'open', tone: '', to: '/changes' },
    { label: 'Assets', value: totalAssets, sub: 'cmdb', tone: '', to: '/assets' },
    { label: 'SLA', value: `${slaCompliance || 0}%`, sub: 'compliance', tone: '', to: '/sla' },
    { label: 'On-call', value: onCallTeams.length, sub: 'teams', tone: '', to: '/oncall' },
  ];

  const openQueue = incidentRows.filter((inc) => inc.status !== 'resolved');
  const firstP1 = openQueue.find((inc) => inc.p === 'P1');

  return (
    <div className="cx-page cx-page--inspect">

      <EnterpriseHero
        plane="operate"
        domain="command centre"
        title="Command Centre"
        deck={
          heroOrgName
            ? `Enterprise multi-tenant operations for ${heroOrgName} — incidents, changes, alerts and CMDB with evidence before action.`
            : 'Enterprise multi-tenant operations — incidents, changes, alerts and CMDB across the selected estate. Read the record; a named person approves the change.'
        }
        orgName={heroOrgName}
        env={heroEnv}
        meta={
          <>
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
          </>
        }
        actions={
          <>
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
          </>
        }
        kpis={[
          {
            label: 'Health',
            value: dashboardLoading ? '—' : slaCompliance || 0,
            sub: 'sla index',
          },
          {
            label: 'P1 open',
            value: dashboardLoading ? '—' : p1Critical,
            sub: 'critical',
            tone: p1Critical > 0 ? 'danger' : '',
          },
          {
            label: 'SLA risks',
            value: dashboardLoading ? '—' : heroRiskValue,
            sub: heroRiskSub,
            tone: heroRiskDanger ? 'danger' : '',
          },
        ]}
      />

      <EnterprisePosture
        label="Enterprise · evidence-first operations"
        chips={['Org-scoped estate', 'Named approver on every change', 'Correlation before page', 'Audit trail on every state change', 'No unattended production writes']}
      />

      {/* 2. Signal strip — clickable work queues */}
      <div className="cx-signals">
        {signalQueues.map((s) => (
          <button
            key={s.label}
            type="button"
            className="cx-signals__cell cx-signals__cell--link"
            onClick={() => navigate(s.to)}
          >
            <div className="cx-signals__label">{s.label}</div>
            <div className={clsx('cx-signals__value', s.tone && `cx-signals__value--${s.tone}`)}>
              {dashboardLoading ? '—' : s.value}
            </div>
            <div className="cx-signals__sub">{s.sub}</div>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════
          3. ACTIVE INCIDENTS + ACTIVITY (work first)
          ═══════════════════════════════════════════════ */}
      <div>
        <Panel
          title="Active Incidents"
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
                <tr className="border-b border-steel bg-obsidian/60">
                  {['ID', 'Priority', 'Subject', 'Status', 'Assignee', 'SLA', 'Age'].map(h => (
                    <th key={h} className="text-left px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.07em] text-dim whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidentsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : incidentRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8">
                      <EmptyState
                        message="No active incidents"
                        icon={<CheckCircle2 size={24} className="text-emerald" />}
                        action={<PanelBtn variant="primary" onClick={() => navigate('/incidents/create')}>Create incident</PanelBtn>}
                      />
                    </td>
                  </tr>
                ) : (
                  incidentRows.map((inc) => (
                    <tr
                      key={inc.id}
                      onClick={() => navigate(`/incidents/${inc.rawId}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/incidents/${inc.rawId}`); } }}
                      tabIndex={0}
                      role="link"
                      className="border-b border-steel hover:bg-[color:var(--argus-signal-dim)]/40 cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--argus-signal)]"
                    >
                      <td className="px-3.5 py-2.5 font-mono font-semibold text-signal text-[11px]">{inc.id}</td>
                      <td className="px-3.5 py-2.5">
                        <span className={clsx('badge',
                          inc.p === 'P1' && 'priority-p1', inc.p === 'P2' && 'priority-p2',
                          inc.p === 'P3' && 'priority-p3', inc.p === 'P4' && 'priority-p4')}>
                          ● {inc.p}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-ink font-medium max-w-[260px] truncate">{inc.desc}</td>
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
                          <span className="text-muted text-[11px] truncate max-w-[80px]">{inc.assigneeName}</span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--argus-border)' }}>
                            <div className={clsx('h-full rounded-full transition-all duration-1000',
                              inc.slaColor === 'emerald' ? 'bg-emerald' : inc.slaColor === 'amber' ? 'bg-amber' : 'bg-crimson'
                            )} style={{ width: `${inc.slaPercent}%` }} />
                          </div>
                          <span className={clsx('text-[10px] font-semibold whitespace-nowrap',
                            inc.slaColor === 'emerald' ? 'text-emerald' : inc.slaColor === 'amber' ? 'text-amber' : 'text-crimson'
                          )}>{inc.slaTime}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-dim">{inc.age}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════
          4. ON-CALL ROSTER STRIP
          ═══════════════════════════════════════════════ */}
      {onCallTeams.length > 0 && (
        <div className="cx-panel overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-2.5 border-b border-steel">
            <span className="text-[13px] font-bold text-ink flex items-center gap-2">
              <Phone size={13} className="text-signal" /> On-Call Now
            </span>
            <button type="button" onClick={() => navigate('/oncall')} className="text-[11px] text-signal font-semibold hover:underline flex items-center gap-1">
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
                <button
                  key={team.id || i}
                  type="button"
                  className="flex items-center gap-2.5 flex-shrink-0 px-3 py-2 bg-obsidian border border-steel rounded-lg hover:border-signal/40 transition-colors cursor-pointer text-left"
                  onClick={() => navigate('/oncall')}
                >
                  <AvatarCircle name={name} idx={i} size="sm" />
                  <div>
                    <p className="text-[11px] font-semibold text-ink">{name}</p>
                    <p className="text-[10px] text-dim">{team.name || `Team ${i + 1}`}</p>
                  </div>
                  <span className="ml-1 relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          5. SERVICE HEALTH + ALERT SEVERITY
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
                  <div key={s.type} className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-obsidian border border-steel hover:border-signal/40 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span className="text-dim">{icons[s.type] || <Server size={15} />}</span>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wide truncate">{s.type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={clsx('text-lg font-extrabold font-mono', pctColor)}>{s.pct}%</span>
                      <span className="text-[10px] text-dim">{s.live}/{s.total}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--argus-border)' }}>
                      <div className={clsx('h-full rounded-full transition-all duration-1000', barColor)} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              message="No asset data — select an organization"
              icon={<Server size={28} />}
              action={<PanelBtn onClick={() => navigate('/assets')}>Open CMDB</PanelBtn>}
            />
          )}
        </Panel>

        <Panel
          title={<><LiveDot color={critCount > 0 ? 'crimson' : 'emerald'} /> Alert Severity</>}
          titleExtra={<span className="text-[10px] text-dim font-mono">{alertTotal} firing</span>}
          actions={<PanelBtn onClick={() => navigate('/alerts')}>View All</PanelBtn>}
        >
          {alertTotal > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-around py-2">
                <AlertSeverityRing count={critCount} total={alertTotal} label="Critical" color="text-crimson" stroke="#DC2626" />
                <AlertSeverityRing count={warnCount} total={alertTotal} label="Warning" color="text-amber" stroke="#D97706" />
                <AlertSeverityRing count={infoCount} total={alertTotal} label="Info" color="text-signal" stroke={BRAND_BLUE} />
              </div>
              <div className="space-y-2 border-t border-steel pt-3">
                {liveAlerts.slice(0, 3).map((a: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    className="flex items-center gap-2 w-full cursor-pointer hover:bg-obsidian rounded-lg px-1 py-0.5 -mx-1 transition-colors text-left"
                    onClick={() => navigate('/alerts')}
                  >
                    <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0',
                      a.severity === 'CRITICAL' ? 'bg-crimson animate-pulse' : a.severity === 'WARNING' ? 'bg-amber' : 'bg-signal'
                    )} />
                    <p className="text-[11px] text-ink truncate flex-1">{a.name}</p>
                    <span className="text-[10px] text-dim font-mono flex-shrink-0">{timeSince(a.firedAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              message="All clear — no alerts"
              icon={<CheckCircle2 size={28} className="text-emerald" />}
              action={<PanelBtn onClick={() => navigate('/alerts')}>Open alerts</PanelBtn>}
            />
          )}
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════
          6. CATEGORIES + BACKLOG
          ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        <Panel
          title={<><Tag size={13} className="text-signal" /> Top Incident Categories</>}
          titleExtra={<span className="text-[10px] text-dim font-mono">{totalIncidents.toLocaleString()} all-time</span>}
          actions={<PanelBtn onClick={() => navigate('/incidents')}>View All</PanelBtn>}
        >
          {categoryRows.length > 0 ? (
            <div className="space-y-2.5">
              {categoryRows.map((c) => (
                <div key={c.label} className="flex items-center gap-3">
                  <span className="w-32 truncate text-[11px] font-semibold text-ink flex-shrink-0" title={c.label}>
                    {c.label}
                  </span>
                  <div className="flex-1 h-[7px] rounded overflow-hidden" style={{ background: 'var(--argus-border)' }}>
                    <div
                      className="h-full rounded bg-signal transition-all duration-[1.2s]"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                  <span className="w-9 text-[11px] font-bold font-mono text-ink text-right flex-shrink-0">
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={dashboardLoading ? 'Loading categories…' : 'No categorised incidents yet'} icon={<Tag size={20} />} />
          )}
        </Panel>

        <Panel
          title={<><Activity size={13} className="text-coral" /> Incident Backlog</>}
          titleExtra={<span className="text-[10px] text-dim font-mono">{resolvedLast7d} resolved / 7d</span>}
        >
          {stateRows.rows.length > 0 ? (
            <div className="space-y-2">
              {stateRows.rows.map((r) => {
                const pct = stateRows.total > 0 ? (r.count / stateRows.total) * 100 : 0;
                const pretty = r.label.replace(/_/g, ' ').toLowerCase();
                const tone =
                  r.label === 'RESOLVED' || r.label === 'CLOSED' ? 'bg-emerald'
                  : r.label === 'ESCALATED' ? 'bg-crimson'
                  : r.label === 'ON_HOLD' ? 'bg-amber'
                  : 'bg-signal';
                return (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="w-24 truncate text-[11px] font-semibold text-ink capitalize flex-shrink-0">
                      {pretty}
                    </span>
                    <div className="flex-1 h-[7px] rounded overflow-hidden" style={{ background: 'var(--argus-border)' }}>
                      <div className={clsx('h-full rounded transition-all duration-[1.2s]', tone)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-[11px] font-bold font-mono text-ink text-right flex-shrink-0">{r.count}</span>
                    <span className="w-10 text-[10px] font-mono text-dim text-right flex-shrink-0">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message={dashboardLoading ? 'Loading backlog…' : 'No incidents on record'} icon={<Activity size={20} />} />
          )}
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════
          7. TEAMS + CHANGES + SLA
          ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title={<><Users size={13} className="text-signal" /> Team Performance</>}
          titleExtra={<span className="text-[10px] text-dim">This month</span>}
          actions={<PanelBtn onClick={() => navigate('/teams')}>All Teams</PanelBtn>}>
          {teams.length > 0 ? (
            <div className="space-y-2.5">
              {teams.slice(0, 6).map((team: any, i: number) => {
                const memberCount = team._count?.members ?? team.memberCount ?? team.members?.length ?? 0;
                const incidentCount = team._count?.incidents ?? team.incidentCount ?? 0;
                const maxInc = Math.max(...teams.map((t: any) => t._count?.incidents ?? t.incidentCount ?? 1), 1);
                return (
                  <button
                    key={team.id}
                    type="button"
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-obsidian cursor-pointer transition-colors w-full text-left"
                    onClick={() => navigate(`/teams/${team.id}`)}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }}
                    >
                      <span className="text-[10px] font-bold text-white">{getInitials(team.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-ink truncate">{team.name}</span>
                        <span className="text-[10px] font-mono text-muted ml-1 flex-shrink-0">{memberCount}m</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--argus-border)' }}>
                        <div className="h-full rounded-full bg-signal transition-all duration-700"
                          style={{ width: `${Math.min(100, (incidentCount / maxInc) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold font-mono text-ink flex-shrink-0">{incidentCount}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No team data available" icon={<Users size={24} />} />
          )}
        </Panel>

        <Panel title={<><Calendar size={13} className="text-emerald" /> Upcoming Changes</>}
          actions={<PanelBtn onClick={() => navigate('/changes')}>Calendar</PanelBtn>}>
          {upcomingChanges.length > 0 ? (
            <div className="space-y-2.5">
              {upcomingChanges.map((c: any, i: number) => {
                const changeType = c.changeType || c.type || 'STANDARD';
                const typeColor: Record<string, string> = {
                  STANDARD: 'bg-[color:var(--argus-signal-dim)] text-signal',
                  EMERGENCY: 'bg-crimson/10 text-crimson',
                  NORMAL: 'bg-obsidian text-muted border border-steel',
                };
                return (
                  <button
                    key={c.id || i}
                    type="button"
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-obsidian border border-steel hover:border-emerald/40 cursor-pointer transition-colors w-full text-left"
                    onClick={() => navigate(`/changes/${c.id}`)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald/10 flex items-center justify-center flex-shrink-0">
                      <Tag size={12} className="text-emerald" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-ink truncate">{c.title || c.shortDescription || 'Scheduled change'}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={clsx('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', typeColor[changeType] || typeColor.STANDARD)}>
                          {changeType}
                        </span>
                        <span className="text-[10px] text-dim font-mono">{formatDate(c.plannedStartTime || c.scheduledAt)}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-dim flex-shrink-0 mt-0.5" />
                  </button>
                );
              })}
              <button type="button" onClick={() => navigate('/changes')} className="text-[11px] text-signal font-semibold hover:underline w-full text-right flex items-center justify-end gap-1">
                View all changes <ArrowRight size={11} />
              </button>
            </div>
          ) : (
            <EmptyState message="No upcoming changes scheduled" icon={<Calendar size={24} />} />
          )}
        </Panel>

        <Panel title="SLA Compliance" titleExtra={<span className="text-[10px] text-dim font-mono">{slaCompliance ? `${slaCompliance}%` : '--'}</span>}>
          <div className="flex flex-col items-center gap-4">
            <SLARing value={slaOverall} label="Overall SLA" />
            <div className="w-full space-y-2">
              {slaByPriority.length > 0 ? slaByPriority.map((s) => {
                const scored = s.total > 0;
                return (
                  <div key={s.priority} className="flex items-center gap-3">
                    <span className="w-8 text-[10px] font-bold text-muted flex-shrink-0">{s.priority}</span>
                    <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: 'var(--argus-border)' }}>
                      {scored && (
                        <div className={clsx('h-full rounded transition-all duration-[1.5s]',
                          s.value >= 95 ? 'bg-emerald' : s.value >= 85 ? 'bg-amber' : 'bg-crimson'
                        )} style={{ width: `${s.value}%` }} />
                      )}
                    </div>
                    <span className={clsx('w-10 text-[10px] font-bold font-mono text-right', scored ? 'text-ink' : 'text-dim')}>
                      {scored ? `${Number(s.value).toFixed(0)}%` : 'n/a'}
                    </span>
                    <span className="w-12 text-[10px] font-mono text-dim text-right"
                          title={scored ? `${s.breached} breached of ${s.total} closed` : 'No closed incidents at this priority yet'}>
                      {scored ? `${s.breached}/${s.total}` : '—'}
                    </span>
                  </div>
                );
              }) : (
                <p className="text-[11px] text-dim text-center py-1">
                  {slaOverall > 0 ? `Overall: ${slaOverall}%` : 'No SLA data'}
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════
          8. TREND + MERGED CMDB (was Topology + CMDB)
          ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Incident Trend (7 Days)" titleExtra={<span className="text-[10px] text-dim font-mono">{trendTotal || activeIncidents} total</span>}>
          {trendChartData && trendChartData.length > 0 ? (
            <div className="h-[150px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--argus-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--argus-dim)' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => { try { return new Date(String(v)).toLocaleDateString('en-IN', { weekday: 'short' }); } catch { return String(v); } }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--argus-dim)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--argus-border)', background: 'var(--argus-surface)', boxShadow: 'var(--argus-shadow-card)' }}
                    labelFormatter={(v) => { try { return new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch { return String(v); } }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {trendChartData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={idx === trendChartData.length - 1 ? BRAND_BLUE : BRAND_BLUE_SOFT} />
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
              <span className="text-[10px] text-dim">Active: {activeIncidents} incidents</span>
            </div>
          )}
        </Panel>

        <Panel
          title="CMDB Overview"
          titleExtra={<span className="text-[10px] text-dim font-mono">{totalAssets.toLocaleString()} CIs</span>}
          actions={
            <>
              <PanelBtn onClick={() => navigate('/network')}>Topology</PanelBtn>
              <PanelBtn onClick={() => navigate('/assets')}>All Assets</PanelBtn>
            </>
          }
        >
          {allAssets.length > 0 ? (
            <div className="space-y-2">
              {assetsByType.map(([type, count]) => {
                const pct = totalAssets > 0 ? Math.round((count / totalAssets) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-[100px] text-[10px] font-semibold text-muted truncate flex-shrink-0">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: 'var(--argus-border)' }}>
                      <div className="h-full rounded transition-all duration-1000"
                        style={{ width: `${pct}%`, backgroundColor: CI_COLORS[type] || '#78716C' }} />
                    </div>
                    <span className="w-7 text-[10px] font-bold font-mono text-ink text-right">{count}</span>
                    <span className="w-8 text-[10px] font-mono text-dim text-right">{pct}%</span>
                  </div>
                );
              })}
              <button type="button" onClick={() => navigate('/network')} className="text-[11px] text-signal font-semibold hover:underline mt-1 self-end flex items-center gap-1 ml-auto">
                View full topology <ArrowRight size={11} />
              </button>
            </div>
          ) : (
            <EmptyState message="No CMDB data" icon={<Database size={24} />} action={<PanelBtn onClick={() => navigate('/assets')}>Open CMDB</PanelBtn>} />
          )}
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════
          9. INFRA METRICS — only when data exists
          ═══════════════════════════════════════════════ */}
      {infraMetrics.length > 0 && (
        <div className="cx-panel overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-2.5 border-b border-steel">
            <span className="text-[13px] font-bold text-ink flex items-center gap-2">
              <LiveDot /> Infrastructure Metrics
            </span>
            <span className="text-[10px] text-dim font-mono">
              {now.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' })} IST · Live
            </span>
          </div>
          <div className="flex gap-0 divide-x divide-[color:var(--argus-border)] overflow-x-auto">
            {infraMetrics.map(m => (
              <div key={m.label} className="flex flex-col items-center px-5 py-3 flex-shrink-0">
                <span className="text-[10px] text-dim font-semibold mb-0.5">{m.label}</span>
                <span className="text-[17px] font-extrabold font-mono leading-none" style={{ color: m.color }}>
                  {m.value}{m.suffix}
                </span>
                <span className="text-[10px] text-dim mt-0.5">{m.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiet footer */}
      <p className="text-center py-4 font-mono text-[10px] text-dim tracking-wide">
        WeCrew Command Centre · {now.toLocaleDateString('en-IN', { year: 'numeric' })}
      </p>

      <aside className="cx-inspector hidden lg:flex" aria-label="Quick actions">
        <div className="cx-inspector__head">
          <span className="cx-inspector__head-label">Quick actions</span>
        </div>
        <div className="cx-inspector__body">
          <div>
            <p className="cx-inspector__eyebrow">Jump to work</p>
            <div className="mt-2 flex flex-col gap-1.5">
              <button
                type="button"
                className="cx-inspector__jump cx-inspector__jump--primary"
                onClick={() => navigate(firstP1 ? `/incidents/${firstP1.rawId}` : '/incidents')}
              >
                <AlertTriangle size={13} />
                {firstP1 ? `Open ${firstP1.id}` : 'Open incident queue'}
              </button>
              <button type="button" className="cx-inspector__jump" onClick={() => navigate('/alerts')}>
                <Bell size={13} />
                Alerts{firingAlerts > 0 ? ` (${firingAlerts})` : ''}
              </button>
              <button type="button" className="cx-inspector__jump" onClick={() => navigate('/changes')}>
                <ClipboardCheck size={13} />
                Change window
              </button>
              <button type="button" className="cx-inspector__jump" onClick={() => navigate('/oncall')}>
                <Phone size={13} />
                On-call now
              </button>
            </div>
          </div>

          <div>
            <h3 className="cx-inspector__section">Open incidents</h3>
            {openQueue.length > 0 ? (
              <div className="mt-2 space-y-0.5">
                {openQueue.slice(0, 6).map((inc) => (
                  <button
                    key={inc.id}
                    type="button"
                    className="cx-inspector__row"
                    onClick={() => navigate(`/incidents/${inc.rawId}`)}
                  >
                    <span className="min-w-0">
                      <span className="cx-inspector__row-name block">{inc.desc}</span>
                      <span className="cx-inspector__row-meta">{inc.id} · {inc.statusLabel}</span>
                    </span>
                    <span
                      className={clsx(
                        'cx-inspector__status',
                        inc.p === 'P1' ? 'cx-inspector__status--danger' : inc.p === 'P2' ? 'cx-inspector__status--warn' : ''
                      )}
                    >
                      {inc.p}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="cx-inspector__muted">No open incidents on this estate.</p>
            )}
          </div>

          <p className="cx-inspector__foot">
            {heroOrgName ? `${heroOrgName} · ${heroEnv}` : heroEnv} · evidence before action
          </p>
        </div>
      </aside>
    </div>
  );
}
