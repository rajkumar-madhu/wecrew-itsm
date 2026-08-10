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
  email: string;
  website: string;
  /** Optional — rendered only when non-empty. Typed `string`, not the literal
   *  '', so filling one in here does not narrow it to `never` at the use site. */
  phone: string;
  addressLines: string[];
  registration: string;
  hours: string;
}

export const COMPANY: CompanyDetails = {
  name: 'WeCrew Ops',
  product: 'WeCrew ITSM',
  tagline: 'Self-hosted IT operations for teams that have to prove what happened.',
  email: 'le@finspot.in',
  website: 'https://wecrew.in',
  // Optional — fill these in; blank fields are omitted from the page.
  phone: '',
  addressLines: [],
  registration: '',
  hours: 'Monday–Friday, 09:00–18:00 IST',
};

export type NavItem = { label: string; to: string };

export const NAV: NavItem[] = [
  { label: 'ITSM', to: '/itsm' },
  { label: 'Modules', to: '/modules' },
  { label: 'Security', to: '/security' },
  { label: 'Pilot', to: '/pilot' },
  { label: 'Contact', to: '/contact' },
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
      'Alert correlation and noise reduction. Groups related signals into one incident so an on-call engineer reads a situation, not a stream.',
    status: 'available',
    points: [
      'Correlates alerts across monitoring sources into a single incident',
      'Suppresses duplicates and flapping during known maintenance windows',
      'Routes on severity and service ownership, with escalation policies',
    ],
  },
  {
    key: 'copilot',
    name: 'Copilot',
    summary:
      'AI incident intelligence in the incident record. Summarises what changed, what is affected, and what past incidents looked like.',
    status: 'available',
    points: [
      'Timeline summary and likely blast radius drawn from the CMDB',
      'Similar-incident recall with the resolution that worked last time',
      'Draft updates for status pages and stakeholder comms',
    ],
  },
  {
    key: 'nexus',
    name: 'NEXUS',
    summary:
      'Cross-environment topology and dependency mapping — Kubernetes workloads, hosts, services and the links between them.',
    status: 'contact',
    points: [
      'Live topology from cluster and infrastructure discovery',
      'Dependency-aware impact analysis before a change is approved',
      'Feeds the CMDB rather than living beside it',
    ],
  },
  {
    key: 'agentos',
    name: 'AgentOS',
    summary:
      'Automation that proposes remediation and executes only what a human approves, with the full run recorded.',
    status: 'contact',
    points: [
      'Runbook steps proposed with the evidence that triggered them',
      'Approval gate before anything touches a production system',
      'Every run written to the audit trail with actor and outcome',
    ],
  },
];

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
    key: 'self-hosted',
    title: 'Self-hosted on your Kubernetes',
    body: 'WeCrew ITSM deploys into a cluster you control, as ordinary manifests. There is no multi-tenant SaaS instance holding your operational data, and no outbound dependency required for the product to function.',
  },
  {
    key: 'data',
    title: 'Customer-controlled data',
    body: 'Incidents, assets, logs and audit records live in your database, on your storage, under your backup and retention policy. You decide what leaves the cluster, and revoking access is a change you make, not a request you file.',
  },
  {
    key: 'evidence',
    title: 'Evidence before action',
    body: 'Automated and AI-assisted suggestions arrive with the signals that produced them attached. An engineer sees why something is being proposed before deciding whether it is right.',
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
