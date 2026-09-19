import { Link } from 'react-router-dom';
import { Shield, Sparkles } from 'lucide-react';
import { AI_PROMPTS, FINDINGS, GPRC_KPIS, RISKS, heatColor, riskScore } from '../../data/gprc';
import { KpiCard, KpiRow, Page, PageHeader, Panel } from '../ui/PageChrome';
import { StatusPill, TableHead } from './gprcUi';

/* GPRC overview, ported from argus-itsm/frontend-react onto the Sovereign
   PageChrome. Static demo data — see src/data/gprc.ts. */

const MODULES = [
  { to: '/risk', t: 'Enterprise Risk', d: 'Heatmap and residual register' },
  { to: '/compliance', t: 'Compliance', d: 'Obligations, evidence, coverage' },
  { to: '/internal-audit', t: 'Internal Audit', d: 'Findings into CAPA' },
  { to: '/performance', t: 'Strategy & KPIs', d: 'OKRs on the same objects' },
  { to: '/controls', t: 'Controls & CAPA', d: 'Library and remediation' },
  { to: '/esg', t: 'ESG', d: 'Metrics next to performance' },
  { to: '/resilience', t: 'Resilience', d: 'IBS, RTO/RPO, tests' },
  { to: '/digital-twin', t: 'Digital Twin', d: 'Governed enterprise model' },
];

function Heatmap() {
  const cells: { l: number; i: number; n: number }[] = [];
  for (let impact = 5; impact >= 1; impact--) {
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const n = RISKS.filter((r) => r.likelihood === likelihood && r.impact === impact).length;
      cells.push({ l: likelihood, i: impact, n });
    }
  }

  return (
    <div className="flex items-end justify-center gap-3">
      <span className="text-[10px] text-dim font-mono uppercase tracking-wider" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
        Impact
      </span>
      <div className="flex-1 max-w-[300px]">
        <div className="grid grid-cols-5 gap-1">
          {cells.map((c) => (
            <div
              key={`${c.l}-${c.i}`}
              className="aspect-square rounded-md flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ background: heatColor(riskScore(c.l, c.i)), opacity: c.n ? 1 : 0.3 }}
              title={`Likelihood ${c.l} × Impact ${c.i}`}
            >
              {c.n || ''}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-dim font-mono uppercase tracking-wider">
          <span>Rare</span>
          <span>Likelihood</span>
          <span>Almost certain</span>
        </div>
      </div>
    </div>
  );
}

export default function GprcCommandCenter() {
  return (
    <Page>
      <PageHeader
        icon={Shield}
        title="GPRC overview"
        subtitle="Unify governance, performance, risk, and compliance on the same objects as your operations."
      />
      <KpiRow>
        {GPRC_KPIS.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} tone={k.label === 'Overdue actions' ? 'danger' : 'default'} />
        ))}
      </KpiRow>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to} className="cx-panel px-4 py-3.5 hover:shadow-card-hover transition-shadow">
            <p className="font-medium text-ink">{m.t}</p>
            <p className="text-[12px] text-muted mt-1">{m.d}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel
          className="lg:col-span-2"
          title="Risk heatmap"
          actions={<Link to="/risk" className="text-[12px] text-signal hover:underline">Open register</Link>}
        >
          <Heatmap />
        </Panel>

        <section className="cx-hero lg:col-span-3 !p-6">
          <p className="cx-eyebrow">AI in every workflow</p>
          <h2 className="cx-hero__title">Context-aware insights on your digital twin</h2>
          <div className="mt-5 flex flex-col items-start gap-2">
            {AI_PROMPTS.map((p) => (
              <Link key={p} to="/ai-insights" className="cx-hero__btn">
                <Sparkles size={13} /> {p}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="Top residual risks"
          actions={<Link to="/risk" className="text-[12px] text-signal hover:underline">View all</Link>}
          noPad
        >
          <table className="cx-table">
            <TableHead columns={['Risk', 'Owner', 'Score', 'Status']} />
            <tbody>
              {RISKS.slice(0, 5).map((r) => (
                <tr key={r.id}>
                  <td>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-[11px] text-dim">{r.id} · {r.category}</p>
                  </td>
                  <td className="text-muted">{r.owner}</td>
                  <td className="font-mono font-semibold" style={{ color: heatColor(r.residual) }}>{r.residual}</td>
                  <td><StatusPill value={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Open audit findings"
          actions={<Link to="/internal-audit" className="text-[12px] text-signal hover:underline">Internal audit</Link>}
          noPad
        >
          <table className="cx-table">
            <TableHead columns={['Finding', 'Severity', 'Due']} />
            <tbody>
              {FINDINGS.filter((f) => f.status !== 'Remediated').map((f) => (
                <tr key={f.id}>
                  <td>
                    <p className="font-medium">{f.title}</p>
                    <p className="text-[11px] text-dim">{f.id} · {f.engagement}</p>
                  </td>
                  <td><StatusPill value={f.severity} /></td>
                  <td className="font-mono text-[12px]">{f.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </Page>
  );
}
