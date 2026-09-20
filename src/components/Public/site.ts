/*
  Public marketing site — shared content.

  Everything a non-engineer is likely to want to change lives here so the page
  components stay layout-only. Nothing in this file is fetched from the API;
  the public site renders without a backend (the lead form is the only part
  that talks to one — see src/hooks/usePublicLead.ts).
*/

/** Cal.com booking handle used by the Pilot page embed — `cal.com/<calLink>`. */
export const CAL_LINK = 'wecrew/pilot';

/** Cal.com embed namespace. Arbitrary, but must be stable across renders. */
export const CAL_NAMESPACE = 'pilot';

/** Length of the pilot, in days. Referenced in copy across several pages. */
export const PILOT_DAYS = 15;

/**
 * Company details for the Contact page and footer.
 *
 * Blank fields are intentionally omitted from the rendered page rather than
 * shown empty — fill them in rather than shipping a placeholder address.
 */
export interface CompanyDetails {
  name: string;
  product: string;
  tagline: string;
  /** Sales & general enquiries — also the lead-form fallback and Billing's "Contact sales". */
  email: string;
  /** Existing-customer support. */
  supportEmail: string;
  website: string;
  /** Optional — rendered only when non-empty. Typed `string`, not the literal
   *  '', so filling one in here does not narrow it to `never` at the use site. */
  phone: string;
  addressLines: string[];
  registration: string;
  hours: string;
}

export const COMPANY: CompanyDetails = {
  name: 'WeCrew',
  product: 'WeCrew ITSM',
  tagline:
    'Enterprise multi-tenant IT service management — incidents, changes, CMDB, and observability-grade response in one platform.',
  email: 'info@wecrew.in',
  supportEmail: 'support@wecrew.in',
  website: 'https://wecrew.in',
  phone: '+91 93630 72077',
  addressLines: [],
  registration: '',
  hours: 'Monday–Friday, 09:00–18:00 IST',
};

/** `footerOnly`: listed in the footer but not the header (the header already has a CTA for it). */
export type NavItem = { label: string; to: string; footerOnly?: boolean };

export const NAV: NavItem[] = [
  { label: 'Platform', to: '/itsm' },
  { label: 'Modules', to: '/modules' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Security', to: '/security' },
  { label: 'Docs', to: '/docs' },
  { label: 'Pilot', to: '/pilot', footerOnly: true },
  { label: 'Contact', to: '/contact' },
];

/**
 * Public pricing. Must match the backend's seeded Plan rows
 * (backend scripts/seed-plans.js): amounts there are paise, here rupees.
 * Do not add tax wording until GST treatment is decided.
 */
export type PricingTier = {
  key: 'TRIAL' | 'STARTER' | 'ENTERPRISE';
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  cta: { label: string; to?: string; href?: string };
  highlight?: boolean;
};

export const PRICING: PricingTier[] = [
  {
    key: 'TRIAL',
    name: 'Trial',
    price: 'Free',
    period: '20 days',
    blurb: 'Full product on your own incidents. No card required.',
    features: ['Up to 10 agent seats', 'Unlimited viewers', 'Every core ITSM module', 'Read-only access to your data after it ends'],
    cta: { label: 'Book a pilot', to: '/pilot' },
  },
  {
    key: 'STARTER',
    name: 'Starter',
    price: '₹30,000',
    period: 'per year',
    blurb: 'For one team running incidents, changes and on-call in production.',
    features: ['10 agent seats', 'Unlimited viewers', 'Incidents, changes, problems, CMDB, alerts', 'On-call, escalation and SLA policies', 'Billed yearly through Razorpay'],
    cta: { label: 'Sign in to upgrade', to: '/login' },
    highlight: true,
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'Custom',
    period: 'annual agreement',
    blurb: 'Multi-tenant estates, custom seat counts and commercial terms.',
    features: ['Custom agent seats', 'Multiple organizations under one control plane', 'Self-hosted in your cluster', 'Named support contact'],
    cta: { label: 'Contact sales', href: 'mailto:info@wecrew.in?subject=WeCrew%20ITSM%20Enterprise' },
  },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: 'What counts as a seat?',
    a: 'An active user who can create or change records — admins, managers, engineers and operators. Viewers are free and unlimited.',
  },
  {
    q: 'What happens when the trial ends?',
    a: 'Nothing is deleted. Your organization becomes read-only until you subscribe, so you can still see every incident and export what you need.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes. Cancelling stops the next renewal; you keep full access until the end of the paid year.',
  },
  {
    q: 'Do you offer a pilot?',
    a: 'Yes — a scoped pilot on your own incidents before any commitment. Book one from the Pilot page.',
  },
];

export type ModuleStatus = 'available' | 'contact';

export type ModuleCard = {
  key: string;
  name: string;
  summary: string;
  status: ModuleStatus;
  points: string[];
};

/**
 * Module availability. `available` renders an "Available now" pill and links to
 * the pilot; `contact` renders "Contact us" and links to the contact page.
 */
export const MODULES: ModuleCard[] = [
  {
    key: 'alertmind',
    name: 'AlertMind',
    summary:
      'Alert correlation and noise reduction across monitoring estates. Groups related signals into one incident so responders read a situation, not a stream.',
    status: 'available',
    points: [
      'Correlates alerts across sources into a single incident',
      'Suppresses duplicates and flapping during maintenance windows',
      'Routes on severity, service ownership, and escalation policy',
    ],
  },
  {
    key: 'aegis',
    name: 'AEGIS',
    summary:
      'Incident intelligence on the record — timeline summary, blast radius, similar incidents, and draft stakeholder updates with evidence attached.',
    status: 'available',
    points: [
      'Timeline summary and likely blast radius from the CMDB',
      'Similar-incident recall with the resolution that worked last time',
      'Draft updates for status pages and stakeholder communications',
    ],
  },
  {
    key: 'jobwatch',
    name: 'JobWatch',
    summary:
      'Scheduled-workload operations for CronJobs, batch, and critical jobs — missed, late, and failed runs with owner and SLA context.',
    status: 'available',
    points: [
      'Detect missed, late, and failed job executions',
      'Map jobs to services, owners, and escalation paths',
      'Feed exceptions into the same incident workflow as alerts',
    ],
  },
  {
    key: 'agentos',
    name: 'AgentOS',
    summary:
      'Governed automation that proposes remediation and executes only what a human approves, with the full run on the audit trail.',
    status: 'contact',
    points: [
      'Runbook steps proposed with the evidence that triggered them',
      'Approval gate before anything touches a production system',
      'Every run written with actor, timestamp, and outcome',
    ],
  },
];

/** Platform pillars — Datadog-style product depth + ServiceNow-style ITSM breadth. */
export const PLATFORM_PILLARS = [
  {
    key: 'observe',
    title: 'Observe',
    body: 'Alerts, metrics, JobWatch events, and deployment signals land in one intake plane with correlation before anyone is paged.',
  },
  {
    key: 'respond',
    title: 'Respond',
    body: 'Incidents, major incidents, and on-call escalation with ownership, SLA clocks, and evidence-first updates.',
  },
  {
    key: 'govern',
    title: 'Govern',
    body: 'Changes, problems, known errors, and approvals with CAB-ready context and an audit trail you can hand over.',
  },
  {
    key: 'serve',
    title: 'Serve',
    body: 'Request catalog, knowledge, and fulfillment so requesters and agents share one system of record.',
  },
] as const;

/** Multi-tenant enterprise capabilities called out on the home page. */
export const TENANCY_POINTS = [
  {
    title: 'Organization isolation',
    body: 'Every ticket, asset, and audit event is scoped to an organization. Platform staff can operate across tenants; customer users — their own admins included — stay inside their estate.',
  },
  {
    title: 'Role-based control',
    body: 'ADMIN, MANAGER, ENGINEER, OPERATOR, and VIEWER roles gate queues, approvals, and restricted records — not just navigation.',
  },
  {
    title: 'Shared platform, private data',
    body: 'One control plane for platform operators; per-tenant configuration, connectors, and retention for each customer or business unit.',
  },
] as const;

/** WeCrew ITSM capability blocks — the /itsm page. */
export const ITSM_CAPABILITIES = [
  {
    key: 'incidents',
    name: 'Incidents',
    body: 'Intake, triage, ownership and resolution in one record. Priority and impact drive routing; every state change is timestamped and attributed.',
    points: ['Priority and impact matrix', 'On-call routing and escalation', 'Post-incident review from the same record'],
  },
  {
    key: 'alerts',
    name: 'Alerts',
    body: 'Monitoring signals land here first. Correlation collapses related alerts so one situation raises one incident instead of forty pages.',
    points: ['Multi-source alert ingest', 'Correlation and de-duplication', 'Maintenance-window suppression'],
  },
  {
    key: 'cmdb',
    name: 'CMDB / Assets',
    body: 'The configuration items behind the services you run — owners, dependencies, and the changes and incidents that touched them.',
    points: ['Service and asset ownership', 'Dependency relationships', 'Change and incident history per item'],
  },
  {
    key: 'sla',
    name: 'SLA',
    body: 'Response and resolution targets tracked per policy, with breach risk visible while there is still time to act on it.',
    points: ['Per-service response and resolution targets', 'Breach-risk warnings before the clock runs out', 'Attainment reporting by period'],
  },
  {
    key: 'ai',
    name: 'AI incident intelligence',
    body: 'Summaries, similar-incident recall and suggested next steps — presented as evidence attached to the incident, never as an action taken on its own.',
    points: ['Incident summary and blast radius', 'Similar past incidents and what resolved them', 'Suggestions a human accepts or rejects'],
  },
] as const;

/** Security posture commitments — the /security page. */
export const SECURITY_POSTURE = [
  {
    key: 'multi-tenant',
    title: 'Enterprise multi-tenant isolation',
    body: 'Organizations are first-class. Data access is enforced with tenant context on every API call; platform admins can scope across orgs, tenant users cannot.',
  },
  {
    key: 'self-hosted',
    title: 'Deploy on your Kubernetes',
    body: 'WeCrew ITSM deploys as ordinary manifests into a cluster you control. Your operational data stays in your database, under your backup and retention policy.',
  },
  {
    key: 'data',
    title: 'Customer-controlled data',
    body: 'Incidents, assets, logs and audit records live where you run the platform. You decide what leaves the cluster, and revoking access is a change you make.',
  },
  {
    key: 'evidence',
    title: 'Evidence before action',
    body: 'Automated and AI-assisted suggestions arrive with the signals that produced them attached. An engineer sees why something is proposed before deciding.',
  },
  {
    key: 'approval',
    title: 'Approval before change',
    body: 'Nothing that modifies a production system runs unattended. Remediation is proposed, reviewed and approved by a named person, and the approval is part of the record.',
  },
  {
    key: 'audit',
    title: 'Audit trail',
    body: 'Every state change, approval and automated run is written with actor, timestamp and outcome. The trail is queryable in-product and exportable for review.',
  },
] as const;

// ── Home page (/) ─────────────────────────────────────────

export const HOME_HERO = {
  eyebrow: 'WeCrew ITSM',
  title: 'From alert to resolved incident — for every customer you run.',
  deck:
    'Alerts from your monitoring become incidents that already name the customer, the application, the host and the severity. On-call gets paged, SLA clocks start, and every step lands on the record.',
} as const;

/**
 * Illustrative only — rendered with an "Example" label. Shows the fields an
 * auto-created incident carries; not a real customer or system.
 */
export const HOME_EXAMPLE_INCIDENT = {
  severity: 'CRITICAL',
  number: 'INC0001042',
  customer: 'Example Retail',
  application: 'payments-api',
  host: 'web-01',
  ip: '10.20.0.14',
  issue: 'HighCPU — 94% for 10 min',
  time: '14:32 IST',
  steps: [
    { label: 'Routed', value: 'Payments on-call' },
    { label: 'Paged', value: 'Voice · SMS · Email' },
    { label: 'SLA', value: 'Response due 14:47' },
  ],
} as const;

/** Monitoring and delivery tools the product connects to today. Text only — no third-party logos. */
export const INTEGRATIONS = [
  'Prometheus',
  'Alertmanager',
  'Grafana',
  'Loki',
  'Kubernetes',
  'PagerDuty',
  'Slack',
  'Twilio voice & SMS',
  'Email (SMTP)',
  'Razorpay billing',
] as const;

export type CapabilityIcon =
  | 'incidents' | 'oncall' | 'change' | 'cmdb' | 'observe' | 'sla' | 'ai' | 'tenancy';

export type Capability = { key: CapabilityIcon; title: string; body: string; to: string; linkLabel: string };

/** Home product showcase — every card links to a page or doc that exists. */
export const CAPABILITIES: Capability[] = [
  {
    key: 'incidents',
    title: 'Incidents & alerts',
    body: 'Alertmanager and Grafana alerts open incidents automatically with severity, customer, host and IP already filled in.',
    to: '/docs#incidents',
    linkLabel: 'Incident guide',
  },
  {
    key: 'oncall',
    title: 'On-call & escalation',
    body: 'Schedules and multi-level escalation policies that page by voice, SMS and email until someone acknowledges.',
    to: '/docs#on-call',
    linkLabel: 'On-call guide',
  },
  {
    key: 'change',
    title: 'Changes & problems',
    body: 'Change requests with approvals, and problem records with root cause and workaround, linked to the incidents they came from.',
    to: '/docs#changes',
    linkLabel: 'Change guide',
  },
  {
    key: 'cmdb',
    title: 'Assets & CMDB',
    body: 'Configuration items with owners and support groups, so an alert on an IP resolves to the right host and team.',
    to: '/docs#cmdb',
    linkLabel: 'CMDB guide',
  },
  {
    key: 'observe',
    title: 'Observability',
    body: 'Kubernetes workloads, APM and logs for each customer environment, next to the incidents they raise.',
    to: '/docs#observability',
    linkLabel: 'Observability guide',
  },
  {
    key: 'sla',
    title: 'SLA tracking',
    body: 'Response and resolution targets per priority, with a warning before the clock runs out and a record when it does.',
    to: '/docs#sla',
    linkLabel: 'SLA guide',
  },
  {
    key: 'ai',
    title: 'AI insights',
    body: 'Incident summaries, similar past incidents and suggested next steps — evidence a person accepts or rejects.',
    to: '/itsm',
    linkLabel: 'Platform overview',
  },
  {
    key: 'tenancy',
    title: 'Multi-tenant MSP view',
    body: 'Platform staff work across every customer organization; each customer, admins included, stays locked to its own.',
    to: '/docs#organizations',
    linkLabel: 'Organizations guide',
  },
];

export const HOW_IT_WORKS = [
  {
    title: 'Connect your alert sources',
    body: 'Point Alertmanager or Grafana at a per-organization webhook URL. The token in the URL decides which customer an alert belongs to.',
  },
  {
    title: 'Incidents open themselves',
    body: 'Critical and warning alerts become incidents with severity, customer, application, host and time — routed to the owning team.',
  },
  {
    title: 'Page, resolve, prove it',
    body: 'On-call is paged, SLA clocks run, and every acknowledgement, change and resolution is written to the audit trail.',
  },
] as const;

/** Pilot outline shown on the home page. */
export const PILOT_STEPS = [
  'Day 1 — create your organization and connect one alert source with its webhook token.',
  'Days 2–7 — run real incidents through it alongside your current desk; set up on-call and escalation.',
  `Days 8–${PILOT_DAYS} — review SLA attainment and the audit trail together, then decide.`,
] as const;

// ── Enterprise buyer content (home page) ──────────────────
//
// The rule for everything below is the same rule as the rest of this file:
// describe what the product DOES, never what it has supposedly achieved. No
// customer names, no logo wall, no "40% faster" bars. An enterprise buyer is
// better served by an accurate coverage matrix than by a statistic they cannot
// audit — and a claim we cannot substantiate is the fastest way to lose one.

/** Who the platform is bought by, and the job each buyer is doing. */
export const AUDIENCES = [
  {
    key: 'msp',
    role: 'Managed service providers',
    job: 'Run one desk across many customers without letting their estates touch.',
    body:
      'Each customer is an organization with its own alert webhook, assets, SLAs and audit history. Your engineers work across all of them from one queue; the customer sees only their own.',
    to: '/security',
    linkLabel: 'How isolation works',
  },
  {
    key: 'platform',
    role: 'Internal platform teams',
    job: 'Turn monitoring noise into incidents someone actually owns.',
    body:
      'Alertmanager and Grafana point at a webhook; correlation collapses the storm; the incident opens already naming the service, the host and the on-call engineer who now owns it.',
    to: '/docs#alert-webhooks',
    linkLabel: 'Connect an alert source',
  },
  {
    key: 'servicedesk',
    role: 'Service desk and IT leads',
    job: 'Report on SLA attainment and change success with evidence behind it.',
    body:
      'Response and resolution clocks per policy, approvals recorded against named people, and an audit trail that exports — so the monthly review is a query, not a reconstruction.',
    to: '/itsm',
    linkLabel: 'See the ITSM core',
  },
] as const;

/**
 * ITIL 4 practice coverage. `state` is deliberately honest: `core` ships today,
 * `partial` works but is not the full practice, `roadmap` is not built yet.
 * Do not promote a row without the feature actually existing.
 */
export type PracticeState = 'core' | 'partial' | 'roadmap';

export const ITIL_PRACTICES: {
  practice: string;
  state: PracticeState;
  note: string;
}[] = [
  { practice: 'Incident management', state: 'core', note: 'Intake, triage, ownership, resolution, post-incident review.' },
  { practice: 'Monitoring & event management', state: 'core', note: 'Multi-source alert ingest, correlation, de-duplication, suppression.' },
  { practice: 'Change enablement', state: 'core', note: 'Normal, standard and emergency changes with approval and a forward schedule.' },
  { practice: 'Problem management', state: 'core', note: 'Problems and known errors linked to the incidents that raised them.' },
  { practice: 'Service configuration management', state: 'core', note: 'CMDB with ownership, dependencies and per-item change history.' },
  { practice: 'Service level management', state: 'core', note: 'Per-policy response and resolution clocks with breach-risk warnings.' },
  { practice: 'Service desk', state: 'core', note: 'One queue, role-gated actions, work notes and an attributable timeline.' },
  { practice: 'Service request management', state: 'partial', note: 'Request records exist; a full catalogue with fulfilment workflows is in design.' },
  { practice: 'Knowledge management', state: 'partial', note: 'Articles attach to incidents and problems; authoring workflow is basic.' },
  { practice: 'Continual improvement', state: 'partial', note: 'Attainment and trend reporting ship; a register of improvement items does not.' },
  { practice: 'Release management', state: 'roadmap', note: 'Tracked as change records today; a dedicated release practice is not built.' },
  { practice: 'Capacity & performance', state: 'roadmap', note: 'Metrics are read from your monitoring; capacity planning lives there, not here.' },
];

export const PRACTICE_STATE_LABEL: Record<PracticeState, string> = {
  core: 'Ships today',
  partial: 'Partial',
  roadmap: 'Not yet built',
};

/**
 * What the platform instruments. These are the measures it REPORTS — not
 * results it claims on anyone's behalf. Phrase every one as a measurement.
 */
export const MEASURES = [
  { metric: 'Time to acknowledge', body: 'From alert received to a named engineer accepting the page.' },
  { metric: 'Time to resolve', body: 'From incident open to resolved, split by priority and by customer.' },
  { metric: 'SLA attainment', body: 'Response and resolution targets met per policy, per period, with the breaches listed.' },
  { metric: 'Change success rate', body: 'Changes implemented without a linked incident or rollback, by change type.' },
  { metric: 'Alert-to-incident ratio', body: 'How much correlation is actually collapsing — the measure of whether paging is sane.' },
  { metric: 'Unmonitored estate', body: 'Configuration items with monitoring switched off, which raise no alerts at all.' },
];

/** Procurement facts. Short, checkable answers to the questions security review asks first. */
export const PLATFORM_FACTS: { label: string; value: string }[] = [
  { label: 'Deployment', value: 'Your Kubernetes cluster, as ordinary manifests' },
  { label: 'Data residency', value: 'Your database, in your cluster, under your backup policy' },
  { label: 'Tenancy model', value: 'One deployment, many organizations, enforced server-side per request' },
  { label: 'Authentication', value: 'Email and password with refresh tokens; OIDC via your identity provider' },
  { label: 'Roles', value: 'Admin, Manager, Engineer, Operator, Viewer — enforced on the API, not just the UI' },
  { label: 'Audit trail', value: 'Every state change, approval and automated run, queryable and exportable' },
  { label: 'Alert intake', value: 'Per-organization webhook; Prometheus Alertmanager and Grafana supported today' },
  { label: 'Paging channels', value: 'Voice, SMS, email and Slack; PagerDuty for onward routing' },
  { label: 'Backups', value: 'Nightly dump with a weekly automated restore test into off-site storage' },
  { label: 'Exit', value: 'Postgres dump plus audit export — your records leave in a format you can read' },
];

/** Buyer FAQ for the home page. Answers are short and commit to nothing unbuilt. */
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: 'Do we have to replace our monitoring?',
    a: 'No. The platform is downstream of it. Prometheus, Alertmanager, Grafana and Loki keep doing their job; this is where their output becomes an owned, time-bound incident.',
  },
  {
    q: 'Can one customer ever see another customer\'s data?',
    a: 'No. Tenant scope is applied on the server for every request, not in the browser. A customer administrator is locked to their own organization; only platform staff can read across organizations.',
  },
  {
    q: 'Where does our data actually live?',
    a: 'In the Postgres database inside the cluster you deploy to. Nothing is copied to a vendor-run system, and your backup, retention and deletion policies are the ones that apply.',
  },
  {
    q: 'What does the AI do, and what can it do on its own?',
    a: 'It summarises an incident, recalls similar past ones and suggests next steps, always with the signals that produced the suggestion attached. It never changes a production system; a named person approves anything that does.',
  },
  {
    q: 'How long does it take to get a real incident flowing?',
    a: 'One alert source and one webhook URL, which is a day. The pilot is deliberately run alongside your current desk so nothing depends on it while you are still deciding.',
  },
  {
    q: 'What happens if we stop?',
    a: 'You take a database dump and an audit export and shut the namespace down. There is no proprietary store to extract from and nothing to unwind in your monitoring.',
  },
];

/** Documentation entry points surfaced on the home page. */
export const DOC_LINKS: { title: string; body: string; to: string }[] = [
  {
    title: 'Getting started',
    body: 'Create an organization, invite your first engineers and set the roles that gate approvals.',
    to: '/docs',
  },
  {
    title: 'Alert webhooks',
    body: 'The per-organization webhook URL, the token that identifies the customer, and the Alertmanager config that posts to it.',
    to: '/docs#alert-webhooks',
  },
  {
    title: 'API reference',
    body: 'Authentication, the organization header, pagination and the endpoints behind every screen in the product.',
    to: '/docs#api-overview',
  },
  {
    title: 'Trial and billing',
    body: 'What the trial includes, what happens when it lapses, and how seats are counted at renewal.',
    to: '/docs#trial-billing',
  },
];

export type FooterColumn = { title: string; links: { label: string; to: string }[] };

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Platform', to: '/itsm' },
      { label: 'Modules', to: '/modules' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Security', to: '/security' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', to: '/docs' },
      { label: 'API reference', to: '/docs#api-overview' },
      { label: 'Alert webhooks', to: '/docs#alert-webhooks' },
      { label: 'Trial & billing', to: '/docs#trial-billing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', to: '/contact' },
      { label: 'Book a pilot', to: '/pilot' },
      { label: 'Sign in', to: '/login' },
    ],
  },
];
