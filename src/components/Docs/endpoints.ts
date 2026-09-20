/* ═══════════════════════════════════════════════════════════
   WeCrew ITSM — API reference data
   One entry per route. Keep in step with the backend's src/routes/*.routes.js;
   `auth` is who may call it (tenant scoping applies on top — see Organizations).
   ═══════════════════════════════════════════════════════════ */

export type EndpointAuth =
  | 'None'
  | 'Token'
  | 'Authenticated'
  | 'ADMIN'
  | 'ADMIN, MANAGER'
  | 'ADMIN, MANAGER, ENGINEER'
  | 'Platform admin';

export interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: EndpointAuth;
  params?: { name: string; in: 'path' | 'query' | 'body' | 'header'; type: string; required?: boolean; description: string }[];
  exampleRequest?: string;
  exampleResponse?: string;
}

export const AUTH_ENDPOINTS: Endpoint[] = [
  {
    method: 'POST', path: '/api/v1/auth/login', auth: 'None',
    description: 'Authenticate a user and receive JWT tokens. Returns user profile, organization info, and token pair.',
    params: [
      { name: 'email', in: 'body', type: 'string', required: true, description: 'User email address' },
      { name: 'password', in: 'body', type: 'string', required: true, description: 'User password' },
    ],
    exampleRequest: `curl -X POST ${window.location.origin}/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@argus.io", "password": "MyPassword123"}'`,
    exampleResponse: `{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "15m",
    "user": {
      "id": "uuid",
      "email": "admin@argus.io",
      "firstName": "Admin",
      "lastName": "User",
      "role": "ADMIN",
      "organizationId": "org-uuid"
    },
    "organization": {
      "id": "org-uuid",
      "name": "Lemonn Financial",
      "slug": "lemonn-le",
      "environment": "PROD",
      "fqdn": "lemonn.wecrew.in"
    }
  }
}`,
  },
  {
    method: 'POST', path: '/api/v1/auth/register', auth: 'ADMIN',
    description: 'Add a user. An organization ADMIN always adds users to their own organization; only platform admins may set organizationId. Adding a non-VIEWER beyond the plan\'s seat limit returns 402 SEAT_LIMIT_REACHED (viewers are free).',
    params: [
      { name: 'email', in: 'body', type: 'string', required: true, description: 'User email' },
      { name: 'password', in: 'body', type: 'string', required: true, description: 'Min 8 characters' },
      { name: 'firstName', in: 'body', type: 'string', required: true, description: 'First name' },
      { name: 'lastName', in: 'body', type: 'string', required: true, description: 'Last name' },
      { name: 'role', in: 'body', type: 'string', required: true, description: 'ADMIN | MANAGER | ENGINEER | OPERATOR | VIEWER' },
      { name: 'organizationId', in: 'body', type: 'string', required: false, description: 'Organization UUID — honoured for platform admins only' },
    ],
    exampleResponse: `{ "success": true, "data": { "id": "uuid", "email": "new@argus.io", "role": "ENGINEER" } }`,
  },
  {
    method: 'POST', path: '/api/v1/auth/signup', auth: 'None',
    description: 'Self-service signup: creates an organization with a 20-day trial and makes the registrant its ADMIN (locked to that organization). Returns 403 while self-service signup is switched off for the deployment.',
    params: [
      { name: 'email', in: 'body', type: 'string', required: true, description: 'Work email' },
      { name: 'password', in: 'body', type: 'string', required: true, description: 'Min 8 characters' },
      { name: 'firstName', in: 'body', type: 'string', required: true, description: 'First name' },
      { name: 'lastName', in: 'body', type: 'string', required: true, description: 'Last name' },
      { name: 'companyName', in: 'body', type: 'string', required: false, description: 'Names the new organization (2–100 chars)' },
    ],
  },
  {
    method: 'POST', path: '/api/v1/auth/forgot-password', auth: 'None',
    description: 'Request a password-reset email. Always returns 200, whether or not the address has an account, so the endpoint cannot be used to discover users.',
    params: [{ name: 'email', in: 'body', type: 'string', required: true, description: 'Account email' }],
  },
  {
    method: 'POST', path: '/api/v1/auth/reset-password', auth: 'None',
    description: 'Set a new password using the token from the reset email.',
    params: [
      { name: 'token', in: 'body', type: 'string', required: true, description: 'Token from the reset link' },
      { name: 'password', in: 'body', type: 'string', required: true, description: 'New password (min 8 characters)' },
    ],
  },
  {
    method: 'POST', path: '/api/v1/auth/refresh', auth: 'None',
    description: 'Refresh an expired access token using a valid refresh token.',
    params: [{ name: 'refreshToken', in: 'body', type: 'string', required: true, description: 'Valid refresh token' }],
    exampleResponse: `{ "success": true, "data": { "accessToken": "new-jwt...", "refreshToken": "new-refresh..." } }`,
  },
  {
    method: 'POST', path: '/api/v1/auth/logout', auth: 'Authenticated',
    description: 'Logout the current user and invalidate the session.',
  },
  {
    method: 'GET', path: '/api/v1/auth/me', auth: 'Authenticated',
    description: 'Get the authenticated user\'s profile, including organization and team memberships.',
    exampleResponse: `{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@argus.io",
    "firstName": "Admin",
    "lastName": "User",
    "role": "ADMIN",
    "organization": { "id": "uuid", "name": "Lemonn", "slug": "lemonn-le", "environment": "PROD", "fqdn": "lemonn.wecrew.in" },
    "teamMembers": [{ "team": { "id": "uuid", "name": "NOC Team" } }]
  }
}`,
  },
  {
    method: 'PUT', path: '/api/v1/auth/me', auth: 'Authenticated',
    description: 'Update the authenticated user\'s profile (name, phone, timezone, avatar).',
    params: [
      { name: 'firstName', in: 'body', type: 'string', required: false, description: 'First name' },
      { name: 'lastName', in: 'body', type: 'string', required: false, description: 'Last name' },
      { name: 'phone', in: 'body', type: 'string', required: false, description: 'Phone number' },
      { name: 'timezone', in: 'body', type: 'string', required: false, description: 'IANA timezone' },
    ],
  },
  {
    method: 'POST', path: '/api/v1/auth/change-password', auth: 'Authenticated',
    description: 'Change the authenticated user\'s password.',
    params: [
      { name: 'oldPassword', in: 'body', type: 'string', required: true, description: 'Current password' },
      { name: 'newPassword', in: 'body', type: 'string', required: true, description: 'New password (min 8 chars)' },
    ],
  },
  {
    method: 'GET', path: '/api/v1/auth/users', auth: 'ADMIN, MANAGER',
    description: 'List all users. Supports pagination and filtering by role, status, and organization.',
    params: [
      { name: 'page', in: 'query', type: 'number', description: 'Page number (default: 1)' },
      { name: 'limit', in: 'query', type: 'number', description: 'Items per page (default: 20)' },
      { name: 'role', in: 'query', type: 'string', description: 'Filter by role' },
      { name: 'status', in: 'query', type: 'string', description: 'Filter by status (ACTIVE, INACTIVE, LOCKED)' },
    ],
  },
];

export const INCIDENT_ENDPOINTS: Endpoint[] = [
  {
    method: 'GET', path: '/api/v1/incidents', auth: 'Authenticated',
    description: 'List incidents with pagination, filtering, sorting, and search. Returns incident list with assignee and team relations.',
    params: [
      { name: 'page', in: 'query', type: 'number', description: 'Page number' },
      { name: 'limit', in: 'query', type: 'number', description: 'Items per page' },
      { name: 'state', in: 'query', type: 'string', description: 'OPEN | IN_PROGRESS | ON_HOLD | RESOLVED | CLOSED' },
      { name: 'priority', in: 'query', type: 'string', description: 'P1 | P2 | P3 | P4' },
      { name: 'category', in: 'query', type: 'string', description: 'NETWORK | SERVER | APPLICATION | DATABASE | SECURITY | OTHER' },
      { name: 'search', in: 'query', type: 'string', description: 'Search in number, description, short description' },
      { name: 'assigneeId', in: 'query', type: 'string', description: 'Filter by assignee UUID' },
      { name: 'sort', in: 'query', type: 'string', description: 'Field to sort by (default: createdAt)' },
      { name: 'order', in: 'query', type: 'string', description: 'asc | desc (default: desc)' },
    ],
    exampleRequest: `curl "${window.location.origin}/api/v1/incidents?state=OPEN&priority=P1&limit=10" \\
  -H "Authorization: Bearer <token>"`,
    exampleResponse: `{
  "success": true,
  "data": [{
    "id": "uuid",
    "number": "INC0000042",
    "shortDescription": "High CPU on lemonn-mum-le",
    "state": "OPEN",
    "priority": "P1",
    "impact": "HIGH",
    "urgency": "HIGH",
    "category": "SERVER",
    "source": "PROMETHEUS",
    "assignee": { "id": "uuid", "firstName": "John", "lastName": "Doe" },
    "team": { "id": "uuid", "name": "NOC Team" },
    "createdAt": "2026-03-01T10:30:00.000Z"
  }],
  "pagination": { "total": 42, "page": 1, "limit": 10, "pages": 5 }
}`,
  },
  {
    method: 'GET', path: '/api/v1/incidents/:id', auth: 'Authenticated',
    description: 'Get full incident details including work notes, related changes, problems, alerts, and configuration items.',
    params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Incident UUID' }],
  },
  {
    method: 'POST', path: '/api/v1/incidents', auth: 'Authenticated',
    description: 'Create a new incident. Priority is auto-calculated from Impact x Urgency matrix. Numbering follows ITIL pattern (INC0000001).',
    params: [
      { name: 'shortDescription', in: 'body', type: 'string', required: true, description: 'Brief title' },
      { name: 'description', in: 'body', type: 'string', required: false, description: 'Detailed description' },
      { name: 'impact', in: 'body', type: 'string', required: true, description: 'HIGH | MEDIUM | LOW' },
      { name: 'urgency', in: 'body', type: 'string', required: true, description: 'HIGH | MEDIUM | LOW' },
      { name: 'category', in: 'body', type: 'string', required: true, description: 'NETWORK | SERVER | APPLICATION | DATABASE | SECURITY | OTHER' },
      { name: 'assigneeId', in: 'body', type: 'string', required: false, description: 'Assignee user UUID' },
      { name: 'teamId', in: 'body', type: 'string', required: false, description: 'Team UUID' },
      { name: 'configItemId', in: 'body', type: 'string', required: false, description: 'Related CMDB asset UUID' },
    ],
  },
  {
    method: 'PATCH', path: '/api/v1/incidents/:id', auth: 'Authenticated',
    description: 'Update an incident. State transitions, reassignment, escalation, and field updates. Automatically logs timeline entries.',
    params: [
      { name: 'id', in: 'path', type: 'string', required: true, description: 'Incident UUID' },
      { name: 'state', in: 'body', type: 'string', required: false, description: 'New state' },
      { name: 'assigneeId', in: 'body', type: 'string', required: false, description: 'Reassign' },
      { name: 'resolutionNotes', in: 'body', type: 'string', required: false, description: 'Resolution notes (required for RESOLVED)' },
    ],
  },
  {
    method: 'DELETE', path: '/api/v1/incidents/:id', auth: 'Authenticated',
    description: 'Delete an incident permanently.',
    params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Incident UUID' }],
  },
  {
    method: 'POST', path: '/api/v1/incidents/:id/notes', auth: 'Authenticated',
    description: 'Add a work note to an incident. Creates a timeline entry visible to all team members.',
    params: [
      { name: 'id', in: 'path', type: 'string', required: true, description: 'Incident UUID' },
      { name: 'content', in: 'body', type: 'string', required: true, description: 'Note text content' },
      { name: 'type', in: 'body', type: 'string', required: false, description: 'WORK_NOTE | CUSTOMER_NOTE' },
    ],
  },
  {
    method: 'GET', path: '/api/v1/incidents/:id/timeline', auth: 'Authenticated',
    description: 'Get the full timeline of an incident: state changes, assignments, notes, linked entities.',
    params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Incident UUID' }],
  },
  {
    method: 'GET', path: '/api/v1/incidents/:id/live-context', auth: 'Authenticated',
    description: 'Get live Prometheus/Grafana context for an incident. Includes real-time server metrics if a config item is linked.',
    params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Incident UUID' }],
  },
  {
    method: 'POST', path: '/api/v1/incidents/:id/changes', auth: 'Authenticated',
    description: 'Link a change record to this incident.',
    params: [
      { name: 'id', in: 'path', type: 'string', required: true, description: 'Incident UUID' },
      { name: 'changeId', in: 'body', type: 'string', required: true, description: 'Change UUID to link' },
    ],
  },
  {
    method: 'POST', path: '/api/v1/incidents/:id/problems', auth: 'Authenticated',
    description: 'Link a problem record to this incident.',
    params: [
      { name: 'id', in: 'path', type: 'string', required: true, description: 'Incident UUID' },
      { name: 'problemId', in: 'body', type: 'string', required: true, description: 'Problem UUID to link' },
    ],
  },
  {
    method: 'GET', path: '/api/v1/incidents/:id/report', auth: 'Authenticated',
    description: 'Generate a detailed incident report including timeline, metrics, and resolution summary.',
    params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Incident UUID' }],
  },
  {
    method: 'POST', path: '/api/v1/incidents/bulk-report', auth: 'Authenticated',
    description: 'Generate a bulk incident report for multiple incidents. Supports date range and priority filters.',
  },
];

export const CHANGE_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/changes', auth: 'Authenticated', description: 'List change requests with pagination, filtering by state, type, risk, and date range.', params: [
    { name: 'state', in: 'query', type: 'string', description: 'NEW | ASSESSMENT | APPROVAL | SCHEDULED | IMPLEMENTATION | REVIEW | CLOSED | CANCELLED' },
    { name: 'type', in: 'query', type: 'string', description: 'NORMAL | STANDARD | EMERGENCY' },
    { name: 'riskLevel', in: 'query', type: 'string', description: 'LOW | MEDIUM | HIGH | CRITICAL' },
  ]},
  { method: 'GET', path: '/api/v1/changes/:id', auth: 'Authenticated', description: 'Get full change request details with approvals, linked incidents, and implementation plan.' },
  { method: 'POST', path: '/api/v1/changes', auth: 'Authenticated', description: 'Create a new change request. Numbering follows ITIL pattern (CHG0000001).', params: [
    { name: 'title', in: 'body', type: 'string', required: true, description: 'Change title' },
    { name: 'description', in: 'body', type: 'string', required: true, description: 'Detailed description' },
    { name: 'type', in: 'body', type: 'string', required: true, description: 'NORMAL | STANDARD | EMERGENCY' },
    { name: 'riskLevel', in: 'body', type: 'string', required: true, description: 'LOW | MEDIUM | HIGH | CRITICAL' },
    { name: 'implementationPlan', in: 'body', type: 'string', required: false, description: 'Step-by-step plan' },
    { name: 'rollbackPlan', in: 'body', type: 'string', required: false, description: 'Rollback procedure' },
    { name: 'scheduledStart', in: 'body', type: 'ISO 8601', required: false, description: 'Planned start time' },
    { name: 'scheduledEnd', in: 'body', type: 'ISO 8601', required: false, description: 'Planned end time' },
  ]},
  { method: 'PATCH', path: '/api/v1/changes/:id', auth: 'Authenticated', description: 'Update a change request.' },
  { method: 'POST', path: '/api/v1/changes/:id/submit', auth: 'Authenticated', description: 'Submit a change for approval. Transitions state from NEW to APPROVAL.' },
  { method: 'POST', path: '/api/v1/changes/:id/approve', auth: 'Authenticated', description: 'Approve a change request. Requires ADMIN or MANAGER role.' },
  { method: 'POST', path: '/api/v1/changes/:id/reject', auth: 'Authenticated', description: 'Reject a change request with reason.' },
];

export const PROBLEM_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/problems', auth: 'Authenticated', description: 'List problems with pagination, filtering by state, priority, and category.', params: [
    { name: 'state', in: 'query', type: 'string', description: 'OPEN | ROOT_CAUSE_ANALYSIS | KNOWN_ERROR | RESOLVED | CLOSED' },
    { name: 'priority', in: 'query', type: 'string', description: 'P1 | P2 | P3 | P4' },
  ]},
  { method: 'GET', path: '/api/v1/problems/stats', auth: 'Authenticated', description: 'Get problem statistics: counts by state, priority, category, and trend data.' },
  { method: 'GET', path: '/api/v1/problems/:id', auth: 'Authenticated', description: 'Get full problem details including root cause analysis, linked incidents, and KEDB entries.' },
  { method: 'POST', path: '/api/v1/problems', auth: 'Authenticated', description: 'Create a new problem record. Numbering follows ITIL pattern (PRB0000001).', params: [
    { name: 'title', in: 'body', type: 'string', required: true, description: 'Problem title' },
    { name: 'description', in: 'body', type: 'string', required: true, description: 'Detailed description' },
    { name: 'impact', in: 'body', type: 'string', required: true, description: 'HIGH | MEDIUM | LOW' },
    { name: 'urgency', in: 'body', type: 'string', required: true, description: 'HIGH | MEDIUM | LOW' },
    { name: 'category', in: 'body', type: 'string', required: true, description: 'Problem category' },
  ]},
  { method: 'PATCH', path: '/api/v1/problems/:id', auth: 'Authenticated', description: 'Update a problem record.' },
  { method: 'PATCH', path: '/api/v1/problems/:id/rca', auth: 'Authenticated', description: 'Update the root cause analysis. Accepts JSON structure with cause, workaround, and permanent fix.', params: [
    { name: 'rootCauseAnalysis', in: 'body', type: 'JSON', required: true, description: '{ cause, workaround, permanentFix, evidence }' },
  ]},
  { method: 'POST', path: '/api/v1/problems/:id/notes', auth: 'Authenticated', description: 'Add a work note to a problem.' },
  { method: 'POST', path: '/api/v1/problems/:id/ai-rca', auth: 'Authenticated', description: 'Generate AI-powered root cause analysis using Ollama (Qwen3-32B). Analyzes linked incidents, alerts, and ALERT_KB patterns.' },
];

export const ALERT_ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/v1/alerts/webhook', auth: 'None', description: 'Receive alerts from external systems (Prometheus, Grafana, custom). Automatically creates alert records and triggers incident creation for CRITICAL/WARNING severity.' },
  { method: 'GET', path: '/api/v1/alerts', auth: 'Authenticated', description: 'List alerts with pagination and filtering.', params: [
    { name: 'severity', in: 'query', type: 'string', description: 'CRITICAL | WARNING | INFO' },
    { name: 'status', in: 'query', type: 'string', description: 'FIRING | ACKNOWLEDGED | SILENCED | RESOLVED' },
    { name: 'source', in: 'query', type: 'string', description: 'PROMETHEUS | GRAFANA | CUSTOM' },
  ]},
  { method: 'GET', path: '/api/v1/alerts/stats', auth: 'Authenticated', description: 'Get alert statistics: counts by severity, source, and status.' },
  { method: 'GET', path: '/api/v1/alerts/kb', auth: 'Authenticated', description: 'Get the Alert Knowledge Base — 17 pattern-matching entries for automated alert classification and remediation.' },
  { method: 'GET', path: '/api/v1/alerts/:id', auth: 'Authenticated', description: 'Get full alert details.' },
  { method: 'POST', path: '/api/v1/alerts/:id/acknowledge', auth: 'Authenticated', description: 'Acknowledge a firing alert.' },
  { method: 'POST', path: '/api/v1/alerts/:id/silence', auth: 'Authenticated', description: 'Silence an alert for a specified duration.', params: [
    { name: 'duration', in: 'body', type: 'number', description: 'Silence duration in minutes' },
  ]},
  { method: 'POST', path: '/api/v1/alerts/:id/create-incident', auth: 'Authenticated', description: 'Create an incident from an existing alert. Auto-populates incident fields from alert data.' },
];

export const ASSET_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/assets', auth: 'Authenticated', description: 'List configuration items (CMDB) with pagination and filtering.', params: [
    { name: 'type', in: 'query', type: 'string', description: 'SERVER | K8s_CLUSTER | DATABASE | APPLICATION | NETWORK_DEVICE | STORAGE | VIRTUAL_MACHINE | CONTAINER | LOAD_BALANCER | FIREWALL | MONITORING' },
    { name: 'status', in: 'query', type: 'string', description: 'ACTIVE | INACTIVE | MAINTENANCE | DECOMMISSIONED' },
    { name: 'search', in: 'query', type: 'string', description: 'Search by name, hostname, IP' },
  ]},
  { method: 'GET', path: '/api/v1/assets/stats', auth: 'Authenticated', description: 'Get asset statistics by type, status, and environment.' },
  { method: 'GET', path: '/api/v1/assets/:id', auth: 'Authenticated', description: 'Get full asset details with owner, support group, and linked incidents.' },
  { method: 'POST', path: '/api/v1/assets', auth: 'Authenticated', description: 'Create a new configuration item.', params: [
    { name: 'name', in: 'body', type: 'string', required: true, description: 'Asset name' },
    { name: 'type', in: 'body', type: 'string', required: true, description: 'CI type enum' },
    { name: 'ipAddress', in: 'body', type: 'string', required: false, description: 'IP address (required for live metrics)' },
    { name: 'hostname', in: 'body', type: 'string', required: false, description: 'Hostname' },
    { name: 'environment', in: 'body', type: 'string', required: false, description: 'PROD | DR | UAT | DEV' },
  ]},
  { method: 'PATCH', path: '/api/v1/assets/:id', auth: 'Authenticated', description: 'Update a configuration item.' },
  { method: 'DELETE', path: '/api/v1/assets/:id', auth: 'Authenticated', description: 'Delete a configuration item.' },
  { method: 'GET', path: '/api/v1/ai/assets/:id/live-metrics', auth: 'Authenticated', description: 'Get real-time metrics for an asset from Prometheus via SSH tunnel. Requires ipAddress field. Returns 25+ metrics: CPU, memory, disk, network, load, IOPS, filesystem.', params: [
    { name: 'id', in: 'path', type: 'string', required: true, description: 'Asset UUID (must have ipAddress)' },
  ]},
  { method: 'GET', path: '/api/v1/ai/assets/:id/metrics-history', auth: 'Authenticated', description: 'Get historical metrics range data for trend charts. Default 6h window.', params: [
    { name: 'id', in: 'path', type: 'string', required: true, description: 'Asset UUID' },
    { name: 'duration', in: 'query', type: 'string', description: 'Time range: 1h | 6h | 24h | 7d (default: 6h)' },
  ]},
];

export const TEAM_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/teams', auth: 'Authenticated', description: 'List all teams with member counts and on-call status.' },
  { method: 'GET', path: '/api/v1/teams/on-call/overview', auth: 'Authenticated', description: 'Get on-call overview across all teams: who is currently on-call, coverage gaps, and upcoming rotations.' },
  { method: 'GET', path: '/api/v1/teams/:id', auth: 'Authenticated', description: 'Get team details with full member list, on-call schedule, and escalation policies.' },
  { method: 'POST', path: '/api/v1/teams', auth: 'Authenticated', description: 'Create a new team.', params: [
    { name: 'name', in: 'body', type: 'string', required: true, description: 'Team name' },
    { name: 'description', in: 'body', type: 'string', required: false, description: 'Team description' },
    { name: 'type', in: 'body', type: 'string', required: false, description: 'OPERATIONS | DEVELOPMENT | SECURITY | INFRASTRUCTURE | SUPPORT' },
  ]},
  { method: 'PATCH', path: '/api/v1/teams/:id', auth: 'Authenticated', description: 'Update team details.' },
  { method: 'POST', path: '/api/v1/teams/:id/members', auth: 'Authenticated', description: 'Add a member to the team.', params: [
    { name: 'userId', in: 'body', type: 'string', required: true, description: 'User UUID to add' },
    { name: 'role', in: 'body', type: 'string', required: false, description: 'LEAD | MEMBER | ON_CALL' },
  ]},
  { method: 'DELETE', path: '/api/v1/teams/:id/members/:userId', auth: 'Authenticated', description: 'Remove a member from the team.' },
  { method: 'GET', path: '/api/v1/teams/:id/on-call', auth: 'Authenticated', description: 'Get the current on-call schedule for a team.' },
  { method: 'POST', path: '/api/v1/teams/:id/on-call', auth: 'ADMIN, MANAGER', description: 'Create an on-call schedule entry.', params: [
    { name: 'userId', in: 'body', type: 'string', required: true, description: 'User UUID for on-call' },
    { name: 'startTime', in: 'body', type: 'ISO 8601', required: true, description: 'Shift start' },
    { name: 'endTime', in: 'body', type: 'ISO 8601', required: true, description: 'Shift end' },
  ]},
  { method: 'GET', path: '/api/v1/teams/:id/on-call/history', auth: 'Authenticated', description: 'Get on-call history for a team (paginated).' },
  { method: 'GET', path: '/api/v1/teams/:id/escalation', auth: 'Authenticated', description: 'Get escalation policies and rules for a team.' },
];

export const DASHBOARD_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/dashboard/stats', auth: 'Authenticated', description: 'Get KPI dashboard statistics: open incidents, active changes, problem count, alert metrics, SLA compliance. Cached 30s.', exampleResponse: `{
  "success": true,
  "data": {
    "incidents": { "open": 12, "inProgress": 5, "resolvedToday": 3 },
    "changes": { "pending": 4, "scheduled": 2 },
    "problems": { "open": 7, "knownErrors": 3 },
    "alerts": { "firing": 8, "critical": 2, "warning": 6 },
    "sla": { "compliance": 94.2 }
  }
}` },
  { method: 'GET', path: '/api/v1/dashboard/incident-trend', auth: 'Authenticated', description: 'Get incident trend data over time. Cached 60s.', params: [
    { name: 'days', in: 'query', type: 'number', description: '7 | 30 | 90 (default: 7)' },
  ]},
  { method: 'GET', path: '/api/v1/dashboard/sla-compliance', auth: 'Authenticated', description: 'Get SLA compliance breakdown by priority level. Cached 60s.' },
];

export const SEARCH_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/search', auth: 'Authenticated', description: 'Global full-text search across incidents, changes, problems, alerts, and assets.', params: [
    { name: 'q', in: 'query', type: 'string', required: true, description: 'Search query (min 2 chars)' },
    { name: 'type', in: 'query', type: 'string', description: 'Filter by module: incident | change | problem | alert | asset' },
  ]},
];

export const REPORT_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/reports/incidents', auth: 'Authenticated', description: 'Generate incident report with date range, priority, and state filters.' },
  { method: 'GET', path: '/api/v1/reports/incident-trend', auth: 'Authenticated', description: 'Get incident trend analytics data.' },
  { method: 'GET', path: '/api/v1/reports/changes', auth: 'Authenticated', description: 'Generate change management report.' },
  { method: 'GET', path: '/api/v1/reports/team-performance', auth: 'ADMIN, MANAGER', description: 'Team performance metrics: MTTR, resolution rates, SLA adherence per team.' },
  { method: 'GET', path: '/api/v1/reports/executive-summary', auth: 'Authenticated', description: 'Generate executive summary with KPIs across all ITIL modules.' },
];

export const NOTIFICATION_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/notifications', auth: 'Authenticated', description: 'List user notifications with pagination.' },
  { method: 'GET', path: '/api/v1/notifications/unread-count', auth: 'Authenticated', description: 'Get the count of unread notifications.' },
  { method: 'PATCH', path: '/api/v1/notifications/:id/read', auth: 'Authenticated', description: 'Mark a single notification as read.' },
  { method: 'POST', path: '/api/v1/notifications/read-all', auth: 'Authenticated', description: 'Mark all notifications as read for the current user.' },
];

export const INTEGRATION_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/integrations', auth: 'Authenticated', description: 'List all integrations (PROMETHEUS, GRAFANA, KUBERNETES_CLUSTER, PAGERDUTY, STACKSTORM, APPRISE).' },
  { method: 'GET', path: '/api/v1/integrations/:id', auth: 'Authenticated', description: 'Get integration details including config JSON.' },
  { method: 'POST', path: '/api/v1/integrations', auth: 'ADMIN', description: 'Create a new integration.', params: [
    { name: 'name', in: 'body', type: 'string', required: true, description: 'Integration name' },
    { name: 'type', in: 'body', type: 'string', required: true, description: 'PROMETHEUS | GRAFANA | KUBERNETES_CLUSTER | PAGERDUTY | STACKSTORM | APPRISE' },
    { name: 'config', in: 'body', type: 'JSON string', required: true, description: 'Integration settings. SSH/local access fields (serverIp, sshUser, sshPort, accessMethod ssh|local) are set by WeCrew staff; organizations use accessMethod "direct" with their own public API URL and token. URLs must resolve to public addresses.' },
  ]},
  { method: 'PATCH', path: '/api/v1/integrations/:id', auth: 'ADMIN', description: 'Update an integration in your organization. id and organizationId in the body are ignored.' },
  { method: 'GET', path: '/api/v1/integrations/alert-webhook', auth: 'ADMIN', description: 'Get your organization\'s inbound alert-webhook token (created on first read). Append it as ?token= to the Alertmanager and Grafana webhook URLs.' },
  { method: 'POST', path: '/api/v1/integrations/alert-webhook/rotate', auth: 'ADMIN', description: 'Issue a new alert-webhook token. The old token stops working immediately — update every sender.' },
  { method: 'POST', path: '/api/v1/integrations/:id/test', auth: 'ADMIN, MANAGER', description: 'Test integration connectivity (attempts SSH/HTTP connection to the configured endpoint).' },
];

export const PAGERDUTY_ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/v1/pagerduty/webhook', auth: 'Token', description: 'PagerDuty webhook callback. Use the per-organization webhook URL returned by /pagerduty/connect (it carries ?token=); resolves matching incidents in that organization only.' },
  { method: 'POST', path: '/api/v1/pagerduty/validate', auth: 'ADMIN, MANAGER', description: 'Validate a PagerDuty API key.', params: [{ name: 'apiKey', in: 'body', type: 'string', required: true, description: 'PagerDuty REST API key' }] },
  { method: 'POST', path: '/api/v1/pagerduty/connect', auth: 'ADMIN', description: 'Connect PagerDuty integration (stores API key as integration config).' },
  { method: 'DELETE', path: '/api/v1/pagerduty/disconnect', auth: 'ADMIN', description: 'Disconnect PagerDuty integration.' },
  { method: 'GET', path: '/api/v1/pagerduty/status', auth: 'Authenticated', description: 'Get PagerDuty connection status and metadata.' },
  { method: 'GET', path: '/api/v1/pagerduty/overview', auth: 'Authenticated', description: 'Get PagerDuty overview: incident counts, service health, on-call summary.' },
  { method: 'GET', path: '/api/v1/pagerduty/services', auth: 'Authenticated', description: 'List PagerDuty services with current status.' },
  { method: 'GET', path: '/api/v1/pagerduty/incidents', auth: 'Authenticated', description: 'List PagerDuty incidents.' },
  { method: 'GET', path: '/api/v1/pagerduty/oncall', auth: 'Authenticated', description: 'Get current PagerDuty on-call assignments.' },
  { method: 'GET', path: '/api/v1/pagerduty/escalation-policies', auth: 'Authenticated', description: 'List PagerDuty escalation policies.' },
  { method: 'GET', path: '/api/v1/pagerduty/users', auth: 'Authenticated', description: 'List PagerDuty users.' },
  { method: 'GET', path: '/api/v1/pagerduty/stats', auth: 'Authenticated', description: 'Get PagerDuty incident statistics and analytics.' },
];

export const WEBHOOK_ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/v1/webhooks/alertmanager', auth: 'Token', description: 'Prometheus Alertmanager webhook. Auto-creates alerts and incidents (CRITICAL/WARNING). The ?token= decides the organization; a token holder can only touch its own organization\'s alerts.', params: [
    { name: 'token', in: 'query', type: 'string', required: true, description: 'Organization alert-webhook token (or Authorization: Bearer <token>)' },
  ]},
  { method: 'POST', path: '/api/v1/webhooks/grafana', auth: 'Token', description: 'Grafana webhook. Auto-creates incidents from Grafana alerts in the organization that owns the token.', params: [
    { name: 'token', in: 'query', type: 'string', required: true, description: 'Organization alert-webhook token' },
    { name: 'orgId / orgSlug', in: 'query', type: 'string', description: 'Legacy routing, accepted only while the deployment still allows token-less senders' },
  ]},
  { method: 'POST', path: '/api/v1/webhooks/slack/commands', auth: 'None', description: 'Slack slash command handler. Requests must carry a valid Slack signature (X-Slack-Signature) no older than 5 minutes.' },
  { method: 'POST', path: '/api/v1/webhooks/slack/interactive', auth: 'None', description: 'Slack interactive payload handler (acknowledge buttons). Signed requests only; actions apply only within the organization linked to the Slack workspace.' },
  { method: 'POST', path: '/api/v1/webhooks/servicenow', auth: 'None', description: 'ServiceNow bidirectional sync webhook.' },
  { method: 'POST', path: '/api/v1/webhooks/generic', auth: 'None', description: 'Generic webhook with flexible payload parsing. Use for custom integrations.' },
  { method: 'POST', path: '/api/v1/webhooks/twilio/sms', auth: 'None', description: 'Twilio inbound SMS handler.' },
  { method: 'POST', path: '/api/v1/webhooks/twilio/voice', auth: 'None', description: 'Twilio inbound voice call handler (IVR entry point).' },
  { method: 'POST', path: '/api/v1/webhooks/twilio/speech', auth: 'None', description: 'Twilio speech recognition input handler.' },
  { method: 'POST', path: '/api/v1/webhooks/twilio/gather', auth: 'None', description: 'Twilio DTMF keypress gather handler.' },
  { method: 'POST', path: '/api/v1/webhooks/twilio/status', auth: 'None', description: 'Twilio call status callback.' },
  { method: 'POST', path: '/api/v1/webhooks/msg91/delivery', auth: 'None', description: 'MSG91 SMS delivery status callback.' },
  { method: 'POST', path: '/api/v1/webhooks/kaleyra/delivery', auth: 'None', description: 'Kaleyra SMS delivery status callback.' },
];

export const K8S_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/k8s/overview', auth: 'Authenticated', description: 'Get Kubernetes cluster overview: node count, pod stats, namespace summary. Data fetched via SSH to remote cluster.' },
  { method: 'GET', path: '/api/v1/k8s/pods', auth: 'Authenticated', description: 'List pods with status, resource usage, and restart counts.', params: [
    { name: 'namespace', in: 'query', type: 'string', description: 'K8s namespace (default: all)' },
  ]},
  { method: 'GET', path: '/api/v1/k8s/deployments', auth: 'Authenticated', description: 'List deployments with replica status and rolling update info.' },
  { method: 'GET', path: '/api/v1/k8s/events', auth: 'Authenticated', description: 'List recent warning events across the cluster.' },
  { method: 'GET', path: '/api/v1/k8s/services', auth: 'Authenticated', description: 'List services with type, cluster IP, and port mappings.' },
];

export const APM_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/apm/overview', auth: 'Authenticated', description: 'Get complete APM overview: processes, URLs, infra, network, K8s, services, and alerts in one call.' },
  { method: 'GET', path: '/api/v1/apm/process-status', auth: 'Authenticated', description: 'Get process health monitoring data.' },
  { method: 'GET', path: '/api/v1/apm/url-status', auth: 'Authenticated', description: 'Get URL endpoint uptime monitoring.' },
  { method: 'GET', path: '/api/v1/apm/infra-metrics', auth: 'Authenticated', description: 'Get infrastructure metrics (CPU, memory, disk across all monitored nodes).' },
  { method: 'GET', path: '/api/v1/apm/network', auth: 'Authenticated', description: 'Get network health: latency, packet loss, throughput.' },
  { method: 'GET', path: '/api/v1/apm/k8s-health', auth: 'Authenticated', description: 'Get Kubernetes cluster health metrics.' },
  { method: 'GET', path: '/api/v1/apm/services', auth: 'Authenticated', description: 'Get service health across all monitored services.' },
  { method: 'GET', path: '/api/v1/apm/active-alerts', auth: 'Authenticated', description: 'Get currently active alerts from Prometheus.' },
  { method: 'POST', path: '/api/v1/apm/annotations', auth: 'Authenticated', description: 'Add a time-based annotation (deployment marker, incident start, etc.).', params: [
    { name: 'text', in: 'body', type: 'string', required: true, description: 'Annotation text' },
    { name: 'tags', in: 'body', type: 'string[]', required: false, description: 'Tags for categorization' },
  ]},
];

export const AI_AGENT_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/ai/cluster-health', auth: 'Platform admin', description: 'AI-analyzed Kubernetes cluster health. SSH-proxied to remote clusters. Cached 60s.' },
  { method: 'GET', path: '/api/v1/ai/server-analysis', auth: 'Platform admin', description: 'AI server analysis: CPU, memory, disk utilization with anomaly detection. Cached 60s.' },
  { method: 'GET', path: '/api/v1/ai/db-analysis', auth: 'Platform admin', description: 'Database metrics analysis: connections, query performance, replication lag. Cached 60s.' },
  { method: 'GET', path: '/api/v1/ai/log-analysis', auth: 'Platform admin', description: 'Log analysis from Loki: error patterns, anomalies, trending issues. Cached 30s.' },
  { method: 'GET', path: '/api/v1/ai/incidents/:id/resolution-details', auth: 'Authenticated', description: 'Get AI-generated resolution guidance for a specific incident based on alert patterns and KEDB.' },
  { method: 'GET', path: '/api/v1/ai/tips', auth: 'Authenticated', description: 'Get AI operational tips and recommendations. Cached 120s.' },
  { method: 'GET', path: '/api/v1/ai/grafana-dashboards', auth: 'Authenticated', description: 'List Grafana dashboards. SSH-proxied for remote orgs. Cached 300s.' },
  { method: 'GET', path: '/api/v1/ai/infrastructure-metrics', auth: 'Authenticated', description: 'Batch infrastructure metrics from Prometheus: all nodes, all metrics in one call. Cached 30s.' },
  { method: 'GET', path: '/api/v1/ai/stats', auth: 'Authenticated', description: 'AI usage statistics: classification counts, suggestion accuracy. Cached 30s.' },
  { method: 'GET', path: '/api/v1/ai/classifications', auth: 'Authenticated', description: 'Get AI incident/problem classifications (Claude + OpenAI).' },
  { method: 'GET', path: '/api/v1/ai/suggestions', auth: 'Authenticated', description: 'Get AI suggestions for open incidents and problems.' },
  { method: 'POST', path: '/api/v1/ai/chat', auth: 'Authenticated', description: 'Chat with Claude/OpenAI LLM for operational queries.', params: [
    { name: 'message', in: 'body', type: 'string', required: true, description: 'User message' },
    { name: 'context', in: 'body', type: 'string', required: false, description: 'Additional context (incident ID, etc.)' },
  ]},
];

export const AGENT_PIPELINE_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/agent/status', auth: 'Authenticated', description: 'Get Agent Pipeline status (enabled/disabled) and summary metrics.' },
  { method: 'POST', path: '/api/v1/agent/toggle', auth: 'ADMIN, MANAGER', description: 'Enable or disable the Agent Pipeline globally.' },
  { method: 'GET', path: '/api/v1/agent/actions', auth: 'Authenticated', description: 'List all 8 remediation actions: disk-cleanup, pod-restart, service-restart, memory-release, log-rotate, container-prune, deployment-scale, ssl-check.' },
  { method: 'POST', path: '/api/v1/agent/actions/:actionId/toggle', auth: 'ADMIN, MANAGER', description: 'Enable or disable a specific remediation action.' },
  { method: 'GET', path: '/api/v1/agent/notifications', auth: 'Authenticated', description: 'List notification rules: critical-slack, critical-pagerduty, warning-slack, incident-slack.' },
  { method: 'POST', path: '/api/v1/agent/notifications/:ruleId/toggle', auth: 'ADMIN, MANAGER', description: 'Enable or disable a notification rule.' },
  { method: 'GET', path: '/api/v1/agent/executions', auth: 'Authenticated', description: 'Get Agent Pipeline execution log with results.' },
  { method: 'GET', path: '/api/v1/agent/executions/:id', auth: 'Authenticated', description: 'Get execution detail: input, actions taken, output, duration.' },
];

export const SMS_ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/v1/sms/send', auth: 'ADMIN, MANAGER, ENGINEER', description: 'Send a single SMS via configured provider (Twilio, MSG91, or Kaleyra).', params: [
    { name: 'to', in: 'body', type: 'string', required: true, description: 'Phone number (E.164 format)' },
    { name: 'message', in: 'body', type: 'string', required: true, description: 'SMS body text' },
  ]},
  { method: 'POST', path: '/api/v1/sms/bulk', auth: 'ADMIN, MANAGER', description: 'Send bulk SMS to multiple recipients.' },
  { method: 'GET', path: '/api/v1/sms/logs', auth: 'Authenticated', description: 'Get SMS logs with pagination and filtering.' },
  { method: 'GET', path: '/api/v1/sms/logs/:id', auth: 'Authenticated', description: 'Get detailed SMS log entry.' },
  { method: 'GET', path: '/api/v1/sms/stats', auth: 'Authenticated', description: 'Get SMS statistics: sent, delivered, failed counts.' },
  { method: 'GET', path: '/api/v1/sms/providers', auth: 'Platform admin', description: 'Get SMS provider configuration and health status.' },
  { method: 'GET', path: '/api/v1/sms/delivery-status/:messageId', auth: 'Authenticated', description: 'Check delivery status of a specific SMS.' },
];

export const VOICE_ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/v1/voice/transcribe', auth: 'Authenticated', description: 'Transcribe audio to text using Whisper STT. Accepts audio file upload (max 25MB).', params: [
    { name: 'audio', in: 'body', type: 'file', required: true, description: 'Audio file (multipart/form-data)' },
    { name: 'language', in: 'body', type: 'string', required: false, description: 'Language code (default: en)' },
  ]},
  { method: 'POST', path: '/api/v1/voice/synthesize', auth: 'Authenticated', description: 'Convert text to speech using XTTS v2. Returns audio stream.', params: [
    { name: 'text', in: 'body', type: 'string', required: true, description: 'Text to synthesize' },
    { name: 'language', in: 'body', type: 'string', required: false, description: 'Language code' },
  ]},
  { method: 'POST', path: '/api/v1/voice/chat', auth: 'Authenticated', description: 'Voice chat: transcribe audio → AI response → synthesize speech. Full voice-to-voice pipeline.' },
  { method: 'POST', path: '/api/v1/voice/call', auth: 'ADMIN, MANAGER', description: 'Initiate an outbound voice call via Twilio.', params: [
    { name: 'to', in: 'body', type: 'string', required: true, description: 'Phone number (E.164)' },
    { name: 'incidentId', in: 'body', type: 'string', required: false, description: 'Related incident for IVR context' },
  ]},
  { method: 'GET', path: '/api/v1/voice/calls', auth: 'Authenticated', description: 'Get voice call logs with pagination.' },
  { method: 'GET', path: '/api/v1/voice/calls/:id', auth: 'Authenticated', description: 'Get detailed call log.' },
  { method: 'GET', path: '/api/v1/voice/stats', auth: 'Authenticated', description: 'Get voice call statistics.' },
  { method: 'GET', path: '/api/v1/voice/languages', auth: 'Authenticated', description: 'List supported STT/TTS languages.' },
  { method: 'GET', path: '/api/v1/voice/health', auth: 'Authenticated', description: 'Check voice service health (Whisper STT + XTTS v2 TTS servers).' },
];

export const ORG_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/organizations', auth: 'Platform admin', description: 'List all organizations.' },
  { method: 'GET', path: '/api/v1/organizations/:id', auth: 'Platform admin', description: 'Get organization details.' },
  { method: 'POST', path: '/api/v1/organizations', auth: 'Platform admin', description: 'Create a new organization.', params: [
    { name: 'name', in: 'body', type: 'string', required: true, description: 'Organization name' },
    { name: 'slug', in: 'body', type: 'string', required: true, description: 'URL-safe slug' },
    { name: 'environment', in: 'body', type: 'string', required: true, description: 'PROD | DR | UAT | DEV' },
    { name: 'serverIp', in: 'body', type: 'string', required: false, description: 'Server IP for SSH access' },
    { name: 'fqdn', in: 'body', type: 'string', required: false, description: 'Fully qualified domain name' },
  ]},
  { method: 'PATCH', path: '/api/v1/organizations/:id', auth: 'Platform admin', description: 'Update organization details.' },
];

export const BILLING_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/billing/plans', auth: 'Authenticated', description: 'List active plans: TRIAL, STARTER, ENTERPRISE. Amounts are in paise (STARTER = 3000000 = ₹30,000/year).' },
  { method: 'GET', path: '/api/v1/billing/subscription', auth: 'Authenticated', description: 'Your organization\'s access state: tier, status, isReadOnly, daysRemaining, seatsUsed, seatLimit.' },
  { method: 'POST', path: '/api/v1/billing/subscribe', auth: 'ADMIN', description: 'Start Razorpay checkout for a tier. Returns subscriptionId and keyId for Razorpay Checkout. 409 if the organization already has an active subscription.', params: [
    { name: 'tier', in: 'body', type: 'string', required: true, description: 'STARTER (ENTERPRISE is sales-led)' },
  ]},
  { method: 'POST', path: '/api/v1/billing/verify', auth: 'ADMIN', description: 'Confirm checkout with the Razorpay payment signature. The Razorpay webhook remains the source of truth.', params: [
    { name: 'razorpay_payment_id', in: 'body', type: 'string', required: true, description: 'From Checkout' },
    { name: 'razorpay_subscription_id', in: 'body', type: 'string', required: true, description: 'From Checkout' },
    { name: 'razorpay_signature', in: 'body', type: 'string', required: true, description: 'From Checkout' },
  ]},
  { method: 'POST', path: '/api/v1/billing/cancel', auth: 'ADMIN', description: 'Cancel at the end of the paid period. Access continues until then.' },
  { method: 'POST', path: '/api/v1/webhooks/razorpay', auth: 'None', description: 'Razorpay subscription events. Verified with the webhook signature (X-Razorpay-Signature) over the raw body; duplicate deliveries are ignored.' },
];

export const AUDIT_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/audit', auth: 'ADMIN, MANAGER', description: 'Audit log with filters (action, entityType, userId, startDate, endDate, search). Shows entries made by users of your organization; platform admins see all.' },
  { method: 'GET', path: '/api/v1/audit/entity-types', auth: 'ADMIN, MANAGER', description: 'Distinct entity types present in your audit log.' },
];

export const CHAT_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/chat/teams', auth: 'Authenticated', description: 'Teams you can chat in: your teams, or every team in your organization for ADMIN/MANAGER.' },
  { method: 'GET', path: '/api/v1/chat/teams/:teamId/messages', auth: 'Authenticated', description: 'Message history for a team.' },
  { method: 'POST', path: '/api/v1/chat/teams/:teamId/messages', auth: 'Authenticated', description: 'Post a message to a team.', params: [
    { name: 'body', in: 'body', type: 'string', required: true, description: 'Message text' },
  ]},
];

export const PUBLIC_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/status/:orgSlug', auth: 'None', description: 'Public status page data for an organization: open incidents, affected services and recent alerts.' },
  { method: 'POST', path: '/api/v1/public/leads', auth: 'None', description: 'Marketing-site lead form (pilot / demo requests). Rate limited.' },
];
