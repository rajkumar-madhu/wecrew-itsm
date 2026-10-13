import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Ban, Check, Info, MessageSquare, Send, Star, UserRound, XCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  apiErrorMessage,
  useAddPortalIncidentComment, useAddPortalRequestComment, useCancelPortalRequest,
  usePortalIncident, usePortalRequest, useRatePortalIncident, useRatePortalRequest,
  type FormField, type PersonRef,
} from '../../hooks/usePortal';
import {
  formatDate, humanize, incidentStatus, isIncidentRateable, isRequestCancellable, isRequestRateable, requestStatus, timeAgo,
  type Tone,
} from './portalUtils';
import StatusPill from './StatusPill';
import { RatingPanel } from './StarRating';
import { BackLink, Card, ErrorBlock, LoadingBlock } from './ui';
import { dangerBtn, inputClass, primaryBtn, secondaryBtn } from './styles';

// ── Shared building blocks ─────────────────────────────────────────────

interface Step { label: string }

function Stepper({ steps, completed, current, currentLabel }: {
  steps: Step[]; completed: number; current: number | null; currentLabel?: string;
}) {
  return (
    <ol className="flex w-full items-start" aria-label="Progress">
      {steps.map((s, i) => {
        const isDone = i < completed && i !== current;
        const isCurrent = i === current;
        const label = isCurrent && currentLabel ? currentLabel : s.label;
        return (
          <li key={s.label} className="relative flex flex-1 flex-col items-center text-center" aria-current={isCurrent ? 'step' : undefined}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${i <= completed ? 'bg-[#4F46E5]' : 'bg-[#E2E8F0]'}`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                isDone ? 'border-[#4F46E5] bg-[#4F46E5] text-white'
                  : isCurrent ? 'border-[#4F46E5] bg-[#FFFFFF] text-[#4338CA] ring-4 ring-[#E0E7FF]'
                    : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#64748B]'
              }`}
              aria-hidden="true"
            >
              {isDone ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`mt-2 px-1 text-xs leading-tight sm:text-sm ${isCurrent ? 'font-semibold text-[#0F172A]' : isDone ? 'text-[#334155]' : 'text-[#64748B]'}`}>
              {label}
              <span className="sr-only">{isDone ? ' (complete)' : isCurrent ? ' (current step)' : ' (not started)'}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StoppedNotice({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <span className="mt-0.5 text-[#475569]" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
        {children && <p className="mt-0.5 text-sm text-[#475569]">{children}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} className="mb-3 font-display text-lg font-semibold text-[#0F172A]">{children}</h2>;
}

function TicketHeader({ number, title, status, createdAt, children }: {
  number: string; title: string; status: { label: string; tone: Tone }; createdAt: string; children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[#475569]">
        <span className="font-mono">{number}</span>
        <span aria-hidden="true">·</span>
        <span>Opened {formatDate(createdAt)}</span>
      </div>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="font-display text-2xl font-bold leading-tight text-[#0F172A]">{title}</h1>
        <StatusPill label={status.label} tone={status.tone} className="self-start text-sm" />
      </div>
      <div className="mt-6">{children}</div>
    </Card>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-[#475569]">{label}</dt>
      <dd className="text-right font-medium text-[#0F172A]">{children}</dd>
    </div>
  );
}

function ResolutionNotes({ notes, title }: { notes: string | null | undefined; title: string }) {
  if (!notes?.trim()) return null;
  return (
    <Card className="border-[#BBF7D0] bg-[#F0FDF4] p-5 sm:p-6" aria-labelledby="resolution-title">
      <SectionTitle id="resolution-title">{title}</SectionTitle>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#14532D]">{notes}</p>
    </Card>
  );
}

interface Message { id: string; text: string; createdAt: string; author: PersonRef | null }

function Conversation({ messages, onSend, isSending, disabledReason }: {
  messages: Message[];
  onSend: (body: string, done: () => void) => void;
  isSending: boolean;
  disabledReason?: string;
}) {
  const me = useAuthStore((s) => s.user);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) { setError('Write a message first.'); return; }
    setError(null);
    onSend(body.trim(), () => setBody(''));
  };

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <Card className="p-5 sm:p-6" aria-labelledby={`${id}-title`}>
      <SectionTitle id={`${id}-title`}>Conversation</SectionTitle>
      {sorted.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] px-4 py-4 text-sm text-[#475569]">
          <MessageSquare className="h-5 w-5 flex-none text-[#64748B]" aria-hidden="true" />
          No messages yet. Questions or extra details? Send them below.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((m) => {
            const mine = !!me && m.author?.id === me.id;
            const name = mine ? 'You' : m.author ? m.author.firstName : 'Support team';
            return (
              <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${mine ? 'rounded-br-md bg-[#EEF2FF]' : 'rounded-bl-md border border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <p className="text-xs text-[#475569]">
                    <span className="font-semibold text-[#334155]">{name}</span>
                    {' · '}
                    <time dateTime={m.createdAt} title={formatDate(m.createdAt, true)}>{timeAgo(m.createdAt)}</time>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#0F172A]">{m.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {disabledReason ? (
        <p className="mt-4 text-sm text-[#475569]">{disabledReason}</p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-5 border-t border-[#E2E8F0] pt-4">
          <label htmlFor={`${id}-reply`} className="mb-1 block text-sm font-medium text-[#0F172A]">Reply</label>
          <textarea
            id={`${id}-reply`}
            rows={3}
            maxLength={5000}
            value={body}
            onChange={(e) => { setBody(e.target.value); if (error) setError(null); }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-reply-error` : undefined}
            className={inputClass}
            placeholder="Add a message for the support team"
          />
          {error && <p id={`${id}-reply-error`} className="mt-1 text-sm text-[#B91C1C]">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button type="submit" className={primaryBtn} disabled={isSending}>
              <Send className="h-4 w-4" aria-hidden="true" /> {isSending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

function RatingCard({ score, rateable, onSubmit, isPending, subject }: {
  score: number | null | undefined; rateable: boolean; onSubmit: (s: number, c: string) => void; isPending: boolean; subject: string;
}) {
  if (!rateable && score == null) return null;
  return (
    <Card className="border-[#FDE68A] bg-[#FFFBEB] p-5" aria-labelledby="rating-title">
      <h2 id="rating-title" className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-[#0F172A]">
        <Star className="h-5 w-5 fill-[#F59E0B] text-[#D97706]" aria-hidden="true" />
        {score != null ? 'Your rating' : 'Rate your experience'}
      </h2>
      <RatingPanel ratedScore={score} onSubmit={onSubmit} isPending={isPending} subject={subject} />
    </Card>
  );
}

function assigneeName(p: PersonRef | null | undefined) {
  return p?.firstName ? p.firstName : null;
}

function formatAnswer(f: FormField | undefined, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean' || f?.type === 'checkbox') return v === true || v === 'true' ? 'Yes' : 'No';
  if (f?.type === 'date' && typeof v === 'string') return formatDate(v) || v;
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function isNotFoundError(error: unknown) {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 404 || status === 403;
}

// ── Request detail ─────────────────────────────────────────────────────

export function RequestTicket() {
  const { id } = useParams<{ id: string }>();
  const q = usePortalRequest(id);
  const comment = useAddPortalRequestComment();
  const cancel = useCancelPortalRequest();
  const rate = useRatePortalRequest();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const notFound = isNotFoundError(q.error);

  if (q.isLoading) return <LoadingBlock label="Loading your request…" />;
  if (q.error || !q.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBlock
          message={notFound ? 'We couldn’t find this request. It may belong to someone else.' : apiErrorMessage(q.error, 'We couldn’t load this request.')}
          onRetry={notFound ? undefined : () => q.refetch()}
        />
      </div>
    );
  }

  const r = q.data;
  const status = requestStatus(r.state);
  const hasApproval = r.state === 'PENDING_APPROVAL' || r.state === 'APPROVED' || r.state === 'REJECTED' || (r.approvals?.length ?? 0) > 0;
  const steps: Step[] = hasApproval
    ? [{ label: 'Submitted' }, { label: 'Approval' }, { label: 'Being worked on' }, { label: 'Done' }]
    : [{ label: 'Submitted' }, { label: 'Being worked on' }, { label: 'Done' }];
  const work = hasApproval ? 2 : 1;
  const progress: Record<string, { completed: number; current: number | null }> = {
    SUBMITTED: { completed: 0, current: 0 },
    PENDING_APPROVAL: { completed: 1, current: 1 },
    APPROVED: { completed: 2, current: null },
    IN_FULFILLMENT: { completed: work, current: work },
    FULFILLED: { completed: steps.length, current: null },
  };
  const p = progress[r.state];

  const schema: FormField[] = Array.isArray(r.catalogItem?.formSchema) ? r.catalogItem!.formSchema! : [];
  const formData = r.formData ?? {};
  const answers = [
    ...schema.map((f) => ({ key: f.key, label: f.label, value: formatAnswer(f, formData[f.key]) })),
    ...Object.keys(formData)
      .filter((k) => !schema.some((f) => f.key === k))
      .map((k) => ({ key: k, label: humanize(k), value: formatAnswer(undefined, formData[k]) })),
  ];

  const cancellable = isRequestCancellable(r.state);
  const rateable = isRequestRateable(r.state, r.csatScore);
  const agent = assigneeName(r.assignedTo);
  const closed = r.state === 'CANCELLED' || r.state === 'REJECTED';

  return (
    <div className="space-y-4">
      <BackLink />
      <TicketHeader number={r.number} title={r.title || r.catalogItem?.name || 'Request'} status={status} createdAt={r.createdAt}>
        {p ? (
          <Stepper steps={steps} completed={p.completed} current={p.current} />
        ) : r.state === 'REJECTED' ? (
          <StoppedNotice icon={<XCircle className="h-5 w-5" />} title="This request was not approved">
            Check the conversation below for details, or submit a new request if something has changed.
          </StoppedNotice>
        ) : (
          <StoppedNotice icon={<Ban className="h-5 w-5" />} title="This request was cancelled">
            No further work will happen on it.
          </StoppedNotice>
        )}
      </TicketHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <RatingCard
            score={r.csatScore}
            rateable={rateable}
            isPending={rate.isPending}
            subject="this request"
            onSubmit={(score, c) => rate.mutate(
              { id: r.id, score, comment: c || undefined },
              {
                onSuccess: () => toast.success('Thanks for rating!'),
                onError: (err) => toast.error(apiErrorMessage(err, 'We couldn’t save your rating.')),
              },
            )}
          />

          <ResolutionNotes notes={r.resolutionNotes} title="What we did" />

          <Card className="p-5 sm:p-6" aria-labelledby="answers-title">
            <SectionTitle id="answers-title">Your request</SectionTitle>
            {answers.length > 0 ? (
              <dl className="divide-y divide-[#E2E8F0]">
                {answers.map((a) => (
                  <div key={a.key} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm text-[#475569]">{a.label}</dt>
                    <dd className="whitespace-pre-wrap break-words text-sm text-[#0F172A] sm:col-span-2">{a.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-[#475569]">No form answers were needed for this item.</p>
            )}
            {r.description?.trim() && (
              <div className="mt-4 border-t border-[#E2E8F0] pt-4">
                <h3 className="text-sm font-medium text-[#475569]">Anything else we should know?</h3>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#0F172A]">{r.description}</p>
              </div>
            )}
          </Card>

          <Conversation
            messages={(r.comments ?? []).map((c) => ({ id: c.id, text: c.body, createdAt: c.createdAt, author: c.author }))}
            isSending={comment.isPending}
            disabledReason={closed ? 'This request is closed to new messages.' : undefined}
            onSend={(body, done) => comment.mutate(
              { id: r.id, body },
              { onSuccess: done, onError: (err) => toast.error(apiErrorMessage(err, 'We couldn’t send your message.')) },
            )}
          />
        </div>

        <aside className="space-y-4" aria-label="Request details">
          <Card className="p-5">
            <dl className="divide-y divide-[#E2E8F0]">
              <InfoRow label="Item">{r.catalogItem?.name ?? '—'}</InfoRow>
              <InfoRow label="Handled by">
                {agent ?? <span className="font-normal text-[#475569]">Not assigned yet</span>}
              </InfoRow>
              {r.dueAt && !closed && r.state !== 'FULFILLED' && <InfoRow label="Expected by">{formatDate(r.dueAt)}</InfoRow>}
              <InfoRow label="Last update">{timeAgo(r.updatedAt)}</InfoRow>
            </dl>
          </Card>

          {cancellable && (
            <Card className="p-5" aria-labelledby="cancel-title">
              <h2 id="cancel-title" className="text-sm font-semibold text-[#0F172A]">Don't need this any more?</h2>
              {!confirmCancel ? (
                <button type="button" className={`${secondaryBtn} mt-3 w-full`} onClick={() => setConfirmCancel(true)}>
                  Cancel request
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3" role="group" aria-label="Confirm cancellation">
                  <p className="text-sm text-[#991B1B]">Cancel {r.number}? This can't be undone.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className={`${dangerBtn} flex-1`}
                      disabled={cancel.isPending}
                      autoFocus
                      onClick={() => cancel.mutate(r.id, {
                        onSuccess: () => { toast.success(`Request ${r.number} cancelled`); setConfirmCancel(false); },
                        onError: (err) => toast.error(apiErrorMessage(err, 'We couldn’t cancel this request.')),
                      })}
                    >
                      {cancel.isPending ? 'Cancelling…' : 'Yes, cancel it'}
                    </button>
                    <button type="button" className={`${secondaryBtn} flex-1`} onClick={() => setConfirmCancel(false)} disabled={cancel.isPending}>
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Incident detail ────────────────────────────────────────────────────

const INCIDENT_STEPS: Step[] = [{ label: 'Received' }, { label: 'Being worked on' }, { label: 'Resolved' }];
const INCIDENT_PROGRESS: Record<string, { completed: number; current: number | null; label?: string }> = {
  NEW: { completed: 0, current: 0 },
  IN_PROGRESS: { completed: 1, current: 1 },
  ESCALATED: { completed: 1, current: 1 },
  ON_HOLD: { completed: 1, current: 1, label: 'Waiting on you' },
  RESOLVED: { completed: 3, current: null },
  CLOSED: { completed: 3, current: null },
};

export function IncidentTicket() {
  const { id } = useParams<{ id: string }>();
  const q = usePortalIncident(id);
  const comment = useAddPortalIncidentComment();
  const rate = useRatePortalIncident();
  const notFound = isNotFoundError(q.error);

  if (q.isLoading) return <LoadingBlock label="Loading your ticket…" />;
  if (q.error || !q.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBlock
          message={notFound ? 'We couldn’t find this ticket. It may belong to someone else.' : apiErrorMessage(q.error, 'We couldn’t load this ticket.')}
          onRetry={notFound ? undefined : () => q.refetch()}
        />
      </div>
    );
  }

  const inc = q.data;
  const status = incidentStatus(inc.state);
  const p = INCIDENT_PROGRESS[inc.state];
  const rateable = isIncidentRateable(inc.state, inc.csatScore);
  const agent = assigneeName(inc.assignedTo);
  const cancelled = inc.state === 'CANCELLED';

  return (
    <div className="space-y-4">
      <BackLink />
      <TicketHeader number={inc.number} title={inc.shortDescription} status={status} createdAt={inc.createdAt}>
        {p ? (
          <Stepper steps={INCIDENT_STEPS} completed={p.completed} current={p.current} currentLabel={p.label} />
        ) : (
          <StoppedNotice icon={<Ban className="h-5 w-5" />} title="This ticket was cancelled">
            If the problem is still happening, please report it again.
          </StoppedNotice>
        )}
        {inc.state === 'ON_HOLD' && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
            <Info className="mt-0.5 h-5 w-5 flex-none text-[#B45309]" aria-hidden="true" />
            <p className="text-sm text-[#78350F]">
              We need a little more information from you to keep going. Please check the conversation and reply below.
            </p>
          </div>
        )}
      </TicketHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <RatingCard
            score={inc.csatScore}
            rateable={rateable}
            isPending={rate.isPending}
            subject="this ticket"
            onSubmit={(score, c) => rate.mutate(
              { id: inc.id, score, comment: c || undefined },
              {
                onSuccess: () => toast.success('Thanks for rating!'),
                onError: (err) => toast.error(apiErrorMessage(err, 'We couldn’t save your rating.')),
              },
            )}
          />

          <ResolutionNotes notes={inc.resolutionNotes} title="How we fixed it" />

          <Card className="p-5 sm:p-6" aria-labelledby="desc-title">
            <SectionTitle id="desc-title">What you told us</SectionTitle>
            {inc.description?.trim() ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#0F172A]">{inc.description}</p>
            ) : (
              <p className="text-sm text-[#475569]">No extra details were added.</p>
            )}
          </Card>

          <Conversation
            messages={(inc.workNotes ?? []).map((n) => ({ id: n.id, text: n.content, createdAt: n.createdAt, author: n.author }))}
            isSending={comment.isPending}
            disabledReason={cancelled ? 'This ticket is closed to new messages.' : undefined}
            onSend={(body, done) => comment.mutate(
              { id: inc.id, body },
              { onSuccess: done, onError: (err) => toast.error(apiErrorMessage(err, 'We couldn’t send your message.')) },
            )}
          />
        </div>

        <aside className="space-y-4" aria-label="Ticket details">
          <Card className="p-5">
            <dl className="divide-y divide-[#E2E8F0]">
              <InfoRow label="Handled by">
                {agent ? (
                  <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4 text-[#64748B]" aria-hidden="true" />{agent}</span>
                ) : <span className="font-normal text-[#475569]">Not assigned yet</span>}
              </InfoRow>
              {inc.resolvedAt && <InfoRow label="Resolved">{formatDate(inc.resolvedAt)}</InfoRow>}
              <InfoRow label="Last update">{timeAgo(inc.updatedAt)}</InfoRow>
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
