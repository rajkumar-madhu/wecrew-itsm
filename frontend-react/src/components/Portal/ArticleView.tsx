import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Markdown } from '../../lib/markdown';
import { apiErrorMessage, usePortalArticle, usePortalArticleFeedback } from '../../hooks/usePortal';
import { formatDate } from './portalUtils';
import { BackLink, Card, ErrorBlock, LoadingBlock } from './ui';

export default function ArticleView() {
  const { id } = useParams<{ id: string }>();
  const q = usePortalArticle(id);
  const feedback = usePortalArticleFeedback();

  if (q.isLoading) return <LoadingBlock label="Loading article…" />;
  if (q.error || !q.data) {
    const status = (q.error as { response?: { status?: number } } | null)?.response?.status;
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBlock
          message={status === 404 ? 'This article is no longer available.' : apiErrorMessage(q.error, 'We couldn’t load this article.')}
          onRetry={status === 404 ? undefined : () => q.refetch()}
        />
      </div>
    );
  }

  const a = q.data;
  const choice = a.myFeedback;
  const send = (helpful: boolean) => {
    if (feedback.isPending || choice === helpful) return;
    feedback.mutate({ id: a.id, helpful }, {
      onSuccess: () => toast.success(helpful ? 'Glad it helped!' : 'Thanks — we’ll use this to improve the article.'),
      onError: (err) => toast.error(apiErrorMessage(err, 'We couldn’t save your feedback.')),
    });
  };

  const btn = (helpful: boolean) => {
    const selected = choice === helpful;
    const Icon = helpful ? ThumbsUp : ThumbsDown;
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => send(helpful)}
        disabled={feedback.isPending}
        className={`inline-flex min-w-[6rem] items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 disabled:opacity-60 ${
          selected
            ? helpful ? 'border-[#16A34A] bg-[#DCFCE7] text-[#166534]' : 'border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]'
            : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#334155] hover:bg-[#F1F5F9]'
        }`}
      >
        <Icon className={`h-4 w-4 ${selected ? 'fill-current' : ''}`} aria-hidden="true" />
        {helpful ? 'Yes' : 'No'}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink />
      <Card as="article" className="p-5 sm:p-8" aria-labelledby="article-title">
        <header className="mb-6 border-b border-[#E2E8F0] pb-5">
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-[#475569]">
            {a.category && <span className="font-semibold uppercase tracking-wider text-[#4338CA]">{a.category}</span>}
            {a.category && <span aria-hidden="true">·</span>}
            <span className="font-mono">{a.number}</span>
            <span aria-hidden="true">·</span>
            <span>Updated {formatDate(a.updatedAt)}</span>
          </p>
          <h1 id="article-title" className="mt-2 font-display text-2xl font-bold leading-tight text-[#0F172A] sm:text-3xl">{a.title}</h1>
          {Array.isArray(a.tags) && a.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
              {a.tags.map((t) => (
                <li key={t} className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs text-[#334155]">{t}</li>
              ))}
            </ul>
          )}
        </header>

        <Markdown source={a.body ?? ''} tone="light" className="text-[15px] leading-7" />

        <section aria-labelledby="helpful-title" className="mt-8 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="helpful-title" className="font-display text-base font-semibold text-[#0F172A]">Was this helpful?</h2>
            <div className="flex gap-2" role="group" aria-labelledby="helpful-title">
              {btn(true)}
              {btn(false)}
            </div>
          </div>
          {choice === false && (
            <p className="mt-3 text-sm text-[#475569]">
              Sorry this didn't solve it.{' '}
              <Link to="/portal/report" className="inline-flex items-center gap-1 font-medium text-[#4338CA] underline">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Report the problem
              </Link>{' '}
              and someone from the team will help.
            </p>
          )}
          {choice === true && <p className="mt-3 text-sm text-[#166534]">Thanks for letting us know.</p>}
        </section>
      </Card>
    </div>
  );
}
