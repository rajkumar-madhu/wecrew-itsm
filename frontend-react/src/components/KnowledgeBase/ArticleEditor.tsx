import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Save, Send, CheckCircle2, Undo2, Archive, RotateCcw,
  ThumbsUp, ThumbsDown, Loader2, AlertTriangle, Eye,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  useKnowledgeArticle, useCreateArticle, useUpdateArticle, useArticleTransition, useArticleFeedback,
  knowledgeErrorMessage, STATE_LABEL, AUDIENCE_LABEL,
  type ArticleAction, type ArticleAudience, type ArticleState, type KnowledgeArticle,
} from '../../hooks/useKnowledge';
import { Markdown } from '../../lib/markdown';

// ── Shared bits (also used by the list) ──────────────────────────────────────
const STATE_STYLE: Record<ArticleState, { bg: string; color: string; border: string }> = {
  DRAFT:     { bg: 'rgba(138,171,196,0.12)', color: '#C5D8E8', border: 'rgba(138,171,196,0.3)' },
  IN_REVIEW: { bg: 'rgba(245,158,11,0.12)',  color: '#FCD34D', border: 'rgba(245,158,11,0.35)' },
  PUBLISHED: { bg: 'rgba(16,185,129,0.12)',  color: '#6EE7B7', border: 'rgba(16,185,129,0.35)' },
  RETIRED:   { bg: 'rgba(90,125,153,0.12)',  color: '#8AABC4', border: 'rgba(90,125,153,0.3)' },
};

export function StatePill({ state }: { state: ArticleState }) {
  const s = STATE_STYLE[state] ?? STATE_STYLE.DRAFT;
  return (
    <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {STATE_LABEL[state] ?? state}
    </span>
  );
}

const CATEGORY_SUGGESTIONS = ['Infrastructure', 'Application', 'Database', 'Network', 'Security', 'Access', 'Hardware', 'How-to', 'Other'];

const REVIEWER_ROLES = ['ADMIN', 'MANAGER'];
const WRITER_ROLES = ['ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR'];

const inputCls = 'w-full rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/40';
const inputStyle = { background: '#0F1B2D', border: '1px solid rgba(99,179,255,0.12)', color: '#E8F1FA' };
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest mb-1.5';
const labelStyle = { color: '#8AABC4' };

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function personName(p: { firstName: string; lastName: string } | null | undefined) {
  return p ? `${p.firstName} ${p.lastName}`.trim() : '—';
}

// ── Workflow ─────────────────────────────────────────────────────────────────
interface WorkflowButton {
  action: ArticleAction;
  label: string;
  icon: typeof Send;
  primary?: boolean;
}

function workflowButtons(state: ArticleState, isAuthor: boolean, isReviewer: boolean): WorkflowButton[] {
  const out: WorkflowButton[] = [];
  if (state === 'DRAFT' && isAuthor) out.push({ action: 'submit', label: 'Submit for review', icon: Send, primary: !isReviewer });
  if ((state === 'DRAFT' || state === 'IN_REVIEW') && isReviewer) out.push({ action: 'publish', label: 'Publish', icon: CheckCircle2, primary: true });
  if (state === 'IN_REVIEW' && isReviewer) out.push({ action: 'reject', label: 'Send back', icon: Undo2 });
  if (state === 'PUBLISHED' && isReviewer) out.push({ action: 'retire', label: 'Retire', icon: Archive });
  if (state === 'RETIRED' && isReviewer) out.push({ action: 'restore', label: 'Restore', icon: RotateCcw });
  return out;
}

const ACTION_DONE: Record<ArticleAction, string> = {
  submit: 'Submitted for review',
  publish: 'Article published',
  reject: 'Sent back to the author',
  retire: 'Article retired',
  restore: 'Article restored as a draft',
};

// ── Form ─────────────────────────────────────────────────────────────────────
interface FormValues {
  title: string;
  category: string;
  tags: string;
  audience: ArticleAudience;
  body: string;
}

function toForm(a: KnowledgeArticle | null): FormValues {
  return {
    title: a?.title ?? '',
    category: a?.category ?? '',
    tags: (a?.tags ?? []).join(', '),
    audience: a?.audience ?? 'INTERNAL',
    body: a?.body ?? '',
  };
}

function parseTags(s: string): string[] {
  return s.split(',').map((t) => t.trim()).filter(Boolean);
}

function EditorBody({
  article, onClose, onCreated,
}: {
  article: KnowledgeArticle | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? '';
  const isReviewer = REVIEWER_ROLES.includes(role);
  const isWriter = WRITER_ROLES.includes(role);
  const isAuthor = !!article && !!user && article.authorId === user.id;
  const isNew = !article;
  const canEdit = isNew
    ? isWriter
    : isWriter && article.state !== 'RETIRED' && (isAuthor || isReviewer);

  const [form, setForm] = useState<FormValues>(() => toForm(article));
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  const create = useCreateArticle();
  const update = useUpdateArticle();
  const transition = useArticleTransition();
  const feedback = useArticleFeedback();

  const initial = toForm(article);
  const dirty = (Object.keys(form) as (keyof FormValues)[]).some((k) => form[k] !== initial[k]);
  const busy = create.isPending || update.isPending || transition.isPending;

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  function fail(e: unknown, fallback: string) {
    const msg = knowledgeErrorMessage(e, fallback);
    setError(msg);
    toast.error(msg);
  }

  async function handleSave() {
    setError('');
    if (form.title.trim().length < 3) { setError('Title must be at least 3 characters'); return; }
    if (!form.body.trim()) { setError('Article body cannot be empty'); return; }
    const input = {
      title: form.title.trim(),
      body: form.body,
      category: form.category.trim(),
      tags: parseTags(form.tags),
      audience: form.audience,
    };
    try {
      if (isNew) {
        const created = await create.mutateAsync(input);
        toast.success(`${created.number} created as a draft`);
        onCreated(created.id);
      } else {
        const saved = await update.mutateAsync({ id: article.id, input });
        setForm(toForm({ ...article, ...saved }));
        toast.success(saved.state === 'IN_REVIEW' && article.state === 'PUBLISHED'
          ? 'Saved — the change goes back to review'
          : 'Article saved');
      }
    } catch (e) {
      fail(e, 'Failed to save the article');
    }
  }

  async function handleTransition(action: ArticleAction) {
    if (!article) return;
    setError('');
    if (dirty) { setError('Save your changes before changing the article state'); return; }
    try {
      await transition.mutateAsync({ id: article.id, action });
      toast.success(ACTION_DONE[action]);
    } catch (e) {
      fail(e, 'Failed to update the article');
    }
  }

  async function handleFeedback(helpful: boolean) {
    if (!article) return;
    try {
      await feedback.mutateAsync({ id: article.id, helpful });
      toast.success('Thanks for the feedback');
    } catch (e) {
      fail(e, 'Failed to save feedback');
    }
  }

  const buttons = article ? workflowButtons(article.state, isAuthor, isReviewer) : [];
  const helpfulTotal = article ? article.helpfulYes + article.helpfulNo : 0;

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: '#0B1424', border: '1px solid rgba(99,179,255,0.12)' }}>
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-[12px] font-medium mb-3 hover:underline"
          style={{ color: '#8AABC4' }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to articles
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {article && <span className="text-[11px] font-mono font-bold tracking-widest" style={{ color: '#818CF8' }}>{article.number}</span>}
              {article ? <StatePill state={article.state} /> : <span className="text-[11px] font-semibold" style={{ color: '#8AABC4' }}>New article</span>}
              {article && (
                <span className="text-[11px]" style={{ color: '#8AABC4' }}>
                  {AUDIENCE_LABEL[article.audience]} · v{article.version}
                </span>
              )}
            </div>
            <h1 className="text-[20px] font-display font-bold tracking-tight break-words" style={{ color: '#E8F1FA' }}>
              {form.title.trim() || article?.title || 'Untitled article'}
            </h1>
          </div>
          {article && (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-[11px]">
              <div><dt style={{ color: '#8AABC4' }}>Author</dt><dd style={{ color: '#E8F1FA' }}>{personName(article.author)}</dd></div>
              <div><dt style={{ color: '#8AABC4' }}>Published</dt><dd style={{ color: '#E8F1FA' }}>{fmtDate(article.publishedAt)}</dd></div>
              <div><dt style={{ color: '#8AABC4' }}>Updated</dt><dd style={{ color: '#E8F1FA' }}>{fmtDate(article.updatedAt)}</dd></div>
              <div>
                <dt style={{ color: '#8AABC4' }}>Helpful</dt>
                <dd style={{ color: '#E8F1FA' }}>
                  {article.helpfulYes} yes · {article.helpfulNo} no
                  {helpfulTotal > 0 && ` (${Math.round((article.helpfulYes / helpfulTotal) * 100)}%)`}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]"
          style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)', color: '#FCA5A5' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {canEdit ? (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0B1424', border: '1px solid rgba(99,179,255,0.12)' }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="kb-title" className={labelCls} style={labelStyle}>Title</label>
              <input id="kb-title" value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)}
                className={inputCls} style={inputStyle} placeholder="How to reset a VPN token" />
            </div>
            <div>
              <label htmlFor="kb-category" className={labelCls} style={labelStyle}>Category</label>
              <input id="kb-category" value={form.category} maxLength={60} list="kb-category-options"
                onChange={(e) => set('category', e.target.value)} className={inputCls} style={inputStyle} />
              <datalist id="kb-category-options">
                {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="kb-audience" className={labelCls} style={labelStyle}>Audience</label>
              <select id="kb-audience" value={form.audience}
                onChange={(e) => set('audience', e.target.value as ArticleAudience)}
                className={inputCls} style={inputStyle}>
                <option value="INTERNAL">Internal (agents only)</option>
                <option value="PORTAL">Portal (requesters can read it)</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <label htmlFor="kb-tags" className={labelCls} style={labelStyle}>Tags (comma separated)</label>
              <input id="kb-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)}
                className={inputCls} style={inputStyle} placeholder="vpn, remote-access" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label htmlFor="kb-body" className={labelCls + ' mb-0'} style={labelStyle}>Body (Markdown)</label>
            <button type="button" onClick={() => setShowPreview((v) => !v)} aria-pressed={showPreview}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg"
              style={{ color: '#C5D8E8', border: '1px solid rgba(99,179,255,0.12)' }}>
              <Eye className="w-3 h-3" /> {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
          </div>
          <div className={`grid gap-3 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            <textarea id="kb-body" value={form.body} onChange={(e) => set('body', e.target.value)}
              rows={22} spellCheck
              className={inputCls + ' font-mono text-[12px] leading-relaxed resize-y min-h-[320px]'} style={inputStyle}
              placeholder={'## Symptoms\n\n## Resolution\n\n1. First step\n2. Second step'} />
            {showPreview && (
              <section aria-label="Preview" className="rounded-xl px-4 py-2 overflow-auto min-h-[320px] text-[13px]"
                style={{ background: '#060A14', border: '1px solid rgba(99,179,255,0.12)' }}>
                {form.body.trim()
                  ? <Markdown source={form.body} tone="dark" />
                  : <p className="text-[12px] py-2" style={{ color: '#8AABC4' }}>The preview appears here as you type.</p>}
              </section>
            )}
          </div>
          {article?.state === 'PUBLISHED' && !isReviewer && (
            <p className="text-[11px]" style={{ color: '#FCD34D' }}>
              Saving changes to a published article sends it back to review.
            </p>
          )}
        </div>
      ) : article ? (
        <article className="rounded-2xl px-6 py-4 text-[14px]" style={{ background: '#0B1424', border: '1px solid rgba(99,179,255,0.12)' }}>
          {(article.category || article.tags.length > 0) && (
            <p className="text-[11px] mb-2" style={{ color: '#8AABC4' }}>
              {article.category && <span>{article.category}</span>}
              {article.category && article.tags.length > 0 && ' · '}
              {article.tags.map((t) => `#${t}`).join(' ')}
            </p>
          )}
          <Markdown source={article.body} tone="dark" />
        </article>
      ) : (
        <p className="text-[12px]" style={{ color: '#8AABC4' }}>You do not have permission to create articles.</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <button onClick={handleSave} disabled={busy || (!isNew && !dirty)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-50"
            style={{ background: '#6366F1', color: '#FFFFFF' }}>
            {(create.isPending || update.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isNew ? 'Create draft' : 'Save'}
          </button>
        )}
        {buttons.map((b) => (
          <button key={b.action} onClick={() => handleTransition(b.action)} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-50"
            style={b.primary
              ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#6EE7B7' }
              : { background: '#0F1B2D', border: '1px solid rgba(99,179,255,0.12)', color: '#C5D8E8' }}>
            <b.icon className="w-3.5 h-3.5" /> {b.label}
          </button>
        ))}
        {dirty && !isNew && <span className="text-[11px]" style={{ color: '#FCD34D' }}>Unsaved changes</span>}
      </div>

      {/* Feedback */}
      {article?.state === 'PUBLISHED' && (
        <div className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
          style={{ background: '#0B1424', border: '1px solid rgba(99,179,255,0.12)' }}>
          <span className="text-[13px] font-medium" style={{ color: '#E8F1FA' }} id="kb-helpful-label">Was this helpful?</span>
          <div role="group" aria-labelledby="kb-helpful-label" className="flex gap-2">
            {[true, false].map((v) => {
              const active = article.myFeedback === v;
              const Icon = v ? ThumbsUp : ThumbsDown;
              return (
                <button key={String(v)} onClick={() => handleFeedback(v)} disabled={feedback.isPending}
                  aria-pressed={active}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
                  style={active
                    ? { background: 'rgba(99,102,241,0.2)', border: '1px solid #6366F1', color: '#E8F1FA' }
                    : { background: '#0F1B2D', border: '1px solid rgba(99,179,255,0.12)', color: '#C5D8E8' }}>
                  <Icon className="w-3.5 h-3.5" /> {v ? 'Yes' : 'No'}
                </button>
              );
            })}
          </div>
          {article.myFeedback !== null && (
            <span className="text-[11px]" style={{ color: '#8AABC4' }}>
              You answered {article.myFeedback ? 'yes' : 'no'} — click the other option to change it.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Article view / editor. `articleId` null = new article.
 */
export default function ArticleEditor({
  articleId, onClose, onCreated,
}: {
  articleId: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { data: article, isLoading, isError, error } = useKnowledgeArticle(articleId);

  if (articleId && isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#818CF8' }} />
        <span className="text-[12px] font-mono" style={{ color: '#8AABC4' }}>Loading article…</span>
      </div>
    );
  }

  if (articleId && (isError || !article)) {
    return (
      <div className="px-4 pt-4">
        <div className="rounded-2xl p-8 text-center" style={{ background: '#0B1424', border: '1px solid rgba(99,179,255,0.12)' }}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: '#F87171' }} />
          <p className="text-[13px]" style={{ color: '#E8F1FA' }}>{knowledgeErrorMessage(error, 'Article not found')}</p>
          <button onClick={onClose} className="mt-3 text-[12px] font-medium hover:underline" style={{ color: '#818CF8' }}>
            Back to articles
          </button>
        </div>
      </div>
    );
  }

  return <EditorBody key={article?.id ?? 'new'} article={article ?? null} onClose={onClose} onCreated={onCreated} />;
}
