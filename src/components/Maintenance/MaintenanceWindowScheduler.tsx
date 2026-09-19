import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock, Plus, Trash2, Clock, CheckCircle, AlertCircle,
  Loader2, ChevronRight, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';
import { Page, Toolbar, Panel } from '../ui/PageChrome';

interface Change {
  id: string; number: string; shortDescription: string; changeType: string;
  state: string; plannedStart?: string; plannedEnd?: string; category?: string;
  organization?: { name: string };
}

type WindowKind = 'active' | 'upcoming' | 'completed';

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function countdown(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
}

function windowStatus(w: Change): { kind: WindowKind; label: string } {
  const now = Date.now();
  const start = w.plannedStart ? new Date(w.plannedStart).getTime() : 0;
  const end = w.plannedEnd ? new Date(w.plannedEnd).getTime() : 0;
  if (now >= start && now <= end) return { kind: 'active', label: 'Active' };
  if (now < start) return { kind: 'upcoming', label: 'Upcoming' };
  return { kind: 'completed', label: 'Completed' };
}

function WeekTimeline({ windows }: { windows: Change[] }) {
  const now = Date.now();
  const weekStart = now - 24 * 60 * 60 * 1000;
  const weekEnd = now + 6 * 24 * 60 * 60 * 1000;
  const weekLen = weekEnd - weekStart;

  const days = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(weekStart + i * 24 * 60 * 60 * 1000);
    return { label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }), ts: d.getTime() };
  });

  const relevant = windows.filter(w => {
    const s = w.plannedStart ? new Date(w.plannedStart).getTime() : 0;
    const e = w.plannedEnd ? new Date(w.plannedEnd).getTime() : 0;
    return e >= weekStart && s <= weekEnd;
  });

  return (
    <div className="cx-track">
      <div className="cx-track__head">
        <span className="text-[12px] font-semibold text-ink">This week</span>
        <div className="cx-track__legend">
          <span className="cx-track__key"><span className="cx-track__swatch cx-track__swatch--active" /> Active</span>
          <span className="cx-track__key"><span className="cx-track__swatch cx-track__swatch--upcoming" /> Upcoming</span>
          <span>yesterday → +6 days</span>
        </div>
      </div>
      <div className="cx-track__body">
        <div className="cx-track__days">
          {days.map(d => (
            <div key={d.ts} className="cx-track__day" style={{ left: `${((d.ts - weekStart) / weekLen) * 100}%` }}>
              {d.label}
            </div>
          ))}
        </div>
        <div className="cx-track__rail">
          <div className="cx-track__now" style={{ left: `${((now - weekStart) / weekLen) * 100}%` }}>
            <span className="cx-track__now-label">Now</span>
          </div>
          {relevant.map(w => {
            const s = Math.max(new Date(w.plannedStart || '').getTime(), weekStart);
            const e = Math.min(new Date(w.plannedEnd || '').getTime(), weekEnd);
            const left = ((s - weekStart) / weekLen) * 100;
            const width = ((e - s) / weekLen) * 100;
            const st = windowStatus(w);
            return (
              <div
                key={w.id}
                title={w.shortDescription}
                className={clsx('cx-track__band', st.kind === 'active' ? 'cx-track__band--active' : 'cx-track__band--upcoming')}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
              >
                <div className="cx-track__band-label">{w.shortDescription}</div>
              </div>
            );
          })}
          {relevant.length === 0 && (
            <div className="cx-track__empty">No windows on this rail</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MaintenanceWindowScheduler() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const [form, setForm] = useState({
    shortDescription: '',
    description: '',
    plannedStart: '',
    plannedEnd: '',
    category: 'Maintenance',
    changeType: 'STANDARD',
  });

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-windows'],
    queryFn: () => api.get('/changes?category=Maintenance&limit=50').then(r => r.data),
    staleTime: 30000,
  });
  const windows: Change[] = data?.data || [];

  const create = useMutation({
    mutationFn: () => api.post('/changes', {
      ...form,
      shortDescription: form.shortDescription || 'Maintenance Window',
      riskLevel: 'LOW',
      impact: 'TEAM',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-windows'] });
      setToast({ ok: true, msg: 'Maintenance window scheduled' });
      setShowForm(false);
      setForm({ shortDescription: '', description: '', plannedStart: '', plannedEnd: '', category: 'Maintenance', changeType: 'STANDARD' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (e: any) => {
      setToast({ ok: false, msg: e?.response?.data?.error || 'Failed to create window' });
      setTimeout(() => setToast(null), 4000);
    },
  });

  const deleteWindow = useMutation({
    mutationFn: (id: string) => api.delete(`/changes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance-windows'] }),
  });

  const active = windows.filter(w => windowStatus(w).kind === 'active');
  const upcoming = windows.filter(w => windowStatus(w).kind === 'upcoming');
  const past = windows.filter(w => windowStatus(w).kind === 'completed').slice(0, 10);
  const listed = [...active, ...upcoming, ...past];

  const kpis = [
    { label: 'Active now', value: isLoading ? '—' : active.length, sub: 'alerts should be quiet', tone: active.length > 0 ? 'warn' : undefined },
    { label: 'Upcoming', value: isLoading ? '—' : upcoming.length, sub: 'on the calendar' },
    { label: 'Completed', value: isLoading ? '—' : past.length, sub: 'recent windows' },
    { label: 'On record', value: isLoading ? '—' : windows.length, sub: 'category = Maintenance' },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Operate · change management</span>
            <h1 className="cx-hero__title">Maintenance</h1>
            <p className="cx-hero__deck">
              Planned downtime, placed on a week so the rest of the estate knows when not to page.
              An active window with no record here is how false alerts get through.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/changes" className="cx-hero__btn cx-hero__btn--ghost">Change register</Link>
            <button type="button" onClick={() => setShowForm(true)} className="cx-hero__btn">
              <Plus size={14} strokeWidth={1.75} />
              Schedule a window
            </button>
          </div>
        </div>
        <dl className="cx-hero__kpis mt-6">
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
        <Link to="/changes">Changes</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Maintenance</span>
      </nav>

      {toast && (
        <div className={clsx(
          'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm',
          toast.ok ? 'bg-emerald-dim text-emerald' : 'bg-crimson-dim text-crimson',
        )}>
          {toast.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="cx-sectionhead">
        <div>
          <h2 className="cx-sectionhead__title">Forward rail</h2>
          <p className="cx-sectionhead__deck">
            Yesterday through the next six days. Coral is now; emerald is live; blue is booked.
          </p>
        </div>
      </div>

      <WeekTimeline windows={[...active, ...upcoming]} />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0" style={{ background: 'var(--argus-overlay)' }} />
          <div
            className="relative w-full max-w-lg animate-fade-in"
            style={{ background: 'var(--argus-surface)', border: '1px solid var(--argus-border)', borderRadius: 'var(--cx-radius)', boxShadow: 'var(--argus-shadow-card)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--argus-border)' }}>
              <div>
                <p className="cx-eyebrow">Change · maintenance</p>
                <h2 className="cx-sectionhead__title" style={{ fontSize: '1.25rem' }}>Schedule a window</h2>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)]" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Window name *</label>
                <input
                  value={form.shortDescription}
                  onChange={e => setF('shortDescription', e.target.value)}
                  placeholder="e.g. Database upgrade — prod cluster"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Reason / description</label>
                <textarea
                  value={form.description}
                  onChange={e => setF('description', e.target.value)}
                  rows={2}
                  placeholder="What work is being done?"
                  className="input-field resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Start *</label>
                  <input type="datetime-local" value={form.plannedStart} onChange={e => setF('plannedStart', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">End *</label>
                  <input type="datetime-local" value={form.plannedEnd} onChange={e => setF('plannedEnd', e.target.value)} className="input-field" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--argus-border)' }}>
                <button
                  type="button"
                  onClick={() => create.mutate()}
                  disabled={!form.shortDescription || !form.plannedStart || !form.plannedEnd || create.isPending}
                  className="cx-btn cx-btn--primary flex-1 disabled:opacity-50"
                >
                  {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                  Schedule
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="cx-btn cx-btn--ghost">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="cx-sectionhead">
        <div>
          <h2 className="cx-sectionhead__title">Register</h2>
          <p className="cx-sectionhead__deck">
            Active, booked, and the last ten completed windows.
          </p>
        </div>
      </div>

      <Toolbar>
        <div className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {isLoading ? '—' : `${listed.length} window${listed.length === 1 ? '' : 's'}`}
          </span>
          <span className="cx-listhead__count-meta">
            {active.length} live · {upcoming.length} booked
          </span>
        </div>
      </Toolbar>

      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-dim animate-spin" /></div>
      )}

      {!isLoading && listed.length === 0 && (
        <Panel>
          <div className="text-center py-12">
            <CalendarClock className="w-10 h-10 text-graphite mx-auto mb-3" strokeWidth={1.75} />
            <p className="text-muted text-sm">No maintenance windows scheduled.</p>
            <p className="text-dim text-xs mt-1">Schedule a window so alerts stay quiet during the work.</p>
          </div>
        </Panel>
      )}

      {[
        { label: 'Active', items: active },
        { label: 'Upcoming', items: upcoming },
        { label: 'Completed', items: past },
      ].filter(g => g.items.length > 0).map(group => (
        <Panel key={group.label} title={group.label} titleExtra={<span className="text-[10px] text-dim font-mono ml-2">{group.items.length}</span>}>
          <div className="space-y-2">
            {group.items.map(w => {
              const st = windowStatus(w);
              return (
                <div
                  key={w.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border border-steel bg-[color:var(--argus-elevated)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-ink truncate">{w.shortDescription}</span>
                      <span
                        className={clsx(
                          'cx-pill',
                          st.kind === 'active' && 'cx-pill--ok',
                          st.kind === 'upcoming' && 'cx-pill--warn',
                          st.kind === 'completed' && 'cx-pill--neutral',
                        )}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {w.plannedStart ? formatDT(w.plannedStart) : '—'}
                        <ChevronRight className="w-3 h-3" />
                        {w.plannedEnd ? formatDT(w.plannedEnd) : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {st.kind === 'active' && w.plannedEnd && (
                      <div className="text-xs font-bold text-emerald mb-1">{countdown(w.plannedEnd)}</div>
                    )}
                    {st.kind === 'upcoming' && w.plannedStart && (
                      <div className="text-xs text-signal mb-1">
                        Starts {new Date(w.plannedStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {w.number && <div className="text-[10px] font-mono text-dim">{w.number}</div>}
                  </div>
                  {st.kind !== 'active' && (
                    <button
                      type="button"
                      onClick={() => { if (confirm('Delete this window?')) deleteWindow.mutate(w.id); }}
                      className="p-1.5 rounded-lg text-crimson hover:bg-crimson-dim transition-colors"
                      aria-label="Delete window"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </Page>
  );
}
