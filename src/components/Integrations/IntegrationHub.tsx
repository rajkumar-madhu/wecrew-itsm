import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import {
  Activity, MessageSquare, Database, BarChart3, FileText,
  Phone, Mail, Globe, Webhook, Workflow, CheckCircle,
  XCircle, AlertCircle, Settings, ExternalLink, RefreshCw,
  Loader2, Zap, Layers, Box, Bell, Shield, Eye, Bug,
  Radio, Server, Cloud, GitBranch, Terminal, Search,
} from 'lucide-react';
import { useIntegrations, useCreateIntegration, useUpdateIntegration, useTestConnection } from '../../hooks/useIntegrations';

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
  // ── Monitoring & Observability ──
  { type: 'PROMETHEUS', name: 'Prometheus', icon: Activity, description: 'Metrics collection & alerting', color: 'signal', category: 'monitoring' },
  { type: 'GRAFANA', name: 'Grafana', icon: BarChart3, description: 'Dashboard visualization & panels', color: 'emerald', category: 'monitoring' },
  { type: 'LOKI', name: 'Loki', icon: FileText, description: 'Log aggregation & querying', color: 'violet', category: 'monitoring' },
  { type: 'KUBERNETES_CLUSTER', name: 'Kubernetes', icon: Layers, description: 'Container orchestration & pod management', color: 'signal', category: 'monitoring', dashboardRoute: '/k8s' },
  { type: 'STACKSTORM', name: 'StackStorm', icon: Zap, description: 'Event-driven automation & remediation', color: 'amber', category: 'automation' },
  { type: 'DATADOG', name: 'Datadog', icon: Eye, description: 'Infrastructure & APM monitoring', color: 'violet', category: 'monitoring' },
  { type: 'NEW_RELIC', name: 'New Relic', icon: Search, description: 'Full-stack observability platform', color: 'emerald', category: 'monitoring' },
  { type: 'ELASTICSEARCH', name: 'Elasticsearch', icon: Database, description: 'Search & log analytics engine', color: 'amber', category: 'monitoring' },
  // ── ITSM & Incident Management ──
  { type: 'PAGERDUTY', name: 'PagerDuty', icon: Bell, description: 'Incident response & on-call management', color: 'emerald', category: 'itsm', dashboardRoute: '/pagerduty' },
  { type: 'SERVICENOW', name: 'ServiceNow', icon: Globe, description: 'ITSM sync & ticket mirroring', color: 'signal', category: 'itsm' },
  { type: 'JIRA', name: 'Jira', icon: Bug, description: 'Issue tracking & project management', color: 'signal', category: 'itsm' },
  { type: 'OPSGENIE', name: 'OpsGenie', icon: Shield, description: 'Alert routing & escalation policies', color: 'crimson', category: 'itsm' },
  { type: 'REDMINE', name: 'Redmine', icon: GitBranch, description: 'Project management & bug tracking', color: 'crimson', category: 'itsm' },
  // ── Communication & Notifications ──
  { type: 'SLACK', name: 'Slack', icon: MessageSquare, description: 'Team notifications & incident channels', color: 'amber', category: 'communication' },
  { type: 'APPRISE', name: 'Apprise', icon: Radio, description: 'Multi-channel push notifications', color: 'violet', category: 'communication' },
  { type: 'TWILIO', name: 'Twilio', icon: Phone, description: 'SMS & voice call escalations', color: 'crimson', category: 'communication' },
  { type: 'MSG91', name: 'MSG91', icon: Phone, description: 'India bulk SMS notifications', color: 'emerald', category: 'communication' },
  { type: 'EMAIL', name: 'Email (SMTP)', icon: Mail, description: 'Email notifications & digests', color: 'signal', category: 'communication' },
  // ── Automation & DevOps ──
  { type: 'N8N', name: 'n8n', icon: Workflow, description: 'Workflow automation engine', color: 'violet', category: 'automation' },
  { type: 'ANSIBLE', name: 'Ansible', icon: Terminal, description: 'Configuration management & playbooks', color: 'crimson', category: 'automation' },
  { type: 'TERRAFORM', name: 'Terraform', icon: Cloud, description: 'Infrastructure as Code provisioning', color: 'violet', category: 'cloud' },
  { type: 'WEBHOOK', name: 'Webhooks', icon: Webhook, description: 'Custom webhook receivers', color: 'amber', category: 'automation' },
  { type: 'VAULT', name: 'HashiCorp Vault', icon: Shield, description: 'Secrets management & encryption', color: 'amber', category: 'cloud' },
  { type: 'AWS', name: 'AWS CloudWatch', icon: Cloud, description: 'AWS infrastructure monitoring', color: 'amber', category: 'cloud' },
  { type: 'AZURE', name: 'Azure Monitor', icon: Cloud, description: 'Azure infrastructure monitoring', color: 'signal', category: 'cloud' },
];

// Config field definitions per integration type
// Note: PROMETHEUS and GRAFANA use smart custom forms (see modal render below)
const CONFIG_FIELDS: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
  // KUBERNETES_CLUSTER uses a smart custom form (see modal render below)
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

const statusConfig: Record<string, { icon: any; label: string; cls: string }> = {
  ACTIVE: { icon: CheckCircle, label: 'Active', cls: 'text-emerald bg-emerald-50 border-emerald-200' },
  INACTIVE: { icon: XCircle, label: 'Inactive', cls: 'text-stone-500 bg-stone-100 border-stone-200' },
  ERROR: { icon: AlertCircle, label: 'Error', cls: 'text-crimson bg-red-50 border-red-200' },
};

const CATEGORIES = [
  { key: 'all', label: 'All Integrations' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'itsm', label: 'ITSM' },
  { key: 'communication', label: 'Communication' },
  { key: 'automation', label: 'Automation' },
  { key: 'cloud', label: 'Cloud & Infra' },
];

export default function IntegrationHub() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [configModal, setConfigModal] = useState<string | null>(null);

  // ── Form state for modal ──
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

  const filtered = integrations
    .filter(i => statusFilter === 'all' || i.status === statusFilter)
    .filter(i => categoryFilter === 'all' || i.category === categoryFilter);

  const colorMap: Record<string, string> = {
    signal: 'from-indigo-100 to-indigo-50',
    emerald: 'from-emerald-100 to-emerald-50',
    amber: 'from-amber-100 to-amber-50',
    crimson: 'from-red-100 to-red-50',
    violet: 'from-violet-100 to-violet-50',
  };

  const iconColorMap: Record<string, string> = {
    signal: 'text-signal', emerald: 'text-emerald', amber: 'text-amber', crimson: 'text-crimson', violet: 'text-violet',
  };

  // Populate form when modal opens
  useEffect(() => {
    if (!configModal) return;
    const intg = integrations.find(i => i.id === configModal);
    if (!intg) return;
    setFormName(intg.connected ? intg.name : '');
    setFormEnabled(intg.status === 'ACTIVE');
    const parsed = safeParseConfig(intg.config);
    setFormConfig(parsed);
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
      // EDIT mode — update existing integration
      updateIntegration.mutate(
        { id: intg.apiId, data: { name, config: configStr, status: formEnabled ? 'ACTIVE' : 'INACTIVE' } },
        {
          onSuccess: () => { setSaveMsg('Integration updated successfully'); },
          onError: (err: any) => { setSaveMsg(`Error: ${err?.response?.data?.error || err.message}`); },
        },
      );
    } else {
      // CREATE mode — new integration
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

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-obsidian text-ink border border-[color:var(--argus-border)] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-[color:var(--argus-signal-dim)]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-violet-500/8 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-[color:var(--argus-elevated)] flex items-center justify-center">
                  <Webhook size={16} className="text-signal" />
                </div>
                <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Integration Hub</h1>
                <span className="text-[9px] font-mono font-bold text-signal bg-[color:var(--argus-signal-dim)]/15 px-1.5 py-0.5 rounded border border-indigo-400/20">{integrations.length} TOOLS</span>
              </div>
              <p className="text-muted text-sm ml-[42px]">Connect, configure, and manage all external services and platforms</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)]">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-xs font-medium text-muted"><span className="text-ink font-bold">{activeCount}</span> Active</span>
              </div>
            </div>
          </div>
          {/* ── Summary pills ── */}
          <div className="flex items-center gap-2 mt-3 ml-[42px]">
            {[
              { label: 'Monitoring', count: integrations.filter(i => i.category === 'monitoring').length, active: integrations.filter(i => i.category === 'monitoring' && i.status === 'ACTIVE').length },
              { label: 'ITSM', count: integrations.filter(i => i.category === 'itsm').length, active: integrations.filter(i => i.category === 'itsm' && i.status === 'ACTIVE').length },
              { label: 'Comms', count: integrations.filter(i => i.category === 'communication').length, active: integrations.filter(i => i.category === 'communication' && i.status === 'ACTIVE').length },
              { label: 'Automation', count: integrations.filter(i => i.category === 'automation').length, active: integrations.filter(i => i.category === 'automation' && i.status === 'ACTIVE').length },
              { label: 'Cloud', count: integrations.filter(i => i.category === 'cloud').length, active: integrations.filter(i => i.category === 'cloud' && i.status === 'ACTIVE').length },
            ].map(p => (
              <div key={p.label} className="flex items-center gap-1.5 px-2 py-1 rounded bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)]">
                <span className="text-[10px] text-muted">{p.label}</span>
                <span className="text-[10px] font-bold text-ink">{p.active}/{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent -mt-5 mb-4" />

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                categoryFilter === cat.key
                  ? 'bg-obsidian text-ink border border-[color:var(--argus-border)] shadow-sm'
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-stone-200" />
        {['all', 'ACTIVE', 'INACTIVE'].map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
              statusFilter === f
                ? 'bg-stone-900 text-white border-stone-900'
                : 'text-stone-400 border-stone-200 hover:text-stone-700 hover:border-stone-300'
            )}
          >
            {f === 'all' ? 'All Status' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
        <span className="text-xs text-stone-400 ml-auto font-mono">{filtered.length} integration{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-signal animate-spin" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(integration => {
          const st = statusConfig[integration.status] || statusConfig.INACTIVE;
          const StatusIcon = st.icon;
          const hasDashboard = !!integration.dashboardRoute;
          return (
            <div
              key={integration.id}
              className="glass-card-hover p-5 group cursor-pointer relative"
              onClick={() => handleCardClick(integration)}
            >
              {hasDashboard && integration.connected && (
                <div className="absolute top-3 right-3">
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-[color:var(--argus-signal-dim)] text-signal border border-[color:var(--argus-signal)]/25 flex items-center gap-1">
                    <ExternalLink className="w-2.5 h-2.5" /> Dashboard
                  </span>
                </div>
              )}
              <div className="flex items-start justify-between mb-4">
                <div className={clsx('p-3 rounded-xl bg-gradient-to-br', colorMap[integration.color])}>
                  <integration.icon className={clsx('w-6 h-6', iconColorMap[integration.color])} />
                </div>
                <span className={clsx('badge border', st.cls)}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {st.label}
                </span>
              </div>

              <h3 className="text-base font-semibold text-stone-900 mb-1">{integration.name}</h3>
              <p className="text-xs text-stone-400 mb-4 line-clamp-2">{integration.description}</p>

              <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                <span className="text-[10px] text-stone-300 font-mono">
                  {integration.connected ? `Last sync: ${integration.lastSync}` : 'Not configured'}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {hasDashboard && integration.connected && (
                    <button
                      className="p-1 rounded hover:bg-[color:var(--argus-signal-dim)] text-stone-400 hover:text-signal transition-colors"
                      title="Open Dashboard"
                      onClick={(e) => { e.stopPropagation(); navigate(integration.dashboardRoute!); }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-signal transition-colors"
                    title="Configure"
                    onClick={(e) => { e.stopPropagation(); setConfigModal(integration.id); }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CONFIG MODAL — with real CRUD                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {configModal && (() => {
        const intg = integrations.find(i => i.id === configModal);
        if (!intg) return null;
        const isEdit = !!intg.apiId;
        const fields = CONFIG_FIELDS[intg.type];
        const isSaving = createIntegration.isPending || updateIntegration.isPending;
        const isTesting = testConnection.isPending;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setConfigModal(null)}>
            <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" />
            <div className="relative glass-card p-6 w-full max-w-lg animate-slide-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={clsx('p-2 rounded-xl bg-gradient-to-br', colorMap[intg.color])}>
                    <intg.icon className={clsx('w-5 h-5', iconColorMap[intg.color])} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-stone-900">{intg.name}</h2>
                      <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded', isEdit ? 'bg-[#EEF2FF] text-[#6366F1]' : 'bg-[#FEF3C7] text-[#D97706]')}>
                        {isEdit ? 'EDIT' : 'NEW'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400">{intg.description}</p>
                  </div>
                </div>
                <button onClick={() => setConfigModal(null)} className="text-stone-400 hover:text-stone-900 text-xl">&times;</button>
              </div>

              {/* Form fields */}
              <div className="space-y-3">
                {/* Integration name */}
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Integration Name</label>
                  <input
                    className="input-field"
                    placeholder={intg.name}
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                  />
                </div>

                {/* Type-specific fields */}
                {intg.type === 'PROMETHEUS' ? (
                  <>
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider pt-2">Prometheus Configuration</div>

                    {/* Access Method Toggle */}
                    <div>
                      <label className="block text-xs font-medium text-stone-500 mb-2">Access Method</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'ssh', label: '🔑 SSH (key-based)', desc: 'SSH tunnel to server — requires key exchange' },
                          { value: 'direct', label: '🌐 Direct URL', desc: 'HTTP access with credentials — no SSH needed' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateConfigField('accessMethod', opt.value)}
                            className={clsx(
                              'flex-1 p-2.5 rounded-lg border text-left transition-all',
                              (formConfig.accessMethod || 'ssh') === opt.value
                                ? 'border-signal bg-[color:var(--argus-signal-dim)] text-signal'
                                : 'border-stone-200 text-stone-500 hover:border-stone-300'
                            )}
                          >
                            <div className="text-xs font-semibold">{opt.label}</div>
                            <div className="text-[10px] text-stone-400 mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SSH fields */}
                    {(formConfig.accessMethod || 'ssh') === 'ssh' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {[
                          { key: 'serverIp', label: 'Server IP', placeholder: '154.210.170.126' },
                          { key: 'sshPort', label: 'SSH Port', placeholder: '4422' },
                          { key: 'sshUser', label: 'SSH User', placeholder: 'finadmin' },
                          { key: 'promPort', label: 'Prometheus Port', placeholder: '30000' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="block text-xs font-medium text-stone-500 mb-1.5">{f.label}</label>
                            <input className="input-field" placeholder={f.placeholder} value={formConfig[f.key] || ''} onChange={e => updateConfigField(f.key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Direct URL fields */}
                    {formConfig.accessMethod === 'direct' && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-medium text-stone-500 mb-1.5">Prometheus URL <span className="text-crimson">*</span></label>
                          <input className="input-field" placeholder="http://prometheus.acme.com:9090" value={formConfig.prometheusUrl || ''} onChange={e => updateConfigField('prometheusUrl', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-stone-500 mb-1.5">Username <span className="text-stone-300">(optional)</span></label>
                            <input className="input-field" placeholder="admin" value={formConfig.prometheusUsername || ''} onChange={e => updateConfigField('prometheusUsername', e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-500 mb-1.5">Password <span className="text-stone-300">(optional)</span></label>
                            <input className="input-field" type="password" placeholder="••••••••" value={formConfig.prometheusPassword || ''} onChange={e => updateConfigField('prometheusPassword', e.target.value)} />
                          </div>
                        </div>
                        <p className="text-[10px] text-stone-400 font-mono bg-stone-50 p-2 rounded">
                          Leave username/password blank for unauthenticated Prometheus. Use API Key below for Bearer token auth.
                        </p>
                        <div>
                          <label className="block text-xs font-medium text-stone-500 mb-1.5">Bearer API Key <span className="text-stone-300">(optional, overrides user/pass)</span></label>
                          <input className="input-field" type="password" placeholder="Bearer token if Prometheus uses token auth" value={formConfig.apiKey || ''} onChange={e => updateConfigField('apiKey', e.target.value)} />
                        </div>
                      </div>
                    )}
                  </>
                ) : intg.type === 'GRAFANA' ? (
                  <>
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider pt-2">Grafana Configuration</div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-500 mb-1.5">Grafana URL <span className="text-crimson">*</span></label>
                        <input className="input-field" placeholder="http://grafana.acme.com:3000" value={formConfig.grafanaExternalUrl || ''} onChange={e => updateConfigField('grafanaExternalUrl', e.target.value)} />
                        <p className="text-[10px] text-stone-400 mt-1">Public-accessible URL used for panel iframes and API calls.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-500 mb-1.5">API Key <span className="text-crimson">*</span></label>
                        <input className="input-field" type="password" placeholder="glsa_..." value={formConfig.apiKey || ''} onChange={e => updateConfigField('apiKey', e.target.value)} />
                        <p className="text-[10px] text-stone-400 mt-1">Create in Grafana → Administration → Service Accounts → New token (Editor role).</p>
                      </div>
                      <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100 text-[10px] text-stone-500">
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
                            <label className="block text-xs font-medium text-stone-400 mb-1.5">{f.label}</label>
                            <input className="input-field" placeholder={f.placeholder} value={formConfig[f.key] || ''} onChange={e => updateConfigField(f.key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : intg.type === 'KUBERNETES_CLUSTER' ? (
                  <>
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider pt-2">Kubernetes Configuration</div>

                    {/* Access Method Toggle */}
                    <div>
                      <label className="block text-xs font-medium text-stone-500 mb-2">Access Method</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'ssh', label: '🔑 SSH (key-based)', desc: 'SSH tunnel via pre-shared key — for internal/managed servers' },
                          { value: 'direct', label: '🌐 Direct API URL', desc: 'HTTPS to K8s API server — for external clusters, no SSH needed' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateConfigField('accessMethod', opt.value)}
                            className={clsx(
                              'flex-1 p-2.5 rounded-lg border text-left transition-all',
                              (formConfig.accessMethod || 'ssh') === opt.value
                                ? 'border-signal bg-[color:var(--argus-signal-dim)] text-signal'
                                : 'border-stone-200 text-stone-500 hover:border-stone-300'
                            )}
                          >
                            <div className="text-xs font-semibold">{opt.label}</div>
                            <div className="text-[10px] text-stone-400 mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SSH mode fields */}
                    {(formConfig.accessMethod || 'ssh') === 'ssh' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {[
                          { key: 'serverIp', label: 'Server IP', placeholder: '154.210.170.126' },
                          { key: 'sshPort', label: 'SSH Port', placeholder: '4422' },
                          { key: 'sshUser', label: 'SSH User', placeholder: 'finadmin' },
                          { key: 'clusterName', label: 'Cluster Name', placeholder: 'prod-k8s' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="block text-xs font-medium text-stone-500 mb-1.5">{f.label}</label>
                            <input className="input-field" placeholder={f.placeholder} value={formConfig[f.key] || ''} onChange={e => updateConfigField(f.key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Direct API URL mode fields */}
                    {formConfig.accessMethod === 'direct' && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-medium text-stone-500 mb-1.5">K8s API Server URL <span className="text-crimson">*</span></label>
                          <input className="input-field" placeholder="https://203.0.113.10:6443" value={formConfig.k8sApiUrl || ''} onChange={e => updateConfigField('k8sApiUrl', e.target.value)} />
                          <p className="text-[10px] text-stone-400 mt-1">The public API server address (port 6443 is standard). Self-signed TLS is accepted automatically.</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-500 mb-1.5">Service Account Token <span className="text-stone-300">(recommended)</span></label>
                          <input className="input-field" type="password" placeholder="eyJhbGciOiJSUzI1NiIs..." value={formConfig.k8sToken || ''} onChange={e => updateConfigField('k8sToken', e.target.value)} />
                        </div>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg font-mono text-[9px] text-stone-500 space-y-1 leading-relaxed">
                          <div className="text-[10px] font-semibold text-stone-600 font-sans mb-1.5">How to create a read-only service account token:</div>
                          <div className="text-stone-400">kubectl create serviceaccount argus-reader -n kube-system</div>
                          <div className="text-stone-400">kubectl create clusterrolebinding argus-reader \</div>
                          <div className="text-stone-400 pl-4">--clusterrole=view \</div>
                          <div className="text-stone-400 pl-4">--serviceaccount=kube-system:argus-reader</div>
                          <div className="text-stone-400">kubectl -n kube-system create token argus-reader</div>
                        </div>
                        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Or use Basic Auth (fallback)</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-stone-500 mb-1.5">Username</label>
                            <input className="input-field" placeholder="admin" value={formConfig.k8sUsername || ''} onChange={e => updateConfigField('k8sUsername', e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-500 mb-1.5">Password</label>
                            <input className="input-field" type="password" placeholder="••••••••" value={formConfig.k8sPassword || ''} onChange={e => updateConfigField('k8sPassword', e.target.value)} />
                          </div>
                        </div>
                        <p className="text-[10px] text-stone-400 bg-amber-50 border border-amber-100 p-2 rounded">
                          Service account token takes priority over username/password when both are provided.
                        </p>
                      </div>
                    )}
                  </>
                ) : fields ? (
                  <>
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider pt-2">
                      {intg.name} Configuration
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {fields.map(f => (
                        <div key={f.key} className={f.key === 'grafanaExternalUrl' || f.key === 'webhookUrl' ? 'col-span-2' : ''}>
                          <label className="block text-xs font-medium text-stone-500 mb-1.5">{f.label}</label>
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
                  /* Generic fields for unknown types */
                  <>
                    <div>
                      <label className="block text-xs font-medium text-stone-500 mb-1.5">Endpoint URL</label>
                      <input
                        className="input-field"
                        placeholder={`https://${intg.name.toLowerCase().replace(/\s+/g, '-')}.example.com`}
                        value={formConfig.url || ''}
                        onChange={e => updateConfigField('url', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-500 mb-1.5">API Key / Token</label>
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

                {/* Enabled toggle */}
                <div className="flex items-center justify-between pt-2">
                  <label className="text-sm text-stone-700">Enabled</label>
                  <button
                    type="button"
                    onClick={() => setFormEnabled(v => !v)}
                    className={clsx(
                      'w-10 h-5 rounded-full transition-colors flex items-center px-0.5',
                      formEnabled ? 'bg-signal' : 'bg-stone-300'
                    )}
                  >
                    <div className={clsx(
                      'w-4 h-4 rounded-full transition-transform bg-white',
                      formEnabled ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
              </div>

              {/* Feedback messages */}
              {testResult && (
                <div className={clsx('mt-4 p-3 rounded-lg text-sm flex items-center gap-2',
                  testResult.ok ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]' : 'bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]'
                )}>
                  {testResult.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {testResult.msg}
                </div>
              )}
              {saveMsg && (
                <div className={clsx('mt-3 p-3 rounded-lg text-sm flex items-center gap-2',
                  saveMsg.startsWith('Error') ? 'bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]' : 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]'
                )}>
                  {saveMsg.startsWith('Error') ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                  {saveMsg}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-stone-200">
                <button
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                  disabled={isTesting}
                  onClick={() => handleTest(intg)}
                >
                  {isTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : <><RefreshCw className="w-3.5 h-3.5" /> Test Connection</>}
                </button>
                <button
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                  disabled={isSaving}
                  onClick={() => handleSave(intg)}
                >
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save'}
                </button>
                {intg.dashboardRoute && intg.connected && (
                  <button
                    className="btn-ghost flex items-center gap-1.5"
                    onClick={() => { setConfigModal(null); navigate(intg.dashboardRoute!); }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Dashboard
                  </button>
                )}
                <button onClick={() => setConfigModal(null)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
