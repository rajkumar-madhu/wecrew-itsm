import { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import {
  Brain,
  CheckCircle,
  Target,
  Lightbulb,
  GitCompare,
  Loader2,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Send,
  Bot,
  User,
  ExternalLink,
  Activity,
  Server,
  Database,
  FileText,
  Zap,
  HardDrive,
  Cpu,
  MemoryStick,
  Shield,
  Clock,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import api from '../../lib/api';
import {
  useClusterHealth,
  useServerAnalysis,
  useDBAnalysis,
  useLogAnalysis,
  useAITips,
} from '../../hooks/useAIAgent';

/* ====================================================================
   SUBCOMPONENTS
   ==================================================================== */

function StatsCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  const c: Record<string, { border: string; icon: string; bg: string }> = {
    signal: { border: 'border-indigo-200', icon: 'text-signal', bg: 'bg-indigo-50' },
    crimson: { border: 'border-red-200', icon: 'text-crimson', bg: 'bg-red-50' },
    amber: { border: 'border-amber-200', icon: 'text-amber', bg: 'bg-amber-50' },
    emerald: { border: 'border-emerald-200', icon: 'text-emerald', bg: 'bg-emerald-50' },
    violet: { border: 'border-violet-200', icon: 'text-violet', bg: 'bg-violet-50' },
  };
  const s = c[color] || c.signal;
  return (
    <div className={clsx('glass-card p-4 transition-all duration-300 hover:border-indigo-200', s.border)}>
      <div className="flex items-start justify-between mb-2">
        <div className={clsx('p-2 rounded-xl', s.bg)}>
          <Icon className={clsx('w-4 h-4', s.icon)} />
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-stone-900 tracking-tight">{value}</p>
      <p className="text-xs text-stone-400 mt-0.5">{label}</p>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 90 ? 'bg-emerald' :
    value >= 75 ? 'bg-signal' :
    value >= 60 ? 'bg-amber' :
    'bg-crimson';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden max-w-[80px]">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={clsx(
        'text-[11px] font-mono font-semibold',
        value >= 90 ? 'text-emerald' :
        value >= 75 ? 'text-signal' :
        value >= 60 ? 'text-amber' :
        'text-crimson'
      )}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function ClassificationStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'accepted' ? 'bg-emerald-50 text-emerald border-emerald-200' :
    status === 'rejected' ? 'bg-red-50 text-crimson border-red-200' :
    'bg-amber-50 text-amber border-amber-200';
  const label =
    status === 'accepted' ? 'Accepted' :
    status === 'rejected' ? 'Rejected' :
    'Pending';
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border', cls)}>
      {label}
    </span>
  );
}

function DonutStat({ accepted, rejected, pending }: { accepted: number; rejected: number; pending: number }) {
  const total = accepted + rejected + pending;
  const acceptedPct = total > 0 ? (accepted / total) * 100 : 0;
  const rejectedPct = total > 0 ? (rejected / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 0;

  const circumference = 2 * Math.PI * 42;
  const acceptedOffset = 0;
  const rejectedOffset = (acceptedPct / 100) * circumference;
  const pendingOffset = ((acceptedPct + rejectedPct) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[120px] h-[120px]">
        <svg className="-rotate-90" width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="42" fill="none" stroke="#E7E5E4" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="42" fill="none" stroke="#059669" strokeWidth="10"
            strokeDasharray={`${(acceptedPct / 100) * circumference} ${circumference}`}
            strokeDashoffset={-acceptedOffset}
            className="transition-all duration-1000"
          />
          <circle
            cx="60" cy="60" r="42" fill="none" stroke="#DC2626" strokeWidth="10"
            strokeDasharray={`${(rejectedPct / 100) * circumference} ${circumference}`}
            strokeDashoffset={-rejectedOffset}
            className="transition-all duration-1000"
          />
          <circle
            cx="60" cy="60" r="42" fill="none" stroke="#D97706" strokeWidth="10"
            strokeDasharray={`${(pendingPct / 100) * circumference} ${circumference}`}
            strokeDashoffset={-pendingOffset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-extrabold font-mono text-emerald">{acceptedPct.toFixed(0)}%</span>
          <span className="text-[9px] font-semibold text-stone-400">Accuracy</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald" />
          <span className="text-stone-500">Accepted ({accepted}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-crimson" />
          <span className="text-stone-500">Rejected ({rejected}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber" />
          <span className="text-stone-500">Pending ({pending}%)</span>
        </div>
      </div>
    </div>
  );
}

function HealthScoreGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 160 : size === 'md' ? 120 : 80;
  const r = size === 'lg' ? 60 : size === 'md' ? 42 : 28;
  const sw = size === 'lg' ? 12 : size === 'md' ? 10 : 6;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626';
  const textColor = score >= 80 ? 'text-emerald' : score >= 50 ? 'text-amber' : 'text-crimson';
  const fontSize = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-lg' : 'text-sm';

  return (
    <div className="relative" style={{ width: dim, height: dim }}>
      <svg className="-rotate-90" width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="#E7E5E4" strokeWidth={sw} />
        <circle
          cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={clsx('font-extrabold font-mono', fontSize, textColor)}>{score}</span>
        <span className="text-[9px] font-semibold text-stone-400">Score</span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === 'critical' ? 'bg-red-50 text-crimson border-red-200' :
    severity === 'warning' ? 'bg-amber-50 text-amber border-amber-200' :
    'bg-blue-50 text-blue-600 border-blue-200';
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border', cls)}>
      {severity}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === 'high' ? 'bg-red-50 text-crimson border-red-200' :
    priority === 'medium' ? 'bg-amber-50 text-amber border-amber-200' :
    'bg-emerald-50 text-emerald border-emerald-200';
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border', cls)}>
      {priority}
    </span>
  );
}

function AgentLoadingState({ label }: { label: string }) {
  return (
    <div className="p-12 text-center">
      <Loader2 className="w-8 h-8 text-signal mx-auto mb-3 animate-spin" />
      <p className="text-stone-500 font-medium text-sm">{label}</p>
    </div>
  );
}

function AgentErrorState({ label }: { label: string }) {
  return (
    <div className="p-12 text-center">
      <AlertTriangle className="w-8 h-8 text-amber mx-auto mb-3" />
      <p className="text-stone-500 font-medium text-sm">{label}</p>
      <p className="text-stone-400 text-xs mt-1">Data source may be unavailable</p>
    </div>
  );
}

/* ====================================================================
   AI AGENT TAB PANELS
   ==================================================================== */

function InfrastructureTab() {
  const { data: clusterRes, isLoading: clusterLoading, isError: clusterError } = useClusterHealth();
  const { data: serverRes, isLoading: serverLoading, isError: serverError } = useServerAnalysis();

  const cluster = clusterRes?.success ? clusterRes.data : null;
  const servers = serverRes?.success ? serverRes.data : null;

  if (clusterLoading && serverLoading) return <AgentLoadingState label="Analyzing infrastructure..." />;

  return (
    <div className="space-y-6">
      {/* Cluster Health */}
      <div className="glass-card overflow-hidden border-stone-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
          <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-signal" />
            K8s Cluster Health
          </span>
          {cluster && (
            <SeverityBadge severity={cluster.health === 'healthy' ? 'info' : cluster.health} />
          )}
        </div>
        {clusterLoading ? <AgentLoadingState label="Loading cluster data..." /> :
         clusterError || !cluster ? <AgentErrorState label="Cluster data unavailable" /> : (
          <div className="p-5">
            <div className="flex items-start gap-6 mb-5">
              <HealthScoreGauge score={cluster.score} />
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                    <p className="text-[10px] text-stone-400 font-mono uppercase">Nodes</p>
                    <p className="text-sm font-bold text-stone-900">{cluster.nodes?.length || 0}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                    <p className="text-[10px] text-stone-400 font-mono uppercase">Targets</p>
                    <p className="text-sm font-bold text-stone-900">{cluster.targets?.activeCount ?? 'N/A'}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                    <p className="text-[10px] text-stone-400 font-mono uppercase">Alerts</p>
                    <p className="text-sm font-bold text-crimson">{cluster.firingAlerts?.length || 0}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                    <p className="text-[10px] text-stone-400 font-mono uppercase">CPU Req</p>
                    <p className="text-sm font-bold text-stone-900">{parseFloat(cluster.cpuRequests || '0').toFixed(1)} cores</p>
                  </div>
                </div>
                {cluster.aiAnalysis && cluster.aiAnalysis !== 'AI analysis unavailable' && (
                  <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                    <p className="text-[10px] font-semibold text-signal uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Brain className="w-3 h-3" /> AI Analysis
                    </p>
                    <p className="text-xs text-stone-700 leading-relaxed">{cluster.aiAnalysis}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pod Phases */}
            {cluster.podPhases?.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Pod Phases</p>
                <div className="flex flex-wrap gap-2">
                  {cluster.podPhases.map((p: any) => (
                    <div key={p.phase} className={clsx(
                      'px-3 py-1.5 rounded-lg border text-xs font-mono',
                      p.phase === 'Running' ? 'bg-emerald-50 border-emerald-200 text-emerald' :
                      p.phase === 'Pending' ? 'bg-amber-50 border-amber-200 text-amber' :
                      p.phase === 'Failed' ? 'bg-red-50 border-red-200 text-crimson' :
                      'bg-stone-50 border-stone-200 text-stone-500'
                    )}>
                      {p.phase}: {p.count}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Namespace CPU */}
            {cluster.namespaces?.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Namespace CPU Usage</p>
                <div className="space-y-2">
                  {cluster.namespaces.slice(0, 6).map((ns: any) => (
                    <div key={ns.namespace} className="flex items-center gap-3">
                      <span className="text-xs text-stone-600 font-mono w-40 truncate">{ns.namespace}</span>
                      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-signal transition-all duration-700" style={{ width: `${Math.min(parseFloat(ns.cpuCores) * 50, 100)}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-stone-500 w-16 text-right">{ns.cpuCores} cores</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Firing Alerts */}
            {cluster.firingAlerts?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Firing Alerts</p>
                <div className="space-y-1.5">
                  {cluster.firingAlerts.slice(0, 5).map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-red-50/50 border border-red-100">
                      <AlertTriangle className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
                      <span className="text-xs text-stone-700 flex-1">{a.name}</span>
                      <SeverityBadge severity={a.severity || 'warning'} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risks & Recommendations */}
            {cluster.risks?.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">AI-Detected Risks</p>
                <div className="space-y-2">
                  {cluster.risks.map((r: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                      <SeverityBadge severity={r.severity} />
                      <div>
                        <p className="text-xs font-medium text-stone-900">{r.title}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5">{r.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Server Analysis */}
      <div className="glass-card overflow-hidden border-stone-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
          <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-violet-500" />
            Server / Node Metrics
          </span>
          {servers && (
            <span className="text-[10px] text-stone-400 font-mono">{servers.servers?.length || 0} servers</span>
          )}
        </div>
        {serverLoading ? <AgentLoadingState label="Loading server metrics..." /> :
         serverError || !servers ? <AgentErrorState label="Server metrics unavailable" /> : (
          <div className="p-5">
            {servers.servers?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {servers.servers.map((srv: any) => (
                  <div key={srv.name} className={clsx(
                    'p-3 rounded-lg border',
                    srv.status === 'critical' ? 'border-red-200 bg-red-50/50' :
                    srv.status === 'warning' ? 'border-amber-200 bg-amber-50/50' :
                    'border-emerald-200 bg-emerald-50/30'
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-stone-900 truncate">{srv.name}</span>
                      <SeverityBadge severity={srv.status === 'healthy' ? 'info' : srv.status} />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-stone-400 flex items-center gap-1"><MemoryStick className="w-3 h-3" /> Memory</span>
                          <span className="font-mono text-stone-600">{parseFloat(srv.memory?.usedPct || '0').toFixed(0)}% of {srv.memory?.totalGB || '?'} GB</span>
                        </div>
                        <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <div className={clsx('h-full rounded-full transition-all duration-700',
                            parseFloat(srv.memory?.usedPct || '0') > 90 ? 'bg-crimson' :
                            parseFloat(srv.memory?.usedPct || '0') > 75 ? 'bg-amber' : 'bg-emerald'
                          )} style={{ width: `${srv.memory?.usedPct || 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-stone-400 flex items-center gap-1"><HardDrive className="w-3 h-3" /> Disk</span>
                          <span className="font-mono text-stone-600">{parseFloat(srv.disk?.usedPct || '0').toFixed(0)}% of {srv.disk?.totalGB || '?'} GB</span>
                        </div>
                        <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <div className={clsx('h-full rounded-full transition-all duration-700',
                            parseFloat(srv.disk?.usedPct || '0') > 90 ? 'bg-crimson' :
                            parseFloat(srv.disk?.usedPct || '0') > 80 ? 'bg-amber' : 'bg-emerald'
                          )} style={{ width: `${srv.disk?.usedPct || 0}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-stone-400 flex items-center gap-1"><Cpu className="w-3 h-3" /> Load (1m)</span>
                        <span className={clsx('font-mono font-semibold',
                          srv.load > 8 ? 'text-crimson' : srv.load > 4 ? 'text-amber' : 'text-emerald'
                        )}>{srv.load?.toFixed(2) || '0'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400 text-center py-4">No server metrics available</p>
            )}

            {servers.aiAnalysis && servers.aiAnalysis !== 'AI analysis unavailable' && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 mb-3">
                <p className="text-[10px] font-semibold text-signal uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Brain className="w-3 h-3" /> AI Analysis
                </p>
                <p className="text-xs text-stone-700 leading-relaxed">{servers.aiAnalysis}</p>
              </div>
            )}

            {servers.tips?.length > 0 && (
              <div className="space-y-1.5">
                {servers.tips.map((tip: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-stone-50 border border-stone-200">
                    <Lightbulb className="w-3.5 h-3.5 text-amber flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-stone-900">{tip.title}</p>
                      <p className="text-[11px] text-stone-500">{tip.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DatabaseTab() {
  const { data: dbRes, isLoading, isError } = useDBAnalysis();
  const db = dbRes?.success ? dbRes.data : null;

  if (isLoading) return <AgentLoadingState label="Analyzing PostgreSQL..." />;
  if (isError || !db) return <AgentErrorState label="Database analysis unavailable" />;

  return (
    <div className="space-y-6">
      {/* DB Health Overview */}
      <div className="glass-card overflow-hidden border-stone-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
          <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-violet-500" />
            PostgreSQL Health
          </span>
          <SeverityBadge severity={db.health === 'healthy' ? 'info' : db.health} />
        </div>
        <div className="p-5">
          <div className="flex items-start gap-6 mb-5">
            <HealthScoreGauge score={db.score} />
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                <p className="text-[10px] text-stone-400 font-mono uppercase">Active Conn</p>
                <p className="text-sm font-bold text-stone-900">{db.connections?.active ?? 'N/A'}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                <p className="text-[10px] text-stone-400 font-mono uppercase">Cache Hit</p>
                <p className="text-sm font-bold text-emerald">{db.connections?.cacheHitRatio ?? 'N/A'}%</p>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                <p className="text-[10px] text-stone-400 font-mono uppercase">DB Size</p>
                <p className="text-sm font-bold text-stone-900">{db.dbSizeMB} MB</p>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                <p className="text-[10px] text-stone-400 font-mono uppercase">TX Committed</p>
                <p className="text-sm font-bold text-stone-900">{(db.connections?.txCommitted || 0).toLocaleString()}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                <p className="text-[10px] text-stone-400 font-mono uppercase">Deadlocks</p>
                <p className={clsx('text-sm font-bold', (db.connections?.deadlocks || 0) > 0 ? 'text-crimson' : 'text-stone-900')}>
                  {db.connections?.deadlocks ?? 0}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                <p className="text-[10px] text-stone-400 font-mono uppercase">Slow Queries</p>
                <p className={clsx('text-sm font-bold', (db.slowQueries?.length || 0) > 0 ? 'text-amber' : 'text-stone-900')}>
                  {db.slowQueries?.length || 0}
                </p>
              </div>
            </div>
          </div>

          {db.aiAnalysis && db.aiAnalysis !== 'AI analysis unavailable' && (
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 mb-4">
              <p className="text-[10px] font-semibold text-signal uppercase tracking-wider mb-1 flex items-center gap-1">
                <Brain className="w-3 h-3" /> AI Analysis
              </p>
              <p className="text-xs text-stone-700 leading-relaxed">{db.aiAnalysis}</p>
            </div>
          )}

          {/* Connection States */}
          {db.connections?.states?.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Connection States</p>
              <div className="flex flex-wrap gap-2">
                {db.connections.states.map((s: any) => (
                  <div key={s.state || 'null'} className="px-3 py-1.5 rounded-lg border bg-stone-50 border-stone-200 text-xs font-mono">
                    <span className="text-stone-500">{s.state || 'null'}:</span>{' '}
                    <span className="font-bold text-stone-900">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Stats */}
      {db.tables?.length > 0 && (
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-signal" />
              Table Statistics
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  {['Table', 'Rows', 'Dead Rows', 'Last Vacuum'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {db.tables.slice(0, 12).map((t: any) => (
                  <tr key={t.table_name} className="border-b border-stone-100 hover:bg-indigo-50/50 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-signal font-semibold">{t.table_name}</td>
                    <td className="px-4 py-2 text-xs text-stone-700 font-mono">{Number(t.row_count).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={clsx('text-xs font-mono', Number(t.dead_rows) > 10000 ? 'text-crimson font-bold' : Number(t.dead_rows) > 1000 ? 'text-amber' : 'text-stone-500')}>
                        {Number(t.dead_rows).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[11px] text-stone-400 font-mono">
                      {t.last_autovacuum ? new Date(t.last_autovacuum).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slow Queries */}
      {db.slowQueries?.length > 0 && (
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-crimson" />
              Slow Queries ({'>'}10s)
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {db.slowQueries.map((q: any) => (
              <div key={q.pid} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-stone-400">PID {q.pid}</span>
                  <span className="text-[10px] font-mono text-crimson font-bold">{q.duration_seconds}s</span>
                  <span className="text-[10px] font-mono text-stone-400">{q.state}</span>
                </div>
                <p className="text-xs text-stone-600 font-mono break-all">{q.query}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config Tips */}
      {db.configTips?.length > 0 && (
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber" />
              AI Config Recommendations
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {db.configTips.map((tip: any, i: number) => (
              <div key={i} className="px-5 py-3">
                <p className="text-xs font-medium text-stone-900 mb-0.5">{tip.title}</p>
                <p className="text-[11px] text-stone-500">{tip.action}</p>
                {tip.impact && <p className="text-[10px] text-emerald font-mono mt-1">Impact: {tip.impact}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {db.issues?.length > 0 && (
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-crimson" />
              Detected Issues
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {db.issues.map((issue: any, i: number) => (
              <div key={i} className="px-5 py-3 flex items-start gap-2">
                <SeverityBadge severity={issue.severity} />
                <div>
                  <p className="text-xs font-medium text-stone-900">{issue.title}</p>
                  <p className="text-[11px] text-stone-500">{issue.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LogsTab() {
  const { data: logRes, isLoading, isError } = useLogAnalysis();
  const logs = logRes?.success ? logRes.data : null;

  if (isLoading) return <AgentLoadingState label="Analyzing log patterns..." />;
  if (isError || !logs) return <AgentErrorState label="Log analysis unavailable" />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 border-red-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-red-50"><AlertTriangle className="w-3.5 h-3.5 text-crimson" /></div>
            <span className="text-[10px] text-stone-400 font-mono uppercase">Errors (1h)</span>
          </div>
          <p className="text-2xl font-display font-bold text-crimson">{logs.errorCount}</p>
        </div>
        <div className="glass-card p-4 border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-amber-50"><AlertTriangle className="w-3.5 h-3.5 text-amber" /></div>
            <span className="text-[10px] text-stone-400 font-mono uppercase">Warnings (1h)</span>
          </div>
          <p className="text-2xl font-display font-bold text-amber">{logs.warnCount}</p>
        </div>
        <div className="glass-card p-4 border-stone-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-indigo-50"><FileText className="w-3.5 h-3.5 text-signal" /></div>
            <span className="text-[10px] text-stone-400 font-mono uppercase">Patterns</span>
          </div>
          <p className="text-2xl font-display font-bold text-stone-900">{logs.patterns?.length || 0}</p>
        </div>
      </div>

      {/* AI Analysis */}
      {logs.aiAnalysis && logs.aiAnalysis !== 'AI analysis unavailable' && (
        <div className="glass-card p-5 border-indigo-200 bg-indigo-50/30">
          <p className="text-[10px] font-semibold text-signal uppercase tracking-wider mb-2 flex items-center gap-1">
            <Brain className="w-3 h-3" /> AI Log Analysis
          </p>
          <p className="text-xs text-stone-700 leading-relaxed">{logs.aiAnalysis}</p>
        </div>
      )}

      {/* Error Patterns */}
      {logs.patterns?.length > 0 && (
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-crimson" />
              Error Patterns
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {logs.patterns.slice(0, 10).map((p: any, i: number) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <SeverityBadge severity={p.severity === 'error' ? 'critical' : 'warning'} />
                  <span className="text-xs font-mono font-bold text-stone-900">{p.count}x</span>
                </div>
                <p className="text-xs text-stone-600 font-mono break-all leading-relaxed">{p.sample}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Issues */}
      {logs.issues?.length > 0 && (
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber" />
              AI-Detected Issues
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {logs.issues.map((issue: any, i: number) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={issue.severity} />
                  <span className="text-xs font-medium text-stone-900">{issue.title}</span>
                </div>
                <p className="text-[11px] text-stone-500 mb-1">{issue.description}</p>
                {issue.suggestedFix && (
                  <p className="text-[11px] text-emerald font-mono">Fix: {issue.suggestedFix}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {logs.tips?.length > 0 && (
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber" />
              Recommendations
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {logs.tips.map((tip: any, i: number) => (
              <div key={i} className="px-5 py-3 flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-stone-900">{tip.title}</p>
                  <p className="text-[11px] text-stone-500">{tip.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TipsTab() {
  const { data: tipsRes, isLoading, isError } = useAITips();
  const tips = tipsRes?.success ? tipsRes.data : null;

  if (isLoading) return <AgentLoadingState label="Correlating all data sources..." />;
  if (isError || !tips) return <AgentErrorState label="Tips analysis unavailable" />;

  return (
    <div className="space-y-6">
      {/* Overall Health */}
      <div className="glass-card overflow-hidden border-stone-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
          <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-signal" />
            Overall Infrastructure Health
          </span>
          <span className="text-[10px] text-stone-400 font-mono">
            Updated {new Date(tips.lastUpdated).toLocaleTimeString()}
          </span>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-8 mb-5">
            <HealthScoreGauge score={tips.overallScore} size="lg" />
            <div className="flex-1">
              <p className={clsx('text-lg font-display font-bold mb-1',
                tips.status === 'healthy' ? 'text-emerald' : tips.status === 'warning' ? 'text-amber' : 'text-crimson'
              )}>
                {tips.status === 'healthy' ? 'All Systems Healthy' : tips.status === 'warning' ? 'Some Issues Detected' : 'Critical Issues Found'}
              </p>

              {/* Data Sources */}
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(tips.sources || {}).map(([key, val]: [string, any]) => (
                  <div key={key} className={clsx(
                    'px-2.5 py-1 rounded-md border text-[10px] font-mono',
                    val.available ? 'bg-emerald-50 border-emerald-200 text-emerald' : 'bg-stone-50 border-stone-200 text-stone-400'
                  )}>
                    {key}: {val.available ? 'OK' : 'N/A'}
                    {val.count !== undefined && ` (${val.count})`}
                    {val.p1p2Count !== undefined && ` (${val.p1p2Count} P1/P2)`}
                  </div>
                ))}
              </div>

              {tips.correlations && (
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                  <p className="text-[10px] font-semibold text-signal uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Brain className="w-3 h-3" /> Cross-Source Correlations
                  </p>
                  <p className="text-xs text-stone-700 leading-relaxed">{tips.correlations}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Two-column: Issues + Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issues */}
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-crimson" />
              Top Issues
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {(tips.issues || []).length > 0 ? tips.issues.map((issue: any, i: number) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={issue.severity} />
                  <span className={clsx(
                    'text-[10px] font-mono px-1.5 py-0.5 rounded',
                    issue.source === 'cluster' ? 'bg-indigo-50 text-signal' :
                    issue.source === 'database' ? 'bg-violet-50 text-violet-600' :
                    issue.source === 'logs' ? 'bg-amber-50 text-amber' :
                    'bg-stone-50 text-stone-500'
                  )}>
                    {issue.source}
                  </span>
                </div>
                <p className="text-xs font-medium text-stone-900">{issue.title}</p>
                <p className="text-[11px] text-stone-500 mt-0.5">{issue.description}</p>
              </div>
            )) : (
              <div className="p-5 text-center text-sm text-stone-400">No issues detected</div>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber" />
              Actionable Tips
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {(tips.tips || []).length > 0 ? tips.tips.map((tip: any, i: number) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <PriorityBadge priority={tip.priority} />
                </div>
                <p className="text-xs font-medium text-stone-900">{tip.title}</p>
                <p className="text-[11px] text-stone-500 mt-0.5">{tip.action}</p>
                {tip.impact && <p className="text-[10px] text-emerald font-mono mt-1">Impact: {tip.impact}</p>}
              </div>
            )) : (
              <div className="p-5 text-center text-sm text-stone-400">No tips at this time</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   MAIN COMPONENT
   ==================================================================== */

type AgentTab = 'infrastructure' | 'database' | 'logs' | 'tips';

export default function AIInsightsDashboard() {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'assistant'; text: string; timestamp: string }[]>([]);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [agentTab, setAgentTab] = useState<AgentTab>('tips');

  // ── API Queries ──

  const { data: statsResponse, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['ai-stats'],
    queryFn: async () => {
      const { data } = await api.get('/ai/stats');
      return data;
    },
    retry: 1,
    staleTime: 60_000,
  });

  const { data: classificationsResponse, isLoading: classificationsLoading, isError: classificationsError } = useQuery({
    queryKey: ['ai-classifications'],
    queryFn: async () => {
      const { data } = await api.get('/ai/classifications');
      return data;
    },
    retry: 1,
    staleTime: 60_000,
  });

  const { data: suggestionsResponse, isLoading: suggestionsLoading, isError: suggestionsError } = useQuery({
    queryKey: ['ai-suggestions'],
    queryFn: async () => {
      const { data } = await api.get('/ai/suggestions');
      return data;
    },
    retry: 1,
    staleTime: 60_000,
  });

  // Resolve data: use API if available, otherwise empty defaults
  const stats = statsResponse?.success ? statsResponse.data : { incidentsClassified: 0, avgConfidence: 0, resolutionsSuggested: 0, similarMatches: 0 };
  const classifications = classificationsResponse?.success
    ? classificationsResponse.data
    : [];
  const suggestions = suggestionsResponse?.success
    ? suggestionsResponse.data
    : [];

  const accuracy = statsResponse?.success && statsResponse.data?.accuracy
    ? statsResponse.data.accuracy
    : { accepted: 0, rejected: 0, pending: 0 };

  const topCategories = statsResponse?.success && statsResponse.data?.topCategories
    ? statsResponse.data.topCategories
    : [];

  const models = statsResponse?.success && statsResponse.data?.models
    ? statsResponse.data.models
    : [];

  const maxCategoryCount = Math.max(...topCategories.map((c: { count: number }) => c.count), 1);

  // ── Chat handler ──

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsSending(true);

    try {
      const { data } = await api.post('/ai/chat', { message: text });
      const reply = data?.data?.reply || data?.data?.message || 'I analyzed the request but could not generate a detailed response. Please try rephrasing your question.';
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant' as const,
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant' as const,
          text: 'AI service is currently unavailable. The Ollama models may be loading or the AI backend is not connected. Please try again shortly.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  // ── Vote handler (local-only for now) ──

  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | null>>({});

  const handleVote = (suggestionId: string, direction: 'up' | 'down') => {
    setVotes((prev) => ({
      ...prev,
      [suggestionId]: prev[suggestionId] === direction ? null : direction,
    }));
  };

  const isAnyLoading = statsLoading || classificationsLoading || suggestionsLoading;

  const agentTabs: { key: AgentTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'tips', label: 'Tips & Health', icon: Zap },
    { key: 'infrastructure', label: 'Infrastructure', icon: Server },
    { key: 'database', label: 'Database', icon: Database },
    { key: 'logs', label: 'Logs', icon: FileText },
  ];

  return (
    <div className="animate-fade-in space-y-0">

      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0F172A] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Brain size={16} className="text-violet-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-white tracking-tight">AI Insights</h1>
                <span className="text-[9px] font-mono font-bold text-violet-300 bg-violet-500/15 px-1.5 py-0.5 rounded border border-violet-400/20">AI</span>
              </div>
              <p className="text-slate-400 text-sm ml-[42px]">
                AI-powered analysis and recommendations
              </p>
            </div>
            <div className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
              'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
            )}>
              <Activity className="w-3.5 h-3.5" />
              <span className="font-mono">AI Engine: Online</span>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-violet-500/60 to-transparent -mt-5 mb-4" />

      {/* ── KPI Row (4 cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="flex items-start justify-between mb-2">
                <div className="w-8 h-8 bg-stone-200 rounded-xl" />
              </div>
              <div className="h-7 w-20 bg-stone-200 rounded mt-1" />
              <div className="h-4 w-28 bg-stone-100 rounded mt-2" />
            </div>
          ))
        ) : (
          <>
            <StatsCard
              icon={CheckCircle}
              label="Incidents Classified"
              value={stats.incidentsClassified?.toLocaleString() ?? '0'}
              color="signal"
            />
            <StatsCard
              icon={Target}
              label="Avg Confidence"
              value={`${stats.avgConfidence?.toFixed(1) ?? '0'}%`}
              color="emerald"
            />
            <StatsCard
              icon={Lightbulb}
              label="Resolutions Suggested"
              value={stats.resolutionsSuggested?.toLocaleString() ?? '0'}
              color="violet"
            />
            <StatsCard
              icon={GitCompare}
              label="Similar Matches"
              value={stats.similarMatches?.toLocaleString() ?? '0'}
              color="amber"
            />
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          AI AGENT — Live Infrastructure Intelligence
          ══════════════════════════════════════════════════════ */}
      <div className="glass-card overflow-hidden border-indigo-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-gradient-to-r from-indigo-50/80 to-violet-50/50">
          <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-signal" />
            AI Agent — Live Infrastructure Intelligence
          </span>
          <span className="text-[10px] text-signal font-mono flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Auto-refresh
          </span>
        </div>

        {/* Agent Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50/50">
          {agentTabs.map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              onClick={() => setAgentTab(key)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2',
                agentTab === key
                  ? 'border-signal text-signal bg-white'
                  : 'border-transparent text-stone-400 hover:text-stone-600 hover:bg-white/50'
              )}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {agentTab === 'infrastructure' && <InfrastructureTab />}
          {agentTab === 'database' && <DatabaseTab />}
          {agentTab === 'logs' && <LogsTab />}
          {agentTab === 'tips' && <TipsTab />}
        </div>
      </div>

      {/* ── Main Grid: LEFT (2/3) + RIGHT (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">

        {/* LEFT COLUMN */}
        <div className="space-y-6">

          {/* AI Classification Activity */}
          <div className="glass-card overflow-hidden border-stone-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
              <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
                <Brain className="w-4 h-4 text-signal" />
                AI Classification Activity
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                {classifications.length} recent
              </span>
            </div>

            {classificationsLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 text-signal mx-auto mb-3 animate-spin" />
                <p className="text-stone-500 font-medium text-sm">Loading classifications...</p>
              </div>
            ) : classifications.length === 0 ? (
              <p className="text-sm text-stone-400 py-6 text-center">No data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200">
                      {['Incident', 'Category', 'Confidence', 'Status'].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2.5 text-[10px] font-semibold tracking-wider text-stone-400 uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classifications.map((item: any) => (
                      <tr
                        key={item.id}
                        className="border-b border-stone-100 hover:bg-indigo-50/50 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs font-semibold text-signal">
                            {item.incidentNumber}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div>
                            <span className="text-xs font-medium text-stone-900">{item.category}</span>
                            {item.subcategory && (
                              <span className="text-[10px] text-stone-400 ml-1.5">/ {item.subcategory}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <ConfidenceBar value={item.confidence} />
                        </td>
                        <td className="px-4 py-2.5">
                          <ClassificationStatusBadge status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resolution Suggestions */}
          <div className="glass-card overflow-hidden border-stone-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
              <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-violet-500" />
                Resolution Suggestions
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                AI-generated root cause analysis
              </span>
            </div>

            {suggestionsLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 text-signal mx-auto mb-3 animate-spin" />
                <p className="text-stone-500 font-medium text-sm">Loading suggestions...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-stone-400 py-6 text-center">No data available</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {suggestions.map((item: any) => (
                  <div
                    key={item.id}
                    className="px-5 py-4 hover:bg-indigo-50/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="font-mono text-xs font-semibold text-signal flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {item.incidentNumber}
                          </span>
                          <span className="text-xs font-medium text-stone-900 truncate">
                            {item.title}
                          </span>
                        </div>

                        <div className="mb-2">
                          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">
                            Root Cause
                          </p>
                          <p className="text-xs text-stone-600 leading-relaxed">
                            {item.rootCause}
                          </p>
                        </div>

                        <div className="mb-2">
                          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">
                            Suggested Action
                          </p>
                          <p className="text-xs text-stone-600 leading-relaxed">
                            {item.suggestedAction}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 mt-2">
                          <ConfidenceBar value={item.confidence} />
                          <span className="text-[10px] text-stone-400">confidence</span>
                        </div>
                      </div>

                      {/* Vote buttons */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                        <button
                          onClick={() => handleVote(item.id, 'up')}
                          className={clsx(
                            'p-1.5 rounded-lg border transition-all',
                            votes[item.id] === 'up'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald'
                              : 'border-stone-200 text-stone-400 hover:border-emerald-200 hover:text-emerald hover:bg-emerald-50'
                          )}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-stone-400">
                          {(item.votes?.up ?? 0) + (votes[item.id] === 'up' ? 1 : 0)}
                        </span>
                        <button
                          onClick={() => handleVote(item.id, 'down')}
                          className={clsx(
                            'p-1.5 rounded-lg border transition-all',
                            votes[item.id] === 'down'
                              ? 'border-red-300 bg-red-50 text-crimson'
                              : 'border-stone-200 text-stone-400 hover:border-red-200 hover:text-crimson hover:bg-red-50'
                          )}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-stone-400">
                          {(item.votes?.down ?? 0) + (votes[item.id] === 'down' ? 1 : 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">

          {/* Classification Accuracy */}
          <div className="glass-card overflow-hidden border-stone-200">
            <div className="px-5 py-3.5 border-b border-stone-200">
              <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald" />
                Classification Accuracy
              </span>
            </div>
            <div className="px-5 py-5">
              <DonutStat
                accepted={accuracy.accepted}
                rejected={accuracy.rejected}
                pending={accuracy.pending}
              />
            </div>
          </div>

          {/* Top Categories */}
          <div className="glass-card overflow-hidden border-stone-200">
            <div className="px-5 py-3.5 border-b border-stone-200">
              <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-signal" />
                Top AI Categories
              </span>
            </div>
            <div className="px-5 py-4 space-y-3">
              {topCategories.length === 0 ? (
                <p className="text-sm text-stone-400 py-6 text-center">No data available</p>
              ) : (
                topCategories.map((cat: any, idx: number) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="w-3 text-[10px] font-mono text-stone-400 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-stone-900 truncate">{cat.category}</span>
                        <span className="text-[11px] font-mono font-semibold text-stone-500">{cat.count}</span>
                      </div>
                      <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-all duration-700', cat.color)}
                          style={{ width: `${(cat.count / maxCategoryCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Model Status */}
          <div className="glass-card overflow-hidden border-stone-200">
            <div className="px-5 py-3.5 border-b border-stone-200">
              <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
                <Bot className="w-4 h-4 text-violet-500" />
                AI Model Status
              </span>
            </div>
            <div className="px-5 py-4 space-y-3">
              {models.length === 0 ? (
                <p className="text-sm text-stone-400 py-6 text-center">No data available</p>
              ) : (
                models.map((model: any) => {
                  const isOnline = model.status === 'online' || model.status === 'active';
                  return (
                  <div
                    key={model.name}
                    className={clsx(
                      'p-3 rounded-lg border transition-all',
                      isOnline
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-red-200 bg-red-50/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-display font-bold text-stone-900">{model.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={clsx(
                            'w-2 h-2 rounded-full',
                            isOnline ? 'bg-emerald animate-pulse' : 'bg-crimson'
                          )}
                        />
                        <span
                          className={clsx(
                            'text-[10px] font-mono font-semibold',
                            isOnline ? 'text-emerald' : 'text-crimson'
                          )}
                        >
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-stone-400 mb-2">{model.purpose}</p>
                    <div className="flex items-center gap-3 text-[10px] text-stone-500 font-mono">
                      <span>{model.gpu}</span>
                      <span className="text-stone-300">|</span>
                      <span>{model.vram}</span>
                      <span className="text-stone-300">|</span>
                      <span>{model.latency} avg</span>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: AI Chat ── */}
      <div className="glass-card overflow-hidden border-stone-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
          <span className="text-[13px] font-bold text-stone-900 flex items-center gap-2">
            <Brain className="w-4 h-4 text-signal" />
            AI Assistant
          </span>
          <span className="text-[10px] text-emerald font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
            Online
          </span>
        </div>

        {/* Chat messages */}
        <div className="px-5 py-4 max-h-[360px] overflow-y-auto space-y-3">
          {chatMessages.length === 0 && !isSending && (
            <p className="text-sm text-stone-400 py-6 text-center">No data available</p>
          )}
          {chatMessages.slice(-6).map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'flex gap-3',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                    <Brain className="w-3.5 h-3.5 text-signal" />
                  </div>
                </div>
              )}
              <div
                className={clsx(
                  'max-w-[80%] rounded-xl px-4 py-2.5',
                  msg.role === 'user'
                    ? 'bg-signal text-white'
                    : 'bg-stone-50 border border-stone-200 text-stone-700'
                )}
              >
                <p className={clsx(
                  'text-xs leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user' ? 'text-white' : 'text-stone-700'
                )}>
                  {msg.text}
                </p>
                <p className={clsx(
                  'text-[9px] mt-1.5 font-mono',
                  msg.role === 'user' ? 'text-indigo-200' : 'text-stone-400'
                )}>
                  {msg.timestamp}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-7 h-7 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-stone-500" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 mt-1">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <Brain className="w-3.5 h-3.5 text-signal" />
                </div>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-signal animate-spin" />
                  <span className="text-xs text-stone-400">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50/50">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI about incidents..."
              disabled={isSending}
              className="input-field flex-1 text-sm py-2 disabled:opacity-50"
            />
            <button
              onClick={handleSendChat}
              disabled={isSending || !chatInput.trim()}
              className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-3 text-stone-400 text-[11px]">
        AI Insights powered by OpenAI GPT-4o — AI Agent correlates Prometheus, PostgreSQL, Loki & ITSM data
        <br />
        <span className="font-mono text-[10px]">Models auto-classify incidents, suggest resolutions, and detect infrastructure patterns</span>
      </div>
    </div>
  );
}
