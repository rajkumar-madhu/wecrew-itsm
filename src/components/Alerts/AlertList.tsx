import { useState, useMemo } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Bell,
  Shield,
  VolumeX,
  Plus,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import { useAlerts, useAcknowledgeAlert, useSilenceAlert, useCreateIncidentFromAlert, useAlertStats } from '../../hooks/useAlerts';
import { Page, Toolbar, EnterpriseHero, EnterprisePosture } from '../ui/PageChrome';

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

// ── Main Component ──

interface AlertStatGroup { severity?: string; status?: string; _count?: number | Record<string, number> }
interface AlertStatsResponse { total?: number; firing?: number; bySeverity?: AlertStatGroup[]; byStatus?: AlertStatGroup[] }
interface AlertKpi { label: string; value: number; sub: string; tone?: 'danger' | 'warn' | '' }

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

  /* Stats from /alerts/stats. The endpoint returns
       { total, firing, bySeverity: [{severity,_count}], byStatus: [{status,_count}] }
     — it does NOT return criticalFiring / warningFiring / resolved24h / totalActive.
     Reading those names with `?? 0` fallbacks rendered every tile as a permanent zero,
     which on an alerts console reads as "nothing is wrong". Derive from the real shape. */
  const stats = useMemo(() => {
    const d = statsResponse?.data as AlertStatsResponse | undefined;
    const countOf = (rows: AlertStatGroup[] | undefined, key: string, field: 'severity' | 'status') => {
      const row = (rows ?? []).find((r) => r[field] === key);
      if (!row) return 0;
      return typeof row._count === 'number' ? row._count : Number(Object.values(row._count ?? {})[0]) || 0;
    };
    return {
      total: d?.total ?? 0,
      firing: d?.firing ?? 0,
      critical: countOf(d?.bySeverity, 'CRITICAL', 'severity'),
      warning: countOf(d?.bySeverity, 'WARNING', 'severity'),
      resolved: countOf(d?.byStatus, 'RESOLVED', 'status'),
      acknowledged: countOf(d?.byStatus, 'ACKNOWLEDGED', 'status'),
    };
  }, [statsResponse]);

  /* Hoisted out of JSX: an inline array literal created during render aliases the
     memoized stats, which makes React Compiler skip optimizing this component. */
  const heroKpis = useMemo<AlertKpi[]>(
    () => [
      { label: 'Firing', value: stats.firing, sub: 'not yet resolved', tone: stats.firing > 0 ? 'danger' : undefined },
      { label: 'Critical', value: stats.critical, sub: 'critical severity', tone: stats.critical > 0 ? 'danger' : undefined },
      { label: 'Warning', value: stats.warning, sub: 'warning severity', tone: stats.warning > 0 ? 'warn' : undefined },
      { label: 'Acknowledged', value: stats.acknowledged, sub: 'being worked' },
      { label: 'Resolved', value: stats.resolved, sub: `of ${stats.total} total` },
    ],
    [stats]
  );

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
      <EnterpriseHero
        plane="observe"
        domain="alerts"
        title="Alerts"
        deck="Org-scoped real-time monitoring and triage. Firing alerts here are the evidence that becomes incidents."
        kpiCols={5}
        kpis={heroKpis}
      />
      <EnterprisePosture chips={['Org-scoped signals', 'Evidence before page', 'Audit export ready']} />

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Alerts</span>
      </nav>

      <Toolbar>
        <div className="flex items-center gap-1.5 text-muted">
          <Filter size={13} />
          <span className="text-[10px] font-semibold uppercase tracking-widest">Filters</span>
        </div>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as Severity | 'ALL')} className="filter-select">
          <option value="ALL">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'ALL')} className="filter-select">
          <option value="ALL">All statuses</option>
          <option value="FIRING">Firing</option>
          <option value="RESOLVED">Resolved</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="SILENCED">Silenced</option>
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as AlertSource | 'ALL')} className="filter-select">
          <option value="ALL">All sources</option>
          <option value="PROMETHEUS">Prometheus</option>
          <option value="GRAFANA">Grafana</option>
          <option value="CUSTOM">Custom</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            placeholder="Search alerts by name, description, or CI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-8 py-1.5 text-[13px]"
          />
        </div>
      </Toolbar>

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
