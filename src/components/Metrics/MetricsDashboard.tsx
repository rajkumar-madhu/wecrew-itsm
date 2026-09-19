import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useGrafanaDashboards, useInfrastructureMetrics } from '../../hooks/useAIAgent';
import { Link } from 'react-router-dom';
import {
  Cpu, MemoryStick, HardDrive, Network, Server, Container,
  RefreshCw, ExternalLink, Loader2, AlertTriangle,
  CheckCircle2, XCircle, ArrowUpDown, Database,
  Gauge, Layers, MonitorDot, Unplug, Cable, RotateCcw,
} from 'lucide-react';
import { Page, Segmented, EnterpriseHero, EnterprisePosture } from '../ui/PageChrome';

// ── Types ──
interface GrafanaPanel { id: number; title: string; type: string; gridPos: { x: number; y: number; w: number; h: number } }
interface GrafanaDashboard { uid: string; title: string; url: string; panels: GrafanaPanel[] }

const TABS = ['Overview', 'CPU & Memory', 'Virtualization', 'Storage & Volumes', 'Grafana Panels'] as const;
type Tab = typeof TABS[number];

const TIME_RANGES = [
  { label: '1h', value: 'now-1h' },
  { label: '6h', value: 'now-6h' },
  { label: '12h', value: 'now-12h' },
  { label: '24h', value: 'now-24h' },
  { label: '7d', value: 'now-7d' },
];

// ── Radial Gauge ──
function RadialGauge({ value, max = 100, label, sublabel, color, size = 120 }: {
  value: number; max?: number; label: string; sublabel?: string; color: string; size?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const danger = pct > 85;
  const warn = pct > 70;
  const ringColor = danger ? '#ef4444' : warn ? '#f59e0b' : color;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={ringColor} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold text-stone-900">{pct.toFixed(1)}%</span>
        {sublabel && <span className="text-[10px] text-stone-400 font-mono mt-0.5">{sublabel}</span>}
      </div>
      <span className="text-xs font-medium text-stone-600 mt-2">{label}</span>
    </div>
  );
}

// ── Status Pill ──
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Bound: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Running: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    degraded: 'bg-amber-50 text-amber-700 border-amber-200',
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Released: 'bg-blue-50 text-blue-700 border-blue-200',
    down: 'bg-red-50 text-red-700 border-red-200',
    Failed: 'bg-red-50 text-red-700 border-red-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${map[status] || 'bg-stone-50 text-stone-600 border-stone-200'}`}>
      {status}
    </span>
  );
}

// ── Stat Card ──
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<any>; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-start gap-3.5 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-ink" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-stone-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[11px] text-stone-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section Card ──
function Section({ title, icon: Icon, children, className = '' }: {
  title: string; icon: React.ComponentType<any>; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
        <Icon className="w-4 h-4 text-[color:var(--argus-signal)]" />
        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Progress Bar ──
function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const color = value > 85 ? 'bg-red-500' : value > 70 ? 'bg-amber-500' : 'bg-signal';
  return (
    <div className={`h-2 rounded-full bg-stone-100 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// ── Grafana Panel Iframe (lazy-loaded via IntersectionObserver) ──
function PanelIframe({ grafanaUrl, dashboardUid, panelId, from, title, panelType, gridH }: {
  grafanaUrl: string; dashboardUid: string; panelId: number; from: string; title: string; panelType?: string; gridH?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const src = `${grafanaUrl}/d-solo/${dashboardUid}/?orgId=1&panelId=${panelId}&from=${from}&to=now&theme=light`;
  const compactTypes = ['stat', 'gauge', 'bargauge', 'singlestat'];
  const isCompact = panelType ? compactTypes.includes(panelType) : (gridH != null && gridH <= 6);
  const iframeHeight = isCompact ? '200px' : '500px';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative bg-white rounded-xl border border-stone-200 shadow-sm group" style={{ minHeight: `calc(${iframeHeight} + 41px)` }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 bg-stone-50/50">
        <h3 className="text-sm font-medium text-stone-700 truncate">{title}</h3>
        <a href={src} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 hover:text-[color:var(--argus-signal)]">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      {!loaded && (
        <div className="absolute inset-0 top-[41px] flex items-center justify-center bg-stone-50 rounded-b-xl">
          <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
        </div>
      )}
      {visible && (
        <iframe src={src} className="w-full border-0" style={{ height: iframeHeight }} onLoad={() => setLoaded(true)} title={title} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Dashboard
// ═══════════════════════════════════════════════════════════
export default function MetricsDashboard() {
  const infra = useInfrastructureMetrics();
  const grafana = useGrafanaDashboards();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [grafanaTab, setGrafanaTab] = useState(0);
  const [timeRange, setTimeRange] = useState('now-6h');
  const [refreshKey, setRefreshKey] = useState(0);

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

  const m = infra.data?.data;
  const orgServerIp: string | null = m?.orgServerIp || null;
  const dashboards: GrafanaDashboard[] = grafana.data?.data?.dashboards || [];
  const grafanaUrl = (grafana.data?.data?.grafanaUrl || '').replace(/\/+$/, '');

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    infra.refetch();
    grafana.refetch();
  }, [infra, grafana]);

  useEffect(() => {
    if (dashboards.length > 0 && grafanaTab >= dashboards.length) setGrafanaTab(0);
  }, [dashboards.length, grafanaTab]);

  if (infra.isLoading && !m) {
    return (
      <Page>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-signal animate-spin" />
            <span className="text-sm text-muted font-mono">Loading infrastructure metrics…</span>
          </div>
        </div>
      </Page>
    );
  }

  const cpu = m?.cpu || { avgUsagePct: 0, totalCores: 0, perNode: [], load: { load1: 0, load5: 0, load15: 0 } };
  const mem = m?.memory || { totalGB: '0', usedGB: '0', availableGB: '0', usedPct: 0, buffersGB: '0', cachedGB: '0', swapTotalGB: '0', swapFreeGB: '0' };
  const disk = m?.disk || { avgUsedPct: 0, perNode: [] };
  const net = m?.network || { perNode: [], totalRx: '0 B/s', totalTx: '0 B/s' };
  const virt = m?.virtualization || { nodes: [], podCounts: {}, totalPods: 0, deployments: [], resourceAllocation: {} };
  const health = m?.containerHealth || { restartPods: [], oomKilled: [], crashLoopBackOff: [] };
  const store = m?.storage || { pvcs: [], pvCounts: {}, volumeUsage: [] };
  const alerts = m?.alerts || [];

  return (
    <Page>
      <EnterpriseHero
        plane="observe"
        domain="telemetry"
        title="Metrics"
        deck={
          heroOrgName
            ? `Org-scoped Prometheus and Grafana evidence for ${heroOrgName}${orgServerIp ? ` · ${orgServerIp}` : ''}.`
            : `Org-scoped Prometheus CPU, memory, disk and Grafana panels${orgServerIp ? ` · ${orgServerIp}` : ''}.`
        }
        orgName={heroOrgName}
        env={orgServerIp}
        actions={
          <>
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.value}
                type="button"
                onClick={() => { setTimeRange(tr.value); setRefreshKey((k) => k + 1); }}
                className={timeRange === tr.value ? 'cx-hero__btn' : 'cx-hero__btn cx-hero__btn--ghost'}
              >
                {tr.label}
              </button>
            ))}
            <button type="button" onClick={handleRefresh} className="cx-hero__btn cx-hero__btn--ghost" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${infra.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
        kpiCols={5}
        kpis={[
          { label: 'CPU', value: `${cpu.avgUsagePct}%`, sub: `${cpu.totalCores} cores`, tone: cpu.avgUsagePct > 85 ? 'danger' : cpu.avgUsagePct > 70 ? 'warn' : undefined },
          { label: 'Memory', value: `${mem.usedPct}%`, sub: `${mem.usedGB} / ${mem.totalGB} GB`, tone: mem.usedPct > 85 ? 'danger' : mem.usedPct > 70 ? 'warn' : undefined },
          { label: 'Disk', value: `${disk.avgUsedPct}%`, sub: `${disk.perNode.length} mounts` },
          { label: 'Network RX', value: net.totalRx, sub: `TX ${net.totalTx}` },
          { label: 'Alerts', value: alerts.length, sub: 'firing', tone: alerts.length > 0 ? 'danger' : undefined },
        ]}
      />
      <EnterprisePosture chips={['Org-scoped telemetry', 'Evidence-first panels', 'Audit export ready']} />

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Metrics</span>
      </nav>

      <Segmented
        options={TABS.map((tab) => ({ value: tab, label: tab }))}
        value={activeTab}
        onChange={(v) => setActiveTab(v as Tab)}
      />

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'Overview' && (
        <div className="space-y-5">
          {/* No-data banner for org with no matching Prometheus target */}
          {heroOrgName && cpu.avgUsagePct === 0 && mem.usedPct === 0 && disk.avgUsedPct === 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              <span>
                <strong>{heroOrgName}</strong> has no Prometheus targets reporting data.
                {orgServerIp ? ` Monitoring server: ${orgServerIp} — verify node_exporter is running.` : ' No server IP is configured for this org.'}
              </span>
            </div>
          )}
          {/* Hero KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Cpu} label="CPU Usage" value={`${cpu.avgUsagePct}%`} sub={`${cpu.totalCores} cores total`} color="bg-signal" />
            <StatCard icon={MemoryStick} label="Memory" value={`${mem.usedPct}%`} sub={`${mem.usedGB} / ${mem.totalGB} GB`} color="bg-violet-500" />
            <StatCard icon={HardDrive} label="Disk" value={`${disk.avgUsedPct}%`} sub={`${disk.perNode.length} mount(s)`} color="bg-amber-500" />
            <StatCard icon={Network} label="Network" value={net.totalRx} sub={`TX: ${net.totalTx}`} color="bg-emerald-500" />
          </div>

          {/* Gauges Row */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
            <div className="flex items-center justify-around flex-wrap gap-6">
              <div className="relative">
                <RadialGauge value={cpu.avgUsagePct} label="CPU" sublabel={`${cpu.totalCores} cores`} color="#6366f1" />
              </div>
              <div className="relative">
                <RadialGauge value={mem.usedPct} label="Memory" sublabel={`${mem.usedGB} GB`} color="#8b5cf6" />
              </div>
              <div className="relative">
                <RadialGauge value={disk.avgUsedPct} label="Disk" sublabel="root /" color="#f59e0b" />
              </div>
              <div className="relative">
                <RadialGauge value={virt.totalPods > 0 ? ((virt.podCounts?.Running || 0) / virt.totalPods) * 100 : 0} label="Pods Running" sublabel={`${virt.podCounts?.Running || 0} / ${virt.totalPods}`} color="#10b981" />
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={Server} label="Nodes" value={virt.nodes.length} sub={`${virt.nodes.filter((n: any) => n.ready).length} ready`} color="bg-blue-500" />
            <StatCard icon={Container} label="Pods" value={virt.totalPods} sub={`${virt.podCounts?.Running || 0} running`} color="bg-teal-500" />
            <StatCard icon={Layers} label="Deployments" value={virt.deployments.length} sub={`${virt.deployments.filter((d: any) => d.status === 'healthy').length} healthy`} color="bg-sky-500" />
            <StatCard icon={Database} label="PVCs" value={store.pvcs.length} sub={`${store.pvcs.filter((p: any) => p.phase === 'Bound').length} bound`} color="bg-orange-500" />
            <StatCard icon={AlertTriangle} label="Alerts" value={alerts.length} sub={`${alerts.filter((a: any) => a.severity === 'critical').length} critical`} color={alerts.length > 0 ? 'bg-red-500' : 'bg-stone-400'} />
          </div>

          {/* Alerts Strip */}
          {alerts.length > 0 && (
            <Section title={`Firing Alerts (${alerts.length})`} icon={AlertTriangle}>
              <div className="space-y-2">
                {alerts.slice(0, 8).map((a: any, i: number) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${a.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${a.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-800">{a.name}</p>
                      <p className="text-xs text-stone-500 mt-0.5 truncate">{a.summary || `${a.namespace} / ${a.instance}`}</p>
                    </div>
                    <StatusPill status={a.severity} />
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ═══ CPU & MEMORY TAB ═══ */}
      {activeTab === 'CPU & Memory' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* CPU */}
            <Section title="CPU Utilization" icon={Cpu}>
              <div className="flex items-center gap-8 mb-5">
                <div className="relative">
                  <RadialGauge value={cpu.avgUsagePct} label="Avg CPU" sublabel={`${cpu.totalCores} cores`} color="#6366f1" size={140} />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-stone-50 rounded-lg">
                      <p className="text-lg font-bold text-stone-900">{cpu.load.load1.toFixed(2)}</p>
                      <p className="text-[10px] text-stone-400">Load 1m</p>
                    </div>
                    <div className="text-center p-2 bg-stone-50 rounded-lg">
                      <p className="text-lg font-bold text-stone-900">{cpu.load.load5.toFixed(2)}</p>
                      <p className="text-[10px] text-stone-400">Load 5m</p>
                    </div>
                    <div className="text-center p-2 bg-stone-50 rounded-lg">
                      <p className="text-lg font-bold text-stone-900">{cpu.load.load15.toFixed(2)}</p>
                      <p className="text-[10px] text-stone-400">Load 15m</p>
                    </div>
                  </div>
                </div>
              </div>
              {cpu.perNode.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-stone-500">Per Node</p>
                  {cpu.perNode.map((n: any) => (
                    <div key={n.instance} className="flex items-center gap-3">
                      <span className="text-xs text-stone-500 font-mono w-40 truncate">{n.instance}</span>
                      <ProgressBar value={n.usagePct} className="flex-1" />
                      <span className="text-xs font-semibold text-stone-700 w-14 text-right">{n.usagePct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Memory */}
            <Section title="Memory Utilization" icon={MemoryStick}>
              <div className="flex items-center gap-8 mb-5">
                <div className="relative">
                  <RadialGauge value={mem.usedPct} label="Memory" sublabel={`${mem.usedGB} GB used`} color="#8b5cf6" size={140} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Total', val: `${mem.totalGB} GB` },
                      { label: 'Used', val: `${mem.usedGB} GB` },
                      { label: 'Available', val: `${mem.availableGB} GB` },
                      { label: 'Cached', val: `${mem.cachedGB} GB` },
                      { label: 'Buffers', val: `${mem.buffersGB} GB` },
                      { label: 'Swap', val: `${parseFloat(mem.swapTotalGB) - parseFloat(mem.swapFreeGB)}/${mem.swapTotalGB} GB` },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between p-1.5 bg-stone-50 rounded text-xs">
                        <span className="text-stone-400">{item.label}</span>
                        <span className="font-semibold text-stone-700">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Disk */}
            <Section title="Disk Usage" icon={HardDrive}>
              {disk.perNode.length > 0 ? (
                <div className="space-y-3">
                  {disk.perNode.map((d: any) => (
                    <div key={d.instance} className="p-3 bg-stone-50 rounded-lg space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-stone-600 font-mono truncate">{d.instance}</span>
                        <span className="text-xs font-bold text-stone-800">{d.usedPct}%</span>
                      </div>
                      <ProgressBar value={d.usedPct} />
                      <div className="flex gap-4 text-[10px] text-stone-400">
                        <span>Total: {d.total}</span>
                        <span>Used: {d.used}</span>
                        <span>Read: {d.readRate}</span>
                        <span>Write: {d.writeRate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-stone-400">No disk metrics available</p>}
            </Section>

            {/* Network */}
            <Section title="Network Throughput" icon={Network}>
              <div className="flex gap-6 mb-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <ArrowUpDown className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="text-[10px] text-emerald-600">Total RX</p>
                    <p className="text-sm font-bold text-emerald-700">{net.totalRx}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <ArrowUpDown className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-[10px] text-blue-600">Total TX</p>
                    <p className="text-sm font-bold text-blue-700">{net.totalTx}</p>
                  </div>
                </div>
              </div>
              {net.perNode.length > 0 ? (
                <div className="space-y-2">
                  {net.perNode.map((n: any) => (
                    <div key={n.instance} className="flex items-center justify-between p-2.5 bg-stone-50 rounded-lg">
                      <span className="text-xs text-stone-600 font-mono truncate flex-1">{n.instance}</span>
                      <span className="text-xs text-emerald-600 font-medium w-28 text-right">RX: {n.rxRate}</span>
                      <span className="text-xs text-blue-600 font-medium w-28 text-right">TX: {n.txRate}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-stone-400">No network metrics available</p>}
            </Section>
          </div>
        </div>
      )}

      {/* ═══ VIRTUALIZATION TAB ═══ */}
      {activeTab === 'Virtualization' && (
        <div className="space-y-5">
          {virt.nodes.length === 0 && virt.totalPods === 0 && virt.deployments.length === 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[color:var(--argus-signal)]/25 bg-[color:var(--argus-signal-dim)] text-indigo-800 text-sm">
              <Server className="w-4 h-4 shrink-0 text-[color:var(--argus-signal)]" />
              <span>
                <strong>kube-state-metrics</strong> is not deployed on this cluster. Deploy it to see Kubernetes nodes, pods, deployments, and resource allocation.
              </span>
            </div>
          )}
          {/* Nodes */}
          <Section title={`Nodes (${virt.nodes.length})`} icon={Server}>
            {virt.nodes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Node</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Status</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Kubelet</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Runtime</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">OS / Kernel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {virt.nodes.map((n: any) => (
                      <tr key={n.name} className="border-b border-stone-50 hover:bg-stone-50/50">
                        <td className="py-2.5 px-3 font-mono text-xs text-stone-800">{n.name}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${n.ready ? 'text-emerald-600' : 'text-red-600'}`}>
                            {n.ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {n.ready ? 'Ready' : 'NotReady'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-stone-500">{n.kubeletVersion}</td>
                        <td className="py-2.5 px-3 text-xs text-stone-500">{n.containerRuntime}</td>
                        <td className="py-2.5 px-3 text-xs text-stone-500 truncate max-w-[200px]">{n.osImage} / {n.kernel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-stone-400">No node metrics available</p>}
          </Section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Pod Phases */}
            <Section title="Pod Status Distribution" icon={Container}>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(virt.podCounts).map(([phase, count]: [string, any]) => (
                  <div key={phase} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <StatusPill status={phase} />
                    </div>
                    <span className="text-lg font-bold text-stone-900">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-[color:var(--argus-signal-dim)] rounded-lg border border-indigo-100">
                <div className="flex justify-between">
                  <span className="text-xs font-medium text-[color:var(--argus-signal)]">Total Pods</span>
                  <span className="text-sm font-bold text-[color:var(--argus-signal)]">{virt.totalPods}</span>
                </div>
              </div>
            </Section>

            {/* Resource Allocation */}
            <Section title="Resource Allocation" icon={Gauge}>
              <div className="space-y-3">
                {[
                  { label: 'CPU Requests', val: `${virt.resourceAllocation.cpuRequests} cores` },
                  { label: 'CPU Limits', val: `${virt.resourceAllocation.cpuLimits} cores` },
                  { label: 'Memory Requests', val: `${virt.resourceAllocation.memRequestsGB} GB` },
                  { label: 'Memory Limits', val: `${virt.resourceAllocation.memLimitsGB} GB` },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                    <span className="text-xs font-medium text-stone-500">{item.label}</span>
                    <span className="text-sm font-bold text-stone-800">{item.val}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Deployments */}
          <Section title={`Deployments (${virt.deployments.length})`} icon={Layers}>
            {virt.deployments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Namespace</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Deployment</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Replicas</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {virt.deployments.map((d: any) => (
                      <tr key={`${d.namespace}/${d.name}`} className="border-b border-stone-50 hover:bg-stone-50/50">
                        <td className="py-2 px-3 text-xs text-stone-500 font-mono">{d.namespace}</td>
                        <td className="py-2 px-3 text-xs text-stone-800 font-medium">{d.name}</td>
                        <td className="py-2 px-3 text-xs text-stone-600">{d.available} / {d.desired}</td>
                        <td className="py-2 px-3"><StatusPill status={d.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-stone-400">No deployment metrics available</p>}
          </Section>

          {/* Container Health */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <Section title={`Restarts (${health.restartPods.length})`} icon={RotateCcw}>
              {health.restartPods.length > 0 ? (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {health.restartPods.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-stone-50 rounded text-xs">
                      <span className="text-stone-600 truncate flex-1 font-mono">{p.namespace}/{p.pod}</span>
                      <span className="font-bold text-amber-600 ml-2">{p.restarts}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> No pod restarts</p>}
            </Section>

            <Section title={`OOMKilled (${health.oomKilled.length})`} icon={MonitorDot}>
              {health.oomKilled.length > 0 ? (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {health.oomKilled.map((p: any, i: number) => (
                    <div key={i} className="p-2 bg-red-50 rounded border border-red-100 text-xs">
                      <span className="text-red-700 font-mono">{p.namespace}/{p.pod}</span>
                      <span className="text-red-500 ml-1">({p.container})</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> No OOMKilled</p>}
            </Section>

            <Section title={`CrashLoopBackOff (${health.crashLoopBackOff.length})`} icon={Unplug}>
              {health.crashLoopBackOff.length > 0 ? (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {health.crashLoopBackOff.map((p: any, i: number) => (
                    <div key={i} className="p-2 bg-red-50 rounded border border-red-100 text-xs">
                      <span className="text-red-700 font-mono">{p.namespace}/{p.pod}</span>
                      <span className="text-red-500 ml-1">({p.container})</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> No CrashLoopBackOff</p>}
            </Section>
          </div>
        </div>
      )}

      {/* ═══ STORAGE & VOLUMES TAB ═══ */}
      {activeTab === 'Storage & Volumes' && (
        <div className="space-y-5">
          {store.pvcs.length === 0 && store.volumeUsage.length === 0 && Object.keys(store.pvCounts).length === 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[color:var(--argus-signal)]/25 bg-[color:var(--argus-signal-dim)] text-indigo-800 text-sm">
              <Database className="w-4 h-4 shrink-0 text-[color:var(--argus-signal)]" />
              <span>
                <strong>kube-state-metrics</strong> is not deployed on this cluster. Deploy it to see PersistentVolumes, PVCs, and volume utilization data.
              </span>
            </div>
          )}
          {/* PV Phase Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {['Bound', 'Available', 'Released', 'Failed'].map((phase) => (
              <StatCard
                key={phase}
                icon={phase === 'Bound' ? Cable : phase === 'Available' ? Database : phase === 'Released' ? Unplug : XCircle}
                label={`PV ${phase}`}
                value={store.pvCounts[phase] || 0}
                color={phase === 'Bound' ? 'bg-emerald-500' : phase === 'Available' ? 'bg-blue-500' : phase === 'Released' ? 'bg-amber-500' : 'bg-red-500'}
              />
            ))}
          </div>

          {/* PVCs */}
          <Section title={`Persistent Volume Claims (${store.pvcs.length})`} icon={Database}>
            {store.pvcs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Namespace</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">PVC Name</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Phase</th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase">Requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.pvcs.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-stone-50 hover:bg-stone-50/50">
                        <td className="py-2 px-3 text-xs text-stone-500 font-mono">{p.namespace}</td>
                        <td className="py-2 px-3 text-xs text-stone-800 font-medium">{p.name}</td>
                        <td className="py-2 px-3"><StatusPill status={p.phase} /></td>
                        <td className="py-2 px-3 text-xs text-stone-600 font-mono">{p.requested}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-stone-400">No PVCs found</p>}
          </Section>

          {/* Volume Usage */}
          <Section title={`Volume Utilization (${store.volumeUsage.length})`} icon={HardDrive}>
            {store.volumeUsage.length > 0 ? (
              <div className="space-y-3">
                {store.volumeUsage.map((v: any, i: number) => (
                  <div key={i} className="p-3 bg-stone-50 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-stone-600">{v.namespace}/{v.pvc}</span>
                      <span className="text-xs font-bold text-stone-800">{v.usedPct}%</span>
                    </div>
                    <ProgressBar value={v.usedPct} />
                    <div className="flex gap-4 text-[10px] text-stone-400">
                      <span>Capacity: {v.capacity}</span>
                      <span>Used: {v.used}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-stone-400">No volume usage data available</p>}
          </Section>
        </div>
      )}

      {/* ═══ GRAFANA PANELS TAB ═══ */}
      {activeTab === 'Grafana Panels' && (
        <div className="space-y-4">
          {dashboards.length > 0 ? (
            <>
              <div className="flex items-center gap-1 border-b border-stone-200">
                {dashboards.map((db, idx) => (
                  <button key={db.uid} onClick={() => setGrafanaTab(idx)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${grafanaTab === idx ? 'border-coral text-[color:var(--argus-coral)]' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
                  >{db.title} <span className="ml-1 text-xs text-stone-400">({db.panels.length})</span></button>
                ))}
              </div>
              {dashboards[grafanaTab] && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" key={`${dashboards[grafanaTab].uid}-${refreshKey}`}>
                  {dashboards[grafanaTab].panels.map((panel) => {
                    const isChart = ['timeseries', 'graph', 'piechart', 'table', 'barchart'].includes(panel.type);
                    const span = isChart ? 'md:col-span-2 xl:col-span-3' : panel.gridPos.w >= 18 ? 'md:col-span-2 xl:col-span-3' : panel.gridPos.w >= 12 ? 'md:col-span-2' : '';
                    return (
                    <div key={panel.id} className={span}>
                      <PanelIframe grafanaUrl={grafanaUrl} dashboardUid={dashboards[grafanaTab].uid} panelId={panel.id} from={timeRange} title={panel.title} panelType={panel.type} gridH={panel.gridPos.h} />
                    </div>);
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-dim">
              <Loader2 className={`w-6 h-6 mb-2 ${grafana.isLoading ? 'animate-spin' : ''}`} />
              <p className="text-sm">{grafana.isLoading ? 'Loading Grafana dashboards…' : 'No Grafana dashboards found'}</p>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
