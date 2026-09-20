import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { KpiCard, KpiRow, Page, PageHeader, Panel } from '../ui/PageChrome';

/* Shared chrome for the GPRC module pages. The data they render is static
   (src/data/gprc.ts) — there is no GPRC backend yet. */

type Tone = 'default' | 'danger' | 'warn' | 'ok' | 'info';

export interface GprcKpi {
  label: string;
  value: string | number;
  tone?: Tone;
}

export function GprcShell({
  icon,
  title,
  description,
  kpis,
  panelTitle,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  kpis: GprcKpi[];
  panelTitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Page>
      <PageHeader icon={icon} title={title} subtitle={description} />
      <KpiRow>
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} tone={k.tone} />
        ))}
      </KpiRow>
      <Panel title={panelTitle} actions={actions} noPad>
        {children}
      </Panel>
    </Page>
  );
}

const PILL_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'alert' | 'neutral'> = {
  // work status
  Open: 'alert',
  'In progress': 'warn',
  Overdue: 'danger',
  Closed: 'ok',
  Remediated: 'ok',
  Verified: 'ok',
  // ESG / objectives
  'On track': 'ok',
  Watch: 'warn',
  'Off track': 'danger',
  // controls
  Effective: 'ok',
  'Partially effective': 'warn',
  Ineffective: 'danger',
  // resilience tests
  Passed: 'ok',
  'Passed with issues': 'warn',
  Failed: 'danger',
  // severity
  Critical: 'danger',
  High: 'danger',
  Medium: 'warn',
  Low: 'neutral',
};

export function StatusPill({ value }: { value: string }) {
  return <span className={`cx-pill cx-pill--${PILL_TONE[value] ?? 'neutral'}`}>{value}</span>;
}

export function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr>
        {columns.map((c) => <th key={c}>{c}</th>)}
      </tr>
    </thead>
  );
}
