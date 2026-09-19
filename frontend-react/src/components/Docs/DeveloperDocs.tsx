import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Copy, Check, Search, Menu, X,
  BookOpen, Shield, Building2, Gauge, AlertTriangle, Server,
  Users, BarChart3, Zap, Globe, Brain, Terminal, MessageSquare,
  Phone, ArrowLeft, ExternalLink, Code2, Database, Radio,
  Layers, Bell, FileText, Network, Bot, Webhook,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   WeCrew ITSM — Developer Documentation
   Comprehensive API reference & integration guide
   ═══════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: 'None' | 'Authenticated' | 'ADMIN' | 'ADMIN, MANAGER' | 'ADMIN, MANAGER, ENGINEER';
  params?: { name: string; in: 'path' | 'query' | 'body' | 'header'; type: string; required?: boolean; description: string }[];
  exampleRequest?: string;
  exampleResponse?: string;
}

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content?: React.ReactNode;
  endpoints?: Endpoint[];
}

interface SidebarGroup {
  title: string;
  sections: DocSection[];
}

// ── Constants ──────────────────────────────────────────────

const METHOD_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  GET: { bg: 'bg-[#059669]/10', text: 'text-[#059669]', border: 'border-[#059669]/20' },
  POST: { bg: 'bg-[#3B82F6]/10', text: 'text-[#3B82F6]', border: 'border-[#3B82F6]/20' },
  PUT: { bg: 'bg-[#8B5CF6]/10', text: 'text-[#8B5CF6]', border: 'border-[#8B5CF6]/20' },
  PATCH: { bg: 'bg-[#D97706]/10', text: 'text-[#D97706]', border: 'border-[#D97706]/20' },
  DELETE: { bg: 'bg-[#DC2626]/10', text: 'text-[#DC2626]', border: 'border-[#DC2626]/20' },
};

const AUTH_BADGE: Record<string, { bg: string; text: string }> = {
  None: { bg: 'bg-[#059669]/8', text: 'text-[#059669]' },
  Authenticated: { bg: 'bg-[#3B82F6]/8', text: 'text-[#3B82F6]' },
  ADMIN: { bg: 'bg-[#DC2626]/8', text: 'text-[#DC2626]' },
  'ADMIN, MANAGER': { bg: 'bg-[#D97706]/8', text: 'text-[#D97706]' },
  'ADMIN, MANAGER, ENGINEER': { bg: 'bg-[#8B5CF6]/8', text: 'text-[#8B5CF6]' },
};

// ── Code Block Component ───────────────────────────────────

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-xl overflow-hidden border border-[#1E293B] my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0F172A] border-b border-[#1E293B]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569]">{language}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-[10px] font-mono text-[#475569] hover:text-[#94A3B8] transition-colors">
          {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <pre className="p-4 bg-[#0B1120] overflow-x-auto text-[12px] leading-relaxed">
        <code className="font-mono text-[#E2E8F0] whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

// ── Method Badge ───────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const s = METHOD_STYLES[method] || METHOD_STYLES.GET;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wide border ${s.bg} ${s.text} ${s.border}`}>
      {method}
    </span>
  );
}

// ── Endpoint Card ──────────────────────────────────────────

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  const ab = AUTH_BADGE[ep.auth] || AUTH_BADGE.Authenticated;

  return (
    <div className="border border-[#E7E5E4] rounded-xl overflow-hidden mb-3 hover:border-[#D6D3D1] transition-colors hover:shadow-card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAF9] transition-colors">
        <MethodBadge method={ep.method} />
        <code className="text-[13px] font-mono font-medium text-[#1E293B] flex-1">{ep.path}</code>
        <span className={`hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-medium ${ab.bg} ${ab.text}`}>{ep.auth}</span>
        <ChevronDown size={14} className={`text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-[#E7E5E4] bg-[#FAFAF9]/50">
          <p className="text-[13px] text-[#475569] mt-3 mb-3 leading-relaxed">{ep.description}</p>
          {ep.params && ep.params.length > 0 && (
            <div className="mb-3">
              <h5 className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] mb-2">Parameters</h5>
              <div className="border border-[#E7E5E4] rounded-lg overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead><tr className="bg-[#F5F5F4]">
                    <th className="text-left px-3 py-2 font-mono font-medium text-[#475569]">Name</th>
                    <th className="text-left px-3 py-2 font-mono font-medium text-[#475569]">In</th>
                    <th className="text-left px-3 py-2 font-mono font-medium text-[#475569]">Type</th>
                    <th className="text-left px-3 py-2 font-mono font-medium text-[#475569] hidden sm:table-cell">Description</th>
                  </tr></thead>
                  <tbody>
                    {ep.params.map((p, i) => (
                      <tr key={i} className="border-t border-[#E7E5E4]">
                        <td className="px-3 py-2 font-mono text-[#1E293B]">{p.name}{p.required && <span className="text-[#DC2626] ml-0.5">*</span>}</td>
                        <td className="px-3 py-2 text-[#94A3B8]">{p.in}</td>
                        <td className="px-3 py-2 font-mono text-[#8B5CF6]">{p.type}</td>
                        <td className="px-3 py-2 text-[#475569] hidden sm:table-cell">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {ep.exampleRequest && <CodeBlock code={ep.exampleRequest} language="bash" />}
          {ep.exampleResponse && <CodeBlock code={ep.exampleResponse} language="json" />}
        </div>
      )}
    </div>
  );
}

// ── Prose Components ───────────────────────────────────────

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[15px] font-display font-semibold text-[#1E293B] mt-8 mb-3 flex items-center gap-2">{children}</h3>;
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-[1.8] text-[#475569] mb-3">{children}</p>;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded text-[12px] font-mono text-[#7C3AED]">{children}</code>;
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-[#3B82F6]/20 bg-[#3B82F6]/[0.03] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
        <span className="text-[12px] font-display font-semibold text-[#3B82F6] uppercase tracking-wide">{title}</span>
      </div>
      <div className="text-[12.5px] leading-[1.8] text-[#475569]">{children}</div>
    </div>
  );
}

function WarnBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-[#D97706]/20 bg-[#D97706]/[0.03] p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={13} className="text-[#D97706]" />
        <span className="text-[12px] font-display font-semibold text-[#D97706] uppercase tracking-wide">{title}</span>
      </div>
      <div className="text-[12.5px] leading-[1.8] text-[#475569]">{children}</div>
    </div>
  );
}

// ── Section Content Builders ───────────────────────────────

function IntroductionContent() {
  return (<>
    <Para>
      Welcome to the <strong>WeCrew ITSM API</strong>. WeCrew is an enterprise IT Service Management platform that provides a comprehensive REST API for managing Incidents, Changes, Problems, Alerts, Assets/CMDB, Teams, On-Call, and integrations with Prometheus, Grafana, Kubernetes, Slack, PagerDuty, and more.
    </Para>
    <Heading>Base URL</Heading>
    <CodeBlock code={`${window.location.origin}/api/v1`} language="text" />
    <Para>
      All API endpoints are prefixed with <InlineCode>/api/v1</InlineCode>. The API accepts JSON request bodies and returns JSON responses. All timestamps use ISO 8601 format.
    </Para>
    <Heading>Quick Start</Heading>
    <Para>1. Authenticate to get an access token:</Para>
    <CodeBlock code={`curl -X POST ${window.location.origin}/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@argus.io", "password": "your-password"}'`} />
    <Para>2. Use the token for subsequent requests:</Para>
    <CodeBlock code={`curl ${window.location.origin}/api/v1/incidents \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "X-Organization-Id: <orgId>"`} />
    <Heading>Supported Integrations</Heading>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-4">
      {['Prometheus', 'Grafana', 'Kubernetes', 'PagerDuty', 'Slack', 'ServiceNow', 'StackStorm', 'Apprise', 'Twilio'].map(name => (
        <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E7E5E4] bg-[#FAFAF9] text-[12px] font-medium text-[#475569]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#059669]" />{name}
        </div>
      ))}
    </div>
  </>);
}

function AuthenticationContent() {
  return (<>
    <Para>
      WeCrew uses <strong>JWT (JSON Web Tokens)</strong> for authentication. Obtain an access token via login, then include it as a Bearer token in all subsequent requests.
    </Para>
    <Heading>Authentication Flow</Heading>
    <div className="my-4 flex flex-col gap-2">
      {[
        { step: '1', label: 'Login', desc: 'POST /auth/login with email + password' },
        { step: '2', label: 'Receive Tokens', desc: 'accessToken (15m) + refreshToken (7d)' },
        { step: '3', label: 'Make Requests', desc: 'Authorization: Bearer <accessToken>' },
        { step: '4', label: 'Refresh', desc: 'POST /auth/refresh when access token expires' },
      ].map(s => (
        <div key={s.step} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9]">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4F46E5]/10 text-[#4F46E5] text-[11px] font-mono font-bold flex items-center justify-center">{s.step}</span>
          <div><div className="text-[13px] font-medium text-[#1E293B]">{s.label}</div><div className="text-[12px] text-[#475569]">{s.desc}</div></div>
        </div>
      ))}
    </div>
    <Heading>Token Expiry</Heading>
    <div className="border border-[#E7E5E4] rounded-lg overflow-hidden my-3">
      <table className="w-full text-[12px]">
        <thead><tr className="bg-[#F5F5F4]"><th className="text-left px-3 py-2 font-medium text-[#475569]">Token</th><th className="text-left px-3 py-2 font-medium text-[#475569]">Expiry</th><th className="text-left px-3 py-2 font-medium text-[#475569]">Storage</th></tr></thead>
        <tbody>
          <tr className="border-t border-[#E7E5E4]"><td className="px-3 py-2 font-mono text-[#1E293B]">accessToken</td><td className="px-3 py-2 text-[#475569]">15 minutes</td><td className="px-3 py-2 text-[#475569]">Memory / localStorage</td></tr>
          <tr className="border-t border-[#E7E5E4]"><td className="px-3 py-2 font-mono text-[#1E293B]">refreshToken</td><td className="px-3 py-2 text-[#475569]">7 days</td><td className="px-3 py-2 text-[#475569]">httpOnly cookie</td></tr>
        </tbody>
      </table>
    </div>
    <Heading>RBAC Roles</Heading>
    <Para>WeCrew uses Role-Based Access Control with 5 hierarchical roles:</Para>
    <div className="border border-[#E7E5E4] rounded-lg overflow-hidden my-3">
      <table className="w-full text-[12px]">
        <thead><tr className="bg-[#F5F5F4]"><th className="text-left px-3 py-2 font-medium text-[#475569]">Role</th><th className="text-left px-3 py-2 font-medium text-[#475569]">Permissions</th></tr></thead>
        <tbody>
          {[
            ['ADMIN', 'Full platform access, org management, user management, integrations'],
            ['MANAGER', 'Team management, report access, escalation policies, on-call schedules'],
            ['ENGINEER', 'Create/update incidents, changes, problems, assets, alerts'],
            ['OPERATOR', 'Acknowledge alerts, update incident state, view dashboards'],
            ['VIEWER', 'Read-only access to all ITIL modules and dashboards'],
          ].map(([role, perm]) => (
            <tr key={role} className="border-t border-[#E7E5E4]">
              <td className="px-3 py-2 font-mono font-medium text-[#1E293B]">{role}</td>
              <td className="px-3 py-2 text-[#475569]">{perm}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>);
}

function MultiTenantContent() {
  return (<>
    <Para>
      WeCrew is a multi-tenant platform where every resource is scoped to an <InlineCode>organizationId</InlineCode>. Tenant isolation is enforced at the middleware layer — every query automatically filters by the authenticated user's organization.
    </Para>
    <Heading>How It Works</Heading>
    <Para>
      <strong>Non-ADMIN users</strong> are automatically locked to their assigned organization. No additional headers needed — the API filters all data to their org.
    </Para>
    <Para>
      <strong>ADMIN users</strong> see all organizations by default. To filter to a specific org, send the <InlineCode>X-Organization-Id</InlineCode> header:
    </Para>
    <CodeBlock code={`curl ${window.location.origin}/api/v1/incidents \\
  -H "Authorization: Bearer <token>" \\
  -H "X-Organization-Id: 78b981f8-4df8-4c74-8a59-c9ea3fd8be6c"`} />
    <InfoBox title="Alternative">
      You can also pass <InlineCode>?orgId=UUID</InlineCode> as a query parameter instead of the header.
    </InfoBox>
    <Heading>Organization Object</Heading>
    <CodeBlock code={`{
  "id": "78b981f8-4df8-4c74-8a59-c9ea3fd8be6c",
  "name": "Lemonn Financial",
  "slug": "lemonn-le",
  "environment": "PROD",
  "fqdn": "lemonn.wecrew.in",
  "serverIp": "154.210.170.126",
  "isActive": true
}`} language="json" />
  </>);
}

function RateLimitContent() {
  return (<>
    <Para>
      The API enforces rate limiting to protect against abuse. Limits are applied per IP address globally, with stricter limits on authentication endpoints.
    </Para>
    <div className="border border-[#E7E5E4] rounded-lg overflow-hidden my-3">
      <table className="w-full text-[12px]">
        <thead><tr className="bg-[#F5F5F4]"><th className="text-left px-3 py-2 font-medium text-[#475569]">Scope</th><th className="text-left px-3 py-2 font-medium text-[#475569]">Limit</th><th className="text-left px-3 py-2 font-medium text-[#475569]">Window</th></tr></thead>
        <tbody>
          <tr className="border-t border-[#E7E5E4]"><td className="px-3 py-2 text-[#1E293B]">Global API</td><td className="px-3 py-2 font-mono text-[#475569]">100 requests</td><td className="px-3 py-2 text-[#475569]">15 minutes</td></tr>
          <tr className="border-t border-[#E7E5E4]"><td className="px-3 py-2 text-[#1E293B]">Auth endpoints</td><td className="px-3 py-2 font-mono text-[#475569]">5 requests</td><td className="px-3 py-2 text-[#475569]">15 minutes</td></tr>
          <tr className="border-t border-[#E7E5E4]"><td className="px-3 py-2 text-[#1E293B]">Webhook endpoints</td><td className="px-3 py-2 font-mono text-[#475569]">50 requests</td><td className="px-3 py-2 text-[#475569]">1 minute</td></tr>
        </tbody>
      </table>
    </div>
    <Para>When rate limited, the API returns HTTP <InlineCode>429 Too Many Requests</InlineCode> with a <InlineCode>Retry-After</InlineCode> header.</Para>
  </>);
}

function ResponseFormatContent() {
  return (<>
    <Para>All API responses follow a consistent JSON envelope format:</Para>
    <Heading>Success Response</Heading>
    <CodeBlock code={`{
  "success": true,
  "data": { ... }
}`} language="json" />
    <Heading>Paginated Response</Heading>
    <CodeBlock code={`{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 247,
    "page": 1,
    "limit": 20,
    "pages": 13
  }
}`} language="json" />
    <Para>Use <InlineCode>?page=N&limit=N</InlineCode> query parameters to control pagination. Default limit is 20, maximum is 100.</Para>
    <Heading>Error Response</Heading>
    <CodeBlock code={`{
  "success": false,
  "error": "Incident not found"
}`} language="json" />
  </>);
}

function ErrorsContent() {
  return (<>
    <Para>The API uses standard HTTP status codes to indicate success or failure:</Para>
    <div className="border border-[#E7E5E4] rounded-lg overflow-hidden my-3">
      <table className="w-full text-[12px]">
        <thead><tr className="bg-[#F5F5F4]"><th className="text-left px-3 py-2 font-medium text-[#475569]">Code</th><th className="text-left px-3 py-2 font-medium text-[#475569]">Meaning</th></tr></thead>
        <tbody>
          {[
            ['200', 'OK — Request succeeded'],
            ['201', 'Created — Resource created successfully'],
            ['400', 'Bad Request — Invalid parameters or body'],
            ['401', 'Unauthorized — Missing or invalid token'],
            ['403', 'Forbidden — Insufficient role permissions'],
            ['404', 'Not Found — Resource does not exist'],
            ['423', 'Locked — Account locked due to too many login attempts'],
            ['429', 'Too Many Requests — Rate limit exceeded'],
            ['500', 'Internal Server Error — Server-side failure'],
          ].map(([code, desc]) => (
            <tr key={code} className="border-t border-[#E7E5E4]">
              <td className="px-3 py-2 font-mono font-medium text-[#1E293B]">{code}</td>
              <td className="px-3 py-2 text-[#475569]">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>);
}

// ── Endpoint Data ──────────────────────────────────────────

const AUTH_ENDPOINTS: Endpoint[] = [
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
    description: 'Register a new user. Only ADMINs can create accounts. The new user is assigned to an organization.',
    params: [
      { name: 'email', in: 'body', type: 'string', required: true, description: 'User email' },
      { name: 'password', in: 'body', type: 'string', required: true, description: 'Min 8 characters' },
      { name: 'firstName', in: 'body', type: 'string', required: true, description: 'First name' },
      { name: 'lastName', in: 'body', type: 'string', required: true, description: 'Last name' },
      { name: 'role', in: 'body', type: 'string', required: true, description: 'ADMIN | MANAGER | ENGINEER | OPERATOR | VIEWER' },
      { name: 'organizationId', in: 'body', type: 'string', required: false, description: 'Organization UUID' },
    ],
    exampleResponse: `{ "success": true, "data": { "id": "uuid", "email": "new@argus.io", "role": "ENGINEER" } }`,
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

const INCIDENT_ENDPOINTS: Endpoint[] = [
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

const CHANGE_ENDPOINTS: Endpoint[] = [
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

const PROBLEM_ENDPOINTS: Endpoint[] = [
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

const ALERT_ENDPOINTS: Endpoint[] = [
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

const ASSET_ENDPOINTS: Endpoint[] = [
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

const TEAM_ENDPOINTS: Endpoint[] = [
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

const DASHBOARD_ENDPOINTS: Endpoint[] = [
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

const SEARCH_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/search', auth: 'Authenticated', description: 'Global full-text search across incidents, changes, problems, alerts, and assets.', params: [
    { name: 'q', in: 'query', type: 'string', required: true, description: 'Search query (min 2 chars)' },
    { name: 'type', in: 'query', type: 'string', description: 'Filter by module: incident | change | problem | alert | asset' },
  ]},
];

const REPORT_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/reports/incidents', auth: 'Authenticated', description: 'Generate incident report with date range, priority, and state filters.' },
  { method: 'GET', path: '/api/v1/reports/incident-trend', auth: 'Authenticated', description: 'Get incident trend analytics data.' },
  { method: 'GET', path: '/api/v1/reports/changes', auth: 'Authenticated', description: 'Generate change management report.' },
  { method: 'GET', path: '/api/v1/reports/team-performance', auth: 'ADMIN, MANAGER', description: 'Team performance metrics: MTTR, resolution rates, SLA adherence per team.' },
  { method: 'GET', path: '/api/v1/reports/executive-summary', auth: 'Authenticated', description: 'Generate executive summary with KPIs across all ITIL modules.' },
];

const NOTIFICATION_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/notifications', auth: 'Authenticated', description: 'List user notifications with pagination.' },
  { method: 'GET', path: '/api/v1/notifications/unread-count', auth: 'Authenticated', description: 'Get the count of unread notifications.' },
  { method: 'PATCH', path: '/api/v1/notifications/:id/read', auth: 'Authenticated', description: 'Mark a single notification as read.' },
  { method: 'POST', path: '/api/v1/notifications/read-all', auth: 'Authenticated', description: 'Mark all notifications as read for the current user.' },
];

const INTEGRATION_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/integrations', auth: 'Authenticated', description: 'List all integrations (PROMETHEUS, GRAFANA, KUBERNETES_CLUSTER, PAGERDUTY, STACKSTORM, APPRISE).' },
  { method: 'GET', path: '/api/v1/integrations/:id', auth: 'Authenticated', description: 'Get integration details including config JSON.' },
  { method: 'POST', path: '/api/v1/integrations', auth: 'ADMIN', description: 'Create a new integration.', params: [
    { name: 'name', in: 'body', type: 'string', required: true, description: 'Integration name' },
    { name: 'type', in: 'body', type: 'string', required: true, description: 'PROMETHEUS | GRAFANA | KUBERNETES_CLUSTER | PAGERDUTY | STACKSTORM | APPRISE' },
    { name: 'config', in: 'body', type: 'JSON string', required: true, description: '{"accessMethod":"ssh","serverIp":"...","sshPort":4422,"sshUser":"finadmin","promPort":30000}' },
  ]},
  { method: 'PATCH', path: '/api/v1/integrations/:id', auth: 'ADMIN', description: 'Update an integration.' },
  { method: 'POST', path: '/api/v1/integrations/:id/test', auth: 'ADMIN, MANAGER', description: 'Test integration connectivity (attempts SSH/HTTP connection to the configured endpoint).' },
];

const PAGERDUTY_ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/v1/pagerduty/webhook', auth: 'None', description: 'PagerDuty webhook callback. Receives incident events and syncs them to WeCrew.' },
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

const WEBHOOK_ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/v1/webhooks/alertmanager', auth: 'None', description: 'Prometheus Alertmanager webhook. Auto-creates alerts and incidents (CRITICAL/WARNING). Triggers Agent Pipeline for auto-remediation.' },
  { method: 'POST', path: '/api/v1/webhooks/grafana', auth: 'None', description: 'Grafana webhook. Supports orgId query param for multi-tenant routing. Auto-creates incidents from Grafana alerts.', params: [
    { name: 'orgId', in: 'query', type: 'string', description: 'Organization UUID for tenant routing' },
    { name: 'orgSlug', in: 'query', type: 'string', description: 'Alternative: organization slug' },
  ]},
  { method: 'POST', path: '/api/v1/webhooks/slack/commands', auth: 'None', description: 'Slack slash command handler (/argus incident, /argus status, etc.).' },
  { method: 'POST', path: '/api/v1/webhooks/slack/interactive', auth: 'None', description: 'Slack interactive payload handler (buttons, modals, dropdowns).' },
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

const K8S_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/k8s/overview', auth: 'Authenticated', description: 'Get Kubernetes cluster overview: node count, pod stats, namespace summary. Data fetched via SSH to remote cluster.' },
  { method: 'GET', path: '/api/v1/k8s/pods', auth: 'Authenticated', description: 'List pods with status, resource usage, and restart counts.', params: [
    { name: 'namespace', in: 'query', type: 'string', description: 'K8s namespace (default: all)' },
  ]},
  { method: 'GET', path: '/api/v1/k8s/deployments', auth: 'Authenticated', description: 'List deployments with replica status and rolling update info.' },
  { method: 'GET', path: '/api/v1/k8s/events', auth: 'Authenticated', description: 'List recent warning events across the cluster.' },
  { method: 'GET', path: '/api/v1/k8s/services', auth: 'Authenticated', description: 'List services with type, cluster IP, and port mappings.' },
];

const APM_ENDPOINTS: Endpoint[] = [
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

const AI_AGENT_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/ai/cluster-health', auth: 'Authenticated', description: 'AI-analyzed Kubernetes cluster health. SSH-proxied to remote clusters. Cached 60s.' },
  { method: 'GET', path: '/api/v1/ai/server-analysis', auth: 'Authenticated', description: 'AI server analysis: CPU, memory, disk utilization with anomaly detection. Cached 60s.' },
  { method: 'GET', path: '/api/v1/ai/db-analysis', auth: 'Authenticated', description: 'Database metrics analysis: connections, query performance, replication lag. Cached 60s.' },
  { method: 'GET', path: '/api/v1/ai/log-analysis', auth: 'Authenticated', description: 'Log analysis from Loki: error patterns, anomalies, trending issues. Cached 30s.' },
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

const AGENT_PIPELINE_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/agent/status', auth: 'Authenticated', description: 'Get Agent Pipeline status (enabled/disabled) and summary metrics.' },
  { method: 'POST', path: '/api/v1/agent/toggle', auth: 'ADMIN, MANAGER', description: 'Enable or disable the Agent Pipeline globally.' },
  { method: 'GET', path: '/api/v1/agent/actions', auth: 'Authenticated', description: 'List all 8 remediation actions: disk-cleanup, pod-restart, service-restart, memory-release, log-rotate, container-prune, deployment-scale, ssl-check.' },
  { method: 'POST', path: '/api/v1/agent/actions/:actionId/toggle', auth: 'ADMIN, MANAGER', description: 'Enable or disable a specific remediation action.' },
  { method: 'GET', path: '/api/v1/agent/notifications', auth: 'Authenticated', description: 'List notification rules: critical-slack, critical-pagerduty, warning-slack, incident-slack.' },
  { method: 'POST', path: '/api/v1/agent/notifications/:ruleId/toggle', auth: 'ADMIN, MANAGER', description: 'Enable or disable a notification rule.' },
  { method: 'GET', path: '/api/v1/agent/executions', auth: 'Authenticated', description: 'Get Agent Pipeline execution log with results.' },
  { method: 'GET', path: '/api/v1/agent/executions/:id', auth: 'Authenticated', description: 'Get execution detail: input, actions taken, output, duration.' },
];

const SMS_ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/v1/sms/send', auth: 'ADMIN, MANAGER, ENGINEER', description: 'Send a single SMS via configured provider (Twilio, MSG91, or Kaleyra).', params: [
    { name: 'to', in: 'body', type: 'string', required: true, description: 'Phone number (E.164 format)' },
    { name: 'message', in: 'body', type: 'string', required: true, description: 'SMS body text' },
  ]},
  { method: 'POST', path: '/api/v1/sms/bulk', auth: 'ADMIN, MANAGER', description: 'Send bulk SMS to multiple recipients.' },
  { method: 'GET', path: '/api/v1/sms/logs', auth: 'Authenticated', description: 'Get SMS logs with pagination and filtering.' },
  { method: 'GET', path: '/api/v1/sms/logs/:id', auth: 'Authenticated', description: 'Get detailed SMS log entry.' },
  { method: 'GET', path: '/api/v1/sms/stats', auth: 'Authenticated', description: 'Get SMS statistics: sent, delivered, failed counts.' },
  { method: 'GET', path: '/api/v1/sms/providers', auth: 'ADMIN', description: 'Get SMS provider configuration and health status.' },
  { method: 'GET', path: '/api/v1/sms/delivery-status/:messageId', auth: 'Authenticated', description: 'Check delivery status of a specific SMS.' },
];

const VOICE_ENDPOINTS: Endpoint[] = [
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

const ORG_ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/organizations', auth: 'ADMIN', description: 'List all organizations.' },
  { method: 'GET', path: '/api/v1/organizations/:id', auth: 'ADMIN', description: 'Get organization details.' },
  { method: 'POST', path: '/api/v1/organizations', auth: 'ADMIN', description: 'Create a new organization.', params: [
    { name: 'name', in: 'body', type: 'string', required: true, description: 'Organization name' },
    { name: 'slug', in: 'body', type: 'string', required: true, description: 'URL-safe slug' },
    { name: 'environment', in: 'body', type: 'string', required: true, description: 'PROD | DR | UAT | DEV' },
    { name: 'serverIp', in: 'body', type: 'string', required: false, description: 'Server IP for SSH access' },
    { name: 'fqdn', in: 'body', type: 'string', required: false, description: 'Fully qualified domain name' },
  ]},
  { method: 'PATCH', path: '/api/v1/organizations/:id', auth: 'ADMIN', description: 'Update organization details.' },
];

// ── Build Sections ─────────────────────────────────────────

function buildSections(): SidebarGroup[] {
  return [
    {
      title: 'Getting Started',
      sections: [
        { id: 'introduction', title: 'Introduction', icon: <BookOpen size={14} />, content: <IntroductionContent /> },
        { id: 'authentication', title: 'Authentication', icon: <Shield size={14} />, content: <AuthenticationContent />, endpoints: AUTH_ENDPOINTS },
        { id: 'multi-tenant', title: 'Multi-Tenant', icon: <Building2 size={14} />, content: <MultiTenantContent /> },
        { id: 'rate-limiting', title: 'Rate Limiting', icon: <Gauge size={14} />, content: <RateLimitContent /> },
        { id: 'response-format', title: 'Response Format', icon: <Code2 size={14} />, content: <ResponseFormatContent /> },
        { id: 'errors', title: 'Errors', icon: <AlertTriangle size={14} />, content: <ErrorsContent /> },
      ],
    },
    {
      title: 'Core ITIL Modules',
      sections: [
        { id: 'incidents', title: 'Incidents', icon: <AlertTriangle size={14} />, endpoints: INCIDENT_ENDPOINTS },
        { id: 'changes', title: 'Changes', icon: <Layers size={14} />, endpoints: CHANGE_ENDPOINTS },
        { id: 'problems', title: 'Problems', icon: <Database size={14} />, endpoints: PROBLEM_ENDPOINTS },
        { id: 'alerts', title: 'Alerts', icon: <Bell size={14} />, endpoints: ALERT_ENDPOINTS },
        { id: 'assets', title: 'Assets / CMDB', icon: <Server size={14} />, endpoints: ASSET_ENDPOINTS },
      ],
    },
    {
      title: 'Operations',
      sections: [
        { id: 'teams', title: 'Teams & On-Call', icon: <Users size={14} />, endpoints: TEAM_ENDPOINTS },
        { id: 'dashboard', title: 'Dashboard', icon: <BarChart3 size={14} />, endpoints: DASHBOARD_ENDPOINTS },
        { id: 'search', title: 'Search', icon: <Search size={14} />, endpoints: SEARCH_ENDPOINTS },
        { id: 'reports', title: 'Reports', icon: <FileText size={14} />, endpoints: REPORT_ENDPOINTS },
        { id: 'notifications', title: 'Notifications', icon: <Bell size={14} />, endpoints: NOTIFICATION_ENDPOINTS },
        { id: 'organizations', title: 'Organizations', icon: <Building2 size={14} />, endpoints: ORG_ENDPOINTS },
      ],
    },
    {
      title: 'Integrations',
      sections: [
        { id: 'integration-hub', title: 'Integration Hub', icon: <Zap size={14} />, endpoints: INTEGRATION_ENDPOINTS },
        { id: 'pagerduty', title: 'PagerDuty', icon: <Radio size={14} />, endpoints: PAGERDUTY_ENDPOINTS },
        { id: 'webhooks', title: 'Webhooks', icon: <Webhook size={14} />, endpoints: WEBHOOK_ENDPOINTS },
      ],
    },
    {
      title: 'Infrastructure & AI',
      sections: [
        { id: 'kubernetes', title: 'Kubernetes', icon: <Network size={14} />, endpoints: K8S_ENDPOINTS },
        { id: 'apm', title: 'APM', icon: <Globe size={14} />, endpoints: APM_ENDPOINTS },
        { id: 'ai-agent', title: 'AI Agent', icon: <Brain size={14} />, endpoints: AI_AGENT_ENDPOINTS },
        { id: 'agent-pipeline', title: 'Agent Pipeline', icon: <Bot size={14} />, endpoints: AGENT_PIPELINE_ENDPOINTS },
      ],
    },
    {
      title: 'Communication',
      sections: [
        { id: 'sms', title: 'SMS', icon: <MessageSquare size={14} />, endpoints: SMS_ENDPOINTS },
        { id: 'voice', title: 'Voice', icon: <Phone size={14} />, endpoints: VOICE_ENDPOINTS },
      ],
    },
  ];
}

// ── Main Component ─────────────────────────────────────────

export default function DeveloperDocs() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('introduction');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ 'Getting Started': true, 'Core ITIL Modules': true });
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarGroups = buildSections();

  const allSections = sidebarGroups.flatMap(g => g.sections);

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    const el = document.getElementById(`doc-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Track scroll position for active section highlight
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('doc-', '');
            setActiveSection(id);
            // Auto-expand the group
            for (const g of sidebarGroups) {
              if (g.sections.some(s => s.id === id)) {
                setExpandedGroups(prev => ({ ...prev, [g.title]: true }));
              }
            }
          }
        });
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0.1 }
    );
    allSections.forEach(s => {
      const el = document.getElementById(`doc-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredGroups = searchQuery
    ? sidebarGroups.map(g => ({
        ...g,
        sections: g.sections.filter(s =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.endpoints?.some(e => e.path.toLowerCase().includes(searchQuery.toLowerCase()) || e.description.toLowerCase().includes(searchQuery.toLowerCase()))
        ),
      })).filter(g => g.sections.length > 0)
    : sidebarGroups;

  return (
    <div className="flex h-screen bg-[#FAFAF9] font-body overflow-hidden">
      {/* ── Mobile Header ────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-[#0F172A] border-b border-[#1E293B]">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-[#94A3B8] hover:text-white transition-colors">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-display font-bold text-white text-[15px]">WeCrew <span className="text-[#4F46E5]">API</span></span>
        </div>
        <button onClick={() => navigate('/')} className="text-[11px] font-mono text-[#475569] hover:text-[#94A3B8] transition-colors flex items-center gap-1">
          <ArrowLeft size={12} /> Back
        </button>
      </div>

      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-[280px] bg-[#0F172A] border-r border-[#1E293B] flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1E293B]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center">
                <Terminal size={14} className="text-white" />
              </div>
              <div>
                <div className="font-display font-bold text-white text-[15px] leading-none">WeCrew <span className="text-[#4F46E5]">API</span></div>
                <div className="text-[10px] font-mono text-[#475569] mt-0.5">v2.0 Developer Docs</div>
              </div>
            </div>
            <button onClick={() => navigate('/')} className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-[#475569] hover:text-[#94A3B8] transition-colors" title="Back to app">
              <ArrowLeft size={11} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#1E293B]">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
            <input
              type="text"
              placeholder="Search endpoints..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#1E293B]/50 border border-[#1E293B] rounded-lg text-[12px] font-mono text-[#E2E8F0] placeholder-[#475569] focus:outline-none focus:border-[#4F46E5]/50 focus:ring-1 focus:ring-[#4F46E5]/20 transition-all"
            />
          </div>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {filteredGroups.map(group => (
            <div key={group.title} className="mb-1">
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between px-5 py-2 text-[10px] font-display font-semibold uppercase tracking-[0.08em] text-[#475569] hover:text-[#94A3B8] transition-colors"
              >
                {group.title}
                {expandedGroups[group.title] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
              {expandedGroups[group.title] && (
                <div className="space-y-0.5 px-2">
                  {group.sections.map(section => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-all ${
                        activeSection === section.id
                          ? 'bg-[#4F46E5]/10 text-[#818CF8] border border-[#4F46E5]/20'
                          : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50 border border-transparent'
                      }`}
                    >
                      <span className={activeSection === section.id ? 'text-[#818CF8]' : 'text-[#475569]'}>{section.icon}</span>
                      {section.title}
                      {section.endpoints && (
                        <span className="ml-auto text-[9px] font-mono text-[#475569]">{section.endpoints.length}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#1E293B]">
          <a href={`${window.location.origin}/api/v1`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[11px] font-mono text-[#475569] hover:text-[#94A3B8] transition-colors">
            <ExternalLink size={11} /> {window.location.host}/api/v1
          </a>
        </div>
      </aside>

      {/* ── Overlay ─────────────────────────────────── */}
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* ── Main Content ────────────────────────────── */}
      <main ref={contentRef} className="flex-1 overflow-y-auto pt-0 lg:pt-0">
        <div className="pt-[56px] lg:pt-0">
          {/* Hero Header */}
          <div className="bg-[#0F172A] px-6 sm:px-10 py-10 sm:py-14 border-b border-[#1E293B] relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#4F46E5]/[0.04] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
            <div className="relative max-w-4xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="px-2.5 py-1 rounded-md bg-[#4F46E5]/10 border border-[#4F46E5]/20 text-[10px] font-mono font-bold text-[#818CF8] uppercase tracking-wider">API Reference</div>
                <div className="px-2.5 py-1 rounded-md bg-[#059669]/10 border border-[#059669]/20 text-[10px] font-mono font-bold text-[#34D399] uppercase tracking-wider">v2.0</div>
              </div>
              <h1 className="font-display font-bold text-[32px] sm:text-[40px] text-white leading-tight mb-3">
                WeCrew Developer<br /><span className="text-[#4F46E5]">Documentation</span>
              </h1>
              <p className="text-[14px] text-[#94A3B8] leading-relaxed max-w-2xl">
                Complete API reference for the WeCrew ITSM platform. 160+ endpoints across incidents, changes, problems, alerts, assets, teams, integrations, and AI-powered automation.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <span className="px-3 py-1.5 rounded-lg bg-[#1E293B]/50 border border-[#1E293B] text-[11px] font-mono text-[#94A3B8]">REST API</span>
                <span className="px-3 py-1.5 rounded-lg bg-[#1E293B]/50 border border-[#1E293B] text-[11px] font-mono text-[#94A3B8]">JSON</span>
                <span className="px-3 py-1.5 rounded-lg bg-[#1E293B]/50 border border-[#1E293B] text-[11px] font-mono text-[#94A3B8]">JWT Auth</span>
                <span className="px-3 py-1.5 rounded-lg bg-[#1E293B]/50 border border-[#1E293B] text-[11px] font-mono text-[#94A3B8]">Multi-tenant</span>
                <span className="px-3 py-1.5 rounded-lg bg-[#1E293B]/50 border border-[#1E293B] text-[11px] font-mono text-[#94A3B8]">WebSocket</span>
              </div>
            </div>
          </div>

          {/* Content Sections */}
          <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">
            {allSections.map(section => (
              <section key={section.id} id={`doc-${section.id}`} className="mb-16 scroll-mt-20 lg:scroll-mt-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#E7E5E4]">
                  <div className="w-8 h-8 rounded-lg bg-[#4F46E5]/8 flex items-center justify-center text-[#4F46E5]">{section.icon}</div>
                  <h2 className="font-display font-bold text-[22px] text-[#0F172A]">{section.title}</h2>
                  {section.endpoints && (
                    <span className="ml-auto px-2.5 py-1 rounded-md bg-[#F5F5F4] border border-[#E7E5E4] text-[10px] font-mono font-medium text-[#94A3B8]">
                      {section.endpoints.length} endpoint{section.endpoints.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {section.content}
                {section.endpoints && section.endpoints.map((ep, i) => <EndpointCard key={i} ep={ep} />)}
              </section>
            ))}

            {/* Footer */}
            <div className="mt-16 pt-8 border-t border-[#E7E5E4] pb-16 text-center">
              <p className="text-[12px] text-[#94A3B8] font-mono">
                WeCrew ITSM API &middot; WeCrew &middot; No.55B, First Main, Electronic City Phase – 1, Bengaluru – 560 100
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
