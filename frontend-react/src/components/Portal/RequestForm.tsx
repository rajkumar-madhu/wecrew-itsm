import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Clock, SearchX, ShieldCheck } from 'lucide-react';
import { apiErrorMessage, useCreatePortalRequest, usePortalCatalog, type FormField } from '../../hooks/usePortal';
import { formatHours } from './portalUtils';
import { BackLink, Card, EmptyState, ErrorBlock, LoadingBlock } from './ui';
import { inputClass, primaryBtn, secondaryBtn } from './styles';

type Values = Record<string, string | boolean>;

function validateField(f: FormField, v: string | boolean | undefined): string | null {
  if (f.type === 'checkbox') {
    return f.required && v !== true ? 'Please tick this box to continue.' : null;
  }
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return f.required ? 'This field is required.' : null;
  if (f.type === 'number' && !Number.isFinite(Number(s))) return 'Please enter a number.';
  if (f.type === 'date' && Number.isNaN(new Date(s).getTime())) return 'Please enter a valid date.';
  if (f.type === 'select' && f.options && !f.options.includes(s)) return 'Please choose one of the options.';
  return null;
}

export default function RequestForm() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const catalog = usePortalCatalog();
  const create = useCreatePortalRequest();

  const item = catalog.data?.find((c) => c.id === itemId);
  const fields = useMemo<FormField[]>(() => (Array.isArray(item?.formSchema) ? item!.formSchema! : []), [item]);

  const [values, setValues] = useState<Values>({});
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (catalog.isLoading) return <LoadingBlock label="Loading form…" />;
  if (catalog.error) return <ErrorBlock message={apiErrorMessage(catalog.error, 'We couldn’t load this form.')} onRetry={() => catalog.refetch()} />;
  if (!item) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <EmptyState icon={<SearchX className="h-6 w-6" />} title="We couldn't find that item">
            It may have been removed from the catalog. Head back and pick something else.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const setValue = (key: string, v: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (submitted) {
      const f = fields.find((x) => x.key === key);
      if (f) setErrors((prev) => {
        const next = { ...prev };
        const msg = validateField(f, v);
        if (msg) next[key] = msg; else delete next[key];
        return next;
      });
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const msg = validateField(f, values[f.key]);
      if (msg) errs[f.key] = msg;
    }
    setErrors(errs);
    const firstBad = fields.find((f) => errs[f.key]);
    if (firstBad) {
      document.getElementById(`field-${firstBad.key}`)?.focus();
      return;
    }

    const formData: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (f.type === 'checkbox') formData[f.key] = v === true;
      else if (typeof v === 'string' && v.trim()) formData[f.key] = f.type === 'number' ? Number(v) : v.trim();
    }

    create.mutate(
      { catalogItemId: item.id, formData, ...(description.trim() ? { description: description.trim() } : {}) },
      {
        onSuccess: (res) => {
          toast.success(`Request ${res.number} submitted`);
          navigate(`/portal/requests/${res.id}`);
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'We couldn’t submit your request.')),
      },
    );
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink />
      <Card className="p-5 sm:p-8">
        <header className="mb-6 border-b border-[#E2E8F0] pb-5">
          {item.category && <p className="text-xs font-semibold uppercase tracking-wider text-[#4338CA]">{item.category}</p>}
          <h1 className="mt-1 font-display text-2xl font-bold text-[#0F172A]">{item.name}</h1>
          {item.description && <p className="mt-2 text-[15px] text-[#475569]">{item.description}</p>}
          {(item.requiresApproval || item.fulfillmentHours) && (
            <ul className="mt-4 flex flex-wrap gap-2 text-xs">
              {item.requiresApproval && (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-2.5 py-1 font-medium text-[#92400E]">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Needs approval before we start
                </li>
              )}
              {item.fulfillmentHours ? (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-1 font-medium text-[#334155]">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Usually done within {formatHours(item.fulfillmentHours)}
                </li>
              ) : null}
            </ul>
          )}
        </header>

        <form noValidate onSubmit={onSubmit} className="space-y-5">
          {submitted && errorCount > 0 && (
            <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#991B1B]">
              Please fix {errorCount === 1 ? 'the highlighted field' : `the ${errorCount} highlighted fields`} below.
            </p>
          )}

          {fields.map((f) => (
            <DynamicField key={f.key} field={f} value={values[f.key]} error={errors[f.key]} onChange={(v) => setValue(f.key, v)} />
          ))}

          <div>
            <label htmlFor="field-__description" className="mb-1 block text-sm font-medium text-[#0F172A]">
              Anything else we should know? <span className="font-normal text-[#475569]">(optional)</span>
            </label>
            <textarea
              id="field-__description"
              rows={4}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="Add any details that will help us get this right"
            />
          </div>

          <p className="text-xs text-[#475569]"><span className="text-[#B91C1C]" aria-hidden="true">*</span> Required field</p>

          <div className="flex flex-col-reverse gap-3 border-t border-[#E2E8F0] pt-5 sm:flex-row sm:justify-end">
            <button type="button" className={secondaryBtn} onClick={() => navigate('/portal')}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={create.isPending}>
              {create.isPending ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function DynamicField({ field: f, value, error, onChange }: {
  field: FormField; value: string | boolean | undefined; error?: string; onChange: (v: string | boolean) => void;
}) {
  const id = `field-${f.key}`;
  const errId = `${id}-error`;
  const a11y = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errId : undefined,
    'aria-required': f.required || undefined,
  } as const;
  const strVal = typeof value === 'string' ? value : '';
  const req = f.required ? <span className="ml-0.5 text-[#B91C1C]" aria-hidden="true">*</span> : null;
  const err = error ? <p id={errId} className="mt-1 text-sm text-[#B91C1C]">{error}</p> : null;

  if (f.type === 'checkbox') {
    return (
      <div>
        <div className="flex items-start gap-3">
          <input
            {...a11y}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none rounded border-[#94A3B8] text-[#4F46E5] accent-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]"
          />
          <label htmlFor={id} className="text-sm text-[#0F172A]">{f.label}{req}</label>
        </div>
        {err}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[#0F172A]">{f.label}{req}</label>
      {f.type === 'textarea' ? (
        <textarea {...a11y} rows={4} value={strVal} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      ) : f.type === 'select' ? (
        <select {...a11y} value={strVal} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Choose…</option>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          {...a11y}
          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
          inputMode={f.type === 'number' ? 'decimal' : undefined}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
      {err}
    </div>
  );
}
