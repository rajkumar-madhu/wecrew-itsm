import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarClock, Save, X, Plus, Loader2, AlertTriangle, Info } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

// ISO weekday ("1" = Monday … "7" = Sunday) → [open, close]; missing = closed
type Schedule = Record<string, [string, string]>;

interface BusinessHours {
  configured: boolean;
  timezone: string;
  schedule: Schedule;
  holidays: string[];
}

const DAYS: { iso: string; label: string }[] = [
  { iso: '1', label: 'Monday' },
  { iso: '2', label: 'Tuesday' },
  { iso: '3', label: 'Wednesday' },
  { iso: '4', label: 'Thursday' },
  { iso: '5', label: 'Friday' },
  { iso: '6', label: 'Saturday' },
  { iso: '7', label: 'Sunday' },
];

const COMMON_ZONES = [
  'Asia/Kolkata', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Singapore', 'Asia/Dubai',
  'Europe/Berlin', 'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney',
];

const border = '1px solid rgba(99,179,255,0.12)';
const inputCls = 'rounded-lg px-2.5 py-1.5 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-[#6366F1]/40 disabled:opacity-50';
const inputStyle = { background: '#0F1B2D', border, color: '#E8F1FA', colorScheme: 'dark' as const };

function errMsg(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof msg === 'string' && msg ? msg : fallback;
}

function fmtHoliday(d: string) {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

interface DayRow { open: boolean; from: string; to: string }

function toRows(schedule: Schedule): Record<string, DayRow> {
  const rows: Record<string, DayRow> = {};
  for (const d of DAYS) {
    const span = schedule?.[d.iso];
    rows[d.iso] = span ? { open: true, from: span[0], to: span[1] } : { open: false, from: '09:00', to: '18:00' };
  }
  return rows;
}

function Form({ initial, canEdit }: { initial: BusinessHours; canEdit: boolean }) {
  const qc = useQueryClient();
  const [timezone, setTimezone] = useState(initial.timezone);
  const [rows, setRows] = useState(() => toRows(initial.schedule));
  const [holidays, setHolidays] = useState<string[]>(initial.holidays ?? []);
  const [newHoliday, setNewHoliday] = useState('');
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async (body: Omit<BusinessHours, 'configured'>) => {
      const { data } = await api.put('/sla/business-hours', body);
      return data.data as BusinessHours;
    },
    onSuccess: () => {
      toast.success('Business hours saved');
      setError('');
      qc.invalidateQueries({ queryKey: ['business-hours'] });
    },
    onError: (e) => {
      const msg = errMsg(e, 'Failed to save business hours');
      setError(msg);
      toast.error(msg);
    },
  });

  const setRow = (iso: string, patch: Partial<DayRow>) => setRows((r) => ({ ...r, [iso]: { ...r[iso], ...patch } }));

  function addHoliday() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) return;
    setHolidays((h) => (h.includes(newHoliday) ? h : [...h, newHoliday].sort()));
    setNewHoliday('');
  }

  function handleSave() {
    setError('');
    if (!timezone.trim()) { setError('Enter a timezone such as Asia/Kolkata'); return; }
    const schedule: Schedule = {};
    for (const d of DAYS) {
      const r = rows[d.iso];
      if (!r.open) continue;
      if (!r.from || !r.to || r.from >= r.to) {
        setError(`${d.label}: the closing time must be after the opening time`);
        return;
      }
      schedule[d.iso] = [r.from, r.to];
    }
    save.mutate({ timezone: timezone.trim(), schedule, holidays });
  }

  return (
    <div className="space-y-4">
      {!initial.configured && (
        <p className="flex items-center gap-2 text-[12px] rounded-xl px-3 py-2"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#C5D8E8' }}>
          <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#818CF8' }} />
          Using the default Mon–Fri 09:00–18:00. Save to set this organization's own hours.
        </p>
      )}

      <div className="max-w-sm">
        <label htmlFor="bh-timezone" className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8AABC4' }}>
          Timezone
        </label>
        <input id="bh-timezone" list="bh-timezones" value={timezone} disabled={!canEdit}
          onChange={(e) => setTimezone(e.target.value)} className={`${inputCls} w-full`} style={inputStyle}
          placeholder="Asia/Kolkata" />
        <datalist id="bh-timezones">
          {COMMON_ZONES.map((z) => <option key={z} value={z} />)}
        </datalist>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border }}>
        <table className="w-full text-[13px]">
          <thead style={{ background: '#0F1B2D' }}>
            <tr>
              {['Day', 'Open', 'From', 'To'].map((h) => (
                <th key={h} scope="col" className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8AABC4' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => {
              const r = rows[d.iso];
              return (
                <tr key={d.iso} style={{ borderTop: '1px solid rgba(99,179,255,0.08)' }}>
                  <th scope="row" className="text-left px-4 py-2 font-medium" style={{ color: '#E8F1FA' }}>{d.label}</th>
                  <td className="px-4 py-2">
                    <label htmlFor={`bh-open-${d.iso}`} className="flex items-center gap-2 text-[12px]" style={{ color: '#C5D8E8' }}>
                      <input id={`bh-open-${d.iso}`} type="checkbox" checked={r.open} disabled={!canEdit}
                        onChange={(e) => setRow(d.iso, { open: e.target.checked })} className="accent-[#6366F1]" />
                      {r.open ? 'Open' : 'Closed'}
                    </label>
                  </td>
                  <td className="px-4 py-2">
                    <label htmlFor={`bh-from-${d.iso}`} className="sr-only">{d.label} opening time</label>
                    <input id={`bh-from-${d.iso}`} type="time" value={r.from} disabled={!canEdit || !r.open}
                      onChange={(e) => setRow(d.iso, { from: e.target.value })} className={inputCls} style={inputStyle} />
                  </td>
                  <td className="px-4 py-2">
                    <label htmlFor={`bh-to-${d.iso}`} className="sr-only">{d.label} closing time</label>
                    <input id={`bh-to-${d.iso}`} type="time" value={r.to} disabled={!canEdit || !r.open}
                      onChange={(e) => setRow(d.iso, { to: e.target.value })} className={inputCls} style={inputStyle} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8AABC4' }}>Holidays</p>
        {canEdit && (
          <div className="flex items-end gap-2 mb-2">
            <div>
              <label htmlFor="bh-holiday" className="sr-only">Holiday date</label>
              <input id="bh-holiday" type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHoliday(); } }}
                className={inputCls} style={inputStyle} />
            </div>
            <button type="button" onClick={addHoliday} disabled={!newHoliday}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
              style={{ background: '#0F1B2D', border, color: '#C5D8E8' }}>
              <Plus className="w-3.5 h-3.5" /> Add holiday
            </button>
          </div>
        )}
        {holidays.length === 0 ? (
          <p className="text-[12px]" style={{ color: '#8AABC4' }}>No holidays — SLA clocks run on every open day.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {holidays.map((h) => (
              <li key={h} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-[12px]"
                style={{ background: '#0F1B2D', border, color: '#E8F1FA' }}>
                <time dateTime={h}>{fmtHoliday(h)}</time>
                {canEdit && (
                  <button type="button" onClick={() => setHolidays((all) => all.filter((x) => x !== h))}
                    aria-label={`Remove holiday ${h}`} className="p-0.5 rounded-full hover:bg-[rgba(220,38,38,0.15)]"
                    style={{ color: '#8AABC4' }}>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]"
          style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)', color: '#FCA5A5' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}

      {canEdit && (
        <button onClick={handleSave} disabled={save.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-50"
          style={{ background: '#059669', color: '#FFFFFF' }}>
          {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save business hours
        </button>
      )}
    </div>
  );
}

export default function BusinessHoursEditor({ canEdit }: { canEdit: boolean }) {
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['business-hours', selectedOrgId],
    queryFn: async (): Promise<BusinessHours> => {
      const { data } = await api.get('/sla/business-hours');
      return data.data;
    },
    retry: false,
    staleTime: 60000,
  });

  return (
    <section aria-labelledby="bh-heading" className="rounded-2xl p-5" style={{ background: '#0B1424', border }}>
      <h2 id="bh-heading" className="text-[15px] font-display font-bold flex items-center gap-2" style={{ color: '#E8F1FA' }}>
        <CalendarClock className="w-4 h-4" style={{ color: '#34D399' }} /> Business hours
      </h2>
      <p className="text-[12px] mt-0.5 mb-4" style={{ color: '#8AABC4' }}>
        Policies marked “business hours only” pause their SLA clock outside these hours and on holidays.
      </p>
      {isLoading ? (
        <p className="flex items-center gap-2 text-[12px]" style={{ color: '#8AABC4' }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading business hours…
        </p>
      ) : isError || !data ? (
        <p role="alert" className="flex items-center gap-2 text-[12px]" style={{ color: '#FCA5A5' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {errMsg(error, 'Failed to load business hours')}
        </p>
      ) : (
        <Form key={`${selectedOrgId ?? 'all'}-${data.configured}-${data.timezone}-${JSON.stringify(data.schedule)}-${data.holidays.join(',')}`}
          initial={data} canEdit={canEdit} />
      )}
    </section>
  );
}
