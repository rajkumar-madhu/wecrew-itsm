const { alertIncidentTitle, incidentSubject, appFromLabels, formatIST } = require('../incidentTitle');

it('builds the in-app title with severity, customer, app, host, IP and issue', () => {
  expect(alertIncidentTitle({
    severity: 'CRITICAL', alertName: 'HighCPU', orgName: 'Acme Corp', app: 'payments-api', host: 'web-01', ip: '10.0.0.5',
  })).toBe('[CRITICAL] Acme Corp · payments-api · web-01 (10.0.0.5) — HighCPU');
  expect(alertIncidentTitle({ severity: 'warning', alertName: 'DiskFull', ip: '10.0.0.9' }))
    .toBe('[WARNING] 10.0.0.9 — DiskFull');
  expect(alertIncidentTitle({ alertName: 'x'.repeat(300) })).toHaveLength(200);
});

it('prefers the most specific application label', () => {
  expect(appFromLabels({ job: 'node', app: 'checkout' })).toBe('checkout');
  expect(appFromLabels({ job: 'node-exporter' })).toBe('node-exporter');
  expect(appFromLabels({})).toBe('');
});

it('builds the email subject: priority+severity, customer, app, host, issue, IST time, number', () => {
  const incident = {
    number: 'INC0000123', priority: 'P1', sourceAlertName: 'HighCPU',
    shortDescription: '[CRITICAL] Acme Corp · payments-api · web-01 (10.0.0.5) — HighCPU',
    description: 'Client: Acme Corp (PROD)\nApplication: payments-api\nHostname: web-01\nIP Address: 10.0.0.5',
    organization: { name: 'Acme Corp' },
    createdAt: new Date('2026-09-19T15:35:00Z'),
  };
  expect(incidentSubject(incident, 'Created'))
    .toBe('[P1 CRITICAL] Acme Corp · payments-api · web-01 (10.0.0.5) · HighCPU · 19 Sep 2026, 21:05 IST (INC0000123)');
  expect(incidentSubject(incident, 'Escalated').startsWith('[ESCALATED] [P1 CRITICAL]')).toBe(true);
});

it('falls back sensibly for a manually created incident', () => {
  const s = incidentSubject({ number: 'INC9', priority: 'P2', shortDescription: 'Email down for finance', createdAt: new Date('2026-09-19T04:00:00Z') }, 'Created');
  expect(s).toBe('[P2 MAJOR] WeCrew · Email down for finance · 19 Sep 2026, 09:30 IST (INC9)');
});

it('formats IST', () => {
  expect(formatIST(new Date('2026-01-05T18:45:00Z'))).toBe('06 Jan 2026, 00:15 IST');
});
