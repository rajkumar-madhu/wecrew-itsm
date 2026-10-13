import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link2, ArrowRight, ArrowLeft, Trash2, Plus, Loader2, AlertTriangle, Zap } from 'lucide-react';
import api from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type RelType = 'DEPENDS_ON' | 'RUNS_ON' | 'HOSTS' | 'CONNECTS_TO' | 'PART_OF';
type Direction = 'outgoing' | 'incoming';

interface CIBrief { id: string; name: string; type: string; status: string }
interface RelRow { id: string; type: RelType; ci: CIBrief }
interface ImpactRow { id: string; via: string; type: RelType; depth: number; ci: CIBrief }
interface RelationshipsData { outgoing: RelRow[]; incoming: RelRow[]; impact: ImpactRow[] }
interface AssetOption { id: string; name: string; type?: string }

const REL_TYPES: RelType[] = ['DEPENDS_ON', 'RUNS_ON', 'HOSTS', 'CONNECTS_TO', 'PART_OF'];
const REL_WORDS: Record<RelType, string> = {
  DEPENDS_ON: 'depends on',
  RUNS_ON: 'runs on',
  HOSTS: 'hosts',
  CONNECTS_TO: 'connects to',
  PART_OF: 'part of',
};

const border = '1px solid rgba(99,179,255,0.12)';
const inputCls = 'w-full rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/40';
const inputStyle = { background: '#0F1B2D', border, color: '#E8F1FA' };
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest mb-1.5';

function errMsg(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof msg === 'string' && msg ? msg : fallback;
}

function prettyType(t: string) {
  return t.replace(/_/g, ' ').toLowerCase();
}

// ── Row ───────────────────────────────────────────────────────────────────────
function RelationshipRow({
  row, direction, canEdit, onRemove, removing,
}: {
  row: RelRow; direction: Direction; canEdit: boolean; onRemove: () => void; removing: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const words = REL_WORDS[row.type] ?? prettyType(row.type);
  const sentence = direction === 'outgoing'
    ? <>This asset <span style={{ color: '#C5D8E8' }}>{words}</span></>
    : <><span style={{ color: '#C5D8E8' }}>{words}</span> this asset</>;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 rounded-lg" style={{ background: '#0F1B2D' }}>
      {direction === 'outgoing' && <span className="text-[12px]" style={{ color: '#8AABC4' }}>{sentence}</span>}
      <Link to={`/assets/${row.ci.id}`} className="text-[13px] font-medium hover:underline" style={{ color: '#818CF8' }}>
        {row.ci.name}
      </Link>
      {direction === 'incoming' && <span className="text-[12px]" style={{ color: '#8AABC4' }}>{sentence}</span>}
      <span className="text-[11px]" style={{ color: '#8AABC4' }}>
        {prettyType(row.ci.type)} · {prettyType(row.ci.status)}
      </span>
      {canEdit && (
        <span className="ml-auto flex items-center gap-1.5">
          {confirming ? (
            <>
              <span className="text-[11px]" style={{ color: '#FCA5A5' }}>Remove this link?</span>
              <button onClick={onRemove} disabled={removing}
                className="px-2 py-1 rounded-md text-[11px] font-semibold disabled:opacity-50"
                style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#FCA5A5' }}>
                {removing ? 'Removing…' : 'Remove'}
              </button>
              <button onClick={() => setConfirming(false)}
                className="px-2 py-1 rounded-md text-[11px] font-medium" style={{ color: '#C5D8E8', border }}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} aria-label={`Remove relationship with ${row.ci.name}`}
              className="p-1.5 rounded-md hover:bg-[rgba(220,38,38,0.12)]" style={{ color: '#8AABC4' }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      )}
    </li>
  );
}

// ── Asset typeahead ───────────────────────────────────────────────────────────
function AssetPicker({
  excludeId, value, onChange,
}: {
  excludeId: string; value: AssetOption | null; onChange: (a: AssetOption | null) => void;
}) {
  const inputId = useId();
  const listId = useId();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const { data: options = [], isFetching } = useQuery({
    queryKey: ['asset-picker', q],
    queryFn: async (): Promise<AssetOption[]> => {
      const { data } = await api.get('/assets', { params: { search: q, limit: 20 } });
      const d = data?.data;
      const list: AssetOption[] = Array.isArray(d) ? d : (d?.assets ?? []);
      return list.map((a) => ({ id: a.id, name: a.name, type: a.type }));
    },
    enabled: open && q.length > 0,
    staleTime: 30000,
  });
  const filtered = options.filter((o) => o.id !== excludeId);

  return (
    <div className="relative">
      <label htmlFor={inputId} className={labelCls} style={{ color: '#8AABC4' }}>Other asset</label>
      <input id={inputId} role="combobox" aria-expanded={open && filtered.length > 0} aria-controls={listId}
        aria-autocomplete="list" autoComplete="off"
        value={value ? value.name : text}
        onChange={(e) => { onChange(null); setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search by name, hostname or IP…"
        className={inputCls} style={inputStyle} />
      {open && !value && q && (
        <ul id={listId} role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-xl py-1 shadow-xl"
          style={{ background: '#0B1424', border }}>
          {isFetching && filtered.length === 0 && (
            <li className="px-3 py-2 text-[12px]" style={{ color: '#8AABC4' }}>Searching…</li>
          )}
          {!isFetching && filtered.length === 0 && (
            <li className="px-3 py-2 text-[12px]" style={{ color: '#8AABC4' }}>No matching assets</li>
          )}
          {filtered.map((o) => (
            <li key={o.id} role="option" aria-selected={false}>
              <button type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(o); setText(o.name); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#0F1B2D]" style={{ color: '#E8F1FA' }}>
                {o.name}
                {o.type && <span className="ml-2 text-[11px]" style={{ color: '#8AABC4' }}>{prettyType(o.type)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RelationshipsPanel({ assetId, canEdit }: { assetId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const key = ['asset-relationships', assetId];
  const formId = useId();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<RelationshipsData> => {
      const { data } = await api.get(`/assets/${assetId}/relationships`);
      return data.data;
    },
    enabled: !!assetId,
    staleTime: 30000,
  });

  const [direction, setDirection] = useState<Direction>('outgoing');
  const [relType, setRelType] = useState<RelType>('DEPENDS_ON');
  const [target, setTarget] = useState<AssetOption | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [formError, setFormError] = useState('');

  const add = useMutation({
    mutationFn: async () => {
      await api.post(`/assets/${assetId}/relationships`, { targetId: target?.id, type: relType, direction });
    },
    onSuccess: () => {
      toast.success('Relationship added');
      setTarget(null);
      setPickerKey((k) => k + 1);
      setFormError('');
      qc.invalidateQueries({ queryKey: ['asset-relationships'] });
    },
    onError: (e) => {
      const msg = errMsg(e, 'Failed to add the relationship');
      setFormError(msg);
      toast.error(msg);
    },
  });

  const remove = useMutation({
    mutationFn: async (relId: string) => { await api.delete(`/assets/${assetId}/relationships/${relId}`); },
    onSuccess: () => {
      toast.success('Relationship removed');
      qc.invalidateQueries({ queryKey: ['asset-relationships'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to remove the relationship')),
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl p-10 flex items-center justify-center gap-2" style={{ background: '#0B1424', border }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#818CF8' }} />
        <span className="text-[12px]" style={{ color: '#8AABC4' }}>Loading relationships…</span>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: '#0B1424', border }}>
        <AlertTriangle className="w-6 h-6 mx-auto mb-2" style={{ color: '#F87171' }} />
        <p className="text-[13px]" style={{ color: '#E8F1FA' }}>{errMsg(error, 'Failed to load relationships')}</p>
      </div>
    );
  }

  // Names for the "via" column of the impact list
  const names: Record<string, string> = { [assetId]: 'this asset' };
  for (const r of [...data.outgoing, ...data.incoming]) names[r.ci.id] = r.ci.name;
  for (const r of data.impact) names[r.ci.id] = r.ci.name;

  const depths = [...new Set(data.impact.map((i) => i.depth))].sort((a, b) => a - b);

  const section = (title: string, hint: string, icon: React.ReactNode, rows: RelRow[], dir: Direction) => (
    <div className="rounded-2xl p-5" style={{ background: '#0B1424', border }}>
      <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: '#E8F1FA' }}>
        {icon} {title}
        <span className="ml-auto text-[11px] font-normal" style={{ color: '#8AABC4' }}>{rows.length}</span>
      </h3>
      <p className="text-[11px] mt-0.5 mb-3" style={{ color: '#8AABC4' }}>{hint}</p>
      {rows.length === 0 ? (
        <p className="text-[12px] py-3" style={{ color: '#8AABC4' }}>None recorded.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <RelationshipRow key={r.id} row={r} direction={dir} canEdit={canEdit}
              removing={remove.isPending && remove.variables === r.id}
              onRemove={() => remove.mutate(r.id)} />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {section('Depends on / runs on / …', 'This asset → other asset', <ArrowRight className="w-4 h-4" style={{ color: '#818CF8' }} />, data.outgoing, 'outgoing')}
        {section('Used by', 'Other asset → this asset', <ArrowLeft className="w-4 h-4" style={{ color: '#818CF8' }} />, data.incoming, 'incoming')}
      </div>

      {canEdit && (
        <form className="rounded-2xl p-5" style={{ background: '#0B1424', border }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) { setFormError('Pick the other asset from the search results'); return; }
            add.mutate();
          }}>
          <h3 className="text-[13px] font-semibold flex items-center gap-2 mb-3" style={{ color: '#E8F1FA' }}>
            <Link2 className="w-4 h-4" style={{ color: '#818CF8' }} /> Add relationship
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-[180px_180px_1fr_auto] gap-3 items-end">
            <div>
              <label htmlFor={`${formId}-dir`} className={labelCls} style={{ color: '#8AABC4' }}>Direction</label>
              <select id={`${formId}-dir`} value={direction} onChange={(e) => setDirection(e.target.value as Direction)}
                className={inputCls} style={inputStyle}>
                <option value="outgoing">This asset …</option>
                <option value="incoming">… this asset</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${formId}-type`} className={labelCls} style={{ color: '#8AABC4' }}>Relationship</label>
              <select id={`${formId}-type`} value={relType} onChange={(e) => setRelType(e.target.value as RelType)}
                className={inputCls} style={inputStyle}>
                {REL_TYPES.map((t) => <option key={t} value={t}>{REL_WORDS[t]}</option>)}
              </select>
            </div>
            <AssetPicker key={pickerKey} excludeId={assetId} value={target} onChange={setTarget} />
            <button type="submit" disabled={add.isPending}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-50"
              style={{ background: '#6366F1', color: '#FFFFFF' }}>
              {add.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
            </button>
          </div>
          <p className="text-[12px] mt-3" style={{ color: '#C5D8E8' }}>
            Reads as:{' '}
            <span style={{ color: '#E8F1FA' }}>
              {direction === 'outgoing'
                ? `This asset ${REL_WORDS[relType]} ${target?.name ?? '…'}`
                : `${target?.name ?? '…'} ${REL_WORDS[relType]} this asset`}
            </span>
          </p>
          {formError && (
            <p role="alert" className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: '#FCA5A5' }}>
              <AlertTriangle className="w-3.5 h-3.5" /> {formError}
            </p>
          )}
        </form>
      )}

      <div className="rounded-2xl p-5" style={{ background: '#0B1424', border }}>
        <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: '#E8F1FA' }}>
          <Zap className="w-4 h-4" style={{ color: '#FBBF24' }} /> Impact if this fails
          <span className="ml-auto text-[11px] font-normal" style={{ color: '#8AABC4' }}>
            {data.impact.length} asset{data.impact.length === 1 ? '' : 's'}
          </span>
        </h3>
        <p className="text-[11px] mt-0.5 mb-3" style={{ color: '#8AABC4' }}>
          Assets that depend on, run on or are part of this one (and what it hosts), followed transitively.
        </p>
        {data.impact.length === 0 ? (
          <p className="text-[12px] py-3" style={{ color: '#8AABC4' }}>Nothing else is recorded as depending on this asset.</p>
        ) : (
          <div className="space-y-3">
            {depths.map((d) => (
              <div key={d}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8AABC4' }}>
                  {d === 1 ? 'Direct (depth 1)' : `Depth ${d}`}
                </p>
                <ul className="space-y-1.5">
                  {data.impact.filter((i) => i.depth === d).map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-lg" style={{ background: '#0F1B2D' }}>
                      <Link to={`/assets/${i.ci.id}`} className="text-[13px] font-medium hover:underline" style={{ color: '#818CF8' }}>
                        {i.ci.name}
                      </Link>
                      <span className="text-[11px]" style={{ color: '#8AABC4' }}>
                        {i.type === 'HOSTS'
                          ? `hosted by ${names[i.via] ?? 'another asset'}`
                          : `${REL_WORDS[i.type] ?? prettyType(i.type)} ${names[i.via] ?? 'another asset'}`}
                      </span>
                      <span className="ml-auto text-[11px]" style={{ color: '#8AABC4' }}>
                        {prettyType(i.ci.type)} · {prettyType(i.ci.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
