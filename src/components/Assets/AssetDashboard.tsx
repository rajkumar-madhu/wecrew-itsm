// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Asset Management Dashboard (CMDB Operations Center)
// ═══════════════════════════════════════════════════════════

import type React from 'react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  HardDrive, Server, Database, Globe, Network, Container, Monitor, Cpu,
  Shield, AlertTriangle, DollarSign, Activity, CheckCircle, Clock,
  Filter, Search, Grid3X3, List, Loader2, Plus, TrendingDown, Package,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAssets, useAssetStats } from '../../hooks/useAssets';
import { useAuthStore } from '../../stores/authStore';

// ── Types ──────────────────────────────────────────────────

type AssetType =
  | 'SERVER' | 'KUBERNETES_CLUSTER' | 'DATABASE' | 'APPLICATION'
  | 'NETWORK' | 'STORAGE' | 'CONTAINER' | 'VM' | 'LOAD_BALANCER';

type AssetStatus = 'LIVE' | 'MAINTENANCE' | 'DECOMMISSIONED' | 'PLANNED';
type TabId = 'overview' | 'inventory' | 'risk';

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  ipAddress: string;
  location: string;
  dataCenter: string;
  monitoringEnabled: boolean;
  _count?: { alerts: number; incidents: number };
}

interface RiskAsset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  hostname: string | null;
  endOfLife: string | null;
  warrantyExpiry: string | null;
  monitoringEnabled: boolean;
  _count: { alerts: number; incidents: number };
}

interface AssetStats {
  total: number;
  byType: Array<{ type: string; _count: number }>;
  byStatus: Array<{ status: string; _count: number }>;
  liveCount: number;
  monitoringCoverage: number;
  eolWarnings: number;
  warrantyWarnings: number;
  costTotals: { purchaseCost: number | null; monthlyCost: number | null };
  topRiskAssets: RiskAsset[];
}

// ── Constants ──────────────────────────────────────────────

const typeIcons: Record<AssetType, React.ComponentType<{ className?: string; size?: number }>> = {
  SERVER: Server, KUBERNETES_CLUSTER: Container, DATABASE: Database,
  APPLICATION: Globe, NETWORK: Network, STORAGE: HardDrive,
  CONTAINER: Container, VM: Monitor, LOAD_BALANCER: Cpu,
};

const typeColors: Record<AssetType, string> = {
  SERVER: 'bg-[color:var(--argus-signal-dim)] text-signal border-[color:var(--argus-signal)]/25',
  KUBERNETES_CLUSTER: 'bg-violet-50 text-violet border-violet-200',
  DATABASE: 'bg-amber-50 text-amber border-amber-200',
  APPLICATION: 'bg-emerald-50 text-emerald border-emerald-200',
  NETWORK: 'bg-[color:var(--argus-signal-dim)] text-signal border-[color:var(--argus-signal)]/25',
  STORAGE: 'bg-amber-50 text-amber border-amber-200',
  CONTAINER: 'bg-violet-50 text-violet border-violet-200',
  VM: 'bg-[color:var(--argus-signal-dim)] text-signal border-[color:var(--argus-signal)]/25',
  LOAD_BALANCER: 'bg-red-50 text-crimson border-red-200',
};

const statusColors: Record<AssetStatus, string> = {
  LIVE: 'bg-emerald-50 text-emerald border-emerald-200',
  MAINTENANCE: 'bg-amber-50 text-amber border-amber-200',
  DECOMMISSIONED: 'bg-stone-100 text-stone-500 border-stone-200',
  PLANNED: 'bg-violet-50 text-violet border-violet-200',
};

const statusDotColors: Record<AssetStatus, string> = {
  LIVE: 'bg-emerald', MAINTENANCE: 'bg-amber',
  DECOMMISSIONED: 'bg-gray-500', PLANNED: 'bg-violet',
};

const STATUS_BAR_COLORS: Record<string, string> = {
  LIVE: '#059669', MAINTENANCE: '#D97706', DECOMMISSIONED: '#6B7280', PLANNED: '#7C3AED',
};

const CHART_PIE_COLORS = [
  '#4F46E5', '#7C3AED', '#D97706', '#059669', '#0EA5E9', '#F59E0B', '#8B5CF6', '#6366F1', '#DC2626',
];

const RISK_CARD_STYLES = [
  'from-red-900/40 to-red-800/20 border-red-500/30',
  'from-amber-900/40 to-amber-800/20 border-amber-500/30',
  'from-yellow-900/40 to-yellow-800/20 border-yellow-500/30',
];

// ── Helpers ────────────────────────────────────────────────

function formatCost(value: number | null | undefined): string {
  if (!value) return '—';
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ── Sub-components ─────────────────────────────────────────

const typeDarkStyle: Record<AssetType, React.CSSProperties> = {
  SERVER:             { background: 'rgba(79,70,229,0.15)',  color: 'var(--argus-signal)', border: '1px solid rgba(79,70,229,0.3)' },
  KUBERNETES_CLUSTER: { background: 'rgba(124,58,237,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(124,58,237,0.3)' },
  DATABASE:           { background: 'rgba(217,119,6,0.15)',  color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' },
  APPLICATION:        { background: 'rgba(5,150,105,0.15)',  color: 'var(--argus-emerald)', border: '1px solid rgba(5,150,105,0.3)' },
  NETWORK:            { background: 'rgba(79,70,229,0.15)',  color: 'var(--argus-signal)', border: '1px solid rgba(79,70,229,0.3)' },
  STORAGE:            { background: 'rgba(217,119,6,0.15)',  color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' },
  CONTAINER:          { background: 'rgba(124,58,237,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(124,58,237,0.3)' },
  VM:                 { background: 'rgba(79,70,229,0.15)',  color: 'var(--argus-signal)', border: '1px solid rgba(79,70,229,0.3)' },
  LOAD_BALANCER:      { background: 'rgba(220,38,38,0.15)',  color: 'var(--argus-crimson)', border: '1px solid rgba(220,38,38,0.3)' },
};

const statusDarkStyle: Record<AssetStatus, React.CSSProperties> = {
  LIVE:          { background: 'rgba(5,150,105,0.15)',  color: 'var(--argus-emerald)', border: '1px solid rgba(5,150,105,0.3)' },
  MAINTENANCE:   { background: 'rgba(217,119,6,0.15)',  color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' },
  DECOMMISSIONED:{ background: 'rgba(107,114,128,0.15)',color: '#9CA3AF', border: '1px solid rgba(107,114,128,0.3)' },
  PLANNED:       { background: 'rgba(124,58,237,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(124,58,237,0.3)' },
};

const statusDotHex: Record<AssetStatus, string> = {
  LIVE: '#059669', MAINTENANCE: '#D97706', DECOMMISSIONED: '#6B7280', PLANNED: '#7C3AED',
};

function TypeBadge({ type }: { type: AssetType }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md" style={typeDarkStyle[type]}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-medium rounded-md" style={statusDarkStyle[status]}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDotHex[status] }} />
      {status}
    </span>
  );
}

function MonitoringDot({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
        </span>
        <span className="text-[10px] text-emerald font-mono">Active</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-600" />
      <span className="text-[10px] text-stone-400 font-mono">Disabled</span>
    </span>
  );
}

function MonitoringRing({ covered, total }: { covered: number; total: number }) {
  const r = 54;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? covered / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36 flex-shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e7e5e4" strokeWidth="14" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="#059669" strokeWidth="14"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#059669" fontSize="22" fontWeight="700" fontFamily="monospace">
        {Math.round(pct * 100)}%
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#9ca3af" fontSize="10" fontFamily="sans-serif">
        Monitored
      </text>
      <text x={cx} y={cy + 25} textAnchor="middle" fill="#6b7280" fontSize="10" fontFamily="sans-serif">
        {covered}/{total}
      </text>
    </svg>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--argus-surface)', border: '1px solid rgba(5,150,105,0.3)' }}>
      <p className="font-medium" style={{ color: 'var(--argus-ink)' }}>{payload[0]?.name}</p>
      <p className="font-mono mt-0.5" style={{ color: 'var(--argus-emerald)' }}>{payload[0]?.value} assets</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function AssetDashboard() {
  const navigate = useNavigate();
  const organization = useAuthStore((s) => s.organization);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Inventory filters
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'ALL'>('ALL');
  const [monitoringFilter, setMonitoringFilter] = useState<'ALL' | 'ON' | 'OFF'>('ALL');

  const inventoryFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (typeFilter !== 'ALL') f.type = typeFilter;
    if (statusFilter !== 'ALL') f.status = statusFilter;
    if (monitoringFilter !== 'ALL') f.monitoringEnabled = monitoringFilter === 'ON' ? 'true' : 'false';
    if (searchQuery.trim()) f.search = searchQuery.trim();
    return f;
  }, [typeFilter, statusFilter, monitoringFilter, searchQuery]);

  const { data: statsResponse, isLoading: statsLoading } = useAssetStats();
  const { data: assetsResponse, isLoading: assetsLoading } = useAssets(inventoryFilters);

  const sd: AssetStats | undefined = statsResponse?.data;
  const assets: Asset[] = assetsResponse?.data ?? [];
  const totalCount: number = assetsResponse?.pagination?.total ?? assets.length;
  const topRiskAssets: RiskAsset[] = sd?.topRiskAssets ?? [];

  // Risk Board: compute scores, sort descending
  const rankedAssets = useMemo(() => {
    return topRiskAssets.map((a) => {
      const alerts = a._count?.alerts ?? 0;
      const incidents = a._count?.incidents ?? 0;
      const eolDays = daysUntil(a.endOfLife);
      const score =
        alerts * 3 +
        incidents * 2 +
        (eolDays !== null ? (eolDays < 30 ? 5 : eolDays < 90 ? 2 : 0) : 0) +
        (a.status === 'MAINTENANCE' ? 1 : 0) +
        (!a.monitoringEnabled ? 2 : 0);
      return { ...a, score };
    }).sort((a, b) => b.score - a.score);
  }, [topRiskAssets]);

  // EOL / Warranty items for Overview tab — filtered from topRiskAssets
  const eolItems = useMemo(() => {
    const now = Date.now();
    const in90 = now + 90 * 24 * 60 * 60 * 1000;
    const items: Array<{ asset: RiskAsset; kind: 'EOL' | 'WARRANTY'; date: Date; daysLeft: number }> = [];
    topRiskAssets.forEach((a) => {
      if (a.endOfLife) {
        const d = new Date(a.endOfLife);
        if (d.getTime() <= in90) {
          items.push({ asset: a, kind: 'EOL', date: d, daysLeft: Math.floor((d.getTime() - now) / 86_400_000) });
        }
      }
      if (a.warrantyExpiry) {
        const d = new Date(a.warrantyExpiry);
        if (d.getTime() <= in90) {
          items.push({ asset: a, kind: 'WARRANTY', date: d, daysLeft: Math.floor((d.getTime() - now) / 86_400_000) });
        }
      }
    });
    return items.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 10);
  }, [topRiskAssets]);

  // Chart data
  const typeChartData = sd?.byType?.map((item) => ({
    name: item.type.replace(/_/g, ' '),
    value: item._count,
  })) ?? [];

  const statusChartData = sd?.byStatus?.map((item) => ({
    name: item.status,
    value: item._count,
    fill: STATUS_BAR_COLORS[item.status] ?? '#6B7280',
  })) ?? [];

  const maxBarValue = Math.max(...statusChartData.map((d) => d.value), 1);
  const maxRiskScore = rankedAssets[0]?.score || 1;

  const monitoringPct = sd?.total
    ? Math.round(((sd.monitoringCoverage ?? 0) / sd.total) * 100)
    : 0;

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="animate-fade-in space-y-0" style={{ background: 'var(--argus-surface)', minHeight: '100vh', margin: '-1.5rem', padding: '1.5rem' }}>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: 'var(--argus-surface)' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'var(--argus-surface)' }} />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full blur-[80px] -translate-y-1/2 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,91,46,0.22) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full blur-[60px] translate-y-1/2 translate-x-1/4 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(43,76,255,0.16) 0%, transparent 70%)' }} />

        <div className="relative px-6 py-6">
          {/* Title row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 mb-2">
                <span>CMDB</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-400">Assets</span>
              </div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--argus-coral-dim)' }}>
                  <HardDrive size={18} style={{ color: 'var(--argus-coral)' }} />
                </div>
                <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Asset Management</h1>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-violet-500/20 text-violet-400 border border-violet-500/30">
                  {organization?.environment || 'DEV'}
                </span>
              </div>
              <p className="text-sm text-slate-400 ml-12">Configuration Management Database · CMDB Operations Center</p>
            </div>
            <button
              onClick={() => navigate('/assets/create')}
              className="flex items-center gap-2 px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={15} /> New Asset
            </button>
          </div>

          {/* KPI cards */}
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-[color:var(--argus-elevated)] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Total Assets */}
              <div className="bg-[color:var(--argus-elevated)] backdrop-blur-sm rounded-xl border border-[color:var(--argus-border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package size={13} className="text-emerald-400" />
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Total Assets</span>
                </div>
                <div className="text-3xl font-display font-bold text-ink">{sd?.total ?? 0}</div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">{sd?.byType?.length ?? 0} types tracked</div>
              </div>

              {/* Live & Monitored */}
              <div className="bg-[color:var(--argus-elevated)] backdrop-blur-sm rounded-xl border border-[color:var(--argus-border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={13} className="text-emerald-400" />
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Live & Monitored</span>
                </div>
                <div className="text-3xl font-display font-bold text-ink">{sd?.liveCount ?? 0}</div>
                <div className="text-[10px] mt-1 font-mono">
                  <span className="text-emerald-400">{monitoringPct}%</span>
                  <span className="text-slate-500 ml-1">monitoring active</span>
                </div>
              </div>

              {/* EOL Warnings */}
              <div className={clsx(
                'backdrop-blur-sm rounded-xl border p-4',
                (sd?.eolWarnings ?? 0) > 0
                  ? 'bg-amber-500/[0.08] border-amber-500/20'
                  : 'bg-[color:var(--argus-elevated)] border-[color:var(--argus-border)]'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={13} className={(sd?.eolWarnings ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400'} />
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">EOL Warnings</span>
                </div>
                <div className={clsx('text-3xl font-display font-bold', (sd?.eolWarnings ?? 0) > 0 ? 'text-amber-400' : 'text-ink')}>
                  {sd?.eolWarnings ?? 0}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">{sd?.warrantyWarnings ?? 0} warranty expiring</div>
              </div>

              {/* Monthly Burn */}
              <div className="bg-[color:var(--argus-elevated)] backdrop-blur-sm rounded-xl border border-[color:var(--argus-border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={13} className="text-emerald-400" />
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Monthly Burn</span>
                </div>
                <div className="text-2xl font-display font-bold text-ink">{formatCost(sd?.costTotals?.monthlyCost)}</div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">{formatCost(sd?.costTotals?.purchaseCost)} total value</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-coral to-transparent opacity-60" />

      {/* ── TAB BAR ──────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 -mt-2 relative z-10 rounded-xl" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', backdropFilter: 'blur(8px)' }}>
        {(['overview', 'inventory', 'risk'] as TabId[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={activeTab === tab ? { background: 'var(--argus-coral)', color: '#fff' } : { color: 'var(--argus-muted)' }}
          >
            {tab === 'risk' ? 'Risk Board' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] font-mono hidden sm:block" style={{ color: 'var(--argus-muted)' }}>{totalCount} total CIs</span>
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4 mt-4">
          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Type distribution donut */}
            <div className="rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <h3 className="text-sm font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--argus-ink)' }}>
                <Package size={15} style={{ color: 'var(--argus-emerald)' }} /> Asset Type Distribution
              </h3>
              {typeChartData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={70}
                        paddingAngle={3} dataKey="value"
                      >
                        {typeChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_PIE_COLORS[i % CHART_PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {typeChartData.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ background: CHART_PIE_COLORS[i % CHART_PIE_COLORS.length] }}
                          />
                          <span className="font-mono text-[10px] truncate" style={{ color: 'var(--argus-muted)' }}>{item.name}</span>
                        </div>
                        <span className="font-mono font-bold flex-shrink-0" style={{ color: 'var(--argus-ink)' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--argus-dim)' }}>No data</div>
              )}
            </div>

            {/* Status breakdown horizontal bars */}
            <div className="rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <h3 className="text-sm font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--argus-ink)' }}>
                <Shield size={15} style={{ color: 'var(--argus-emerald)' }} /> Status Breakdown
              </h3>
              {statusChartData.length > 0 ? (
                <div className="space-y-4 pt-2">
                  {statusChartData.map((item) => (
                    <div key={item.name}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: item.fill }}
                          />
                          <span className="font-mono text-xs" style={{ color: 'var(--argus-muted)' }}>{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-xs" style={{ color: 'var(--argus-ink)' }}>{item.value}</span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--argus-elevated)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(item.value / maxBarValue) * 100}%`,
                            background: item.fill,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--argus-dim)' }}>No data</div>
              )}
            </div>
          </div>

          {/* Monitoring ring + Cost summary row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Monitoring coverage ring */}
            <div className="rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <h3 className="text-sm font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--argus-ink)' }}>
                <Activity size={15} style={{ color: 'var(--argus-emerald)' }} /> Monitoring Coverage
              </h3>
              <div className="flex items-center gap-6">
                <MonitoringRing covered={sd?.monitoringCoverage ?? 0} total={sd?.total ?? 0} />
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--argus-muted)' }}>Active monitoring</span>
                    <span className="text-sm font-mono font-bold" style={{ color: 'var(--argus-emerald)' }}>{sd?.monitoringCoverage ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--argus-muted)' }}>Not monitored</span>
                    <span className="text-sm font-mono font-bold" style={{ color: 'var(--argus-muted)' }}>
                      {(sd?.total ?? 0) - (sd?.monitoringCoverage ?? 0)}
                    </span>
                  </div>
                  <div className="h-px" style={{ background: 'var(--argus-elevated)' }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--argus-muted)' }}>Coverage rate</span>
                    <span className="text-sm font-mono font-bold" style={{ color: 'var(--argus-ink)' }}>{monitoringPct}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cost summary */}
            <div className="rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <h3 className="text-sm font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--argus-ink)' }}>
                <DollarSign size={15} style={{ color: 'var(--argus-emerald)' }} /> Cost Summary
              </h3>
              <div className="space-y-3">
                <div className="p-4 rounded-xl" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                  <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--argus-muted)' }}>Total Purchase Value</div>
                  <div className="text-2xl font-display font-bold" style={{ color: 'var(--argus-ink)' }}>
                    {formatCost(sd?.costTotals?.purchaseCost)}
                  </div>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.2)' }}>
                  <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--argus-emerald)' }}>Monthly Burn Rate</div>
                  <div className="text-2xl font-display font-bold" style={{ color: 'var(--argus-emerald)' }}>
                    {formatCost(sd?.costTotals?.monthlyCost)}
                  </div>
                </div>
                <p className="text-[10px] font-mono" style={{ color: 'var(--argus-dim)' }}>
                  Totals include only assets with cost fields populated.
                </p>
              </div>
            </div>
          </div>

          {/* EOL / Warranty section */}
          <div className="rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
            <h3 className="text-sm font-display font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--argus-ink)' }}>
              <Clock size={15} style={{ color: 'var(--argus-emerald)' }} /> End-of-Life & Warranty Alerts
              <span className="text-[10px] font-mono ml-1" style={{ color: 'var(--argus-muted)' }}>within 90 days</span>
            </h3>
            {eolItems.length === 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.2)', color: 'var(--argus-emerald)' }}>
                <CheckCircle size={16} />
                <span className="text-sm font-medium">All assets within lifecycle policy</span>
                <span className="text-xs ml-auto" style={{ color: 'rgba(110,231,183,0.7)' }}>No EOL or warranty expiries in next 90 days</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--argus-border)' }}>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-3 py-2" style={{ color: 'var(--argus-muted)' }}>Asset</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-3 py-2" style={{ color: 'var(--argus-muted)' }}>Type</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-3 py-2" style={{ color: 'var(--argus-muted)' }}>Alert</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-3 py-2" style={{ color: 'var(--argus-muted)' }}>Date</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-3 py-2" style={{ color: 'var(--argus-muted)' }}>Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eolItems.map((item) => {
                      const overdue = item.daysLeft < 0;
                      const urgent = item.daysLeft >= 0 && item.daysLeft < 30;
                      return (
                        <tr
                          key={`${item.asset.id}-${item.kind}`}
                          onClick={() => navigate(`/assets/${item.asset.id}`)}
                          className="cursor-pointer transition-colors"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--argus-elevated)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="px-3 py-2.5">
                            <p className="text-sm font-medium" style={{ color: 'var(--argus-ink)' }}>{item.asset.name}</p>
                            {item.asset.hostname && (
                              <p className="text-[10px] font-mono" style={{ color: 'var(--argus-muted)' }}>{item.asset.hostname}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <TypeBadge type={item.asset.type} />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded" style={item.kind === 'EOL' ? { background: 'rgba(220,38,38,0.15)', color: 'var(--argus-crimson)', border: '1px solid rgba(220,38,38,0.3)' } : { background: 'rgba(217,119,6,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' }}>
                              {item.kind === 'EOL' ? 'End of Life' : 'Warranty'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs font-mono" style={{ color: 'var(--argus-muted)' }}>
                              {item.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs font-mono font-bold" style={{ color: overdue ? '#FCA5A5' : urgent ? '#FCD34D' : 'rgba(255,255,255,0.4)' }}>
                              {overdue ? `${Math.abs(item.daysLeft)}d overdue` : `${item.daysLeft}d`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── INVENTORY TAB ────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <div className="space-y-4 mt-4">
          {/* Filter bar */}
          <div className="rounded-xl p-3" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', backdropFilter: 'blur(8px)' }}>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5" style={{ color: 'var(--argus-muted)' }}>
                <Filter size={13} />
                <span className="text-[10px] font-semibold uppercase tracking-widest">Filters</span>
              </div>

              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as AssetType | 'ALL')} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}>
                <option value="ALL" style={{ background: 'var(--argus-surface)' }}>All Types</option>
                <option value="SERVER" style={{ background: 'var(--argus-surface)' }}>Server</option>
                <option value="KUBERNETES_CLUSTER" style={{ background: 'var(--argus-surface)' }}>Kubernetes Cluster</option>
                <option value="DATABASE" style={{ background: 'var(--argus-surface)' }}>Database</option>
                <option value="APPLICATION" style={{ background: 'var(--argus-surface)' }}>Application</option>
                <option value="NETWORK" style={{ background: 'var(--argus-surface)' }}>Network</option>
                <option value="STORAGE" style={{ background: 'var(--argus-surface)' }}>Storage</option>
                <option value="CONTAINER" style={{ background: 'var(--argus-surface)' }}>Container</option>
                <option value="VM" style={{ background: 'var(--argus-surface)' }}>VM</option>
                <option value="LOAD_BALANCER" style={{ background: 'var(--argus-surface)' }}>Load Balancer</option>
              </select>

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AssetStatus | 'ALL')} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}>
                <option value="ALL" style={{ background: 'var(--argus-surface)' }}>All Statuses</option>
                <option value="LIVE" style={{ background: 'var(--argus-surface)' }}>Live</option>
                <option value="MAINTENANCE" style={{ background: 'var(--argus-surface)' }}>Maintenance</option>
                <option value="DECOMMISSIONED" style={{ background: 'var(--argus-surface)' }}>Decommissioned</option>
                <option value="PLANNED" style={{ background: 'var(--argus-surface)' }}>Planned</option>
              </select>

              <select value={monitoringFilter} onChange={(e) => setMonitoringFilter(e.target.value as 'ALL' | 'ON' | 'OFF')} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}>
                <option value="ALL" style={{ background: 'var(--argus-surface)' }}>All Monitoring</option>
                <option value="ON" style={{ background: 'var(--argus-surface)' }}>Monitoring On</option>
                <option value="OFF" style={{ background: 'var(--argus-surface)' }}>Monitoring Off</option>
              </select>

              <div className="w-px h-7 hidden sm:block" style={{ background: 'var(--argus-elevated)' }} />

              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--argus-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by name, IP, datacenter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none transition-all"
                  style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}
                />
              </div>

              <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                <button onClick={() => setViewMode('grid')} className="p-2 rounded-md transition-all duration-200" style={viewMode === 'grid' ? { background: '#059669', color: 'var(--argus-ink)' } : { color: 'var(--argus-muted)' }} title="Grid view">
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('list')} className="p-2 rounded-md transition-all duration-200" style={viewMode === 'list' ? { background: '#059669', color: 'var(--argus-ink)' } : { color: 'var(--argus-muted)' }} title="List view">
                  <List className="w-4 h-4" />
                </button>
              </div>

              <span className="text-[10px] font-mono" style={{ color: 'var(--argus-muted)' }}>{totalCount} shown</span>
            </div>
          </div>

          {/* Loading */}
          {assetsLoading && (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: 'var(--argus-emerald)' }} />
              <p className="font-medium" style={{ color: 'var(--argus-muted)' }}>Loading assets...</p>
            </div>
          )}

          {/* Empty */}
          {!assetsLoading && assets.length === 0 && (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <Server className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--argus-dim)' }} />
              <p className="font-medium" style={{ color: 'var(--argus-muted)' }}>No assets match your filters</p>
              <p className="text-sm mt-1" style={{ color: 'var(--argus-dim)' }}>Adjust filters or search criteria</p>
            </div>
          )}

          {/* Grid view */}
          {!assetsLoading && viewMode === 'grid' && assets.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {assets.map((asset) => {
                const Icon = typeIcons[asset.type] || Server;
                return (
                  <div
                    key={asset.id}
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="p-5 cursor-pointer rounded-xl transition-all duration-300 hover:scale-[1.02] group"
                    style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(5,150,105,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(5,150,105,0.15)' }}>
                          <span style={{ color: 'var(--argus-emerald)' }}><Icon className="w-5 h-5" /></span>
                        </div>
                        <div>
                          <h3 className="text-sm font-display font-bold transition-colors" style={{ color: 'var(--argus-ink)' }}>
                            {asset.name}
                          </h3>
                          {asset._count && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {asset._count.alerts > 0 && (
                                <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ color: 'var(--argus-crimson)', background: 'rgba(220,38,38,0.15)' }}>
                                  {asset._count.alerts} alerts
                                </span>
                              )}
                              {asset._count.incidents > 0 && (
                                <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ color: 'var(--argus-amber)', background: 'rgba(217,119,6,0.15)' }}>
                                  {asset._count.incidents} inc
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <MonitoringDot enabled={asset.monitoringEnabled} />
                    </div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <TypeBadge type={asset.type} />
                      <StatusBadge status={asset.status} />
                    </div>
                    <div className="space-y-1.5 text-xs" style={{ color: 'var(--argus-muted)' }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--argus-dim)' }}>IP</span>
                        <span className="font-mono">{asset.ipAddress}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--argus-dim)' }}>Location</span>
                        <span className="font-mono">{asset.location}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List view */}
          {!assetsLoading && viewMode === 'list' && assets.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Name</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Type</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Status</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>IP</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Location</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Monitoring</th>
                      <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Alerts / Inc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const Icon = typeIcons[asset.type] || Server;
                      return (
                        <tr
                          key={asset.id}
                          onClick={() => navigate(`/assets/${asset.id}`)}
                          className="transition-colors cursor-pointer"
                          style={{ borderBottom: '1px solid var(--argus-border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--argus-elevated)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span style={{ color: 'var(--argus-emerald)' }}><Icon className="w-4 h-4 flex-shrink-0" /></span>
                              <span className="text-sm font-medium" style={{ color: 'var(--argus-ink)' }}>{asset.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><TypeBadge type={asset.type} /></td>
                          <td className="px-4 py-3"><StatusBadge status={asset.status} /></td>
                          <td className="px-4 py-3"><span className="text-xs font-mono" style={{ color: 'var(--argus-muted)' }}>{asset.ipAddress}</span></td>
                          <td className="px-4 py-3"><span className="text-xs" style={{ color: 'var(--argus-muted)' }}>{asset.location}</span></td>
                          <td className="px-4 py-3"><MonitoringDot enabled={asset.monitoringEnabled} /></td>
                          <td className="px-4 py-3">
                            {asset._count ? (
                              <div className="flex items-center gap-1.5">
                                {asset._count.alerts > 0 && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--argus-crimson)', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.25)' }}>
                                    {asset._count.alerts}A
                                  </span>
                                )}
                                {asset._count.incidents > 0 && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--argus-amber)', background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.25)' }}>
                                    {asset._count.incidents}I
                                  </span>
                                )}
                                {!asset._count.alerts && !asset._count.incidents && (
                                  <span className="text-[9px] font-mono" style={{ color: 'var(--argus-dim)' }}>—</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] font-mono" style={{ color: 'var(--argus-dim)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RISK BOARD TAB ───────────────────────────────────── */}
      {activeTab === 'risk' && (
        <div className="space-y-4 mt-4">
          {statsLoading ? (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: 'var(--argus-emerald)' }} />
              <p className="font-medium" style={{ color: 'var(--argus-muted)' }}>Computing risk scores...</p>
            </div>
          ) : rankedAssets.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--argus-dim)' }} />
              <p className="font-medium" style={{ color: 'var(--argus-muted)' }}>No assets found for risk assessment</p>
            </div>
          ) : (
            <>
              {/* Top 3 podium cards */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={15} style={{ color: 'var(--argus-crimson)' }} />
                  <h3 className="text-sm font-display font-semibold" style={{ color: 'var(--argus-ink)' }}>Top Risk Assets</h3>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--argus-muted)' }}>score = (alerts×3) + (incidents×2) + EOL + monitoring</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {rankedAssets.slice(0, Math.min(3, rankedAssets.length)).map((asset, i) => {
                    const Icon = typeIcons[asset.type] || Server;
                    const eolD = daysUntil(asset.endOfLife);
                    return (
                      <div
                        key={asset.id}
                        onClick={() => navigate(`/assets/${asset.id}`)}
                        className={clsx(
                          'relative rounded-xl border bg-gradient-to-br p-5 cursor-pointer transition-all hover:scale-[1.02] bg-obsidian text-ink border border-[color:var(--argus-border)]',
                          RISK_CARD_STYLES[i]
                        )}
                      >
                        <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono font-bold text-ink/70">
                          #{i + 1}
                        </div>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                            <Icon size={17} className="text-ink/80" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink truncate">{asset.name}</p>
                            <p className="text-[10px] font-mono text-ink/50 truncate">
                              {asset.hostname ?? asset.type.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                        <div className="mb-3">
                          <StatusBadge status={asset.status} />
                        </div>
                        {/* Risk score bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] font-mono text-ink/50 mb-1.5">
                            <span>Risk Score</span>
                            <span className="text-ink font-bold">{asset.score}</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-white/60 rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(100, (asset.score / Math.max(maxRiskScore, 10)) * 100)}%` }}
                            />
                          </div>
                        </div>
                        {/* Breakdown chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {asset._count.alerts > 0 && (
                            <span className="text-[9px] font-mono bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded">
                              {asset._count.alerts} alerts
                            </span>
                          )}
                          {asset._count.incidents > 0 && (
                            <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                              {asset._count.incidents} inc
                            </span>
                          )}
                          {!asset.monitoringEnabled && (
                            <span className="text-[9px] font-mono bg-slate-500/20 text-slate-300 border border-slate-500/30 px-1.5 py-0.5 rounded">
                              unmonitored
                            </span>
                          )}
                          {eolD !== null && eolD < 90 && (
                            <span className="text-[9px] font-mono bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded">
                              EOL {eolD < 0 ? 'overdue' : `${eolD}d`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ranks 4–20 table */}
              {rankedAssets.length > 3 && (
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--argus-border)' }}>
                    <h3 className="text-sm font-display font-semibold" style={{ color: 'var(--argus-ink)' }}>Full Risk Ranking</h3>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--argus-muted)' }}>Ranks 4–{rankedAssets.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
                          <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3 w-12" style={{ color: 'var(--argus-muted)' }}>Rank</th>
                          <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Asset</th>
                          <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Type</th>
                          <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Status</th>
                          <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Score</th>
                          <th className="text-left text-[10px] font-mono font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'var(--argus-muted)' }}>Risk Factors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedAssets.slice(3).map((asset, i) => {
                          const eolD = daysUntil(asset.endOfLife);
                          return (
                            <tr
                              key={asset.id}
                              onClick={() => navigate(`/assets/${asset.id}`)}
                              className="cursor-pointer transition-colors"
                              style={{ borderBottom: '1px solid var(--argus-border)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--argus-elevated)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td className="px-4 py-3">
                                <span className="text-xs font-mono" style={{ color: 'var(--argus-muted)' }}>#{i + 4}</span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium" style={{ color: 'var(--argus-ink)' }}>{asset.name}</p>
                                {asset.hostname && (
                                  <p className="text-[10px] font-mono" style={{ color: 'var(--argus-muted)' }}>{asset.hostname}</p>
                                )}
                              </td>
                              <td className="px-4 py-3"><TypeBadge type={asset.type} /></td>
                              <td className="px-4 py-3"><StatusBadge status={asset.status} /></td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--argus-elevated)' }}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${Math.min(100, (asset.score / Math.max(maxRiskScore, 1)) * 100)}%`, background: '#FCA5A5' }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono font-bold" style={{ color: 'var(--argus-ink)' }}>{asset.score}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {asset._count.alerts > 0 && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--argus-crimson)', background: 'rgba(220,38,38,0.15)' }}>
                                      {asset._count.alerts}A
                                    </span>
                                  )}
                                  {asset._count.incidents > 0 && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--argus-amber)', background: 'rgba(217,119,6,0.15)' }}>
                                      {asset._count.incidents}I
                                    </span>
                                  )}
                                  {!asset.monitoringEnabled && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--argus-muted)', background: 'var(--argus-elevated)' }}>Unmon</span>
                                  )}
                                  {eolD !== null && eolD < 90 && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--argus-amber)', background: 'rgba(217,119,6,0.15)' }}>EOL</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
