export type WorkStatus = 'Open' | 'In progress' | 'Overdue' | 'Closed' | 'Remediated' | 'Verified';

export interface RiskRow {
  id: string;
  title: string;
  owner: string;
  likelihood: number;
  impact: number;
  residual: number;
  status: string;
  category: string;
  controls: number;
}

export const RISKS: RiskRow[] = [
  { id: 'RSK-1042', title: 'Third-party cloud outage on trading path', owner: 'Priya N.', likelihood: 4, impact: 5, residual: 16, status: 'In progress', category: 'Operational', controls: 4 },
  { id: 'RSK-1038', title: 'Privileged access not reviewed in 90 days', owner: 'Arjun M.', likelihood: 3, impact: 4, residual: 12, status: 'Open', category: 'IT & Cyber', controls: 3 },
  { id: 'RSK-1021', title: 'SLA miss cascade on a production trading path', owner: 'NOC Lead', likelihood: 3, impact: 5, residual: 15, status: 'In progress', category: 'Operational', controls: 5 },
  { id: 'RSK-1014', title: 'Incomplete vendor due-diligence pack', owner: 'Legal', likelihood: 2, impact: 3, residual: 6, status: 'Open', category: 'Compliance', controls: 2 },
  { id: 'RSK-1007', title: 'Key-person concentration on on-call', owner: 'People Ops', likelihood: 2, impact: 4, residual: 8, status: 'Closed', category: 'People', controls: 2 },
  { id: 'RSK-0991', title: 'ESG data lineage gaps in emissions report', owner: 'Finance', likelihood: 2, impact: 2, residual: 4, status: 'In progress', category: 'ESG', controls: 1 },
];

export const FINDINGS = [
  { id: 'AUD-221', title: 'Change freeze not evidenced for P1 window', engagement: 'Q3 Change audit', owner: 'Internal Audit', due: '28 Sep', status: 'Open', severity: 'High' },
  { id: 'AUD-218', title: 'SoD conflict on release approvers', engagement: 'Q3 Change audit', owner: 'Internal Audit', due: '11 Oct', status: 'Open', severity: 'Medium' },
  { id: 'AUD-210', title: 'Backup restore test skipped last cycle', engagement: 'ITGC', owner: 'SRE', due: '02 Sep', status: 'Remediated', severity: 'High' },
];

export const OBLIGATIONS = [
  { id: 'OBL-01', framework: 'ISO 27001', requirement: 'A.8 Asset management', coverage: 78, owner: 'GRC', nextReview: '04 Oct' },
  { id: 'OBL-02', framework: 'SOC 2', requirement: 'CC6 Logical access', coverage: 91, owner: 'SecOps', nextReview: '12 Oct' },
  { id: 'OBL-03', framework: 'DPDP Act', requirement: 'Purpose limitation', coverage: 72, owner: 'Legal', nextReview: '18 Oct' },
  { id: 'OBL-04', framework: 'SEBI CSCRF', requirement: 'Incident reporting', coverage: 88, owner: 'NOC', nextReview: '30 Sep' },
];

export const OBJECTIVES = [
  { id: 'OBJ-01', name: 'P1 response within 5 minutes', kpi: 'P1 MTTA', target: '5 min', actual: '4.2 min', trend: 'up' as const, owner: 'NOC' },
  { id: 'OBJ-02', name: 'SLA compliance across tenants', kpi: 'SLA hit rate', target: '99%', actual: '98.6%', trend: 'down' as const, owner: 'Ops' },
  { id: 'OBJ-03', name: 'Control testing coverage', kpi: 'Controls tested', target: '95%', actual: '81%', trend: 'up' as const, owner: 'GRC' },
  { id: 'OBJ-04', name: 'Audit finding closure', kpi: 'Closed in 30d', target: '90%', actual: '74%', trend: 'flat' as const, owner: 'Audit' },
];

export const CONTROLS = [
  { id: 'CTL-12', name: '24/7 on-call + escalation', framework: 'ISO 27001 A.5', effectiveness: 'Effective', capas: 0, owner: 'NOC' },
  { id: 'CTL-19', name: 'CAB approval gate', framework: 'ITIL Change', effectiveness: 'Partially effective', capas: 1, owner: 'Change Mgr' },
  { id: 'CTL-08', name: 'SSH key rotation on bastion', framework: 'SOC 2 CC6', effectiveness: 'Ineffective', capas: 1, owner: 'SecOps' },
  { id: 'CTL-31', name: 'Privileged access recertification', framework: 'SOC 2 CC6', effectiveness: 'Effective', capas: 0, owner: 'IAM' },
];

export const CAPAS = [
  { id: 'CAP-019', title: 'Recurring disk-full incidents — CAPA plan', source: 'INC pattern', due: '30 Sep', status: 'In progress' },
  { id: 'CAP-022', title: 'Rotate bastion SSH keys to 60-day cycle', source: 'CTL-08', due: '22 Sep', status: 'Overdue' },
  { id: 'CAP-011', title: 'Evidence pack for P1 freeze windows', source: 'AUD-221', due: '28 Sep', status: 'Open' },
];

export const ESG_ROWS = [
  { id: 'ESG-1', pillar: 'E', metric: 'Scope 1+2 coverage', value: '86%', target: '95%', status: 'Watch' },
  { id: 'ESG-2', pillar: 'S', metric: 'On-call load concentration', value: '2 people', target: '< 4', status: 'On track' },
  { id: 'ESG-3', pillar: 'G', metric: 'Policy attestations', value: '91%', target: '100%', status: 'Watch' },
  { id: 'ESG-4', pillar: 'E', metric: 'Vendor ESG packs', value: '41', target: '60', status: 'Off track' },
];

export const RESILIENCE = [
  { id: 'IBS-1', process: 'Order routing / trading path', rto: '15m', rpo: '0', lastTest: '12 Aug', result: 'Passed' },
  { id: 'IBS-2', process: 'Client incident comms', rto: '30m', rpo: 'n/a', lastTest: '03 Sep', result: 'Passed with issues' },
  { id: 'IBS-3', process: 'Identity / SSO', rto: '1h', rpo: '15m', lastTest: '21 Jul', result: 'Failed' },
  { id: 'IBS-4', process: 'Payments settlement feed', rto: '2h', rpo: '5m', lastTest: '29 Aug', result: 'Passed' },
];

export const TWIN = [
  { id: 'org', label: 'WeCrew / FinSpot', kind: 'Org', links: 3 },
  { id: 'proc-inc', label: 'Incident response', kind: 'Process', links: 3 },
  { id: 'proc-chg', label: 'Change enablement', kind: 'Process', links: 2 },
  { id: 'rsk-outage', label: 'Trading path outage', kind: 'Risk', links: 2 },
  { id: 'ctl-oncall', label: '24/7 on-call + escalation', kind: 'Control', links: 1 },
  { id: 'kpi-sla', label: '99.9% uptime SLA', kind: 'KPI', links: 0 },
  { id: 'pol-itil', label: 'ITIL v4 policy pack', kind: 'Policy', links: 0 },
];

export const GPRC_KPIS = [
  { label: 'Risk assessments', value: 76, hint: 'This quarter' },
  { label: 'Key risk indicators', value: 106, hint: 'Monitored live' },
  { label: 'Open findings', value: 22, hint: 'Audit + controls' },
  { label: 'Overdue actions', value: 2, hint: 'Needs owner' },
];

export const AI_PROMPTS = [
  'Show open audit findings',
  'Suggest a control for this risk',
  'What are our top risks right now?',
];

export function riskScore(likelihood: number, impact: number): number {
  return likelihood * impact;
}

export function heatColor(score: number): string {
  if (score >= 16) return '#DC2626';
  if (score >= 12) return '#EA580C';
  if (score >= 8) return '#FBAE34';
  if (score >= 4) return '#CA8A04';
  return '#0F7A55';
}
