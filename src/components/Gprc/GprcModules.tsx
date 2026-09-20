import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, FileSearch, GitMerge, Globe, Search, Waypoints,
} from 'lucide-react';
import {
  CAPAS, CONTROLS, ESG_ROWS, FINDINGS, OBJECTIVES, OBLIGATIONS, RESILIENCE, RISKS, TWIN, heatColor,
} from '../../data/gprc';
import { GprcShell, StatusPill, TableHead } from './gprcUi';

/* GPRC module pages, ported from argus-itsm/frontend-react onto the Sovereign
   PageChrome (cx-*) vocabulary. Static demo data — see src/data/gprc.ts. */

export function RiskRegister() {
  const [q, setQ] = useState('');
  const rows = useMemo(
    () => RISKS.filter((r) => `${r.id} ${r.title} ${r.category} ${r.owner}`.toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  return (
    <GprcShell
      icon={AlertTriangle}
      title="Risk register"
      description="Identify, score, and treat enterprise risks against strategy, operations, cyber, and third parties."
      kpis={[
        { label: 'Risks', value: RISKS.length },
        { label: 'Open', value: RISKS.filter((r) => r.status === 'Open').length, tone: 'warn' },
        { label: 'Avg residual', value: Math.round(RISKS.reduce((a, r) => a + r.residual, 0) / RISKS.length) },
        { label: 'Critical band', value: RISKS.filter((r) => r.residual >= 12).length, tone: 'danger' },
      ]}
      panelTitle="Residual risk register"
      actions={(
        <label className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search risks…" className="input-field !pl-7 !py-1 text-[12px] w-56" />
        </label>
      )}
    >
      <table className="cx-table">
        <TableHead columns={['ID', 'Risk', 'Owner', 'L × I', 'Residual', 'Controls', 'Status']} />
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-mono text-[12px] text-muted">{r.id}</td>
              <td>
                <p className="font-medium">{r.title}</p>
                <p className="text-[11px] text-dim">{r.category}</p>
              </td>
              <td>{r.owner}</td>
              <td className="font-mono">{r.likelihood} × {r.impact}</td>
              <td className="font-mono font-semibold" style={{ color: heatColor(r.residual) }}>{r.residual}</td>
              <td className="font-mono">{r.controls}</td>
              <td><StatusPill value={r.status} /></td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="text-center text-dim py-6">No risks match “{q}”.</td></tr>
          )}
        </tbody>
      </table>
    </GprcShell>
  );
}

export function ComplianceCenter() {
  return (
    <GprcShell
      icon={CheckCircle2}
      title="Obligations & frameworks"
      description="Map ISO, SOC 2, GDPR/DPDP, and regulator obligations to owners, evidence, and coverage."
      kpis={[
        { label: 'Frameworks', value: OBLIGATIONS.length },
        { label: 'Avg coverage', value: `${Math.round(OBLIGATIONS.reduce((a, o) => a + o.coverage, 0) / OBLIGATIONS.length)}%` },
        { label: 'Below 80%', value: OBLIGATIONS.filter((o) => o.coverage < 80).length, tone: 'warn' },
        { label: 'Next review', value: 'Oct' },
      ]}
      panelTitle="Obligation coverage"
    >
      <table className="cx-table">
        <TableHead columns={['Framework', 'Requirement', 'Coverage', 'Owner', 'Next review']} />
        <tbody>
          {OBLIGATIONS.map((o) => (
            <tr key={o.id}>
              <td className="font-medium">{o.framework}</td>
              <td>{o.requirement}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 bg-steel rounded-full overflow-hidden">
                    <div className={o.coverage < 80 ? 'h-full bg-amber' : 'h-full bg-signal'} style={{ width: `${o.coverage}%` }} />
                  </div>
                  <span className="font-mono text-[12px]">{o.coverage}%</span>
                </div>
              </td>
              <td>{o.owner}</td>
              <td className="text-muted">{o.nextReview}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </GprcShell>
  );
}

export function InternalAudit() {
  return (
    <GprcShell
      icon={FileSearch}
      title="Engagements & findings"
      description="Plan audits, track findings, and close the loop into controls and CAPA."
      kpis={[
        { label: 'Findings', value: FINDINGS.length },
        { label: 'Critical / high', value: FINDINGS.filter((f) => f.severity === 'Critical' || f.severity === 'High').length, tone: 'danger' },
        { label: 'Open', value: FINDINGS.filter((f) => f.status === 'Open').length, tone: 'warn' },
        { label: 'Remediated', value: FINDINGS.filter((f) => f.status === 'Remediated').length, tone: 'ok' },
      ]}
      panelTitle="Audit findings"
    >
      <table className="cx-table">
        <TableHead columns={['ID', 'Finding', 'Engagement', 'Severity', 'Owner', 'Due', 'Status']} />
        <tbody>
          {FINDINGS.map((f) => (
            <tr key={f.id}>
              <td className="font-mono text-[12px] text-muted">{f.id}</td>
              <td className="font-medium">{f.title}</td>
              <td>{f.engagement}</td>
              <td><StatusPill value={f.severity} /></td>
              <td>{f.owner}</td>
              <td className="font-mono text-[12px]">{f.due}</td>
              <td><StatusPill value={f.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </GprcShell>
  );
}

const TREND = { up: '↑', down: '↓', flat: '→' } as const;

export function PerformanceManagement() {
  return (
    <GprcShell
      icon={BarChart3}
      title="Objectives and KPIs"
      description="Connect strategy to operational KPIs so leadership sees the same picture in real time."
      kpis={[
        { label: 'Objectives', value: OBJECTIVES.length },
        { label: 'On target', value: 2, tone: 'ok' },
        { label: 'Watch', value: 2, tone: 'warn' },
        { label: 'Cycle', value: 'Q3' },
      ]}
      panelTitle="Objectives"
    >
      <table className="cx-table">
        <TableHead columns={['Objective', 'KPI', 'Target', 'Actual', 'Trend', 'Owner']} />
        <tbody>
          {OBJECTIVES.map((o) => (
            <tr key={o.id}>
              <td className="font-medium">{o.name}</td>
              <td>{o.kpi}</td>
              <td className="font-mono">{o.target}</td>
              <td className="font-mono">{o.actual}</td>
              <td className={o.trend === 'down' ? 'text-crimson' : o.trend === 'up' ? 'text-emerald' : 'text-muted'}>{TREND[o.trend]}</td>
              <td>{o.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </GprcShell>
  );
}

export function ControlsCapa() {
  return (
    <GprcShell
      icon={GitMerge}
      title="Controls & CAPA"
      description="Test controls, record effectiveness, and drive corrective and preventive actions."
      kpis={[
        { label: 'Controls', value: CONTROLS.length },
        { label: 'Effective', value: CONTROLS.filter((c) => c.effectiveness === 'Effective').length, tone: 'ok' },
        { label: 'Open CAPA', value: CAPAS.filter((c) => c.status !== 'Verified').length, tone: 'warn' },
        { label: 'Ineffective', value: CONTROLS.filter((c) => c.effectiveness === 'Ineffective').length, tone: 'danger' },
      ]}
      panelTitle="Control library and corrective actions"
    >
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-steel">
        <table className="cx-table">
          <TableHead columns={['Control', 'Framework', 'Effectiveness', 'CAPA']} />
          <tbody>
            {CONTROLS.map((c) => (
              <tr key={c.id}>
                <td>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-[11px] text-dim">{c.id} · {c.owner}</p>
                </td>
                <td>{c.framework}</td>
                <td><StatusPill value={c.effectiveness} /></td>
                <td className="font-mono">{c.capas}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="cx-table">
          <TableHead columns={['CAPA', 'Source', 'Due', 'Status']} />
          <tbody>
            {CAPAS.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.title}</td>
                <td className="font-mono text-[12px]">{c.source}</td>
                <td className="font-mono text-[12px]">{c.due}</td>
                <td><StatusPill value={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GprcShell>
  );
}

export function EsgHub() {
  return (
    <GprcShell
      icon={Globe}
      title="Environmental, social, governance"
      description="Track ESG metrics alongside risk and performance so disclosures stay tied to operations."
      kpis={[
        { label: 'Metrics', value: ESG_ROWS.length },
        { label: 'On track', value: ESG_ROWS.filter((e) => e.status === 'On track').length, tone: 'ok' },
        { label: 'Watch', value: ESG_ROWS.filter((e) => e.status === 'Watch').length, tone: 'warn' },
        { label: 'Off track', value: ESG_ROWS.filter((e) => e.status === 'Off track').length, tone: 'danger' },
      ]}
      panelTitle="ESG metrics"
    >
      <table className="cx-table">
        <TableHead columns={['Pillar', 'Metric', 'Value', 'Target', 'Status']} />
        <tbody>
          {ESG_ROWS.map((e) => (
            <tr key={e.id}>
              <td className="font-mono">{e.pillar}</td>
              <td className="font-medium">{e.metric}</td>
              <td className="font-mono">{e.value}</td>
              <td className="font-mono">{e.target}</td>
              <td><StatusPill value={e.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </GprcShell>
  );
}

export function OperationalResilience() {
  return (
    <GprcShell
      icon={Activity}
      title="Important business services"
      description="RTO/RPO, last test, and continuity results for services the enterprise cannot fail."
      kpis={[
        { label: 'Services', value: RESILIENCE.length },
        { label: 'Passed', value: RESILIENCE.filter((r) => r.result === 'Passed').length, tone: 'ok' },
        { label: 'Failed', value: RESILIENCE.filter((r) => r.result === 'Failed').length, tone: 'danger' },
        { label: 'Issues', value: RESILIENCE.filter((r) => r.result.includes('issues')).length, tone: 'warn' },
      ]}
      panelTitle="Continuity tests"
    >
      <table className="cx-table">
        <TableHead columns={['Process', 'RTO', 'RPO', 'Last test', 'Result']} />
        <tbody>
          {RESILIENCE.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.process}</td>
              <td className="font-mono">{r.rto}</td>
              <td className="font-mono">{r.rpo}</td>
              <td className="font-mono text-[12px]">{r.lastTest}</td>
              <td><StatusPill value={r.result} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </GprcShell>
  );
}

const KIND_PILL: Record<string, string> = {
  Org: 'cx-pill--neutral',
  Process: 'cx-pill--neutral',
  Risk: 'cx-pill--danger',
  Control: 'cx-pill--ok',
  KPI: 'cx-pill--warn',
  Policy: 'cx-pill--alert',
};

export function DigitalTwin() {
  return (
    <GprcShell
      icon={Waypoints}
      title="Enterprise model"
      description="Strategy, processes, risks, controls, KPIs, and policies in one governed graph — the context AI uses to answer."
      kpis={[
        { label: 'Objects', value: TWIN.length },
        { label: 'Processes', value: TWIN.filter((n) => n.kind === 'Process').length },
        { label: 'Controls', value: TWIN.filter((n) => n.kind === 'Control').length },
        { label: 'Linked', value: TWIN.filter((n) => n.links > 0).length },
      ]}
      panelTitle="Digital twin objects"
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
        {TWIN.map((n) => (
          <div key={n.id} className="border border-steel rounded-xl p-4 bg-obsidian">
            <span className={`cx-pill ${KIND_PILL[n.kind] ?? 'cx-pill--neutral'}`}>{n.kind}</span>
            <p className="mt-2 font-medium text-ink">{n.label}</p>
            <p className="mt-1 text-[12px] text-dim">{n.links} related objects</p>
          </div>
        ))}
      </div>
    </GprcShell>
  );
}
