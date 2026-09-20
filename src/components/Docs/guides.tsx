import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bullets, Callout, Code, CodeBlock, H3, P, Steps, Table } from './DocsUI';
import { PRICING } from '../Public/site';

/*
  Product guides for /docs — task-oriented ("how do I…"), describing only what
  the product does today. App locations use the sidebar labels in
  src/components/Layout/Sidebar.tsx; keep them in step if the nav changes.
*/

const origin = typeof window !== 'undefined' ? window.location.origin : '';

const In = ({ children }: { children: ReactNode }) => (
  <span className="font-medium text-ink">{children}</span>
);

// ── Getting started ─────────────────────────────────────────

export function OverviewGuide() {
  return (
    <>
      <P>
        WeCrew ITSM brings incidents, changes, problems, the CMDB, alerting, on-call and observability views into one
        multi-tenant workspace. Each customer organization sees only its own records; WeCrew operators can work across
        organizations from the same console.
      </P>
      <H3>Where things live in the app</H3>
      <Table
        head={['Area', 'Sidebar', 'Use it to']}
        rows={[
          ['Self-Service', 'Command Centre, Incidents, Problems, Changes, Change calendar, Knowledge', 'Run day-to-day ITIL work'],
          ['IT Operations', 'Alerts, CMDB / Assets, Network, Metrics, Service health, Kubernetes, Log explorer, NOC, Integrations', 'See what is happening in the estate'],
          ['Service delivery', 'SLA policies, On-call, Escalation, Maintenance, Team chat, SMS gateway, Voice agent', 'Respond and communicate'],
          ['Intelligence', 'AI insights, Automation, Reports', 'Analyse trends and automate'],
          ['Administration', 'Teams, Users, Audit log, Billing, Settings', 'Manage your organization'],
        ]}
      />
      <H3>First steps for a new organization</H3>
      <Steps
        items={[
          <>Sign in and open <In>Administration → Teams</In> to create your support teams.</>,
          <>Add people in <In>Administration → Users</In>. Viewers are free; other roles use a seat.</>,
          <>Point your monitoring at WeCrew: see <a href="#alert-webhooks" className="text-signal hover:underline">Alert webhooks</a>.</>,
          <>Set up rotas and escalation in <In>On-call</In> and <In>Escalation</In> so alerts reach a person.</>,
        ]}
      />
    </>
  );
}

export function SignInGuide() {
  return (
    <>
      <P>
        Sign in at <Link to="/login" className="text-signal hover:underline">/login</Link> with your full work email and
        password. <In>Keep me signed in</In> keeps the session on this browser.
      </P>
      <H3>Forgot your password?</H3>
      <Steps
        items={[
          <>On the sign-in page choose <In>Forgot password?</In> and enter your email.</>,
          <>Open the reset email and follow the link to choose a new password.</>,
          <>Sign in with the new password. Sessions opened with the old password stop working.</>,
        ]}
      />
      <P>For security the request always reports success, whether or not the address has an account.</P>
      <H3>Roles</H3>
      <Table
        head={['Role', 'Can do']}
        rows={[
          ['ADMIN', 'Everything in the organization: users, integrations, billing, delete assets'],
          ['MANAGER', 'Incidents, changes, problems; manage teams, on-call, escalation; read audit log'],
          ['ENGINEER', 'Create and update incidents, changes, problems, assets and alerts'],
          ['OPERATOR', 'Create and update incidents and alerts; read everything else'],
          ['VIEWER', 'Read-only. Free and unlimited on every plan'],
        ]}
      />
      <Callout title="Platform admins">
        WeCrew operators hold a separate platform-admin flag that lets them switch between customer organizations.
        The ADMIN role on its own never grants access outside your organization.
      </Callout>
    </>
  );
}

export function OrganizationsGuide() {
  return (
    <>
      <P>
        Every incident, change, asset, alert, team and integration belongs to one organization. The API applies that
        scope on every request — you do not need to pass anything to stay inside your own organization.
      </P>
      <Bullets
        items={[
          'Users are locked to their organization. Records from another organization read as "not found".',
          'A user without an organization sees no tenant data until one is assigned.',
          <>Platform admins switch organization with the org switcher in the app, or the <Code>X-Organization-Id</Code> header / <Code>?orgId=</Code> in the API. The header is ignored for everyone else.</>,
          'Live updates (sockets) are delivered only to users of the organization that owns the record.',
        ]}
      />
      <CodeBlock code={`curl ${origin}/api/v1/incidents \\\n  -H "Authorization: Bearer <accessToken>"`} />
    </>
  );
}

export function TrialBillingGuide() {
  return (
    <>
      <P>
        New organizations start on a free trial. Plans are managed by organization admins in{' '}
        <In>Administration → Billing</In>; payments are processed by Razorpay.
      </P>
      <Table
        head={['Plan', 'Price', 'Includes']}
        rows={PRICING.map((t) => [t.name, `${t.price} · ${t.period}`, t.features.join('; ')])}
      />
      <H3>When the trial ends</H3>
      <P>
        Nothing is deleted. The organization becomes read-only: you can still view and export, but changes return
        HTTP <Code>402</Code> until you subscribe. The banner at the top of the app shows the days left.
      </P>
      <H3>Upgrade</H3>
      <Steps
        items={[
          <>Open <In>Administration → Billing</In> (ADMIN only).</>,
          <>Choose <In>Starter</In> and complete Razorpay checkout.</>,
          <>Access switches to full as soon as the payment is confirmed.</>,
        ]}
      />
      <P>Cancelling stops the next renewal; access continues to the end of the paid year. Enterprise terms are arranged with sales.</P>
    </>
  );
}

// ── Incident response ───────────────────────────────────────

export function IncidentsGuide() {
  return (
    <>
      <P>
        Incidents carry an impact and urgency, which set the priority (<Code>P1</Code>–<Code>P4</Code>). They move
        through <Code>NEW → IN_PROGRESS → RESOLVED → CLOSED</Code>, with <Code>ON_HOLD</Code>, <Code>ESCALATED</Code>{' '}
        and <Code>CANCELLED</Code> available along the way.
      </P>
      <H3>Raise and work an incident</H3>
      <Steps
        items={[
          <>Open <In>Incidents</In> and create one, or let an alert create it for you.</>,
          'Assign a team (assignment group) and, optionally, an engineer. Both must belong to your organization.',
          'Add work notes as you go — they form the timeline.',
          'Link related changes and problems so the history is traceable.',
          'Resolve with resolution notes; they feed AI resolution suggestions for similar incidents.',
        ]}
      />
      <P>Generate a report for one incident, or a bulk report for several, from the incident list.</P>
    </>
  );
}

export function AlertsGuide() {
  return (
    <>
      <P>
        Alerts arrive from Prometheus Alertmanager, Grafana or remote Prometheus sync. Severity is{' '}
        <Code>CRITICAL</Code>, <Code>WARNING</Code> or <Code>INFO</Code>; status is <Code>FIRING</Code>,{' '}
        <Code>ACKNOWLEDGED</Code>, <Code>SILENCED</Code> or <Code>RESOLVED</Code>.
      </P>
      <Bullets
        items={[
          'CRITICAL and WARNING alerts automatically open an incident; INFO alerts do not.',
          'Recovery alerts (for example a matching "…Ok" alert) resolve the warning they clear.',
          <>From <In>Alerts</In> you can acknowledge, silence, or create an incident manually.</>,
        ]}
      />
      <P>To connect a source, see <a href="#alert-webhooks" className="text-signal hover:underline">Alert webhooks</a>.</P>
    </>
  );
}

export function OnCallGuide() {
  return (
    <>
      <P>
        On-call schedules belong to a team. Escalation policies decide who is notified, in what order, and after how
        long, for P1 and P2 incidents that stay unacknowledged.
      </P>
      <Steps
        items={[
          <>Create the team in <In>Administration → Teams</In> and add its members.</>,
          <>Add rotations in <In>On-call</In>; check coverage in <In>On-call calendar</In>.</>,
          <>Build levels in <In>Escalation</In>: each level has a delay and people to notify (email, SMS, voice).</>,
        ]}
      />
      <Callout title="Who can be paged">
        Escalation targets must be members of the incident&apos;s organization or WeCrew operators. Other people are
        skipped.
      </Callout>
    </>
  );
}

export function SlaGuide() {
  return (
    <>
      <P>
        SLA policies set a response and a resolution target, in minutes, per priority. Targets are stamped on each
        incident when it is created.
      </P>
      <Bullets
        items={[
          'At 80% of the target the assignee is warned, in the app and by notification.',
          'When the target passes, the incident is marked breached and the team is notified.',
          <>Review policies in <In>SLA policies</In> and compliance in <In>Reports</In>.</>,
        ]}
      />
    </>
  );
}

// ── Change & problem ────────────────────────────────────────

export function ChangesGuide() {
  return (
    <>
      <P>
        Changes are <Code>NORMAL</Code>, <Code>STANDARD</Code> or <Code>EMERGENCY</Code> and move through{' '}
        <Code>NEW → ASSESSMENT → APPROVAL → SCHEDULED → IMPLEMENTING → REVIEW → CLOSED</Code>.
      </P>
      <Steps
        items={[
          <>Create the change in <In>Changes</In> with risk, plan and schedule.</>,
          'Submit it for approval; approvers approve or reject with comments.',
          <>Track the schedule in <In>Change calendar</In>.</>,
        ]}
      />
    </>
  );
}

export function ProblemsGuide() {
  return (
    <>
      <P>
        Problems capture the underlying cause behind repeated incidents and move through{' '}
        <Code>NEW → INVESTIGATION → RCA_IN_PROGRESS → KNOWN_ERROR → RESOLVED → CLOSED</Code>.
      </P>
      <Bullets
        items={[
          'Link the incidents that share the cause.',
          'Record the root cause analysis; AI-assisted RCA can draft one from the linked evidence.',
          'Record the workaround on the problem so responders can apply it while the permanent fix is pending.',
        ]}
      />
    </>
  );
}

export function MaintenanceGuide() {
  return (
    <>
      <P>
        Maintenance windows are scheduled from <In>Maintenance</In> and are stored as changes in the{' '}
        <Code>Maintenance</Code> category, so they appear on the change calendar and follow the same approvals.
      </P>
    </>
  );
}

// ── Assets & CMDB ───────────────────────────────────────────

export function CmdbGuide() {
  return (
    <>
      <P>
        The CMDB holds configuration items (CIs): servers, Kubernetes clusters, databases, applications, network,
        storage, containers, VMs and load balancers.
      </P>
      <Bullets
        items={[
          'Each CI can have an owner and a support team from your organization.',
          'Alerts are matched to CIs by instance, so incidents open against the right item.',
          <>Kubernetes nodes and workloads can be synced into the CMDB from <In>Kubernetes</In> (ADMIN).</>,
          'Live and historical metrics are shown on the CI page when a metrics source is connected.',
        ]}
      />
    </>
  );
}

// ── Observability ───────────────────────────────────────────

export function ObservabilityGuide() {
  return (
    <>
      <P>Observability views read from the monitoring stack your organization has connected in Integrations.</P>
      <Table
        head={['View', 'Sidebar', 'Needs']}
        rows={[
          ['Kubernetes', 'Kubernetes', 'A Kubernetes integration (direct API URL + token)'],
          ['Service health (APM)', 'Service health', 'A Prometheus integration'],
          ['Logs', 'Log explorer', 'A Loki source for the organization'],
          ['Metrics', 'Metrics', 'A Prometheus integration'],
        ]}
      />
      <Callout title="Platform dashboards">
        The Infrastructure, Database and Logs tabs of <In>AI insights</In> analyse WeCrew&apos;s own platform and are
        visible to WeCrew operators only. Tips &amp; Health is available to every organization.
      </Callout>
    </>
  );
}

// ── Integrations ────────────────────────────────────────────

export function AlertWebhooksGuide() {
  return (
    <>
      <P>
        Alertmanager and Grafana post alerts to WeCrew over a webhook. Each organization has its own secret token; the
        token alone decides which organization an alert lands in.
      </P>
      <Steps
        items={[
          <>As an ADMIN, fetch your token: <Code>GET /api/v1/integrations/alert-webhook</Code>.</>,
          'Add it to the webhook URL in Alertmanager or Grafana, as shown below.',
          <>Rotate it with <Code>POST /api/v1/integrations/alert-webhook/rotate</Code> if it leaks — the old token stops working at once.</>,
        ]}
      />
      <CodeBlock
        language="yaml"
        code={`# alertmanager.yml\nreceivers:\n  - name: wecrew\n    webhook_configs:\n      - url: ${origin}/api/v1/webhooks/alertmanager?token=<your-token>\n        send_resolved: true`}
      />
      <P>Grafana contact point URL:</P>
      <CodeBlock language="text" code={`${origin}/api/v1/webhooks/grafana?token=<your-token>`} />
      <Callout tone="warn" title="Treat the token like a password">
        Anyone with it can post alerts into your organization. Keep it out of shared repositories and rotate it when
        people leave.
      </Callout>
    </>
  );
}

export function SlackGuide() {
  return (
    <>
      <P>
        The WeCrew Slack app posts incident and alert notifications and offers acknowledge buttons and slash commands.
      </P>
      <Bullets
        items={[
          'Every request from Slack is signature-checked and must be less than five minutes old.',
          'Buttons act only on records of the organization linked to your Slack workspace.',
          'Ask WeCrew support to link a new workspace to your organization.',
        ]}
      />
    </>
  );
}

export function PagerDutyGuide() {
  return (
    <>
      <Steps
        items={[
          <>In <In>Integrations</In>, validate and connect your PagerDuty REST API key (ADMIN).</>,
          'Copy the webhook URL returned on connect — it carries your organization’s token.',
          'Add that URL as a webhook in PagerDuty. Resolved PagerDuty incidents then resolve the matching WeCrew incident.',
        ]}
      />
      <P>PagerDuty services, incidents, on-call and escalation policies are then visible from the PagerDuty dashboard.</P>
    </>
  );
}

export function MessagingGuide() {
  return (
    <>
      <P>
        SMS (Twilio, MSG91 or Kaleyra) and voice calls (Twilio) are used for escalation and can be sent manually from{' '}
        <In>SMS gateway</In> and <In>Voice agent</In>.
      </P>
      <Bullets
        items={[
          'SMS: ADMIN, MANAGER and ENGINEER can send; bulk sends need MANAGER or ADMIN.',
          'Voice calls: ADMIN and MANAGER. A call about an incident reads out that incident’s details.',
          'Delivery status and call logs are kept per organization.',
        ]}
      />
    </>
  );
}

// ── Administration ──────────────────────────────────────────

export function UsersSeatsGuide() {
  return (
    <>
      <P>
        Add users in <In>Administration → Users</In>. New users always join your organization. Every role except
        VIEWER uses a seat; your plan&apos;s seat count is shown on the Billing page.
      </P>
      <Callout title="Seat limit reached?">
        Adding another non-viewer returns <Code>402 SEAT_LIMIT_REACHED</Code>. Add the person as a Viewer, deactivate
        someone, or upgrade.
      </Callout>
    </>
  );
}

export function AuditGuide() {
  return (
    <>
      <P>
        <In>Audit log</In> (ADMIN and MANAGER) lists changes made by users of your organization, filterable by action,
        entity type, user and date.
      </P>
    </>
  );
}

export function SecurityGuide() {
  return (
    <>
      <Bullets
        items={[
          'Strict tenant isolation on every API route and live update.',
          'Short-lived access tokens (15 minutes) with a refresh token in an httpOnly cookie; changing your password ends other sessions.',
          'Accounts lock for 15 minutes after five failed sign-ins.',
          'Inbound webhooks are authenticated: per-organization tokens (alerts, PagerDuty) or provider signatures (Slack, Razorpay, Twilio).',
          'Integrations may only reach public addresses; server-level (SSH) access is configured by WeCrew staff.',
        ]}
      />
      <P>
        Read the full posture on the <Link to="/security" className="text-signal hover:underline">Security</Link> page.
      </P>
    </>
  );
}
