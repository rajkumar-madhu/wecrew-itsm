import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UserPlus, ArrowUpRight, CheckCircle2, XCircle, Clock,
  Shield, Activity, MessageSquare, Link2, Paperclip, Upload, Send,
  FileText, AlertTriangle, Timer, Server, Tag, Users, CalendarDays,
  RefreshCw, Zap, Loader2, Pencil, X, Save, ChevronDown, ExternalLink,
  Hash, Globe, Mail, Mic, Flame, BarChart3, ChevronRight,
  CircleDot, Eye, Radio, Bell, Copy, MoreHorizontal,
  Brain, Terminal, Wrench, ListChecks, Cpu, GitBranch,
  Gauge, HardDrive, Wifi, AlertCircle, User2, Clock3, Building2,
  Plus, Layers,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useIncident, useIncidentTimeline, useAddWorkNote, useUpdateIncident, useIncidentLiveContext, useEscalationLogs, useDeleteIncident, useLinkProblem } from '../../hooks/useIncidents';
import { useTeams } from '../../hooks/useTeams';
import { useProblems } from '../../hooks/useProblems';
import IncidentReportGenerator from './IncidentReportGenerator';
import api from '../../lib/api';

// =============================================================================
// Types & Constants
// =============================================================================

type Priority = 'P1' | 'P2' | 'P3' | 'P4';
type IncidentState = 'NEW' | 'IN_PROGRESS' | 'ON_HOLD' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
type TabKey = 'overview' | 'timeline' | 'worknotes' | 'livemetrics' | 'related' | 'aiagent' | 'escalation';

const INCIDENT_TRANSITIONS: Record<string, string[]> = {
  NEW:         ['IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'ESCALATED', 'RESOLVED'],
  ON_HOLD:     ['IN_PROGRESS', 'RESOLVED'],
  ESCALATED:   ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED:    ['CLOSED', 'IN_PROGRESS'],
  CLOSED:      [],
  CANCELLED:   [],
};

const IMPACTS = ['ENTERPRISE', 'DEPARTMENT', 'TEAM', 'INDIVIDUAL'];
const URGENCIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CHANGE_TYPES = ['NORMAL', 'STANDARD', 'EMERGENCY'];
const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITY_TO_RISK: Record<Priority, string> = { P1: 'HIGH', P2: 'MEDIUM', P3: 'LOW', P4: 'LOW' };
const CATEGORIES = [
  'Hardware', 'Software', 'Network', 'Database', 'Security',
  'Cloud', 'Kubernetes', 'Application', 'Infrastructure', 'Other',
];

const RESOLUTION_CODES = [
  { code: 'FIXED',              label: 'Fixed',              icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { code: 'WORKAROUND',        label: 'Workaround',         icon: RefreshCw,    color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  { code: 'KNOWN_ERROR',       label: 'Known Error',        icon: AlertTriangle,color: 'text-orange-600',  bg: 'bg-orange-50 border-orange-200' },
  { code: 'DUPLICATE',         label: 'Duplicate',          icon: Copy,         color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-200' },
  { code: 'NOT_REPRODUCIBLE',  label: 'Not Reproducible',   icon: Eye,          color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
  { code: 'USER_ERROR',        label: 'User Error',         icon: Users,        color: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200' },
  { code: 'CONFIGURATION',     label: 'Configuration',      icon: Server,       color: 'text-cyan-600',    bg: 'bg-cyan-50 border-cyan-200' },
  { code: 'NO_ACTION_REQUIRED',label: 'No Action Required', icon: XCircle,      color: 'text-stone-500',   bg: 'bg-stone-50 border-stone-200' },
];

const STATE_META: Record<string, { label: string; css: string; color: string; icon: React.ElementType }> = {
  NEW:         { label: 'New',         css: 'state-new',         color: '#7C3AED', icon: CircleDot },
  IN_PROGRESS: { label: 'In Progress', css: 'state-in-progress', color: '#F59E0B', icon: Radio },
  ON_HOLD:     { label: 'On Hold',     css: 'state-on-hold',     color: '#D97706', icon: Clock },
  ESCALATED:   { label: 'Escalated',   css: 'state-escalated',   color: '#DC2626', icon: ArrowUpRight },
  RESOLVED:    { label: 'Resolved',    css: 'state-resolved',    color: '#059669', icon: CheckCircle2 },
  CLOSED:      { label: 'Closed',      css: 'state-closed',      color: '#A8A29E', icon: XCircle },
  CANCELLED:   { label: 'Cancelled',   css: 'state-closed',      color: '#A8A29E', icon: XCircle },
};

const PAGE_BG: Record<Priority, string> = {
  P1: 'linear-gradient(180deg, #110305 0%, #0A0202 40%, #080808 100%)',
  P2: 'linear-gradient(180deg, #120900 0%, #0C0600 40%, #080808 100%)',
  P3: 'linear-gradient(180deg, #04040F 0%, #060612 40%, #060606 100%)',
  P4: 'linear-gradient(180deg, #020C05 0%, #020A04 40%, #060606 100%)',
};

const PRIORITY_HERO: Record<Priority, { bg: string; glow1: string; glow2: string; glow3: string }> = {
  P1: {
    bg: 'linear-gradient(135deg, #1F0606 0%, #3D0A0A 25%, #2A0808 50%, #1A0404 75%, #0F0202 100%)',
    glow1: 'rgba(220,38,38,0.35)',
    glow2: 'rgba(239,68,68,0.20)',
    glow3: 'rgba(185,28,28,0.25)',
  },
  P2: {
    bg: 'linear-gradient(135deg, #1F1100 0%, #3D2200 25%, #2A1600 50%, #1A0E00 75%, #0E0700 100%)',
    glow1: 'rgba(245,158,11,0.35)',
    glow2: 'rgba(251,191,36,0.22)',
    glow3: 'rgba(180,83,9,0.25)',
  },
  P3: {
    bg: 'linear-gradient(135deg, #07071E 0%, #0E0E3D 25%, #0A0A2A 50%, #07071A 75%, #04040F 100%)',
    glow1: 'rgba(79,70,229,0.40)',
    glow2: 'rgba(99,102,241,0.25)',
    glow3: 'rgba(55,48,163,0.30)',
  },
  P4: {
    bg: 'linear-gradient(135deg, #03130A 0%, #062614 25%, #041A0C 50%, #031008 75%, #020908 100%)',
    glow1: 'rgba(5,150,105,0.35)',
    glow2: 'rgba(16,185,129,0.22)',
    glow3: 'rgba(4,120,87,0.28)',
  },
};

const PRIORITY_ACCENT: Record<Priority, { line: string; glow: string; badge: string }> = {
  P1: { line: 'from-red-500 via-rose-500 to-red-600', glow: 'shadow-red-500/20', badge: 'bg-red-500/15 text-red-300 ring-red-400/30' },
  P2: { line: 'from-amber-500 via-orange-400 to-amber-500', glow: 'shadow-amber-500/20', badge: 'bg-amber-500/15 text-amber-300 ring-amber-400/30' },
  P3: { line: 'from-[color:var(--argus-signal)] via-blue-400 to-indigo-500', glow: 'shadow-indigo-500/20', badge: 'bg-[color:var(--argus-signal-dim)]/15 text-signal ring-indigo-400/30' },
  P4: { line: 'from-emerald-500 via-teal-400 to-emerald-500', glow: 'shadow-emerald-500/20', badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30' },
};

const PRIORITY_META: Record<Priority, { label: string; css: string; color: string; bg: string }> = {
  P1: { label: 'Critical', css: 'priority-p1', color: '#DC2626', bg: 'bg-red-100 text-red-700' },
  P2: { label: 'High',     css: 'priority-p2', color: '#D97706', bg: 'bg-amber-100 text-amber-700' },
  P3: { label: 'Medium',   css: 'priority-p3', color: '#4F46E5', bg: 'bg-indigo-100 text-[color:var(--argus-signal)]' },
  P4: { label: 'Low',      css: 'priority-p4', color: '#059669', bg: 'bg-emerald-100 text-emerald-700' },
};

const SOURCE_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  PROMETHEUS: { icon: Flame,     color: 'text-orange-600', bg: 'bg-orange-50', label: 'Prometheus' },
  GRAFANA:    { icon: BarChart3, color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Grafana' },
  SLACK:      { icon: Hash,      color: 'text-purple-600', bg: 'bg-purple-50', label: 'Slack' },
  EMAIL:      { icon: Mail,      color: 'text-rose-600',   bg: 'bg-rose-50',   label: 'Email' },
  VOICE:      { icon: Mic,       color: 'text-teal-600',   bg: 'bg-teal-50',   label: 'Voice' },
  API:        { icon: Globe,     color: 'text-cyan-600',   bg: 'bg-cyan-50',   label: 'API' },
  MANUAL:     { icon: Users,     color: 'text-stone-500',  bg: 'bg-stone-50',  label: 'Manual' },
};

// Fallback SLA targets in minutes (match backend SLA_DEFAULTS). Prefer per-incident
// slaTargetResponse / slaTargetResolution timestamps when the API provides them.
const SLA_RESPONSE: Record<Priority, number> = { P1: 5, P2: 15, P3: 60, P4: 240 };
const SLA_RESOLUTION: Record<Priority, number> = { P1: 60, P2: 240, P3: 1440, P4: 4320 };

function slaMinutesFromTarget(
  createdAt: string | undefined,
  targetIso: string | null | undefined,
  fallback: number,
): number {
  if (!createdAt || !targetIso) return fallback;
  const mins = Math.round((new Date(targetIso).getTime() - new Date(createdAt).getTime()) / 60000);
  return mins > 0 ? mins : fallback;
}

const OPEN_STATES = ['NEW', 'IN_PROGRESS', 'ON_HOLD', 'ESCALATED'];

const STATE_FLOW_STEPS: IncidentState[] = ['NEW', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'];

// =============================================================================
// Utility Functions
// =============================================================================

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'BREACHED';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getInitials(first?: string, last?: string): string {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
}

function stateLabel(s: string): string {
  return STATE_META[s]?.label || s.replace(/_/g, ' ');
}

// Strip [WARNING]/[CRITICAL]/[INFO] prefix that alert sync prepends
function cleanTitle(s: string): string {
  return s.replace(/^\[(WARNING|CRITICAL|INFO|OK|UNKNOWN)\]\s*/i, '').trim();
}

// Derive metric focus from alert name: which sections are most relevant
function alertMetricFocus(alertName?: string): 'disk' | 'memory' | 'network' | 'ssh' | 'host' | 'all' {
  if (!alertName) return 'all';
  const n = alertName.toLowerCase();
  if (n.includes('disk') || n.includes('filesystem') || n.includes('storage')) return 'disk';
  if (n.includes('mem') || n.includes('memory') || n.includes('swap') || n.includes('oom')) return 'memory';
  if (n.includes('login') || n.includes('ssh') || n.includes('session') || n.includes('auth')) return 'ssh';
  if (n.includes('hostdown') || n.includes('host_down') || n.includes('unreachable') || n.includes('ping')) return 'host';
  if (n.includes('network') || n.includes('interface') || n.includes('fortigate') || n.includes('snmp') || n.includes('switch') || n.includes('port') || n.includes('bond') || n.includes('nic')) return 'network';
  return 'all';
}

// Filter out virtual/container network interfaces with no traffic
function filterPhysicalInterfaces(interfaces: any[]): any[] {
  return interfaces.filter((ifc: any) => {
    const name: string = (ifc.name || ifc.device || '').toLowerCase();
    const isVirtual = name.startsWith('veth') || name.startsWith('br-') ||
      name === 'docker0' || name === 'lo' || name.startsWith('cali') ||
      name.startsWith('flannel') || name.startsWith('cni') || name.startsWith('tunl');
    if (isVirtual) {
      // Keep virtual only if it has real traffic
      const rx = ifc.rxBps || ifc.rxBytes || 0;
      const tx = ifc.txBps || ifc.txBytes || 0;
      return rx > 1024 || tx > 1024; // >1KB/s or >1KB total
    }
    return true;
  });
}

function formatBytes(b: number): string {
  if (b > 1e12) return (b / 1e12).toFixed(1) + ' TB';
  if (b > 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b.toFixed(0) + ' B';
}

function formatBps(b: number): string { return formatBytes(b) + '/s'; }

function formatDuration(ms: number): string {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function alertSeverityStyle(sev: string) {
  const s = sev?.toLowerCase();
  if (s === 'critical') return { dot: '#EF4444', badge: 'bg-[#FEF2F2] text-[#EF4444] border-[#FECACA]', text: 'text-[#EF4444]' };
  if (s === 'warning') return { dot: '#F59E0B', badge: 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]', text: 'text-[#D97706]' };
  return { dot: '#6366F1', badge: 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]', text: 'text-[#4F46E5]' };
}

// =============================================================================
// Sub-Components
// =============================================================================

/* -- Live Metric Circular Gauge -- */
function LiveGauge({ value, label, sublabel, color, max = 100 }: {
  value: number; label: string; sublabel?: string; color: string; max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const r = 38, circ = 2 * Math.PI * r;
  const dashOffset = circ - (pct / 100) * circ;
  const fillColor = value > 90 ? '#EF4444' : value > 75 ? '#F59E0B' : color;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[96px] h-[96px]" style={{ filter: `drop-shadow(0 0 8px ${fillColor}22)` }}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={r} fill="none" stroke="#E2E8F0" strokeWidth="5" opacity="0.4" />
          <circle cx="42" cy="42" r={r} fill="none" stroke={fillColor} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={dashOffset} className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={clsx('text-lg font-mono font-black tabular-nums', value > 90 ? 'text-[#EF4444]' : value > 75 ? 'text-[#F59E0B]' : '')} style={value <= 75 ? { color: 'var(--argus-ink)' } : {}}>
            {value.toFixed(1)}<span className="text-[10px]" style={{ color: 'var(--argus-muted)' }}>%</span>
          </span>
        </div>
      </div>
      <p className="text-[11px] font-bold mt-2 font-display" style={{ color: 'var(--argus-ink)' }}>{label}</p>
      {sublabel && <p className="text-[10px] font-mono" style={{ color: 'var(--argus-muted)' }}>{sublabel}</p>}
    </div>
  );
}

/* -- SLA Circular Progress Ring -- */
function SlaRing({ label, targetMinutes, createdAt, resolvedAt, met, isOpen }: {
  label: string;
  targetMinutes: number;
  createdAt: string;
  resolvedAt?: string | null;
  met?: boolean;
  isOpen: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  const targetMs = targetMinutes * 60000;
  const endTime = resolvedAt ? new Date(resolvedAt).getTime() : now;
  const elapsedMs = endTime - new Date(createdAt).getTime();
  const pct = Math.min((elapsedMs / targetMs) * 100, 100);
  const breached = elapsedMs > targetMs;
  const urgent = !breached && pct > 50;
  const remainingMs = targetMs - elapsedMs;

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (pct / 100) * circumference;
  const strokeColor = met ? '#059669' : breached ? '#DC2626' : urgent ? '#D97706' : '#F59E0B';
  // Amber accent for tracking state (non-urgent, non-breached)

  const targetLabel = targetMinutes >= 1440
    ? `${targetMinutes / 1440}d`
    : targetMinutes >= 60
      ? `${targetMinutes / 60}h`
      : `${targetMinutes}m`;

  const glowColor = met ? 'rgba(5,150,105,0.15)' : breached ? 'rgba(220,38,38,0.2)' : urgent ? 'rgba(217,119,6,0.15)' : 'rgba(245,158,11,0.1)';

  return (
    <div className="flex flex-col items-center gap-3 group">
      <div className="relative w-[100px] h-[100px]" style={{ filter: `drop-shadow(0 0 12px ${glowColor})` }}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          {/* Background track */}
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#E7E5E4" strokeWidth="4" opacity="0.5" />
          {/* Progress arc */}
          <circle
            cx="40" cy="40" r={radius} fill="none" stroke={strokeColor} strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - strokeDash}
            className="transition-all duration-1000 ease-out"
          />
          {/* Glow overlay arc */}
          <circle
            cx="40" cy="40" r={radius} fill="none" stroke={strokeColor} strokeWidth="8" opacity="0.15"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - strokeDash}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {met ? (
            <CheckCircle2 size={22} className="text-emerald-500" />
          ) : breached ? (
            <AlertTriangle size={20} className="text-red-500 animate-pulse" />
          ) : (
            <span className={clsx(
              'text-base font-mono font-bold tabular-nums',
              urgent ? 'text-amber-600' : 'text-amber-500',
            )}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] font-display" style={{ color: 'var(--argus-muted)' }}>{label}</p>
        <p className={clsx(
          'text-xs font-bold mt-0.5',
          met ? 'text-emerald-600' : breached ? 'text-red-600' : 'text-amber-600',
        )}>
          {met ? 'Met' : breached ? 'Breached' : 'Tracking'}
        </p>
        <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--argus-dim)' }}>Target: {targetLabel}</p>
        {isOpen && !met && !breached && (
          <div className="mt-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <p className="text-[11px] font-mono font-bold tabular-nums" style={{ color: 'var(--argus-amber)' }}>
              {formatCountdown(remainingMs)}
            </p>
          </div>
        )}
        {breached && isOpen && (
          <div className="mt-1.5 px-2.5 py-1 rounded-lg animate-pulse" style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.30)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--argus-crimson)' }}>SLA Breached</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -- Meta Row in sidebar -- */
function MetaRow({ icon: Icon, label, value, accent, mono = false, children }: {
  icon: React.ElementType;
  label: string;
  value?: string;
  accent?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 last:border-0" style={{ borderBottom: '1px solid var(--argus-border)' }}>
      <div className="flex items-center gap-2.5">
        <Icon size={14} style={{ color: 'var(--argus-dim)' }} className="shrink-0" />
        <span className="text-xs font-medium font-body" style={{ color: 'var(--argus-muted)' }}>{label}</span>
      </div>
      {children || (
        <span className={clsx(
          'text-xs font-medium text-right max-w-[60%] truncate',
          mono && 'font-mono',
        )} style={{ color: accent || '#CBD5E1' }}>
          {value || '\u2014'}
        </span>
      )}
    </div>
  );
}

/* -- State Flow Visualization -- */
function StateFlow({ currentState }: { currentState: string }) {
  const stateOrder: Record<string, number> = {
    NEW: 0, IN_PROGRESS: 1, ON_HOLD: 1, ESCALATED: 2, RESOLVED: 3, CLOSED: 4, CANCELLED: 4,
  };
  const currentIdx = stateOrder[currentState] ?? 0;

  return (
    <div className="rounded-2xl px-6 py-5" style={{
      background: 'var(--argus-elevated)',
      border: '1px solid var(--argus-border)',
      backdropFilter: 'blur(12px)',
    }}>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} className="text-amber-500" />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] font-display" style={{ color: 'var(--argus-muted)' }}>Lifecycle Progress</span>
      </div>
      <div className="overflow-x-auto scrollbar-none -mx-2 px-2">
      <div className="flex items-center justify-between relative min-w-[360px]">
        {/* Base track */}
        <div className="absolute top-4 left-0 right-0 h-[3px] z-0 rounded-full" style={{ background: 'var(--argus-elevated)' }} />
        {/* Progress track */}
        <div
          className="absolute top-4 left-0 h-[3px] bg-gradient-to-r from-amber-500 to-amber-400 z-0 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${(currentIdx / (STATE_FLOW_STEPS.length - 1)) * 100}%` }}
        />

        {STATE_FLOW_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const meta = STATE_META[step];

          return (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                  isCompleted && 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/25',
                  isCurrent && 'border-amber-500 ring-4 shadow-lg',
                  !isCompleted && !isCurrent && 'border-[color:var(--argus-border)]',
                )}
                style={
                  isCurrent
                    ? { background: 'rgba(245,158,11,0.15)', boxShadow: '0 0 16px rgba(245,158,11,0.25)' }
                    : !isCompleted
                    ? { background: 'var(--argus-elevated)' }
                    : {}
                }
              >
                {isCompleted ? (
                  <CheckCircle2 size={14} className="text-ink" />
                ) : isCurrent ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.20)' }} />
                )}
              </div>
              <span className={clsx(
                'text-[10px] font-display whitespace-nowrap',
                isCompleted && 'text-amber-500 font-semibold',
                isCurrent && 'font-bold',
                !isCompleted && !isCurrent && 'font-medium',
              )} style={
                isCurrent ? { color: 'var(--argus-amber)' } : (!isCompleted ? { color: 'var(--argus-dim)' } : {})
              }>
                {meta?.label || step}
              </span>
            </div>
          );
        })}
      </div>
      </div>{/* /overflow-x-auto */}
    </div>
  );
}

/* -- Modal Wrapper -- */
function Modal({ open, onClose, title, children, width = 'max-w-md' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative bg-white rounded-2xl shadow-2xl w-full overflow-hidden', width)}>
        {/* Gradient accent line */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-900 font-display">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <X size={18} className="text-stone-400" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Data hooks
  const { data: incidentData, isLoading } = useIncident(id || '');
  const { data: timelineData } = useIncidentTimeline(id || '');
  const addWorkNote = useAddWorkNote(id || '');
  const updateIncident = useUpdateIncident();
  const deleteIncident = useDeleteIncident();
  const linkProblem = useLinkProblem();
  const { data: teamsData } = useTeams();
  const { data: problemsData } = useProblems({ limit: 100 });

  // UI state — ALL hooks must be before any early returns (React rules of hooks)
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // AI Agent resolution details — must be here (before early return) to satisfy rules of hooks
  const { data: aiResData, isLoading: aiResLoading, refetch: refetchAI } = useQuery({
    queryKey: ['ai-resolution', id],
    queryFn: async () => {
      const { data } = await api.get(`/ai/incidents/${id}/resolution-details`);
      return data.data;
    },
    enabled: activeTab === 'aiagent' && !!id,
    staleTime: 300000,
    retry: 1,
  });

  // Live Context (Prometheus metrics, firing alerts, past incidents) — lazy
  const { data: liveCtx, isLoading: liveCtxLoading, refetch: refetchLive } = useIncidentLiveContext(
    id || '', activeTab === 'livemetrics' || activeTab === 'overview',
  );

  // Escalation logs — lazy-loaded when tab is active
  const { data: escData, isLoading: escLoading } = useEscalationLogs(
    id || '', activeTab === 'escalation',
  );

  // Duration counter
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(iv);
  }, []);

  const [noteContent, setNoteContent] = useState('');
  const [noteInternal, setNoteInternal] = useState(false);
  const [showStateMenu, setShowStateMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showReportGen, setShowReportGen] = useState(false);
  const [showCreateChangeModal, setShowCreateChangeModal] = useState(false);
  const [showSubIncidentModal, setShowSubIncidentModal] = useState(false);
  const [showLinkProblemModal, setShowLinkProblemModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkProblemId, setLinkProblemId] = useState('');
  const [linkProblemType, setLinkProblemType] = useState<'CAUSED_BY' | 'RELATED' | 'SYMPTOM_OF'>('RELATED');
  const [submitting, setSubmitting] = useState(false);

  // Assign modal state
  const [assignTeamId, setAssignTeamId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');

  // Edit modal state
  const [editImpact, setEditImpact] = useState('');
  const [editUrgency, setEditUrgency] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // Resolve modal state
  const [resCode, setResCode] = useState('');
  const [resNotes, setResNotes] = useState('');

  // Create Change modal state
  const [changeDesc, setChangeDesc] = useState('');
  const [changeType, setChangeType] = useState('NORMAL');
  const [changeRisk, setChangeRisk] = useState('MEDIUM');
  const [changeJustification, setChangeJustification] = useState('');

  // Sub-Incident modal state
  const [subDesc, setSubDesc] = useState('');
  const [subImpact, setSubImpact] = useState('');
  const [subUrgency, setSubUrgency] = useState('');

  // Users list for assignment. `limit=200` did not error here — `listUsers`
  // clamps `take` to 100 while still deriving `skip` from the raw value — it
  // just silently returned the first hundred, so anyone below that cut simply
  // could not be assigned an incident. The census walks every page.
  const { data: usersData } = useUserCensus<Record<string, unknown>>();

  // Extract data
  const incident = incidentData?.data;
  const timeline = timelineData?.data || [];
  const teams = teamsData?.data || [];

  // Initialize edit/change fields when incident loads
  useEffect(() => {
    if (incident) {
      setEditImpact(incident.impact || '');
      setEditUrgency(incident.urgency || '');
      setEditCategory(incident.category || '');
      setChangeDesc(`Fix: ${incident.shortDescription}`);
      setChangeRisk(PRIORITY_TO_RISK[(incident.priority || 'P3') as Priority]);
      setSubImpact(incident.impact || 'TEAM');
      setSubUrgency(incident.urgency || 'MEDIUM');
    }
  }, [incident?.id]);

  // Derived values
  const priority = (incident?.priority || 'P3') as Priority;
  const state = (incident?.state || 'NEW') as IncidentState;
  const isOpen = OPEN_STATES.includes(state);
  const allowedTransitions = INCIDENT_TRANSITIONS[state] || [];
  const stateMeta = STATE_META[state];

  // SLA calculations — use backend-set deadline timestamps when present
  const slaData = useMemo(() => {
    if (!incident) return null;
    const respTarget = slaMinutesFromTarget(
      incident.createdAt,
      incident.slaTargetResponse,
      SLA_RESPONSE[priority],
    );
    const resTarget = slaMinutesFromTarget(
      incident.createdAt,
      incident.slaTargetResolution,
      SLA_RESOLUTION[priority],
    );
    return { respTarget, resTarget };
  }, [incident, priority]);

  // -- Handlers --

  async function handleStateChange(newState: string) {
    if (!id) return;
    setShowStateMenu(false);

    if (newState === 'RESOLVED') {
      setShowResolveModal(true);
      return;
    }

    setSubmitting(true);
    try {
      await updateIncident.mutateAsync({ id, data: { state: newState } });
      toast.success(`State changed to ${stateLabel(newState)}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update state');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve() {
    if (!id || !resCode) {
      toast.error('Please select a resolution code');
      return;
    }
    setSubmitting(true);
    try {
      await updateIncident.mutateAsync({
        id,
        data: {
          state: 'RESOLVED',
          resolutionCode: resCode,
          resolutionNotes: resNotes || undefined,
        },
      });
      toast.success('Incident resolved');
      setShowResolveModal(false);
      setResCode('');
      setResNotes('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resolve incident');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign() {
    if (!id || (!assignTeamId && !assignUserId)) {
      toast.error('Please select a team or user');
      return;
    }
    setSubmitting(true);
    try {
      const patch: any = {};
      if (assignTeamId) patch.assignmentGroupId = assignTeamId;
      if (assignUserId) patch.assignedToId = assignUserId;
      await updateIncident.mutateAsync({ id, data: patch });
      toast.success('Incident assigned');
      setShowAssignModal(false);
      setAssignTeamId('');
      setAssignUserId('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateChange() {
    if (!id || !changeDesc.trim()) {
      toast.error('Change description is required');
      return;
    }
    setSubmitting(true);
    try {
      const { data: chRes } = await api.post('/changes', {
        shortDescription: changeDesc.trim(),
        type: changeType,
        riskLevel: changeRisk,
        justification: changeJustification.trim() || `Linked to incident ${incident?.number}: ${incident?.shortDescription}`,
        category: incident?.category || undefined,
        assignmentGroupId: incident?.assignmentGroupId || undefined,
        description: `This change was created from incident ${incident?.number}.\n\n${incident?.description || ''}`,
      });
      const changeId = chRes?.data?.id;
      if (changeId) {
        await api.post(`/incidents/${id}/changes`, { changeId });
      }
      toast.success(`Change ${chRes?.data?.number} created and linked`);
      setShowCreateChangeModal(false);
      setChangeDesc('');
      setChangeJustification('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create change');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSubIncident() {
    if (!id || !subDesc.trim()) {
      toast.error('Sub-incident description is required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/incidents', {
        shortDescription: subDesc.trim(),
        description: `Sub-incident of ${incident?.number}: ${incident?.shortDescription}`,
        impact: subImpact || incident?.impact || 'TEAM',
        urgency: subUrgency || incident?.urgency || 'MEDIUM',
        category: incident?.category || undefined,
        assignmentGroupId: incident?.assignmentGroupId || undefined,
        configItemId: incident?.configItemId || undefined,
        source: 'MANUAL',
      });
      toast.success('Sub-incident created successfully');
      setShowSubIncidentModal(false);
      setSubDesc('');
      setSubImpact('');
      setSubUrgency('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create sub-incident');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLinkProblem() {
    if (!id || !linkProblemId) {
      toast.error('Select a problem to link');
      return;
    }
    setSubmitting(true);
    try {
      await linkProblem.mutateAsync({ id, problemId: linkProblemId, linkType: linkProblemType });
      toast.success('Problem linked');
      setShowLinkProblemModal(false);
      setLinkProblemId('');
      setLinkProblemType('RELATED');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to link problem');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setSubmitting(true);
    try {
      await deleteIncident.mutateAsync(id);
      toast.success('Incident deleted');
      navigate('/incidents');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to delete incident');
    } finally {
      setSubmitting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleEdit() {
    if (!id) return;
    setSubmitting(true);
    try {
      await updateIncident.mutateAsync({
        id,
        data: {
          impact: editImpact || undefined,
          urgency: editUrgency || undefined,
          category: editCategory || undefined,
        },
      });
      toast.success('Incident updated');
      setShowEditModal(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    try {
      await addWorkNote.mutateAsync({ content: noteContent.trim(), isInternal: noteInternal });
      toast.success('Note added');
      setNoteContent('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add note');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Loading State
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading || !incident) {
    return (
      <div className="min-h-screen p-6 space-y-6" style={{ background: '#060606' }}>
        {/* Skeleton hero */}
        <div className="rounded-2xl h-48 animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
        {/* Skeleton floating cards */}
        <div className="flex gap-4 -mt-8 relative z-10 px-6">
          <div className="flex-1 h-40 rounded-2xl animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
          <div className="flex-1 h-40 rounded-2xl animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
        </div>
        {/* Skeleton state flow */}
        <div className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
        {/* Skeleton content */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-4">
            <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
            <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
          </div>
          <div className="col-span-4">
            <div className="h-96 rounded-2xl animate-pulse" style={{ background: 'var(--argus-elevated)' }} />
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Source info
  // ───────────────────────────────────────────────────────────────────────────

  const srcMeta = SOURCE_META[incident.source || 'MANUAL'] || SOURCE_META.MANUAL;
  const SrcIcon = srcMeta.icon;

  // ───────────────────────────────────────────────────────────────────────────
  // Tabs config
  // ───────────────────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number; accent?: boolean }[] = [
    { key: 'overview',     label: 'Overview',     icon: Eye,            count: incident.relatedAlerts?.length || undefined },
    { key: 'timeline',     label: 'Activity',     icon: Activity,       count: timeline.length },
    { key: 'worknotes',    label: 'Notes',        icon: MessageSquare },
    { key: 'livemetrics',  label: 'Live Metrics', icon: Gauge,          accent: true },
    { key: 'related',      label: 'Related',      icon: Link2, count: (incident.linkedChanges?.length || 0) + (incident.linkedProblems?.length || 0) + (incident.relatedAlerts?.length || 0) || undefined },
    { key: 'aiagent',      label: 'AI Agent',     icon: Brain,          accent: true },
    { key: 'escalation',   label: 'Escalation',   icon: Bell,           count: escData?.logs?.length || undefined },
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: PAGE_BG[priority] }}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-0">

        {/* ================= HERO HEADER ================= */}
        <div
          className="relative rounded-2xl overflow-hidden p-4 sm:p-6 lg:p-8 pb-12 sm:pb-16"
          style={{ background: PRIORITY_HERO[priority].bg }}
        >
          {/* Priority accent line at top */}
          <div className={clsx('absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r', PRIORITY_ACCENT[priority].line)} />
          {/* Three ambient glow orbs */}
          <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full blur-[80px] -translate-y-1/2"
            style={{ background: `radial-gradient(circle, ${PRIORITY_HERO[priority].glow1} 0%, transparent 70%)` }} />
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/4"
            style={{ background: `radial-gradient(circle, ${PRIORITY_HERO[priority].glow2} 0%, transparent 70%)` }} />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full blur-[70px] translate-y-1/2 -translate-x-1/4"
            style={{ background: `radial-gradient(circle, ${PRIORITY_HERO[priority].glow3} 0%, transparent 70%)` }} />
          {/* Fine grid texture */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left: Info */}
            <div className="flex-1 min-w-0">
              {/* Back button */}
              <button
                onClick={() => navigate('/incidents')}
                className="flex items-center gap-1.5 text-ink/60 hover:text-ink transition-colors text-sm font-medium mb-3 group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="font-body">Back to Incidents</span>
              </button>

              {/* Number + creation context */}
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-ink/70 text-sm font-bold tracking-wider bg-[color:var(--argus-elevated)] px-3 py-1 rounded-lg border border-[color:var(--argus-border)]">{incident.number}</span>
                <span className="text-[11px] text-slate-400 font-body">
                  opened {relativeTime(incident.createdAt)}
                  {incident.assignedTo ? ` · assigned to ${incident.assignedTo.firstName} ${incident.assignedTo.lastName}` : ' · unassigned'}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-display text-xl sm:text-[26px] font-extrabold text-ink leading-tight mb-5 line-clamp-2 tracking-tight">
                {cleanTitle(incident.shortDescription)}
              </h1>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Priority badge */}
                <span className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ring-1 backdrop-blur-sm',
                  PRIORITY_ACCENT[priority].badge,
                )}>
                  <Shield size={12} />
                  {priority} — {PRIORITY_META[priority].label}
                </span>

                {/* State badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[color:var(--argus-elevated)] text-ink/90 ring-1 ring-white/[0.12] backdrop-blur-sm">
                  {stateMeta && <stateMeta.icon size={12} />}
                  {stateMeta?.label || state}
                </span>

                {/* Source badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[color:var(--argus-elevated)] text-ink/60 ring-1 ring-white/[0.08] backdrop-blur-sm">
                  <SrcIcon size={12} />
                  {srcMeta.label}
                </span>

                {/* SLA Breached indicator */}
                {incident.slaBreached && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/25 text-red-300 ring-1 ring-red-400/40 animate-pulse backdrop-blur-sm">
                    <AlertTriangle size={12} />
                    SLA BREACHED
                  </span>
                )}

                {/* Alert count badge */}
                {incident.relatedAlerts?.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[color:var(--argus-elevated)] text-ink/60 ring-1 ring-white/[0.08] backdrop-blur-sm">
                    <Bell size={12} />
                    {incident.relatedAlerts.length} alert{incident.relatedAlerts.length !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Duration */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-[color:var(--argus-elevated)] text-ink/50 ring-1 ring-white/[0.08] backdrop-blur-sm">
                  <Clock3 size={11} />
                  {formatDuration(nowTs - new Date(incident.createdAt).getTime())}
                </span>

                {/* Org + environment badge */}
                {incident.organization && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[color:var(--argus-elevated)] text-ink/50 ring-1 ring-white/[0.08] backdrop-blur-sm">
                    <Building2 size={11} />
                    {incident.organization.name}
                    {incident.organization.environment && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-[color:var(--argus-elevated)] text-[10px] font-mono">{incident.organization.environment}</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Actions — visible buttons + state changer */}
            <div className="flex flex-col sm:flex-col items-end gap-2 shrink-0 mt-2 sm:mt-0">

              {/* Row 1: Edit + Assign (always visible) */}
              <div className="flex items-center gap-2">
                {isOpen && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    title="Edit Incident"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[color:var(--argus-elevated)] text-ink/80 hover:bg-white/[0.14] transition-all ring-1 ring-white/[0.1] backdrop-blur-sm"
                  >
                    <Pencil size={13} />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                )}

                {isOpen && (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[color:var(--argus-elevated)] text-ink/80 hover:bg-white/[0.14] transition-all ring-1 ring-white/[0.1] backdrop-blur-sm"
                  >
                    <UserPlus size={13} />
                    <span className="hidden sm:inline">{incident.assignedTo ? 'Reassign' : 'Assign'}</span>
                  </button>
                )}

                {/* More (Report only) */}
                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-[color:var(--argus-elevated)] text-ink/80 hover:bg-white/[0.14] transition-all ring-1 ring-white/[0.1] backdrop-blur-sm"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {showMoreMenu && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setShowMoreMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-2xl border border-stone-200 py-1.5 min-w-[180px]">
                        <div className="px-4 py-0.5">
                          <IncidentReportGenerator
                            incidentId={incident.id}
                            incidentNumber={incident.number}
                            className="!bg-transparent !text-stone-700 hover:!bg-stone-50 !shadow-none !px-0 !py-2 !rounded-none !text-sm !font-medium w-full justify-start gap-2.5"
                          />
                        </div>
                        <div className="my-1 border-t border-stone-100" />
                        <button
                          onClick={() => { setShowMoreMenu(false); navigator.clipboard.writeText(incident.number); toast.success('Number copied'); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                        >
                          <Copy size={14} className="text-stone-400" />
                          Copy INC Number
                        </button>
                        <button
                          onClick={() => { setShowMoreMenu(false); setShowLinkProblemModal(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                        >
                          <AlertTriangle size={14} className="text-violet-400" />
                          Link Problem
                        </button>
                        <div className="my-1 border-t border-stone-100" />
                        <button
                          onClick={() => { setShowMoreMenu(false); setShowDeleteConfirm(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <XCircle size={14} />
                          Delete Incident
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Row 2: Change State (primary CTA) + Quick Close */}
              <div className="flex items-center gap-2">
                {/* Quick Close — when RESOLVED */}
                {state === 'RESOLVED' && (
                  <button
                    onClick={() => handleStateChange('CLOSED')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg disabled:opacity-50"
                    style={{ boxShadow: '0 4px 12px rgba(5,150,105,0.35)' }}
                  >
                    <CheckCircle2 size={13} />
                    Close Incident
                  </button>
                )}

                {allowedTransitions.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowStateMenu(!showStateMenu)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
                    >
                      <Zap size={13} />
                      Change State
                      <ChevronDown size={12} className={clsx('transition-transform', showStateMenu && 'rotate-180')} />
                    </button>
                    {showStateMenu && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setShowStateMenu(false)} />
                        <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-2xl border border-stone-200 py-1.5 min-w-[200px]">
                          <div className="px-4 py-2 border-b border-stone-100">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Transition from <span style={{ color: stateMeta?.color }}>{stateMeta?.label}</span></p>
                          </div>
                          {allowedTransitions.map((tr) => {
                            const trMeta = STATE_META[tr];
                            const TrIcon = trMeta?.icon || CircleDot;
                            return (
                              <button
                                key={tr}
                                onClick={() => handleStateChange(tr)}
                                disabled={submitting}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
                              >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${trMeta?.color}18` }}>
                                  <TrIcon size={14} style={{ color: trMeta?.color }} />
                                </div>
                                <div className="text-left">
                                  <p className="font-semibold text-stone-800 text-[13px]">{trMeta?.label || tr}</p>
                                  <p className="text-[10px] text-stone-400">
                                    {tr === 'IN_PROGRESS' ? 'Start working on this incident' :
                                     tr === 'RESOLVED' ? 'Mark as fixed — requires resolution code' :
                                     tr === 'ESCALATED' ? 'Escalate to higher tier' :
                                     tr === 'ON_HOLD' ? 'Pause — waiting on external input' :
                                     tr === 'CLOSED' ? 'Fully close the incident' :
                                     tr === 'CANCELLED' ? 'Cancel — not a valid incident' : ''}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Priority accent line */}
        <div className={clsx('h-[2px] bg-gradient-to-r', PRIORITY_ACCENT[priority].line)} />

        {/* ================= FLOATING INFO CARDS ================= */}
        <div className="flex flex-col md:flex-row gap-4 -mt-8 relative z-10 px-2 sm:px-4">
          {/* SLA Status Card */}
          <div className="flex-1 rounded-2xl p-6 relative overflow-hidden transition-shadow duration-300" style={{
            background: 'var(--argus-elevated)',
            border: '1px solid var(--argus-border)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                <Timer size={14} className="text-amber-500" />
              </div>
              <h3 className="text-sm font-bold font-display" style={{ color: 'var(--argus-ink)' }}>SLA Compliance</h3>
            </div>
            <p className="text-[10px] ml-9 mb-4 font-body" style={{ color: 'var(--argus-muted)' }}>
              Real-time response & resolution target tracking
            </p>
            {slaData && (
              <div className="flex items-start justify-around gap-6">
                <SlaRing
                  label="Response"
                  targetMinutes={slaData.respTarget}
                  createdAt={incident.createdAt}
                  resolvedAt={incident.resolvedAt}
                  met={incident.responseSlaMet}
                  isOpen={isOpen}
                />
                <SlaRing
                  label="Resolution"
                  targetMinutes={slaData.resTarget}
                  createdAt={incident.createdAt}
                  resolvedAt={incident.resolvedAt}
                  met={incident.resolutionSlaMet}
                  isOpen={isOpen}
                />
              </div>
            )}
          </div>

          {/* Quick Info Card */}
          <div className="flex-1 rounded-2xl p-6 relative overflow-hidden transition-shadow duration-300" style={{
            background: 'var(--argus-elevated)',
            border: '1px solid var(--argus-border)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                <Zap size={14} className="text-amber-500" />
              </div>
              <h3 className="text-sm font-bold font-display" style={{ color: 'var(--argus-ink)' }}>Incident Classification</h3>
            </div>
            <p className="text-[10px] ml-9 mb-4 font-body" style={{ color: 'var(--argus-muted)' }}>
              Impact × Urgency priority matrix & detection source
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--argus-muted)' }}>Impact</p>
                <p className="text-sm font-medium" style={{ color: 'var(--argus-ink)' }}>{incident.impact || '\u2014'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--argus-muted)' }}>Urgency</p>
                <p className="text-sm font-medium" style={{ color: 'var(--argus-ink)' }}>{incident.urgency || '\u2014'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--argus-muted)' }}>Priority</p>
                <span className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold',
                  PRIORITY_META[priority].bg,
                )}>
                  {priority} - {PRIORITY_META[priority].label}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--argus-muted)' }}>Category</p>
                <p className="text-sm font-medium" style={{ color: 'var(--argus-ink)' }}>{incident.category || '\u2014'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--argus-muted)' }}>Source</p>
                <div className="flex items-center gap-1.5">
                  <div className={clsx('w-5 h-5 rounded flex items-center justify-center', srcMeta.bg)}>
                    <SrcIcon size={12} className={srcMeta.color} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--argus-ink)' }}>{srcMeta.label}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= STATE FLOW VISUALIZATION ================= */}
        <div className="mt-5">
          <StateFlow currentState={state} />
        </div>

        {/* ================= QUICK ACTIONS BAR ================= */}
        {state !== 'CLOSED' && state !== 'CANCELLED' && (
          <div className="mt-4 rounded-2xl px-5 py-4" style={{
            background: 'var(--argus-elevated)',
            border: '1px solid var(--argus-border)',
            backdropFilter: 'blur(16px)',
          }}>
            <div className="flex items-center gap-1.5 mb-3">
              <Zap size={12} style={{ color: 'var(--argus-amber)' }} />
              <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--argus-dim)' }}>Quick Actions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Assign / Reassign */}
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.20) 0%, rgba(99,102,241,0.12) 100%)', border: '1px solid rgba(99,102,241,0.30)', color: 'var(--argus-signal)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(79,70,229,0.30) 0%, rgba(99,102,241,0.20) 100%)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(79,70,229,0.20) 0%, rgba(99,102,241,0.12) 100%)'; }}
              >
                <UserPlus size={13} />
                {incident.assignedTo ? `Reassign (${incident.assignedTo.firstName})` : 'Assign Engineer'}
              </button>

              {/* Create Change */}
              <button
                onClick={() => setShowCreateChangeModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(139,92,246,0.12) 100%)', border: '1px solid rgba(139,92,246,0.30)', color: 'var(--argus-signal)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(124,58,237,0.30) 0%, rgba(139,92,246,0.20) 100%)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(139,92,246,0.12) 100%)'; }}
              >
                <GitBranch size={13} />
                Create Change Request
              </button>

              {/* Create Sub-Incident */}
              {state !== 'RESOLVED' && (
                <button
                  onClick={() => setShowSubIncidentModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.20) 0%, rgba(59,130,246,0.12) 100%)', border: '1px solid rgba(59,130,246,0.30)', color: '#93C5FD' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(37,99,235,0.30) 0%, rgba(59,130,246,0.20) 100%)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(37,99,235,0.20) 0%, rgba(59,130,246,0.12) 100%)'; }}
                >
                  <Layers size={13} />
                  Create Sub-Incident
                </button>
              )}

              {/* Resolve shortcut */}
              {allowedTransitions.includes('RESOLVED') && (
                <button
                  onClick={() => handleStateChange('RESOLVED')}
                  disabled={submitting}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.20) 0%, rgba(16,185,129,0.12) 100%)', border: '1px solid rgba(16,185,129,0.30)', color: 'var(--argus-emerald)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(5,150,105,0.30) 0%, rgba(16,185,129,0.20) 100%)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(5,150,105,0.20) 0%, rgba(16,185,129,0.12) 100%)'; }}
                >
                  <CheckCircle2 size={13} />
                  Mark Resolved
                </button>
              )}

              {/* Escalate shortcut */}
              {allowedTransitions.includes('ESCALATED') && (
                <button
                  onClick={() => handleStateChange('ESCALATED')}
                  disabled={submitting}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.20) 0%, rgba(239,68,68,0.12) 100%)', border: '1px solid rgba(239,68,68,0.30)', color: 'var(--argus-crimson)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(220,38,38,0.30) 0%, rgba(239,68,68,0.20) 100%)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(220,38,38,0.20) 0%, rgba(239,68,68,0.12) 100%)'; }}
                >
                  <ArrowUpRight size={13} />
                  Escalate
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= TWO-COLUMN LAYOUT ================= */}
        <div className="grid grid-cols-12 gap-6 mt-6">

          {/* ---- Left Column (8/12) ---- */}
          <div className="col-span-12 lg:col-span-8 space-y-6">

            {/* Description Card */}
            <div className="rounded-2xl p-6 relative overflow-hidden" style={{
              background: 'var(--argus-elevated)',
              border: '1px solid var(--argus-border)',
              backdropFilter: 'blur(8px)',
            }}>
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <FileText size={14} className="text-amber-500" />
                </div>
                <h3 className="text-sm font-bold font-display" style={{ color: 'var(--argus-ink)' }}>Incident Analysis</h3>
              </div>
              <p className="text-[10px] mb-5 ml-[38px] font-body" style={{ color: 'var(--argus-muted)' }}>
                Disruption details, affected systems, root cause indicators & impact assessment
              </p>

              {(() => {
                const desc = incident.description || '';
                const isAlert = desc.startsWith('Auto-created from alert:') || desc.startsWith('ALERT:');
                const isEnriched = desc.startsWith('## Disruption Details');

                if (!desc) {
                  return (
                    <div className="p-5 rounded-xl bg-stone-50/70 border border-dashed border-stone-300 text-center">
                      <FileText size={24} className="mx-auto text-stone-300 mb-2" />
                      <p className="text-sm text-stone-500 font-medium font-body">No description provided</p>
                      <p className="text-xs text-stone-400 mt-1 font-body">Use the Edit action to add incident details for the resolution team.</p>
                    </div>
                  );
                }

                if (isEnriched) {
                  // Parse markdown-style enriched description (## sections)
                  const mdSections: { title: string; lines: string[] }[] = [];
                  let currentSec = { title: '', lines: [] as string[] };
                  desc.split('\n').forEach((line: string) => {
                    const heading = line.match(/^##\s+(.+)/);
                    if (heading) {
                      if (currentSec.title) mdSections.push(currentSec);
                      currentSec = { title: heading[1].trim(), lines: [] };
                    } else if (line.trim()) {
                      currentSec.lines.push(line.trim());
                    }
                  });
                  if (currentSec.title) mdSections.push(currentSec);

                  // Extract key fields
                  const allPairs: { key: string; value: string }[] = [];
                  mdSections.forEach(s => {
                    s.lines.forEach(l => {
                      const m = l.match(/^([A-Za-z\s_/]+):\s*(.+)$/);
                      if (m) allPairs.push({ key: m[1].trim(), value: m[2].trim() });
                    });
                  });
                  const mdAlertName = allPairs.find(p => p.key === 'Alert')?.value || 'Unknown Alert';
                  const mdSeverity = allPairs.find(p => p.key === 'Severity')?.value || '';
                  const mdHostname = allPairs.find(p => p.key === 'Hostname' || p.key === 'Host')?.value || '';
                  const mdInstance = allPairs.find(p => p.key === 'Instance')?.value || '';
                  const mdSummary = allPairs.find(p => p.key === 'Summary')?.value || '';

                  return (
                    <div className="space-y-4">
                      {/* Dark alert header */}
                      <div className="rounded-xl bg-obsidian text-ink border border-[color:var(--argus-border)] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[color:var(--argus-border)] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-[10px] font-mono text-ink/40 uppercase tracking-wider">Alert Intelligence</span>
                          </div>
                          <span className="text-[10px] font-mono text-ink/25">{incident.source || 'MONITORING'}</span>
                        </div>
                        <div className="p-5">
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)]">
                            <Bell size={14} className="text-amber-400" />
                            <code className="text-sm font-mono font-bold text-amber-300">{mdAlertName}</code>
                          </div>
                          {mdSummary && <p className="text-[13px] text-ink/60 mt-3 font-body">{mdSummary}</p>}
                        </div>
                      </div>

                      {/* Affected System banner */}
                      {(mdHostname || mdInstance) && (
                        <div className="rounded-xl bg-obsidian text-ink border border-[color:var(--argus-border)] overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-[color:var(--argus-border)] flex items-center gap-2">
                            <Server size={12} className="text-emerald-400" />
                            <span className="text-[10px] font-mono text-ink/40 uppercase tracking-wider">Affected System</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                            {mdHostname && (
                              <div className="px-4 py-3">
                                <div className="text-[9px] font-bold text-ink/30 uppercase tracking-[0.12em] mb-1">Hostname</div>
                                <div className="text-sm font-bold text-amber-300 font-mono">{mdHostname}</div>
                              </div>
                            )}
                            {mdInstance && (
                              <div className="px-4 py-3">
                                <div className="text-[9px] font-bold text-ink/30 uppercase tracking-[0.12em] mb-1">Instance</div>
                                <div className="text-sm font-bold text-amber-300 font-mono">{mdInstance}</div>
                              </div>
                            )}
                            {mdSeverity && (
                              <div className="px-4 py-3">
                                <div className="text-[9px] font-bold text-ink/30 uppercase tracking-[0.12em] mb-1">Severity</div>
                                <span className={clsx(
                                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold',
                                  mdSeverity === 'CRITICAL' && 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30',
                                  mdSeverity === 'WARNING' && 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30',
                                  mdSeverity !== 'CRITICAL' && mdSeverity !== 'WARNING' && 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30',
                                )}>
                                  <span className={clsx('w-2 h-2 rounded-full',
                                    mdSeverity === 'CRITICAL' ? 'bg-red-500 animate-pulse' : mdSeverity === 'WARNING' ? 'bg-amber-500' : 'bg-blue-500'
                                  )} />
                                  {mdSeverity}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Structured sections */}
                      {mdSections.filter(s => s.title !== 'Disruption Details' && s.title !== 'Alert Metadata').map((section, si) => (
                        <div key={si} className="rounded-xl bg-white border border-stone-200 overflow-hidden">
                          <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100">
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.12em] font-display">{section.title}</span>
                          </div>
                          <div className="p-4 space-y-1.5">
                            {section.lines.map((line, li) => {
                              const kv = line.match(/^-?\s*([A-Za-z\s_/]+):\s*(.+)$/);
                              if (kv) {
                                return (
                                  <div key={li} className="flex items-start gap-3 py-1">
                                    <span className="text-[11px] font-bold text-stone-400 min-w-[100px] uppercase tracking-wider font-display">{kv[1].trim()}</span>
                                    <span className="text-sm text-stone-800 font-mono">{kv[2].trim()}</span>
                                  </div>
                                );
                              }
                              return <p key={li} className="text-sm text-stone-700 font-body leading-relaxed">{line.replace(/^-\s*/, '')}</p>;
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Alert Metadata (filtered) */}
                      {(() => {
                        const metaSec = mdSections.find(s => s.title === 'Alert Metadata');
                        if (!metaSec || metaSec.lines.length === 0) return null;
                        const noiseKeys = new Set(['le_code', 'isEvent', 'product_model', 'fortigatealert', 'mode', 'alertname', 'severity', 'instance', 'job', 'nodename']);
                        const filtered = metaSec.lines
                          .map(l => { const m = l.match(/^([A-Za-z_]+):\s*(.+)$/); return m ? { key: m[1], value: m[2] } : null; })
                          .filter((p): p is { key: string; value: string } => p !== null && !noiseKeys.has(p.key) && p.value.length > 1);
                        if (filtered.length === 0) return null;
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {filtered.map((p, i) => (
                              <div key={i} className="p-4 rounded-xl bg-gradient-to-b from-slate-50 to-white border border-stone-200 hover:border-amber-200 transition-colors">
                                <div className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.12em] mb-2 font-display">{p.key.replace(/_/g, ' ')}</div>
                                <div className="text-sm font-bold text-stone-900 font-mono leading-tight break-all">{p.value}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Impact / Urgency */}
                      {incident.impact && (
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-xl bg-gradient-to-b from-slate-50 to-white border border-stone-200">
                            <div className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.12em] mb-1 font-display">Impact / Urgency</div>
                            <div className="text-sm font-bold text-stone-900">{incident.impact} / {incident.urgency}</div>
                          </div>
                          <div className="p-3 rounded-xl bg-gradient-to-b from-slate-50 to-white border border-stone-200">
                            <div className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.12em] mb-1 font-display">Source</div>
                            <div className="flex items-center gap-2">
                              <div className={clsx('w-5 h-5 rounded-md flex items-center justify-center', srcMeta.bg)}>
                                <SrcIcon size={10} className={srcMeta.color} />
                              </div>
                              <span className="text-sm font-bold text-stone-900">{srcMeta.label}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (isAlert) {
                  const lines = desc.split('\n').map((l: string) => l.trim()).filter(Boolean);
                  // Support both old format ("Auto-created from alert: X") and new ("ALERT: X")
                  const firstLine = lines[0] || '';
                  const alertName = firstLine.replace(/^Auto-created from alert:\s*/i, '').replace(/^ALERT:\s*/i, '').trim() || 'Unknown';
                  const pairs: { key: string; value: string }[] = [];
                  const extraLines: string[] = [];
                  // Section-aware parsing: collect all lines (KV, bullets, numbered) per section
                  type SectionLine = { type: 'kv'; key: string; value: string } | { type: 'bullet'; text: string } | { type: 'numbered'; num: string; text: string } | { type: 'text'; text: string };
                  const sectionMap: Record<string, SectionLine[]> = {};
                  const sectionOrder: string[] = [];
                  let currentSection = '';
                  lines.slice(1).forEach((line: string) => {
                    const sectionMatch = line.match(/^──\s*(.+?)\s*──+$/);
                    if (sectionMatch) {
                      currentSection = sectionMatch[1].trim();
                      if (!sectionMap[currentSection]) { sectionMap[currentSection] = []; sectionOrder.push(currentSection); }
                      return;
                    }
                    // Numbered list: "1. Check filesystem..."
                    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
                    if (numMatch) {
                      const entry: SectionLine = { type: 'numbered', num: numMatch[1], text: numMatch[2] };
                      if (currentSection && sectionMap[currentSection]) sectionMap[currentSection].push(entry);
                      else extraLines.push(line);
                      return;
                    }
                    // Bullet list: "- Some text"
                    const bulletMatch = line.match(/^-\s+(.+)$/);
                    if (bulletMatch) {
                      const entry: SectionLine = { type: 'bullet', text: bulletMatch[1] };
                      if (currentSection && sectionMap[currentSection]) sectionMap[currentSection].push(entry);
                      else extraLines.push(line);
                      return;
                    }
                    // Key-value pair
                    const kvMatch = line.match(/^([A-Za-z\s_/()]+):\s*(.+)$/);
                    if (kvMatch) {
                      const pair = { key: kvMatch[1].trim(), value: kvMatch[2].trim() };
                      pairs.push(pair);
                      if (currentSection && sectionMap[currentSection]) sectionMap[currentSection].push({ type: 'kv', ...pair });
                      return;
                    }
                    // Plain text
                    if (currentSection && sectionMap[currentSection]) sectionMap[currentSection].push({ type: 'text', text: line });
                    else extraLines.push(line);
                  });

                  const severityVal = pairs.find(p => p.key.toLowerCase() === 'severity')?.value || '';
                  const clientName = pairs.find(p => p.key === 'Client')?.value || '';
                  const ipAddress = pairs.find(p => p.key === 'IP Address')?.value || '';
                  const hostname = pairs.find(p => p.key === 'Hostname')?.value || '';
                  const instanceVal = pairs.find(p => p.key === 'Instance')?.value || '';
                  // Keys to exclude from generic grid (already shown in dedicated cards + noise labels)
                  const shownKeys = new Set([
                    'severity', 'client', 'ip address', 'hostname', 'instance',
                    'le_code', 'isevent', 'product_model', 'fortigatealert', 'mode',
                    'alertname', 'nodename', 'node', 'host', 'exported_instance',
                    'target', 'ip', 'node_ip', 'scrape_job',
                  ]);

                  // Section styling — investigation/remediation get special treatment
                  const sectionStyles: Record<string, { icon: string; border: string; bg: string; accent: string }> = {
                    'Affected System': { icon: '🖥', border: 'border-emerald-200', bg: 'bg-emerald-50/50', accent: 'text-emerald-700' },
                    'Target': { icon: '🖥', border: 'border-emerald-200', bg: 'bg-emerald-50/50', accent: 'text-emerald-700' },
                    'Root Cause Analysis': { icon: '🔍', border: 'border-red-200', bg: 'bg-red-50/50', accent: 'text-red-700' },
                    'Investigation Steps': { icon: '🔧', border: 'border-[color:var(--argus-signal)]/25', bg: 'bg-[color:var(--argus-signal-dim)]/50', accent: 'text-[color:var(--argus-signal)]' },
                    'Recommended Actions': { icon: '✅', border: 'border-emerald-200', bg: 'bg-emerald-50/50', accent: 'text-emerald-700' },
                    'Impact Assessment': { icon: '⚡', border: 'border-amber-200', bg: 'bg-amber-50/50', accent: 'text-amber-700' },
                    'Alert Details': { icon: '📊', border: 'border-stone-200', bg: 'bg-stone-50/50', accent: 'text-stone-700' },
                    'Alert Metadata': { icon: '🏷', border: 'border-stone-200', bg: 'bg-stone-50/50', accent: 'text-stone-500' },
                    'Source': { icon: '📡', border: 'border-stone-200', bg: 'bg-stone-50/50', accent: 'text-stone-600' },
                    'All Labels': { icon: '🏷', border: 'border-stone-200', bg: 'bg-stone-50/50', accent: 'text-stone-500' },
                  };
                  const defaultStyle = { icon: '📋', border: 'border-stone-200', bg: 'bg-stone-50/50', accent: 'text-stone-600' };

                  // Sections to skip rendering individually (shown in dedicated cards above)
                  const skipSections = new Set(['Affected System', 'Target']);

                  return (
                    <div className="space-y-4">
                      {/* Dark alert origin card */}
                      <div className="rounded-xl bg-obsidian text-ink border border-[color:var(--argus-border)] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[color:var(--argus-border)] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-[10px] font-mono text-ink/40 uppercase tracking-wider">Alert Intelligence</span>
                          </div>
                          <span className="text-[10px] font-mono text-ink/25">{incident.source || 'MONITORING'}</span>
                        </div>
                        <div className="p-5">
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)]">
                            <Bell size={14} className="text-amber-400" />
                            <code className="text-sm font-mono font-bold text-amber-300">{alertName}</code>
                          </div>
                          {severityVal && (
                            <span className={clsx(
                              'ml-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold',
                              severityVal === 'CRITICAL' && 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30',
                              severityVal === 'WARNING' && 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30',
                              severityVal !== 'CRITICAL' && severityVal !== 'WARNING' && 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30',
                            )}>
                              <span className={clsx('w-2 h-2 rounded-full', severityVal === 'CRITICAL' ? 'bg-red-500 animate-pulse' : severityVal === 'WARNING' ? 'bg-amber-500' : 'bg-blue-500')} />
                              {severityVal}
                            </span>
                          )}
                          {pairs.find(p => p.key === 'Category') && (
                            <span className="ml-2 text-[11px] text-ink/40 font-mono">{pairs.find(p => p.key === 'Category')?.value}</span>
                          )}
                        </div>
                      </div>

                      {/* Affected System banner */}
                      {(clientName || ipAddress || hostname || sectionMap['Affected System']?.length || sectionMap['Target']?.length) && (
                        <div className="rounded-xl bg-obsidian text-ink border border-[color:var(--argus-border)] overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-[color:var(--argus-border)] flex items-center gap-2">
                            <Server size={12} className="text-emerald-400" />
                            <span className="text-[10px] font-mono text-ink/40 uppercase tracking-wider">Affected System</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                            {(clientName || hostname) && (
                              <div className="px-4 py-3">
                                <div className="text-[9px] font-bold text-ink/30 uppercase tracking-[0.12em] mb-1">{clientName ? 'Client' : 'Hostname'}</div>
                                <div className="text-sm font-bold text-ink font-body">{clientName || hostname}</div>
                              </div>
                            )}
                            {hostname && clientName && (
                              <div className="px-4 py-3">
                                <div className="text-[9px] font-bold text-ink/30 uppercase tracking-[0.12em] mb-1">Hostname</div>
                                <div className="text-sm font-bold text-amber-300 font-mono">{hostname}</div>
                              </div>
                            )}
                            {(ipAddress || instanceVal) && (
                              <div className="px-4 py-3">
                                <div className="text-[9px] font-bold text-ink/30 uppercase tracking-[0.12em] mb-1">IP / Instance</div>
                                <div className="text-sm font-bold text-amber-300 font-mono">{ipAddress || instanceVal}</div>
                              </div>
                            )}
                          </div>
                          {/* Additional system details from parsed sections */}
                          {(() => {
                            const sysLines = [...(sectionMap['Affected System'] || []), ...(sectionMap['Target'] || [])];
                            const sysKVs = sysLines.filter((l): l is { type: 'kv'; key: string; value: string } => l.type === 'kv')
                              .filter(l => !shownKeys.has(l.key.toLowerCase()) && l.value.length > 1);
                            if (sysKVs.length === 0) return null;
                            return (
                              <div className="px-4 py-2 border-t border-[color:var(--argus-border)] grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {sysKVs.map((kv, i) => (
                                  <div key={i}>
                                    <div className="text-[9px] text-ink/25 uppercase tracking-wider">{kv.key}</div>
                                    <div className="text-[12px] text-ink/70 font-mono truncate">{kv.value}</div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Section-based rendering — Root Cause, Investigation, Remediation, Impact */}
                      {sectionOrder.filter(s => !skipSections.has(s)).map((sectionName, si) => {
                        const sLines = sectionMap[sectionName] || [];
                        if (sLines.length === 0) return null;
                        const style = sectionStyles[sectionName] || defaultStyle;

                        return (
                          <div key={si} className={clsx('rounded-xl border overflow-hidden', style.border)}>
                            <div className={clsx('px-4 py-2.5 border-b flex items-center gap-2', style.bg, style.border)}>
                              <span className="text-sm">{style.icon}</span>
                              <span className={clsx('text-[11px] font-bold uppercase tracking-[0.1em] font-display', style.accent)}>{sectionName}</span>
                            </div>
                            <div className="px-4 py-3 space-y-2 bg-white">
                              {sLines.map((line, li) => {
                                if (line.type === 'kv') {
                                  // Filter noise
                                  if (shownKeys.has(line.key.toLowerCase()) || line.value.length <= 1) return null;
                                  return (
                                    <div key={li} className="flex items-start gap-3 py-0.5">
                                      <span className="text-[11px] font-bold text-stone-400 min-w-[110px] shrink-0 uppercase tracking-wider font-display">{line.key}</span>
                                      <span className="text-[13px] text-stone-800 font-mono leading-relaxed break-all">{line.value}</span>
                                    </div>
                                  );
                                }
                                if (line.type === 'numbered') {
                                  return (
                                    <div key={li} className="flex gap-3 py-1">
                                      <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-[11px] font-bold text-[color:var(--argus-signal)]">{line.num}</span>
                                      <span className="text-[13px] text-stone-700 leading-relaxed font-body">{line.text}</span>
                                    </div>
                                  );
                                }
                                if (line.type === 'bullet') {
                                  return (
                                    <div key={li} className="flex gap-3 py-0.5">
                                      <span className="w-1.5 h-1.5 shrink-0 mt-2 rounded-full bg-stone-400" />
                                      <span className="text-[13px] text-stone-700 leading-relaxed font-body">{line.text}</span>
                                    </div>
                                  );
                                }
                                return <p key={li} className="text-[13px] text-stone-600 leading-relaxed font-body">{line.text}</p>;
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {/* Source + Impact/Urgency footer */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {incident.source && (
                          <div className="p-4 rounded-xl bg-gradient-to-b from-slate-50 to-white border border-stone-200">
                            <div className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.12em] mb-2 font-display">Source</div>
                            <div className="flex items-center gap-2">
                              <div className={clsx('w-5 h-5 rounded-md flex items-center justify-center', srcMeta.bg)}>
                                <SrcIcon size={10} className={srcMeta.color} />
                              </div>
                              <span className="text-sm font-bold text-stone-900">{srcMeta.label}</span>
                            </div>
                          </div>
                        )}
                        {incident.impact && (
                          <div className="p-4 rounded-xl bg-gradient-to-b from-slate-50 to-white border border-stone-200">
                            <div className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.12em] mb-2 font-display">Impact / Urgency</div>
                            <div className="text-sm font-bold text-stone-900">{incident.impact} <span className="text-stone-400 font-normal mx-1">/</span> {incident.urgency}</div>
                          </div>
                        )}
                      </div>

                      {/* Leftover extra lines */}
                      {extraLines.length > 0 && (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.12em] mb-2 font-display">Additional Context</div>
                          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-body">{extraLines.join('\n')}</p>
                        </div>
                      )}
                    </div>
                  );
                }

                // Regular manual description
                const hostMatch = desc.match(/^Host:\s*(.+)/m);
                const bodyText = hostMatch ? desc.replace(/^Host:\s*.+\n?/m, '').trim() : desc;
                return (
                  <div className="space-y-4">
                    {hostMatch && (
                      <div className="rounded-xl bg-obsidian text-ink border border-[color:var(--argus-border)] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[color:var(--argus-border)] flex items-center gap-2">
                          <Server size={12} className="text-amber-400" />
                          <span className="text-[10px] font-mono text-ink/40 uppercase tracking-wider">Affected System</span>
                        </div>
                        <div className="px-4 py-3">
                          <code className="text-sm font-mono font-bold text-amber-300">{hostMatch[1].trim()}</code>
                        </div>
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-body">{bodyText}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Resolution Notes */}
              {incident.resolutionNotes && (
                <div className="mt-5 rounded-xl overflow-hidden border border-emerald-200">
                  <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <h4 className="text-[11px] font-bold text-emerald-800 font-display uppercase tracking-[0.1em]">Resolution Notes</h4>
                    {incident.resolutionCode && (
                      <span className="ml-auto text-[10px] font-mono font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                        {incident.resolutionCode}
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-3.5 bg-white">
                    <p className="text-sm text-stone-700 leading-relaxed font-body">{incident.resolutionNotes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tabbed Section */}
            <div className="rounded-2xl overflow-hidden" style={{
              background: 'var(--argus-elevated)',
              border: '1px solid var(--argus-border)',
              backdropFilter: 'blur(8px)',
            }}>
              {/* Tab bar — horizontally scrollable on mobile */}
              <div className="overflow-x-auto scrollbar-none" style={{
                background: 'var(--argus-elevated)',
                borderBottom: '1px solid var(--argus-border)',
              }}>
                <div className="flex gap-0 min-w-max px-2 sm:px-6">
                  {tabs.map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="flex items-center gap-1.5 px-3 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-all -mb-px shrink-0 whitespace-nowrap"
                        style={isActive ? {
                          borderColor: '#F59E0B',
                          color: 'var(--argus-amber)',
                          background: 'var(--argus-elevated)',
                        } : {
                          borderColor: 'transparent',
                          color: 'var(--argus-muted)',
                        }}
                      >
                        <TabIcon size={13} style={tab.accent && !isActive ? { color: '#F59E0B' } : {}} />
                        <span className="hidden xs:inline sm:inline">{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                          <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={
                            isActive
                              ? { background: 'rgba(245,158,11,0.25)', color: 'var(--argus-amber)' }
                              : { background: 'var(--argus-elevated)', color: 'var(--argus-muted)' }
                          }>
                            {tab.count}
                          </span>
                        )}
                        {tab.accent && !isActive && (
                          <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab content */}
              <div className="p-6">

                {/* === Overview Tab — PagerDuty-style alert details + responders === */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Related Alerts Table */}
                    {incident.relatedAlerts?.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle size={14} className="text-amber-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--argus-ink)' }}>
                            Triggered Alerts ({incident.relatedAlerts.length})
                          </h4>
                        </div>
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--argus-border)' }}>
                          <div className="overflow-x-auto scrollbar-none">
                          <div className="min-w-[520px]">
                          <div className="px-4 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--argus-elevated)', borderBottom: '1px solid var(--argus-border)', color: 'var(--argus-muted)' }}>
                            <span className="col-span-1">Sev</span>
                            <span className="col-span-4">Alert</span>
                            <span className="col-span-3">Instance</span>
                            <span className="col-span-2">Fired</span>
                            <span className="col-span-2">Status</span>
                          </div>
                          {incident.relatedAlerts.slice(0, 10).map((alert: any, i: number) => {
                            const al = (() => { try { return JSON.parse(alert.labels || '{}'); } catch { return {}; } })();
                            const aa = (() => { try { return JSON.parse(alert.annotations || '{}'); } catch { return {}; } })();
                            const sev = alertSeverityStyle(alert.severity || al.severity || 'info');
                            return (
                              <div key={alert.id || i}>
                                <div className="px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm transition-colors" style={{ borderBottom: '1px solid var(--argus-border)' }}>
                                  <div className="col-span-1">
                                    <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border', sev.badge)}>
                                      {(alert.severity || al.severity || 'INFO').slice(0, 4)}
                                    </span>
                                  </div>
                                  <div className="col-span-4 truncate font-medium text-xs" style={{ color: 'var(--argus-ink)' }}>{alert.name || al.alertname || 'Unknown'}</div>
                                  <div className="col-span-3 truncate font-mono text-[11px]" style={{ color: 'var(--argus-muted)' }}>{al.instance || '\u2014'}</div>
                                  <div className="col-span-2 text-[11px] font-mono" style={{ color: 'var(--argus-dim)' }}>{alert.firedAt ? relativeTime(alert.firedAt) : '\u2014'}</div>
                                  <div className="col-span-2">
                                    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                                      alert.status === 'FIRING' ? 'bg-red-50 text-red-600' : alert.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
                                    )}>
                                      <div className={clsx('w-1.5 h-1.5 rounded-full', alert.status === 'FIRING' ? 'bg-red-500 animate-pulse' : alert.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-amber-500')} />
                                      {alert.status || 'FIRING'}
                                    </span>
                                  </div>
                                </div>
                                {/* Custom Details (expand first alert by default) */}
                                {i === 0 && Object.keys(al).length > 0 && (
                                  <div className="bg-obsidian text-ink border border-[color:var(--argus-border)] mx-4 mb-3 rounded-xl overflow-hidden">
                                    <div className="px-4 py-2.5 border-b border-[color:var(--argus-border)] flex items-center gap-2">
                                      <Terminal size={12} className="text-ink/30" />
                                      <span className="text-[10px] font-mono text-ink/40 uppercase tracking-wider">Custom Details</span>
                                      {(aa.dashboard || aa.dashboard_url || aa.grafana_dashboard) && (
                                        <a href={aa.dashboard || aa.dashboard_url || aa.grafana_dashboard} target="_blank" rel="noopener noreferrer"
                                          className="ml-auto text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1">
                                          <ExternalLink size={10} /> Open Grafana
                                        </a>
                                      )}
                                    </div>
                                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {/* Labels */}
                                      <div>
                                        <p className="text-[9px] font-bold text-ink/25 uppercase tracking-[0.12em] mb-2">Labels</p>
                                        <div className="space-y-1">
                                          {Object.entries(al).slice(0, 15).map(([k, v]) => (
                                            <div key={k} className="flex items-start gap-2 text-[11px]">
                                              <span className={clsx('font-mono shrink-0', k === 'alertname' ? 'text-amber-400 font-bold' : k === 'severity' ? alertSeverityStyle(String(v)).text : 'text-ink/40')}>{k}</span>
                                              <span className="text-ink/70 font-mono break-all">{String(v)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      {/* Annotations */}
                                      <div>
                                        <p className="text-[9px] font-bold text-ink/25 uppercase tracking-[0.12em] mb-2">Annotations</p>
                                        <div className="space-y-1">
                                          {Object.entries(aa).map(([k, v]) => (
                                            <div key={k} className="flex items-start gap-2 text-[11px]">
                                              <span className="text-ink/40 font-mono shrink-0">{k}</span>
                                              {(k === 'runbook_url' || k === 'dashboard' || k === 'dashboard_url') ? (
                                                <a href={String(v)} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 font-mono break-all underline">{String(v).substring(0, 60)}...</a>
                                              ) : (
                                                <span className="text-ink/70 font-mono break-all">{String(v)}</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    {/* Source info */}
                                    <div className="px-4 py-2.5 border-t border-[color:var(--argus-border)] flex items-center gap-4 text-[10px] font-mono text-ink/30">
                                      <span>source: {incident.source || 'PROMETHEUS'}</span>
                                      <span>alert_id: {alert.alertId || '\u2014'}</span>
                                      {al.job && <span>job: {al.job}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>{/* /min-w */}
                        </div>{/* /overflow-x-auto */}
                        </div>
                      </div>
                    )}

                    {/* Responders */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Users size={14} className="text-amber-500" />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--argus-ink)' }}>Responders</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl p-4" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--argus-muted)' }}>Assignee</p>
                          {incident.assignedTo ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.20)' }}>
                                <span className="text-sm font-bold" style={{ color: 'var(--argus-amber)' }}>{getInitials(incident.assignedTo.firstName, incident.assignedTo.lastName)}</span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>{incident.assignedTo.firstName} {incident.assignedTo.lastName}</p>
                                <p className="text-[11px] font-mono" style={{ color: 'var(--argus-muted)' }}>{incident.assignedTo.email}</p>
                                <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(245,158,11,0.25)' }}>Primary Responder</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2" style={{ color: 'var(--argus-muted)' }}>
                              <User2 size={16} /><span className="text-sm">Unassigned</span>
                              {isOpen && <button onClick={() => setShowAssignModal(true)} className="ml-auto text-xs text-amber-400 hover:text-amber-300 font-medium">Assign</button>}
                            </div>
                          )}
                        </div>
                        <div className="rounded-xl p-4" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--argus-muted)' }}>Assignment Group</p>
                          {incident.assignmentGroup ? (
                            <div>
                              <p className="text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>{incident.assignmentGroup.name}</p>
                              <div className="flex items-center gap-1.5 mt-2">
                                <Users size={12} style={{ color: 'var(--argus-dim)' }} />
                                <span className="text-xs" style={{ color: 'var(--argus-muted)' }}>Response team</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm" style={{ color: 'var(--argus-muted)' }}>No team assigned</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Linked Changes & Problems */}
                    {((incident.linkedChanges?.length || 0) + (incident.linkedProblems?.length || 0)) > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <GitBranch size={14} className="text-amber-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--argus-ink)' }}>Linked ITSM Records</h4>
                        </div>
                        <div className="space-y-2">
                          {incident.linkedChanges?.map((lc: any) => (
                            <div key={lc.change?.id} onClick={() => navigate(`/changes/${lc.change?.id}`)}
                              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.20)' }}>
                              <GitBranch size={14} style={{ color: 'var(--argus-signal)' }} />
                              <span className="font-mono text-xs font-bold" style={{ color: 'var(--argus-signal)' }}>{lc.change?.number}</span>
                              <span className="text-xs flex-1 truncate" style={{ color: 'var(--argus-ink)' }}>{lc.change?.shortDescription}</span>
                              <span className="text-[10px] font-bold" style={{ color: 'var(--argus-muted)' }}>{lc.change?.state}</span>
                              <ChevronRight size={14} style={{ color: 'var(--argus-dim)' }} />
                            </div>
                          ))}
                          {incident.linkedProblems?.map((lp: any) => (
                            <div key={lp.problem?.id} onClick={() => navigate(`/problems/${lp.problem?.id}`)}
                              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.20)' }}>
                              <AlertTriangle size={14} style={{ color: 'var(--argus-signal)' }} />
                              <span className="font-mono text-xs font-bold" style={{ color: 'var(--argus-signal)' }}>{lp.problem?.number}</span>
                              <span className="text-xs flex-1 truncate" style={{ color: 'var(--argus-ink)' }}>{lp.problem?.shortDescription}</span>
                              <span className="text-[10px] font-bold" style={{ color: 'var(--argus-muted)' }}>{lp.problem?.state}</span>
                              <ChevronRight size={14} style={{ color: 'var(--argus-dim)' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-4 rounded-xl" style={{ background: 'var(--argus-elevated)', border: '1px dashed rgba(255,255,255,0.10)' }}>
                        <Link2 size={14} style={{ color: 'var(--argus-dim)' }} />
                        <span className="text-xs" style={{ color: 'var(--argus-muted)' }}>No linked changes or problems</span>
                      </div>
                    )}

                    {/* Past Similar Incidents (from live context) */}
                    {liveCtx?.pastIncidents?.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Clock size={14} className="text-amber-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--argus-ink)' }}>Past Similar Incidents</h4>
                          <span className="text-[10px] ml-1" style={{ color: 'var(--argus-muted)' }}>last 30 days</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {liveCtx.pastIncidents.map((pi: any) => (
                            <button key={pi.id} onClick={() => navigate(`/incidents/${pi.id}`)}
                              className="text-left p-3.5 rounded-xl transition-all group"
                              style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--argus-muted)' }}>{pi.number}</span>
                                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded',
                                  pi.priority === 'P1' ? 'bg-red-100 text-red-700' : pi.priority === 'P2' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-[color:var(--argus-signal)]',
                                )}>{pi.priority}</span>
                                <span className="text-[10px] font-medium ml-auto flex items-center gap-1" style={{ color: 'var(--argus-emerald)' }}>
                                  <CheckCircle2 size={10} /> {pi.state}
                                </span>
                              </div>
                              <p className="text-xs font-medium line-clamp-1 transition-colors" style={{ color: 'var(--argus-ink)' }}>{pi.shortDescription}</p>
                              {pi.resolvedAt && <p className="text-[10px] mt-1 font-mono" style={{ color: 'var(--argus-dim)' }}>resolved {relativeTime(pi.resolvedAt)}</p>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* === Timeline / Activity Tab === */}
                {activeTab === 'timeline' && (
                  <div className="space-y-0">
                    {timeline.length === 0 ? (
                      <div className="text-center py-12">
                        <Activity size={32} className="mx-auto text-stone-200 mb-3" />
                        <p className="text-sm text-stone-400 font-body">No activity recorded yet</p>
                      </div>
                    ) : (
                      <div className="relative">
                        {/* Timeline connector line */}
                        <div className="absolute left-[15px] top-2 bottom-2 w-px" style={{ background: 'var(--argus-elevated)' }} />

                        {timeline.map((entry: any, idx: number) => {
                          const isLast = idx === timeline.length - 1;
                          const actionColors: Record<string, string> = {
                            CREATED: '#7C3AED',
                            STATE_CHANGE: '#4F46E5',
                            ASSIGNED: '#059669',
                            NOTE_ADDED: '#D97706',
                            ESCALATED: '#DC2626',
                            RESOLVED: '#059669',
                            CLOSED: '#A8A29E',
                            UPDATED: '#4F46E5',
                          };
                          const dotColor = actionColors[entry.action] || '#A8A29E';
                          const performer = entry.performedBy
                            ? `${entry.performedBy.firstName} ${entry.performedBy.lastName}`
                            : 'System';

                          return (
                            <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                              {/* Dot */}
                              <div className="relative z-10 shrink-0">
                                <div
                                  className="w-[30px] h-[30px] rounded-full border-2 flex items-center justify-center"
                                  style={{ borderColor: dotColor, background: 'var(--argus-elevated)' }}
                                >
                                  <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: dotColor }}
                                  />
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 pt-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium font-body" style={{ color: 'var(--argus-ink)' }}>
                                      {entry.description || entry.action?.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-xs mt-0.5 font-body" style={{ color: 'var(--argus-muted)' }}>
                                      by {performer}
                                    </p>
                                  </div>
                                  <span className="text-[11px] font-mono shrink-0 tabular-nums" style={{ color: 'var(--argus-dim)' }}>
                                    {relativeTime(entry.createdAt)}
                                  </span>
                                </div>
                                {entry.metadata && typeof entry.metadata === 'object' && Object.keys(entry.metadata).length > 0 && (
                                  <div className="mt-2 text-xs rounded-lg px-3 py-2 font-mono" style={{ background: 'var(--argus-elevated)', color: 'var(--argus-muted)' }}>
                                    {Object.entries(entry.metadata).map(([k, v]) => (
                                      <span key={k} className="mr-3">
                                        <span style={{ color: 'var(--argus-muted)' }}>{k}:</span>{' '}
                                        <span style={{ color: 'var(--argus-muted)' }}>{String(v)}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* === Work Notes Tab === */}
                {activeTab === 'worknotes' && (
                  <div className="space-y-4">
                    {/* Notes list (using timeline entries that are notes, or show placeholder) */}
                    {timeline.filter((e: any) => e.action === 'NOTE_ADDED').length === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare size={32} className="mx-auto text-stone-200 mb-3" />
                        <p className="text-sm text-stone-400 font-body">No work notes yet. Add the first one below.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {timeline
                          .filter((e: any) => e.action === 'NOTE_ADDED')
                          .map((note: any) => {
                            const author = note.performedBy
                              ? `${note.performedBy.firstName} ${note.performedBy.lastName}`
                              : 'System';
                            const initials = note.performedBy
                              ? getInitials(note.performedBy.firstName, note.performedBy.lastName)
                              : 'SY';
                            const isInternal = note.metadata?.internal === true;

                            return (
                              <div key={note.id} className="flex gap-3">
                                {/* Avatar */}
                                <div className="shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-amber-700">{initials}</span>
                                  </div>
                                </div>

                                {/* Note bubble */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold" style={{ color: 'var(--argus-ink)' }}>{author}</span>
                                    {isInternal && (
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                        Internal
                                      </span>
                                    )}
                                    <span className="text-[10px] text-stone-400 font-mono tabular-nums">
                                      {relativeTime(note.createdAt)}
                                    </span>
                                  </div>
                                  <div className="rounded-xl rounded-tl-sm px-4 py-3" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                                    <p className="text-sm font-body whitespace-pre-wrap" style={{ color: 'var(--argus-ink)' }}>
                                      {note.description || note.metadata?.content || ''}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Add note input */}
                    <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={noteInternal}
                            onChange={(e) => setNoteInternal(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-stone-300 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="text-[11px] text-stone-500 font-medium">Internal note</span>
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                          placeholder="Add a work note..."
                          className="input-field flex-1 text-sm"
                        />
                        <button
                          onClick={handleAddNote}
                          disabled={!noteContent.trim() || addWorkNote.isPending}
                          className="bg-amber-500 text-stone-950 hover:bg-amber-600 px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {addWorkNote.isPending ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* === Live Metrics Tab === */}
                {activeTab === 'livemetrics' && (
                  <div className="space-y-6">
                    {liveCtxLoading ? (
                      <div className="flex flex-col items-center py-12">
                        <Loader2 size={24} className="text-amber-500 animate-spin mb-3" />
                        <p className="text-sm text-stone-500 font-body">Fetching live metrics from Prometheus...</p>
                        <p className="text-[10px] text-stone-400 mt-1 font-mono">SSH → remote host → PromQL batch queries</p>
                      </div>
                    ) : !liveCtx?.metrics?.available ? (
                      <div className="text-center py-12">
                        <Gauge size={32} className="mx-auto text-stone-200 mb-3" />
                        <p className="text-sm text-stone-500 font-medium font-body">
                          {liveCtx?.metrics?.error ? 'Prometheus unreachable' : 'No live metrics available'}
                        </p>
                        <p className="text-xs text-stone-400 mt-1 font-body">
                          {liveCtx?.metrics?.error || 'This incident may not be linked to a monitored host'}
                        </p>
                        <button onClick={() => refetchLive()} className="mt-4 text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 mx-auto">
                          <RefreshCw size={12} /> Retry
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* ── HostDown Banner ── */}
                        {liveCtx.alertContext?.alertName?.toLowerCase().includes('hostdown') && (
                          <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-red-50 border border-red-200">
                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                              <AlertCircle size={20} className="text-red-600" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-red-800">Host is DOWN</p>
                              <p className="text-xs text-red-600 mt-0.5">
                                {liveCtx.alertContext?.ip || 'Unknown IP'} is not responding. Metrics below reflect the last known state before the host went down.
                              </p>
                            </div>
                            <span className="ml-auto px-3 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider animate-pulse">Unreachable</span>
                          </div>
                        )}

                        {/* ── Gauge Grid ── */}
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Cpu size={14} className="text-amber-500" />
                            <h4 className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--argus-ink)' }}>System Health</h4>
                            {liveCtx.metrics?.osType && (
                              <span className={clsx('text-[9px] font-bold px-2 py-0.5 rounded border',
                                liveCtx.metrics.osType === 'windows' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-stone-100 text-stone-600 border-stone-200',
                              )}>
                                {liveCtx.metrics.osType === 'windows' ? 'WINDOWS' : 'LINUX'}
                              </span>
                            )}
                            <span className="ml-auto text-[10px] font-mono text-stone-400 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Live · {liveCtx.alertContext?.instance || liveCtx.alertContext?.ip || 'unknown'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 rounded-xl px-6 py-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                            <LiveGauge value={liveCtx.metrics.cpu?.usagePct ?? 0} label="CPU Usage" sublabel={`${liveCtx.metrics.cpu?.cores || '?'} cores`} color="#F59E0B" />
                            <LiveGauge value={liveCtx.metrics.memory?.usedPct ?? 0} label="Memory" sublabel={liveCtx.metrics.memory?.totalBytes ? formatBytes(liveCtx.metrics.memory.totalBytes) : ''} color="#6366F1" />
                            <LiveGauge
                              value={Math.min((liveCtx.metrics.load?.m5 || 0) / Math.max(liveCtx.metrics.cpu?.cores || 1, 1) * 100, 100)}
                              label="Load Avg"
                              sublabel={`${(liveCtx.metrics.load?.m1 || 0).toFixed(2)} / ${(liveCtx.metrics.load?.m5 || 0).toFixed(2)} / ${(liveCtx.metrics.load?.m15 || 0).toFixed(2)}`}
                              color="#8B5CF6"
                            />
                            {liveCtx.metrics.filesystems?.[0] ? (
                              <LiveGauge value={liveCtx.metrics.filesystems[0].usedPct ?? 0} label="Root Disk" sublabel={`${formatBytes(liveCtx.metrics.filesystems[0].totalBytes || 0)} total`} color="#059669" />
                            ) : (
                              <LiveGauge value={0} label="Disk" sublabel="n/a" color="#059669" />
                            )}
                          </div>
                        </div>

                        {/* ── System Info Terminal ── */}
                        {liveCtx.metrics.sysInfo && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Server size={14} className="text-amber-500" />
                              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-display">System Information</h4>
                            </div>
                            <div className="bg-obsidian text-ink border border-[color:var(--argus-border)] rounded-xl overflow-hidden">
                              <div className="px-4 py-2.5 border-b border-[color:var(--argus-border)] flex items-center gap-2">
                                <div className="flex gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                                </div>
                                <span className="text-[10px] font-mono text-ink/30 ml-2">{liveCtx.alertContext?.hostname || liveCtx.alertContext?.instance || ''}</span>
                              </div>
                              <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] font-mono">
                                {liveCtx.metrics.sysInfo.hostname && (
                                  <div><span className="text-ink/30">hostname </span><span className="text-amber-400">{liveCtx.metrics.sysInfo.hostname}</span></div>
                                )}
                                {liveCtx.metrics.sysInfo.os && (
                                  <div><span className="text-ink/30">os       </span><span className="text-ink/70">{liveCtx.metrics.sysInfo.os}</span></div>
                                )}
                                {liveCtx.metrics.sysInfo.kernel && (
                                  <div><span className="text-ink/30">kernel   </span><span className="text-ink/70">{liveCtx.metrics.sysInfo.kernel}</span></div>
                                )}
                                {liveCtx.metrics.sysInfo.arch && (
                                  <div><span className="text-ink/30">arch     </span><span className="text-ink/70">{liveCtx.metrics.sysInfo.arch}</span></div>
                                )}
                                {(liveCtx.metrics.sysInfo.uptimeSeconds || 0) > 0 && (
                                  <div><span className="text-ink/30">uptime   </span><span className="text-emerald-400">{formatDuration(liveCtx.metrics.sysInfo.uptimeSeconds * 1000)}</span></div>
                                )}
                                {liveCtx.metrics.cpu?.cores && (
                                  <div><span className="text-ink/30">cpus     </span><span className="text-ink/70">{liveCtx.metrics.cpu.cores}</span></div>
                                )}
                                {liveCtx.metrics.memory?.totalBytes && (
                                  <div><span className="text-ink/30">memory   </span><span className="text-ink/70">{formatBytes(liveCtx.metrics.memory.totalBytes)}</span></div>
                                )}
                                {liveCtx.alertContext?.ip && (
                                  <div><span className="text-ink/30">ip       </span><span className="text-ink/70">{liveCtx.alertContext.ip}</span></div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── Filesystems — hide for ssh/memory/network alerts ── */}
                        {liveCtx.metrics.filesystems?.length > 0 && (() => {
                          const focus = alertMetricFocus(liveCtx.alertContext?.alertName || incident.sourceAlertName);
                          return focus !== 'ssh' && focus !== 'memory' && focus !== 'network';
                        })() && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <HardDrive size={14} className="text-amber-500" />
                              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-display">Filesystems</h4>
                              {typeof liveCtx.metrics.diskIOPS === 'number' && liveCtx.metrics.diskIOPS > 0 && (
                                <span className="ml-auto text-[10px] text-stone-400 font-mono">
                                  IOPS: {liveCtx.metrics.diskIOPS.toFixed(0)}/s
                                </span>
                              )}
                            </div>
                            <div className="rounded-xl border border-stone-200 overflow-hidden">
                              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                <span className="col-span-4">Mount</span>
                                <span className="col-span-2 text-right">Size</span>
                                <span className="col-span-2 text-right">Used</span>
                                <span className="col-span-4">Usage</span>
                              </div>
                              {liveCtx.metrics.filesystems.map((fs: any, i: number) => (
                                <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-stone-100 last:border-0 items-center">
                                  <span className="col-span-4 font-mono text-xs text-stone-700 truncate">{fs.mountpoint || fs.mount}</span>
                                  <span className="col-span-2 text-right font-mono text-xs text-stone-500">{formatBytes(fs.totalBytes || fs.size || 0)}</span>
                                  <span className="col-span-2 text-right font-mono text-xs text-stone-500">{formatBytes(fs.usedBytes || 0)}</span>
                                  <div className="col-span-4 flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                                      <div
                                        className={clsx(
                                          'h-full rounded-full transition-all duration-700',
                                          (fs.usedPct || 0) > 90 ? 'bg-red-500' : (fs.usedPct || 0) > 75 ? 'bg-amber-500' : 'bg-emerald-500',
                                        )}
                                        style={{ width: `${Math.min(fs.usedPct || 0, 100)}%` }}
                                      />
                                    </div>
                                    <span className={clsx(
                                      'text-[11px] font-mono font-bold tabular-nums w-10 text-right',
                                      (fs.usedPct || 0) > 90 ? 'text-red-600' : (fs.usedPct || 0) > 75 ? 'text-amber-600' : 'text-stone-600',
                                    )}>
                                      {(fs.usedPct || 0).toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── Network Interfaces — filtered by alert focus ── */}
                        {(() => {
                          const focus = alertMetricFocus(liveCtx.alertContext?.alertName || incident.sourceAlertName);
                          // For SSH/memory/disk alerts, skip the interface table — not relevant
                          if (focus === 'ssh' || focus === 'memory' || focus === 'disk') return null;
                          const allIfaces = liveCtx.metrics.interfaces || [];
                          if (allIfaces.length === 0) return null;
                          const filtered = filterPhysicalInterfaces(allIfaces);
                          if (filtered.length === 0) return null;
                          return (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Wifi size={14} className="text-amber-500" />
                                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-display">
                                  Network Interfaces
                                </h4>
                                {allIfaces.length > filtered.length && (
                                  <span className="ml-auto text-[10px] text-stone-400 font-mono">
                                    {filtered.length} of {allIfaces.length} shown · virtual interfaces hidden
                                  </span>
                                )}
                              </div>
                              <div className="rounded-xl border border-stone-200 overflow-hidden">
                                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                  <span className="col-span-3">Interface</span>
                                  <span className="col-span-2">Status</span>
                                  <span className="col-span-3 text-right">RX Rate</span>
                                  <span className="col-span-3 text-right">TX Rate</span>
                                  <span className="col-span-1 text-right">Err</span>
                                </div>
                                {filtered.map((ifc: any, i: number) => (
                                  <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-stone-100 last:border-0 items-center">
                                    <span className="col-span-3 font-mono text-xs text-stone-700">{ifc.name || ifc.device}</span>
                                    <span className="col-span-2">
                                      <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded',
                                        ifc.status === 'UP' || ifc.operstate === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500',
                                      )}>
                                        {ifc.status || ifc.operstate || '—'}
                                      </span>
                                    </span>
                                    <span className="col-span-3 text-right font-mono text-xs text-emerald-600">↓ {formatBps(ifc.rxBps || ifc.rxBytes || 0)}</span>
                                    <span className="col-span-3 text-right font-mono text-xs text-blue-600">↑ {formatBps(ifc.txBps || ifc.txBytes || 0)}</span>
                                    <span className="col-span-1 text-right font-mono text-[10px] text-stone-400">
                                      {((ifc.rxErrors || 0) + (ifc.txErrors || 0)) > 0
                                        ? <span className="text-red-500">{(ifc.rxErrors || 0) + (ifc.txErrors || 0)}</span>
                                        : '0'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* ── Firing Alerts from AlertManager ── */}
                        {liveCtx.firingAlerts?.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <AlertCircle size={14} className="text-red-500" />
                              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-display">
                                Firing Alerts ({liveCtx.firingAlerts.length})
                              </h4>
                              <span className="text-[10px] text-stone-400 font-mono ml-auto">from AlertManager</span>
                            </div>
                            <div className="space-y-2">
                              {liveCtx.firingAlerts.slice(0, 15).map((fa: any, i: number) => {
                                const sev = alertSeverityStyle(fa.severity || fa.labels?.severity || 'info');
                                return (
                                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50/50 transition-colors">
                                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: sev.dot }} />
                                    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded border', sev.badge)}>
                                      {(fa.severity || fa.labels?.severity || 'INFO').slice(0, 4).toUpperCase()}
                                    </span>
                                    <span className="text-xs font-medium text-stone-800 flex-1 truncate">{fa.alertname || fa.labels?.alertname || 'Unknown'}</span>
                                    <span className="text-[10px] text-stone-400 font-mono">{fa.instance || fa.labels?.instance || ''}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Refresh */}
                        <div className="flex justify-center pt-2">
                          <button
                            onClick={() => refetchLive()}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                          >
                            <RefreshCw size={12} className={liveCtxLoading ? 'animate-spin' : ''} />
                            Refresh Metrics
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* === Related Tab === */}
                {activeTab === 'related' && (
                  <div className="space-y-6">
                    {/* Related Alerts */}
                    {incident.relatedAlerts?.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Bell size={14} className="text-amber-500" />
                          <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-display">
                            Related Alerts ({incident.relatedAlerts.length})
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {incident.relatedAlerts.map((alert: any, i: number) => {
                            const al = (() => { try { return JSON.parse(alert.labels || '{}'); } catch { return {}; } })();
                            const sev = alertSeverityStyle(alert.severity || al.severity || 'info');
                            return (
                              <div key={alert.id || i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-stone-200 bg-white hover:border-amber-200 transition-colors">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sev.dot }} />
                                <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0', sev.badge)}>
                                  {(alert.severity || al.severity || 'INFO').slice(0, 4).toUpperCase()}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-stone-800 truncate">{alert.name || al.alertname || 'Unknown Alert'}</p>
                                  <p className="text-[10px] text-stone-400 font-mono">{al.instance || '—'} · {alert.firedAt ? relativeTime(alert.firedAt) : '—'}</p>
                                </div>
                                <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                                  alert.status === 'FIRING' ? 'bg-red-50 text-red-600' : alert.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
                                )}>
                                  {alert.status || 'FIRING'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Linked Changes */}
                    {incident.linkedChanges?.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <GitBranch size={14} className="text-[color:var(--argus-signal)]" />
                          <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-display">
                            Linked Changes ({incident.linkedChanges.length})
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {incident.linkedChanges.map((lc: any) => (
                            <div key={lc.change?.id} onClick={() => navigate(`/changes/${lc.change?.id}`)}
                              className="flex items-center gap-3 p-3.5 rounded-xl border border-indigo-100 bg-[color:var(--argus-signal-dim)]/30 hover:border-[color:var(--argus-signal)]/30 cursor-pointer transition-colors">
                              <GitBranch size={14} className="text-[color:var(--argus-signal)] shrink-0" />
                              <span className="font-mono text-xs text-[color:var(--argus-signal)] font-bold shrink-0">{lc.change?.number}</span>
                              <span className="text-xs text-stone-700 flex-1 truncate">{lc.change?.shortDescription}</span>
                              <span className="text-[10px] font-bold text-stone-500 shrink-0">{lc.change?.state}</span>
                              <ChevronRight size={14} className="text-stone-300 shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Linked Problems */}
                    {incident.linkedProblems?.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle size={14} className="text-violet-500" />
                          <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-display">
                            Linked Problems ({incident.linkedProblems.length})
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {incident.linkedProblems.map((lp: any) => (
                            <div key={lp.problem?.id} onClick={() => navigate(`/problems/${lp.problem?.id}`)}
                              className="flex items-center gap-3 p-3.5 rounded-xl border border-violet-100 bg-violet-50/30 hover:border-violet-300 cursor-pointer transition-colors">
                              <AlertTriangle size={14} className="text-violet-500 shrink-0" />
                              <span className="font-mono text-xs text-violet-700 font-bold shrink-0">{lp.problem?.number}</span>
                              <span className="text-xs text-stone-700 flex-1 truncate">{lp.problem?.shortDescription}</span>
                              <span className="text-[10px] font-bold text-stone-500 shrink-0">{lp.problem?.state}</span>
                              <ChevronRight size={14} className="text-stone-300 shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Config Item */}
                    {incident.configItem && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Server size={14} className="text-emerald-500" />
                          <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-display">Configuration Item</h4>
                        </div>
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                              <Server size={18} className="text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-stone-800">{incident.configItem.hostname || incident.configItem.name}</p>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-500 font-mono">
                                {incident.configItem.ciType && <span>{incident.configItem.ciType}</span>}
                                {incident.configItem.ipAddress && <span>{incident.configItem.ipAddress}</span>}
                                {incident.configItem.environment && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold">{incident.configItem.environment}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick-link action row */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
                      <button
                        onClick={() => setShowCreateChangeModal(true)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                        style={{ background: '#F5F3FF', color: '#7C3AED', borderColor: '#DDD6FE' }}
                      >
                        <GitBranch size={13} /> Create Change Request
                      </button>
                      <button
                        onClick={() => setShowSubIncidentModal(true)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                        style={{ background: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }}
                      >
                        <Layers size={13} /> Create Sub-Incident
                      </button>
                      <button
                        onClick={() => setShowLinkProblemModal(true)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                        style={{ background: '#F5F3FF', color: '#6D28D9', borderColor: '#DDD6FE' }}
                      >
                        <AlertTriangle size={13} /> Link Problem
                      </button>
                    </div>

                    {/* Empty state */}
                    {!(incident.relatedAlerts?.length || incident.linkedChanges?.length || incident.linkedProblems?.length || incident.configItem) && (
                      <div className="text-center py-10">
                        <Link2 size={28} className="mx-auto text-stone-200 mb-3" />
                        <p className="text-sm text-stone-500 font-medium font-body">No related items linked yet</p>
                        <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto font-body">
                          Create a Change Request or Sub-Incident above. Alert correlations appear automatically when detected.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* === AI Agent Tab — Mission Control Terminal === */}
                {activeTab === 'aiagent' && (
                  <div className="space-y-5 -mx-6 -mb-6">
                    {/* Terminal header bar */}
                    <div className="mx-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                          <Brain size={18} className="text-ink" />
                        </div>
                        <div>
                          <h3 className="text-sm font-display font-bold text-stone-900">AI Resolution Agent</h3>
                          <p className="text-[11px] text-stone-400 font-body">
                            Intelligent analysis powered by GPT-4o — resolution steps, configuration changes & verification
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => refetchAI()}
                        disabled={aiResLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={aiResLoading ? 'animate-spin' : ''} />
                        {aiResLoading ? 'Analyzing...' : 'Re-analyze'}
                      </button>
                    </div>

                    {/* Loading state */}
                    {aiResLoading && (
                      <div className="mx-6 rounded-xl bg-obsidian text-ink p-8 text-center">
                        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)]">
                          <Loader2 size={18} className="text-amber-400 animate-spin" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-ink/90">AI Agent is analyzing this incident...</p>
                            <p className="text-[11px] text-ink/40 mt-0.5 font-mono">Correlating incident data, related patterns & resolution history</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI Analysis Content */}
                    {!aiResLoading && aiResData && (
                      <>
                        {/* AI Summary — Dark terminal card */}
                        <div className="mx-6 rounded-xl bg-obsidian text-ink overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-[color:var(--argus-border)] flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                            </div>
                            <span className="text-[10px] font-mono text-ink/30 ml-2">argus-ai-agent — analysis</span>
                          </div>
                          <div className="p-5">
                            <div className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <Cpu size={14} className="text-amber-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest mb-1.5">AI Analysis Summary</p>
                                <p className="text-sm text-ink/85 leading-relaxed font-body">
                                  {aiResData.aiAnalysis}
                                </p>
                              </div>
                            </div>

                            {/* SLA Config quick view */}
                            {aiResData.slaConfig && (
                              <div className="mt-4 flex items-center gap-3 pt-3 border-t border-[color:var(--argus-border)]">
                                <Timer size={13} className="text-ink/30" />
                                <span className="text-[11px] font-mono text-ink/40">SLA Target:</span>
                                <span className="text-[11px] font-mono text-amber-400">
                                  Response {aiResData.slaConfig.response}m
                                </span>
                                <span className="text-ink/20">|</span>
                                <span className="text-[11px] font-mono text-amber-400">
                                  Resolution {aiResData.slaConfig.resolution >= 1440 ? `${aiResData.slaConfig.resolution / 60}h` : `${aiResData.slaConfig.resolution}m`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Resolution Steps */}
                        {aiResData.resolutionSteps?.length > 0 && (
                          <div className="mx-6">
                            <div className="flex items-center gap-2 mb-3">
                              <ListChecks size={15} className="text-amber-500" />
                              <h4 className="text-xs font-display font-bold text-stone-800 uppercase tracking-wider">Resolution Steps</h4>
                              <span className="text-[10px] font-mono text-stone-400 ml-auto">{aiResData.resolutionSteps.length} steps</span>
                            </div>
                            <div className="space-y-2.5">
                              {aiResData.resolutionSteps.map((step: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 hover:border-amber-200 transition-colors group"
                                >
                                  {/* Step number circle */}
                                  <div className="shrink-0">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm group-hover:shadow-amber-500/20 transition-shadow">
                                      <span className="text-xs font-display font-black text-ink">
                                        {step.step || idx + 1}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-sm font-semibold text-stone-800 font-display">{step.title}</p>
                                      {step.estimatedMinutes && (
                                        <span className="text-[10px] font-mono text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                                          ~{step.estimatedMinutes}m
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[12px] text-stone-500 leading-relaxed font-body">{step.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Configuration Changes — Terminal style */}
                        {aiResData.configChanges?.length > 0 && (
                          <div className="mx-6">
                            <div className="flex items-center gap-2 mb-3">
                              <Terminal size={15} className="text-amber-500" />
                              <h4 className="text-xs font-display font-bold text-stone-800 uppercase tracking-wider">Configuration Changes</h4>
                              <span className="text-[10px] font-mono text-stone-400 ml-auto">{aiResData.configChanges.length} changes</span>
                            </div>
                            <div className="rounded-xl bg-obsidian text-ink overflow-hidden border border-stone-800">
                              <div className="px-4 py-2 border-b border-[color:var(--argus-border)] flex items-center gap-2">
                                <Terminal size={12} className="text-ink/30" />
                                <span className="text-[10px] font-mono text-ink/30">configuration changes</span>
                              </div>
                              <div className="divide-y divide-white/[0.04]">
                                {aiResData.configChanges.map((cfg: any, idx: number) => (
                                  <div key={idx} className="px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <Wrench size={12} className="text-amber-400/70" />
                                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                                        {cfg.system}
                                      </span>
                                    </div>
                                    <p className="text-[12px] text-ink/60 mb-2 font-body">{cfg.change}</p>
                                    {cfg.command && (
                                      <div className="bg-[color:var(--argus-elevated)] rounded-lg px-3 py-2 flex items-center gap-2 group/cmd">
                                        <span className="text-amber-500/50 font-mono text-xs">$</span>
                                        <code className="text-[11px] font-mono text-emerald-400/80 flex-1 break-all">{cfg.command}</code>
                                        <button
                                          onClick={() => { navigator.clipboard.writeText(cfg.command); toast.success('Command copied'); }}
                                          className="opacity-0 group-hover/cmd:opacity-100 transition-opacity p-1 rounded hover:bg-[color:var(--argus-elevated)]"
                                          title="Copy command"
                                        >
                                          <Copy size={11} className="text-ink/40" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Verification Checklist */}
                        {aiResData.verificationChecklist?.length > 0 && (
                          <div className="mx-6">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 size={15} className="text-emerald-500" />
                              <h4 className="text-xs font-display font-bold text-stone-800 uppercase tracking-wider">Verification Checklist</h4>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 overflow-hidden">
                              {aiResData.verificationChecklist.map((item: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-3 px-4 py-3 border-b border-emerald-100 last:border-0 hover:bg-emerald-50/50 transition-colors"
                                >
                                  <div className="shrink-0 mt-0.5">
                                    <div className="w-5 h-5 rounded-md border-2 border-emerald-300 flex items-center justify-center bg-white">
                                      <span className="text-[9px] font-mono font-bold text-emerald-500">{idx + 1}</span>
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-medium text-stone-700 font-body">{item.item}</p>
                                    {item.command && (
                                      <div className="mt-1.5 bg-obsidian text-ink rounded-lg px-3 py-1.5 inline-flex items-center gap-2 group/v">
                                        <span className="text-amber-500/50 font-mono text-[10px]">$</span>
                                        <code className="text-[10px] font-mono text-emerald-400/80">{item.command}</code>
                                        <button
                                          onClick={() => { navigator.clipboard.writeText(item.command); toast.success('Copied'); }}
                                          className="opacity-0 group-hover/v:opacity-100 transition-opacity p-0.5 rounded hover:bg-[color:var(--argus-elevated)]"
                                        >
                                          <Copy size={10} className="text-ink/40" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Related Resolved Incidents */}
                        {aiResData.relatedIncidents?.length > 0 && (
                          <div className="mx-6 pb-6">
                            <div className="flex items-center gap-2 mb-3">
                              <GitBranch size={15} className="text-amber-500" />
                              <h4 className="text-xs font-display font-bold text-stone-800 uppercase tracking-wider">Similar Resolved Incidents</h4>
                              <span className="text-[10px] text-stone-400 font-body ml-1">
                                — Past incidents with similar category that were successfully resolved
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {aiResData.relatedIncidents.map((rel: any) => (
                                <button
                                  key={rel.id}
                                  onClick={() => navigate(`/incidents/${rel.id}`)}
                                  className="text-left p-3.5 rounded-xl border border-stone-200 bg-white hover:border-amber-200 hover:shadow-sm transition-all group"
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="font-mono text-[10px] font-bold text-stone-400">{rel.number}</span>
                                    <span className={clsx(
                                      'badge text-[9px]',
                                      rel.priority === 'P1' ? 'priority-p1' : rel.priority === 'P2' ? 'priority-p2' : rel.priority === 'P3' ? 'priority-p3' : 'priority-p4',
                                    )}>
                                      {rel.priority}
                                    </span>
                                    <span className="text-[10px] text-emerald-600 font-medium ml-auto flex items-center gap-1">
                                      <CheckCircle2 size={10} />
                                      Resolved
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium text-stone-700 line-clamp-1 group-hover:text-amber-700 transition-colors">
                                    {rel.shortDescription}
                                  </p>
                                  {rel.resolutionNotes && (
                                    <p className="text-[11px] text-stone-400 mt-1 line-clamp-1 font-body">
                                      {rel.resolutionNotes}
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Footer attribution */}
                        <div className="mx-6 pb-5 text-center">
                          <p className="text-[10px] text-stone-300 font-mono">
                            Analysis by WeCrew AI Agent — GPT-4o
                          </p>
                        </div>
                      </>
                    )}

                    {/* Empty state when no data and not loading */}
                    {!aiResLoading && !aiResData && (
                      <div className="mx-6 text-center py-12">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                          <Brain size={24} className="text-amber-400" />
                        </div>
                        <p className="text-sm font-medium text-stone-600 font-body">AI analysis not available</p>
                        <p className="text-xs text-stone-400 mt-1.5 font-body max-w-sm mx-auto">
                          Click "Re-analyze" to generate AI-powered resolution steps, configuration recommendations, and a verification checklist for this incident.
                        </p>
                        <button
                          onClick={() => refetchAI()}
                          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Brain size={15} />
                          Run AI Analysis
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ════════════════ Escalation Tab ════════════════ */}
                {activeTab === 'escalation' && (
                  <div className="space-y-5">
                    {/* Escalation Level Badge */}
                    {escData && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                          <Bell size={14} className="text-amber-600" />
                          <span className="text-xs font-bold text-amber-700">Current Level: L{escData.escalationLevel || 0}</span>
                        </div>
                        {/* Step indicator */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map((lvl) => (
                            <div key={lvl} className="flex items-center gap-1">
                              <div className={clsx(
                                'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all',
                                lvl <= (escData.escalationLevel || 0)
                                  ? 'bg-amber-500 border-amber-500 text-ink'
                                  : 'bg-white border-stone-200 text-stone-400',
                              )}>
                                L{lvl}
                              </div>
                              {lvl < 3 && (
                                <div className={clsx(
                                  'w-6 h-0.5 rounded-full',
                                  lvl < (escData.escalationLevel || 0) ? 'bg-amber-400' : 'bg-stone-200',
                                )} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Escalation Timeline */}
                    {escLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={20} className="animate-spin text-stone-400" />
                        <span className="ml-2 text-xs text-stone-400">Loading escalation logs...</span>
                      </div>
                    ) : escData?.logs?.length > 0 ? (
                      <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-stone-200" />

                        <div className="space-y-0">
                          {escData.logs.map((log: any, idx: number) => {
                            const statusColors: Record<string, string> = {
                              ATTEMPTED: 'bg-blue-100 text-blue-700 border-blue-200',
                              DELIVERED: 'bg-emerald-100 text-[#059669] border-emerald-200',
                              ACKNOWLEDGED: 'bg-emerald-100 text-[#059669] border-emerald-200',
                              NO_ANSWER: 'bg-amber-100 text-amber-700 border-amber-200',
                              BUSY: 'bg-amber-100 text-amber-700 border-amber-200',
                              FAILED: 'bg-red-100 text-red-700 border-red-200',
                            };
                            const notifyIcons: Record<string, string> = {
                              VOICE_NOTIFY: 'phone',
                              SMS_NOTIFY: 'sms',
                              EMAIL_NOTIFY: 'email',
                              SLACK_NOTIFY: 'slack',
                              ALL: 'all',
                            };
                            return (
                              <div key={log.id || idx} className="relative pl-10 pb-5">
                                {/* Dot on line */}
                                <div className={clsx(
                                  'absolute left-[13px] top-1 w-3 h-3 rounded-full border-2',
                                  log.status === 'ACKNOWLEDGED' ? 'bg-[#059669] border-[#059669]'
                                    : log.status === 'FAILED' || log.status === 'NO_ANSWER' ? 'bg-red-400 border-red-400'
                                    : 'bg-amber-400 border-amber-400',
                                )} />

                                <div className="bg-white rounded-xl border border-stone-200 p-3.5 hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">L{log.level}</span>
                                      <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded border', statusColors[log.status] || 'bg-stone-100 text-stone-600 border-stone-200')}>
                                        {log.status}
                                      </span>
                                      <span className="text-[10px] text-stone-400 bg-stone-50 px-2 py-0.5 rounded border border-stone-100 capitalize">
                                        {(log.notifyType || '').replace('_NOTIFY', '').toLowerCase() || 'notify'}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-stone-400 font-mono">
                                      {new Date(log.attemptedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <User2 size={12} className="text-stone-400 shrink-0" />
                                    <span className="text-xs font-medium text-stone-700">{log.targetName || 'Unknown'}</span>
                                    <span className="text-[10px] text-stone-400 font-mono">{log.targetContact}</span>
                                  </div>
                                  {log.callSid && (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                      <Mic size={10} className="text-stone-300" />
                                      <span className="text-[9px] font-mono text-stone-400">SID: {log.callSid}</span>
                                    </div>
                                  )}
                                  {log.respondedAt && (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                      <CheckCircle2 size={10} className="text-[#059669]" />
                                      <span className="text-[10px] text-[#059669] font-medium">
                                        Responded at {new Date(log.respondedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                      </span>
                                    </div>
                                  )}
                                  {log.notes && (
                                    <p className="mt-1.5 text-[10px] text-stone-400 font-body">{log.notes}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
                          <Bell size={24} className="text-stone-400" />
                        </div>
                        <p className="text-sm font-medium text-stone-600 font-body">No escalation activity</p>
                        <p className="text-xs text-stone-400 mt-1.5 font-body max-w-sm mx-auto">
                          Escalation is triggered automatically for P1/P2 incidents that remain unacknowledged. The on-call team will be notified through voice, SMS, email, or Slack based on the escalation policy.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---- Right Column / Metadata Sidebar (4/12) ---- */}
          <div className="col-span-12 lg:col-span-4">
            <div className="rounded-2xl p-5 sticky top-6 relative overflow-hidden" style={{
              background: 'var(--argus-elevated)',
              border: '1px solid var(--argus-border)',
              backdropFilter: 'blur(8px)',
            }}>
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--argus-elevated)' }}>
                  <Tag size={13} style={{ color: 'var(--argus-muted)' }} />
                </div>
                <h3 className="text-sm font-bold font-display" style={{ color: 'var(--argus-ink)' }}>Incident Metadata</h3>
              </div>
              <p className="text-[10px] ml-[38px] mb-4 font-body" style={{ color: 'var(--argus-muted)' }}>
                Assignment, timestamps & configuration
              </p>

              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {/* Organization */}
                {incident.organization && (
                  <MetaRow icon={Building2} label="Organization">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>{incident.organization.name}</span>
                      {incident.organization.environment && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(245,158,11,0.25)' }}>{incident.organization.environment}</span>
                      )}
                    </div>
                  </MetaRow>
                )}
                <MetaRow icon={BarChart3} label="Impact" value={incident.impact || '\u2014'} />
                <MetaRow icon={Zap} label="Urgency" value={incident.urgency || '\u2014'} />
                <MetaRow icon={Shield} label="Priority">
                  <span className={clsx(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold',
                    PRIORITY_META[priority].bg,
                  )}>
                    {priority} - {PRIORITY_META[priority].label}
                  </span>
                </MetaRow>
                <MetaRow icon={Tag} label="Category" value={incident.category || '\u2014'} />
                <MetaRow icon={SrcIcon} label="Source">
                  <div className="flex items-center gap-1.5">
                    <div className={clsx('w-5 h-5 rounded flex items-center justify-center', srcMeta.bg)}>
                      <SrcIcon size={11} className={srcMeta.color} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>{srcMeta.label}</span>
                  </div>
                </MetaRow>

                {/* Assigned To */}
                <MetaRow icon={Users} label="Assigned To">
                  {incident.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.20)' }}>
                        <span className="text-[9px] font-bold" style={{ color: 'var(--argus-amber)' }}>
                          {getInitials(incident.assignedTo.firstName, incident.assignedTo.lastName)}
                        </span>
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>
                        {incident.assignedTo.firstName} {incident.assignedTo.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-red-400">Unassigned</span>
                  )}
                </MetaRow>

                {/* Team */}
                <MetaRow
                  icon={Users}
                  label="Team"
                  value={incident.assignmentGroup?.name || '\u2014'}
                />

                {/* Config Item */}
                {incident.configItem && (
                  <>
                    <MetaRow icon={Server} label="Config Item">
                      <div className="flex items-center gap-1.5">
                        <Server size={12} style={{ color: 'var(--argus-dim)' }} />
                        <span className="text-xs font-medium font-mono" style={{ color: 'var(--argus-ink)' }}>
                          {incident.configItem.hostname || incident.configItem.name}
                        </span>
                      </div>
                    </MetaRow>
                    {incident.configItem.ipAddress && (
                      <MetaRow
                        icon={Globe}
                        label="IP Address"
                        value={incident.configItem.ipAddress}
                        mono
                      />
                    )}
                  </>
                )}

                {/* Created */}
                <MetaRow icon={CalendarDays} label="Created">
                  <div className="text-right">
                    <p className="text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>{relativeTime(incident.createdAt)}</p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--argus-dim)' }}>{formatDateTime(incident.createdAt)}</p>
                  </div>
                </MetaRow>

                {/* Updated */}
                {incident.updatedAt && (
                  <MetaRow icon={RefreshCw} label="Updated">
                    <div className="text-right">
                      <p className="text-xs font-medium" style={{ color: 'var(--argus-ink)' }}>{relativeTime(incident.updatedAt)}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--argus-dim)' }}>{formatDateTime(incident.updatedAt)}</p>
                    </div>
                  </MetaRow>
                )}

                {/* Resolved At */}
                {incident.resolvedAt && (
                  <MetaRow icon={CheckCircle2} label="Resolved">
                    <div className="text-right">
                      <p className="text-xs font-medium" style={{ color: 'var(--argus-emerald)' }}>{relativeTime(incident.resolvedAt)}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--argus-dim)' }}>{formatDateTime(incident.resolvedAt)}</p>
                    </div>
                  </MetaRow>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* -- Assign Modal -- */}
      <Modal
        open={showAssignModal}
        onClose={() => { setShowAssignModal(false); setAssignTeamId(''); setAssignUserId(''); }}
        title="Assign Incident"
        width="max-w-lg"
      >
        <div className="space-y-4">
          {/* Currently assigned info */}
          {(incident?.assignedTo || incident?.assignmentGroup) && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <User2 size={14} className="text-[color:var(--argus-signal)]" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">Currently Assigned</p>
                {incident.assignedTo && (
                  <p className="text-sm font-semibold text-stone-800">{incident.assignedTo.firstName} {incident.assignedTo.lastName}</p>
                )}
                {incident.assignmentGroup && (
                  <p className="text-xs text-stone-500">{incident.assignmentGroup.name}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">
              Assign to Team <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <select
              value={assignTeamId}
              onChange={(e) => setAssignTeamId(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">Choose a team...</option>
              {teams.map((team: any) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">
              Assign to User <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">Choose a user...</option>
              {(usersData?.items || []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.role}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowAssignModal(false); setAssignTeamId(''); setAssignUserId(''); }}
              className="btn-ghost px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={(!assignTeamId && !assignUserId) || submitting}
              className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <UserPlus size={14} />
              Assign
            </button>
          </div>
        </div>
      </Modal>

      {/* -- Edit Modal -- */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Incident"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">Impact</label>
            <select
              value={editImpact}
              onChange={(e) => setEditImpact(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">Select impact...</option>
              {IMPACTS.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">Urgency</label>
            <select
              value={editUrgency}
              onChange={(e) => setEditUrgency(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">Select urgency...</option>
              {URGENCIES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">Category</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">Select category...</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowEditModal(false)}
              className="btn-ghost px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={submitting}
              className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <Save size={14} />
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* -- Create Change Modal -- */}
      <Modal
        open={showCreateChangeModal}
        onClose={() => setShowCreateChangeModal(false)}
        title="Create Change Request"
        width="max-w-lg"
      >
        <div className="space-y-4">
          {/* Source incident context */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-violet-50 border border-violet-200">
            <GitBranch size={16} className="text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-0.5">Linked Incident</p>
              <p className="text-xs font-medium text-violet-800">{incident?.number} · {incident?.shortDescription?.substring(0, 70)}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">
              Change Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={changeDesc}
              onChange={(e) => setChangeDesc(e.target.value)}
              className="input-field w-full text-sm"
              placeholder="Short description of the change..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">Change Type</label>
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value)}
                className="input-field w-full text-sm"
              >
                {CHANGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">Risk Level</label>
              <select
                value={changeRisk}
                onChange={(e) => setChangeRisk(e.target.value)}
                className="input-field w-full text-sm"
              >
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">
              Justification <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={changeJustification}
              onChange={(e) => setChangeJustification(e.target.value)}
              rows={3}
              className="input-field w-full text-sm resize-none"
              placeholder="Why is this change needed? What problem does it solve?"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowCreateChangeModal(false)}
              className="btn-ghost px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateChange}
              disabled={!changeDesc.trim() || submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-violet-600 text-ink hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <GitBranch size={14} />
              Create & Link Change
            </button>
          </div>
        </div>
      </Modal>

      {/* -- Sub-Incident Modal -- */}
      <Modal
        open={showSubIncidentModal}
        onClose={() => setShowSubIncidentModal(false)}
        title="Create Sub-Incident"
        width="max-w-lg"
      >
        <div className="space-y-4">
          {/* Parent context */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
            <Layers size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-0.5">Parent Incident</p>
              <p className="text-xs font-medium text-blue-800">{incident?.number} · {incident?.shortDescription?.substring(0, 70)}</p>
              {incident?.configItem && (
                <p className="text-[10px] text-blue-600 mt-0.5 font-mono">
                  Asset: {incident.configItem.hostname || incident.configItem.name}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">
              Sub-Incident Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subDesc}
              onChange={(e) => setSubDesc(e.target.value)}
              className="input-field w-full text-sm"
              placeholder="What is the specific sub-issue?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">Impact</label>
              <select
                value={subImpact}
                onChange={(e) => setSubImpact(e.target.value)}
                className="input-field w-full text-sm"
              >
                {IMPACTS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">Urgency</label>
              <select
                value={subUrgency}
                onChange={(e) => setSubUrgency(e.target.value)}
                className="input-field w-full text-sm"
              >
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Inherited from parent */}
          <div className="px-3 py-2.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Inherited from parent</p>
            <div className="flex flex-wrap gap-2">
              {incident?.category && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-stone-200 text-stone-600 font-medium">{incident.category}</span>
              )}
              {incident?.assignmentGroup && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-[color:var(--argus-signal)] font-medium">{incident.assignmentGroup.name}</span>
              )}
              {incident?.configItem && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-mono">{incident.configItem.hostname || incident.configItem.name}</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowSubIncidentModal(false)}
              className="btn-ghost px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSubIncident}
              disabled={!subDesc.trim() || submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-blue-600 text-ink hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <Plus size={14} />
              Create Sub-Incident
            </button>
          </div>
        </div>
      </Modal>

      {/* -- Link Problem Modal -- */}
      <Modal
        open={showLinkProblemModal}
        onClose={() => { setShowLinkProblemModal(false); setLinkProblemId(''); setLinkProblemType('RELATED'); }}
        title="Link Problem"
        width="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Problem</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
              value={linkProblemId}
              onChange={(e) => setLinkProblemId(e.target.value)}
            >
              <option value="">Select a problem…</option>
              {(problemsData?.data || []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.number} — {p.shortDescription}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Link type</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
              value={linkProblemType}
              onChange={(e) => setLinkProblemType(e.target.value as typeof linkProblemType)}
            >
              <option value="RELATED">Related</option>
              <option value="CAUSED_BY">Caused by</option>
              <option value="SYMPTOM_OF">Symptom of</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setShowLinkProblemModal(false); setLinkProblemId(''); }}
              className="px-4 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLinkProblem}
              disabled={!linkProblemId || submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Link Problem
            </button>
          </div>
        </div>
      </Modal>

      {/* -- Delete Confirm -- */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Incident"
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Permanently delete <span className="font-mono font-semibold">{incident?.number}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* -- Resolve Modal -- */}
      <Modal
        open={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        title="Resolve Incident"
        width="max-w-lg"
      >
        <div className="space-y-5">
          {/* Resolution Code Grid */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-2 font-body">
              Resolution Code
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTION_CODES.map((rc) => {
                const RcIcon = rc.icon;
                const isSelected = resCode === rc.code;
                return (
                  <button
                    key={rc.code}
                    onClick={() => setResCode(rc.code)}
                    className={clsx(
                      'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all',
                      isSelected
                        ? clsx(rc.bg, 'ring-1')
                        : 'border-stone-200 bg-white hover:bg-stone-50',
                    )}
                  >
                    <RcIcon size={16} className={clsx(isSelected ? rc.color : 'text-stone-400')} />
                    <span className={clsx(
                      'text-xs font-medium',
                      isSelected ? 'text-stone-900' : 'text-stone-600',
                    )}>
                      {rc.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resolution Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5 font-body">
              Resolution Notes
            </label>
            <textarea
              value={resNotes}
              onChange={(e) => setResNotes(e.target.value)}
              placeholder="Describe the resolution..."
              rows={4}
              className="input-field w-full text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowResolveModal(false); setResCode(''); setResNotes(''); }}
              className="btn-ghost px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={!resCode || submitting}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5',
                'bg-emerald-600 text-white hover:bg-emerald-700 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <CheckCircle2 size={14} />
              Resolve Incident
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
