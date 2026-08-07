import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  AlertTriangle, ShieldAlert, Timer, X, Filter,
  LayoutList, Kanban, CalendarClock, Flame,
  Hash, Mail, Mic, Radio, Globe, Zap, UserPlus, ArrowUpRight,
  CheckCircle2, Eye, Activity, TrendingUp,
  ChevronsUpDown, SlidersHorizontal,
} from 'lucide-react';
import clsx from 'clsx';
import { useIncidents } from '../../hooks/useIncidents';
import { QuickReportButton } from './IncidentReportGenerator';

// =============================================================================
// Types
// =============================================================================

type Priority = 'P1' | 'P2' | 'P3' | 'P4';
type IncidentState = 'NEW' | 'IN_PROGRESS' | 'ON_HOLD' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
type ViewMode = 'table' | 'board' | 'timeline';
type SortField = 'number' | 'priority' | 'state' | 'shortDescription' | 'assignedTo' | 'createdAt';
type SortDir = 'asc' | 'desc';

interface Incident {
  id: string; number: string; priority: Priority;
  state: IncidentState; shortDescription: string; description?: string;
  assignedTo: { firstName: string; lastName: string } | null;
  assignmentGroup?: { name: string } | null;
  source?: string; category?: string;
  configItem?: { id: string; name: string; hostname?: string; ipAddress?: string } | null;
  createdAt: string; updatedAt?: string;
  slaBreached?: boolean; resolvedAt?: string | null;
  impact?: string; urgency?: string;
}

// =============================================================================
// Constants & Mappings
// =============================================================================

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dotClass: string; borderClass: string; bgClass: string; badgeClass: string }> = {
  P1: { label: 'Critical', color: '#DC2626', dotClass: 'bg-red-500', borderClass: 'border-l-red-500', bgClass: 'bg-red-50/30', badgeClass: 'priority-p1' },
  P2: { label: 'High',     color: '#D97706', dotClass: 'bg-amber-500', borderClass: 'border-l-amber-500', bgClass: 'bg-amber-50/20', badgeClass: 'priority-p2' },
  P3: { label: 'Medium',   color: '#4F46E5', dotClass: 'bg-indigo-500', borderClass: 'border-l-indigo-500', bgClass: 'bg-transparent', badgeClass: 'priority-p3' },
  P4: { label: 'Low',      color: '#059669', dotClass: 'bg-emerald-500', borderClass: 'border-l-emerald-500', bgClass: 'bg-transparent', badgeClass: 'priority-p4' },
};

const STATE_CONFIG: Record<IncidentState, { label: string; badgeClass: string; columnColor: string; borderColor: string }> = {
  NEW:         { label: 'New',         badgeClass: 'state-new',         columnColor: 'bg-violet-500',  borderColor: 'border-t-violet-500' },
  IN_PROGRESS: { label: 'In Progress', badgeClass: 'state-in-progress', columnColor: 'bg-indigo-500',  borderColor: 'border-t-indigo-500' },
  ON_HOLD:     { label: 'On Hold',     badgeClass: 'state-on-hold',     columnColor: 'bg-amber-500',   borderColor: 'border-t-amber-500' },
  ESCALATED:   { label: 'Escalated',   badgeClass: 'state-escalated',   columnColor: 'bg-red-500',     borderColor: 'border-t-red-500' },
  RESOLVED:    { label: 'Resolved',    badgeClass: 'state-resolved',    columnColor: 'bg-emerald-500', borderColor: 'border-t-emerald-500' },
  CLOSED:      { label: 'Closed',      badgeClass: 'state-closed',      columnColor: 'bg-stone-400',   borderColor: 'border-t-stone-400' },
};

const ALL_STATES: IncidentState[] = ['NEW', 'IN_PROGRESS', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED'];
const ALL_PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4'];

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  MANUAL: Hash,
  PROMETHEUS: Activity,
  GRAFANA: Flame,
  API: Globe,
  EMAIL: Mail,
  VOICE: Mic,
  SLACK: Radio,
};

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'state', label: 'State' },
  { value: 'number', label: 'Incident Number' },
  { value: 'shortDescription', label: 'Title' },
];

const PAGE_SIZES = [15, 25, 50];

// =============================================================================
// Helpers
// =============================================================================

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function getSlaProgress(incident: Incident): { percent: number; status: 'ok' | 'warning' | 'danger' } {
  if (incident.slaBreached) return { percent: 100, status: 'danger' };
  if (incident.state === 'RESOLVED' || incident.state === 'CLOSED') return { percent: 0, status: 'ok' };
  const created = new Date(incident.createdAt).getTime();
  const now = Date.now();
  const elapsed = now - created;
  const slaMinutes = incident.priority === 'P1' ? 60 : incident.priority === 'P2' ? 240 : incident.priority === 'P3' ? 1440 : 4320;
  const slaMs = slaMinutes * 60 * 1000;
  const percent = Math.min(100, Math.round((elapsed / slaMs) * 100));
  if (percent > 80) return { percent, status: 'danger' };
  if (percent > 50) return { percent, status: 'warning' };
  return { percent, status: 'ok' };
}

// =============================================================================
// Sub-Components
// =============================================================================

function SkeletonTable() {
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="bg-stone-50 px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-6">
          <div className="w-5 h-5 bg-stone-200 rounded animate-pulse" />
          {[80, 60, 200, 70, 80, 100, 80, 60].map((w, i) => (
            <div key={i} className="h-3 bg-stone-200 rounded animate-pulse" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-4 border-b border-stone-100 flex items-center gap-6">
          <div className="w-5 h-5 bg-stone-100 rounded animate-pulse" />
          <div className="w-12 h-6 bg-stone-100 rounded-full animate-pulse" />
          <div className="w-24 h-4 bg-stone-100 rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-stone-100 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-stone-50 rounded animate-pulse w-1/3" />
          </div>
          <div className="w-20 h-6 bg-stone-100 rounded-full animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-stone-100 rounded-full animate-pulse" />
            <div className="w-16 h-3 bg-stone-100 rounded animate-pulse" />
          </div>
          <div className="w-16 h-3 bg-stone-100 rounded animate-pulse" />
          <div className="w-12 h-3 bg-stone-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm py-20 px-8 flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 4L6 12V28L20 36L34 28V12L20 4Z" stroke="#059669" strokeWidth="2" strokeLinejoin="round" fill="#ECFDF5" />
          <path d="M14 20L18 24L26 16" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="font-display text-xl font-bold text-stone-900 mb-2">All Clear</h3>
      <p className="text-stone-500 text-sm max-w-sm mb-8">
        No incidents match your current filters. Adjust your search criteria or create a new incident to get started.
      </p>
      <button
        onClick={onCreateClick}
        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 rounded-xl text-sm font-semibold shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-[1.02]"
      >
        <Plus size={16} />
        Create Incident
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  pulse,
  delay,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  iconBg: string;
  iconColor: string;
  pulse?: boolean;
  delay: number;
}) {
  return (
    <div
      className="bg-white/[0.06] backdrop-blur-sm rounded-xl border border-white/[0.08] p-4 hover:shadow-xl transition-all duration-300 group animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="font-display text-2xl font-extrabold text-white">{value}</p>
        </div>
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center relative', iconBg)}>
          <Icon className={iconColor} size={18} />
          {pulse && value > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

function AvatarInitials({ firstName, lastName, size = 'sm' }: { firstName: string; lastName: string; size?: 'sm' | 'md' }) {
  const initials = getInitials(firstName, lastName);
  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-full bg-amber-100 text-amber-700 font-semibold flex-shrink-0',
        size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs'
      )}
    >
      {initials}
    </div>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const IconComp = SOURCE_ICONS[source] || Zap;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-stone-400 bg-stone-100 rounded px-1 py-0.5 ml-1.5 font-medium">
      <IconComp size={10} />
      {source.charAt(0) + source.slice(1).toLowerCase()}
    </span>
  );
}

function SlaIndicator({ incident }: { incident: Incident }) {
  const { percent, status } = getSlaProgress(incident);
  if (incident.state === 'RESOLVED' || incident.state === 'CLOSED') {
    return (
      <div className="flex items-center gap-1">
        <CheckCircle2 size={12} className="text-emerald-500" />
        <span className="font-mono text-[10px] text-emerald-600">Done</span>
      </div>
    );
  }
  const barColor = status === 'danger' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = status === 'danger' ? 'text-red-600' : status === 'warning' ? 'text-amber-600' : 'text-stone-500';
  return (
    <div className="min-w-[56px]">
      <span className={clsx('font-mono text-[10px]', textColor)}>
        {incident.slaBreached ? 'Breached' : `${percent}%`}
      </span>
      <div className="w-full h-1 bg-stone-100 rounded-full mt-0.5 overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// =============================================================================
// Board View
// =============================================================================

function BoardView({
  incidents,
  selectedIds,
  onToggleSelect,
  onNavigate,
}: {
  incidents: Incident[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const columns = useMemo(() => {
    const map: Record<IncidentState, Incident[]> = {
      NEW: [], IN_PROGRESS: [], ON_HOLD: [], ESCALATED: [], RESOLVED: [], CLOSED: [],
    };
    incidents.forEach((inc) => {
      if (map[inc.state]) map[inc.state].push(inc);
    });
    return map;
  }, [incidents]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {ALL_STATES.map((state) => {
        const config = STATE_CONFIG[state];
        const items = columns[state];
        return (
          <div key={state} className="flex-shrink-0 w-72">
            <div className={clsx('rounded-xl border border-stone-800 bg-[#0C0A09] overflow-hidden border-t-[3px]', config.borderColor)}>
              <div className="px-3 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wide">{config.label}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-stone-400 bg-white/[0.08] rounded-full px-2 py-0.5 border border-stone-700">
                  {items.length}
                </span>
              </div>
              <div className="px-2 pb-2 space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto">
                {items.length === 0 && (
                  <div className="text-center py-8 text-stone-400 text-xs">No incidents</div>
                )}
                {items.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => onNavigate(inc.id)}
                    className={clsx(
                      'bg-white rounded-lg border shadow-sm p-3 hover:shadow-md transition-shadow cursor-pointer group',
                      selectedIds.has(inc.id) ? 'border-amber-300 bg-amber-50/50' : 'border-stone-200'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_CONFIG[inc.priority].dotClass)} />
                        <span className="font-mono text-[10px] font-semibold text-stone-500">{inc.number}</span>
                      </div>
                      <span className={clsx('badge text-[10px]', PRIORITY_CONFIG[inc.priority].badgeClass)}>
                        {inc.priority}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-stone-800 line-clamp-2 mb-2.5 leading-snug">
                      {inc.shortDescription}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {inc.assignedTo ? (
                          <>
                            <AvatarInitials firstName={inc.assignedTo.firstName} lastName={inc.assignedTo.lastName} />
                            <span className="text-[10px] text-stone-500 truncate max-w-[80px]">
                              {inc.assignedTo.firstName}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-stone-400 italic">Unassigned</span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-stone-400">
                        {relativeTime(inc.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Timeline View
// =============================================================================

function TimelineView({
  incidents,
  onNavigate,
}: {
  incidents: Incident[];
  onNavigate: (id: string) => void;
}) {
  const sorted = useMemo(
    () => [...incidents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [incidents]
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-stone-400 text-sm">
        No incidents to display on timeline.
      </div>
    );
  }

  return (
    <div className="relative max-w-4xl mx-auto py-4">
      {/* Vertical line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-stone-200 -translate-x-1/2" />

      {sorted.map((inc, idx) => {
        const isLeft = idx % 2 === 0;
        const prioConfig = PRIORITY_CONFIG[inc.priority];
        return (
          <div
            key={inc.id}
            className={clsx(
              'relative flex items-center mb-6 animate-fade-in',
              isLeft ? 'flex-row' : 'flex-row-reverse'
            )}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* Card side */}
            <div className={clsx('w-[calc(50%-24px)]', isLeft ? 'pr-4 text-right' : 'pl-4 text-left')}>
              <div
                onClick={() => onNavigate(inc.id)}
                className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer group inline-block text-left w-full"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={clsx('badge text-[10px]', prioConfig.badgeClass)}>{inc.priority}</span>
                  <span className="font-mono text-[10px] font-semibold text-stone-500">{inc.number}</span>
                  <span className={clsx('badge text-[10px]', STATE_CONFIG[inc.state].badgeClass)}>
                    {STATE_CONFIG[inc.state].label}
                  </span>
                </div>
                <p className="text-sm font-medium text-stone-800 line-clamp-2 leading-snug mb-2">
                  {inc.shortDescription}
                </p>
                <div className="flex items-center gap-2">
                  {inc.assignedTo ? (
                    <div className="flex items-center gap-1.5">
                      <AvatarInitials firstName={inc.assignedTo.firstName} lastName={inc.assignedTo.lastName} />
                      <span className="text-[10px] text-stone-500">
                        {inc.assignedTo.firstName} {inc.assignedTo.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-stone-400 italic">Unassigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* Center dot */}
            <div className="relative z-10 flex-shrink-0">
              <div className={clsx('w-4 h-4 rounded-full border-[3px] border-white shadow-sm', prioConfig.dotClass)} />
            </div>

            {/* Time side */}
            <div className={clsx('w-[calc(50%-24px)]', isLeft ? 'pl-4 text-left' : 'pr-4 text-right')}>
              <span className="font-mono text-xs text-stone-400">{relativeTime(inc.createdAt)}</span>
              <p className="text-[10px] text-stone-300 mt-0.5">
                {new Date(inc.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Bulk Action Bar
// =============================================================================

function BulkActionBar({
  count,
  onDeselectAll,
  onAssign,
  onEscalate,
  onExport,
}: {
  count: number;
  onDeselectAll: () => void;
  onAssign: () => void;
  onEscalate: () => void;
  onExport: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-in">
      <div className="h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
      <div className="bg-white border-t border-stone-200 shadow-2xl px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 bg-amber-100 rounded-lg text-xs font-bold text-amber-700">
              {count}
            </span>
            <span className="text-sm font-medium text-stone-700">
              incident{count !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAssign}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              <UserPlus size={13} />
              Assign
            </button>
            <button
              onClick={onEscalate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
            >
              <ArrowUpRight size={13} />
              Escalate
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
            >
              <TrendingUp size={13} />
              Export
            </button>
            <div className="w-px h-5 bg-stone-200 mx-1" />
            <button
              onClick={onDeselectAll}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X size={13} />
              Deselect All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Pagination
// =============================================================================

function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
  onLimitChange: (l: number) => void;
}) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      const rangeStart = Math.max(2, page - 1);
      const rangeEnd = Math.min(totalPages - 1, page + 1);
      for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  if (total === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs text-stone-500">
          Showing <span className="font-semibold text-stone-700">{start}-{end}</span> of{' '}
          <span className="font-semibold text-stone-700">{total}</span> incidents
        </span>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-[10px] text-stone-400 uppercase tracking-wide">Per page</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="text-xs bg-stone-50 border border-stone-200 rounded-md px-1.5 py-0.5 text-stone-600 focus:outline-none focus:border-amber-300"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        {pageNumbers.map((pn, idx) =>
          pn === 'ellipsis' ? (
            <span key={`e-${idx}`} className="px-1 text-stone-300 text-xs">...</span>
          ) : (
            <button
              key={pn}
              onClick={() => onPageChange(pn)}
              className={clsx(
                'w-7 h-7 rounded-md text-xs font-medium transition-all',
                pn === page
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
              )}
            >
              {pn}
            </button>
          )
        )}
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function IncidentList() {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // ── Filter & UI State ──
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activePriorities, setActivePriorities] = useState<Set<Priority>>(new Set());
  const [activeStates, setActiveStates] = useState<Set<IncidentState>>(new Set());
  const [showStateFilter, setShowStateFilter] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedRowIdx, setFocusedRowIdx] = useState<number>(-1);

  const stateDropdownRef = useRef<HTMLDivElement>(null);

  // ── Debounce search ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Close state dropdown on outside click ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target as Node)) {
        setShowStateFilter(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Build filters ──
  const filters = useMemo(() => {
    const f: Record<string, any> = {
      page,
      limit: viewMode === 'table' ? limit : 100,
      sortBy,
      sortOrder,
    };
    if (debouncedSearch) f.search = debouncedSearch;
    if (activePriorities.size === 1) f.priority = Array.from(activePriorities)[0];
    if (activePriorities.size > 1) f.priority = Array.from(activePriorities).join(',');
    if (activeStates.size === 1) f.state = Array.from(activeStates)[0];
    if (activeStates.size > 1) f.state = Array.from(activeStates).join(',');
    return f;
  }, [page, limit, sortBy, sortOrder, debouncedSearch, activePriorities, activeStates, viewMode]);

  // ── API Call ──
  const { data: response, isLoading } = useIncidents(filters);
  const incidents: Incident[] = response?.data ?? [];
  const pagination = response?.pagination ?? { total: 0, page: 1, limit: 15, totalPages: 0 };

  // ── Computed stats ──
  const stats = useMemo(() => {
    const active = incidents.filter((i) => !['RESOLVED', 'CLOSED'].includes(i.state)).length;
    const critical = incidents.filter((i) => i.priority === 'P1').length;
    const high = incidents.filter((i) => i.priority === 'P2').length;
    const slaBreach = incidents.filter((i) => i.slaBreached).length;
    const resolvedToday = incidents.filter(
      (i) => (i.state === 'RESOLVED' || i.state === 'CLOSED') && (isToday(i.resolvedAt) || isToday(i.updatedAt))
    ).length;
    return { active, critical, high, slaBreach, resolvedToday };
  }, [incidents]);

  // ── Handlers ──
  const togglePriority = useCallback((p: Priority) => {
    setActivePriorities((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
    setPage(1);
  }, []);

  const toggleState = useCallback((s: IncidentState) => {
    setActiveStates((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
    setPage(1);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === incidents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(incidents.map((i) => i.id)));
    }
  }, [incidents, selectedIds.size]);

  const handleRowClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) return;
      navigate(`/incidents/${id}`);
    },
    [navigate]
  );

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortOrder('desc');
      }
      setPage(1);
    },
    [sortBy]
  );

  // ── Keyboard navigation ──
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;
      if (viewMode !== 'table') return;

      if (e.key === 'j') {
        e.preventDefault();
        setFocusedRowIdx((prev) => Math.min(prev + 1, incidents.length - 1));
      } else if (e.key === 'k') {
        e.preventDefault();
        setFocusedRowIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedRowIdx >= 0 && focusedRowIdx < incidents.length) {
        e.preventDefault();
        navigate(`/incidents/${incidents[focusedRowIdx].id}`);
      } else if (e.key === 'x' && focusedRowIdx >= 0 && focusedRowIdx < incidents.length) {
        e.preventDefault();
        toggleSelect(incidents[focusedRowIdx].id);
      }
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [viewMode, incidents, focusedRowIdx, navigate, toggleSelect]);

  // ── Scroll focused row into view ──
  useEffect(() => {
    if (focusedRowIdx < 0 || viewMode !== 'table') return;
    const rows = tableRef.current?.querySelectorAll('tbody tr');
    if (rows && rows[focusedRowIdx]) {
      rows[focusedRowIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedRowIdx, viewMode]);

  // ── Sort indicator ──
  function SortIndicator({ field }: { field: SortField }) {
    if (sortBy !== field) return <ChevronsUpDown size={12} className="text-stone-300 ml-0.5" />;
    return sortOrder === 'asc'
      ? <ChevronUp size={12} className="text-amber-500 ml-0.5" />
      : <ChevronDown size={12} className="text-amber-500 ml-0.5" />;
  }

  // ── Render ──
  return (
    <div className="animate-fade-in space-y-0">
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* HERO BANNER                                                          */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0C0A09]">
        {/* Dot grid texture */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Amber glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative px-6 pt-6 pb-14">
          <div className="flex items-start justify-between">
            {/* Left: title */}
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <ShieldAlert size={16} className="text-amber-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-white tracking-tight">Incidents</h1>
              </div>
              <p className="text-stone-400 text-sm ml-[42px]">Real-time incident monitoring & response</p>
            </div>

            {/* Right: view toggle + create */}
            <div className="flex items-center gap-3">
              {/* View toggle pills */}
              <div className="flex items-center bg-white/[0.06] rounded-lg p-0.5">
                {([
                  { mode: 'table' as ViewMode, icon: LayoutList, label: 'Table' },
                  { mode: 'board' as ViewMode, icon: Kanban, label: 'Board' },
                  { mode: 'timeline' as ViewMode, icon: CalendarClock, label: 'Timeline' },
                ]).map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => { setViewMode(mode); setFocusedRowIdx(-1); }}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                      viewMode === mode
                        ? 'bg-amber-500 text-stone-950 shadow-sm'
                        : 'text-stone-400 hover:text-white'
                    )}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Create button */}
              <button
                onClick={() => navigate('/incidents/create')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 rounded-xl text-sm font-semibold shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-[1.02]"
              >
                <Plus size={15} />
                New Incident
              </button>
            </div>
          </div>
          {/* Stat Cards */}
          <div className="relative mt-6 px-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                label="Active"
                value={stats.active}
                icon={Activity}
                iconBg="bg-white/[0.08]"
                iconColor="text-amber-500"
                delay={0}
              />
              <StatCard
                label="Critical"
                value={stats.critical}
                icon={Flame}
                iconBg="bg-white/[0.08]"
                iconColor="text-red-600"
                pulse
                delay={100}
              />
              <StatCard
                label="High"
                value={stats.high}
                icon={AlertTriangle}
                iconBg="bg-white/[0.08]"
                iconColor="text-amber-600"
                delay={200}
              />
              <StatCard
                label="SLA Breach"
                value={stats.slaBreach}
                icon={Timer}
                iconBg="bg-white/[0.08]"
                iconColor="text-red-500"
                delay={300}
              />
              <StatCard
                label="Resolved"
                value={stats.resolvedToday}
                icon={CheckCircle2}
                iconBg="bg-white/[0.08]"
                iconColor="text-emerald-600"
                delay={400}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Amber accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* FILTER BAR                                                            */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="-mt-3 relative z-10 bg-white/90 backdrop-blur-xl rounded-xl border border-stone-200 shadow-sm p-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search incidents..."
              className="w-full pl-9 pr-16 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 transition-all"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 bg-stone-100 border border-stone-200 rounded px-1.5 py-0.5 font-mono hidden sm:inline-block">
              {'\u2318'}K
            </kbd>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-stone-200 hidden sm:block" />

          {/* Priority pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider font-medium mr-0.5">Priority</span>
            {ALL_PRIORITIES.map((p) => {
              const isActive = activePriorities.has(p);
              const config = PRIORITY_CONFIG[p];
              return (
                <button
                  key={p}
                  onClick={() => togglePriority(p)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 border',
                    isActive
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                  )}
                >
                  <span className={clsx('w-1.5 h-1.5 rounded-full', config.dotClass)} />
                  {p}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-stone-200 hidden sm:block" />

          {/* State filter dropdown */}
          <div className="relative" ref={stateDropdownRef}>
            <button
              onClick={() => setShowStateFilter(!showStateFilter)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border',
                activeStates.size > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              )}
            >
              <Filter size={13} />
              State
              {activeStates.size > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {activeStates.size}
                </span>
              )}
            </button>
            {showStateFilter && (
              <div className="absolute top-full left-0 mt-1.5 bg-white rounded-xl border border-stone-200 shadow-xl p-2 z-30 min-w-[180px] animate-fade-in">
                {ALL_STATES.map((s) => {
                  const isActive = activeStates.has(s);
                  const config = STATE_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => toggleState(s)}
                      className={clsx(
                        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                        isActive ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-stone-50'
                      )}
                    >
                      <span className={clsx('w-2 h-2 rounded-full', config.columnColor)} />
                      {config.label}
                      {isActive && <CheckCircle2 size={12} className="ml-auto text-amber-500" />}
                    </button>
                  );
                })}
                {activeStates.size > 0 && (
                  <>
                    <div className="h-px bg-stone-100 my-1.5" />
                    <button
                      onClick={() => { setActiveStates(new Set()); setPage(1); }}
                      className="w-full text-left px-2.5 py-1.5 text-[10px] text-stone-400 hover:text-stone-600 rounded-lg"
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 ml-auto">
            <SlidersHorizontal size={13} className="text-stone-400" />
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as SortField); setPage(1); }}
              className="filter-select min-w-[120px]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Active filter count + clear */}
          {(activePriorities.size > 0 || activeStates.size > 0 || debouncedSearch) && (
            <button
              onClick={() => {
                setActivePriorities(new Set());
                setActiveStates(new Set());
                setSearch('');
                setDebouncedSearch('');
                setPage(1);
              }}
              className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-crimson transition-colors"
            >
              <X size={11} />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* CONTENT AREA                                                          */}
      {/* ────────────────────────────────────────────────────────────────────── */}

      {isLoading ? (
        <SkeletonTable />
      ) : incidents.length === 0 ? (
        <EmptyState onCreateClick={() => navigate('/incidents/create')} />
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div ref={tableRef} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={incidents.length > 0 && selectedIds.size === incidents.length}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-stone-300 text-amber-500 focus:ring-amber-200 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left">
                    <button onClick={() => handleSort('priority')} className="flex items-center text-[10px] text-stone-400 font-bold uppercase tracking-widest hover:text-stone-600 transition-colors">
                      Priority <SortIndicator field="priority" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left">
                    <button onClick={() => handleSort('number')} className="flex items-center text-[10px] text-stone-400 font-bold uppercase tracking-widest hover:text-stone-600 transition-colors">
                      Number <SortIndicator field="number" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left min-w-[280px]">
                    <button onClick={() => handleSort('shortDescription')} className="flex items-center text-[10px] text-stone-400 font-bold uppercase tracking-widest hover:text-stone-600 transition-colors">
                      Title <SortIndicator field="shortDescription" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left">
                    <button onClick={() => handleSort('state')} className="flex items-center text-[10px] text-stone-400 font-bold uppercase tracking-widest hover:text-stone-600 transition-colors">
                      State <SortIndicator field="state" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Assignee</span>
                  </th>
                  <th className="px-3 py-2.5 text-left">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">SLA</span>
                  </th>
                  <th className="px-3 py-2.5 text-left">
                    <button onClick={() => handleSort('createdAt')} className="flex items-center text-[10px] text-stone-400 font-bold uppercase tracking-widest hover:text-stone-600 transition-colors">
                      Time <SortIndicator field="createdAt" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-center w-20">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc, idx) => {
                  const prioConfig = PRIORITY_CONFIG[inc.priority];
                  const stateConfig = STATE_CONFIG[inc.state];
                  const isSelected = selectedIds.has(inc.id);
                  const isFocused = focusedRowIdx === idx;
                  const isP1 = inc.priority === 'P1';

                  return (
                    <tr
                      key={inc.id}
                      onClick={(e) => handleRowClick(inc.id, e)}
                      className={clsx(
                        'border-b border-stone-100 transition-all cursor-pointer group border-l-[3px]',
                        prioConfig.borderClass,
                        isSelected && 'bg-amber-50/50',
                        !isSelected && isP1 && 'bg-red-50/30',
                        !isSelected && !isP1 && 'hover:bg-stone-50',
                        isFocused && 'ring-2 ring-amber-400 ring-inset'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(inc.id)}
                          className="w-3.5 h-3.5 rounded border-stone-300 text-amber-500 focus:ring-amber-200 cursor-pointer"
                        />
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-3">
                        <span className={clsx('badge text-[10px] font-semibold', prioConfig.badgeClass)}>
                          {inc.priority}
                        </span>
                      </td>

                      {/* Number */}
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs font-semibold text-stone-600">{inc.number}</span>
                      </td>

                      {/* Title + source */}
                      <td className="px-3 py-3 max-w-xs">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-stone-900 truncate">{inc.shortDescription}</span>
                          <SourceBadge source={inc.source} />
                        </div>
                        {inc.configItem && (
                          <p className="text-[10px] text-stone-400 mt-0.5 truncate">
                            {inc.configItem.name}
                            {inc.configItem.hostname ? ` (${inc.configItem.hostname})` : ''}
                          </p>
                        )}
                      </td>

                      {/* State */}
                      <td className="px-3 py-3">
                        <span className={clsx('badge text-[10px] font-medium', stateConfig.badgeClass)}>
                          {stateConfig.label}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td className="px-3 py-3">
                        {inc.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <AvatarInitials firstName={inc.assignedTo.firstName} lastName={inc.assignedTo.lastName} />
                            <div className="min-w-0">
                              <span className="text-xs text-stone-700 font-medium truncate block max-w-[100px]">
                                {inc.assignedTo.firstName} {inc.assignedTo.lastName.charAt(0)}.
                              </span>
                              {inc.assignmentGroup && (
                                <span className="text-[10px] text-stone-400 truncate block max-w-[100px]">
                                  {inc.assignmentGroup.name}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* SLA */}
                      <td className="px-3 py-3">
                        <SlaIndicator incident={inc} />
                      </td>

                      {/* Time */}
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-stone-400">{relativeTime(inc.createdAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <QuickReportButton
                            incidentId={inc.id}
                            incidentNumber={inc.number}
                            size="sm"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${inc.id}`); }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'board' ? (
        /* ── BOARD VIEW ── */
        <div className="mb-4">
          <BoardView
            incidents={incidents}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onNavigate={(id) => navigate(`/incidents/${id}`)}
          />
        </div>
      ) : (
        /* ── TIMELINE VIEW ── */
        <div className="mb-4">
          <TimelineView
            incidents={incidents}
            onNavigate={(id) => navigate(`/incidents/${id}`)}
          />
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* PAGINATION (table view only)                                          */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'table' && !isLoading && incidents.length > 0 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={limit}
          onPageChange={(p) => { setPage(p); setFocusedRowIdx(-1); }}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* KEYBOARD HINTS                                                        */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'table' && !isLoading && incidents.length > 0 && (
        <div className="flex items-center justify-center gap-4 py-3 mt-2">
          <div className="flex items-center gap-1 text-[10px] text-stone-300">
            <kbd className="font-mono bg-stone-100 border border-stone-200 rounded px-1 py-0.5 text-stone-400">J</kbd>
            <kbd className="font-mono bg-stone-100 border border-stone-200 rounded px-1 py-0.5 text-stone-400">K</kbd>
            <span className="ml-0.5">Navigate</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-stone-300">
            <kbd className="font-mono bg-stone-100 border border-stone-200 rounded px-1 py-0.5 text-stone-400">Enter</kbd>
            <span className="ml-0.5">Open</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-stone-300">
            <kbd className="font-mono bg-stone-100 border border-stone-200 rounded px-1 py-0.5 text-stone-400">X</kbd>
            <span className="ml-0.5">Select</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-stone-300">
            <kbd className="font-mono bg-stone-100 border border-stone-200 rounded px-1 py-0.5 text-stone-400">{'\u2318'}K</kbd>
            <span className="ml-0.5">Search</span>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* BULK ACTION BAR                                                       */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <BulkActionBar
        count={selectedIds.size}
        onDeselectAll={() => setSelectedIds(new Set())}
        onAssign={() => {
          // Placeholder: would open assign modal
        }}
        onEscalate={() => {
          // Placeholder: would open escalate modal
        }}
        onExport={() => {
          // Placeholder: would trigger bulk export
        }}
      />

      {/* Bottom spacer when bulk bar is visible */}
      {selectedIds.size > 0 && <div className="h-16" />}
    </div>
  );
}
