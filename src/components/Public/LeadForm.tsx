import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { leadErrorMessage, usePublicLead, type LeadInterest } from '../../hooks/usePublicLead';
import { COMPANY } from './site';

/*
  Pilot / demo request form, shared by /pilot and /contact.

  Validates client-side before submitting, renders server failures inline (the
  hook opts out of the global error toast), and swaps to a confirmation panel
  on success. The backend endpoint it posts to does not exist yet — see the
  contract documented in src/hooks/usePublicLead.ts.
*/

const TEAM_SIZES = ['1–5', '6–20', '21–50', '51–200', '200+'];

const FIELD =
  'w-full rounded border border-steel bg-void px-3 py-2 text-[13px] text-ink placeholder:text-dim focus:border-signal focus:outline-none';
const LABEL = 'block text-[12px] font-medium text-ink';

type Errors = Partial<Record<'name' | 'email' | 'company', string>>;

// Deliberately loose: the point is to catch typos, not to adjudicate RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LeadForm({
  interest,
  submitLabel,
  showTeamSize = true,
  messageLabel = 'What would you like to cover?',
}: {
  interest: LeadInterest;
  submitLabel: string;
  showTeamSize?: boolean;
  messageLabel?: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const lead = usePublicLead();

  if (lead.isSuccess) {
    return (
      <div className="rounded border border-steel bg-obsidian p-6 shadow-card">
        <CheckCircle2 size={22} strokeWidth={1.75} className="text-emerald" aria-hidden />
        <h3 className="mt-3 font-display text-lg font-semibold text-ink">Request received</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Thanks — we have your details and will reply from{' '}
          <a href={`mailto:${COMPANY.email}`} className="text-signal underline underline-offset-2">
            {COMPANY.email}
          </a>{' '}
          within one business day.
        </p>
      </div>
    );
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Tell us who to reply to.';
    if (!email.trim()) next.email = 'We need an email to reply to.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'That email address looks incomplete.';
    if (!company.trim()) next.company = 'Which organisation is this for?';
    return next;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    lead.mutate({
      name: name.trim(),
      email: email.trim(),
      company: company.trim(),
      phone: phone.trim() || undefined,
      interest,
      teamSize: teamSize || undefined,
      message: message.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded border border-steel bg-obsidian p-5 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="lead-name">
            Name <span className="text-coral">*</span>
          </label>
          <input
            id="lead-name"
            className={`${FIELD} mt-1.5`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'lead-name-error' : undefined}
          />
          {errors.name && (
            <p id="lead-name-error" className="mt-1 text-[12px] text-crimson">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label className={LABEL} htmlFor="lead-email">
            Work email <span className="text-coral">*</span>
          </label>
          <input
            id="lead-email"
            type="email"
            className={`${FIELD} mt-1.5`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'lead-email-error' : undefined}
          />
          {errors.email && (
            <p id="lead-email-error" className="mt-1 text-[12px] text-crimson">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label className={LABEL} htmlFor="lead-company">
            Organisation <span className="text-coral">*</span>
          </label>
          <input
            id="lead-company"
            className={`${FIELD} mt-1.5`}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            aria-invalid={Boolean(errors.company)}
            aria-describedby={errors.company ? 'lead-company-error' : undefined}
          />
          {errors.company && (
            <p id="lead-company-error" className="mt-1 text-[12px] text-crimson">
              {errors.company}
            </p>
          )}
        </div>

        <div>
          <label className={LABEL} htmlFor="lead-phone">
            Phone <span className="text-dim">(optional)</span>
          </label>
          <input
            id="lead-phone"
            type="tel"
            className={`${FIELD} mt-1.5`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>

        {showTeamSize && (
          <div>
            <label className={LABEL} htmlFor="lead-team-size">
              Team size <span className="text-dim">(optional)</span>
            </label>
            <select
              id="lead-team-size"
              className={`${FIELD} mt-1.5`}
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
            >
              <option value="">Select…</option>
              {TEAM_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="lead-message">
            {messageLabel} <span className="text-dim">(optional)</span>
          </label>
          <textarea
            id="lead-message"
            rows={4}
            className={`${FIELD} mt-1.5 resize-y`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      </div>

      {lead.isError && (
        <p role="alert" className="mt-4 rounded border border-steel bg-crimson-dim px-3 py-2 text-[12px] text-crimson">
          {leadErrorMessage(lead.error)}{' '}
          <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-2">
            {COMPANY.email}
          </a>
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={lead.isPending} className="cx-btn cx-btn--primary disabled:opacity-60">
          {lead.isPending && <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden />}
          {lead.isPending ? 'Sending…' : submitLabel}
        </button>
        <p className="text-[12px] text-dim">
          We use these details to reply to you about {interest === 'pilot' ? 'the pilot' : 'your demo request'} — nothing else.
        </p>
      </div>
    </form>
  );
}
