import { useState, useEffect, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, MessageSquare, Database, BarChart3, FileText,
  Phone, Mail, Globe, Webhook, Workflow, CheckCircle,
  XCircle, AlertCircle, Settings, ExternalLink, RefreshCw,
  Loader2, Zap, Layers, Bell, Shield, Eye, Bug,
  Radio, Cloud, GitBranch, Terminal, Search, X,
} from 'lucide-react';
import { useIntegrations, useCreateIntegration, useUpdateIntegration, useTestConnection } from '../../hooks/useIntegrations';
import { Page, Panel, Toolbar, Segmented, GhostButton, PrimaryButton } from '../ui/PageChrome';

interface IntegrationDef {
  type: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  category: 'monitoring' | 'itsm' | 'communication' | 'automation' | 'cloud';
  dashboardRoute?: string;
}

const INTEGRATION_DEFS: IntegrationDef[] = [
  { type: 'PROMETHEUS', name: 'Prometheus', icon: Activity, description: 'Metrics collection & alerting', color: 'signal', category: 'monitoring' },
  { type: 'GRAFANA', name: 'Grafana', icon: BarChart3, description: 'Dashboard visualization & panels', color: 'emerald', category: 'monitoring' },
  { type: 'LOKI', name: 'Loki', icon: FileText, description: 'Log aggregation & querying', color: 'violet', category: 'monitoring' },
  { type: 'KUBERNETES_CLUSTER', name: 'Kubernetes', icon: Layers, description: 'Container orchestration & pod management', color: 'signal', category: 'monitoring', dashboardRoute: '/k8s' },
  { type: 'STACKSTORM', name: 'StackStorm', icon: Zap, description: 'Event-driven automation & remediation', color: 'amber', category: 'automation' },
  { type: 'DATADOG', name: 'Datadog', icon: Eye, description: 'Infrastructure & APM monitoring', color: 'violet', category: 'monitoring' },
  { type: 'NEW_RELIC', name: 'New Relic', icon: Search, description: 'Full-stack observability platform', color: 'emerald', category: 'monitoring' },
  { type: 'ELASTICSEARCH', name: 'Elasticsearch', icon: Database, description: 'Search & log analytics engine', color: 'amber', category: 'monitoring' },
  { type: 'PAGERDUTY', name: 'PagerDuty', icon: Bell, description: 'Incident response & on-call management', color: 'emerald', category: 'itsm', dashboardRoute: '/pagerduty' },
  { type: 'SERVICENOW', name: 'ServiceNow', icon: Globe, description: 'ITSM sync & ticket mirroring', color: 'signal', category: 'itsm' },
  { type: 'JIRA', name: 'Jira', icon: Bug, description: 'Issue tracking & project management', color: 'signal', category: 'itsm' },
  { type: 'OPSGENIE', name: 'OpsGenie', icon: Shield, description: 'Alert routing & escalation policies', color: 'crimson', category: 'itsm' },
  { type: 'REDMINE', name: 'Redmine', icon: GitBranch, description: 'Project management & bug tracking', color: 'crimson', category: 'itsm' },
  { type: 'SLACK', name: 'Slack', icon: MessageSquare, description: 'Team notifications & incident channels', color: 'amber', category: 'communication' },
  { type: 'APPRISE', name: 'Apprise', icon: Radio, description: 'Multi-channel push notifications', color: 'violet', category: 'communication' },
  { type: 'TWILIO', name: 'Twilio', icon: Phone, description: 'SMS & voice call escalations', color: 'crimson', category: 'communication' },
  { type: 'MSG91', name: 'MSG91', icon: Phone, description: 'India bulk SMS notifications', color: 'emerald', category: 'communication' },
  { type: 'EMAIL', name: 'Email (SMTP)', icon: Mail, description: 'Email notifications & digests', color: 'signal', category: 'communication' },
  { type: 'N8N', name: 'n8n', icon: Workflow, description: 'Workflow automation engine', color: 'violet', category: 'automation' },
  { type: 'ANSIBLE', name: 'Ansible', icon: Terminal, description: 'Configuration management & playbooks', color: 'crimson', category: 'automation' },
  { type: 'TERRAFORM', name: 'Terraform', icon: Cloud, description: 'Infrastructure as Code provisioning', color: 'violet', category: 'cloud' },
  { type: 'WEBHOOK', name: 'Webhooks', icon: Webhook, description: 'Custom webhook receivers', color: 'amber', category: 'automation' },
  { type: 'VAULT', name: 'HashiCorp Vault', icon: Shield, description: 'Secrets management & encryption', color: 'amber', category: 'cloud' },
  { type: 'AWS', name: 'AWS CloudWatch', icon: Cloud, description: 'AWS infrastructure monitoring', color: 'amber', category: 'cloud' },
  { type: 'AZURE', name: 'Azure Monitor', icon: Cloud, description: 'Azure infrastructure monitoring', color: 'signal', category: 'cloud' },
];

const CONFIG_FIELDS: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
  SLACK: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' },
    { key: 'channel', label: 'Channel', placeholder: '#alerts' },
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/...' },
  ],
  PAGERDUTY: [
    { key: 'routingKey', label: 'Routing Key', placeholder: 'R0...', type: 'password' },
    { key: 'serviceId', label: 'Service ID', placeholder: 'P...' },
    { key: 'apiKey', label: 'API Key', placeholder: 'u+...', type: 'password' },
  ],
  LOKI: [
    { key: 'serverIp', label: 'Server IP', placeholder: '10.0.0.1' },
    { key: 'lokiPort', label: 'Loki Port', placeholder: '3100' },
    { key: 'sshPort', label: 'SSH Port', placeholder: '4422' },
    { key: 'sshUser', label: 'SSH User', placeholder: 'finadmin' },
  ],
  STACKSTORM: [
    { key: 'serverIp', label: 'Server IP', placeholder: '10.0.0.1' },
    { key: 'apiPort', label: 'API Port', placeholder: '9101' },
    { key: 'apiKey', label: 'API Key', placeholder: 'st2_...', type: 'password' },
  ],
  TWILIO: [
    { key: 'accountSid', label: 'Account SID', placeholder: 'AC...' },
    { key: 'authToken', label: 'Auth Token', placeholder: '...', type: 'password' },
    { key: 'fromNumber', label: 'From Number', placeholder: '+1...' },
  ],
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function safeParseConfig(config: any): Record<string, any> {
  if (!config) return {};
  if (typeof config === 'object') return config;
  try { return JSON.parse(config); } catch { return {}; }
}

const COLOR: Record<string, { bg: string; fg: string }> = {
  signal: { bg: 'var(--argus-signal-dim)', fg: 'var(--argus-signal)' },
  emerald: { bg: 'var(--argus-emerald-dim)', fg: 'var(--argus-emerald)' },
  amber: { bg: 'var(--argus-amber-dim)', fg: 'var(--argus-amber)' },
  crimson: { bg: 'var(--argus-crimson-dim)', fg: 'var(--argus-crimson)' },
  violet: { bg: 'var(--argus-violet-dim)', fg: 'var(--argus-violet)' },
};

const statusConfig: Record<string, { icon: any; label: string; tone: 'ok' | 'neutral' | 'danger' }> = {
  ACTIVE: { icon: CheckCircle, label: 'Active', tone: 'ok' },
  INACTIVE: { icon: XCircle, label: 'Inactive', tone: 'neutral' },
  ERROR: { icon: AlertCircle, label: 'Error', tone: 'danger' },
};

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'itsm', label: 'ITSM' },
  { value: 'communication', label: 'Comms' },
  { value: 'automation', label: 'Automation' },
  { value: 'cloud', label: 'Cloud' },
];

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">{children}</label>;
}

export default function IntegrationHub() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [configModal, setConfigModal] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const { data: intgData, isLoading } = useIntegrations();
  const createIntegration = useCreateIntegration();
  const updateIntegration = useUpdateIntegration();
  const testConnection = useTestConnection();

  const apiIntegrations: any[] = intgData?.data || [];

  const integrations = INTEGRATION_DEFS.map((def, idx) => {
    const apiMatch = apiIntegrations.find((a: any) => a.type === def.type);
    return {
      id: apiMatch?.id || `def-${idx}`,
      ...def,
      status: apiMatch?.status || 'INACTIVE',
      lastSync: apiMatch?.lastSyncAt ? relativeTime(apiMatch.lastSyncAt) : 'Never',
      config: apiMatch?.config || {},
      connected: !!apiMatch,
      apiId: apiMatch?.id || null,
    };
  });

  const activeCount = integrations.filter(i => i.status === 'ACTIVE').length;
  const errorCount = integrations.filter(i => i.status === 'ERROR').length;
  const inactiveCount = integrations.filter(i => i.status === 'INACTIVE').length;

  const filtered = integrations
    .filter(i => statusFilter === 'all' || i.status === statusFilter)
    .filter(i => categoryFilter === 'all' || i.category === categoryFilter);

  useEffect(() => {
    if (!configModal) return;
    const intg = integrations.find(i => i.id === configModal);
    if (!intg) return;
    setFormName(intg.connected ? intg.name : '');
    setFormEnabled(intg.status === 'ACTIVE');
    setFormConfig(safeParseConfig(intg.config));
    setTestResult(null);
    setSaveMsg(null);
  }, [configModal]);

  const handleCardClick = (integration: typeof integrations[0]) => {
    if (integration.dashboardRoute && integration.connected) {
      navigate(integration.dashboardRoute);
    } else {
      setConfigModal(integration.id);
    }
  };

  function handleSave(intg: typeof integrations[0]) {
    setSaveMsg(null);
    setTestResult(null);
    const configStr = JSON.stringify(formConfig);
    const name = formName || intg.name;

    if (intg.apiId) {
      updateIntegration.mutate(
        { id: intg.apiId, data: { name, config: configStr, status: formEnabled ? 'ACTIVE' : 'INACTIVE' } },
        {
          onSuccess: () => { setSaveMsg('Integration updated successfully'); },
          onError: (err: any) => { setSaveMsg(`Error: ${err?.response?.data?.error || err.message}`); },
        },
      );
    } else {
      createIntegration.mutate(
        { name, type: intg.type, config: configStr },
        {
          onSuccess: () => { setSaveMsg('Integration created successfully'); },
          onError: (err: any) => { setSaveMsg(`Error: ${err?.response?.data?.error || err.message}`); },
        },
      );
    }
  }

  function handleTest(intg: typeof integrations[0]) {
    setTestResult(null);
    setSaveMsg(null);
    if (!intg.apiId) {
      setTestResult({ ok: false, msg: 'Save the integration first before testing' });
      return;
    }
    testConnection.mutate(intg.apiId, {
      onSuccess: (data: any) => {
        const d = data?.data || data;
        setTestResult({ ok: d.connected, msg: d.message || (d.connected ? 'Connection successful' : 'Connection failed') });
      },
      onError: (err: any) => {
        setTestResult({ ok: false, msg: err?.response?.data?.error || err.message || 'Test failed' });
      },
    });
  }

  function updateConfigField(key: string, value: string) {
    setFormConfig(prev => ({ ...prev, [key]: value }));
  }

  const kpis = [
    { label: 'Tools', value: integrations.length, sub: 'in the catalogue' },
    { label: 'Active', value: activeCount, sub: 'connected and live' },
    { label: 'Inactive', value: inactiveCount, sub: 'not configured' },
    { label: 'Errors', value: errorCount, sub: 'need attention', tone: errorCount > 0 ? 'danger' : undefined },
    { label: 'Showing', value: filtered.length, sub: 'after filters' },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Operate · connections</span>
            <h1 className="cx-hero__title">Integrations</h1>
            <p className="cx-hero__deck">
              Connect monitoring, ITSM, comms and automation so alerts and tickets land in WeCrew
              instead of living in another tool.
            </p>
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
        <span className="cx-crumb__current">Integrations</span>
      </nav>

      <Toolbar>
        <Segmented options={CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} />
        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />
        {(['all', 'ACTIVE', 'INACTIVE'] as const).map((f) => (
          <GhostButton key={f} active={statusFilter === f} onClick={() => setStatusFilter(f)}>
            {f === 'all' ? 'All status' : f.charAt(0) + f.slice(1).toLowerCase()}
          </GhostButton>
        ))}
        <span className="ml-auto text-[11px] font-mono text-dim">
          {filtered.length} integration{filtered.length !== 1 ? 's' : ''}
        </span>
      </Toolbar>

      {isLoading ? (
        <Panel>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-signal animate-spin" />
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((integration) => {
            const st = statusConfig[integration.status] || statusConfig.INACTIVE;
            const StatusIcon = st.icon;
            const tone = COLOR[integration.color] || COLOR.signal;
            const hasDashboard = !!integration.dashboardRoute;
            return (
              <button
                type="button"
                key={integration.id}
                className="text-left p-4 group relative transition-colors"
                style={{
                  background: 'var(--argus-surface)',
                  border: '1px solid var(--argus-border)',
                  borderRadius: 'var(--cx-radius)',
                  boxShadow: 'var(--argus-shadow-card)',
                }}
                onClick={() => handleCardClick(integration)}
              >
                {hasDashboard && integration.connected && (
                  <span className="absolute top-3 right-3 cx-pill cx-pill--alert">
                    <ExternalLink className="w-2.5 h-2.5" /> Dashboard
                  </span>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="p-2.5 rounded-lg"
                    style={{ background: tone.bg }}
                  >
                    <integration.icon className="w-5 h-5" style={{ color: tone.fg }} />
                  </div>
                  <span className={clsx('cx-pill', `cx-pill--${st.tone}`)}>
                    <StatusIcon className="w-3 h-3" />
                    {st.label}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-ink mb-1">{integration.name}</h3>
                <p className="text-xs text-muted mb-3 line-clamp-2">{integration.description}</p>

                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--argus-border)' }}>
                  <span className="text-[10px] text-dim font-mono">
                    {integration.connected ? `Last sync: ${integration.lastSync}` : 'Not configured'}
                  </span>
                  <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {hasDashboard && integration.connected && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="p-1 rounded text-dim hover:text-signal"
                        title="Open Dashboard"
                        onClick={(e) => { e.stopPropagation(); navigate(integration.dashboardRoute!); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); navigate(integration.dashboardRoute!); } }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      className="p-1 rounded text-dim hover:text-signal"
                      title="Configure"
                      onClick={(e) => { e.stopPropagation(); setConfigModal(integration.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setConfigModal(integration.id); } }}
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {configModal && (() => {
        const intg = integrations.find(i => i.id === configModal);
        if (!intg) return null;
        const isEdit = !!intg.apiId;
        const fields = CONFIG_FIELDS[intg.type];
        const isSaving = createIntegration.isPending || updateIntegration.isPending;
        const isTesting = testConnection.isPending;
        const tone = COLOR[intg.color] || COLOR.signal;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfigModal(null)}>
            <div className="absolute inset-0" style={{ background: 'var(--argus-overlay)' }} />
            <div
              className="relative w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto"
              style={{ background: 'var(--argus-surface)', border: '1px solid var(--argus-border)', borderRadius: 'var(--cx-radius)', boxShadow: 'var(--argus-shadow-card)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--argus-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ background: tone.bg }}>
                    <intg.icon className="w-5 h-5" style={{ color: tone.fg }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="cx-sectionhead__title" style={{ fontSize: '1.15rem' }}>{intg.name}</h2>
                      <span className={clsx('cx-pill', isEdit ? 'cx-pill--alert' : 'cx-pill--warn')}>
                        {isEdit ? 'Edit' : 'New'}
                      </span>
                    </div>
                    <p className="text-xs text-muted">{intg.description}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setConfigModal(null)} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)]" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div>
                  <FieldLabel>Integration Name</FieldLabel>
                  <input
                    className="input-field"
                    placeholder={intg.name}
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                  />
                </div>

                {intg.type === 'PROMETHEUS' ? (
                  <>
                    <p className="text-[10px] font-bold text-dim uppercase tracking-wider pt-2">Prometheus Configuration</p>
                    <div>
                      <FieldLabel>Access Method</FieldLabel>
                      <div className="flex gap-2">
                        {[
                          { value: 'ssh', label: 'SSH (key-based)', desc: 'SSH tunnel to server — requires key exchange' },
                          { value: 'direct', label: 'Direct URL', desc: 'HTTP access with credentials — no SSH needed' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateConfigField('accessMethod', opt.value)}
                            className={clsx(
                              'flex-1 p-2.5 rounded-lg border text-left transition-all',
                              (formConfig.accessMethod || 'ssh') === opt.value
                                ? 'border-signal bg-signal-dim text-signal'
                                : 'border-steel text-muted hover:border-graphite'
                            )}
                          >
                            <div className="text-xs font-semibold">{opt.label}</div>
                            <div className="text-[10px] text-dim mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {(formConfig.accessMethod || 'ssh') === 'ssh' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {[
                          { key: 'serverIp', label: 'Server IP', placeholder: '154.210.170.126' },
                          { key: 'sshPort', label: 'SSH Port', placeholder: '4422' },
                          { key: 'sshUser', label: 'SSH User', placeholder: 'finadmin' },
                          { key: 'promPort', label: 'Prometheus Port', placeholder: '30000' },
                        ].map(f => (
                          <div key={f.key}>
                            <FieldLabel>{f.label}</FieldLabel>
                            <input className="input-field" placeholder={f.placeholder} value={formConfig[f.key] || ''} onChange={e => updateConfigField(f.key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {formConfig.accessMethod === 'direct' && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <FieldLabel>Prometheus URL *</FieldLabel>
                          <input className="input-field" placeholder="http://prometheus.acme.com:9090" value={formConfig.prometheusUrl || ''} onChange={e => updateConfigField('prometheusUrl', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <FieldLabel>Username (optional)</FieldLabel>
                            <input className="input-field" placeholder="admin" value={formConfig.prometheusUsername || ''} onChange={e => updateConfigField('prometheusUsername', e.target.value)} />
                          </div>
                          <div>
                            <FieldLabel>Password (optional)</FieldLabel>
                            <input className="input-field" type="password" placeholder="••••••••" value={formConfig.prometheusPassword || ''} onChange={e => updateConfigField('prometheusPassword', e.target.value)} />
                          </div>
                        </div>
                        <p className="text-[10px] text-dim font-mono bg-slate p-2 rounded">
                          Leave username/password blank for unauthenticated Prometheus. Use API Key below for Bearer token auth.
                        </p>
                        <div>
                          <FieldLabel>Bearer API Key (optional)</FieldLabel>
                          <input className="input-field" type="password" placeholder="Bearer token if Prometheus uses token auth" value={formConfig.apiKey || ''} onChange={e => updateConfigField('apiKey', e.target.value)} />
                        </div>
                      </div>
                    )}
                  </>
                ) : intg.type === 'GRAFANA' ? (
                  <>
                    <p className="text-[10px] font-bold text-dim uppercase tracking-wider pt-2">Grafana Configuration</p>
                    <div className="space-y-3">
                      <div>
                        <FieldLabel>Grafana URL *</FieldLabel>
                        <input className="input-field" placeholder="http://grafana.acme.com:3000" value={formConfig.grafanaExternalUrl || ''} onChange={e => updateConfigField('grafanaExternalUrl', e.target.value)} />
                        <p className="text-[10px] text-dim mt-1">Public-accessible URL used for panel iframes and API calls.</p>
                      </div>
                      <div>
                        <FieldLabel>API Key *</FieldLabel>
                        <input className="input-field" type="password" placeholder="glsa_..." value={formConfig.apiKey || ''} onChange={e => updateConfigField('apiKey', e.target.value)} />
                        <p className="text-[10px] text-dim mt-1">Create in Grafana → Administration → Service Accounts → New token (Editor role).</p>
                      </div>
                      <div className="p-2.5 bg-slate rounded-lg border border-steel text-[10px] text-muted">
                        <span className="font-semibold">SSH fields optional:</span> only needed if Grafana is not directly reachable. Leave blank for direct URL access.
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'serverIp', label: 'Server IP (SSH only)', placeholder: '154.210.170.126' },
                          { key: 'sshPort', label: 'SSH Port', placeholder: '4422' },
                          { key: 'sshUser', label: 'SSH User', placeholder: 'finadmin' },
                          { key: 'grafanaPort', label: 'Internal Grafana Port', placeholder: '30010' },
                        ].map(f => (
                          <div key={f.key}>
                            <FieldLabel>{f.label}</FieldLabel>
                            <input className="input-field" placeholder={f.placeholder} value={formConfig[f.key] || ''} onChange={e => updateConfigField(f.key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : intg.type === 'KUBERNETES_CLUSTER' ? (
                  <>
                    <p className="text-[10px] font-bold text-dim uppercase tracking-wider pt-2">Kubernetes Configuration</p>
                    <div>
                      <FieldLabel>Access Method</FieldLabel>
                      <div className="flex gap-2">
                        {[
                          { value: 'ssh', label: 'SSH (key-based)', desc: 'SSH tunnel via pre-shared key — for internal/managed servers' },
                          { value: 'direct', label: 'Direct API URL', desc: 'HTTPS to K8s API server — for external clusters, no SSH needed' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateConfigField('accessMethod', opt.value)}
                            className={clsx(
                              'flex-1 p-2.5 rounded-lg border text-left transition-all',
                              (formConfig.accessMethod || 'ssh') === opt.value
                                ? 'border-signal bg-signal-dim text-signal'
                                : 'border-steel text-muted hover:border-graphite'
                            )}
                          >
                            <div className="text-xs font-semibold">{opt.label}</div>
                            <div className="text-[10px] text-dim mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {(formConfig.accessMethod || 'ssh') === 'ssh' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {[
                          { key: 'serverIp', label: 'Server IP', placeholder: '154.210.170.126' },
                          { key: 'sshPort', label: 'SSH Port', placeholder: '4422' },
                          { key: 'sshUser', label: 'SSH User', placeholder: 'finadmin' },
                          { key: 'clusterName', label: 'Cluster Name', placeholder: 'prod-k8s' },
                        ].map(f => (
                          <div key={f.key}>
                            <FieldLabel>{f.label}</FieldLabel>
                            <input className="input-field" placeholder={f.placeholder} value={formConfig[f.key] || ''} onChange={e => updateConfigField(f.key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {formConfig.accessMethod === 'direct' && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <FieldLabel>K8s API Server URL *</FieldLabel>
                          <input className="input-field" placeholder="https://203.0.113.10:6443" value={formConfig.k8sApiUrl || ''} onChange={e => updateConfigField('k8sApiUrl', e.target.value)} />
                          <p className="text-[10px] text-dim mt-1">The public API server address (port 6443 is standard). Self-signed TLS is accepted automatically.</p>
                        </div>
                        <div>
                          <FieldLabel>Service Account Token (recommended)</FieldLabel>
                          <input className="input-field" type="password" placeholder="eyJhbGciOiJSUzI1NiIs..." value={formConfig.k8sToken || ''} onChange={e => updateConfigField('k8sToken', e.target.value)} />
                        </div>
                        <div className="p-3 bg-slate border border-steel rounded-lg font-mono text-[9px] text-muted space-y-1 leading-relaxed">
                          <div className="text-[10px] font-semibold text-ink font-sans mb-1.5">How to create a read-only service account token:</div>
                          <div>kubectl create serviceaccount argus-reader -n kube-system</div>
                          <div>kubectl create clusterrolebinding argus-reader \</div>
                          <div className="pl-4">--clusterrole=view \</div>
                          <div className="pl-4">--serviceaccount=kube-system:argus-reader</div>
                          <div>kubectl -n kube-system create token argus-reader</div>
                        </div>
                        <p className="text-[10px] font-semibold text-dim uppercase tracking-wider">Or use Basic Auth (fallback)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <FieldLabel>Username</FieldLabel>
                            <input className="input-field" placeholder="admin" value={formConfig.k8sUsername || ''} onChange={e => updateConfigField('k8sUsername', e.target.value)} />
                          </div>
                          <div>
                            <FieldLabel>Password</FieldLabel>
                            <input className="input-field" type="password" placeholder="••••••••" value={formConfig.k8sPassword || ''} onChange={e => updateConfigField('k8sPassword', e.target.value)} />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted bg-amber-dim border border-steel p-2 rounded">
                          Service account token takes priority over username/password when both are provided.
                        </p>
                      </div>
                    )}
                  </>
                ) : fields ? (
                  <>
                    <p className="text-[10px] font-bold text-dim uppercase tracking-wider pt-2">
                      {intg.name} Configuration
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {fields.map(f => (
                        <div key={f.key} className={f.key === 'grafanaExternalUrl' || f.key === 'webhookUrl' ? 'col-span-2' : ''}>
                          <FieldLabel>{f.label}</FieldLabel>
                          <input
                            className="input-field"
                            type={f.type || 'text'}
                            placeholder={f.placeholder}
                            value={formConfig[f.key] || ''}
                            onChange={e => updateConfigField(f.key, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <FieldLabel>Endpoint URL</FieldLabel>
                      <input
                        className="input-field"
                        placeholder={`https://${intg.name.toLowerCase().replace(/\s+/g, '-')}.example.com`}
                        value={formConfig.url || ''}
                        onChange={e => updateConfigField('url', e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel>API Key / Token</FieldLabel>
                      <input
                        className="input-field"
                        type="password"
                        placeholder="Enter API key"
                        value={formConfig.apiKey || ''}
                        onChange={e => updateConfigField('apiKey', e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between pt-2">
                  <label className="text-sm text-ink">Enabled</label>
                  <button
                    type="button"
                    onClick={() => setFormEnabled(v => !v)}
                    className={clsx(
                      'w-10 h-5 rounded-full transition-colors flex items-center px-0.5',
                      formEnabled ? 'bg-signal' : 'bg-graphite'
                    )}
                  >
                    <div className={clsx(
                      'w-4 h-4 rounded-full transition-transform bg-white',
                      formEnabled ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
              </div>

              {testResult && (
                <div className={clsx(
                  'mx-5 mb-3 p-3 rounded-lg text-sm flex items-center gap-2 border',
                  testResult.ok ? 'bg-emerald-dim text-emerald border-steel' : 'bg-crimson-dim text-crimson border-steel'
                )}>
                  {testResult.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {testResult.msg}
                </div>
              )}
              {saveMsg && (
                <div className={clsx(
                  'mx-5 mb-3 p-3 rounded-lg text-sm flex items-center gap-2 border',
                  saveMsg.startsWith('Error') ? 'bg-crimson-dim text-crimson border-steel' : 'bg-emerald-dim text-emerald border-steel'
                )}>
                  {saveMsg.startsWith('Error') ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                  {saveMsg}
                </div>
              )}

              <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--argus-border)' }}>
                <GhostButton onClick={() => handleTest(intg)} disabled={isTesting}>
                  {isTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</> : <><RefreshCw className="w-3.5 h-3.5" /> Test</>}
                </GhostButton>
                <PrimaryButton onClick={() => handleSave(intg)} disabled={isSaving} className="flex-1">
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save'}
                </PrimaryButton>
                {intg.dashboardRoute && intg.connected && (
                  <GhostButton onClick={() => { setConfigModal(null); navigate(intg.dashboardRoute!); }}>
                    <ExternalLink className="w-3.5 h-3.5" /> Dashboard
                  </GhostButton>
                )}
                <GhostButton onClick={() => setConfigModal(null)}>Cancel</GhostButton>
              </div>
            </div>
          </div>
        );
      })()}
    </Page>
  );
}
