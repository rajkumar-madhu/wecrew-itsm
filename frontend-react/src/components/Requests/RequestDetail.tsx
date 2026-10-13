import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, Play, Ban, Lock, MessageSquare,
  Star, AlertTriangle, ShieldCheck, Send, User as UserIcon,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  useRequest, useUpdateRequest, useRequestDecision, useAddRequestComment,
  useAgentOptions, useTeamOptions,
  STATE_META, NEXT_STATES, TERMINAL_STATES, personName, apiError,
  type RequestState, type ServiceRequest, type FormField, type RequestApproval,
} from '../../hooks/useRequests';

// ── Helpers ────────────────────────────────────────────────────────────────────
const card = 'rounded-2xl bg-[#0B1424] border border-[rgba(99,179,255,0.12)]';
const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#0F1B2D] text-[#E8F1FA] border border-[rgba(99,179,255,0.16)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] placeholder:text-[#7590A9]';
const labelCls = 'block text-[11px] font-semibold text-[#C5D8E8] mb-1';
const ghostBtn = 'text-[13px] px-3 py-2 rounded-lg text-[#C5D8E8] hover:bg-[#152238] transition-colors';

function fmt(iso: string | null | undefined, pattern = 'PP p'): string {
  if (!iso) return '—';
  try { return format(new Date(iso), pattern); } catch { return '—'; }
}
function relative(iso: string): string {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ''; }
}
function isOverdue(r: ServiceRequest): boolean {
  return !!r.dueAt && !TERMINAL_STATES.includes(r.state) && new Date(r.dueAt).getTime() < Date.now();
}

function formatAnswer(value: unknown, field?: FormField): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field?.type === 'checkbox' || typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field?.type === 'date' && typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return format(d, 'PP');
  }
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const TRANSITION_META: Partial<Record<RequestState, { label: string; icon: typeof Play }>> = {
  IN_FULFILLMENT: { label: 'Start fulfilment', icon: Play },
  FULFILLED: { label: 'Mark fulfilled', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancel request', icon: Ban },
};

function StatePill({ state }: { state: RequestState }) {
  const m = STATE_META[state] ?? STATE_META.SUBMITTED;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} aria-hidden="true" />
      {m.label}
    </span>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[12px] font-bold text-[#8AABC4] uppercase tracking-widest mb-3">
      <Icon className="w-3.5 h-3.5 text-[#818CF8]" aria-hidden="true" /> {children}
    </h2>
  );
}

// ── Approvals ──────────────────────────────────────────────────────────────────
const APPROVAL_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pending', color: '#FCD34D', icon: Clock },
  APPROVED: { label: 'Approved', color: '#6EE7B7', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: '#FDA4AF', icon: XCircle },
};

function ApprovalsPanel({ req, userId }: { req: ServiceRequest; userId?: string }) {
  const decision = useRequestDecision(req.id);
  const [comment, setComment] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);
  const approvals: RequestApproval[] = req.approvals ?? [];
  const myPending = req.state === 'PENDING_APPROVAL'
    && approvals.some((a) => a.approver?.id === userId && a.state === 'PENDING');

  function decide(d: 'approve' | 'reject') {
    decision.mutate({ decision: d, comments: comment.trim() || undefined }, {
      onSuccess: () => {
        toast.success(d === 'approve' ? 'Request approved' : 'Request rejected');
        setComment(''); setConfirmReject(false);
      },
      onError: (err) => toast.error(apiError(err, 'Could not record your decision')),
    });
  }

  return (
    <section className={`${card} p-4`} aria-labelledby="approvals-heading">
      <div id="approvals-heading"><SectionTitle icon={ShieldCheck}>Approvals</SectionTitle></div>
      {approvals.length === 0 ? (
        <p className="text-[12px] text-[#8AABC4]">This request doesn't need approval.</p>
      ) : (
        <ul className="space-y-2">
          {approvals.map((a) => {
            const m = APPROVAL_META[a.state] ?? APPROVAL_META.PENDING;
            const Icon = m.icon;
            return (
              <li key={a.id} className="rounded-lg bg-[#0F1B2D] border border-[rgba(99,179,255,0.08)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-[#E8F1FA]">
                    {personName(a.approver) || 'Approver'}{a.approver?.id === userId && <span className="text-[#8AABC4]"> (you)</span>}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: m.color }}>
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {m.label}
                  </span>
                </div>
                {a.decidedAt && <p className="text-[11px] text-[#8AABC4] mt-0.5">{fmt(a.decidedAt)}</p>}
                {a.comments && <p className="text-[12px] text-[#C5D8E8] mt-1 whitespace-pre-wrap">"{a.comments}"</p>}
              </li>
            );
          })}
        </ul>
      )}

      {myPending && (
        <div className="mt-4 pt-4 border-t border-[rgba(99,179,255,0.12)] space-y-3">
          <p className="text-[13px] font-semibold text-[#E8F1FA]">Your decision is needed</p>
          <div>
            <label htmlFor="decision-comment" className={labelCls}>Comment (optional)</label>
            <textarea id="decision-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
              className={inputCls} placeholder="Shared with the requester" />
          </div>
          {confirmReject ? (
            <div className="rounded-lg border border-[rgba(244,63,94,0.35)] bg-[rgba(244,63,94,0.08)] p-3 space-y-2" role="alert">
              <p className="text-[12px] text-[#FDA4AF]">Reject this request? The requester will be told it was declined.</p>
              <div className="flex gap-2">
                <button type="button" disabled={decision.isPending} onClick={() => decide('reject')}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg bg-[#E11D48] text-[#FFFFFF] disabled:opacity-50">
                  {decision.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />} Yes, reject
                </button>
                <button type="button" onClick={() => setConfirmReject(false)} className={ghostBtn}>Keep pending</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" disabled={decision.isPending} onClick={() => decide('approve')}
                className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg bg-[#059669] text-[#FFFFFF] hover:brightness-110 disabled:opacity-50">
                {decision.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
                Approve
              </button>
              <button type="button" disabled={decision.isPending} onClick={() => setConfirmReject(true)}
                className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-lg border border-[rgba(244,63,94,0.4)] text-[#FB7185] hover:bg-[rgba(244,63,94,0.1)] disabled:opacity-50">
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Reject
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Actions (state transitions + assignment) ───────────────────────────────────
function ActionsPanel({ req }: { req: ServiceRequest }) {
  const update = useUpdateRequest(req.id);
  const { data: agents = [] } = useAgentOptions();
  const { data: teams = [] } = useTeamOptions();
  const [pending, setPending] = useState<RequestState | null>(null);
  const [notes, setNotes] = useState(req.resolutionNotes ?? '');
  const [notesError, setNotesError] = useState('');
  const terminal = TERMINAL_STATES.includes(req.state);
  const next = NEXT_STATES[req.state] ?? [];
  const assigneeId = req.assignedTo?.id ?? req.assignedToId ?? '';
  const teamId = req.fulfillmentTeam?.id ?? req.fulfillmentTeamId ?? '';

  function transition(state: RequestState, extra: { resolutionNotes?: string } = {}) {
    update.mutate({ state, ...extra }, {
      onSuccess: () => { toast.success(`Request ${STATE_META[state].label.toLowerCase()}`); setPending(null); },
      onError: (err) => toast.error(apiError(err, 'Could not update the request')),
    });
  }

  function patch(body: Parameters<typeof update.mutate>[0], msg: string) {
    update.mutate(body, {
      onSuccess: () => toast.success(msg),
      onError: (err) => toast.error(apiError(err, 'Could not update the request')),
    });
  }

  function onTransitionClick(state: RequestState) {
    if (state === 'FULFILLED' || state === 'CANCELLED') { setPending(state); setNotesError(''); return; }
    transition(state);
  }

  function confirmFulfil() {
    if (!notes.trim()) { setNotesError('Add resolution notes so the requester knows what was done'); return; }
    transition('FULFILLED', { resolutionNotes: notes.trim() });
  }

  return (
    <section className={`${card} p-4 space-y-4`} aria-labelledby="actions-heading">
      <div id="actions-heading"><SectionTitle icon={Play}>Work this request</SectionTitle></div>

      {terminal ? (
        <p className="text-[12px] text-[#8AABC4]">This request is closed ({STATE_META[req.state].label.toLowerCase()}). No further changes can be made.</p>
      ) : (
        <>
          {next.length > 0 && !pending && (
            <div className="flex flex-wrap gap-2">
              {next.map((s) => {
                const m = TRANSITION_META[s] ?? { label: STATE_META[s].label, icon: Play };
                const Icon = m.icon;
                const danger = s === 'CANCELLED';
                return (
                  <button key={s} type="button" disabled={update.isPending} onClick={() => onTransitionClick(s)}
                    className={danger
                      ? 'flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-lg border border-[rgba(244,63,94,0.4)] text-[#FB7185] hover:bg-[rgba(244,63,94,0.1)] disabled:opacity-50'
                      : 'btn-primary text-[13px] flex items-center gap-1.5 disabled:opacity-50'}>
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {m.label}
                  </button>
                );
              })}
            </div>
          )}
          {req.state === 'PENDING_APPROVAL' && !pending && (
            <p className="text-[12px] text-[#8AABC4]">Fulfilment can start once the approvers have approved it.</p>
          )}

          {pending === 'FULFILLED' && (
            <div className="rounded-lg border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.06)] p-3 space-y-2">
              <label htmlFor="fulfil-notes" className={labelCls}>Resolution notes (visible to the requester)</label>
              <textarea id="fulfil-notes" rows={4} value={notes} autoFocus
                onChange={(e) => { setNotes(e.target.value); setNotesError(''); }}
                className={inputCls} placeholder="What was done, and anything the requester needs to know" />
              {notesError && <p role="alert" className="text-[12px] text-[#FB7185]">{notesError}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={update.isPending} onClick={confirmFulfil}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg bg-[#059669] text-[#FFFFFF] disabled:opacity-50">
                  {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />} Mark fulfilled
                </button>
                <button type="button" onClick={() => setPending(null)} className={ghostBtn}>Back</button>
              </div>
            </div>
          )}

          {pending === 'CANCELLED' && (
            <div className="rounded-lg border border-[rgba(244,63,94,0.35)] bg-[rgba(244,63,94,0.08)] p-3 space-y-2" role="alert">
              <p className="text-[12px] text-[#FDA4AF]">Cancel {req.number}? This closes the request and can't be undone.</p>
              <div className="flex gap-2">
                <button type="button" disabled={update.isPending} onClick={() => transition('CANCELLED')}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg bg-[#E11D48] text-[#FFFFFF] disabled:opacity-50">
                  {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />} Yes, cancel request
                </button>
                <button type="button" onClick={() => setPending(null)} className={ghostBtn}>Keep it open</button>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <div>
              <label htmlFor="assignee" className={labelCls}>Assignee</label>
              <select id="assignee" value={assigneeId} disabled={update.isPending}
                onChange={(e) => patch({ assignedToId: e.target.value || null }, e.target.value ? 'Assignee updated' : 'Request unassigned')}
                className={inputCls}>
                <option value="">Unassigned</option>
                {assigneeId && !agents.some((a) => a.id === assigneeId) && (
                  <option value={assigneeId}>{personName(req.assignedTo) || 'Current assignee'}</option>
                )}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{personName(a)} · {a.role.toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fulfil-team" className={labelCls}>Fulfilment team</label>
              <select id="fulfil-team" value={teamId} disabled={update.isPending}
                onChange={(e) => patch({ fulfillmentTeamId: e.target.value || null }, 'Fulfilment team updated')}
                className={inputCls}>
                <option value="">No team</option>
                {teamId && !teams.some((t) => t.id === teamId) && (
                  <option value={teamId}>{req.fulfillmentTeam?.name ?? 'Current team'}</option>
                )}
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {pending !== 'FULFILLED' && (
            <div>
              <label htmlFor="resolution-notes" className={labelCls}>Resolution notes</label>
              <textarea id="resolution-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                className={inputCls} placeholder="Shown to the requester when the request is fulfilled" />
              <div className="flex justify-end mt-2">
                <button type="button" disabled={update.isPending || notes === (req.resolutionNotes ?? '')}
                  onClick={() => patch({ resolutionNotes: notes }, 'Resolution notes saved')}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#152238] text-[#C5D8E8] hover:text-[#E8F1FA] disabled:opacity-40">
                  Save notes
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Comments ───────────────────────────────────────────────────────────────────
function CommentsPanel({ req }: { req: ServiceRequest }) {
  const add = useAddRequestComment(req.id);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(true);
  const comments = req.comments ?? [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    add.mutate({ body: body.trim(), isInternal: internal }, {
      onSuccess: () => { setBody(''); toast.success(internal ? 'Internal note added' : 'Comment sent to requester'); },
      onError: (err) => toast.error(apiError(err, 'Could not add the comment')),
    });
  }

  return (
    <section className={`${card} p-4`} aria-labelledby="comments-heading">
      <div id="comments-heading"><SectionTitle icon={MessageSquare}>Activity ({comments.length})</SectionTitle></div>
      {comments.length === 0 ? (
        <p className="text-[12px] text-[#8AABC4] mb-4">No comments yet.</p>
      ) : (
        <ol className="space-y-3 mb-4">
          {comments.map((c) => (
            <li key={c.id}
              className={c.isInternal
                ? 'rounded-xl px-3 py-2.5 bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.25)]'
                : 'rounded-xl px-3 py-2.5 bg-[#0F1B2D] border border-[rgba(99,179,255,0.08)]'}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[12px] font-semibold text-[#E8F1FA]">{personName(c.author) || 'System'}</span>
                {c.isInternal && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#FCD34D]">
                    <Lock className="w-3 h-3" aria-hidden="true" /> Internal note
                  </span>
                )}
                <span className="text-[11px] text-[#8AABC4]" title={fmt(c.createdAt, 'PPpp')}>{relative(c.createdAt)}</span>
              </div>
              <p className="text-[13px] text-[#C5D8E8] whitespace-pre-wrap break-words">{c.body}</p>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="comment-body" className={labelCls}>Add a comment</label>
        <textarea id="comment-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)}
          className={inputCls} placeholder={internal ? 'Note for agents only' : 'Reply to the requester'} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="comment-internal" className="flex items-center gap-2 text-[12px] text-[#C5D8E8] cursor-pointer">
            <input id="comment-internal" type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)}
              className="w-4 h-4 accent-[#6366F1]" />
            Internal note (hidden from requester)
          </label>
          <button type="submit" disabled={add.isPending || !body.trim()}
            className="btn-primary text-[13px] flex items-center gap-1.5 disabled:opacity-50">
            {add.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Send className="w-3.5 h-3.5" aria-hidden="true" />}
            {internal ? 'Add note' : 'Send to requester'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: req, isLoading, isError, error, refetch } = useRequest(id);

  const back = (
    <Link to="/requests" className="inline-flex items-center gap-1.5 text-[12px] text-[#8AABC4] hover:text-[#E8F1FA] transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> All requests
    </Link>
  );

  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-4" aria-busy="true">
        {back}
        <div className={`${card} p-6 animate-pulse space-y-3`}>
          <div className="h-3 w-24 rounded bg-[#152238]" />
          <div className="h-6 w-2/3 rounded bg-[#152238]" />
          <div className="h-3 w-1/2 rounded bg-[#152238]" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={`${card} h-48 lg:col-span-2 animate-pulse`} />
          <div className={`${card} h-48 animate-pulse`} />
        </div>
      </div>
    );
  }

  if (isError || !req) {
    return (
      <div className="px-4 pt-4 space-y-4">
        {back}
        <div className={`${card} flex flex-col items-center justify-center py-14 gap-3 text-center px-4`}>
          <AlertTriangle className="w-8 h-8 text-[#FB7185]" aria-hidden="true" />
          <p className="text-[14px] font-semibold text-[#E8F1FA]">Couldn't load this request</p>
          <p className="text-[12px] text-[#8AABC4]">{apiError(error, 'It may have been removed, or you may not have access.')}</p>
          <button type="button" onClick={() => refetch()} className="btn-primary text-sm">Retry</button>
        </div>
      </div>
    );
  }

  const rawSchema = req.catalogItem?.formSchema;
  const schema: FormField[] = Array.isArray(rawSchema) ? rawSchema : [];
  const formData = req.formData ?? {};
  const answered = [
    ...schema.map((f) => ({ key: f.key, label: f.label || f.key, value: formatAnswer(formData[f.key], f) })),
    ...Object.keys(formData)
      .filter((k) => !schema.some((f) => f.key === k))
      .map((k) => ({ key: k, label: k, value: formatAnswer(formData[k]) })),
  ];
  const overdue = isOverdue(req);

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div className="relative overflow-hidden bg-white shadow-sm border border-stone-200 rounded-2xl mx-4 mt-4">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-72 h-20 pointer-events-none opacity-[0.08]"
          style={{ background: 'radial-gradient(ellipse at 100% 0%, #6366F1 0%, transparent 70%)' }} />
        <div className="relative px-6 py-5 space-y-3">
          {back}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] font-mono font-semibold text-[#A5B4FC]">{req.number}</span>
                {req.catalogItem && (
                  <>
                    <span className="text-[#7590A9]" aria-hidden="true">/</span>
                    <span className="text-[11px] font-mono text-[#8AABC4] uppercase tracking-widest">{req.catalogItem.name}</span>
                  </>
                )}
              </div>
              <h1 className="text-[22px] font-display font-bold text-[#E8F1FA] tracking-tight break-words">{req.title}</h1>
            </div>
            <StatePill state={req.state} />
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div>
              <dt className="text-[10px] font-bold text-[#8AABC4] uppercase tracking-widest">Requester</dt>
              <dd className="flex items-center gap-1.5 text-[13px] text-[#E8F1FA] mt-0.5">
                <UserIcon className="w-3.5 h-3.5 text-[#8AABC4]" aria-hidden="true" />
                {personName(req.requestedBy) || '—'}
              </dd>
              {req.requestedBy?.email && <dd className="text-[11px] text-[#8AABC4] truncate">{req.requestedBy.email}</dd>}
            </div>
            <div>
              <dt className="text-[10px] font-bold text-[#8AABC4] uppercase tracking-widest">Catalog item</dt>
              <dd className="text-[13px] text-[#E8F1FA] mt-0.5">{req.catalogItem?.name ?? '—'}</dd>
              {req.catalogItem?.category && <dd className="text-[11px] text-[#8AABC4]">{req.catalogItem.category}</dd>}
            </div>
            <div>
              <dt className="text-[10px] font-bold text-[#8AABC4] uppercase tracking-widest">Due</dt>
              <dd className={`text-[13px] mt-0.5 ${overdue ? 'font-semibold text-[#FB7185]' : 'text-[#E8F1FA]'}`}>
                {req.dueAt ? (overdue ? `Overdue · ${fmt(req.dueAt)}` : fmt(req.dueAt)) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold text-[#8AABC4] uppercase tracking-widest">Created</dt>
              <dd className="text-[13px] text-[#E8F1FA] mt-0.5">{fmt(req.createdAt)}</dd>
            </div>
          </dl>
        </div>
        <div className="h-px mx-6" style={{ background: 'linear-gradient(90deg, #6366F1, transparent)' }} />
      </div>

      <div className="px-4 pt-4 pb-6 grid gap-4 lg:grid-cols-3 items-start">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-4">
          <section className={`${card} p-4`} aria-labelledby="answers-heading">
            <div id="answers-heading"><SectionTitle icon={CheckCircle2}>Form answers</SectionTitle></div>
            {answered.length === 0 ? (
              <p className="text-[12px] text-[#8AABC4]">No form fields were filled in for this request.</p>
            ) : (
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {answered.map((a) => (
                  <div key={a.key} className="min-w-0">
                    <dt className="text-[11px] text-[#8AABC4]">{a.label}</dt>
                    <dd className="text-[13px] text-[#E8F1FA] whitespace-pre-wrap break-words">{a.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className={`${card} p-4`} aria-labelledby="desc-heading">
            <div id="desc-heading"><SectionTitle icon={MessageSquare}>Description</SectionTitle></div>
            {req.description
              ? <p className="text-[13px] text-[#C5D8E8] whitespace-pre-wrap break-words">{req.description}</p>
              : <p className="text-[12px] text-[#8AABC4]">No description provided.</p>}
          </section>

          {TERMINAL_STATES.includes(req.state) && req.resolutionNotes && (
            <section className={`${card} p-4`} aria-labelledby="resolution-heading">
              <div id="resolution-heading"><SectionTitle icon={CheckCircle2}>Resolution notes</SectionTitle></div>
              <p className="text-[13px] text-[#C5D8E8] whitespace-pre-wrap break-words">{req.resolutionNotes}</p>
            </section>
          )}

          <CommentsPanel req={req} />
        </div>

        {/* ── Side column ── */}
        <div className="space-y-4">
          <ActionsPanel key={`${req.id}:${req.state}:${req.resolutionNotes ?? ''}`} req={req} />
          <ApprovalsPanel req={req} userId={user?.id} />

          {typeof req.csatScore === 'number' && (
            <section className={`${card} p-4`} aria-labelledby="csat-heading">
              <div id="csat-heading"><SectionTitle icon={Star}>Requester satisfaction</SectionTitle></div>
              <div className="flex items-center gap-2">
                <div className="flex" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-4 h-4 ${n <= (req.csatScore ?? 0) ? 'text-[#FCD34D] fill-[#FCD34D]' : 'text-[#2A4060]'}`} />
                  ))}
                </div>
                <span className="text-[13px] font-semibold text-[#E8F1FA]">{req.csatScore} / 5</span>
              </div>
              {req.csatComment && <p className="text-[12px] text-[#C5D8E8] mt-2 whitespace-pre-wrap">"{req.csatComment}"</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
