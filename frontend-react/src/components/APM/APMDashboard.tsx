import type React from 'react';
import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  Activity, Cpu, HardDrive, Network, Server, AlertTriangle,
  CheckCircle, XCircle, Clock, RefreshCw, Loader2, Eye, Wifi,
  WifiOff, ArrowUpRight, ArrowDownRight, Shield, Globe,
  Database, Layers, Box, ChevronDown, ChevronUp, Building2,
  Zap, Radio, BarChart3, MonitorSmartphone,
} from 'lucide-react';
import { useApmOverview } from '../../hooks/useAPM';

// ── Helpers ──────────────────────────────────────────────

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

function formatBps(bps: number): string {
  if (!bps || bps === 0) return '0 bps';
  const bits = bps * 8;
  if (bits >= 1e9) return `${(bits / 1e9).toFixed(1)} Gbps`;
  if (bits >= 1e6) return `${(bits / 1e6).toFixed(1)} Mbps`;
  if (bits >= 1e3) return `${(bits / 1e3).toFixed(1)} Kbps`;
  return `${bits.toFixed(0)} bps`;
}

function formatUptime(seconds: number): string {
  if (!seconds) return '—';
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hrs}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

function severityColor(s: string): string {
  if (s === 'critical' || s === 'CRITICAL') return 'text-[#EF4444]';
  if (s === 'warning' || s === 'WARNING') return 'text-[#F59E0B]';
  return 'text-[#6366F1]';
}

function severityBgStyle(s: string): React.CSSProperties {
  if (s === 'critical' || s === 'CRITICAL') return { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' };
  if (s === 'warning' || s === 'WARNING') return { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)' };
  return { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)' };
}

// ── Gauge Component ─────────────────────────────────────

function CircularGauge({ value, max = 100, label, size = 80, color }: {
  value: number; max?: number; label: string; size?: number; color: string;
}) {
  const pct = Math.min(value / max * 100, 100);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const strokeColor = pct > 90 ? '#EF4444' : pct > 75 ? '#F59E0B' : color;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={strokeColor} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold" style={{ color: '#E2EEF9' }}>{value.toFixed(1)}%</span>
        </div>
      </div>
      <p className="text-[10px] mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
    </div>
  );
}

// ── Process Group Card ──────────────────────────────────

function ProcessGroupCard({ groupName, processes }: { groupName: string; processes: any[] }) {
  const [open, setOpen] = useState(true);
  const healthy = processes.filter((p: any) => p.statusCode === 2).length;
  const total = processes.length;
  const allGood = healthy === total;

  const groupBorderColor = allGood ? 'rgba(255,255,255,0.07)' : 'rgba(220,38,38,0.3)';
  return (
    <div className="rounded-xl transition-all" style={{ border: `1px solid ${groupBorderColor}`, background: 'rgba(255,255,255,0.03)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer rounded-t-xl transition-colors" onClick={() => setOpen(!open)}
        style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : undefined }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4" style={{ color: allGood ? '#6EE7B7' : '#FCA5A5' }} />
          <span className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>{groupName}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>{healthy}/{total}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.35)' }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.35)' }} />}
      </div>
      {open && (
        <div className="px-4 pb-3 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pt-3">
          {processes.map((proc: any, i: number) => {
            const procBg = proc.statusCode === 2 ? 'rgba(5,150,105,0.06)' : proc.statusCode === 1 ? 'rgba(217,119,6,0.08)' : proc.statusCode === 0 ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.04)';
            const procBorder = proc.statusCode === 2 ? 'rgba(5,150,105,0.2)' : proc.statusCode === 1 ? 'rgba(217,119,6,0.25)' : proc.statusCode === 0 ? 'rgba(220,38,38,0.25)' : 'rgba(255,255,255,0.08)';
            const dotColor = proc.statusCode === 2 ? '#059669' : proc.statusCode === 1 ? '#D97706' : proc.statusCode === 0 ? '#DC2626' : '#6B7280';
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: procBg, border: `1px solid ${procBorder}` }}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${proc.statusCode === 0 ? 'animate-pulse' : ''}`} style={{ background: dotColor }} />
                <span className="font-medium truncate" style={{ color: '#CBD5E1' }}>{proc.name}</span>
                {proc.uptime != null && <span className="text-[9px] ml-auto font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{proc.uptime}%</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Network Interface Row ───────────────────────────────

function NetworkRow({ iface }: { iface: any }) {
  const isUp = iface.status === 'UP';
  const barColor = (iface.utilizationPercent || 0) > 80 ? '#DC2626' : (iface.utilizationPercent || 0) > 50 ? '#D97706' : '#059669';
  return (
    <div className={`flex items-center gap-4 px-4 py-3 transition-colors ${!isUp ? 'opacity-50' : ''}`}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <div className="flex items-center gap-2 w-36">
        {isUp ? <Wifi className="w-3.5 h-3.5" style={{ color: '#6EE7B7' }} /> : <WifiOff className="w-3.5 h-3.5" style={{ color: '#FCA5A5' }} />}
        <span className="text-sm font-mono font-semibold" style={{ color: '#CBD5E1' }}>{iface.name}</span>
      </div>
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={isUp ? { background: 'rgba(5,150,105,0.15)', color: '#6EE7B7' } : { background: 'rgba(220,38,38,0.15)', color: '#FCA5A5' }}>
        {iface.status}
      </span>
      <div className="flex items-center gap-1 w-28">
        <ArrowDownRight className="w-3 h-3" style={{ color: '#6EE7B7' }} />
        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{formatBps(iface.rxBytesPerSec || 0)}</span>
      </div>
      <div className="flex items-center gap-1 w-28">
        <ArrowUpRight className="w-3 h-3" style={{ color: '#A5B4FC' }} />
        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{formatBps(iface.txBytesPerSec || 0)}</span>
      </div>
      <div className="w-20 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {iface.speedBytes ? formatBps(iface.speedBytes) : '—'}
      </div>
      <div className="w-20 text-xs">
        {(iface.totalErrorsPerSec || 0) > 0
          ? <span className="font-bold" style={{ color: '#FCA5A5' }}>{iface.totalErrorsPerSec.toFixed(1)} err/s</span>
          : <span style={{ color: '#6EE7B7' }}>0 errors</span>
        }
      </div>
      {iface.utilizationPercent != null && (
        <div className="flex-1">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(iface.utilizationPercent, 100)}%`, background: barColor }} />
          </div>
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{iface.utilizationPercent}% util</span>
        </div>
      )}
    </div>
  );
}

// ── Service Target Row ──────────────────────────────────

function ServiceRow({ svc }: { svc: any }) {
  const typeBadgeStyle: React.CSSProperties =
    svc.type === 'monitoring' ? { background: 'rgba(99,102,241,0.15)', color: '#A5B4FC' } :
    svc.type === 'database'   ? { background: 'rgba(5,150,105,0.15)', color: '#6EE7B7' } :
    svc.type === 'kubernetes' ? { background: 'rgba(14,165,233,0.15)', color: '#38BDF8' } :
    svc.type === 'ingress'    ? { background: 'rgba(217,119,6,0.15)', color: '#FCD34D' } :
    { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' };
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${!svc.up ? 'animate-pulse' : ''}`} style={{ background: svc.up ? '#059669' : '#DC2626' }} />
      <span className="text-xs font-medium w-40 truncate" style={{ color: '#CBD5E1' }}>{svc.job}</span>
      <span className="text-[10px] font-mono w-44 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{svc.instance}</span>
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={typeBadgeStyle}>{svc.type}</span>
      {svc.httpCode && <span className="text-[10px] font-mono" style={{ color: svc.httpCode < 400 ? '#6EE7B7' : '#FCA5A5' }}>HTTP {svc.httpCode}</span>}
      {svc.responseTimeMs && <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{svc.responseTimeMs}ms</span>}
      {svc.sslExpiryDays != null && (
        <span className="text-[10px] font-mono" style={{ color: svc.sslExpiryDays < 30 ? '#FCA5A5' : 'rgba(255,255,255,0.4)' }}>
          SSL: {svc.sslExpiryDays}d
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'processes', label: 'Process Status', icon: Activity },
  { id: 'infra', label: 'Infrastructure', icon: Cpu },
  { id: 'network', label: 'Network', icon: Network },
  { id: 'k8s', label: 'Kubernetes', icon: Layers },
  { id: 'services', label: 'Services', icon: Globe },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
];

export default function APMDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useApmOverview();

  const org = data?.org;
  const summary = data?.summary;
  const infra = data?.infrastructure?.metrics;
  const k8sData = data?.k8s?.k8s;
  const networkData = data?.network?.interfaces || [];
  const servicesData = data?.services?.services || [];
  const alertsData = data?.alerts?.alerts || [];
  const processData = data?.processes;
  const isSimulated = data?.infrastructure?.simulated;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '';

  // Subsite filter for processes
  const subsites = processData?.subsites || [];
  const [subsiteFilter, setSubsiteFilter] = useState<string>('ALL');
  const filteredSubsites = subsiteFilter === 'ALL' ? subsites : subsites.filter((s: any) => s.subsite === subsiteFilter);

  // Service type filter
  const serviceTypes = useMemo(() => {
    const types = new Set<string>(servicesData.map((s: any) => s.type));
    return Array.from(types).sort();
  }, [servicesData]);
  const [svcFilter, setSvcFilter] = useState('all');
  const filteredServices = svcFilter === 'all' ? servicesData : servicesData.filter((s: any) => s.type === svcFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6366F1' }} />
        <span className="ml-3">Connecting to monitoring infrastructure...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ color: '#FCA5A5' }}>
        <AlertTriangle className="w-10 h-10 mb-3" />
        <p className="text-lg font-semibold">Failed to connect</p>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Unable to reach monitoring services</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-0" style={{ background: 'linear-gradient(180deg, #080B14 0%, #060910 40%, #060606 100%)', minHeight: '100vh', margin: '-1.5rem', padding: '1.5rem' }}>
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden mb-5" style={{ background: 'linear-gradient(180deg, #080B14 0%, #0C1220 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #6366F1, transparent)' }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <MonitorSmartphone size={16} className="text-[#10B981]" />
                </div>
                <h1 className="font-display text-2xl font-bold text-white tracking-tight">Service Health</h1>
                {isSimulated && <span className="text-[9px] font-mono font-bold text-[#F59E0B] bg-[#F59E0B]/15 px-1.5 py-0.5 rounded border border-[#F59E0B]/20">SIMULATED</span>}
                {!isSimulated && <span className="text-[9px] font-mono font-bold text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.5 rounded border border-[#10B981]/20">LIVE</span>}
              </div>
              {org?.name && (
                <div className="flex items-center gap-2 ml-[42px] mb-2">
                  <Building2 className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span className="text-sm font-semibold text-white">{org.name}</span>
                  {org.environment && (
                    <span className={clsx('text-[8px] font-bold px-1.5 py-0.5 rounded',
                      org.environment === 'PROD' ? 'bg-[#10B981]/15 text-[#10B981]' :
                      org.environment === 'DR' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                      'bg-[#6366F1]/15 text-[#818CF8]'
                    )}>{org.environment}</span>
                  )}
                  {org.serverIp && <span className="text-[10px] font-mono text-[#64748B]">{org.serverIp}</span>}
                  {org.fqdn && <span className="text-[10px] text-[#0EA5E9]">{org.fqdn}</span>}
                </div>
              )}
              <div className="flex items-center gap-1.5 ml-[42px] text-[#94A3B8] text-xs">
                <Clock className="w-3 h-3" /> Updated {lastUpdate}
                <button onClick={() => refetch()} className="ml-2 p-1 rounded hover:bg-white/[0.06]">
                  <RefreshCw className="w-3 h-3 text-[#94A3B8] hover:text-white" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {summary && [
                { label: 'Total', value: summary.total, color: 'text-white' },
                { label: 'Healthy', value: summary.healthy, color: 'text-[#10B981]' },
                { label: 'Warning', value: summary.warning, color: 'text-[#F59E0B]' },
                { label: 'Critical', value: summary.critical, color: 'text-[#EF4444]' },
                { label: 'Uptime', value: `${summary.uptime}%`, color: summary.uptime >= 99 ? 'text-[#10B981]' : summary.uptime >= 95 ? 'text-[#F59E0B]' : 'text-[#EF4444]' },
              ].map(s => (
                <div key={s.label} className="text-center px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <p className={clsx('text-xl font-bold font-display', s.color)}>{s.value}</p>
                  <p className="text-[9px] text-[#64748B] uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-[#10B981]/60 to-transparent -mt-5 mb-4" />

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 mb-4 rounded-xl p-1 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap"
              style={activeTab === tab.id ? { background: '#6366F1', color: '#fff' } : { color: 'rgba(255,255,255,0.5)' }}>
              <Icon className="w-3.5 h-3.5" /> {tab.label}
              {tab.id === 'alerts' && alertsData.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#DC2626', color: '#fff' }}>{alertsData.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {infra && (
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#E2EEF9' }}><Cpu className="w-4 h-4" style={{ color: '#818CF8' }} /> Infrastructure Health</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="relative flex flex-col items-center"><CircularGauge value={infra.cpu.usagePercent} label="CPU Usage" color="#6366F1" /></div>
                <div className="relative flex flex-col items-center"><CircularGauge value={infra.memory.usedPercent} label="Memory" color="#8B5CF6" /></div>
                <div className="relative flex flex-col items-center"><CircularGauge value={infra.disk.rootUsedPercent} label="Disk /" color="#D97706" /></div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-lg font-bold font-display" style={{ color: '#E2EEF9' }}>{infra.cpu.loadAvg['1m']}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Load Avg (1m)</p>
                  <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{infra.cpu.loadAvg['5m']} / {infra.cpu.loadAvg['15m']}</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-lg font-bold font-display" style={{ color: '#E2EEF9' }}>{formatUptime(infra.system.uptimeSeconds)}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Uptime</p>
                  <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{infra.system.hostname}</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-lg font-bold font-display" style={{ color: '#E2EEF9' }}>{infra.cpu.cores}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>CPU Cores</p>
                  <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{formatBytes(infra.memory.totalBytes)} RAM</p>
                </div>
              </div>
            </div>
          )}
          {k8sData && (
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#E2EEF9' }}><Layers className="w-4 h-4" style={{ color: '#38BDF8' }} /> Kubernetes Cluster</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Nodes', value: k8sData.nodes.ready, sub: `${k8sData.nodes.total} total`, ok: k8sData.nodes.notReady === 0 },
                  { label: 'Pods Running', value: k8sData.pods.running, sub: `${k8sData.pods.total} total`, ok: k8sData.pods.failed === 0 },
                  { label: 'Deployments', value: k8sData.deployments.available, sub: `${k8sData.deployments.total} total`, ok: k8sData.deployments.unavailable === 0 },
                  { label: 'Containers', value: k8sData.containers.ready, sub: `${k8sData.containers.total} total`, ok: true },
                  { label: 'Namespaces', value: k8sData.namespaces.length, sub: 'active', ok: true },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {s.ok ? <CheckCircle className="w-3 h-3" style={{ color: '#059669' }} /> : <XCircle className="w-3 h-3" style={{ color: '#DC2626' }} />}
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                    </div>
                    <p className="text-xl font-bold font-display" style={{ color: '#E2EEF9' }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {alertsData.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#FCA5A5' }}><AlertTriangle className="w-4 h-4" /> Active Alerts ({alertsData.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alertsData.slice(0, 10).map((alert: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={severityBgStyle(alert.severity)}>
                    <div className={`w-2 h-2 rounded-full animate-pulse`} style={{ background: alert.severity === 'critical' ? '#DC2626' : '#D97706' }} />
                    <span className="text-xs font-bold" style={{ color: alert.severity === 'critical' ? '#FCA5A5' : '#FCD34D' }}>{alert.alertname}</span>
                    <span className="text-[10px] truncate flex-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{alert.description}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{alert.instance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {networkData.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#E2EEF9' }}><Network className="w-4 h-4" style={{ color: '#38BDF8' }} /> Network Interfaces</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {networkData.filter((i: any) => /^(eth|ens|bond|em|enp)/.test(i.name)).slice(0, 4).map((iface: any) => (
                  <div key={iface.name} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      {iface.status === 'UP' ? <Wifi className="w-3.5 h-3.5" style={{ color: '#6EE7B7' }} /> : <WifiOff className="w-3.5 h-3.5" style={{ color: '#FCA5A5' }} />}
                      <span className="text-sm font-mono font-semibold" style={{ color: '#CBD5E1' }}>{iface.name}</span>
                    </div>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.4)' }}>RX</span><span className="font-mono" style={{ color: '#6EE7B7' }}>{formatBps(iface.rxBytesPerSec || 0)}</span></div>
                      <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.4)' }}>TX</span><span className="font-mono" style={{ color: '#A5B4FC' }}>{formatBps(iface.txBytesPerSec || 0)}</span></div>
                      <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Speed</span><span className="font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{iface.speedBytes ? formatBps(iface.speedBytes) : '—'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PROCESSES TAB ═══ */}
      {activeTab === 'processes' && (
        <div className="space-y-4">
          {subsites.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setSubsiteFilter('ALL')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={subsiteFilter === 'ALL' ? { background: 'rgba(255,255,255,0.15)', color: '#E2EEF9', border: '1px solid rgba(255,255,255,0.2)' } : { color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}>All Subsites</button>
              {subsites.map((s: any) => (
                <button key={s.subsite} onClick={() => setSubsiteFilter(s.subsite)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={subsiteFilter === s.subsite ? { background: '#6366F1', color: '#fff', border: '1px solid rgba(99,102,241,0.5)' } : { color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}>{s.subsite}</button>
              ))}
            </div>
          )}
          {filteredSubsites.map((sub: any) => (
            <div key={sub.subsite} className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#E2EEF9' }}><Server className="w-4 h-4" style={{ color: '#818CF8' }} /> {sub.subsite}</h3>
              {Object.entries(sub.groups || {}).map(([groupName, procs]: [string, any]) => (
                <ProcessGroupCard key={groupName} groupName={groupName} processes={procs} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ═══ INFRASTRUCTURE TAB ═══ */}
      {activeTab === 'infra' && infra && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>CPU</h3>
              <div className="flex items-center gap-4">
                <CircularGauge value={infra.cpu.usagePercent} label="" color="#6366F1" size={100} />
                <div className="space-y-2">
                  <div><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Cores</span><p className="text-sm font-bold" style={{ color: '#E2EEF9' }}>{infra.cpu.cores}</p></div>
                  <div><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Load (1/5/15m)</span><p className="text-xs font-mono" style={{ color: '#CBD5E1' }}>{infra.cpu.loadAvg['1m']} / {infra.cpu.loadAvg['5m']} / {infra.cpu.loadAvg['15m']}</p></div>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Memory</h3>
              <div className="flex items-center gap-4">
                <CircularGauge value={infra.memory.usedPercent} label="" color="#8B5CF6" size={100} />
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-4"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Total</span><span className="font-mono" style={{ color: '#CBD5E1' }}>{formatBytes(infra.memory.totalBytes)}</span></div>
                  <div className="flex justify-between gap-4"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Used</span><span className="font-mono" style={{ color: '#CBD5E1' }}>{formatBytes(infra.memory.totalBytes - infra.memory.availableBytes)}</span></div>
                  <div className="flex justify-between gap-4"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Buffers</span><span className="font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{formatBytes(infra.memory.buffersBytes)}</span></div>
                  <div className="flex justify-between gap-4"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Swap</span><span className="font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{formatBytes(infra.memory.swapUsedBytes)} / {formatBytes(infra.memory.swapTotalBytes)}</span></div>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>System</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Hostname</span><span className="font-mono" style={{ color: '#CBD5E1' }}>{infra.system.hostname}</span></div>
                <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.4)' }}>OS</span><span className="font-mono" style={{ color: '#CBD5E1' }}>{infra.system.sysname} {infra.system.release}</span></div>
                <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Arch</span><span className="font-mono" style={{ color: '#CBD5E1' }}>{infra.system.machine}</span></div>
                <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Uptime</span><span className="font-mono font-bold" style={{ color: '#6EE7B7' }}>{formatUptime(infra.system.uptimeSeconds)}</span></div>
              </div>
            </div>
          </div>
          {infra.disk.mounts.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}><HardDrive className="w-3.5 h-3.5" /> Filesystem Mounts</h3>
              <div className="space-y-2">
                {infra.disk.mounts.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-mono w-32 truncate" style={{ color: '#CBD5E1' }}>{m.mountpoint}</span>
                    <span className="text-[10px] font-mono w-20" style={{ color: 'rgba(255,255,255,0.4)' }}>{m.device}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${m.usedPercent}%`, background: m.usedPercent > 90 ? '#DC2626' : m.usedPercent > 75 ? '#D97706' : '#6366F1' }} />
                    </div>
                    <span className="text-xs font-bold w-12 text-right" style={{ color: m.usedPercent > 90 ? '#FCA5A5' : '#E2EEF9' }}>{m.usedPercent}%</span>
                    <span className="text-[10px] font-mono w-24 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{formatBytes(m.usedBytes)} / {formatBytes(m.totalBytes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {infra.disk.io.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Disk I/O</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {infra.disk.io.filter((d: any) => d.readBps > 0 || d.writeBps > 0).map((d: any) => (
                  <div key={d.device} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-xs font-mono font-semibold" style={{ color: '#CBD5E1' }}>{d.device}</span>
                    <div className="flex justify-between mt-1 text-[10px]">
                      <span style={{ color: '#6EE7B7' }}>R: {formatBytes(d.readBps)}/s</span>
                      <span style={{ color: '#A5B4FC' }}>W: {formatBytes(d.writeBps)}/s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ NETWORK TAB ═══ */}
      {activeTab === 'network' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span className="w-36">Interface</span><span className="w-12">Status</span><span className="w-28">RX Rate</span><span className="w-28">TX Rate</span><span className="w-20">Link Speed</span><span className="w-20">Errors</span><span className="flex-1">Utilization</span>
            </div>
          </div>
          {networkData.length > 0 ? networkData.map((iface: any) => <NetworkRow key={iface.name} iface={iface} />) : (
            <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.4)' }}><Network className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }} /><p>No network data available</p></div>
          )}
        </div>
      )}

      {/* ═══ K8S TAB ═══ */}
      {activeTab === 'k8s' && k8sData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Nodes Ready', value: `${k8sData.nodes.ready}/${k8sData.nodes.total}`, ok: k8sData.nodes.notReady === 0, icon: Server },
              { label: 'Pods Running', value: `${k8sData.pods.running}/${k8sData.pods.total}`, ok: k8sData.pods.failed === 0, icon: Box },
              { label: 'Deployments', value: `${k8sData.deployments.available}/${k8sData.deployments.total}`, ok: k8sData.deployments.unavailable === 0, icon: Layers },
              { label: 'Crash Loops', value: k8sData.pods.crashLoop, ok: k8sData.pods.crashLoop === 0, icon: AlertTriangle },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="p-4 rounded-xl" style={s.ok ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' } : { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
                  <div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4" style={{ color: s.ok ? '#059669' : '#DC2626' }} /><span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</span></div>
                  <p className="text-2xl font-bold font-display" style={{ color: '#E2EEF9' }}>{s.value}</p>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Pods by Namespace</h3>
            <div className="space-y-2">
              {k8sData.namespaces.map((ns: any) => (
                <div key={ns.namespace} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-48 truncate" style={{ color: '#CBD5E1' }}>{ns.namespace}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ background: '#6366F1', width: `${Math.min((ns.podCount / k8sData.pods.total) * 100, 100)}%` }} /></div>
                  <span className="text-xs font-bold w-8 text-right" style={{ color: '#E2EEF9' }}>{ns.podCount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'k8s' && !k8sData && (
        <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.4)' }}><Layers className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }} /><p>No Kubernetes data available</p></div>
      )}

      {/* ═══ SERVICES TAB ═══ */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setSvcFilter('all')} className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all" style={svcFilter === 'all' ? { background: 'rgba(255,255,255,0.15)', color: '#E2EEF9', border: '1px solid rgba(255,255,255,0.2)' } : { color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}>All ({servicesData.length})</button>
            {serviceTypes.map((t: string) => (
              <button key={t} onClick={() => setSvcFilter(t)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all" style={svcFilter === t ? { background: '#6366F1', color: '#fff', border: '1px solid rgba(99,102,241,0.5)' } : { color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}>{t} ({servicesData.filter((s: any) => s.type === t).length})</button>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}><span className="w-2.5" /><span className="w-40">Job</span><span className="w-44">Instance</span><span>Type</span></div>
            </div>
            {filteredServices.length > 0 ? filteredServices.map((svc: any, i: number) => <ServiceRow key={i} svc={svc} />) : (
              <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.4)' }}><Globe className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }} /><p>No service targets found</p></div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ALERTS TAB ═══ */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {alertsData.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#059669' }} />
              <p className="text-lg font-semibold" style={{ color: '#E2EEF9' }}>All Clear</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>No active alerts firing</p>
            </div>
          ) : alertsData.map((alert: any, i: number) => (
            <div key={i} className="rounded-xl p-4" style={severityBgStyle(alert.severity)}>
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 animate-pulse" style={{ background: alert.severity === 'critical' ? '#DC2626' : '#D97706' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold" style={{ color: alert.severity === 'critical' ? '#FCA5A5' : '#FCD34D' }}>{alert.alertname}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={severityBgStyle(alert.severity)}><span style={{ color: alert.severity === 'critical' ? '#FCA5A5' : '#FCD34D' }}>{alert.severity}</span></span>
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{alert.job}</span>
                  </div>
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{alert.description}</p>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <span className="font-mono">{alert.instance}</span>
                    {alert.activeAt && <span>Since {new Date(alert.activeAt).toLocaleString()}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
