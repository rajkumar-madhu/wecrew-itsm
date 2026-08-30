import { useState, useMemo, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  Zap, CheckCircle2, Clock, Loader2, AlertTriangle, Terminal,
  Server, ChevronDown, ChevronRight, Shield, Brain, Bell,
  HardDrive, Activity, Timer, Eye,
  Bot, Wrench, FileText, GitBranch,
  Search, Settings, ChevronUp,
  XCircle, Copy,
  RefreshCw, Link2,
  ArrowRight, Gauge, Target, History,
  Power, ToggleLeft, ToggleRight, Hash, Cpu,
  Lock, MessageSquare, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { onEvent } from '../../lib/socket';
import api from '../../lib/api';
import { Link } from 'react-router-dom';
import { Page, Segmented } from '../ui/PageChrome';
import {
  usePipelineStatus,
  usePipelineActions,
  usePipelineNotifications,
  usePipelineExecutions,
  useTogglePipeline,
  useToggleAction,
  useToggleNotification,
} from '../../hooks/useAgentPipeline';

// ══════════════════════════════════════════════════════════════════════════════
// Design Tokens — Enterprise ITSM (ServiceNow-style light workspace)
// ══════════════════════════════════════════════════════════════════════════════

const D = {
  bg:       'var(--argus-void)',
  surface:  'var(--argus-surface)',
  surface2: 'var(--argus-elevated)',
  surface3: 'var(--argus-gunmetal)',
  border:   'var(--argus-border)',
  border2:  'var(--argus-border)',
  shadow:   'var(--argus-shadow-card)',
  text:     'var(--argus-ink)',
  text2:    'var(--argus-muted)',
  text3:    'var(--argus-dim)',
  text4:    'var(--argus-dim)',
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Types (matching backend API shapes)
// ══════════════════════════════════════════════════════════════════════════════

interface PipelineStep {
  stage: string;
  status: string;
  detail: string;
  ts: number;
}

interface PipelineExecution {
  id: string;
  alertId?: string;
  alertName: string;
  severity: string;
  organizationId?: string;
  orgName?: string;
  orgEnvironment?: string;
  matchedAction: string | null;
  actionResult: boolean | null;
  steps: PipelineStep[];
  duration: number;
  timestamp: string;
  error?: string;
}

interface RemediationAction {
  id: string;
  name: string;
  description: string;
  category: string;
  targetSeverity: string[];
  matchAlerts: string[];
  enabled: boolean;
  commandCount: number;
  hasVerification: boolean;
}

interface NotificationRule {
  id: string;
  name: string;
  severity?: string[];
  event?: string | null;
  channel: string;
  enabled: boolean;
}

interface PipelineStatusData {
  enabled: boolean;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: string;
  lastExecutionAt: string | null;
  startedAt: string;
  uptime: number;
  remediationActions: RemediationAction[];
  notificationRules: NotificationRule[];
  recentExecutions: PipelineExecution[];
}

type MainTab = 'overview' | 'executions' | 'config';

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// Dark-theme category colors — all via style={} to bypass Tailwind config override
const CATEGORY_COLORS: Record<string, { iconBg: string; iconColor: string; badgeBg: string; badgeColor: string; badgeBorder: string }> = {
  Storage:        { iconBg: 'rgba(251,191,36,0.12)',  iconColor: '#FCD34D', badgeBg: 'rgba(251,191,36,0.10)',  badgeColor: '#FCD34D', badgeBorder: 'rgba(251,191,36,0.22)'  },
  Kubernetes:     { iconBg: 'rgba(99,179,255,0.12)',  iconColor: '#60A5FA', badgeBg: 'rgba(99,179,255,0.10)',  badgeColor: '#60A5FA', badgeBorder: 'rgba(99,179,255,0.22)'  },
  Infrastructure: { iconBg: 'rgba(167,139,250,0.12)', iconColor: '#A78BFA', badgeBg: 'rgba(167,139,250,0.10)', badgeColor: '#A78BFA', badgeBorder: 'rgba(167,139,250,0.22)' },
  Compute:        { iconBg: 'rgba(129,140,248,0.12)', iconColor: 'var(--argus-signal)', badgeBg: 'rgba(129,140,248,0.10)', badgeColor: 'var(--argus-signal)', badgeBorder: 'rgba(129,140,248,0.22)' },
  Security:       { iconBg: 'rgba(248,113,113,0.12)', iconColor: '#F87171', badgeBg: 'rgba(248,113,113,0.10)', badgeColor: '#F87171', badgeBorder: 'rgba(248,113,113,0.22)' },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Storage: HardDrive,
  Kubernetes: Server,
  Infrastructure: Wrench,
  Compute: Cpu,
  Security: Shield,
};

// Dark-theme severity badge styles
const SEVERITY_BADGE: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  CRITICAL: { bg: 'rgba(239,68,68,0.12)',  color: 'var(--argus-crimson)', border: 'rgba(239,68,68,0.25)',  dot: '#EF4444' },
  WARNING:  { bg: 'rgba(251,191,36,0.12)', color: 'var(--argus-amber)', border: 'rgba(251,191,36,0.25)', dot: '#F59E0B' },
  INFO:     { bg: 'rgba(99,179,255,0.10)', color: 'var(--argus-signal)', border: 'rgba(99,179,255,0.20)', dot: '#3B82F6' },
};

const STAGE_ORDER = ['detect', 'triage', 'enrich', 'action', 'notify', 'verify'];
const STAGE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  detect: { icon: Activity,     color: 'var(--argus-crimson)' },
  triage: { icon: Brain,        color: '#A78BFA' },
  enrich: { icon: Eye,          color: 'var(--argus-amber)' },
  action: { icon: Wrench,       color: 'var(--argus-signal)' },
  notify: { icon: Bell,         color: 'var(--argus-emerald)' },
  verify: { icon: CheckCircle2, color: 'var(--argus-emerald)' },
};

// ══════════════════════════════════════════════════════════════════════════════
// Loading Skeleton
// ══════════════════════════════════════════════════════════════════════════════

function StatSkeleton() {
  return (
    <div className="rounded-2xl p-4 animate-pulse" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
      <div className="w-8 h-8 rounded-xl mb-2" style={{ background: D.surface2 }} />
      <div className="h-7 w-16 rounded mb-1" style={{ background: D.surface2 }} />
      <div className="h-3 w-24 rounded" style={{ background: D.surface2 }} />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
      <div className="h-5 w-40 rounded mb-3" style={{ background: D.surface2 }} />
      <div className="h-3 w-full rounded mb-2" style={{ background: D.surface2 }} />
      <div className="h-3 w-3/4 rounded" style={{ background: D.surface2 }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Execution Status Badge
// ══════════════════════════════════════════════════════════════════════════════

function ExecutionStatusBadge({ actionResult, error }: { actionResult: boolean | null; error?: string }) {
  if (error) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md uppercase"
      style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--argus-crimson)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <XCircle size={10} /> ERROR
    </span>
  );
  if (actionResult === true) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md uppercase"
      style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--argus-emerald)', border: '1px solid rgba(52,211,153,0.25)' }}>
      <CheckCircle2 size={10} /> SUCCESS
    </span>
  );
  if (actionResult === false) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md uppercase"
      style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--argus-crimson)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <XCircle size={10} /> FAILED
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md uppercase"
      style={{ background: 'rgba(99,179,255,0.10)', color: 'var(--argus-signal)', border: '1px solid rgba(99,179,255,0.20)' }}>
      <Bell size={10} /> NOTIFY-ONLY
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_BADGE[severity] || SEVERITY_BADGE.INFO;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md uppercase"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {severity}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Toggle Switch
// ══════════════════════════════════════════════════════════════════════════════

function ToggleSwitch({ enabled, onToggle, disabled, size = 'md' }: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const translate = size === 'sm' ? (enabled ? 'translate-x-4' : 'translate-x-0.5') : (enabled ? 'translate-x-5' : 'translate-x-0.5');

  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onToggle(); }}
      disabled={disabled}
      className={clsx('relative inline-flex items-center rounded-full transition-colors', w, disabled && 'opacity-50 cursor-not-allowed')}
      style={{ background: enabled ? '#059669' : D.surface2 }}
    >
      <span
        className={clsx('inline-block rounded-full bg-white shadow-sm transition-transform', translate)}
        style={{ width: size === 'sm' ? 14 : 18, height: size === 'sm' ? 14 : 18 }}
      />
      {disabled && <Lock size={8} className="absolute right-1" style={{ color: 'var(--argus-muted)' }} />}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Pipeline Step Timeline (for execution detail)
// ══════════════════════════════════════════════════════════════════════════════

function StepTimeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="space-y-1 mt-3">
      {steps.map((step, idx) => {
        const stageInfo = STAGE_ICONS[step.stage] || { icon: Activity, color: D.text2 };
        const StIcon = stageInfo.icon;
        const isComplete = step.status === 'complete';
        const isFailed = step.status === 'failed';
        const isWarning = step.status === 'warning';
        const isSkipped = step.status === 'skipped';

        const iconBg = isComplete ? 'rgba(52,211,153,0.12)' :
                       isFailed   ? 'rgba(239,68,68,0.12)' :
                       isWarning  ? 'rgba(251,191,36,0.12)' :
                       isSkipped  ? D.surface2 :
                                    'rgba(129,140,248,0.12)';
        const connectorColor = isComplete ? 'rgba(52,211,153,0.3)' :
                               isFailed   ? 'rgba(239,68,68,0.3)' :
                               isWarning  ? 'rgba(251,191,36,0.3)' :
                                            D.border;
        const statusBg    = isComplete ? 'rgba(52,211,153,0.10)' :
                            isFailed   ? 'rgba(239,68,68,0.10)' :
                            isWarning  ? 'rgba(251,191,36,0.10)' :
                            isSkipped  ? D.surface2 :
                                         'rgba(129,140,248,0.10)';
        const statusColor = isComplete ? '#34D399' :
                            isFailed   ? '#F87171' :
                            isWarning  ? '#FCD34D' :
                            isSkipped  ? D.text3 :
                                         'var(--argus-signal)';

        return (
          <div key={idx} className="relative flex gap-3 items-start">
            {idx < steps.length - 1 && (
              <div className="absolute left-[15px] top-[28px] w-[2px] bottom-0" style={{ background: connectorColor }} />
            )}
            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
              {isComplete ? <CheckCircle2 size={14} style={{ color: 'var(--argus-emerald)' }} /> :
               isFailed   ? <XCircle size={14} style={{ color: 'var(--argus-crimson)' }} /> :
               isWarning  ? <AlertTriangle size={14} style={{ color: 'var(--argus-amber)' }} /> :
               isSkipped  ? <ArrowRight size={14} style={{ color: D.text3 }} /> :
               <StIcon size={14} style={{ color: stageInfo.color }} />}
            </div>
            <div className="flex-1 min-w-0 py-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase" style={{ color: D.text2 }}>{step.stage}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: statusBg, color: statusColor }}>
                  {step.status}
                </span>
              </div>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: D.text2 }}>{step.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Pipeline Flow Visualization
// ══════════════════════════════════════════════════════════════════════════════

const PIPELINE_STEPS = [
  { num: 1, label: 'Detect', sub: 'Alert classified', icon: Activity,     color: 'from-red-500 to-rose-500' },
  { num: 2, label: 'Triage', sub: 'Match action',     icon: Brain,        color: 'from-violet-500 to-purple-500' },
  { num: 3, label: 'Enrich', sub: 'Context + CMDB',  icon: Eye,          color: 'from-[#F59E0B] to-[#EA580C]' },
  { num: 4, label: 'Act',    sub: 'SSH remediate',    icon: Wrench,       color: 'from-[color:var(--argus-signal)] to-blue-500' },
  { num: 5, label: 'Notify', sub: 'Slack / PagerDuty',icon: Bell,         color: 'from-[#059669] to-[#0D9488]' },
  { num: 6, label: 'Verify', sub: 'Health check',     icon: CheckCircle2, color: 'from-[#059669] to-[#10B981]' },
];

function PipelineFlow() {
  return (
    <div className="rounded-2xl p-6" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
      <div className="flex items-center gap-2 mb-5">
        <Target size={15} style={{ color: 'var(--argus-signal)' }} />
        <h3 className="text-sm font-display font-bold" style={{ color: D.text }}>6-Stage Pipeline Flow</h3>
        <span className="text-[10px] font-mono ml-auto" style={{ color: D.text4 }}>Detect → Triage → Enrich → Act → Notify → Verify</span>
      </div>
      <div className="flex items-center justify-between gap-0 overflow-x-auto pb-2">
        {PIPELINE_STEPS.map((step, idx) => (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center min-w-[90px]">
              <div className={clsx('w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg', step.color)}>
                <step.icon size={20} className="text-ink" />
              </div>
              <div className="mt-2 text-center">
                <span className="text-[10px] font-mono font-bold block" style={{ color: D.text3 }}>{step.num}</span>
                <p className="text-xs font-semibold" style={{ color: D.text }}>{step.label}</p>
                <p className="text-[10px]" style={{ color: D.text2 }}>{step.sub}</p>
              </div>
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div className="flex items-center mx-1 -mt-6">
                <ArrowRight size={16} style={{ color: D.text3 }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════

export default function AutomationDashboard() {
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [expandedExecId, setExpandedExecId] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const qc = useQueryClient();

  // ── Org context (for hero banner) ──
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => { const { data } = await api.get('/organizations?limit=50'); return data; },
    staleTime: 300000,
    enabled: user?.role === 'ADMIN',
  });
  const orgsList: { id: string; name: string; environment: string }[] = orgsData?.data || [];

  const selectedOrg = useMemo(() => {
    if (!selectedOrgId || !orgsList.length) return null;
    return orgsList.find((o) => o.id === selectedOrgId) || null;
  }, [selectedOrgId, orgsList]);

  const heroOrgName = selectedOrg?.name || (selectedOrgId ? 'Organization' : null);
  const heroEnv = selectedOrg?.environment || null;
  const isGlobalView = !selectedOrgId && user?.role === 'ADMIN';

  // ── Data hooks ──
  const { data: status, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = usePipelineStatus();
  const { data: actions, isLoading: actionsLoading } = usePipelineActions();
  const { data: notifications, isLoading: notifsLoading } = usePipelineNotifications();
  const { data: execData, isLoading: execsLoading } = usePipelineExecutions(50);

  const pipelineStatus = status as PipelineStatusData | undefined;
  const actionsList = (actions || []) as RemediationAction[];
  const notifsList = (notifications || []) as NotificationRule[];
  const executions = (execData?.executions || []) as PipelineExecution[];
  const totalExecs = execData?.total || 0;

  // ── Mutations ──
  const togglePipeline = useTogglePipeline();
  const toggleAction = useToggleAction();
  const toggleNotification = useToggleNotification();

  // ── Socket.IO: real-time execution updates ──
  useEffect(() => {
    const unsub = onEvent<PipelineExecution>('pipeline:execution', (exec) => {
      toast.success(`Pipeline: ${exec.alertName} → ${exec.matchedAction || 'notify-only'}`, { duration: 4000 });
      qc.invalidateQueries({ queryKey: ['agent-pipeline'] });
    });
    return unsub;
  }, [qc]);

  // ── Filtered executions ──
  const filteredExecs = useMemo(() => {
    return executions.filter((exec) => {
      if (statusFilter === 'success' && exec.actionResult !== true && !exec.matchedAction) return false;
      if (statusFilter === 'failed' && exec.actionResult !== false && !exec.error) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return exec.alertName.toLowerCase().includes(q) ||
               (exec.severity || '').toLowerCase().includes(q) ||
               (exec.matchedAction || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [executions, statusFilter, searchQuery]);

  // ── Error state ──
  if (statusError) {
    return (
      <Page>
        <HeroBanner pipelineEnabled={false} canManage={false} onToggle={() => {}} toggling={false} uptime={0} orgName={heroOrgName} orgEnv={heroEnv} isGlobalView={isGlobalView} />
        <nav className="cx-crumb" aria-label="Breadcrumb">
          <Link to="/dashboard">Operations</Link>
          <span aria-hidden>/</span>
          <span className="cx-crumb__current">Automation</span>
        </nav>
        <div className="text-center py-16 rounded-2xl" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
          <AlertTriangle size={40} className="mx-auto mb-3" style={{ color: 'var(--argus-amber)' }} />
          <p className="font-medium mb-2" style={{ color: D.text }}>Failed to load pipeline status</p>
          <p className="text-xs mb-4" style={{ color: D.text2 }}>The Agent Pipeline API may be unreachable</p>
          <button onClick={() => refetchStatus()} className="px-4 py-2 text-sm font-medium rounded-xl transition-colors"
            style={{ background: 'rgba(129,140,248,0.12)', color: 'var(--argus-signal)', border: '1px solid rgba(129,140,248,0.25)' }}>
            <RefreshCw size={14} className="inline mr-1.5" /> Retry
          </button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <HeroBanner
        pipelineEnabled={pipelineStatus?.enabled ?? false}
        canManage={canManage}
        onToggle={() => {
          if (!pipelineStatus) return;
          togglePipeline.mutate(!pipelineStatus.enabled, {
            onSuccess: () => toast.success(pipelineStatus.enabled ? 'Pipeline disabled' : 'Pipeline enabled'),
            onError: () => toast.error('Failed to toggle pipeline'),
          });
        }}
        toggling={togglePipeline.isPending}
        uptime={pipelineStatus?.uptime ?? 0}
        loading={statusLoading}
        orgName={heroOrgName}
        orgEnv={heroEnv}
        isGlobalView={isGlobalView}
        executions={pipelineStatus?.totalExecutions}
        successRate={pipelineStatus?.successRate}
        failed={pipelineStatus?.failedExecutions}
      />

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Automation</span>
      </nav>

      <Segmented
        value={activeTab}
        onChange={(v) => setActiveTab(v as MainTab)}
        options={[
          { value: 'overview', label: 'Overview', icon: Gauge },
          { value: 'executions', label: totalExecs ? `History (${totalExecs})` : 'History', icon: History },
          ...(canManage ? [{ value: 'config', label: 'Configuration', icon: Settings }] : []),
        ]}
      />

      {/* ══════════ OVERVIEW TAB ══════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Stats grid */}
          {statusLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
            </div>
          ) : pipelineStatus && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Executions', value: pipelineStatus.totalExecutions,         icon: Zap,          iconBg: 'rgba(129,140,248,0.12)', iconColor: 'var(--argus-signal)', accent: 'rgba(129,140,248,0.20)' },
                { label: 'Successful',        value: pipelineStatus.successfulExecutions,    icon: CheckCircle2, iconBg: 'rgba(52,211,153,0.12)',  iconColor: '#34D399', accent: 'rgba(52,211,153,0.20)'  },
                { label: 'Failed',            value: pipelineStatus.failedExecutions,        icon: XCircle,      iconBg: 'rgba(239,68,68,0.12)',   iconColor: '#F87171', accent: 'rgba(239,68,68,0.20)'   },
                { label: 'Success Rate',      value: `${pipelineStatus.successRate}%`,       icon: Target,       iconBg: 'rgba(167,139,250,0.12)', iconColor: '#A78BFA', accent: 'rgba(167,139,250,0.20)' },
                { label: 'Pipeline Uptime',   value: formatUptime(pipelineStatus.uptime),   icon: Timer,        iconBg: 'rgba(251,191,36,0.12)',  iconColor: '#FCD34D', accent: 'rgba(251,191,36,0.20)'  },
                { label: 'Last Execution',    value: relativeTime(pipelineStatus.lastExecutionAt), icon: Clock, iconBg: 'rgba(99,179,255,0.10)',  iconColor: '#60A5FA', accent: 'rgba(99,179,255,0.20)'  },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl p-4"
                  style={{ background: D.surface, border: `1px solid ${stat.accent}`, boxShadow: D.shadow }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: stat.iconBg }}>
                    <stat.icon size={16} style={{ color: stat.iconColor }} />
                  </div>
                  <p className="text-2xl font-display font-bold tracking-tight" style={{ color: D.text }}>{stat.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: D.text2 }}>{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Remediation Actions Grid */}
          <div className="rounded-2xl" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${D.border}` }}>
              <Wrench size={15} style={{ color: 'var(--argus-signal)' }} />
              <h3 className="text-sm font-display font-bold" style={{ color: D.text }}>Remediation Actions</h3>
              <span className="text-[10px] font-mono ml-auto" style={{ color: D.text3 }}>{actionsList.length} actions configured</span>
            </div>
            {actionsLoading ? (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {actionsList.map((action) => {
                  const cat = CATEGORY_COLORS[action.category] || CATEGORY_COLORS.Infrastructure;
                  const CatIcon = CATEGORY_ICONS[action.category] || Wrench;
                  return (
                    <div key={action.id} className="rounded-xl p-4 transition-all"
                      style={{
                        background: action.enabled ? D.surface2 : D.surface3,
                        border: `1px solid ${D.border}`,
                        opacity: action.enabled ? 1 : 0.55,
                      }}>
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cat.iconBg }}>
                          <CatIcon size={14} style={{ color: cat.iconColor }} />
                        </div>
                        <ToggleSwitch
                          enabled={action.enabled}
                          disabled={!canManage || toggleAction.isPending}
                          size="sm"
                          onToggle={() => {
                            toggleAction.mutate({ id: action.id, enabled: !action.enabled }, {
                              onSuccess: () => toast.success(`${action.name} ${action.enabled ? 'disabled' : 'enabled'}`),
                              onError: () => toast.error('Toggle failed'),
                            });
                          }}
                        />
                      </div>
                      <h4 className="text-sm font-semibold mb-1" style={{ color: D.text }}>{action.name}</h4>
                      <p className="text-[11px] leading-relaxed mb-3 line-clamp-2" style={{ color: D.text2 }}>{action.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-md uppercase"
                          style={{ background: cat.badgeBg, color: cat.badgeColor, border: `1px solid ${cat.badgeBorder}` }}>
                          {action.category}
                        </span>
                        {action.targetSeverity.map((s) => {
                          const sv = SEVERITY_BADGE[s] || SEVERITY_BADGE.INFO;
                          return (
                            <span key={s} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: sv.bg, color: sv.color }}>
                              {s}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3 mt-2.5 text-[10px]" style={{ color: D.text2 }}>
                        <span className="inline-flex items-center gap-1"><Terminal size={10} />{action.commandCount} cmd{action.commandCount !== 1 ? 's' : ''}</span>
                        {action.hasVerification && (
                          <span className="inline-flex items-center gap-1" style={{ color: 'var(--argus-emerald)' }}>
                            <CheckCircle2 size={10} />Verified
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notification Rules */}
          <div className="rounded-2xl" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${D.border}` }}>
              <Bell size={15} style={{ color: 'var(--argus-signal)' }} />
              <h3 className="text-sm font-display font-bold" style={{ color: D.text }}>Notification Rules</h3>
              <span className="text-[10px] font-mono ml-auto" style={{ color: D.text3 }}>{notifsList.length} rules</span>
            </div>
            {notifsLoading ? (
              <div className="p-5 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: D.surface2 }} />
                ))}
              </div>
            ) : (
              <div>
                {notifsList.map((rule, idx) => (
                  <div key={rule.id} className="px-5 py-3.5 flex items-center gap-4"
                    style={{ borderBottom: idx < notifsList.length - 1 ? `1px solid ${D.border}` : 'none' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: rule.channel === 'slack' ? 'rgba(167,139,250,0.12)' : 'rgba(52,211,153,0.12)' }}>
                      {rule.channel === 'slack'
                        ? <MessageSquare size={14} style={{ color: '#A78BFA' }} />
                        : <Bell size={14} style={{ color: 'var(--argus-emerald)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium" style={{ color: D.text }}>{rule.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono uppercase" style={{ color: D.text2 }}>{rule.channel}</span>
                        {rule.severity?.map((s) => {
                          const sv = SEVERITY_BADGE[s] || SEVERITY_BADGE.INFO;
                          return (
                            <span key={s} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: sv.bg, color: sv.color }}>
                              {s}
                            </span>
                          );
                        })}
                        {rule.event && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(129,140,248,0.10)', color: 'var(--argus-signal)' }}>
                            {rule.event}
                          </span>
                        )}
                      </div>
                    </div>
                    <ToggleSwitch
                      enabled={rule.enabled}
                      disabled={!canManage || toggleNotification.isPending}
                      size="sm"
                      onToggle={() => {
                        toggleNotification.mutate({ id: rule.id, enabled: !rule.enabled }, {
                          onSuccess: () => toast.success(`${rule.name} ${rule.enabled ? 'disabled' : 'enabled'}`),
                          onError: () => toast.error('Toggle failed'),
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline + Integration Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <PipelineFlow />
            </div>
            <div className="rounded-2xl p-5" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
              <div className="flex items-center gap-2 mb-4">
                <Link2 size={15} style={{ color: 'var(--argus-signal)' }} />
                <h3 className="text-sm font-display font-bold" style={{ color: D.text }}>Integration Status</h3>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'AI Agent Pipeline', status: pipelineStatus?.enabled ? 'Active' : 'Disabled', color: pipelineStatus?.enabled ? '#34D399' : '#FCD34D', dot: pipelineStatus?.enabled ? '#34D399' : '#F59E0B' },
                  { name: 'WeCrew API',  status: 'Ready', color: 'var(--argus-emerald)', dot: '#34D399' },
                  { name: 'Kubernetes', status: 'Ready', color: 'var(--argus-emerald)', dot: '#34D399' },
                  { name: 'Prometheus', status: 'Ready', color: 'var(--argus-emerald)', dot: '#34D399' },
                  { name: 'Grafana',    status: 'Ready', color: 'var(--argus-emerald)', dot: '#34D399' },
                  { name: 'Slack',      status: 'Ready', color: 'var(--argus-emerald)', dot: '#34D399' },
                ].map((int) => (
                  <div key={int.name} className="flex items-center justify-between py-2 px-3 rounded-lg"
                    style={{ background: D.surface2, border: `1px solid ${D.border}` }}>
                    <span className="text-xs font-medium" style={{ color: D.text }}>{int.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium" style={{ color: int.color }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: int.dot }} />
                      {int.status}
                    </span>
                  </div>
                ))}
                <div className="pt-2" style={{ borderTop: `1px solid ${D.border}` }}>
                  <span className="text-[10px] font-mono" style={{ color: D.text4 }}>Uptime: {formatUptime(pipelineStatus?.uptime ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ EXECUTIONS TAB ══════════ */}
      {activeTab === 'executions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{ background: D.surface, border: `1px solid ${D.border}` }}>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: D.text3 }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by alert name, severity, action..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2"
                style={{
                  background: D.surface2, color: D.text,
                  border: `1px solid ${D.border}`,
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'success' | 'failed')}
              className="text-xs rounded-lg px-2.5 py-2 focus:outline-none"
              style={{ background: D.surface2, color: D.text2, border: `1px solid ${D.border}` }}
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
            <span className="text-[10px] font-mono" style={{ color: D.text3 }}>{filteredExecs.length} of {totalExecs} executions</span>
          </div>

          {/* Execution list */}
          <div className="rounded-2xl overflow-hidden" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${D.border}` }}>
              <GitBranch size={15} style={{ color: 'var(--argus-signal)' }} />
              <h3 className="text-sm font-display font-bold" style={{ color: D.text }}>Pipeline Executions</h3>
              <span className="text-[10px] font-mono ml-auto" style={{ color: D.text3 }}>Live feed — 15s refresh</span>
            </div>

            {execsLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: D.surface2 }} />
                ))}
              </div>
            ) : filteredExecs.length === 0 ? (
              <div className="text-center py-16">
                <Bot size={40} className="mx-auto mb-3" style={{ color: D.text4 }} />
                <p className="text-sm font-medium mb-1" style={{ color: D.text2 }}>
                  {executions.length === 0 ? 'No pipeline executions yet' : 'No executions match your filters'}
                </p>
                <p className="text-xs" style={{ color: D.text3 }}>
                  {executions.length === 0 ? 'Executions will appear here as alerts trigger the pipeline' : 'Try adjusting your search or filter'}
                </p>
              </div>
            ) : (
              <div>
                {filteredExecs.map((exec, idx) => {
                  const isExpanded = expandedExecId === exec.id;
                  const resultBg    = exec.error || exec.actionResult === false ? 'rgba(239,68,68,0.10)' :
                                      exec.actionResult === true                ? 'rgba(52,211,153,0.10)' :
                                                                                  'rgba(99,179,255,0.10)';
                  const resultBorder = exec.error || exec.actionResult === false ? 'rgba(239,68,68,0.25)' :
                                       exec.actionResult === true                ? 'rgba(52,211,153,0.25)' :
                                                                                   'rgba(99,179,255,0.20)';
                  const resultIcon = exec.error || exec.actionResult === false
                    ? <XCircle size={18} style={{ color: 'var(--argus-crimson)' }} />
                    : exec.actionResult === true
                    ? <CheckCircle2 size={18} style={{ color: 'var(--argus-emerald)' }} />
                    : <Bell size={18} style={{ color: 'var(--argus-signal)' }} />;

                  return (
                    <div key={exec.id} style={{ borderBottom: idx < filteredExecs.length - 1 ? `1px solid ${D.border}` : 'none' }}>
                      <button
                        onClick={() => setExpandedExecId(isExpanded ? null : exec.id)}
                        className="w-full text-left px-5 py-4 transition-all group"
                        onMouseEnter={(e) => { e.currentTarget.style.background = D.surface2; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
                            style={{ background: resultBg, border: `2px solid ${resultBorder}` }}>
                            {resultIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold" style={{ color: D.text }}>{exec.alertName}</span>
                              <SeverityBadge severity={exec.severity} />
                              <ExecutionStatusBadge actionResult={exec.actionResult} error={exec.error} />
                            </div>
                            <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono" style={{ color: D.text2 }}>
                              {exec.orgName && (
                                <span className="inline-flex items-center gap-1">
                                  <Building2 size={10} style={{ color: '#A78BFA' }} />{exec.orgName}{exec.orgEnvironment ? ` (${exec.orgEnvironment})` : ''}
                                </span>
                              )}
                              {exec.matchedAction && (
                                <span className="inline-flex items-center gap-1">
                                  <Wrench size={10} style={{ color: 'var(--argus-signal)' }} />{exec.matchedAction}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Timer size={10} style={{ color: D.text3 }} />{formatDuration(exec.duration)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Hash size={10} style={{ color: D.text3 }} />{exec.steps.length} stages
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right hidden sm:block">
                            <span className="text-[11px] font-mono" style={{ color: D.text2 }}>{relativeTime(exec.timestamp)}</span>
                            <div className="mt-1">
                              {isExpanded
                                ? <ChevronUp size={14} className="ml-auto" style={{ color: D.text3 }} />
                                : <ChevronDown size={14} className="ml-auto" style={{ color: D.text3 }} />}
                            </div>
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-5" style={{ borderTop: `1px solid ${D.border}`, background: D.surface3 }}>
                          <div className="flex items-center gap-2 py-3">
                            <span className="text-[10px] font-mono" style={{ color: D.text2 }}>
                              Execution ID: <span style={{ color: 'var(--argus-signal)' }}>{exec.id}</span>
                            </span>
                            <button onClick={() => { navigator.clipboard.writeText(exec.id); toast.success('Copied'); }}
                              className="p-1 rounded" style={{ color: D.text3 }}>
                              <Copy size={10} />
                            </button>
                          </div>
                          <StepTimeline steps={exec.steps} />
                          {exec.error && (
                            <div className="mt-3 p-3 rounded-lg"
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
                              <p className="text-xs font-medium" style={{ color: 'var(--argus-crimson)' }}>Error: {exec.error}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ CONFIG TAB (admin/manager only) ══════════ */}
      {activeTab === 'config' && canManage && (
        <div className="space-y-5">
          {/* Actions detail */}
          <div className="rounded-2xl" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${D.border}` }}>
              <Wrench size={15} style={{ color: 'var(--argus-signal)' }} />
              <h3 className="text-sm font-display font-bold" style={{ color: D.text }}>Remediation Actions Reference</h3>
            </div>
            <div>
              {actionsList.map((action, idx) => {
                const cat = CATEGORY_COLORS[action.category] || CATEGORY_COLORS.Infrastructure;
                return (
                  <div key={action.id} className="px-5 py-4"
                    style={{ borderBottom: idx < actionsList.length - 1 ? `1px solid ${D.border}` : 'none' }}>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: cat.iconBg }}>
                        {(() => { const I = CATEGORY_ICONS[action.category] || Wrench; return <I size={14} style={{ color: cat.iconColor }} />; })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold" style={{ color: D.text }}>{action.name}</h4>
                          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-md uppercase"
                            style={{ background: cat.badgeBg, color: cat.badgeColor, border: `1px solid ${cat.badgeBorder}` }}>
                            {action.category}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                            style={action.enabled
                              ? { background: 'rgba(52,211,153,0.10)', color: 'var(--argus-emerald)' }
                              : { background: D.surface2, color: D.text3 }}>
                            {action.enabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        <p className="text-xs mb-2" style={{ color: D.text2 }}>{action.description}</p>
                        <div className="flex items-center gap-4 flex-wrap text-[10px] font-mono">
                          <span style={{ color: D.text2 }}>ID: <span style={{ color: 'var(--argus-signal)' }}>{action.id}</span></span>
                          <span style={{ color: D.text2 }}>Commands: <span style={{ color: D.text }}>{action.commandCount}</span></span>
                          <span style={{ color: D.text2 }}>Verification: <span style={{ color: action.hasVerification ? '#34D399' : D.text3 }}>{action.hasVerification ? 'Yes' : 'No'}</span></span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] mr-1" style={{ color: D.text2 }}>Matches:</span>
                          {action.matchAlerts.map((alert) => (
                            <span key={alert} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: D.surface2, color: D.text2, border: `1px solid ${D.border}` }}>{alert}</span>
                          ))}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] mr-1" style={{ color: D.text2 }}>Severity:</span>
                          {action.targetSeverity.map((s) => {
                            const sv = SEVERITY_BADGE[s] || SEVERITY_BADGE.INFO;
                            return (
                              <span key={s} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                                style={{ background: sv.bg, color: sv.color, border: `1px solid ${sv.border}` }}>{s}</span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notification rules detail */}
          <div className="rounded-2xl" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${D.border}` }}>
              <Bell size={15} style={{ color: 'var(--argus-signal)' }} />
              <h3 className="text-sm font-display font-bold" style={{ color: D.text }}>Notification Rules Reference</h3>
            </div>
            <div>
              {notifsList.map((rule, idx) => (
                <div key={rule.id} className="px-5 py-4 flex items-center gap-4"
                  style={{ borderBottom: idx < notifsList.length - 1 ? `1px solid ${D.border}` : 'none' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: rule.channel === 'slack' ? 'rgba(167,139,250,0.12)' : 'rgba(52,211,153,0.12)' }}>
                    {rule.channel === 'slack'
                      ? <MessageSquare size={14} style={{ color: '#A78BFA' }} />
                      : <Bell size={14} style={{ color: 'var(--argus-emerald)' }} />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium" style={{ color: D.text }}>{rule.name}</h4>
                    <div className="flex items-center gap-3 text-[10px] font-mono mt-0.5" style={{ color: D.text2 }}>
                      <span>ID: <span style={{ color: 'var(--argus-signal)' }}>{rule.id}</span></span>
                      <span>Channel: <span style={{ color: D.text }}>{rule.channel}</span></span>
                      {rule.severity && <span>Severity: {rule.severity.join(', ')}</span>}
                      {rule.event && <span>Event: <span style={{ color: 'var(--argus-signal)' }}>{rule.event}</span></span>}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={rule.enabled
                      ? { background: 'rgba(52,211,153,0.10)', color: 'var(--argus-emerald)' }
                      : { background: D.surface2, color: D.text3 }}>
                    {rule.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* API Endpoints */}
          <div className="rounded-2xl p-5" style={{ background: D.surface, border: `1px solid ${D.border}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Link2 size={15} style={{ color: 'var(--argus-signal)' }} />
              <h3 className="text-sm font-display font-bold" style={{ color: D.text }}>Agent Pipeline API Endpoints</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { method: 'GET',  path: '/api/v1/agent/status',                  desc: 'Pipeline status + config' },
                { method: 'POST', path: '/api/v1/agent/toggle',                  desc: 'Enable/disable pipeline' },
                { method: 'GET',  path: '/api/v1/agent/actions',                 desc: 'List remediation actions' },
                { method: 'POST', path: '/api/v1/agent/actions/:id/toggle',      desc: 'Toggle action' },
                { method: 'GET',  path: '/api/v1/agent/notifications',           desc: 'List notification rules' },
                { method: 'POST', path: '/api/v1/agent/notifications/:id/toggle',desc: 'Toggle notification' },
                { method: 'GET',  path: '/api/v1/agent/executions',              desc: 'Execution log' },
                { method: 'GET',  path: '/api/v1/agent/executions/:id',          desc: 'Execution detail' },
              ].map((ep) => (
                <div key={ep.path} className="p-3 rounded-xl" style={{ background: D.surface2, border: `1px solid ${D.border}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={ep.method === 'GET'
                        ? { background: 'rgba(52,211,153,0.12)', color: 'var(--argus-emerald)' }
                        : { background: 'rgba(251,191,36,0.12)', color: 'var(--argus-amber)' }}>
                      {ep.method}
                    </span>
                    <code className="text-[10px] font-mono" style={{ color: D.text }}>{ep.path}</code>
                  </div>
                  <p className="text-[10px]" style={{ color: D.text2 }}>{ep.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-[10px] font-mono" style={{ color: D.text4 }}>
          Powered by AI Agent Pipeline — {actionsList.length} remediation actions, {notifsList.length} notification rules, 13 client organizations
        </p>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Hero Banner (extracted for reuse in error state)
// ══════════════════════════════════════════════════════════════════════════════

function HeroBanner({ pipelineEnabled, canManage, onToggle, toggling, uptime, loading, orgName, orgEnv, isGlobalView, executions, successRate, failed }: {
  pipelineEnabled: boolean;
  canManage: boolean;
  onToggle: () => void;
  toggling: boolean;
  uptime: number;
  loading?: boolean;
  orgName?: string | null;
  orgEnv?: string | null;
  isGlobalView?: boolean;
  executions?: number;
  successRate?: string;
  failed?: number;
}) {
  return (
    <div className="cx-hero">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <span className="cx-eyebrow">Intelligence · automation</span>
          <h1 className="cx-hero__title">Automation</h1>
          <p className="cx-hero__deck">
            Detect → Triage → Enrich → Act → Notify → Verify
            {isGlobalView ? ' · all organisations' : orgName ? ` · ${orgName}${orgEnv ? ` (${orgEnv})` : ''}` : ''}.
          </p>
        </div>
        {loading ? (
          <div className="w-24 h-8 rounded animate-pulse bg-obsidian" />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            disabled={!canManage || toggling}
            className={clsx('cx-hero__btn', !pipelineEnabled && 'cx-hero__btn--ghost')}
          >
            {toggling ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
            {pipelineEnabled ? 'Enabled' : 'Disabled'}
          </button>
        )}
      </div>
      <dl className="cx-hero__kpis cx-hero__kpis--5 mt-6">
        {[
          { label: 'Pipeline', value: pipelineEnabled ? 'On' : 'Off', sub: formatUptime(uptime), tone: pipelineEnabled ? undefined : 'warn' },
          { label: 'Executions', value: loading ? '—' : (executions ?? '—'), sub: 'all time' },
          { label: 'Success', value: loading ? '—' : (successRate != null ? `${successRate}%` : '—'), sub: 'remediation rate' },
          { label: 'Failed', value: loading ? '—' : (failed ?? '—'), sub: 'need review', tone: (failed ?? 0) > 0 ? 'danger' : undefined },
          { label: 'Access', value: canManage ? 'Manage' : 'View', sub: canManage ? 'admin / manager' : 'toggle locked' },
        ].map((kpi) => (
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
  );
}
