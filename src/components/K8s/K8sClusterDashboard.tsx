import type React from 'react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, Box, Server, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, Layers, ChevronRight, Shield, Database, Loader2,
  ExternalLink, Terminal, Search, ArrowDown, Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

const NAMESPACES = ['fs-linkedeye', 'kube-system', 'default'];
const TABS = ['Overview', 'Pods', 'Deployments', 'Events', 'Services', 'Logs', 'Assets'] as const;
type Tab = typeof TABS[number];

// ── Status Badge (dark theme) ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const isOk = status === 'Running' || status === 'Ready' || status === 'True' || status === 'Healthy';
  const isWarn = status === 'Pending';
  const style: React.CSSProperties = isOk
    ? { background: 'rgba(5,150,105,0.15)', color: 'var(--argus-emerald)', border: '1px solid rgba(5,150,105,0.3)' }
    : isWarn
    ? { background: 'rgba(217,119,6,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' }
    : { background: 'rgba(220,38,38,0.15)', color: 'var(--argus-crimson)', border: '1px solid rgba(220,38,38,0.3)' };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={style}>
      {isOk ? <CheckCircle className="w-3 h-3" /> : isWarn ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {status}
    </span>
  );
}

// ── Stat Card (glassmorphic, inside dark hero) ──────────────────────────────
function StatCard({
  label, value, icon: Icon, iconColor, pulse, delay,
}: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string; size?: number }>;
  iconColor: string; pulse?: boolean; delay: number;
}) {
  return (
    <div
      className="bg-[color:var(--argus-elevated)] backdrop-blur-sm rounded-xl border border-[color:var(--argus-border)] p-4 hover:shadow-xl transition-all duration-300 group animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--argus-muted)' }}>{label}</p>
          <p className="font-display text-2xl font-extrabold text-ink">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[color:var(--argus-elevated)] flex items-center justify-center relative">
          <Icon className={iconColor} size={18} />
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Loading Skeleton ────────────────────────────────────────────────────────
function SkeletonTable() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
      <div className="px-4 py-3" style={{ background: 'var(--argus-elevated)', borderBottom: '1px solid var(--argus-border)' }}>
        <div className="flex items-center gap-6">
          {[100, 60, 80, 200, 80, 60].map((w, i) => (
            <div key={i} className="h-3 rounded animate-pulse" style={{ width: `${w}px`, background: 'var(--argus-elevated)' }} />
          ))}
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-4 flex items-center gap-6" style={{ borderBottom: '1px solid var(--argus-border)' }}>
          <div className="w-32 h-4 rounded animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
          <div className="w-20 h-6 rounded-full animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
          <div className="flex-1 h-4 rounded animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
          <div className="w-16 h-3 rounded animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
        </div>
      ))}
    </div>
  );
}

// ── Highlight search matches ────────────────────────────────────────────────
function highlightSearch(text: string, search: string) {
  if (!search) return text;
  const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>{parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase()
        ? <mark key={i} className="bg-amber-400/30 text-amber-300 rounded px-0.5">{part}</mark>
        : part
    )}</>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════════════════
export default function K8sClusterDashboard() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [namespace, setNamespace] = useState('fs-linkedeye');
  const { selectedOrgId, user } = useAuthStore();
  const isSuperAdmin = user?.role === 'ADMIN' && !user?.organizationId;

  // Fetch org list so we can display the selected org name
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations?limit=50').then(r => r.data),
    staleTime: 120000,
    enabled: isSuperAdmin,
  });
  const orgs: { id: string; name: string; serverIp?: string }[] = orgsData?.data || [];
  const selectedOrg = selectedOrgId ? orgs.find(o => o.id === selectedOrgId) : null;

  const headers = selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {};

  const { data: overviewData, isLoading: ovLoading, refetch: refetchOv, error: ovErr } = useQuery({
    queryKey: ['k8s-overview', selectedOrgId],
    queryFn: () => api.get('/k8s/overview', { headers }).then(r => r.data.data),
    retry: 1,
    refetchInterval: 30000,
  });

  const { data: podsData, isLoading: podsLoading } = useQuery({
    queryKey: ['k8s-pods', selectedOrgId, namespace],
    queryFn: () => api.get(`/k8s/pods?namespace=${namespace}`, { headers }).then(r => r.data.data),
    enabled: tab === 'Pods',
    retry: 1,
  });

  const { data: deploymentsData, isLoading: deplLoading } = useQuery({
    queryKey: ['k8s-deployments', selectedOrgId, namespace],
    queryFn: () => api.get(`/k8s/deployments?namespace=${namespace}`, { headers }).then(r => r.data.data),
    enabled: tab === 'Deployments',
    retry: 1,
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['k8s-events', selectedOrgId, namespace],
    queryFn: () => api.get(`/k8s/events?namespace=${namespace}`, { headers }).then(r => r.data.data),
    enabled: tab === 'Events',
    retry: 1,
  });

  const { data: servicesData, isLoading: svcLoading } = useQuery({
    queryKey: ['k8s-services', selectedOrgId, namespace],
    queryFn: () => api.get(`/k8s/services?namespace=${namespace}`, { headers }).then(r => r.data.data),
    enabled: tab === 'Services',
    retry: 1,
  });

  // Assets tab — fetch CMDB assets for this org (SERVER + KUBERNETES_CLUSTER types)
  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ['k8s-assets', selectedOrgId],
    queryFn: () => api.get('/assets?limit=100', { headers }).then(r => r.data),
    enabled: tab === 'Assets',
    staleTime: 30000,
  });

  // Sync mutation: POST /k8s/sync-assets
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const syncAssets = useMutation({
    mutationFn: () => api.post('/k8s/sync-assets', {}, { headers }).then(r => r.data),
    onSuccess: (data: any) => {
      const d = data?.data || data;
      qc.invalidateQueries({ queryKey: ['k8s-assets'] });
      qc.invalidateQueries({ queryKey: ['assets'] });
      setSyncMsg({ ok: true, text: `Synced ${d.total || 0} assets (${d.created || 0} created, ${d.updated || 0} updated)` });
    },
    onError: (err: any) => {
      setSyncMsg({ ok: false, text: err?.response?.data?.error || err.message || 'Sync failed' });
    },
  });

  // ── Logs Tab State ──
  const [logPod, setLogPod] = useState('');
  const [logTail, setLogTail] = useState(200);
  const [logSince, setLogSince] = useState('3600');
  const [logSearch, setLogSearch] = useState('');

  // Fetch pod list for the Logs tab pod selector
  const { data: logPodsData } = useQuery({
    queryKey: ['k8s-pods-for-logs', selectedOrgId, namespace],
    queryFn: () => api.get(`/k8s/pods?namespace=${namespace}`, { headers }).then(r => r.data.data),
    enabled: tab === 'Logs',
    staleTime: 30000,
  });

  const { data: logData, isLoading: logLoading, refetch: refetchLogs, error: logError } = useQuery({
    queryKey: ['k8s-pod-logs', selectedOrgId, namespace, logPod, logTail, logSince],
    queryFn: () => api.get(`/k8s/pods/${logPod}/logs?namespace=${namespace}&tail=${logTail}&since=${logSince}`, { headers }).then(r => r.data.data),
    enabled: tab === 'Logs' && !!logPod,
    retry: 1,
    refetchInterval: 10000,
  });

  const filteredLogs = logData?.logs?.filter((l: any) =>
    !logSearch || l.message?.toLowerCase().includes(logSearch.toLowerCase())
  ) || [];

  const ov = overviewData;

  return (
    <div className="animate-fade-in space-y-0" style={{ background: 'var(--argus-surface)', minHeight: '100vh', margin: '-1.5rem', padding: '1.5rem' }}>
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HERO BANNER                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: 'var(--argus-surface)' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'var(--argus-surface)' }} />
        {/* Dot grid texture */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        {/* Sky glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative px-6 pt-6 pb-14">
          <div className="flex items-start justify-between">
            {/* Left: title */}
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-[color:var(--argus-elevated)] flex items-center justify-center">
                  <Layers size={16} className="text-sky-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Kubernetes Cluster</h1>
              </div>
              <p className="text-sm ml-[42px]" style={{ color: 'var(--argus-muted)' }}>
                {ov?.serverIp || selectedOrg?.serverIp || '--'} · {ov?.org || selectedOrg?.name || 'Select an organization'} · {ov?.nodes?.[0]?.kubeletVersion || '--'}
              </p>
            </div>

            {/* Right: refresh */}
            <button
              onClick={() => refetchOv()}
              className="flex items-center gap-2 px-4 py-2 bg-[color:var(--argus-elevated)] rounded-xl text-sm font-medium transition-all hover:bg-[color:var(--argus-elevated)]" style={{ color: 'var(--argus-muted)' }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {/* Stat Cards */}
          <div className="relative mt-6">
            {ovLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="bg-[color:var(--argus-elevated)] backdrop-blur-sm rounded-xl p-4 animate-pulse h-20" />
                ))}
              </div>
            ) : ovErr ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm">
                {!selectedOrgId && isSuperAdmin ? (
                  <p className="text-amber-400">Please select an organization from the sidebar to view its K8s cluster.</p>
                ) : (
                  <p className="text-red-400">
                    Unable to connect to K8s cluster{selectedOrg ? ` (${selectedOrg.name})` : ''}.
                    {' '}Ensure SSH key is configured and server is reachable.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard label="Nodes Ready" value={`${ov?.nodesReady ?? 0}/${ov?.nodeCount ?? 0}`} icon={Server} iconColor="text-sky-400" delay={0} />
                <StatCard label="Pods Running" value={ov?.pods?.running ?? 0} icon={Box} iconColor="text-[#6EE7B7]" delay={100} />
                <StatCard label="Pods Pending" value={ov?.pods?.pending ?? 0} icon={Activity} iconColor="text-[#FCD34D]" delay={200} />
                <StatCard label="Pods Failed" value={ov?.pods?.failed ?? 0} icon={XCircle} iconColor="text-red-400" pulse={Number(ov?.pods?.failed ?? 0) > 0} delay={300} />
                <StatCard label="Total Pods" value={ov?.pods?.total ?? 0} icon={Layers} iconColor="text-signal" delay={400} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sky accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-sky-500/60 to-transparent" />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FLOATING TAB BAR                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="-mt-3 relative z-10 rounded-xl p-3 mb-4" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab buttons */}
          <div className="flex items-center rounded-lg p-0.5" style={{ background: 'var(--argus-elevated)' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                style={tab === t ? { background: 'var(--argus-signal)', color: '#ffffff' } : { color: 'var(--argus-muted)' }}>
                {t}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--argus-elevated)' }} />

          {/* Namespace selector */}
          {tab !== 'Overview' && tab !== 'Assets' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--argus-muted)' }}>Namespace</span>
              {NAMESPACES.map(ns => (
                <button key={ns} onClick={() => setNamespace(ns)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                  style={namespace === ns
                    ? { background: 'var(--argus-signal)', color: '#ffffff', border: '1px solid rgba(14,165,233,0.5)' }
                    : { color: 'var(--argus-muted)', border: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }
                  }>
                  {ns}
                </button>
              ))}
            </div>
          )}

          {/* Live indicator */}
          <div className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: 'var(--argus-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#059669' }} />
            Live · 30s
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CONTENT AREA                                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {/* ── Overview ── */}
      {tab === 'Overview' && !ovLoading && !ovErr && ov && (
        <div className="space-y-4">
          {/* Nodes Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
              <Server size={15} className="text-sky-400" />
              <span className="font-display text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>Nodes</span>
              <span className="text-[10px] font-mono font-bold rounded-full px-2 py-0.5 ml-1" style={{ color: 'var(--argus-muted)', background: 'var(--argus-elevated)' }}>{ov.nodes?.length || 0}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
                  {['Name', 'Status', 'Roles', 'Version', 'CPU', 'Memory'].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ov.nodes?.map((n: any) => (
                  <tr key={n.name} className="transition-colors" style={{ borderBottom: '1px solid var(--argus-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-5 py-3 font-mono text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>{n.name}</td>
                    <td className="px-5 py-3"><StatusBadge status={n.status} /></td>
                    <td className="px-5 py-3 capitalize text-xs" style={{ color: 'var(--argus-muted)' }}>{n.roles}</td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--argus-muted)' }}>{n.kubeletVersion}</td>
                    <td className="px-5 py-3">
                      {n.cpu ? <span className="font-mono text-xs font-medium" style={{ color: '#38BDF8' }}>{n.cpu} <span style={{ color: 'var(--argus-muted)' }}>({n.cpuPct})</span></span> : <span style={{ color: 'var(--argus-dim)' }}>—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {n.mem ? <span className="font-mono text-xs font-medium" style={{ color: 'var(--argus-signal)' }}>{n.mem} <span style={{ color: 'var(--argus-muted)' }}>({n.memPct})</span></span> : <span style={{ color: 'var(--argus-dim)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Namespace Summary */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
              <Layers size={15} className="text-signal" />
              <span className="font-display text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>Namespaces</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: '1px', background: 'var(--argus-elevated)' }}>
              {Object.entries(ov.namespaces || {}).map(([ns, data]: [string, any]) => (
                <div key={ns} className="p-4 transition-colors" style={{ background: 'var(--argus-elevated)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}>
                  <div className="text-sm font-semibold mb-2 truncate" style={{ color: 'var(--argus-ink)' }}>{ns}</div>
                  <div className="flex gap-3 text-xs">
                    <span className="font-medium" style={{ color: 'var(--argus-emerald)' }}>{data.running} running</span>
                    {data.pending > 0 && <span className="font-medium" style={{ color: 'var(--argus-amber)' }}>{data.pending} pending</span>}
                    {data.failed > 0 && <span className="font-medium" style={{ color: 'var(--argus-crimson)' }}>{data.failed} failed</span>}
                  </div>
                  <div className="text-[10px] mt-1 font-mono" style={{ color: 'var(--argus-muted)' }}>{data.total} total</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Overview' && ovLoading && <SkeletonTable />}

      {/* ── Pods ── */}
      {tab === 'Pods' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
            <Box size={15} className="text-sky-400" />
            <span className="font-display text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>Pods</span>
            <span className="text-xs font-normal" style={{ color: 'var(--argus-muted)' }}>— {namespace}</span>
            {podsData && <span className="text-[10px] font-mono font-bold rounded-full px-2 py-0.5 ml-1" style={{ color: 'var(--argus-muted)', background: 'var(--argus-elevated)' }}>{podsData.total}</span>}
          </div>
          {podsLoading ? (
            <div className="p-12 text-center text-sm" style={{ color: 'var(--argus-muted)' }}>Loading pods…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
                    {['Pod Name', 'Phase', 'Ready', 'Restarts', 'CPU', 'Memory', 'IP'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {podsData?.pods?.map((p: any) => (
                    <tr key={p.name} className="transition-colors" style={{ borderBottom: '1px solid var(--argus-border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>{p.name}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={p.phase} /></td>
                      <td className="px-4 py-2.5">
                        {p.ready ? <CheckCircle size={15} style={{ color: '#059669' }} /> : <XCircle size={15} style={{ color: '#DC2626' }} />}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--argus-muted)' }}>{p.restarts}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium" style={{ color: '#38BDF8' }}>{p.cpu || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium" style={{ color: 'var(--argus-signal)' }}>{p.mem || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--argus-muted)' }}>{p.podIp || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Deployments ── */}
      {tab === 'Deployments' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
            <Layers size={15} className="text-signal" />
            <span className="font-display text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>Deployments</span>
            <span className="text-xs font-normal" style={{ color: 'var(--argus-muted)' }}>— {namespace}</span>
            {deploymentsData && (
              <span className="text-[10px] font-mono font-bold rounded-full px-2 py-0.5 ml-1" style={{ color: 'var(--argus-muted)', background: 'var(--argus-elevated)' }}>
                {deploymentsData.healthy}/{deploymentsData.total} healthy
              </span>
            )}
          </div>
          {deplLoading ? (
            <div className="p-12 text-center text-sm" style={{ color: 'var(--argus-muted)' }}>Loading deployments…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
                  {['Name', 'Desired', 'Ready', 'Available', 'Health'].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deploymentsData?.deployments?.map((d: any) => (
                  <tr key={d.name} className="transition-colors" style={{ borderBottom: '1px solid var(--argus-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-5 py-3 font-mono text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>{d.name}</td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--argus-muted)' }}>{d.replicas}</td>
                    <td className="px-5 py-3 font-mono text-xs font-medium" style={{ color: 'var(--argus-emerald)' }}>{d.readyReplicas}</td>
                    <td className="px-5 py-3 font-mono text-xs font-medium" style={{ color: '#38BDF8' }}>{d.availableReplicas}</td>
                    <td className="px-5 py-3"><StatusBadge status={d.healthy ? 'Healthy' : 'Degraded'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Events ── */}
      {tab === 'Events' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
            <AlertTriangle size={15} className="text-amber-400" />
            <span className="font-display text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>Warning Events</span>
            <span className="text-xs font-normal" style={{ color: 'var(--argus-muted)' }}>— {namespace}</span>
          </div>
          {eventsLoading ? (
            <div className="p-12 text-center text-sm" style={{ color: 'var(--argus-muted)' }}>Loading events…</div>
          ) : eventsData?.events?.length === 0 ? (
            <div className="py-16 px-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(5,150,105,0.15)' }}>
                <Shield size={28} style={{ color: '#059669' }} />
              </div>
              <h3 className="font-display text-lg font-bold mb-1" style={{ color: 'var(--argus-ink)' }}>All Clear</h3>
              <p className="text-sm" style={{ color: 'var(--argus-muted)' }}>No warning events in {namespace}</p>
            </div>
          ) : (
            <div>
              {eventsData?.events?.map((e: any, i: number) => (
                <div key={i} className="px-5 py-4 transition-colors" style={{ borderBottom: '1px solid var(--argus-border)' }}
                  onMouseEnter={el => (el.currentTarget.style.background = 'rgba(217,119,6,0.05)')}
                  onMouseLeave={el => (el.currentTarget.style.background = 'transparent')}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--argus-amber)' }}>{e.reason}</span>
                        <span className="text-xs" style={{ color: 'var(--argus-dim)' }}>·</span>
                        <span className="text-xs font-mono" style={{ color: 'var(--argus-muted)' }}>{e.kind}/{e.name}</span>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--argus-muted)' }}>{e.message}</p>
                    </div>
                    <span className="text-[10px] whitespace-nowrap font-mono font-bold rounded-full px-2 py-0.5" style={{ color: 'var(--argus-muted)', background: 'var(--argus-elevated)' }}>{e.count}×</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Services ── */}
      {tab === 'Services' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
            <Activity size={15} className="text-emerald-400" />
            <span className="font-display text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>Services</span>
            <span className="text-xs font-normal" style={{ color: 'var(--argus-muted)' }}>— {namespace}</span>
            {servicesData && <span className="text-[10px] font-mono font-bold rounded-full px-2 py-0.5 ml-1" style={{ color: 'var(--argus-muted)', background: 'var(--argus-elevated)' }}>{servicesData.total}</span>}
          </div>
          {svcLoading ? (
            <div className="p-12 text-center text-sm" style={{ color: 'var(--argus-muted)' }}>Loading services…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
                  {['Name', 'Type', 'Cluster IP', 'Ports'].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {servicesData?.services?.map((s: any) => (
                  <tr key={s.name} className="transition-colors" style={{ borderBottom: '1px solid var(--argus-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-5 py-3 font-mono text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>{s.name}</td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={
                        s.type === 'NodePort' ? { background: 'rgba(14,165,233,0.15)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.3)' } :
                        s.type === 'ClusterIP' ? { background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' } :
                        { background: 'rgba(79,70,229,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(79,70,229,0.3)' }
                      }>
                        {s.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--argus-muted)' }}>{s.clusterIp}</td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--argus-muted)' }}>{s.ports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Logs ── */}
      {tab === 'Logs' && (
        <div className="space-y-3">
          {/* Controls bar */}
          <div className="rounded-xl p-3" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', backdropFilter: 'blur(8px)' }}>
            <div className="flex flex-wrap items-center gap-2">
              {/* Pod selector */}
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Terminal size={13} className="text-sky-400 shrink-0" />
                <select
                  value={logPod}
                  onChange={e => setLogPod(e.target.value)}
                  className="flex-1 text-[12px] rounded-lg px-3 py-1.5 font-mono focus:outline-none"
                  style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}
                >
                  <option value="" style={{ background: 'var(--argus-surface)' }}>Select a pod…</option>
                  {logPodsData?.pods?.map((p: any) => (
                    <option key={p.name} value={p.name} style={{ background: 'var(--argus-surface)' }}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Since */}
              <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--argus-elevated)' }}>
                {[{ label: '15m', value: '900' }, { label: '1h', value: '3600' }, { label: '6h', value: '21600' }, { label: '24h', value: '86400' }].map(opt => (
                  <button key={opt.value} onClick={() => setLogSince(opt.value)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                    style={logSince === opt.value ? { background: 'var(--argus-signal)', color: '#ffffff' } : { color: 'var(--argus-muted)' }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Tail */}
              <select value={logTail} onChange={e => setLogTail(Number(e.target.value))}
                className="text-[11px] rounded-lg px-2 py-1.5 font-mono focus:outline-none"
                style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}>
                {[100, 200, 500, 1000].map(n => <option key={n} value={n} style={{ background: 'var(--argus-surface)' }}>{n} lines</option>)}
              </select>

              {/* Search */}
              <div className="relative flex-1 min-w-[140px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--argus-dim)' }} />
                <input type="text" value={logSearch} onChange={e => setLogSearch(e.target.value)}
                  placeholder="Filter logs…"
                  className="w-full pl-7 pr-3 py-1.5 text-[12px] rounded-lg font-mono focus:outline-none"
                  style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}
                />
              </div>

              {/* Refresh */}
              <button onClick={() => refetchLogs()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }}>
                <RefreshCw size={12} className={logLoading ? 'animate-spin' : ''} /> Refresh
              </button>

              <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--argus-muted)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#059669' }} />
                10s
              </div>
            </div>
          </div>

          {/* Terminal output */}
          <div className="bg-obsidian text-ink border border-[color:var(--argus-border)] rounded-xl border border-[#1E293B] shadow-xl overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E293B] bg-obsidian text-ink border border-[color:var(--argus-border)]/80">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#DC2626]/50" />
                  <span className="w-3 h-3 rounded-full bg-[#D97706]/50" />
                  <span className="w-3 h-3 rounded-full bg-[#059669]/50" />
                </div>
                <div className="w-px h-4 bg-slate text-ink" />
                <Terminal size={12} className="text-[#38BDF8]" />
                <span className="text-[12px] font-mono text-[#475569]">
                  kubectl logs {logPod || '<pod>'} -n {namespace}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-dim">
                {logPod && <span>{filteredLogs.length} lines</span>}
                {logSearch && (
                  <span className="text-[#D97706] bg-[#D97706]/10 px-2 py-0.5 rounded-full">
                    "{logSearch}" · {filteredLogs.length}
                  </span>
                )}
                {logLoading && <Loader2 size={12} className="animate-spin text-[#38BDF8]" />}
              </div>
            </div>

            {/* Log lines */}
            <div className="overflow-auto max-h-[600px]">
              {!logPod ? (
                <div className="py-20 text-center">
                  <Terminal size={32} className="text-ink mx-auto mb-3" />
                  <p className="text-[#475569] text-sm">Select a pod to view its logs</p>
                  <p className="text-dim text-xs mt-1">Choose a pod from the dropdown above</p>
                </div>
              ) : logLoading ? (
                <div className="py-16 text-center">
                  <Loader2 size={20} className="text-[#38BDF8] animate-spin mx-auto mb-2" />
                  <p className="text-[#475569] text-xs font-mono">Fetching pod logs…</p>
                </div>
              ) : logError ? (
                <div className="py-16 text-center px-8">
                  <AlertTriangle size={24} className="text-[#DC2626] mx-auto mb-2" />
                  <p className="text-muted text-sm font-semibold mb-1">Failed to fetch logs</p>
                  <p className="text-[#475569] text-xs font-mono">
                    {(logError as any)?.response?.data?.error || (logError as any)?.message || 'SSH or kubectl error'}
                  </p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-[#475569] text-sm">No log entries found</p>
                  <p className="text-dim text-xs mt-1">The pod may have no recent output in the selected time range</p>
                </div>
              ) : (
                <table className="w-full text-[12px] font-mono border-collapse">
                  <tbody>
                    {filteredLogs.map((l: any, i: number) => {
                      const isErr  = /error|err|fatal|panic|exception/i.test(l.message);
                      const isWarn = !isErr && /warn|warning/i.test(l.message);
                      return (
                        <tr key={i} className={`border-b border-[color:var(--argus-border)] hover:bg-white/[0.025] ${
                          isErr ? 'bg-[#DC2626]/[0.06]' : isWarn ? 'bg-[#D97706]/[0.04]' : ''
                        }`}>
                          <td className="px-2 py-0.5 text-dim select-none text-right w-10 align-top tabular-nums">{i + 1}</td>
                          <td className="px-2 py-0.5 text-[#475569] whitespace-nowrap w-[110px] align-top tabular-nums">
                            {l.timestamp ? (() => {
                              try {
                                const d = new Date(l.timestamp);
                                return d.toLocaleTimeString('en-IN', { hour12: false });
                              } catch { return l.timestamp?.slice(0, 19) || ''; }
                            })() : ''}
                          </td>
                          <td className={`px-2 py-0.5 break-all align-top ${
                            isErr ? 'text-[#FCA5A5]' : isWarn ? 'text-[#FCD34D]' : 'text-ink'
                          }`}>
                            {logSearch ? highlightSearch(l.message, logSearch) : l.message}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Assets (CMDB) ── */}
      {tab === 'Assets' && (
        <div className="space-y-4">
          {/* Sync bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-emerald-400" />
              <span className="font-display text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>CMDB Assets</span>
              {assetsData && (
                <span className="text-[10px] font-mono font-bold rounded-full px-2 py-0.5 ml-1" style={{ color: 'var(--argus-muted)', background: 'var(--argus-elevated)' }}>
                  {assetsData?.pagination?.total ?? assetsData?.data?.length ?? 0} assets
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {syncMsg && (
                <span className="text-xs font-medium" style={{ color: syncMsg.ok ? '#6EE7B7' : '#FCA5A5' }}>
                  {syncMsg.text}
                </span>
              )}
              <button
                onClick={() => { setSyncMsg(null); syncAssets.mutate(); }}
                disabled={syncAssets.isPending}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                style={{ background: 'var(--argus-signal)' }}
              >
                {syncAssets.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Syncing...</>
                ) : (
                  <><RefreshCw size={14} /> Sync from Cluster</>
                )}
              </button>
            </div>
          </div>

          {/* Assets table */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
            {assetsLoading ? (
              <div className="p-12 text-center text-sm" style={{ color: 'var(--argus-muted)' }}>Loading assets…</div>
            ) : !assetsData?.data?.length ? (
              <div className="py-16 px-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--argus-elevated)' }}>
                  <Database size={28} style={{ color: 'var(--argus-dim)' }} />
                </div>
                <h3 className="font-display text-lg font-bold mb-1" style={{ color: 'var(--argus-ink)' }}>No CMDB Assets</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--argus-muted)' }}>This organization has no assets in the CMDB yet.</p>
                <button
                  onClick={() => { setSyncMsg(null); syncAssets.mutate(); }}
                  disabled={syncAssets.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                  style={{ background: 'var(--argus-signal)' }}
                >
                  {syncAssets.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Syncing...</>
                  ) : (
                    <><RefreshCw size={14} /> Sync Assets from K8s Cluster</>
                  )}
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
                    {['Name', 'Type', 'Status', 'IP Address', 'Hostname', 'Updated'].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>{h}</th>
                    ))}
                    <th className="px-5 py-2.5 text-left w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {assetsData.data.map((a: any) => (
                    <tr
                      key={a.id}
                      className="transition-colors cursor-pointer"
                      style={{ borderBottom: '1px solid var(--argus-border)' }}
                      onClick={() => navigate(`/assets/${a.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-5 py-3 font-mono text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>{a.name}</td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={
                          a.type === 'KUBERNETES_CLUSTER' ? { background: 'rgba(79,70,229,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(79,70,229,0.3)' } :
                          a.type === 'SERVER' ? { background: 'rgba(14,165,233,0.15)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.3)' } :
                          { background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }
                        }>
                          {a.type}
                        </span>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={a.status === 'LIVE' ? 'Ready' : a.status === 'MAINTENANCE' ? 'Pending' : a.status} /></td>
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--argus-muted)' }}>{a.ipAddress || '—'}</td>
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--argus-muted)' }}>{a.hostname || '—'}</td>
                      <td className="px-5 py-3 text-[10px] font-mono" style={{ color: 'var(--argus-muted)' }}>
                        {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <ExternalLink size={13} style={{ color: 'var(--argus-dim)' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
