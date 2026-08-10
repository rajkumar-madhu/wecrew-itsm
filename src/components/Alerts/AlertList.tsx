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
import { Page, PageHeader, KpiRow, KpiCard } from '../ui/PageChrome';

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
    PROMETHEUS: { background: 'rgba(79,70,229,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(79,70,229,0.3)' },
    GRAFANA: { background: 'rgba(217,119,6,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' },
    CUSTOM: { background: 'rgba(124,58,237,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(124,58,237,0.3)' },
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md" style={styles[source]}>
      {source}
    </span>
  );
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const styles: Record<AlertStatus, React.CSSProperties> = {
    FIRING: { background: 'rgba(220,38,38,0.15)', color: 'var(--argus-crimson)', border: '1px solid rgba(220,38,38,0.3)' },
    RESOLVED: { background: 'rgba(5,150,105,0.15)', color: 'var(--argus-emerald)', border: '1px solid rgba(5,150,105,0.3)' },
    ACKNOWLEDGED: { background: 'rgba(217,119,6,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' },
    SILENCED: { background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' },
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
    signal: 'var(--argus-signal)',
    crimson: 'var(--argus-crimson)',
    amber: 'var(--argus-amber)',
    emerald: 'var(--argus-emerald)',
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
    <div className="p-4 rounded-xl transition-all duration-300" style={{ background: 'var(--argus-elevated)', border: `1px solid ${borderColor}` }}>
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-xl" style={{ background: 'var(--argus-elevated)' }}>
          <span style={{ color: iconColor }}><Icon className="w-4 h-4" /></span>
        </div>
        {pulse && <LivePulse color={color} />}
      </div>
      <p className="text-2xl font-display font-bold tracking-tight" style={{ color: 'var(--argus-ink)' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--argus-muted)' }}>{label}</p>
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
    <Page>
      <PageHeader
        icon={Bell}
        title="Alerts"
        subtitle={
          <>
            Real-time monitoring and triage ·{' '}
            <span className="font-mono font-medium text-ink">{alerts.length}</span> total
          </>
        }
      />

      <KpiRow className="!grid-cols-2 sm:!grid-cols-4 lg:!grid-cols-4">
        <KpiCard label="Critical firing" value={stats.criticalFiring} icon={AlertTriangle} tone="danger" pulse />
        <KpiCard label="Warning firing" value={stats.warningFiring} icon={Bell} tone="warn" pulse />
        <KpiCard label="Resolved (24h)" value={stats.resolved24h} icon={CheckCircle} tone="ok" />
        <KpiCard label="Total active" value={stats.totalActive} icon={Shield} tone="info" />
      </KpiRow>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

      {/* ── FILTER BAR ── */}
      <div className="-mt-3 relative z-10 rounded-xl p-3 mb-4" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5" style={{ color: 'var(--argus-muted)' }}>
            <Filter size={13} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">Filters</span>
          </div>

          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as Severity | 'ALL')} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}>
            <option value="ALL" style={{ background: 'var(--argus-surface)' }}>All Severities</option>
            <option value="CRITICAL" style={{ background: 'var(--argus-surface)' }}>Critical</option>
            <option value="WARNING" style={{ background: 'var(--argus-surface)' }}>Warning</option>
            <option value="INFO" style={{ background: 'var(--argus-surface)' }}>Info</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'ALL')} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}>
            <option value="ALL" style={{ background: 'var(--argus-surface)' }}>All Statuses</option>
            <option value="FIRING" style={{ background: 'var(--argus-surface)' }}>Firing</option>
            <option value="RESOLVED" style={{ background: 'var(--argus-surface)' }}>Resolved</option>
            <option value="ACKNOWLEDGED" style={{ background: 'var(--argus-surface)' }}>Acknowledged</option>
            <option value="SILENCED" style={{ background: 'var(--argus-surface)' }}>Silenced</option>
          </select>

          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as AlertSource | 'ALL')} className="rounded-lg text-sm px-3 py-1.5 focus:outline-none" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}>
            <option value="ALL" style={{ background: 'var(--argus-surface)' }}>All Sources</option>
            <option value="PROMETHEUS" style={{ background: 'var(--argus-surface)' }}>Prometheus</option>
            <option value="GRAFANA" style={{ background: 'var(--argus-surface)' }}>Grafana</option>
            <option value="CUSTOM" style={{ background: 'var(--argus-surface)' }}>Custom</option>
          </select>

          <div className="w-px h-7 hidden sm:block" style={{ background: 'var(--argus-elevated)' }} />

          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--argus-muted)' }} />
            <input
              type="text"
              placeholder="Search alerts by name, description, or CI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none transition-all"
              style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {alertsLoading && (
        <div className="rounded-xl p-12 text-center mt-4" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: 'var(--argus-signal)' }} />
          <p className="font-medium" style={{ color: 'var(--argus-muted)' }}>Loading alerts...</p>
        </div>
      )}

      {/* Alert Cards */}
      {!alertsLoading && (
        <div className="space-y-3 mt-4">
          {sortedAlerts.length === 0 && (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <Bell className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--argus-dim)' }} />
              <p className="font-medium" style={{ color: 'var(--argus-muted)' }}>No alerts match your filters</p>
              <p className="text-sm mt-1" style={{ color: 'var(--argus-dim)' }}>Adjust filters or search criteria</p>
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
                          <h3 className="text-sm font-display font-bold truncate" style={{ color: 'var(--argus-ink)' }}>
                            {alert.name}
                          </h3>
                          <StatusBadge status={alert.status} />
                        </div>
                        <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--argus-muted)' }}>
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          <SourceBadge source={alert.source} />
                          <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: 'var(--argus-muted)' }}>
                            <span style={{ color: 'var(--argus-dim)' }}>CI:</span> {alert.ciName}
                          </span>
                          <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: 'var(--argus-muted)' }}>
                            <span style={{ color: 'var(--argus-dim)' }}>Fired:</span> {alert.firedAt}
                          </span>
                          {alert.resolvedAt && (
                            <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: 'var(--argus-emerald)' }}>
                              <span style={{ color: 'var(--argus-dim)' }}>Resolved:</span> {alert.resolvedAt}
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
                            style={{ color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }}
                            title="Acknowledge"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Acknowledge</span>
                          </button>
                          <button
                            onClick={() => handleSilence(alert.id)}
                            disabled={silenceAlert.isPending}
                            className="px-2.5 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50 rounded-lg transition-colors"
                            style={{ color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }}
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
    </Page>
  );
}
