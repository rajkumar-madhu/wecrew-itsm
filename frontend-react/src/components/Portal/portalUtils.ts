import { useEffect, useState } from 'react';
import type { IncidentState, RequestState } from '../../hooks/usePortal';

export type Tone = 'neutral' | 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'muted';

export const REQUEST_STATUS: Record<RequestState, { label: string; tone: Tone }> = {
  SUBMITTED: { label: 'Submitted', tone: 'info' },
  PENDING_APPROVAL: { label: 'Waiting for approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'info' },
  IN_FULFILLMENT: { label: 'Being worked on', tone: 'progress' },
  FULFILLED: { label: 'Done', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export const INCIDENT_STATUS: Record<IncidentState, { label: string; tone: Tone }> = {
  NEW: { label: 'Received', tone: 'info' },
  IN_PROGRESS: { label: 'Being worked on', tone: 'progress' },
  ESCALATED: { label: 'Being worked on', tone: 'progress' },
  ON_HOLD: { label: 'Waiting on you', tone: 'warning' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  CLOSED: { label: 'Resolved', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export function requestStatus(state: string) {
  return REQUEST_STATUS[state as RequestState] ?? { label: humanize(state), tone: 'neutral' as Tone };
}

export function incidentStatus(state: string) {
  return INCIDENT_STATUS[state as IncidentState] ?? { label: humanize(state), tone: 'neutral' as Tone };
}

export function isRequestRateable(state: string, csatScore: number | null | undefined) {
  return state === 'FULFILLED' && (csatScore == null);
}

export function isIncidentRateable(state: string, csatScore: number | null | undefined) {
  return (state === 'RESOLVED' || state === 'CLOSED') && (csatScore == null);
}

export function isRequestCancellable(state: string) {
  return state === 'SUBMITTED' || state === 'PENDING_APPROVAL';
}

export function humanize(s: string) {
  const t = s.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
  ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  : null;

/** "5 minutes ago", "yesterday", or a short date for anything older than a week. */
export function timeAgo(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (!rtf || abs > 7 * 86400) return formatDate(iso);
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatHours(h: number) {
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'}`;
  const days = Math.round((h / 24) * 10) / 10;
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** Returns `value` after it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
