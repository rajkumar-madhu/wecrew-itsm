import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ShieldAlert, X, Filter,
  LayoutList, Kanban, CalendarClock, Flame,
  Hash, Mail, Mic, Radio, Globe, Zap, UserPlus, ArrowUpRight,
  CheckCircle2, Eye, Activity, TrendingUp,
  ChevronsUpDown, SlidersHorizontal, PanelRight, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useIncidents, useUpdateIncident } from '../../hooks/useIncidents';
import { useTeams } from '../../hooks/useTeams';
import api from '../../lib/api';
import { QuickReportButton, downloadBulkReport, triggerDownload, triggerJsonDownload } from './IncidentReportGenerator';
import { Page, Toolbar } from '../ui/PageChrome';

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
  P3: { label: 'Medium',   color: '#4F46E5', dotClass: 'bg-signal', borderClass: 'border-l-indigo-500', bgClass: 'bg-transparent', badgeClass: 'priority-p3' },
  P4: { label: 'Low',      color: '#059669', dotClass: 'bg-emerald-500', borderClass: 'border-l-emerald-500', bgClass: 'bg-transparent', badgeClass: 'priority-p4' },
};

const STATE_CONFIG: Record<IncidentState, { label: string; badgeClass: string; columnColor: string; borderColor: string }> = {
  NEW:         { label: 'New',         badgeClass: 'state-new',         columnColor: 'bg-violet-500',  borderColor: 'border-t-violet-500' },
  IN_PROGRESS: { label: 'In Progress', badgeClass: 'state-in-progress', columnColor: 'bg-signal',  borderColor: 'border-t-indigo-500' },
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
        className="flex items-center gap-2 px-5 py-2.5 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
      className="bg-[color:var(--argus-elevated)] backdrop-blur-sm rounded-xl border border-[color:var(--argus-border)] p-4 hover:shadow-xl transition-all duration-300 group animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="font-display text-2xl font-extrabold text-ink">{value}</p>
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

// =============================================================================
// Inspector rail — the details panel from sovereign.ops.wecrew.in/agents.
// Closed until a row is clicked. When nothing is selected it shows the queue's
// most urgent SLA clocks, mirroring the registry's idle "Lowest trust" list.
// =============================================================================

/** Compact age, e.g. "14h" / "3d". Kept local; the table uses relative "ago" text. */
function shortAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function InspectorChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="cx-inspector__chip">
      <span className="cx-inspector__chip-key">{label}</span>
      <span className="cx-inspector__chip-val" title={value}>{value}</span>
    </div>
  );
}

function IncidentInspector({
  incident,
  queue,
  onClose,
  onSelect,
  onOpen,
}: {
  incident: Incident | null;
  queue: Incident[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  // Idle list: unresolved incidents with the least SLA headroom first.
  const atRisk = useMemo(
    () =>
      queue
        .filter((i) => !['RESOLVED', 'CLOSED'].includes(i.state))
        .map((i) => ({ incident: i, sla: getSlaProgress(i) }))
        .sort((a, b) => b.sla.percent - a.sla.percent)
        .slice(0, 5),
    [queue]
  );

  const sla = incident ? getSlaProgress(incident) : null;
  const stateTone = (state: IncidentState) =>
    state === 'RESOLVED' || state === 'CLOSED' ? 'ok' : state === 'ON_HOLD' ? 'warn' : 'danger';

  return (
    <aside className="cx-inspector" aria-label="Incident details">
      <div className="cx-inspector__head">
        <span className="cx-inspector__head-label">Incident details</span>
        <button type="button" onClick={onClose} className="cx-inspector__close" aria-label="Close details panel">
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="cx-inspector__body">
        {incident && sla ? (
          <>
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="cx-inspector__eyebrow">{incident.category || 'uncategorised'}</span>
                <span className={clsx('cx-inspector__status', `cx-inspector__status--${stateTone(incident.state)}`)}>
                  {STATE_CONFIG[incident.state]?.label ?? incident.state}
                </span>
              </div>
              <h3 className="cx-inspector__title">{incident.number}</h3>
              <p className="cx-inspector__deck">{incident.shortDescription}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <InspectorChip label="priority" value={incident.priority} />
              <InspectorChip
                label="assignee"
                value={
                  incident.assignedTo
                    ? `${incident.assignedTo.firstName} ${incident.assignedTo.lastName}`
                    : 'unassigned'
                }
              />
              <InspectorChip label="source" value={(incident.source || 'unknown').toLowerCase()} />
              {incident.configItem?.name && <InspectorChip label="ci" value={incident.configItem.name} />}
              {incident.assignmentGroup?.name && (
                <InspectorChip label="group" value={incident.assignmentGroup.name} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="cx-inspector__stat">
                <div className="cx-inspector__stat-label">Age</div>
                <div className="cx-inspector__stat-value">{shortAge(incident.createdAt)}</div>
              </div>
              <div className="cx-inspector__stat">
                <div className="cx-inspector__stat-label">Impact</div>
                <div className="cx-inspector__stat-value">
                  {incident.impact ? incident.impact.charAt(0).toUpperCase() : '—'}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="cx-inspector__eyebrow">SLA budget</span>
                <span
                  className={clsx(
                    'font-mono text-[10.5px]',
                    sla.status === 'danger' ? 'text-[#ff9f94]' : sla.status === 'warning' ? 'text-[#fcd34d]' : 'text-white/70'
                  )}
                >
                  {incident.slaBreached ? 'breached' : `${sla.percent}%`}
                </span>
              </div>
              <div className="cx-inspector__meter mt-1.5">
                <div
                  className={clsx(
                    'cx-inspector__meter-fill',
                    sla.status === 'danger' && 'cx-inspector__meter-fill--danger',
                    sla.status === 'warning' && 'cx-inspector__meter-fill--warn'
                  )}
                  style={{ width: `${sla.percent}%` }}
                />
              </div>
            </div>

            <div>
              <h3 className="cx-inspector__section">Opened</h3>
              <p className="cx-inspector__muted">{new Date(incident.createdAt).toLocaleString()}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="cx-inspector__eyebrow">Jumps</span>
              <button
                type="button"
                onClick={() => onOpen(incident.id)}
                className="cx-inspector__jump cx-inspector__jump--primary"
              >
                <ArrowUpRight size={13} strokeWidth={2} />
                Open incident
              </button>
              <button type="button" onClick={onClose} className="cx-inspector__jump">
                Back to queue
              </button>
            </div>

            <p className="cx-inspector__foot">
              This panel is read-only. Use Open incident to edit, assign or add work notes.
            </p>
          </>
        ) : (
          <>
            <div>
              <h3 className="cx-inspector__section">Select an incident</h3>
              <p className="cx-inspector__muted">
                Click a queue row to inspect priority, SLA and assignment here.
              </p>
            </div>

            <div>
              <h3 className="cx-inspector__section">Closest to breach</h3>
              {atRisk.length === 0 ? (
                <p className="cx-inspector__muted">Nothing open in this page of the queue.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-0.5">
                  {atRisk.map(({ incident: i, sla: s }) => (
                    <li key={i.id}>
                      <button type="button" onClick={() => onSelect(i.id)} className="cx-inspector__row">
                        <span className="min-w-0">
                          <span className="cx-inspector__row-name block">{i.shortDescription}</span>
                          <span className="cx-inspector__row-meta">{i.number} · {i.priority}</span>
                        </span>
                        <span
                          className={clsx(
                            'cx-inspector__row-score',
                            s.status === 'danger' && 'text-[#ff9f94]',
                            s.status === 'warning' && 'text-[#fcd34d]'
                          )}
                        >
                          {i.slaBreached ? '!' : `${s.percent}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
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
            <div className={clsx('rounded-xl border border-stone-800 bg-obsidian text-ink overflow-hidden border-t-[3px]', config.borderColor)}>
              <div className="px-3 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wide">{config.label}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-stone-400 bg-[color:var(--argus-elevated)] rounded-full px-2 py-0.5 border border-stone-700">
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
  const updateIncident = useUpdateIncident();
  const { data: teamsData } = useTeams();
  const { data: usersData } = useQuery({
    queryKey: ['auth-users-bulk'],
    queryFn: async () => { const { data } = await api.get('/auth/users?limit=200'); return data; },
    staleTime: 120000,
  });

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
  const [inspectId, setInspectId] = useState<string | null>(null);
  // Kept separate from inspectId so the rail can be opened on its own (showing
  // the closest-to-breach list) the way the registry's toggle does.
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkTeamId, setBulkTeamId] = useState('');
  const [bulkUserId, setBulkUserId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

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

  // Row click opens the inspector rather than navigating, matching the Agent
  // Registry ("row click opens details"). The direct route to the full record
  // is still one keystroke away: Enter on a focused row, or Open incident in
  // the panel.
  const handleRowClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) return;
      setInspectId((prev) => (prev === id ? null : id));
      setInspectorOpen(true);
    },
    []
  );

  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
    setInspectId(null);
  }, []);

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
  const inspected = inspectId ? incidents.find((i) => i.id === inspectId) ?? null : null;

  return (
    <Page className={clsx(inspectorOpen && 'cx-page--inspect')}>
      {/* ═══════════════════════════════════════════════
          HERO — ink panel with the queue's stats inline,
          matching the Sovereign Agent Registry layout.
          ═══════════════════════════════════════════════ */}
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <span className="cx-eyebrow">Operate · service desk</span>

            <h1 className="cx-hero__title">Incidents</h1>

            <p className="cx-hero__deck">
              Monitor, triage and resolve service incidents. Select a row to open the full
              record — timeline, evidence and linked changes stay one click away.
            </p>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/incidents/create')}
                className="cx-hero__btn"
              >
                <Plus size={13} /> New incident
              </button>
              {/* Segmented view switcher. Uses cx-hero__btn rather than a
                  Tailwind bg-white: the dark shim rewrites .bg-white to
                  --argus-surface, which would leave ink text on a dark pill. */}
              <div
                className="flex items-center gap-0.5 rounded p-0.5"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)' }}
                role="group"
                aria-label="View mode"
              >
                {([
                  { value: 'table', label: 'Table', icon: LayoutList },
                  { value: 'board', label: 'Board', icon: Kanban },
                  { value: 'timeline', label: 'Timeline', icon: CalendarClock },
                ] as const).map((opt) => {
                  const Icon = opt.icon;
                  const isActive = viewMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setViewMode(opt.value as ViewMode); setFocusedRowIdx(-1); }}
                      aria-pressed={isActive}
                      className={clsx(
                        'cx-hero__btn !min-h-[28px] !px-2.5 !text-[12px]',
                        !isActive && 'cx-hero__btn--ghost !border-transparent !bg-transparent'
                      )}
                    >
                      <Icon size={13} strokeWidth={1.75} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <dl className="cx-hero__kpis cx-hero__kpis--5">
            {([
              { label: 'Active', value: stats.active, sub: 'open', tone: undefined },
              { label: 'Critical', value: stats.critical, sub: 'p1', tone: 'danger' as const },
              { label: 'High', value: stats.high, sub: 'p2', tone: 'warn' as const },
              {
                label: 'SLA breach',
                value: stats.slaBreach,
                sub: 'breached',
                tone: stats.slaBreach > 0 ? ('danger' as const) : undefined,
              },
              { label: 'Resolved', value: stats.resolvedToday, sub: 'today', tone: undefined },
            ]).map((kpi) => (
              <div
                key={kpi.label}
                className={clsx('cx-hero__kpi', kpi.tone && `cx-hero__kpi--${kpi.tone}`)}
              >
                <dt className="cx-hero__kpi-label">{kpi.label}</dt>
                <dd>
                  <div className="cx-hero__kpi-value">{isLoading ? '—' : kpi.value}</div>
                  <div className="cx-hero__kpi-sub">{kpi.sub}</div>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Breadcrumb + section heading, as on the Agent Registry */}
      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operate</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Incidents</span>
      </nav>

      <div className="cx-sectionhead">
        <div className="min-w-0">
          <h2 className="cx-sectionhead__title">Queue</h2>
          <p className="cx-sectionhead__deck">
            Search, filter and sort the queue. Click a row to inspect it in the details panel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (inspectorOpen ? closeInspector() : setInspectorOpen(true))}
          className="cx-sectionhead__meta hover:text-ink transition-colors"
          aria-pressed={inspectorOpen}
        >
          <PanelRight size={13} strokeWidth={1.75} />
          {inspectorOpen ? 'Hide details panel' : 'Row click opens details'}
        </button>
      </div>

      <div className="cx-posture">
        <ShieldAlert size={14} strokeWidth={1.75} className="text-emerald" aria-hidden />
        <span className="text-[12px] font-medium text-emerald">
          {stats.slaBreach > 0 ? `${stats.slaBreach} SLA breach${stats.slaBreach === 1 ? '' : 'es'} need attention` : 'No SLA breaches'}
        </span>
        <span className="cx-posture__chip">{stats.active} active</span>
        <span className="cx-posture__chip">{stats.critical} critical</span>
        <span className="cx-posture__chip">{stats.resolvedToday} resolved today</span>
      </div>

      <Toolbar>
          {/* Record count + summary, as on the Agent Registry panel head */}
          <div className="cx-listhead__count">
            <span className="cx-listhead__count-value">
              {isLoading ? '—' : `${pagination.total} incident${pagination.total === 1 ? '' : 's'}`}
            </span>
            <span className="cx-listhead__count-meta">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : `page ${pagination.page} of ${pagination.totalPages || 1}`}
            </span>
          </div>

          <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search incidents..."
              className="input-field pl-8 pr-12 py-1.5 text-[13px]"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-dim bg-elevated border border-[color:var(--argus-border)] rounded px-1.5 py-0.5 font-mono hidden sm:inline-block">
              {'\u2318'}K
            </kbd>
          </div>

          <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

          {/* Priority pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-dim uppercase tracking-wider font-semibold mr-0.5">Priority</span>
            {ALL_PRIORITIES.map((p) => {
              const isActive = activePriorities.has(p);
              const config = PRIORITY_CONFIG[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePriority(p)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors border',
                    isActive
                      ? 'bg-ink text-white border-[color:var(--argus-ink)]'
                      : 'bg-surface text-muted border-[color:var(--argus-border)] hover:border-[color:var(--argus-border-strong)]'
                  )}
                >
                  <span className={clsx('w-1.5 h-1.5 rounded-full', config.dotClass)} />
                  {p}
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

          {/* State filter dropdown */}
          <div className="relative" ref={stateDropdownRef}>
            <button
              type="button"
              onClick={() => setShowStateFilter(!showStateFilter)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border',
                activeStates.size > 0
                  ? 'bg-[color:var(--argus-signal-dim)] text-signal border-[color:var(--argus-signal)]/30'
                  : 'bg-surface text-muted border-[color:var(--argus-border)] hover:border-[color:var(--argus-border-strong)]'
              )}
            >
              <Filter size={13} />
              State
              {activeStates.size > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-ink text-[9px] flex items-center justify-center font-bold">
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
      </Toolbar>

      {isLoading ? (
        <SkeletonTable />
      ) : incidents.length === 0 ? (
        <EmptyState onCreateClick={() => navigate('/incidents/create')} />
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div ref={tableRef} className="cx-table-wrap">
          <div className="overflow-x-auto">
            <table className="cx-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={incidents.length > 0 && selectedIds.size === incidents.length}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-[color:var(--argus-border)] text-signal focus:ring-signal cursor-pointer"
                    />
                  </th>
                  <th>
                    <button type="button" onClick={() => handleSort('priority')} className="flex items-center hover:text-ink transition-colors">
                      Priority <SortIndicator field="priority" />
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => handleSort('number')} className="flex items-center hover:text-ink transition-colors">
                      Number <SortIndicator field="number" />
                    </button>
                  </th>
                  <th className="min-w-[280px]">
                    <button type="button" onClick={() => handleSort('shortDescription')} className="flex items-center hover:text-ink transition-colors">
                      Title <SortIndicator field="shortDescription" />
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => handleSort('state')} className="flex items-center hover:text-ink transition-colors">
                      State <SortIndicator field="state" />
                    </button>
                  </th>
                  <th>Assignee</th>
                  <th>SLA</th>
                  <th>
                    <button type="button" onClick={() => handleSort('createdAt')} className="flex items-center hover:text-ink transition-colors">
                      Time <SortIndicator field="createdAt" />
                    </button>
                  </th>
                  <th className="text-center w-20">Actions</th>
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
        onAssign={() => setShowBulkAssign(true)}
        onEscalate={async () => {
          const ids = Array.from(selectedIds);
          if (ids.length === 0) return;

          // Selection survives pagination, so `incidents` (this page only) is not
          // the selection. Filtering against it silently dropped everything picked
          // on another page while the toast still claimed success. Rows we can see
          // are pre-filtered by state; rows we cannot are sent and judged by the
          // server, and the toast reports what actually happened.
          const visible = new Map(incidents.map((i) => [i.id, i]));
          const terminal = ['RESOLVED', 'CLOSED', 'ESCALATED'];
          const skipped = ids.filter((id) => {
            const inc = visible.get(id);
            return inc ? terminal.includes(inc.state) : false;
          });
          const attempt = ids.filter((id) => !skipped.includes(id));

          if (attempt.length === 0) {
            toast.error('No selected incidents can be escalated');
            return;
          }

          setBulkBusy(true);
          try {
            const results = await Promise.allSettled(
              attempt.map((id) => updateIncident.mutateAsync({ id, data: { state: 'ESCALATED' } })),
            );
            const ok = results.filter((r) => r.status === 'fulfilled').length;
            const failed = results.length - ok;

            if (ok > 0) {
              const notes = [
                failed > 0 ? `${failed} failed` : null,
                skipped.length > 0 ? `${skipped.length} already closed or escalated` : null,
              ].filter(Boolean);
              toast.success(
                `Escalated ${ok} incident${ok === 1 ? '' : 's'}` +
                  (notes.length ? ` · ${notes.join(' · ')}` : ''),
              );
            } else {
              toast.error('Bulk escalate failed for every selected incident');
            }

            // Keep anything that did not go through, so a partial failure is
            // visible and retryable rather than silently cleared.
            const failedIds = attempt.filter((_, idx) => results[idx].status === 'rejected');
            setSelectedIds(new Set(failedIds));
          } catch (err: any) {
            toast.error(err?.response?.data?.error || err?.message || 'Bulk escalate failed');
          } finally {
            setBulkBusy(false);
          }
        }}
        onExport={async () => {
          const ids = Array.from(selectedIds);
          if (ids.length === 0) return;
          setBulkBusy(true);
          try {
            const result = await downloadBulkReport(ids, 'pdf');
            const dateStr = new Date().toISOString().slice(0, 10);
            triggerDownload(result as Blob, `bulk-incident-report-${dateStr}.pdf`);
            toast.success(`Exported ${ids.length} incident${ids.length === 1 ? '' : 's'}`);
          } catch (err: any) {
            try {
              const result = await downloadBulkReport(ids, 'json');
              const dateStr = new Date().toISOString().slice(0, 10);
              triggerJsonDownload(result as object, `bulk-incident-report-${dateStr}.json`);
              toast.success(`Exported ${ids.length} as JSON`);
            } catch (err2: any) {
              toast.error(err2?.message || err?.message || 'Bulk export failed');
            }
          } finally {
            setBulkBusy(false);
          }
        }}
      />

      {showBulkAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => !bulkBusy && setShowBulkAssign(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">
                Assign {selectedIds.size} incident{selectedIds.size === 1 ? '' : 's'}
              </h3>
              <button type="button" onClick={() => setShowBulkAssign(false)} className="p-1.5 rounded-lg hover:bg-stone-100" disabled={bulkBusy}>
                <X size={16} className="text-stone-400" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Team</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
                  value={bulkTeamId}
                  onChange={(e) => setBulkTeamId(e.target.value)}
                >
                  <option value="">No team change</option>
                  {(teamsData?.data || []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Assignee</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
                  value={bulkUserId}
                  onChange={(e) => setBulkUserId(e.target.value)}
                >
                  <option value="">No assignee change</option>
                  {(usersData?.data || []).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => setShowBulkAssign(false)}
                  className="px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkBusy || (!bulkTeamId && !bulkUserId)}
                  onClick={async () => {
                    if (!bulkTeamId && !bulkUserId) {
                      toast.error('Select a team or assignee');
                      return;
                    }
                    const patch: Record<string, string> = {};
                    if (bulkTeamId) patch.assignmentGroupId = bulkTeamId;
                    if (bulkUserId) patch.assignedToId = bulkUserId;
                    setBulkBusy(true);
                    try {
                      await Promise.all(
                        Array.from(selectedIds).map((id) => updateIncident.mutateAsync({ id, data: patch })),
                      );
                      toast.success(`Assigned ${selectedIds.size} incident${selectedIds.size === 1 ? '' : 's'}`);
                      setSelectedIds(new Set());
                      setShowBulkAssign(false);
                      setBulkTeamId('');
                      setBulkUserId('');
                    } catch (err: any) {
                      toast.error(err?.response?.data?.error || err?.message || 'Bulk assign failed');
                    } finally {
                      setBulkBusy(false);
                    }
                  }}
                  className="px-3 py-1.5 text-sm font-medium bg-amber-500 text-stone-950 rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {bulkBusy && <Loader2 size={14} className="animate-spin" />}
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacer when bulk bar is visible */}
      {selectedIds.size > 0 && <div className="h-16" />}

      {inspectorOpen && (
        <IncidentInspector
          incident={inspected}
          queue={incidents}
          onClose={closeInspector}
          onSelect={setInspectId}
          onOpen={(id) => navigate(`/incidents/${id}`)}
        />
      )}
    </Page>
  );
}
