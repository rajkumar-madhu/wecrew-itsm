import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LayoutGrid, Plus, X, Save, Loader2, ArrowUp, ArrowDown, Trash2, Pencil, AlertTriangle,
  ArrowLeft, PackageOpen, ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  useCatalogItems, useCreateCatalogItem, useUpdateCatalogItem, useTeamOptions, apiError,
  type CatalogItem, type CatalogItemInput, type FormField, type FormFieldType,
} from '../../hooks/useRequests';

// ── Constants & helpers ────────────────────────────────────────────────────────
const MAX_FIELDS = 30;
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
];

const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#0F1B2D] text-[#E8F1FA] border border-[rgba(99,179,255,0.16)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] placeholder:text-[#7590A9]';
const labelCls = 'block text-[11px] font-semibold text-[#C5D8E8] mb-1';
const hintCls = 'text-[11px] text-[#8AABC4] mt-1';
const iconBtn = 'p-1.5 rounded-md text-[#8AABC4] hover:text-[#E8F1FA] hover:bg-[#152238] disabled:opacity-30 disabled:cursor-not-allowed';

/** "Laptop model (if any)" → "laptop_model_if_any" */
function deriveKey(label: string): string {
  const k = label.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .slice(0, 40)
    .replace(/_+$/, '');
  return k || 'field';
}

interface DraftField {
  uid: number;
  label: string;
  key: string;
  keyEdited: boolean;
  type: FormFieldType;
  required: boolean;
  optionsText: string;
}

interface Draft {
  name: string;
  category: string;
  description: string;
  requiresApproval: boolean;
  approverTeamId: string;
  fulfillmentTeamId: string;
  fulfillmentHours: string;
  isActive: boolean;
  fields: DraftField[];
}

let uidSeq = 1;
const nextUid = () => uidSeq++;

function toDraft(item: CatalogItem | null): Draft {
  const schema = Array.isArray(item?.formSchema) ? item.formSchema : [];
  return {
    name: item?.name ?? '',
    category: item?.category ?? '',
    description: item?.description ?? '',
    requiresApproval: item?.requiresApproval ?? false,
    approverTeamId: item?.approverTeamId ?? '',
    fulfillmentTeamId: item?.fulfillmentTeamId ?? '',
    fulfillmentHours: item?.fulfillmentHours != null ? String(item.fulfillmentHours) : '',
    isActive: item?.isActive ?? true,
    fields: schema.map((f) => ({
      uid: nextUid(),
      label: f.label ?? '',
      key: f.key ?? '',
      keyEdited: true,
      type: f.type,
      required: !!f.required,
      optionsText: (f.options ?? []).join(', '),
    })),
  };
}

function parseOptions(text: string): string[] {
  return text.split(',').map((o) => o.trim()).filter(Boolean);
}

/** Same rules as the API (request.controller + serviceRequestService.validateFormSchema). */
function validate(d: Draft): string | null {
  const name = d.name.trim();
  if (!name) return 'Name is required';
  if (name.length > 120) return 'Name must be 120 characters or fewer';
  if (d.category.length > 60) return 'Category must be 60 characters or fewer';
  if (d.description.length > 2000) return 'Description must be 2000 characters or fewer';
  if (d.fulfillmentHours.trim()) {
    const n = Number(d.fulfillmentHours);
    if (!Number.isInteger(n) || n < 1 || n > 2160) return 'Fulfilment target must be a whole number of hours between 1 and 2160';
  }
  if (d.fields.length > MAX_FIELDS) return `A form can have at most ${MAX_FIELDS} fields`;
  const keys = new Set<string>();
  for (const [i, f] of d.fields.entries()) {
    if (!KEY_RE.test(f.key)) return `Field ${i + 1} needs a key of letters, digits or _ (max 40), starting with a letter`;
    if (keys.has(f.key)) return `Field key "${f.key}" is used twice`;
    keys.add(f.key);
    if (!f.label.trim()) return `Field "${f.key}" needs a label`;
    if (f.label.length > 120) return `Field "${f.key}" label must be 120 characters or fewer`;
    if (f.type === 'select' && parseOptions(f.optionsText).length === 0) return `Dropdown field "${f.label}" needs at least one option`;
  }
  return null;
}

function toInput(d: Draft): CatalogItemInput {
  const formSchema: FormField[] = d.fields.map((f) => {
    const field: FormField = { key: f.key, label: f.label.trim(), type: f.type };
    if (f.required) field.required = true;
    if (f.type === 'select') field.options = parseOptions(f.optionsText);
    return field;
  });
  return {
    name: d.name.trim(),
    category: d.category.trim() || null,
    description: d.description.trim() || null,
    requiresApproval: d.requiresApproval,
    approverTeamId: d.requiresApproval ? d.approverTeamId || null : null,
    fulfillmentTeamId: d.fulfillmentTeamId || null,
    fulfillmentHours: d.fulfillmentHours.trim() ? Number(d.fulfillmentHours) : null,
    isActive: d.isActive,
    formSchema,
  };
}

// ── Form builder row ───────────────────────────────────────────────────────────
function FieldRow({ field, index, count, onChange, onMove, onRemove }: {
  field: DraftField; index: number; count: number;
  onChange: (patch: Partial<DraftField>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const id = `f${field.uid}`;
  const keyInvalid = field.key !== '' && !KEY_RE.test(field.key);
  return (
    <li className="rounded-xl bg-[#0F1B2D] border border-[rgba(99,179,255,0.12)] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-[#8AABC4]">Field {index + 1}</span>
        <div className="flex items-center gap-1">
          <button type="button" className={iconBtn} disabled={index === 0} onClick={() => onMove(-1)}
            aria-label={`Move field ${index + 1} up`}><ArrowUp className="w-3.5 h-3.5" aria-hidden="true" /></button>
          <button type="button" className={iconBtn} disabled={index === count - 1} onClick={() => onMove(1)}
            aria-label={`Move field ${index + 1} down`}><ArrowDown className="w-3.5 h-3.5" aria-hidden="true" /></button>
          <button type="button" onClick={onRemove} aria-label={`Remove field ${index + 1}`}
            className="p-1.5 rounded-md text-[#FB7185] hover:bg-[rgba(244,63,94,0.1)]"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-label`} className={labelCls}>Label</label>
          <input id={`${id}-label`} value={field.label} maxLength={120} className={inputCls} placeholder="e.g. Laptop model"
            onChange={(e) => onChange(field.keyEdited
              ? { label: e.target.value }
              : { label: e.target.value, key: e.target.value.trim() ? deriveKey(e.target.value) : '' })} />
        </div>
        <div>
          <label htmlFor={`${id}-key`} className={labelCls}>Key</label>
          <input id={`${id}-key`} value={field.key} maxLength={40} className={`${inputCls} font-mono`} placeholder="laptop_model"
            aria-invalid={keyInvalid} aria-describedby={`${id}-key-hint`}
            onChange={(e) => onChange({ key: e.target.value, keyEdited: e.target.value !== '' })} />
          <p id={`${id}-key-hint`} className={keyInvalid ? 'text-[11px] text-[#FB7185] mt-1' : hintCls}>
            {keyInvalid ? 'Start with a letter; letters, digits and _ only' : 'Stored with each request'}
          </p>
        </div>
        <div>
          <label htmlFor={`${id}-type`} className={labelCls}>Type</label>
          <select id={`${id}-type`} value={field.type} className={inputCls}
            onChange={(e) => onChange({ type: e.target.value as FormFieldType })}>
            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label htmlFor={`${id}-req`} className="flex items-center gap-2 text-[12px] text-[#C5D8E8] cursor-pointer">
            <input id={`${id}-req`} type="checkbox" checked={field.required} className="w-4 h-4 accent-[#6366F1]"
              onChange={(e) => onChange({ required: e.target.checked })} />
            Required
          </label>
        </div>
        {field.type === 'select' && (
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-opts`} className={labelCls}>Options (comma-separated)</label>
            <input id={`${id}-opts`} value={field.optionsText} className={inputCls} placeholder="MacBook Pro, ThinkPad X1, Dell XPS"
              onChange={(e) => onChange({ optionsText: e.target.value })} />
          </div>
        )}
      </div>
    </li>
  );
}

// ── Editor drawer ──────────────────────────────────────────────────────────────
function EditorDrawer({ item, onClose }: { item: CatalogItem | null; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(item));
  const [error, setError] = useState('');
  const { data: teams = [] } = useTeamOptions();
  const create = useCreateCatalogItem();
  const update = useUpdateCatalogItem();
  const saving = create.isPending || update.isPending;

  function set<K extends keyof Draft>(k: K, v: Draft[K]) { setDraft((d) => ({ ...d, [k]: v })); setError(''); }
  function patchField(uid: number, patch: Partial<DraftField>) {
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.uid === uid ? { ...f, ...patch } : f)) }));
    setError('');
  }
  function moveField(index: number, dir: -1 | 1) {
    setDraft((d) => {
      const fields = [...d.fields];
      const j = index + dir;
      if (j < 0 || j >= fields.length) return d;
      [fields[index], fields[j]] = [fields[j], fields[index]];
      return { ...d, fields };
    });
  }
  function addField() {
    setDraft((d) => ({
      ...d,
      fields: [...d.fields, { uid: nextUid(), label: '', key: '', keyEdited: false, type: 'text', required: false, optionsText: '' }],
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validate(draft);
    if (msg) { setError(msg); return; }
    const body = toInput(draft);
    const opts = {
      onSuccess: () => { toast.success(item ? 'Catalog item saved' : 'Catalog item created'); onClose(); },
      onError: (err: unknown) => setError(apiError(err, 'Could not save the catalog item')),
    };
    if (item) update.mutate({ id: item.id, data: body }, opts);
    else create.mutate(body, opts);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="catalog-editor-title"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit}
        className="h-full w-full max-w-2xl flex flex-col bg-[#0B1424] border-l border-[rgba(99,179,255,0.16)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(99,179,255,0.12)]">
          <div>
            <h2 id="catalog-editor-title" className="text-[16px] font-display font-bold text-[#E8F1FA]">
              {item ? `Edit "${item.name}"` : 'New catalog item'}
            </h2>
            <p className="text-[11px] text-[#8AABC4] mt-0.5">What users can request from the self-service portal</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor" className={iconBtn}>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="ci-name" className={labelCls}>Name</label>
              <input id="ci-name" value={draft.name} maxLength={120} autoFocus className={inputCls}
                placeholder="e.g. New laptop" onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label htmlFor="ci-category" className={labelCls}>Category</label>
              <input id="ci-category" value={draft.category} maxLength={60} className={inputCls}
                placeholder="e.g. Hardware" onChange={(e) => set('category', e.target.value)} />
            </div>
            <div>
              <label htmlFor="ci-hours" className={labelCls}>Fulfilment target (hours)</label>
              <input id="ci-hours" type="number" min={1} max={2160} step={1} value={draft.fulfillmentHours}
                className={`${inputCls} font-mono`} placeholder="e.g. 48" onChange={(e) => set('fulfillmentHours', e.target.value)} />
              <p className={hintCls}>Sets the request's due date. Leave empty for no target.</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ci-desc" className={labelCls}>Description</label>
              <textarea id="ci-desc" rows={3} value={draft.description} maxLength={2000} className={inputCls}
                placeholder="Shown to requesters in the portal" onChange={(e) => set('description', e.target.value)} />
            </div>
            <div>
              <label htmlFor="ci-fteam" className={labelCls}>Fulfilment team</label>
              <select id="ci-fteam" value={draft.fulfillmentTeamId} className={inputCls}
                onChange={(e) => set('fulfillmentTeamId', e.target.value)}>
                <option value="">No team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label htmlFor="ci-active" className="flex items-center gap-2 text-[13px] text-[#C5D8E8] cursor-pointer">
                <input id="ci-active" type="checkbox" checked={draft.isActive} className="w-4 h-4 accent-[#6366F1]"
                  onChange={(e) => set('isActive', e.target.checked)} />
                Active (visible in the portal)
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[rgba(99,179,255,0.12)] p-4 space-y-3">
            <label htmlFor="ci-approval" className="flex items-center gap-2 text-[13px] font-semibold text-[#E8F1FA] cursor-pointer">
              <input id="ci-approval" type="checkbox" checked={draft.requiresApproval} className="w-4 h-4 accent-[#6366F1]"
                onChange={(e) => set('requiresApproval', e.target.checked)} />
              Requires approval
            </label>
            {draft.requiresApproval && (
              <div>
                <label htmlFor="ci-ateam" className={labelCls}>Approver team</label>
                <select id="ci-ateam" value={draft.approverTeamId} className={inputCls}
                  onChange={(e) => set('approverTeamId', e.target.value)}>
                  <option value="">Organization admins and managers</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <p className={hintCls}>Leave empty to use the organization's admins and managers.</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-[#E8F1FA]">Request form</h3>
                <p className="text-[11px] text-[#8AABC4]">{draft.fields.length} of {MAX_FIELDS} fields · title and description are always asked</p>
              </div>
              <button type="button" onClick={addField} disabled={draft.fields.length >= MAX_FIELDS}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[rgba(99,102,241,0.14)] border border-[rgba(99,102,241,0.4)] text-[#C7D2FE] hover:bg-[rgba(99,102,241,0.22)] disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add field
              </button>
            </div>
            {draft.fields.length === 0 ? (
              <p className="text-[12px] text-[#8AABC4] rounded-xl border border-dashed border-[rgba(99,179,255,0.2)] px-4 py-6 text-center">
                No extra fields. Add fields to collect structured answers (e.g. model, cost centre, start date).
              </p>
            ) : (
              <ol className="space-y-3">
                {draft.fields.map((f, i) => (
                  <FieldRow key={f.uid} field={f} index={i} count={draft.fields.length}
                    onChange={(p) => patchField(f.uid, p)}
                    onMove={(dir) => moveField(i, dir)}
                    onRemove={() => setDraft((d) => ({ ...d, fields: d.fields.filter((x) => x.uid !== f.uid) }))} />
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[rgba(99,179,255,0.12)] space-y-3">
          {error && (
            <p role="alert" className="flex items-center gap-2 text-[12px] text-[#FDA4AF] rounded-lg px-3 py-2 bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.3)]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-[13px] px-4 py-2 rounded-lg text-[#C5D8E8] hover:bg-[#152238]">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-[13px] flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
              {item ? 'Save changes' : 'Create item'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CatalogAdmin() {
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const { data: items = [], isLoading, isError, error, refetch } = useCatalogItems(false);
  const toggle = useUpdateCatalogItem();
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);

  function toggleActive(item: CatalogItem) {
    toggle.mutate({ id: item.id, data: { isActive: !item.isActive } }, {
      onSuccess: () => toast.success(item.isActive ? `"${item.name}" hidden from the portal` : `"${item.name}" is live in the portal`),
      onError: (err) => toast.error(apiError(err, 'Could not update the item')),
    });
  }

  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <div className="animate-fade-in">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-white shadow-sm border border-stone-200 rounded-2xl mx-4 mt-4">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-72 h-20 pointer-events-none opacity-[0.08]"
          style={{ background: 'radial-gradient(ellipse at 100% 0%, #6366F1 0%, transparent 70%)' }} />
        <div className="relative px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
                <LayoutGrid className="w-5 h-5 text-[#818CF8]" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-[#818CF8]">Service Desk</span>
                  <span className="text-[#7590A9]" aria-hidden="true">/</span>
                  <span className="text-[10px] font-mono text-[#8AABC4] tracking-widest uppercase">Catalog</span>
                </div>
                <h1 className="text-[22px] font-display font-bold text-[#E8F1FA] tracking-tight">Service catalog</h1>
                <p className="text-[12px] text-[#8AABC4] mt-0.5">
                  {isLoading ? 'Loading…' : `${items.length} item${items.length === 1 ? '' : 's'} · ${activeCount} active in the portal`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/requests"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] text-[#C5D8E8] hover:text-[#E8F1FA] hover:bg-[#152238]">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Requests
              </Link>
              {canEdit && (
                <button type="button" onClick={() => setEditing('new')} className="btn-primary text-[13px] flex items-center gap-1.5">
                  <Plus className="w-4 h-4" aria-hidden="true" /> New item
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="h-px mx-6" style={{ background: 'linear-gradient(90deg, #6366F1, transparent)' }} />
      </div>

      <div className="px-4 pt-4 pb-6 space-y-3">
        {!canEdit && (
          <p className="text-[12px] text-[#8AABC4]">You can view the catalog. Only admins and managers can change it.</p>
        )}

        <div className="rounded-2xl overflow-hidden border border-[rgba(99,179,255,0.12)] bg-[#0B1424]">
          {isLoading ? (
            <div className="divide-y divide-[rgba(99,179,255,0.08)]" aria-busy="true" aria-label="Loading catalog">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                  <div className="h-3 w-40 rounded bg-[#152238]" />
                  <div className="h-3 w-20 rounded bg-[#152238]" />
                  <div className="h-3 flex-1 rounded bg-[#152238]" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-4">
              <AlertTriangle className="w-8 h-8 text-[#FB7185]" aria-hidden="true" />
              <p className="text-[14px] font-semibold text-[#E8F1FA]">Couldn't load the catalog</p>
              <p className="text-[12px] text-[#8AABC4]">{apiError(error, 'Something went wrong. Try again.')}</p>
              <button type="button" onClick={() => refetch()} className="btn-primary text-sm">Retry</button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <PackageOpen className="w-6 h-6 text-[#818CF8]" aria-hidden="true" />
              </div>
              <p className="text-[14px] font-semibold text-[#E8F1FA]">The catalog is empty</p>
              <p className="text-[12px] text-[#8AABC4] max-w-sm">
                Add the things people ask IT for — laptops, access, software — so they can request them from the portal.
              </p>
              {canEdit && (
                <button type="button" onClick={() => setEditing('new')} className="btn-primary text-[13px] flex items-center gap-1.5 mt-2">
                  <Plus className="w-4 h-4" aria-hidden="true" /> Create the first item
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead className="bg-[#0F1B2D] border-b border-[rgba(99,179,255,0.12)]">
                  <tr>
                    {['Item', 'Category', 'Approval', 'Fulfilment team', 'Target', 'Requests', 'Active', ''].map((h, i) => (
                      <th key={i} scope="col" className="px-4 py-3 text-[10px] font-bold text-[#8AABC4] uppercase tracking-widest">
                        {h || <span className="sr-only">Actions</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(99,179,255,0.08)]">
                  {items.map((item) => {
                    const fieldCount = Array.isArray(item.formSchema) ? item.formSchema.length : 0;
                    return (
                      <tr key={item.id} className={item.isActive ? '' : 'opacity-70'}>
                        <td className="px-4 py-3 max-w-[280px]">
                          <p className="text-[13px] font-medium text-[#E8F1FA] truncate">{item.name}</p>
                          <p className="text-[11px] text-[#8AABC4] truncate">
                            {fieldCount} form field{fieldCount === 1 ? '' : 's'}{item.description ? ` · ${item.description}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#C5D8E8]">{item.category || '—'}</td>
                        <td className="px-4 py-3 text-[12px]">
                          {item.requiresApproval ? (
                            <span className="flex items-center gap-1.5 text-[#FCD34D]">
                              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Yes · <span className="text-[#C5D8E8]">{item.approverTeam?.name ?? 'Admins & managers'}</span></span>
                            </span>
                          ) : <span className="text-[#8AABC4]">No</span>}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#C5D8E8]">{item.fulfillmentTeam?.name ?? <span className="text-[#8AABC4]">—</span>}</td>
                        <td className="px-4 py-3 text-[12px] font-mono text-[#C5D8E8]">{item.fulfillmentHours ? `${item.fulfillmentHours}h` : '—'}</td>
                        <td className="px-4 py-3 text-[12px] font-mono text-[#C5D8E8]">{item._count?.requests ?? 0}</td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <button type="button" role="switch" aria-checked={item.isActive}
                              aria-label={`${item.name} active in portal`}
                              disabled={toggle.isPending} onClick={() => toggleActive(item)}
                              className="flex items-center gap-2 disabled:opacity-50">
                              <span className={`relative inline-block w-9 h-5 rounded-full transition-colors ${item.isActive ? 'bg-[#6366F1]' : 'bg-[#2A4060]'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[#FFFFFF] transition-all ${item.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                              </span>
                              <span className="text-[11px] text-[#C5D8E8]">{item.isActive ? 'On' : 'Off'}</span>
                            </button>
                          ) : (
                            <span className={`text-[11px] font-semibold ${item.isActive ? 'text-[#6EE7B7]' : 'text-[#8AABC4]'}`}>
                              {item.isActive ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canEdit && (
                            <button type="button" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`}
                              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg text-[#C5D8E8] hover:text-[#E8F1FA] hover:bg-[#152238]">
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditorDrawer
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
