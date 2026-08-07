import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, ExternalLink, Clock, Server, Database, Layers, Box } from 'lucide-react';
import { clsx } from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Component { id: string; name: string; type: string; status: string; firingCount: number; }
interface Incident { id: string; number: string; title: string; priority: string; state: string; createdAt: string; durationMinutes: number; }
interface DayHistory { date: string; status: string; criticalCount: number; warningCount: number; totalAlerts: number; }
interface StatusData {
  org: { name: string; slug: string; fqdn: string | null; environment: string };
  overallStatus: string;
  uptimePercent: string;
  components: Component[];
  activeIncidents: Incident[];
  dayHistory: DayHistory[];
  lastUpdated: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  operational:  { label: 'Operational',         color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  degraded:     { label: 'Partial Outage',       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  down:         { label: 'Service Disruption',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  maintenance:  { label: 'Under Maintenance',    color: '#6366F1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)' },
  outage:       { label: 'Outage',               color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
};

const OVERALL_CONFIG = {
  operational: {
    label: 'All Systems Operational',
    sub: 'All services are running normally.',
    color: '#10B981',
    bg: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
    pulse: '#10B981',
  },
  degraded: {
    label: 'Partial Service Disruption',
    sub: 'Some services are experiencing issues.',
    color: '#F59E0B',
    bg: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)',
    pulse: '#F59E0B',
  },
  major_outage: {
    label: 'Major Service Outage',
    sub: 'Critical services are currently unavailable.',
    color: '#EF4444',
    bg: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)',
    pulse: '#EF4444',
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  P1: '#EF4444', P2: '#F97316', P3: '#F59E0B', P4: '#6366F1',
};

const TYPE_ICON: Record<string, any> = {
  APPLICATION: Box, DATABASE: Database, K8S_CLUSTER: Layers, SERVER: Server,
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

// ── Uptime Bar Tooltip ────────────────────────────────────────────────────────
function UptimeBar({ day }: { day: DayHistory }) {
  const [hovered, setHovered] = useState(false);
  const cfg = STATUS_CONFIG[day.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.operational;
  const dateLabel = new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div className="relative flex-1" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div
        className="h-8 rounded-sm cursor-default transition-opacity hover:opacity-80"
        style={{ backgroundColor: cfg.color }}
      />
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap
          bg-[#0F172A] border border-[#334155] text-xs text-[#E2E8F0] px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none">
          <div className="font-semibold">{dateLabel}</div>
          <div style={{ color: cfg.color }}>{cfg.label}</div>
          {day.totalAlerts > 0 && (
            <div className="text-[#94A3B8]">{day.criticalCount} critical · {day.warningCount} warning</div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#334155]" />
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function StatusPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIn, setRefreshIn] = useState(60);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/v1/status/${orgSlug}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setData(json.data);
      setRefreshIn(60);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshIn((prev) => {
        if (prev <= 1) { fetchStatus(); return 60; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#030711' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin" />
        <p className="text-[#64748B] text-sm font-mono">Loading status...</p>
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#030711' }}>
      <div className="text-center">
        <XCircle className="w-12 h-12 text-[#EF4444] mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Status Page Not Found</h1>
        <p className="text-[#64748B] text-sm mb-6">{error || `No status page for "${orgSlug}"`}</p>
        <Link to="/" className="text-[#6366F1] text-sm hover:underline">← Back to WeCrew</Link>
      </div>
    </div>
  );

  const overall = OVERALL_CONFIG[data.overallStatus as keyof typeof OVERALL_CONFIG] || OVERALL_CONFIG.operational;

  return (
    <div className="min-h-screen" style={{ background: '#030711', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Top nav ── */}
      <header style={{ borderBottom: '1px solid #1E293B', background: '#0F172A' }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#A5B4FC' }}>
              ◆
            </div>
            <div>
              <span className="font-bold text-white text-sm">{data.org.name}</span>
              <span className="text-[#475569] text-xs ml-2">Status</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-[#475569] hidden sm:block">
              Refreshes in {refreshIn}s
            </span>
            <button
              onClick={fetchStatus}
              className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#94A3B8] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <Link to="/login" className="text-xs text-[#6366F1] hover:underline flex items-center gap-1">
              Sign in <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* ── Overall status hero ── */}
        <div className="rounded-2xl p-8 text-center relative overflow-hidden" style={{ background: overall.bg }}>
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative">
            {/* Pulse dot */}
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="w-5 h-5 rounded-full" style={{ background: overall.pulse }} />
                {data.overallStatus === 'operational' && (
                  <div className="absolute inset-0 rounded-full animate-ping" style={{ background: overall.pulse, opacity: 0.4 }} />
                )}
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{overall.label}</h1>
            <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.7)' }}>{overall.sub}</p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
              {data.uptimePercent}% uptime · last 30 days
            </div>
          </div>
        </div>

        {/* ── Active incidents (only if any) ── */}
        {data.activeIncidents.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-[#94A3B8] uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              Active Incidents
            </h2>
            <div className="space-y-3">
              {data.activeIncidents.map((inc) => (
                <div key={inc.id} className="rounded-xl p-4" style={{ background: '#1E293B', border: '1px solid #334155', borderLeft: `3px solid ${PRIORITY_COLORS[inc.priority] || '#6366F1'}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold font-mono" style={{ color: PRIORITY_COLORS[inc.priority] || '#6366F1' }}>
                          {inc.priority}
                        </span>
                        <span className="text-xs text-[#475569] font-mono">{inc.number}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                          style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }}>
                          {inc.state.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-white truncate">{inc.title}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-[#64748B] text-xs">
                        <Clock className="w-3 h-3" />
                        {formatDuration(inc.durationMinutes)}
                      </div>
                      <div className="text-[10px] text-[#475569] mt-0.5">{relativeTime(inc.createdAt)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Component status ── */}
        {data.components.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-[#94A3B8] uppercase tracking-wider mb-3">
              Services &amp; Components
            </h2>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E293B' }}>
              {data.components.map((comp, idx) => {
                const cfg = STATUS_CONFIG[comp.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.operational;
                const Icon = TYPE_ICON[comp.type] || Box;
                return (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between px-5 py-4"
                    style={{
                      background: idx % 2 === 0 ? '#0F172A' : '#111827',
                      borderBottom: idx < data.components.length - 1 ? '1px solid #1E293B' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#475569' }} />
                      <div>
                        <span className="text-sm font-medium text-[#E2E8F0]">{comp.name}</span>
                        <span className="text-[10px] text-[#475569] ml-2">{comp.type.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {comp.firingCount > 0 && (
                        <span className="text-[10px] font-mono text-[#64748B]">{comp.firingCount} alert{comp.firingCount !== 1 ? 's' : ''}</span>
                      )}
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No components message */}
        {data.components.length === 0 && (
          <div className="rounded-xl p-8 text-center" style={{ background: '#1E293B', border: '1px solid #334155' }}>
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#10B981' }} />
            <p className="text-sm text-[#94A3B8]">All systems healthy. No components configured for display.</p>
          </div>
        )}

        {/* ── 30-day uptime history ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#94A3B8] uppercase tracking-wider">30-Day History</h2>
            <span className="text-xs text-[#10B981] font-semibold">{data.uptimePercent}% uptime</span>
          </div>

          <div className="rounded-xl p-4" style={{ background: '#1E293B', border: '1px solid #334155' }}>
            <div className="flex items-end gap-0.5">
              {data.dayHistory.map((day) => (
                <UptimeBar key={day.date} day={day} />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-[#475569]">30 days ago</span>
              <div className="flex items-center gap-4 text-[10px] text-[#475569]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#10B981' }} />Operational</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#F59E0B' }} />Degraded</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#EF4444' }} />Outage</span>
              </div>
              <span className="text-[10px] text-[#475569]">Today</span>
            </div>
          </div>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="text-center py-8 px-6" style={{ borderTop: '1px solid #1E293B' }}>
        <p className="text-[#475569] text-xs">
          Last updated {relativeTime(data.lastUpdated)} &nbsp;·&nbsp;
          Powered by{' '}
          <Link to="/" className="text-[#6366F1] hover:underline">WeCrew ITSM</Link>
          {data.org.fqdn && (
            <>
              {' '}·{' '}
              <a href={`https://${data.org.fqdn}`} target="_blank" rel="noopener noreferrer" className="text-[#6366F1] hover:underline">
                {data.org.fqdn}
              </a>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
