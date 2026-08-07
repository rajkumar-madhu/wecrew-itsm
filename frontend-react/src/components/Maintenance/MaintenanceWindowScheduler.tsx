import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Trash2, Clock, CheckCircle, AlertCircle, Loader2, ChevronRight, Wrench, X } from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Change {
  id: string; number: string; shortDescription: string; changeType: string;
  state: string; plannedStart?: string; plannedEnd?: string; category?: string;
  organization?: { name: string };
}

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

function windowStatus(w: Change): { label: string; color: string; bg: string; border: string } {
  const now = Date.now();
  const start = w.plannedStart ? new Date(w.plannedStart).getTime() : 0;
  const end = w.plannedEnd ? new Date(w.plannedEnd).getTime() : 0;
  if (now >= start && now <= end) return { label: 'ACTIVE', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' };
  if (now < start) return { label: 'UPCOMING', color: '#6366F1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)' };
  return { label: 'COMPLETED', color: '#475569', bg: 'rgba(71,85,105,0.1)', border: 'rgba(71,85,105,0.25)' };
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function WeekTimeline({ windows }: { windows: Change[] }) {
  const now = Date.now();
  const weekStart = now - 24 * 60 * 60 * 1000; // yesterday
  const weekEnd   = now + 6 * 24 * 60 * 60 * 1000; // +6 days
  const weekLen   = weekEnd - weekStart;

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
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden mb-5">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-stone-100">
        <CalendarClock className="w-4 h-4 text-[#6366F1]" />
        <span className="text-xs font-bold text-stone-900">7-Day Window View</span>
        <span className="text-[10px] text-stone-400">today ± 6 days</span>
      </div>
      <div className="p-4">
        {/* Day markers */}
        <div className="relative h-2 mb-1">
          {days.map(d => (
            <div key={d.ts} className="absolute text-[9px] text-stone-400 -translate-x-1/2"
              style={{ left: `${((d.ts - weekStart) / weekLen) * 100}%` }}>
              {d.label}
            </div>
          ))}
        </div>

        {/* Timeline track */}
        <div className="relative h-8 mt-4" style={{ background: '#FAFAF9', borderRadius: 6 }}>
          {/* NOW line */}
          <div className="absolute top-0 bottom-0 w-px bg-[#EF4444] z-10"
            style={{ left: `${((now - weekStart) / weekLen) * 100}%` }}>
            <div className="absolute -top-4 -translate-x-1/2 text-[8px] font-bold text-[#EF4444]">NOW</div>
          </div>

          {/* Window bands */}
          {relevant.map(w => {
            const s = Math.max(new Date(w.plannedStart || '').getTime(), weekStart);
            const e = Math.min(new Date(w.plannedEnd || '').getTime(), weekEnd);
            const left = ((s - weekStart) / weekLen) * 100;
            const width = ((e - s) / weekLen) * 100;
            const st = windowStatus(w);
            return (
              <div key={w.id} title={w.shortDescription}
                className="absolute top-1 bottom-1 rounded cursor-default"
                style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%`, background: st.bg, border: `1px solid ${st.border}` }}>
                <div className="px-1 text-[8px] font-bold truncate leading-6" style={{ color: st.color }}>
                  {w.shortDescription}
                </div>
              </div>
            );
          })}

          {relevant.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-stone-300">No windows scheduled</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MaintenanceWindowScheduler() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // Form state
  const [form, setForm] = useState({
    shortDescription: '',
    description: '',
    plannedStart: '',
    plannedEnd: '',
    category: 'Maintenance',
    changeType: 'STANDARD',
  });

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Fetch maintenance windows (Changes with category=Maintenance)
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

  const active   = windows.filter(w => windowStatus(w).label === 'ACTIVE');
  const upcoming = windows.filter(w => windowStatus(w).label === 'UPCOMING');
  const past     = windows.filter(w => windowStatus(w).label === 'COMPLETED').slice(0, 10);

  return (
    <div className="animate-fade-in space-y-0">

      {/* ── Hero ── */}
      <div className="relative rounded-2xl overflow-hidden mb-5 bg-white shadow-card border border-stone-200">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative px-6 py-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
                <Wrench className="w-4 h-4 text-indigo-400" />
              </div>
              <h1 className="font-display text-2xl font-bold text-stone-900">Maintenance Windows</h1>
              {active.length > 0 && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)' }}>
                  {active.length} ACTIVE
                </span>
              )}
            </div>
            <p className="text-stone-500 text-sm ml-[42px]">Schedule planned downtime to suppress false alerts during deployments and upgrades.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' }}
          >
            <Plus className="w-4 h-4" />
            Schedule Window
          </button>
        </div>
        {/* KPI pills */}
        <div className="px-6 pb-4 ml-[42px] flex gap-3">
          {[
            { label: 'Active Now', val: active.length, color: '#10B981' },
            { label: 'Upcoming', val: upcoming.length, color: '#6366F1' },
            { label: 'Completed', val: past.length, color: '#475569' },
          ].map(p => (
            <div key={p.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#F5F5F4', border: '1px solid #E7E5E4' }}>
              <span className="text-lg font-black" style={{ color: p.color }}>{p.val}</span>
              <span className="text-[10px]" style={{ color: '#78716C' }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={clsx('flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4',
          toast.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
        )}>
          {toast.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* ── 7-day timeline ── */}
      <WeekTimeline windows={[...active, ...upcoming]} />

      {/* ── Create form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }} />
          <div className="relative rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}
            style={{ background: '#FFFFFF', border: '1px solid #E7E5E4' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-stone-900">Schedule Maintenance Window</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Window Name *</label>
                <input value={form.shortDescription} onChange={e => setF('shortDescription', e.target.value)}
                  placeholder="e.g. Database upgrade — prod cluster"
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-stone-900 placeholder-stone-400"
                  style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Reason / Description</label>
                <textarea value={form.description} onChange={e => setF('description', e.target.value)}
                  rows={2} placeholder="What work is being done?"
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-stone-900 placeholder-stone-400 resize-none"
                  style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Start Time *</label>
                  <input type="datetime-local" value={form.plannedStart} onChange={e => setF('plannedStart', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-stone-900"
                    style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">End Time *</label>
                  <input type="datetime-local" value={form.plannedEnd} onChange={e => setF('plannedEnd', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-stone-900"
                    style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => create.mutate()}
                disabled={!form.shortDescription || !form.plannedStart || !form.plannedEnd || create.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' }}
              >
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                Schedule
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-stone-500"
                style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Windows list ── */}
      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#334155] animate-spin" /></div>
      )}

      {!isLoading && [...active, ...upcoming, ...past].length === 0 && (
        <div className="text-center py-16 bg-stone-50 rounded-2xl border border-stone-200">
          <CalendarClock className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">No maintenance windows scheduled.</p>
          <p className="text-stone-400 text-xs mt-1">Click "Schedule Window" to plan your first maintenance period.</p>
        </div>
      )}

      {[
        { label: 'Active', items: active, color: '#10B981' },
        { label: 'Upcoming', items: upcoming, color: '#6366F1' },
        { label: 'Completed', items: past, color: '#475569' },
      ].filter(g => g.items.length > 0).map(group => (
        <div key={group.label} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ background: group.color }} />
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">{group.label}</span>
            <span className="text-[10px] text-stone-400">{group.items.length}</span>
          </div>
          <div className="space-y-2">
            {group.items.map(w => {
              const st = windowStatus(w);
              return (
                <div key={w.id} className="flex items-center gap-4 px-5 py-4 rounded-xl bg-white border shadow-sm"
                  style={{ borderColor: st.border }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-stone-900 truncate">{w.shortDescription}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-stone-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {w.plannedStart ? formatDT(w.plannedStart) : '—'}
                        <ChevronRight className="w-3 h-3" />
                        {w.plannedEnd ? formatDT(w.plannedEnd) : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {st.label === 'ACTIVE' && w.plannedEnd && (
                      <div className="text-xs font-bold text-[#10B981] mb-1">{countdown(w.plannedEnd)}</div>
                    )}
                    {st.label === 'UPCOMING' && w.plannedStart && (
                      <div className="text-xs text-[#6366F1] mb-1">Starts {new Date(w.plannedStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                    )}
                    {w.number && <div className="text-[10px] font-mono text-stone-400">{w.number}</div>}
                  </div>
                  {st.label !== 'ACTIVE' && (
                    <button onClick={() => { if (confirm('Delete this window?')) deleteWindow.mutate(w.id); }}
                      className="p-1.5 rounded-lg text-[#EF4444] hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
