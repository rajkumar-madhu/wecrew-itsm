import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  AlertTriangle, CheckCircle2, Clock, ExternalLink, Users,
  Zap, Shield, Bell, Settings, Activity, ChevronRight,
  Server, GitBranch, RefreshCw, Loader2, XCircle,
  Phone, Mail, ArrowRight, Eye, Link2, Lock,
  ToggleLeft, ToggleRight, Copy, Trash2, Plus,
  Building2, Globe, User, List, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import {
  usePdStatus, usePdOverview, usePdIncidents, usePdOnCalls,
  usePdServices, usePdEscalationPolicies, usePdStats,
  useConnectPagerDuty, useDisconnectPagerDuty, useValidatePdKey,
} from '../../hooks/usePagerDuty';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  triggered:    { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Triggered' },
  acknowledged: { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Acknowledged' },
  resolved:     { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500',label: 'Resolved' },
};

const SERVICE_STATUS_STYLE: Record<string, { color: string; dot: string; label: string }> = {
  active:       { color: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Active' },
  warning:      { color: 'text-amber-600',   dot: 'bg-amber-500',   label: 'Warning' },
  critical:     { color: 'text-red-600',     dot: 'bg-red-500',     label: 'Critical' },
  maintenance:  { color: 'text-blue-600',    dot: 'bg-blue-500',    label: 'Maintenance' },
  disabled:     { color: 'text-stone-400',   dot: 'bg-stone-300',   label: 'Disabled' },
};

// ══════════════════════════════════════════════════════════════
// Setup Wizard (not connected)
// ══════════════════════════════════════════════════════════════

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

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#06AC38] to-[#1CC84A] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-green-500/20">
          <Zap size={28} className="text-ink" />
        </div>
        <h1 className="font-display text-2xl font-bold text-stone-900 mb-2">Connect PagerDuty</h1>
        <p className="text-sm text-stone-500 max-w-sm mx-auto">Enter your PagerDuty API key to sync services, incidents, and on-call schedules with WeCrew.</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {['Get API Key', 'Validate', 'Configure', 'Connect'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold', i === 0 || (i === 1 && step !== 'form') || (i === 2 && step === 'success') ? 'bg-[#06AC38] text-white' : 'bg-stone-100 text-stone-400')}>
              {i + 1}
            </div>
            {i < 3 && <div className="w-8 h-px bg-stone-200" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Step 1 + 2: Enter and validate key */}
        <div className="p-6 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
            <Lock size={14} className="text-stone-400" /> API Key (REST API v2)
          </h3>
          <div className="relative">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setStep('form'); setValidationResult(null); }}
              placeholder="u+xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3 text-sm font-mono bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 pr-32"
            />
            <button
              onClick={handleValidate}
              disabled={!apiKey.trim() || step === 'validating'}
              className={clsx(
                'absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                step === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-800 text-white hover:bg-stone-700',
                (!apiKey.trim() || step === 'validating') && 'opacity-50 cursor-not-allowed'
              )}
            >
              {step === 'validating' ? <Loader2 size={12} className="animate-spin" /> : step === 'success' ? <span className="flex items-center gap-1"><CheckCircle2 size={12} />Valid</span> : 'Validate'}
            </button>
          </div>
          {validationResult && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <User size={14} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-800">{validationResult.name}</p>
                <p className="text-[10px] text-emerald-600">{validationResult.email}</p>
              </div>
              <CheckCircle2 size={16} className="text-emerald-500 ml-auto" />
            </div>
          )}
          <p className="text-[11px] text-stone-400 mt-2">
            Get your key at <span className="font-mono text-stone-600">app.pagerduty.com → My Profile → API Access → Create API User Token</span>
          </p>
        </div>

        {/* Step 3: Routing Key */}
        <div className="p-6 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800 mb-1 flex items-center gap-2">
            <Zap size={14} className="text-stone-400" /> Events API Routing Key <span className="text-[10px] font-normal text-stone-400 ml-1">(for sending alerts to PagerDuty)</span>
          </h3>
          <input
            type="text"
            value={routingKey}
            onChange={(e) => setRoutingKey(e.target.value)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full mt-2 px-4 py-3 text-sm font-mono bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
          />
          <p className="text-[11px] text-stone-400 mt-2">
            Get this from <span className="font-mono text-stone-600">Services → Integrations → Events API v2 → Routing Key</span>
          </p>
        </div>

        {/* Step 4: Options */}
        <div className="p-6 border-b border-stone-100 space-y-4">
          <h3 className="text-sm font-bold text-stone-800">Sync Options</h3>
          {[
            { label: 'Auto-sync every 5 minutes', sub: 'Keep incidents, services, and on-call schedules updated', value: autoSync, toggle: setAutoSync },
            { label: 'Auto-create WeCrew incidents', sub: 'Triggered PagerDuty incidents create WeCrew incidents automatically', value: autoCreate, toggle: setAutoCreate },
          ].map((opt) => (
            <div key={opt.label} className="flex items-start gap-3">
              <button onClick={() => opt.toggle(!opt.value)} className={clsx('shrink-0 w-10 h-6 rounded-full transition-colors mt-0.5', opt.value ? 'bg-[#06AC38]' : 'bg-stone-200')}>
                <span className={clsx('block w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform', opt.value ? 'translate-x-4.5' : 'translate-x-0.5')} style={{ width: 18, height: 18, marginTop: 3, marginLeft: opt.value ? 8 : 3 }} />
              </button>
              <div>
                <p className="text-sm font-medium text-stone-800">{opt.label}</p>
                <p className="text-[11px] text-stone-400">{opt.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Connect button */}
        <div className="p-6 bg-stone-50">
          <button
            onClick={handleConnect}
            disabled={step !== 'success' || connectPd.isPending}
            className={clsx(
              'w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
              step === 'success' ? 'bg-[#06AC38] text-white hover:bg-[#059933] shadow-lg shadow-green-500/20' : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            )}
          >
            {connectPd.isPending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {connectPd.isPending ? 'Connecting...' : 'Connect PagerDuty'}
          </button>
          <p className="text-center text-[11px] text-stone-400 mt-2">Validate your API key above before connecting</p>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        {[
          { icon: Zap, title: 'Instant Sync', desc: 'Services, incidents, and on-call pulled immediately', color: 'text-amber-500 bg-amber-50' },
          { icon: Bell, title: 'Live Alerts', desc: 'WeCrew sends alerts to PagerDuty via Events API', color: 'text-red-500 bg-red-50' },
          { icon: CheckCircle2, title: 'Bidirectional', desc: 'Resolve in PD → auto-resolve in WeCrew', color: 'text-emerald-500 bg-emerald-50' },
        ].map((f) => (
          <div key={f.title} className="p-4 bg-white rounded-xl border border-stone-200 shadow-sm text-center">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2', f.color)}>
              <f.icon size={18} />
            </div>
            <p className="text-xs font-semibold text-stone-800 mb-1">{f.title}</p>
            <p className="text-[10px] text-stone-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Stat Card
// ══════════════════════════════════════════════════════════════

function StatCard({ label, value, icon: Icon, color, bg, border, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; bg: string; border: string; sub?: string;
}) {
  return (
    <div className={clsx('bg-white rounded-2xl border p-4 shadow-sm', border)}>
      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center mb-2', bg)}>
        <Icon size={17} className={color} />
      </div>
      <p className="text-2xl font-display font-bold text-stone-900 tracking-tight">{value}</p>
      <p className="text-[10px] text-stone-400 mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-stone-300 mt-0.5">{sub}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Incident Row
// ══════════════════════════════════════════════════════════════

function IncidentRow({ incident }: { incident: PdIncident }) {
  const statusStyle = STATUS_STYLE[incident.status] || STATUS_STYLE.triggered;
  return (
    <div className="px-5 py-3.5 hover:bg-stone-50/60 transition-all group">
      <div className="flex items-start gap-3">
        <div className={clsx('shrink-0 mt-0.5 w-2 h-2 rounded-full ring-2 ring-offset-2', incident.status === 'triggered' ? 'bg-red-500 ring-red-200 animate-pulse' : incident.status === 'acknowledged' ? 'bg-amber-500 ring-amber-200' : 'bg-emerald-500 ring-emerald-200')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-mono text-stone-400">#{incident.incidentNumber}</span>
            <a href={incident.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-stone-800 group-hover:text-[color:var(--argus-signal)] transition-colors truncate max-w-[380px]">
              {incident.title}
            </a>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-stone-400 font-mono flex-wrap">
            {incident.service?.name && (
              <span className="inline-flex items-center gap-1"><Server size={9} />{incident.service.name}</span>
            )}
            {incident.assignees.length > 0 && (
              <span className="inline-flex items-center gap-1"><User size={9} />{incident.assignees[0].name}</span>
            )}
            <span className="inline-flex items-center gap-1"><Clock size={9} />{relativeTime(incident.createdAt)}</span>
            {incident.urgency === 'high' && <span className="text-red-500 font-semibold">HIGH</span>}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold rounded-md', statusStyle.bg, statusStyle.text)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', statusStyle.dot)} />
            {statusStyle.label}
          </span>
          <a href={incident.htmlUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-stone-100">
            <ExternalLink size={12} className="text-stone-300 group-hover:text-stone-500" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Service Card
// ══════════════════════════════════════════════════════════════

function ServiceCard({ service }: { service: PdService }) {
  const statusStyle = SERVICE_STATUS_STYLE[service.status] || SERVICE_STATUS_STYLE.active;
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#06AC38]/10 flex items-center justify-center">
            <Server size={14} className="text-[#06AC38]" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-stone-800 leading-tight">{service.name}</h4>
          </div>
        </div>
        <span className={clsx('inline-flex items-center gap-1 text-[9px] font-mono font-bold', statusStyle.color)}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', statusStyle.dot, service.status === 'critical' || service.status === 'triggered' ? 'animate-pulse' : '')} />
          {statusStyle.label}
        </span>
      </div>
      {service.description && <p className="text-[10px] text-stone-400 mb-2 line-clamp-1">{service.description}</p>}
      <div className="flex items-center gap-3 text-[10px] text-stone-400 font-mono">
        {service.escalationPolicy && <span className="inline-flex items-center gap-1"><Users size={9} />{service.escalationPolicy.name}</span>}
        <span className="inline-flex items-center gap-1"><Link2 size={9} />{service.integrationsCount} integrations</span>
      </div>
      {service.htmlUrl && (
        <a href={service.htmlUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-stone-400 hover:text-[color:var(--argus-signal)] transition-colors">
          <ExternalLink size={9} /> Open in PagerDuty
        </a>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Dashboard Component
// ══════════════════════════════════════════════════════════════

export default function PagerDutyDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = usePdStatus();
  const isConnected = statusData?.connected === true;

  // Overview data (only fetch when connected)
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = usePdOverview();
  const { data: incidents, isLoading: incidentsLoading } = usePdIncidents();
  const { data: services, isLoading: servicesLoading } = usePdServices();
  const { data: onCalls, isLoading: onCallsLoading } = usePdOnCalls();
  const { data: policies, isLoading: policiesLoading } = usePdEscalationPolicies();
  const { data: stats } = usePdStats();

  const disconnectPd = useDisconnectPagerDuty();

  const servicesList = (services || overview?.services || []) as PdService[];
  const incidentsList = ((incidents as any)?.incidents || overview?.activeIncidents || []) as PdIncident[];
  const onCallGroups = (onCalls || overview?.onCalls || []) as PdOnCallGroup[];
  const policiesList = (policies || []) as any[];

  const triggeredCount = incidentsList.filter(i => i.status === 'triggered').length;
  const ackedCount = incidentsList.filter(i => i.status === 'acknowledged').length;

  const TABS = [
    { id: 'overview' as Tab, label: 'Overview', icon: Activity },
    { id: 'incidents' as Tab, label: 'Incidents', icon: AlertTriangle, count: triggeredCount },
    { id: 'services' as Tab, label: 'Services', icon: Server, count: servicesList.length },
    { id: 'oncall' as Tab, label: 'On-Call', icon: Phone, count: onCallGroups.length },
    { id: 'policies' as Tab, label: 'Escalation', icon: GitBranch },
    ...(canManage ? [{ id: 'settings' as Tab, label: 'Settings', icon: Settings }] : []),
  ];

  // ── Not connected: show setup wizard ──
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-stone-300" />
      </div>
    );
  }

  if (!isConnected) {
    return <SetupWizard onConnect={() => refetchStatus()} />;
  }

  return (
    <div className="animate-fade-in space-y-0">

      {/* ══ HERO BANNER ══ */}
      <div className="relative rounded-2xl overflow-hidden bg-obsidian text-ink border border-[color:var(--argus-border)] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#06AC38]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#06AC38] to-[#1CC84A] flex items-center justify-center shadow-lg shadow-green-500/20">
                  <Zap size={20} className="text-ink" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-display text-2xl font-bold text-ink tracking-tight">PagerDuty</h1>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Connected
                    </span>
                    {statusData?.accountName && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)] text-[10px] font-mono text-ink/50">
                        <Building2 size={9} /> {statusData.accountName}
                      </span>
                    )}
                  </div>
                  <p className="text-muted text-xs">Incidents · Services · On-Call · Escalation Policies</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => refetchOverview()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)] text-[11px] text-ink/50 hover:bg-white/[0.10] transition-all"
            >
              <RefreshCw size={12} className={overviewLoading ? 'animate-spin' : ''} /> Sync Now
            </button>
          </div>

          {/* Stats pills */}
          <div className="mt-4 ml-[52px] flex items-center gap-3 flex-wrap">
            {[
              { icon: AlertTriangle, label: `${triggeredCount} Triggered`, color: 'text-red-400', hide: !triggeredCount },
              { icon: Clock, label: `${ackedCount} Acknowledged`, color: 'text-amber-400', hide: !ackedCount },
              { icon: Server, label: `${servicesList.length} Services`, color: 'text-blue-400' },
              { icon: Users, label: `${(overview?.users || []).length} Users`, color: 'text-violet-400' },
              { icon: Phone, label: `${onCallGroups.length} On-Call Groups`, color: 'text-emerald-400' },
            ].filter(p => !p.hide).map((pill) => (
              <div key={pill.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)] text-[11px]">
                <pill.icon size={12} className={pill.color} />
                <span className="text-ink/60">{pill.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-[#06AC38]/60 to-transparent -mt-5 mb-4" />

      {/* ══ TABS ══ */}
      <div className="flex items-center gap-2 mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all', activeTab === tab.id ? 'bg-[#06AC38]/10 text-[#059933] border-[#06AC38]/20 shadow-sm' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-50 border-stone-200')}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={clsx('text-[10px] font-mono px-1.5 py-0.5 rounded', activeTab === tab.id ? 'bg-[#06AC38]/20 text-[#059933]' : 'bg-stone-100 text-stone-500')}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════ OVERVIEW TAB ══════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Triggered" value={stats?.triggered ?? triggeredCount} icon={AlertTriangle} color="text-red-500" bg="bg-red-50" border="border-red-200" sub="Active incidents" />
            <StatCard label="Acknowledged" value={stats?.acknowledged ?? ackedCount} icon={Clock} color="text-amber-500" bg="bg-amber-50" border="border-amber-200" sub="Being worked" />
            <StatCard label="Resolved (7d)" value={stats?.resolved ?? 0} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-50" border="border-emerald-200" sub="Last 7 days" />
            <StatCard label="Services" value={servicesList.length} icon={Server} color="text-blue-500" bg="bg-blue-50" border="border-blue-200" />
            <StatCard label="On-Call Groups" value={onCallGroups.length} icon={Phone} color="text-violet-500" bg="bg-violet-50" border="border-violet-200" />
          </div>

          {/* Active Incidents + On-Call side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500" />
                <h3 className="text-sm font-display font-bold text-stone-800">Active Incidents</h3>
                <span className="text-[10px] font-mono text-stone-300 ml-auto">from PagerDuty · live</span>
              </div>
              {overviewLoading ? (
                <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-stone-50 rounded-xl animate-pulse" />)}</div>
              ) : incidentsList.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 size={36} className="text-emerald-200 mx-auto mb-2" />
                  <p className="text-sm text-stone-400">No active incidents</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {incidentsList.map((inc) => <IncidentRow key={inc.id} incident={inc} />)}
                </div>
              )}
            </div>

            {/* On-Call Now */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2">
                <Phone size={14} className="text-emerald-500" />
                <h3 className="text-sm font-display font-bold text-stone-800">On-Call Now</h3>
              </div>
              {onCallsLoading ? (
                <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-stone-50 rounded-xl animate-pulse" />)}</div>
              ) : onCallGroups.length === 0 ? (
                <div className="text-center py-10 text-sm text-stone-400">No on-call data</div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {onCallGroups.slice(0, 6).map((group) => {
                    const primary = group.layers.find(l => l.level === 1) || group.layers[0];
                    return (
                      <div key={group.escalationPolicy.id} className="px-5 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[color:var(--argus-signal)] to-[color:var(--argus-signal-bright)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {primary?.user?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-stone-800 truncate">{primary?.user?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-stone-400 truncate">{group.escalationPolicy.name}</p>
                        </div>
                        <span className="shrink-0 text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">L{primary?.level}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Services health grid */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm">
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2">
              <Server size={14} className="text-blue-500" />
              <h3 className="text-sm font-display font-bold text-stone-800">Services Health</h3>
              <span className="text-[10px] font-mono text-stone-300 ml-auto">{servicesList.length} services</span>
            </div>
            {servicesLoading ? (
              <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-stone-50 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {servicesList.slice(0, 8).map((svc) => <ServiceCard key={svc.id} service={svc} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ INCIDENTS TAB ══════════ */}
      {activeTab === 'incidents' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500" />
            <h3 className="text-sm font-display font-bold text-stone-800">All Active Incidents</h3>
            <span className="text-[10px] font-mono text-stone-300 ml-auto">Live from PagerDuty · 30s refresh</span>
          </div>
          {incidentsLoading ? (
            <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-stone-50 rounded-xl animate-pulse" />)}</div>
          ) : incidentsList.length === 0 ? (
            <div className="text-center py-20">
              <CheckCircle2 size={48} className="text-emerald-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-stone-500">All clear — no active incidents</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {incidentsList.map((inc) => <IncidentRow key={inc.id} incident={inc} />)}
            </div>
          )}
        </div>
      )}

      {/* ══════════ SERVICES TAB ══════════ */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {servicesLoading
              ? [...Array(8)].map((_, i) => <div key={i} className="h-28 bg-stone-50 rounded-xl animate-pulse" />)
              : servicesList.map((svc) => <ServiceCard key={svc.id} service={svc} />)
            }
          </div>
        </div>
      )}

      {/* ══════════ ON-CALL TAB ══════════ */}
      {activeTab === 'oncall' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2">
            <Phone size={14} className="text-emerald-500" />
            <h3 className="text-sm font-display font-bold text-stone-800">On-Call Schedule</h3>
            <span className="text-[10px] font-mono text-stone-300 ml-auto">{onCallGroups.length} escalation groups</span>
          </div>
          {onCallsLoading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-stone-50 rounded-xl animate-pulse" />)}</div>
          ) : onCallGroups.length === 0 ? (
            <div className="text-center py-16 text-sm text-stone-400">No on-call data available</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {onCallGroups.map((group) => (
                <div key={group.escalationPolicy.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <GitBranch size={13} className="text-[color:var(--argus-signal)]" />
                    <h4 className="text-sm font-semibold text-stone-800">{group.escalationPolicy.name}</h4>
                  </div>
                  <div className="space-y-2 ml-5">
                    {group.layers.sort((a, b) => a.level - b.level).map((layer, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-[color:var(--argus-signal-dim)] border border-[color:var(--argus-signal)]/25 flex items-center justify-center text-[9px] font-bold text-[color:var(--argus-signal)]">L{layer.level}</span>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                          {layer.user?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-stone-800">{layer.user?.name}</p>
                          {layer.schedule && <p className="text-[10px] text-stone-400">{layer.schedule.name}</p>}
                        </div>
                        {layer.end && (
                          <span className="text-[10px] font-mono text-stone-400">until {relativeTime(layer.end)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ POLICIES TAB ══════════ */}
      {activeTab === 'policies' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2">
            <GitBranch size={14} className="text-[color:var(--argus-signal)]" />
            <h3 className="text-sm font-display font-bold text-stone-800">Escalation Policies</h3>
          </div>
          {policiesLoading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-stone-50 rounded-xl animate-pulse" />)}</div>
          ) : policiesList.length === 0 ? (
            <div className="text-center py-16 text-sm text-stone-400">No escalation policies</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {policiesList.map((policy: any) => (
                <div key={policy.id} className="px-5 py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-stone-800">{policy.name}</h4>
                      {policy.description && <p className="text-[11px] text-stone-400 mt-0.5">{policy.description}</p>}
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[color:var(--argus-signal-dim)] text-[color:var(--argus-signal)]">
                      {policy.numLoops > 0 ? `Loops ${policy.numLoops}x` : 'No loop'}
                    </span>
                  </div>
                  <div className="space-y-1.5 ml-2">
                    {policy.rules?.map((rule: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-stone-500">
                        <ArrowRight size={9} className="text-stone-300 shrink-0" />
                        <span>after {rule.escalationDelayMinutes}min →</span>
                        <span className="text-stone-700">{rule.targets?.map((t: any) => t.name).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                  {policy.services?.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] text-stone-400">Services:</span>
                      {policy.services.map((s: any) => (
                        <span key={s.id} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">{s.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ SETTINGS TAB ══════════ */}
      {activeTab === 'settings' && canManage && (
        <div className="space-y-4 max-w-xl">
          {/* Connection info */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
              <Zap size={14} className="text-[#06AC38]" /> Connection Details
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Account', value: statusData?.accountName || '—' },
                { label: 'Email', value: statusData?.accountEmail || '—' },
                { label: 'Connected', value: statusData?.connectedAt ? new Date(statusData.connectedAt).toLocaleDateString() : '—' },
                { label: 'Auto Sync', value: statusData?.autoSync ? 'Enabled' : 'Disabled' },
                { label: 'Auto-create Incidents', value: statusData?.autoCreateIncidents ? 'Enabled' : 'Disabled' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-stone-50">
                  <span className="text-xs text-stone-500">{row.label}</span>
                  <span className="text-xs font-mono text-stone-700">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook endpoint */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-stone-800 mb-2 flex items-center gap-2">
              <Link2 size={14} className="text-[color:var(--argus-signal)]" /> Incoming Webhook URL
            </h3>
            <p className="text-[11px] text-stone-400 mb-3">Add this URL in PagerDuty → Integrations → Generic Webhooks (V3) to receive incident events.</p>
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
              <code className="flex-1 text-[10px] font-mono text-stone-600 truncate">
                {`${window.location.origin}/api/v1/pagerduty/webhook`}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/v1/pagerduty/webhook`); toast.success('Copied'); }} className="shrink-0 p-1 rounded hover:bg-stone-200">
                <Copy size={11} className="text-stone-400" />
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
              <AlertTriangle size={14} /> Danger Zone
            </h3>
            <p className="text-[11px] text-stone-400 mb-4">Disconnecting will stop all syncs and remove PagerDuty data from WeCrew. This cannot be undone.</p>
            <button
              onClick={() => {
                if (confirm('Disconnect PagerDuty? This will stop all syncs.')) {
                  disconnectPd.mutate(undefined, {
                    onSuccess: () => toast.success('PagerDuty disconnected'),
                    onError: () => toast.error('Failed to disconnect'),
                  });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={13} /> Disconnect PagerDuty
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-[10px] text-stone-300 font-mono">
          PagerDuty Integration — REST API v2 + Events API v2 · Bidirectional Sync · {servicesList.length} services connected
        </p>
      </div>
    </div>
  );
}
