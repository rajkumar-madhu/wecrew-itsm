import { useState, useMemo } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Bell,
  AlertTriangle,
  Shield,
  CheckCircle,
  VolumeX,
  Plus,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import { useAlerts, useAcknowledgeAlert, useSilenceAlert, useCreateIncidentFromAlert, useAlertStats } from '../../hooks/useAlerts';

// ── Types ──

type Severity = 'CRITICAL' | 'WARNING' | 'INFO';
type AlertStatus = 'FIRING' | 'RESOLVED' | 'ACKNOWLEDGED' | 'SILENCED';
type AlertSource = 'PROMETHEUS' | 'GRAFANA' | 'CUSTOM';

interface Alert {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  status: AlertStatus;
  source: AlertSource;
  ciName: string;
  firedAt: string;
  firedAtTs: number;
  resolvedAt?: string;
}

// ── Subcomponents ──

function LivePulse({ color = 'signal' }: { color?: string }) {
  const colorMap: Record<string, string> = {
    signal: 'bg-signal',
    crimson: 'bg-crimson',
    amber: 'bg-amber',
    emerald: 'bg-emerald',
  };
  return (
    <span className="relative flex h-2 w-2">
      <span
        className={clsx(
          'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
          colorMap[color]
        )}
      />
      <span
        className={clsx(
          'relative inline-flex rounded-full h-2 w-2',
          colorMap[color]
        )}
      />
    </span>
  );
}

function SeverityIndicator({ severity }: { severity: Severity }) {
  if (severity === 'CRITICAL') return <LivePulse color="crimson" />;
  if (severity === 'WARNING') {
    return (
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber" />
      </span>
    );
  }
  return (
    <span className="relative flex h-2 w-2">
      <span className="relative inline-flex rounded-full h-2 w-2 bg-signal" />
    </span>
  );
}

function SourceBadge({ source }: { source: AlertSource }) {
  const styles: Record<AlertSource, React.CSSProperties> = {
    PROMETHEUS: { background: 'rgba(79,70,229,0.15)', color: '#A5B4FC', border: '1px solid rgba(79,70,229,0.3)' },
    GRAFANA: { background: 'rgba(217,119,6,0.15)', color: '#FCD34D', border: '1px solid rgba(217,119,6,0.3)' },
    CUSTOM: { background: 'rgba(124,58,237,0.15)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.3)' },
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md" style={styles[source]}>
      {source}
    </span>
  );
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const styles: Record<AlertStatus, React.CSSProperties> = {
    FIRING: { background: 'rgba(220,38,38,0.15)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.3)' },
    RESOLVED: { background: 'rgba(5,150,105,0.15)', color: '#6EE7B7', border: '1px solid rgba(5,150,105,0.3)' },
    ACKNOWLEDGED: { background: 'rgba(217,119,6,0.15)', color: '#FCD34D', border: '1px solid rgba(217,119,6,0.3)' },
    SILENCED: { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' },
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md" style={styles[status]}>
      {status}
    </span>
  );
}

function StatsCard({
  icon: Icon,
  label,
  value,
  color,
  pulse,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  pulse?: boolean;
}) {
  const iconColors: Record<string, string> = {
    signal: '#A5B4FC',
    crimson: '#FCA5A5',
    amber: '#FCD34D',
    emerald: '#6EE7B7',
  };
  const borderColors: Record<string, string> = {
    signal: 'rgba(79,70,229,0.3)',
    crimson: 'rgba(220,38,38,0.3)',
    amber: 'rgba(217,119,6,0.3)',
    emerald: 'rgba(5,150,105,0.3)',
  };
  const iconColor = iconColors[color] || iconColors.signal;
  const borderColor = borderColors[color] || borderColors.signal;

  return (
    <div className="p-4 rounded-xl transition-all duration-300" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }}>
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <span style={{ color: iconColor }}><Icon className="w-4 h-4" /></span>
        </div>
        {pulse && <LivePulse color={color} />}
      </div>
      <p className="text-2xl font-display font-bold tracking-tight" style={{ color: '#E2EEF9' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
    </div>
  );
}

// ── Main Component ──

export default function AlertList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<AlertSource | 'ALL'>('ALL');

  // Build filters for backend query
  const queryFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (severityFilter !== 'ALL') f.severity = severityFilter;
    if (statusFilter !== 'ALL') f.status = statusFilter;
    if (sourceFilter !== 'ALL') f.source = sourceFilter;
    if (searchQuery.trim()) f.search = searchQuery.trim();
    return f;
  }, [severityFilter, statusFilter, sourceFilter, searchQuery]);

  // API hooks
  const { data: alertsResponse, isLoading: alertsLoading } = useAlerts(queryFilters);
  const { data: statsResponse } = useAlertStats();
  const acknowledgeAlert = useAcknowledgeAlert();
  const silenceAlert = useSilenceAlert();
  const createIncident = useCreateIncidentFromAlert();
  const navigate = useNavigate();

  // Extract alerts array from backend response shape: { success, data, pagination }
  const alerts: Alert[] = alertsResponse?.data ?? [];

  // Stats from dedicated endpoint, with safe fallbacks
  const stats = {
    criticalFiring: statsResponse?.data?.criticalFiring ?? 0,
    warningFiring: statsResponse?.data?.warningFiring ?? 0,
    resolved24h: statsResponse?.data?.resolved24h ?? 0,
    totalActive: statsResponse?.data?.totalActive ?? 0,
  };

  // Client-side sort: severity rank (CRITICAL first), then firedAt descending
  const sortedAlerts = useMemo(() => {
    const sorted = [...alerts];
    const sevRank: Record<Severity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    sorted.sort((a, b) => {
      const sevDiff = (sevRank[a.severity] ?? 2) - (sevRank[b.severity] ?? 2);
      if (sevDiff !== 0) return sevDiff;
      return (b.firedAtTs ?? 0) - (a.firedAtTs ?? 0);
    });
    return sorted;
  }, [alerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAlert.mutateAsync(id);
      toast.success('Alert acknowledged');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to acknowledge alert');
    }
  };

  const handleSilence = async (id: string) => {
    try {
      await silenceAlert.mutateAsync(id);
      toast.success('Alert silenced for 60 minutes');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to silence alert');
    }
  };

  const handleCreateIncident = async (id: string) => {
    try {
      const res = await createIncident.mutateAsync(id);
      toast.success('Incident created');
      navigate(`/incidents/${res.data?.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to create incident');
    }
  };

  return (
    <div className="animate-fade-in space-y-0" style={{ background: 'linear-gradient(180deg, #110305 0%, #0A0202 40%, #080808 100%)', minHeight: '100vh', margin: '-1.5rem', padding: '1.5rem' }}>
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #110305 0%, #0A0202 40%, #060606 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #DC2626, transparent)' }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full blur-[80px] -translate-y-1/2 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.35) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full blur-[60px] translate-y-1/2 translate-x-1/4 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.20) 0%, transparent 70%)' }} />
        <div className="relative px-6 pt-6 pb-14">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Bell size={16} className="text-red-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-white tracking-tight">Alert Management</h1>
              </div>
              <p className="text-slate-400 text-sm ml-[42px]">Real-time alert monitoring and triage &middot; <span className="font-mono text-slate-300">{alerts.length}</span> total alerts</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Critical Firing', value: stats.criticalFiring, icon: AlertTriangle, color: 'text-red-400', pulse: true },
              { label: 'Warning Firing', value: stats.warningFiring, icon: Bell, color: 'text-amber-400', pulse: true },
              { label: 'Resolved (24h)', value: stats.resolved24h, icon: CheckCircle, color: 'text-emerald-400', pulse: false },
              { label: 'Total Active', value: stats.totalActive, icon: Shield, color: 'text-indigo-400', pulse: false },
            ].map((s, i) => (
              <div key={s.label} className="bg-white/[0.06] backdrop-blur-sm rounded-xl border border-white/[0.08] p-4 animate-fade-in relative" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className="font-display text-2xl font-extrabold text-white">{s.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center relative">
                    <s.icon size={18} className={s.color} />
                    {s.pulse && s.value > 0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

      {/* ── FILTER BAR ── */}
      <div className="-mt-3 relative z-10 rounded-xl p-3 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Filter size={13} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">Filters</span>
          </div>

          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as Severity | 'ALL')} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2EEF9' }}>
            <option value="ALL" style={{ background: '#0A0202' }}>All Severities</option>
            <option value="CRITICAL" style={{ background: '#0A0202' }}>Critical</option>
            <option value="WARNING" style={{ background: '#0A0202' }}>Warning</option>
            <option value="INFO" style={{ background: '#0A0202' }}>Info</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'ALL')} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2EEF9' }}>
            <option value="ALL" style={{ background: '#0A0202' }}>All Statuses</option>
            <option value="FIRING" style={{ background: '#0A0202' }}>Firing</option>
            <option value="RESOLVED" style={{ background: '#0A0202' }}>Resolved</option>
            <option value="ACKNOWLEDGED" style={{ background: '#0A0202' }}>Acknowledged</option>
            <option value="SILENCED" style={{ background: '#0A0202' }}>Silenced</option>
          </select>

          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as AlertSource | 'ALL')} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2EEF9' }}>
            <option value="ALL" style={{ background: '#0A0202' }}>All Sources</option>
            <option value="PROMETHEUS" style={{ background: '#0A0202' }}>Prometheus</option>
            <option value="GRAFANA" style={{ background: '#0A0202' }}>Grafana</option>
            <option value="CUSTOM" style={{ background: '#0A0202' }}>Custom</option>
          </select>

          <div className="w-px h-7 hidden sm:block" style={{ background: 'rgba(255,255,255,0.1)' }} />

          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <input
              type="text"
              placeholder="Search alerts by name, description, or CI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2EEF9' }}
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {alertsLoading && (
        <div className="rounded-xl p-12 text-center mt-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: '#A5B4FC' }} />
          <p className="font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading alerts...</p>
        </div>
      )}

      {/* Alert Cards */}
      {!alertsLoading && (
        <div className="space-y-3 mt-4">
          {sortedAlerts.length === 0 && (
            <div className="rounded-xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Bell className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <p className="font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>No alerts match your filters</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Adjust filters or search criteria</p>
            </div>
          )}

          {sortedAlerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWarning = alert.severity === 'WARNING';
            const isResolved = alert.status === 'RESOLVED';
            const cardBorder = isCritical ? 'rgba(220,38,38,0.3)' : isWarning ? 'rgba(217,119,6,0.3)' : 'rgba(255,255,255,0.07)';
            const cardBg = isCritical ? 'rgba(220,38,38,0.06)' : isWarning ? 'rgba(217,119,6,0.06)' : 'rgba(255,255,255,0.03)';

            return (
              <div
                key={alert.id}
                className="p-5 rounded-xl transition-all duration-300 group"
                style={{ background: cardBg, border: `1px solid ${cardBorder}`, opacity: isResolved ? 0.7 : 1 }}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1.5 flex-shrink-0">
                    <SeverityIndicator severity={alert.severity} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-display font-bold truncate" style={{ color: '#E2EEF9' }}>
                            {alert.name}
                          </h3>
                          <StatusBadge status={alert.status} />
                        </div>
                        <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          <SourceBadge source={alert.source} />
                          <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.25)' }}>CI:</span> {alert.ciName}
                          </span>
                          <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.25)' }}>Fired:</span> {alert.firedAt}
                          </span>
                          {alert.resolvedAt && (
                            <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: '#6EE7B7' }}>
                              <span style={{ color: 'rgba(255,255,255,0.25)' }}>Resolved:</span> {alert.resolvedAt}
                            </span>
                          )}
                        </div>
                      </div>

                      {!isResolved && (
                        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={acknowledgeAlert.isPending}
                            className="px-2.5 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50 rounded-lg transition-colors"
                            style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                            title="Acknowledge"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Acknowledge</span>
                          </button>
                          <button
                            onClick={() => handleSilence(alert.id)}
                            disabled={silenceAlert.isPending}
                            className="px-2.5 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50 rounded-lg transition-colors"
                            style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                            title="Silence"
                          >
                            <VolumeX className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Silence</span>
                          </button>
                          <button
                            onClick={() => handleCreateIncident(alert.id)}
                            disabled={createIncident.isPending}
                            className="btn-primary px-2.5 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
                            title="Create Incident"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Incident</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
