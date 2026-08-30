import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  CheckCircle2, Clock, ExternalLink, Users,
  Zap, Bell, Server, GitBranch,
  RefreshCw, Loader2, ArrowRight, Link2, Lock,
  Copy, Trash2, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import {
  usePdStatus, usePdOverview, usePdIncidents, usePdOnCalls,
  usePdServices, usePdEscalationPolicies, usePdStats,
  useConnectPagerDuty, useDisconnectPagerDuty, useValidatePdKey,
} from '../../hooks/usePagerDuty';
import { Page, Panel, Segmented, PrimaryButton } from '../ui/PageChrome';

type Tab = 'overview' | 'incidents' | 'services' | 'oncall' | 'policies' | 'settings';

interface PdIncident {
  id: string;
  incidentNumber: number;
  title: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
  urgency: 'high' | 'low';
  priority?: string | null;
  service?: { id: string; name: string } | null;
  assignees: { id: string; name: string; htmlUrl?: string }[];
  createdAt: string;
  resolvedAt?: string | null;
  htmlUrl: string;
}

interface PdService {
  id: string;
  name: string;
  description: string;
  status: string;
  htmlUrl: string;
  escalationPolicy?: { id: string; name: string } | null;
  integrationsCount: number;
}

interface PdOnCallLayer {
  level: number;
  user: { id: string; name: string; htmlUrl?: string };
  schedule?: { id: string; name: string } | null;
  start?: string;
  end?: string;
}

interface PdOnCallGroup {
  escalationPolicy: { id: string; name: string };
  layers: PdOnCallLayer[];
}

interface PdPolicy {
  id: string;
  name: string;
  description?: string;
  numLoops?: number;
  rules?: { escalationDelayMinutes: number; targets?: { name: string }[] }[];
  services?: { id: string; name: string }[];
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const STATUS_TONE: Record<string, { tone: 'danger' | 'warn' | 'ok'; label: string }> = {
  triggered: { tone: 'danger', label: 'Triggered' },
  acknowledged: { tone: 'warn', label: 'Acknowledged' },
  resolved: { tone: 'ok', label: 'Resolved' },
};

const SERVICE_STATUS_TONE: Record<string, { tone: 'ok' | 'warn' | 'danger' | 'alert' | 'neutral'; label: string }> = {
  active: { tone: 'ok', label: 'Active' },
  warning: { tone: 'warn', label: 'Warning' },
  critical: { tone: 'danger', label: 'Critical' },
  maintenance: { tone: 'alert', label: 'Maintenance' },
  disabled: { tone: 'neutral', label: 'Disabled' },
};

function SetupWizard({ onConnect }: { onConnect: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [routingKey, setRoutingKey] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [autoCreate, setAutoCreate] = useState(true);
  const [step, setStep] = useState<'form' | 'validating' | 'success'>('form');
  const [validationResult, setValidationResult] = useState<{ name?: string; email?: string } | null>(null);

  const validateKey = useValidatePdKey();
  const connectPd = useConnectPagerDuty();

  const handleValidate = async () => {
    if (!apiKey.trim()) { toast.error('Enter your PagerDuty API key'); return; }
    setStep('validating');
    validateKey.mutate(apiKey.trim(), {
      onSuccess: (data) => {
        if (data.valid) {
          setValidationResult(data.account);
          setStep('success');
        } else {
          toast.error(data.error || 'Invalid API key');
          setStep('form');
        }
      },
      onError: () => { toast.error('Validation failed — check your key'); setStep('form'); },
    });
  };

  const handleConnect = () => {
    connectPd.mutate({ apiKey: apiKey.trim(), routingKey: routingKey.trim(), autoSync, autoCreateIncidents: autoCreate }, {
      onSuccess: () => { toast.success('PagerDuty connected!'); onConnect(); },
      onError: () => toast.error('Connection failed'),
    });
  };

  const steps = ['Get API Key', 'Validate', 'Configure', 'Connect'];
  const stepIndex = step === 'form' ? 0 : step === 'validating' ? 1 : 2;

  return (
    <Page>
      <div className="cx-hero">
        <div className="min-w-0">
          <span className="cx-eyebrow">Operate · integrations</span>
          <h1 className="cx-hero__title">Connect PagerDuty</h1>
          <p className="cx-hero__deck">
            Enter your PagerDuty API key to sync services, incidents, and on-call schedules with WeCrew.
          </p>
        </div>
      </div>

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <Link to="/integrations">Integrations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">PagerDuty</span>
      </nav>

      <div className="flex items-center justify-center gap-2 mb-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
              i <= stepIndex ? 'bg-emerald text-white' : 'bg-slate text-dim'
            )}>
              {i + 1}
            </div>
            {i < 3 && <div className="w-8 h-px bg-[color:var(--argus-border)]" />}
          </div>
        ))}
      </div>

      <Panel title="API Key (REST API v2)" titleExtra={<Lock size={14} className="text-dim" />}>
        <div className="relative">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setStep('form'); setValidationResult(null); }}
            placeholder="u+xxxxxxxxxxxxxxxxxxxx"
            className="input-field font-mono pr-32"
          />
          <button
            type="button"
            onClick={handleValidate}
            disabled={!apiKey.trim() || step === 'validating'}
            className={clsx(
              'absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
              step === 'success' ? 'bg-emerald-dim text-emerald' : 'cx-btn cx-btn--primary',
              (!apiKey.trim() || step === 'validating') && 'opacity-50 cursor-not-allowed'
            )}
          >
            {step === 'validating' ? <Loader2 size={12} className="animate-spin" /> : step === 'success' ? <span className="flex items-center gap-1"><CheckCircle2 size={12} />Valid</span> : 'Validate'}
          </button>
        </div>
        {validationResult && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-dim border border-steel flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-dim flex items-center justify-center">
              <User size={14} className="text-emerald" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">{validationResult.name}</p>
              <p className="text-[10px] text-emerald">{validationResult.email}</p>
            </div>
            <CheckCircle2 size={16} className="text-emerald ml-auto" />
          </div>
        )}
        <p className="text-[11px] text-dim mt-2">
          Get your key at <span className="font-mono text-muted">app.pagerduty.com → My Profile → API Access → Create API User Token</span>
        </p>
      </Panel>

      <Panel title="Events API Routing Key" titleExtra={<span className="text-[10px] font-normal text-dim">for sending alerts to PagerDuty</span>}>
        <input
          type="text"
          value={routingKey}
          onChange={(e) => setRoutingKey(e.target.value)}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="input-field font-mono"
        />
        <p className="text-[11px] text-dim mt-2">
          Get this from <span className="font-mono text-muted">Services → Integrations → Events API v2 → Routing Key</span>
        </p>
      </Panel>

      <Panel title="Sync options">
        <div className="space-y-4">
          {[
            { label: 'Auto-sync every 5 minutes', sub: 'Keep incidents, services, and on-call schedules updated', value: autoSync, toggle: setAutoSync },
            { label: 'Auto-create WeCrew incidents', sub: 'Triggered PagerDuty incidents create WeCrew incidents automatically', value: autoCreate, toggle: setAutoCreate },
          ].map((opt) => (
            <div key={opt.label} className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => opt.toggle(!opt.value)}
                className={clsx('shrink-0 w-10 h-6 rounded-full transition-colors mt-0.5', opt.value ? 'bg-emerald' : 'bg-graphite')}
              >
                <span
                  className="block bg-white rounded-full shadow-sm transition-transform"
                  style={{ width: 18, height: 18, marginTop: 3, marginLeft: opt.value ? 18 : 3 }}
                />
              </button>
              <div>
                <p className="text-sm font-medium text-ink">{opt.label}</p>
                <p className="text-[11px] text-dim">{opt.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <PrimaryButton onClick={handleConnect} disabled={step !== 'success' || connectPd.isPending} className="w-full">
            {connectPd.isPending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {connectPd.isPending ? 'Connecting…' : 'Connect PagerDuty'}
          </PrimaryButton>
          <p className="text-center text-[11px] text-dim mt-2">Validate your API key above before connecting</p>
        </div>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Zap, title: 'Instant Sync', desc: 'Services, incidents, and on-call pulled immediately' },
          { icon: Bell, title: 'Live Alerts', desc: 'WeCrew sends alerts to PagerDuty via Events API' },
          { icon: CheckCircle2, title: 'Bidirectional', desc: 'Resolve in PD → auto-resolve in WeCrew' },
        ].map((f) => (
          <div key={f.title} className="p-4 bg-obsidian border border-steel rounded text-center">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 bg-slate">
              <f.icon size={18} className="text-signal" />
            </div>
            <p className="text-xs font-semibold text-ink mb-1">{f.title}</p>
            <p className="text-[10px] text-muted leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </Page>
  );
}

function IncidentRow({ incident }: { incident: PdIncident }) {
  const status = STATUS_TONE[incident.status] || STATUS_TONE.triggered;
  return (
    <div className="px-5 py-3.5 hover:bg-slate transition-colors group">
      <div className="flex items-start gap-3">
        <div className={clsx(
          'shrink-0 mt-1.5 w-2 h-2 rounded-full',
          incident.status === 'triggered' ? 'bg-crimson animate-pulse' : incident.status === 'acknowledged' ? 'bg-amber' : 'bg-emerald'
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-mono text-dim">#{incident.incidentNumber}</span>
            <a href={incident.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-ink group-hover:text-signal transition-colors truncate max-w-[380px]">
              {incident.title}
            </a>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-dim font-mono flex-wrap">
            {incident.service?.name && (
              <span className="inline-flex items-center gap-1"><Server size={9} />{incident.service.name}</span>
            )}
            {incident.assignees.length > 0 && (
              <span className="inline-flex items-center gap-1"><User size={9} />{incident.assignees[0].name}</span>
            )}
            <span className="inline-flex items-center gap-1"><Clock size={9} />{relativeTime(incident.createdAt)}</span>
            {incident.urgency === 'high' && <span className="text-crimson font-semibold">HIGH</span>}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={clsx('cx-pill', `cx-pill--${status.tone}`)}>{status.label}</span>
          <a href={incident.htmlUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate">
            <ExternalLink size={12} className="text-dim group-hover:text-muted" />
          </a>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: PdService }) {
  const status = SERVICE_STATUS_TONE[service.status] || SERVICE_STATUS_TONE.active;
  return (
    <div className="bg-obsidian border border-steel p-4 rounded">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-dim flex items-center justify-center">
            <Server size={14} className="text-emerald" />
          </div>
          <h4 className="text-sm font-semibold text-ink leading-tight">{service.name}</h4>
        </div>
        <span className={clsx('cx-pill', `cx-pill--${status.tone}`)}>{status.label}</span>
      </div>
      {service.description && <p className="text-[10px] text-muted mb-2 line-clamp-1">{service.description}</p>}
      <div className="flex items-center gap-3 text-[10px] text-dim font-mono">
        {service.escalationPolicy && <span className="inline-flex items-center gap-1"><Users size={9} />{service.escalationPolicy.name}</span>}
        <span className="inline-flex items-center gap-1"><Link2 size={9} />{service.integrationsCount} integrations</span>
      </div>
      {service.htmlUrl && (
        <a href={service.htmlUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-dim hover:text-signal transition-colors">
          <ExternalLink size={9} /> Open in PagerDuty
        </a>
      )}
    </div>
  );
}

export default function PagerDutyDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = usePdStatus();
  const isConnected = statusData?.connected === true;

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = usePdOverview();
  const { data: incidents, isLoading: incidentsLoading } = usePdIncidents();
  const { data: services, isLoading: servicesLoading } = usePdServices();
  const { data: onCalls, isLoading: onCallsLoading } = usePdOnCalls();
  const { data: policies, isLoading: policiesLoading } = usePdEscalationPolicies();
  const { data: stats } = usePdStats();

  const disconnectPd = useDisconnectPagerDuty();

  const servicesList = (services || overview?.services || []) as PdService[];
  const incidentsList = (
    (incidents && typeof incidents === 'object' && 'incidents' in incidents
      ? (incidents as { incidents?: PdIncident[] }).incidents
      : undefined) || overview?.activeIncidents || []
  ) as PdIncident[];
  const onCallGroups = (onCalls || overview?.onCalls || []) as PdOnCallGroup[];
  const policiesList = (policies || []) as PdPolicy[];

  const triggeredCount = incidentsList.filter(i => i.status === 'triggered').length;
  const ackedCount = incidentsList.filter(i => i.status === 'acknowledged').length;

  const tabOptions = [
    { value: 'overview', label: 'Overview' },
    { value: 'incidents', label: triggeredCount ? `Incidents (${triggeredCount})` : 'Incidents' },
    { value: 'services', label: servicesList.length ? `Services (${servicesList.length})` : 'Services' },
    { value: 'oncall', label: onCallGroups.length ? `On-Call (${onCallGroups.length})` : 'On-Call' },
    { value: 'policies', label: 'Escalation' },
    ...(canManage ? [{ value: 'settings', label: 'Settings' }] : []),
  ];

  if (statusLoading) {
    return (
      <Page>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-dim" />
        </div>
      </Page>
    );
  }

  if (!isConnected) {
    return <SetupWizard onConnect={() => refetchStatus()} />;
  }

  const kpis = [
    { label: 'Triggered', value: stats?.triggered ?? triggeredCount, sub: 'active incidents', tone: triggeredCount > 0 ? 'danger' : undefined },
    { label: 'Acknowledged', value: stats?.acknowledged ?? ackedCount, sub: 'being worked', tone: ackedCount > 0 ? 'warn' : undefined },
    { label: 'Resolved (7d)', value: stats?.resolved ?? 0, sub: 'last 7 days' },
    { label: 'Services', value: servicesList.length, sub: 'connected' },
    { label: 'On-call', value: onCallGroups.length, sub: 'escalation groups' },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Operate · integrations</span>
            <h1 className="cx-hero__title">PagerDuty</h1>
            <p className="cx-hero__deck">
              Incidents, services, on-call and escalation policies synced from PagerDuty.
              {statusData?.accountName ? ` Account: ${statusData.accountName}.` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="cx-pill cx-pill--ok">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" /> Connected
            </span>
            <button type="button" onClick={() => refetchOverview()} className="cx-hero__btn">
              <RefreshCw size={14} className={overviewLoading ? 'animate-spin' : ''} strokeWidth={1.75} />
              Sync now
            </button>
          </div>
        </div>
        <dl className="cx-hero__kpis cx-hero__kpis--5 mt-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={clsx('cx-hero__kpi', kpi.tone && `cx-hero__kpi--${kpi.tone}`)}>
              <dt className="cx-hero__kpi-label">{kpi.label}</dt>
              <dd>
                <div className="cx-hero__kpi-value">{kpi.value}</div>
                <div className="cx-hero__kpi-sub">{kpi.sub}</div>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <Link to="/integrations">Integrations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">PagerDuty</span>
      </nav>

      <div className="flex items-center gap-3 flex-wrap">
        <Segmented options={tabOptions} value={activeTab} onChange={(v) => setActiveTab(v as Tab)} />
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Panel title="Active incidents" titleExtra={<span className="text-[10px] font-mono text-dim ml-auto">from PagerDuty · live</span>} noPad>
                {overviewLoading ? (
                  <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate rounded animate-pulse" />)}</div>
                ) : incidentsList.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 size={36} className="text-emerald mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-muted">No active incidents</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[color:var(--argus-border)]">
                    {incidentsList.map((inc) => <IncidentRow key={inc.id} incident={inc} />)}
                  </div>
                )}
              </Panel>
            </div>

            <Panel title="On-call now" noPad>
              {onCallsLoading ? (
                <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate rounded animate-pulse" />)}</div>
              ) : onCallGroups.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted">No on-call data</div>
              ) : (
                <div className="divide-y divide-[color:var(--argus-border)]">
                  {onCallGroups.slice(0, 6).map((group) => {
                    const primary = group.layers.find(l => l.level === 1) || group.layers[0];
                    return (
                      <div key={group.escalationPolicy.id} className="px-5 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-signal flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {primary?.user?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">{primary?.user?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-dim truncate">{group.escalationPolicy.name}</p>
                        </div>
                        <span className="cx-pill cx-pill--ok">L{primary?.level}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Services health" titleExtra={<span className="text-[10px] font-mono text-dim ml-auto">{servicesList.length} services</span>}>
            {servicesLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {servicesList.slice(0, 8).map((svc) => <ServiceCard key={svc.id} service={svc} />)}
              </div>
            )}
          </Panel>
        </div>
      )}

      {activeTab === 'incidents' && (
        <Panel title="All active incidents" titleExtra={<span className="text-[10px] font-mono text-dim ml-auto">Live from PagerDuty · 30s refresh</span>} noPad>
          {incidentsLoading ? (
            <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-slate rounded animate-pulse" />)}</div>
          ) : incidentsList.length === 0 ? (
            <div className="text-center py-20">
              <CheckCircle2 size={48} className="text-emerald mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-muted">All clear — no active incidents</p>
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--argus-border)]">
              {incidentsList.map((inc) => <IncidentRow key={inc.id} incident={inc} />)}
            </div>
          )}
        </Panel>
      )}

      {activeTab === 'services' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {servicesLoading
            ? [...Array(8)].map((_, i) => <div key={i} className="h-28 bg-slate rounded animate-pulse" />)
            : servicesList.map((svc) => <ServiceCard key={svc.id} service={svc} />)
          }
        </div>
      )}

      {activeTab === 'oncall' && (
        <Panel title="On-call schedule" titleExtra={<span className="text-[10px] font-mono text-dim ml-auto">{onCallGroups.length} escalation groups</span>} noPad>
          {onCallsLoading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate rounded animate-pulse" />)}</div>
          ) : onCallGroups.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted">No on-call data available</div>
          ) : (
            <div className="divide-y divide-[color:var(--argus-border)]">
              {onCallGroups.map((group) => (
                <div key={group.escalationPolicy.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <GitBranch size={13} className="text-signal" />
                    <h4 className="text-sm font-semibold text-ink">{group.escalationPolicy.name}</h4>
                  </div>
                  <div className="space-y-2 ml-5">
                    {group.layers.sort((a, b) => a.level - b.level).map((layer, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-signal-dim border border-steel flex items-center justify-center text-[9px] font-bold text-signal">L{layer.level}</span>
                        <div className="w-7 h-7 rounded-full bg-signal flex items-center justify-center text-white text-xs font-bold">
                          {layer.user?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-ink">{layer.user?.name}</p>
                          {layer.schedule && <p className="text-[10px] text-dim">{layer.schedule.name}</p>}
                        </div>
                        {layer.end && (
                          <span className="text-[10px] font-mono text-dim">until {relativeTime(layer.end)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {activeTab === 'policies' && (
        <Panel title="Escalation policies" noPad>
          {policiesLoading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate rounded animate-pulse" />)}</div>
          ) : policiesList.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted">No escalation policies</div>
          ) : (
            <div className="divide-y divide-[color:var(--argus-border)]">
              {policiesList.map((policy) => (
                <div key={policy.id} className="px-5 py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-ink">{policy.name}</h4>
                      {policy.description && <p className="text-[11px] text-muted mt-0.5">{policy.description}</p>}
                    </div>
                    <span className="cx-pill cx-pill--alert">
                      {policy.numLoops && policy.numLoops > 0 ? `Loops ${policy.numLoops}x` : 'No loop'}
                    </span>
                  </div>
                  <div className="space-y-1.5 ml-2">
                    {policy.rules?.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-muted">
                        <ArrowRight size={9} className="text-dim shrink-0" />
                        <span>after {rule.escalationDelayMinutes}min →</span>
                        <span className="text-ink">{rule.targets?.map((t) => t.name).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                  {policy.services && policy.services.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] text-dim">Services:</span>
                      {policy.services.map((s) => (
                        <span key={s.id} className="cx-pill cx-pill--neutral">{s.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {activeTab === 'settings' && canManage && (
        <div className="space-y-4 max-w-xl">
          <Panel title="Connection details">
            <div className="space-y-3">
              {[
                { label: 'Account', value: statusData?.accountName || '—' },
                { label: 'Email', value: statusData?.accountEmail || '—' },
                { label: 'Connected', value: statusData?.connectedAt ? new Date(statusData.connectedAt).toLocaleDateString() : '—' },
                { label: 'Auto Sync', value: statusData?.autoSync ? 'Enabled' : 'Disabled' },
                { label: 'Auto-create Incidents', value: statusData?.autoCreateIncidents ? 'Enabled' : 'Disabled' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-steel last:border-0">
                  <span className="text-xs text-muted">{row.label}</span>
                  <span className="text-xs font-mono text-ink">{row.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Incoming webhook URL">
            <p className="text-[11px] text-muted mb-3">Add this URL in PagerDuty → Integrations → Generic Webhooks (V3) to receive incident events.</p>
            <div className="flex items-center gap-2 bg-slate border border-steel rounded px-3 py-2">
              <code className="flex-1 text-[10px] font-mono text-muted truncate">
                {`${window.location.origin}/api/v1/pagerduty/webhook`}
              </code>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/v1/pagerduty/webhook`); toast.success('Copied'); }}
                className="shrink-0 p-1 rounded hover:bg-[color:var(--argus-elevated)]"
              >
                <Copy size={11} className="text-dim" />
              </button>
            </div>
          </Panel>

          <Panel title="Danger zone">
            <p className="text-[11px] text-muted mb-4">Disconnecting will stop all syncs and remove PagerDuty data from WeCrew. This cannot be undone.</p>
            <button
              type="button"
              onClick={() => {
                if (confirm('Disconnect PagerDuty? This will stop all syncs.')) {
                  disconnectPd.mutate(undefined, {
                    onSuccess: () => toast.success('PagerDuty disconnected'),
                    onError: () => toast.error('Failed to disconnect'),
                  });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-crimson-dim text-crimson text-sm font-medium rounded border border-steel hover:opacity-90 transition-colors"
            >
              <Trash2 size={13} /> Disconnect PagerDuty
            </button>
          </Panel>
        </div>
      )}

      <p className="text-center py-2 text-[10px] text-dim font-mono">
        PagerDuty — REST API v2 + Events API v2 · Bidirectional sync · {servicesList.length} services connected
      </p>
    </Page>
  );
}
