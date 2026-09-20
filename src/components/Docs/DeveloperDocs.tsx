import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowLeft, ArrowRight, Menu, Search, X } from 'lucide-react';
import { COMPANY } from '../Public/site';
import { EndpointList, P } from './DocsUI';
import * as G from './guides';
import { ApiOverview, ErrorCodes, RateLimits, ResponseFormat } from './apiIntro';
import * as E from './endpoints';
import type { Endpoint } from './endpoints';

/* ═══════════════════════════════════════════════════════════
   WeCrew ITSM — Documentation (/docs)
   Product guides + API reference in one page. Navigation is by URL hash
   (/docs#alert-webhooks) so every section deep-links without extra routes.
   Section registry: DOCS below. Guide copy: guides.tsx. API data: endpoints.ts.
   ═══════════════════════════════════════════════════════════ */

interface DocSection {
  id: string;
  title: string;
  group: string;
  /** Extra search terms. Endpoint paths are searched automatically. */
  keywords?: string;
  intro?: string;
  body?: () => ReactNode;
  endpoints?: Endpoint[];
  /** Id of a related section (guide ↔ API). */
  related?: string;
}

const DOCS: DocSection[] = [
  // Getting started
  { id: 'overview', group: 'Getting started', title: 'Overview', keywords: 'introduction start navigation modules', body: G.OverviewGuide },
  { id: 'sign-in', group: 'Getting started', title: 'Sign in & roles', keywords: 'login password forgot reset rbac admin manager engineer operator viewer', body: G.SignInGuide, related: 'api-auth' },
  { id: 'organizations', group: 'Getting started', title: 'Organizations', keywords: 'multi-tenant tenancy org switcher platform admin x-organization-id', body: G.OrganizationsGuide, related: 'api-organizations' },
  { id: 'trial-billing', group: 'Getting started', title: 'Trial & billing', keywords: 'plans pricing starter enterprise razorpay subscription read-only 402 upgrade cancel', body: G.TrialBillingGuide, related: 'api-billing' },

  // Incident response
  { id: 'incidents', group: 'Incident response', title: 'Incidents', keywords: 'priority impact urgency work notes timeline report', body: G.IncidentsGuide, related: 'api-incidents' },
  { id: 'alerts', group: 'Incident response', title: 'Alerts', keywords: 'prometheus grafana severity acknowledge silence', body: G.AlertsGuide, related: 'api-alerts' },
  { id: 'on-call', group: 'Incident response', title: 'On-call & escalation', keywords: 'rota schedule escalation policy page', body: G.OnCallGuide, related: 'api-teams' },
  { id: 'sla', group: 'Incident response', title: 'SLA', keywords: 'response resolution breach target', body: G.SlaGuide },

  // Change & problem
  { id: 'changes', group: 'Change & problem', title: 'Changes', keywords: 'approval cab calendar emergency standard', body: G.ChangesGuide, related: 'api-changes' },
  { id: 'problems', group: 'Change & problem', title: 'Problems', keywords: 'rca root cause known error workaround', body: G.ProblemsGuide, related: 'api-problems' },
  { id: 'maintenance', group: 'Change & problem', title: 'Maintenance windows', keywords: 'maintenance window schedule', body: G.MaintenanceGuide },

  // Assets
  { id: 'cmdb', group: 'Assets & CMDB', title: 'CMDB / assets', keywords: 'configuration item ci server cluster owner', body: G.CmdbGuide, related: 'api-assets' },

  // Observability
  { id: 'observability', group: 'Observability', title: 'Kubernetes, APM & logs', keywords: 'k8s apm metrics loki logs ai insights', body: G.ObservabilityGuide, related: 'api-kubernetes' },

  // Integrations
  { id: 'alert-webhooks', group: 'Integrations', title: 'Alert webhooks', keywords: 'alertmanager grafana token webhook rotate', body: G.AlertWebhooksGuide, related: 'api-webhooks' },
  { id: 'slack', group: 'Integrations', title: 'Slack', keywords: 'slack signing slash command', body: G.SlackGuide },
  { id: 'pagerduty', group: 'Integrations', title: 'PagerDuty', keywords: 'pagerduty webhook', body: G.PagerDutyGuide, related: 'api-pagerduty' },
  { id: 'messaging', group: 'Integrations', title: 'SMS & voice', keywords: 'twilio msg91 kaleyra sms voice call', body: G.MessagingGuide, related: 'api-sms' },

  // Administration
  { id: 'users', group: 'Administration', title: 'Users & seats', keywords: 'seat limit viewer invite register', body: G.UsersSeatsGuide },
  { id: 'audit', group: 'Administration', title: 'Audit log', keywords: 'audit history', body: G.AuditGuide, related: 'api-audit' },
  { id: 'security', group: 'Administration', title: 'Security', keywords: 'isolation lockout tokens webhook signature', body: G.SecurityGuide },

  // API reference
  { id: 'api-overview', group: 'API reference', title: 'Overview & authentication', keywords: 'base url bearer jwt refresh', body: ApiOverview },
  { id: 'api-rate-limits', group: 'API reference', title: 'Rate limits', keywords: '429 throttle', body: RateLimits },
  { id: 'api-response', group: 'API reference', title: 'Response format', keywords: 'envelope pagination', body: ResponseFormat },
  { id: 'api-errors', group: 'API reference', title: 'Errors', keywords: 'status codes 401 402 403 404', body: ErrorCodes },
  { id: 'api-auth', group: 'API reference', title: 'Auth & users', endpoints: E.AUTH_ENDPOINTS, intro: 'Sign in, tokens, profile, password reset and user management.' },
  { id: 'api-organizations', group: 'API reference', title: 'Organizations', endpoints: E.ORG_ENDPOINTS, intro: 'Tenant management. Platform admins only.' },
  { id: 'api-incidents', group: 'API reference', title: 'Incidents', endpoints: E.INCIDENT_ENDPOINTS },
  { id: 'api-changes', group: 'API reference', title: 'Changes', endpoints: E.CHANGE_ENDPOINTS },
  { id: 'api-problems', group: 'API reference', title: 'Problems', endpoints: E.PROBLEM_ENDPOINTS },
  { id: 'api-alerts', group: 'API reference', title: 'Alerts', endpoints: E.ALERT_ENDPOINTS },
  { id: 'api-assets', group: 'API reference', title: 'Assets / CMDB', endpoints: E.ASSET_ENDPOINTS },
  { id: 'api-teams', group: 'API reference', title: 'Teams & on-call', endpoints: E.TEAM_ENDPOINTS },
  { id: 'api-dashboard', group: 'API reference', title: 'Dashboard', endpoints: E.DASHBOARD_ENDPOINTS },
  { id: 'api-search', group: 'API reference', title: 'Search', endpoints: E.SEARCH_ENDPOINTS },
  { id: 'api-reports', group: 'API reference', title: 'Reports', endpoints: E.REPORT_ENDPOINTS },
  { id: 'api-notifications', group: 'API reference', title: 'Notifications', endpoints: E.NOTIFICATION_ENDPOINTS },
  { id: 'api-chat', group: 'API reference', title: 'Team chat', endpoints: E.CHAT_ENDPOINTS },
  { id: 'api-audit', group: 'API reference', title: 'Audit log', endpoints: E.AUDIT_ENDPOINTS },
  { id: 'api-billing', group: 'API reference', title: 'Billing', endpoints: E.BILLING_ENDPOINTS, intro: 'Plans, subscription state and Razorpay checkout. Amounts are in paise.' },
  { id: 'api-integrations', group: 'API reference', title: 'Integrations', endpoints: E.INTEGRATION_ENDPOINTS },
  { id: 'api-pagerduty', group: 'API reference', title: 'PagerDuty', endpoints: E.PAGERDUTY_ENDPOINTS },
  { id: 'api-webhooks', group: 'API reference', title: 'Inbound webhooks', endpoints: E.WEBHOOK_ENDPOINTS, intro: 'Unauthenticated by bearer token; each is verified by an organization token or the provider’s signature.' },
  { id: 'api-kubernetes', group: 'API reference', title: 'Kubernetes', endpoints: E.K8S_ENDPOINTS },
  { id: 'api-apm', group: 'API reference', title: 'APM', endpoints: E.APM_ENDPOINTS },
  { id: 'api-ai', group: 'API reference', title: 'AI', endpoints: E.AI_AGENT_ENDPOINTS },
  { id: 'api-agent-pipeline', group: 'API reference', title: 'Agent pipeline', endpoints: E.AGENT_PIPELINE_ENDPOINTS },
  { id: 'api-sms', group: 'API reference', title: 'SMS', endpoints: E.SMS_ENDPOINTS },
  { id: 'api-voice', group: 'API reference', title: 'Voice', endpoints: E.VOICE_ENDPOINTS },
  { id: 'api-public', group: 'API reference', title: 'Public endpoints', endpoints: E.PUBLIC_ENDPOINTS },
];

const GROUPS = Array.from(new Set(DOCS.map((d) => d.group)));
const DEFAULT_ID = 'overview';

function currentId(): string {
  const h = typeof window !== 'undefined' ? decodeURIComponent(window.location.hash.slice(1)) : '';
  return DOCS.some((d) => d.id === h) ? h : DEFAULT_ID;
}

function matches(d: DocSection, q: string): boolean {
  if (!q) return true;
  const hay = [d.title, d.group, d.keywords ?? '', ...(d.endpoints ?? []).map((e) => `${e.method} ${e.path} ${e.description}`)]
    .join(' ')
    .toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label={`${COMPANY.name} home`}>
      <span
        className="grid h-7 w-7 place-items-center rounded-sm text-[11px] font-bold tracking-wide text-white"
        style={{ background: 'var(--brand-coral)' }}
        aria-hidden
      >
        WC
      </span>
      <span className="leading-none">
        <span className="block font-display text-[16px] font-semibold tracking-tight text-ink">{COMPANY.name}</span>
        <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">Docs</span>
      </span>
    </Link>
  );
}

function SearchBox({ value, onChange, onEnter, className }: { value: string; onChange: (v: string) => void; onEnter: () => void; className?: string }) {
  return (
    <label className={clsx('relative block', className)}>
      <span className="sr-only">Search documentation</span>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
        placeholder="Search docs and API…"
        className="w-full rounded border border-steel bg-obsidian py-1.5 pl-8 pr-2.5 text-[13px] text-ink placeholder:text-dim focus:border-signal focus:outline-none"
      />
    </label>
  );
}

function SidebarNav({ activeId, query, onPick }: { activeId: string; query: string; onPick: () => void }) {
  const visible = DOCS.filter((d) => matches(d, query));
  if (!visible.length) {
    return <p className="px-2 py-3 text-[13px] text-muted">No matches. Try another word.</p>;
  }
  return (
    <nav aria-label="Documentation" className="space-y-5">
      {GROUPS.map((g) => {
        const items = visible.filter((d) => d.group === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <p className="cx-eyebrow px-2">{g}</p>
            <ul className="mt-1.5 space-y-0.5">
              {items.map((d) => (
                <li key={d.id}>
                  <a
                    href={`#${d.id}`}
                    onClick={onPick}
                    aria-current={d.id === activeId ? 'page' : undefined}
                    className={clsx(
                      'block rounded px-2 py-1.5 text-[13px] transition-colors',
                      d.id === activeId ? 'bg-coral-dim font-medium text-ink' : 'text-muted hover:bg-slate hover:text-ink'
                    )}
                  >
                    {d.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export default function DeveloperDocs() {
  const [activeId, setActiveId] = useState<string>(currentId);
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState(false);

  // Hash is the source of truth, so back/forward and shared links work.
  useEffect(() => {
    const onHash = () => {
      setActiveId(currentId());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const prev = document.title;
    const d = DOCS.find((x) => x.id === activeId);
    document.title = `${d?.title ?? 'Docs'} — ${COMPANY.product} Docs`;
    return () => { document.title = prev; };
  }, [activeId]);

  const section = DOCS.find((d) => d.id === activeId) ?? DOCS[0];
  const idx = DOCS.indexOf(section);
  const prev = idx > 0 ? DOCS[idx - 1] : null;
  const next = idx < DOCS.length - 1 ? DOCS[idx + 1] : null;
  const related = useMemo(() => DOCS.find((d) => d.id === section.related), [section]);

  const jumpToFirstMatch = () => {
    const first = DOCS.find((d) => matches(d, query));
    if (first) {
      window.location.hash = first.id;
      setDrawer(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-void font-body text-ink">
      <header className="sticky top-0 z-30 border-b border-steel bg-obsidian">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 place-items-center rounded border border-steel text-muted lg:hidden"
            aria-label="Open documentation menu"
          >
            <Menu size={17} />
          </button>
          <Wordmark />
          <SearchBox value={query} onChange={setQuery} onEnter={jumpToFirstMatch} className="ml-4 hidden w-72 lg:block" />
          <nav className="ml-auto flex items-center gap-4" aria-label="Site">
            <Link to="/" className="hidden text-[13px] font-medium text-muted hover:text-ink sm:inline">Home</Link>
            <Link to="/pricing" className="hidden text-[13px] font-medium text-muted hover:text-ink sm:inline">Pricing</Link>
            <Link to="/login" className="cx-btn cx-btn--ghost">Sign in</Link>
          </nav>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Documentation menu">
          <button type="button" className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col border-r border-steel bg-obsidian">
            <div className="flex items-center justify-between border-b border-steel px-4 py-3">
              <span className="font-display text-[15px] font-semibold text-ink">Documentation</span>
              <button type="button" onClick={() => setDrawer(false)} className="text-muted hover:text-ink" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <div className="border-b border-steel p-3">
              <SearchBox value={query} onChange={setQuery} onEnter={jumpToFirstMatch} />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <SidebarNav activeId={activeId} query={query} onPick={() => setDrawer(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl gap-8 px-4 sm:px-6">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-steel py-6 pr-4 lg:block">
          <SidebarNav activeId={activeId} query={query} onPick={() => {}} />
        </aside>

        <main id="main" className="min-w-0 flex-1 py-8 lg:py-10">
          <article className="max-w-3xl">
            <p className="cx-eyebrow">{section.group}</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">{section.title}</h1>
            {section.intro && <P>{section.intro}</P>}
            <div className="mt-2">{section.body?.()}</div>
            {section.endpoints && <EndpointList endpoints={section.endpoints} />}

            {related && (
              <p className="mt-8 text-[13px] text-muted">
                {section.group === 'API reference' ? 'Guide: ' : 'API: '}
                <a href={`#${related.id}`} className="font-medium text-signal hover:underline">{related.title}</a>
              </p>
            )}

            <div className="mt-12 grid gap-3 border-t border-steel pt-6 sm:grid-cols-2">
              {prev ? (
                <a href={`#${prev.id}`} className="group rounded border border-steel bg-obsidian p-3 transition-colors hover:border-signal">
                  <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-dim"><ArrowLeft size={11} /> Previous</span>
                  <span className="mt-1 block text-[13.5px] font-medium text-ink">{prev.title}</span>
                </a>
              ) : <span />}
              {next && (
                <a href={`#${next.id}`} className="group rounded border border-steel bg-obsidian p-3 text-right transition-colors hover:border-signal">
                  <span className="flex items-center justify-end gap-1 font-mono text-[10px] uppercase tracking-wider text-dim">Next <ArrowRight size={11} /></span>
                  <span className="mt-1 block text-[13.5px] font-medium text-ink">{next.title}</span>
                </a>
              )}
            </div>

            <p className="mt-10 text-[12.5px] text-dim">
              Can&apos;t find something? Email{' '}
              <a href={`mailto:${COMPANY.supportEmail}`} className="text-signal hover:underline">{COMPANY.supportEmail}</a>.
            </p>
          </article>
        </main>
      </div>
    </div>
  );
}
