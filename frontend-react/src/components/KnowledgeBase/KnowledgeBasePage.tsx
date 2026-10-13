import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Plus, Search, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  useKnowledgeArticles, knowledgeErrorMessage, AUDIENCE_LABEL,
  type ArticleAudience, type ArticleState,
} from '../../hooks/useKnowledge';
import ArticleEditor, { StatePill } from './ArticleEditor';
import KnownErrors from './KnownErrors';

type Tab = 'articles' | 'known-errors';

const STATE_FILTERS: { key: string; label: string; states: ArticleState[] }[] = [
  { key: 'all', label: 'All', states: [] },
  { key: 'draft', label: 'Drafts', states: ['DRAFT'] },
  { key: 'review', label: 'In review', states: ['IN_REVIEW'] },
  { key: 'published', label: 'Published', states: ['PUBLISHED'] },
  { key: 'retired', label: 'Retired', states: ['RETIRED'] },
];

const AUDIENCE_FILTERS: { key: ArticleAudience | ''; label: string }[] = [
  { key: '', label: 'Any audience' },
  { key: 'INTERNAL', label: 'Internal' },
  { key: 'PORTAL', label: 'Portal' },
];

const WRITER_ROLES = ['ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR'];
const PAGE_SIZE = 25;

const border = '1px solid rgba(99,179,255,0.12)';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
      style={active
        ? { background: 'rgba(99,102,241,0.2)', border: '1px solid #6366F1', color: '#E8F1FA' }
        : { background: '#0F1B2D', border, color: '#C5D8E8' }}>
      {children}
    </button>
  );
}

function ArticlesTab({ onOpen, onNew, canCreate }: { onOpen: (id: string) => void; onNew: () => void; canCreate: boolean }) {
  const [stateKey, setStateKey] = useState('all');
  const [audience, setAudience] = useState<ArticleAudience | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const states = STATE_FILTERS.find((f) => f.key === stateKey)?.states ?? [];
  const { data, isLoading, isError, error, isFetching } = useKnowledgeArticles({ q, state: states, audience, page, limit: PAGE_SIZE });
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by state" className="flex flex-wrap gap-1.5">
          {STATE_FILTERS.map((f) => (
            <Chip key={f.key} active={stateKey === f.key} onClick={() => { setStateKey(f.key); setPage(1); }}>{f.label}</Chip>
          ))}
        </div>
        <span className="w-px h-5 mx-1 hidden sm:block" style={{ background: 'rgba(99,179,255,0.12)' }} />
        <div role="group" aria-label="Filter by audience" className="flex flex-wrap gap-1.5">
          {AUDIENCE_FILTERS.map((f) => (
            <Chip key={f.key || 'any'} active={audience === f.key} onClick={() => { setAudience(f.key); setPage(1); }}>{f.label}</Chip>
          ))}
        </div>
        <div className="flex-1" />
        {canCreate && (
          <button onClick={onNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold"
            style={{ background: '#6366F1', color: '#FFFFFF' }}>
            <Plus className="w-4 h-4" /> New article
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8AABC4' }} />
        <label htmlFor="kb-search" className="sr-only">Search articles</label>
        <input id="kb-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by title, text, number or tag…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/40"
          style={{ background: '#0F1B2D', border, color: '#E8F1FA' }} />
        {searchInput && (
          <button onClick={() => setSearchInput('')} aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8AABC4' }}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-x-auto" style={{ border, background: '#0B1424' }}>
        <table className="w-full text-left text-[12px] min-w-[860px]">
          <thead style={{ background: '#0F1B2D' }}>
            <tr>
              {['Number', 'Title', 'State', 'Audience', 'Version', 'Helpful', 'Views', 'Updated'].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8AABC4' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center" style={{ color: '#8AABC4' }}>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading articles…
              </td></tr>
            ) : isError ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center" style={{ color: '#FCA5A5' }}>
                {knowledgeErrorMessage(error, 'Failed to load articles')}
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center">
                <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: '#5A7D99' }} />
                <p style={{ color: '#C5D8E8' }}>No articles match these filters.</p>
                {canCreate && <p className="mt-1" style={{ color: '#8AABC4' }}>Write one with “New article”, or from a resolved incident.</p>}
              </td></tr>
            ) : rows.map((a) => {
              const total = a.helpfulYes + a.helpfulNo;
              return (
                <tr key={a.id} onClick={() => onOpen(a.id)}
                  className="cursor-pointer transition-colors hover:bg-[#0F1B2D]"
                  style={{ borderTop: '1px solid rgba(99,179,255,0.08)' }}>
                  <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap" style={{ color: '#818CF8' }}>{a.number}</td>
                  <td className="px-4 py-3 max-w-[360px]">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(a.id); }}
                      className="text-left font-medium hover:underline truncate block max-w-full" style={{ color: '#E8F1FA' }}>
                      {a.title}
                    </button>
                    {(a.category || a.tags.length > 0) && (
                      <span className="block truncate text-[11px] mt-0.5" style={{ color: '#8AABC4' }}>
                        {[a.category, ...a.tags.slice(0, 3).map((t) => `#${t}`)].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatePill state={a.state} /></td>
                  <td className="px-4 py-3" style={{ color: '#C5D8E8' }}>{AUDIENCE_LABEL[a.audience] ?? a.audience}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: '#C5D8E8' }}>v{a.version}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: '#C5D8E8' }}
                    title={`${a.helpfulYes} yes / ${a.helpfulNo} no`}>
                    {total > 0 ? `${Math.round((a.helpfulYes / total) * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono" style={{ color: '#C5D8E8' }}>{a.viewCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#8AABC4' }}>{fmtDate(a.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px]" style={{ color: '#8AABC4' }}>
          <span>{pagination.total} articles{isFetching ? ' · updating…' : ''}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page"
              className="p-1.5 rounded-lg disabled:opacity-40" style={{ border, color: '#C5D8E8' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
              aria-label="Next page" className="p-1.5 rounded-lg disabled:opacity-40" style={{ border, color: '#C5D8E8' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KnowledgeBasePage() {
  const role = useAuthStore((s) => s.user?.role);
  const canCreate = WRITER_ROLES.includes(role ?? '');
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('articles');

  // ?article=<id> opens an article; ?article=new opens a blank editor
  const articleParam = params.get('article');

  const openArticle = (id: string) => setParams({ article: id });
  const closeArticle = () => setParams({});

  if (articleParam) {
    return (
      <div className="animate-fade-in">
        <ArticleEditor
          articleId={articleParam === 'new' ? null : articleParam}
          onClose={closeArticle}
          onCreated={(id) => setParams({ article: id }, { replace: true })}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl mx-4 mt-4" style={{ background: '#0B1424', border }}>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)' }}>
            <BookOpen className="w-5 h-5" style={{ color: '#818CF8' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#818CF8' }}>Knowledge</span>
              <span style={{ color: '#5A7D99' }}>/</span>
              <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#8AABC4' }}>Knowledge Base</span>
            </div>
            <h1 className="text-[22px] font-display font-bold tracking-tight" style={{ color: '#E8F1FA' }}>Knowledge Base</h1>
            <p className="text-[12px] mt-0.5" style={{ color: '#8AABC4' }}>
              Articles for agents and the self-service portal, plus known errors and alert runbooks
            </p>
          </div>
        </div>
        <div className="h-px mx-6" style={{ background: 'linear-gradient(90deg, #6366F1, transparent)' }} />
        <div role="tablist" aria-label="Knowledge base sections" className="relative flex gap-1 px-4">
          {([['articles', 'Articles'], ['known-errors', 'Known errors']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className="px-4 py-2.5 text-[13px] font-medium relative"
              style={{ color: tab === key ? '#E8F1FA' : '#8AABC4' }}>
              {label}
              {tab === key && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: '#6366F1' }} />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-6" role="tabpanel">
        {tab === 'articles'
          ? <ArticlesTab onOpen={openArticle} onNew={() => setParams({ article: 'new' })} canCreate={canCreate} />
          : <KnownErrors />}
      </div>
    </div>
  );
}
