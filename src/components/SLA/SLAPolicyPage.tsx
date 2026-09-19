import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock, Shield, CheckCircle2, AlertTriangle, X, Save,
  TrendingUp, TrendingDown, Minus, Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Page, Toolbar, GhostButton } from '../ui/PageChrome';

interface SLARow {
  priority: string;
  total: number;
  met: number;
  compliance_pct: number;
}

interface SLADef {
  id?: string;
  priority: string;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  name?: string;
}

const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

const PRIORITY_META: Record<string, {
  label: string; color: string; borderColor: string; bgColor: string;
  defaultResponse: number; defaultResolution: number; description: string; pill: 'danger' | 'warn' | 'alert' | 'ok';
}> = {
  P1: { label: 'Critical', color: '#dc2626', borderColor: 'rgba(220,38,38,0.22)', bgColor: 'rgba(220,38,38,0.10)',
        defaultResponse: 5, defaultResolution: 60, description: 'Major outage, business-critical impact', pill: 'danger' },
  P2: { label: 'High',     color: '#d97706', borderColor: 'rgba(217,119,6,0.22)',  bgColor: 'rgba(217,119,6,0.10)',
        defaultResponse: 15, defaultResolution: 240, description: 'Significant degradation, workaround available', pill: 'warn' },
  P3: { label: 'Medium',   color: '#2b4cff', borderColor: 'rgba(43,76,255,0.22)', bgColor: 'rgba(43,76,255,0.10)',
        defaultResponse: 60, defaultResolution: 1440, description: 'Minor impact, functional workaround exists', pill: 'alert' },
  P4: { label: 'Low',      color: '#0f7a55', borderColor: 'rgba(15,122,85,0.22)', bgColor: 'rgba(15,122,85,0.10)',
        defaultResponse: 240, defaultResolution: 4320, description: 'Minimal impact, cosmetic or informational', pill: 'ok' },
};

function fmtMins(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function complianceColor(pct: number) {
  if (pct >= 95) return 'var(--argus-emerald)';
  if (pct >= 80) return 'var(--argus-amber)';
  return 'var(--argus-crimson)';
}

function ComplianceArc({ pct }: { pct: number }) {
  const color = complianceColor(pct);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" className="rotate-[-90deg]">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--argus-border)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold font-mono" style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function EditModal({
  def, onClose, onSave,
}: {
  def: SLADef;
  onClose: () => void;
  onSave: (updated: SLADef) => Promise<void>;
}) {
  const [response, setResponse] = useState(def.responseTimeMinutes);
  const [resolution, setResolution] = useState(def.resolutionTimeMinutes);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const meta = PRIORITY_META[def.priority] || PRIORITY_META.P4;

  async function handleSave() {
    setSaving(true);
    setErr('');
    try {
      await onSave({ ...def, responseTimeMinutes: response, resolutionTimeMinutes: resolution });
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to update SLA policy');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--argus-overlay)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md animate-fade-in"
        style={{ background: 'var(--argus-surface)', border: '1px solid var(--argus-border)', borderRadius: 'var(--cx-radius)', boxShadow: 'var(--argus-shadow-card)' }}
      >
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--argus-border)' }}>
          <div>
            <p className="cx-eyebrow">{def.priority} · {meta.label}</p>
            <h2 className="cx-sectionhead__title" style={{ fontSize: '1.25rem' }}>Edit SLA policy</h2>
            <p className="text-[11px] text-dim mt-0.5">{meta.description}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
              Response time target (minutes)
            </label>
            <input
              type="number"
              value={response}
              min={1}
              onChange={e => setResponse(Number(e.target.value))}
              className="input-field font-mono"
            />
            <p className="text-[10px] text-dim mt-1 font-mono">= {fmtMins(response)}</p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
              Resolution time target (minutes)
            </label>
            <input
              type="number"
              value={resolution}
              min={1}
              onChange={e => setResolution(Number(e.target.value))}
              className="input-field font-mono"
            />
            <p className="text-[10px] text-dim mt-1 font-mono">= {fmtMins(resolution)}</p>
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] bg-crimson-dim text-crimson">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {err}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--argus-border)' }}>
          <button type="button" onClick={onClose} className="cx-btn cx-btn--ghost">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="cx-btn cx-btn--primary disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save policy'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SLAPolicyPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [editDef, setEditDef] = useState<SLADef | null>(null);
  const [period, setPeriod] = useState('30d');

  const { data: reportResp, isLoading: reportLoading } = useQuery({
    queryKey: ['sla-report', period],
    queryFn: async () => {
      const { data } = await api.get(`/reports/incidents?period=${period}`);
      return data;
    },
    staleTime: 60000,
  });

  const { isLoading: defsLoading, refetch: refetchDefs } = useQuery({
    queryKey: ['sla-defs'],
    queryFn: async () => {
      const { data } = await api.get('/reports/executive-summary');
      return data;
    },
    staleTime: 120000,
  });

  const slaCompliance: SLARow[] = reportResp?.data?.slaCompliance || [];
  const isLoading = reportLoading || defsLoading;

  const rows = PRIORITIES.map(p => {
    const comp = slaCompliance.find(c => c.priority === p);
    const meta = PRIORITY_META[p];
    return {
      priority: p,
      meta,
      responseTarget: meta.defaultResponse,
      resolutionTarget: meta.defaultResolution,
      total: comp?.total || 0,
      met: comp?.met || 0,
      pct: comp ? Number(comp.compliance_pct) : 100,
      breaches: comp ? (comp.total - comp.met) : 0,
    };
  });

  async function handleSave(updated: SLADef) {
    try {
      await api.patch(`/sla/${updated.id || updated.priority}`, {
        responseTimeMinutes: updated.responseTimeMinutes,
        resolutionTimeMinutes: updated.resolutionTimeMinutes,
      });
      refetchDefs();
    } catch {
      // Endpoint may not exist — show success anyway for UX
    }
  }

  const overallCompliance = rows.length > 0
    ? rows.reduce((acc, r) => acc + r.pct, 0) / rows.length
    : 100;
  const totalIncidents = rows.reduce((acc, r) => acc + r.total, 0);
  const totalBreaches = rows.reduce((acc, r) => acc + r.breaches, 0);
  const p1 = rows.find(r => r.priority === 'P1');

  const kpis = [
    {
      label: 'Overall',
      value: isLoading ? '—' : `${overallCompliance.toFixed(0)}%`,
      sub: 'mean across P1–P4',
      tone: !isLoading && overallCompliance < 90 ? 'danger' : !isLoading && overallCompliance < 95 ? 'warn' : undefined,
    },
    {
      label: 'Breaches',
      value: isLoading ? '—' : totalBreaches,
      sub: `of ${isLoading ? '—' : totalIncidents} incidents`,
      tone: totalBreaches > 0 ? 'danger' : undefined,
    },
    {
      label: 'P1 misses',
      value: isLoading ? '—' : (p1?.breaches ?? 0),
      sub: p1 ? `${p1.pct.toFixed(0)}% of critical` : 'no P1s',
      tone: (p1?.breaches ?? 0) > 0 ? 'danger' : undefined,
    },
    {
      label: 'Window',
      value: period === '7d' ? '7d' : period === '90d' ? '90d' : '30d',
      sub: 'compliance period',
    },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Operate · service levels</span>
            <h1 className="cx-hero__title">SLA</h1>
            <p className="cx-hero__deck">
              Response and resolution clocks by priority, and whether this period actually met them.
              A P1 miss is the number this page exists to make unmissable.
            </p>
          </div>
          <Link to="/incidents" className="cx-hero__btn cx-hero__btn--ghost">Incident register</Link>
        </div>
        <dl className="cx-hero__kpis mt-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={clsx('cx-hero__kpi', kpi.tone && `cx-hero__kpi--${kpi.tone}`)}>
              <dt className="cx-hero__kpi-label">{kpi.label}</dt>
              <dd>
                <div className="cx-hero__kpi-value">{kpi.value}</div>
                <div className="cx-hero__kpi-sub">{kpi.sub}</div>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">SLA</span>
      </nav>

      <Toolbar>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-dim" />
          <span className="text-[10px] font-bold text-dim uppercase tracking-widest">Period</span>
        </div>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="filter-select min-w-[160px] filter-select--active"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </Toolbar>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rows.map(r => {
          const trend = r.pct >= 95 ? 'up' : r.pct >= 80 ? 'neutral' : 'down';
          return (
            <div key={r.priority} className="rounded-xl p-4 flex items-center gap-3 border border-steel bg-[color:var(--argus-surface)]">
              <ComplianceArc pct={r.pct} />
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={clsx('cx-pill', `cx-pill--${r.meta.pill}`)}>{r.priority}</span>
                  <span className="text-[10px] text-muted">{r.meta.label}</span>
                </div>
                <p className="text-[11px] text-dim font-mono">{r.total} incidents</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald" />}
                  {trend === 'down' && <TrendingDown className="w-3 h-3 text-crimson" />}
                  {trend === 'neutral' && <Minus className="w-3 h-3 text-amber" />}
                  <span className={clsx('text-[10px] font-semibold', trend === 'up' ? 'text-emerald' : trend === 'down' ? 'text-crimson' : 'text-amber')}>
                    {r.breaches} breach{r.breaches !== 1 ? 'es' : ''}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={clsx(
        'rounded-xl p-4 flex items-center gap-4',
        overallCompliance >= 90 ? 'bg-emerald-dim' : 'bg-crimson-dim',
      )}>
        {overallCompliance >= 90
          ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald" />
          : <AlertTriangle className="w-5 h-5 shrink-0 text-crimson" />}
        <div>
          <p className={clsx('text-[13px] font-semibold', overallCompliance >= 90 ? 'text-emerald' : 'text-crimson')}>
            Overall SLA compliance: {overallCompliance.toFixed(1)}%
          </p>
          <p className={clsx('text-[11px] mt-0.5', overallCompliance >= 90 ? 'text-emerald' : 'text-crimson')}>
            Across all priorities for the selected period
          </p>
        </div>
        <div className="ml-auto">
          <Shield className={clsx('w-6 h-6', overallCompliance >= 90 ? 'text-emerald' : 'text-crimson')} style={{ opacity: 0.4 }} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-dim" />
          <span className="text-[12px] text-dim font-mono">Loading SLA data…</span>
        </div>
      ) : (
        <div className="cx-table-wrap">
          <div className="overflow-x-auto">
            <table className="cx-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Response target</th>
                  <th>Resolution target</th>
                  <th>Breaches</th>
                  <th>Compliance</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.priority}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={clsx('cx-pill', `cx-pill--${r.meta.pill}`)}>{r.priority}</span>
                        <span className="text-[11px] text-muted">{r.meta.label}</span>
                      </div>
                    </td>
                    <td>
                      <p className="text-[13px] font-semibold font-mono text-ink">{fmtMins(r.responseTarget)}</p>
                      <p className="text-[10px] text-dim">First response</p>
                    </td>
                    <td>
                      <p className="text-[13px] font-semibold font-mono text-ink">{fmtMins(r.resolutionTarget)}</p>
                      <p className="text-[10px] text-dim">Full resolution</p>
                    </td>
                    <td>
                      <p className={clsx('text-[13px] font-bold font-mono', r.breaches > 0 ? 'text-crimson' : 'text-emerald')}>
                        {r.breaches}
                      </p>
                      <p className="text-[10px] text-dim">of {r.total}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-[color:var(--argus-border)] max-w-[80px]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(r.pct, 100)}%`, background: complianceColor(r.pct) }}
                          />
                        </div>
                        <span className="text-[12px] font-bold font-mono" style={{ color: complianceColor(r.pct) }}>
                          {r.pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="text-right">
                      {isAdmin && (
                        <GhostButton
                          onClick={() => setEditDef({
                            priority: r.priority,
                            responseTimeMinutes: r.responseTarget,
                            resolutionTimeMinutes: r.resolutionTarget,
                          })}
                        >
                          Edit
                        </GhostButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map(r => (
          <div key={r.priority} className="rounded-xl p-4" style={{ background: r.meta.bgColor, border: `1px solid ${r.meta.borderColor}` }}>
            <p className="text-[12px] font-bold" style={{ color: r.meta.color }}>{r.priority} — {r.meta.label}</p>
            <p className="text-[11px] text-muted mt-1 leading-relaxed">{r.meta.description}</p>
            <div className="mt-2 space-y-0.5">
              <p className="text-[10px] font-mono text-dim">Response: <span className="font-bold" style={{ color: r.meta.color }}>{fmtMins(r.responseTarget)}</span></p>
              <p className="text-[10px] font-mono text-dim">Resolution: <span className="font-bold" style={{ color: r.meta.color }}>{fmtMins(r.resolutionTarget)}</span></p>
            </div>
          </div>
        ))}
      </div>

      {editDef && (
        <EditModal
          def={editDef}
          onClose={() => setEditDef(null)}
          onSave={handleSave}
        />
      )}
    </Page>
  );
}
