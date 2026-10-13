import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiErrorMessage, useCreatePortalIncident, type Urgency } from '../../hooks/usePortal';
import { BackLink, Card } from './ui';
import { inputClass, primaryBtn, secondaryBtn } from './styles';

const URGENCIES: { value: Urgency; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: 'Annoying, but I can keep working normally.' },
  { value: 'medium', label: 'Medium', hint: 'It slows me down, or there is a clumsy workaround.' },
  { value: 'high', label: 'High', hint: "I can't work, or many people are affected." },
];

export default function ReportIssue() {
  const navigate = useNavigate();
  const create = useCreatePortalIncident();
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [submitted, setSubmitted] = useState(false);

  const summaryError = summary.trim().length < 5
    ? (summary.trim() ? 'Please use at least 5 characters.' : 'Tell us briefly what is wrong.')
    : null;
  const showSummaryError = submitted && !!summaryError;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (summaryError) {
      document.getElementById('report-summary')?.focus();
      return;
    }
    create.mutate(
      { shortDescription: summary.trim(), urgency, ...(details.trim() ? { description: details.trim() } : {}) },
      {
        onSuccess: (res) => {
          toast.success(`Thanks — ${res.number} has been logged`);
          navigate(`/portal/incidents/${res.id}`);
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'We couldn’t send your report.')),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink />
      <Card className="p-5 sm:p-8">
        <header className="mb-6 border-b border-[#E2E8F0] pb-5">
          <h1 className="font-display text-2xl font-bold text-[#0F172A]">Report a problem</h1>
          <p className="mt-2 text-[15px] text-[#475569]">
            Something broken or not working as expected? Tell us what's happening and the support team will pick it up.
          </p>
        </header>

        <form noValidate onSubmit={onSubmit} className="space-y-6">
          <div>
            <label htmlFor="report-summary" className="mb-1 block text-sm font-medium text-[#0F172A]">
              What's the problem?<span className="ml-0.5 text-[#B91C1C]" aria-hidden="true">*</span>
            </label>
            <input
              id="report-summary"
              type="text"
              maxLength={200}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              aria-required="true"
              aria-invalid={showSummaryError || undefined}
              aria-describedby={showSummaryError ? 'report-summary-hint report-summary-error' : 'report-summary-hint'}
              className={inputClass}
              placeholder="e.g. Outlook keeps asking for my password"
            />
            <p id="report-summary-hint" className="mt-1 text-xs text-[#475569]">A short one-line summary.</p>
            {showSummaryError && <p id="report-summary-error" className="mt-1 text-sm text-[#B91C1C]">{summaryError}</p>}
          </div>

          <div>
            <label htmlFor="report-details" className="mb-1 block text-sm font-medium text-[#0F172A]">
              Details <span className="font-normal text-[#475569]">(optional)</span>
            </label>
            <textarea
              id="report-details"
              rows={5}
              maxLength={5000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className={inputClass}
              placeholder="When did it start? What were you doing? Any error message you saw?"
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-[#0F172A]">How much is this affecting you?</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {URGENCIES.map((u) => {
                const checked = urgency === u.value;
                return (
                  <label
                    key={u.value}
                    className={`relative flex cursor-pointer flex-col rounded-xl border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#4F46E5] ${
                      checked ? 'border-[#4F46E5] bg-[#EEF2FF]' : 'border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#A5B4FC]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="urgency"
                        value={u.value}
                        checked={checked}
                        onChange={() => setUrgency(u.value)}
                        aria-describedby={`urgency-${u.value}-hint`}
                        className="h-4 w-4 accent-[#4F46E5]"
                      />
                      <span className="text-sm font-semibold text-[#0F172A]">{u.label}</span>
                    </span>
                    <span id={`urgency-${u.value}-hint`} className="mt-1 pl-6 text-xs text-[#475569]">{u.hint}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col-reverse gap-3 border-t border-[#E2E8F0] pt-5 sm:flex-row sm:justify-end">
            <button type="button" className={secondaryBtn} onClick={() => navigate('/portal')}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={create.isPending}>
              {create.isPending ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
