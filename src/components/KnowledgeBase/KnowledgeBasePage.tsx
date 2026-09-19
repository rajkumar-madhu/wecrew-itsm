import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, Search, X, Plus, Tag, Clock, AlertCircle,
  ChevronRight, FileText, CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useAlertKB } from '../../hooks/useProblems';
import { Page, Toolbar, Panel, GhostButton, Segmented } from '../ui/PageChrome';

interface KBArticle {
  id: string;
  title: string;
  problemNumber?: string;
  state?: string;
  rootCauseAnalysis?: any;
  workaround?: string;
  category?: string;
  tags?: string[];
  updatedAt: string;
  incidents?: { id: string }[];
  _count?: { incidents: number };
}

interface AlertKBEntry {
  id: string;
  name: string;
  description?: string;
  symptoms?: string[];
  resolution?: string;
  remediation?: string;
  category?: string;
  tags?: string[];
}

const CATEGORIES = ['All', 'Infrastructure', 'Application', 'Database', 'Network', 'Security', 'Other'];

const CAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Infrastructure: { bg: 'rgba(43,76,255,0.10)',  text: '#2b4cff', border: 'rgba(43,76,255,0.22)' },
  Application:    { bg: 'rgba(15,122,85,0.10)',  text: '#0f7a55', border: 'rgba(15,122,85,0.22)' },
  Database:       { bg: 'rgba(217,119,6,0.10)',  text: '#d97706', border: 'rgba(217,119,6,0.22)' },
  Network:        { bg: 'rgba(14,116,144,0.10)', text: '#0e7490', border: 'rgba(14,116,144,0.22)' },
  Security:       { bg: 'rgba(220,38,38,0.10)',  text: '#dc2626', border: 'rgba(220,38,38,0.22)' },
  Other:          { bg: 'rgba(14,17,22,0.06)',   text: '#5c5a56', border: 'rgba(14,17,22,0.12)' },
};

function catStyle(cat?: string) {
  return CAT_COLORS[cat || 'Other'] || CAT_COLORS.Other;
}

function guessCategory(article: KBArticle): string {
  const t = (article.title || '').toLowerCase();
  if (t.includes('disk') || t.includes('cpu') || t.includes('memory') || t.includes('node') || t.includes('server')) return 'Infrastructure';
  if (t.includes('db') || t.includes('database') || t.includes('postgres') || t.includes('mysql') || t.includes('redis')) return 'Database';
  if (t.includes('network') || t.includes('icmp') || t.includes('switch') || t.includes('fortigate') || t.includes('ping')) return 'Network';
  if (t.includes('security') || t.includes('ssl') || t.includes('cert') || t.includes('login') || t.includes('auth')) return 'Security';
  if (t.includes('pod') || t.includes('deploy') || t.includes('k8s') || t.includes('kube') || t.includes('container')) return 'Infrastructure';
  if (t.includes('app') || t.includes('service') || t.includes('api') || t.includes('error')) return 'Application';
  return article.category || 'Other';
}

function guessAlertCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('disk') || n.includes('cpu') || n.includes('mem') || n.includes('host') || n.includes('node')) return 'Infrastructure';
  if (n.includes('kube') || n.includes('pod') || n.includes('deploy') || n.includes('container')) return 'Infrastructure';
  if (n.includes('db') || n.includes('database') || n.includes('connection')) return 'Database';
  if (n.includes('network') || n.includes('icmp') || n.includes('switch') || n.includes('fortigate')) return 'Network';
  if (n.includes('ssl') || n.includes('cert') || n.includes('login') || n.includes('security')) return 'Security';
  if (n.includes('app') || n.includes('api') || n.includes('error') || n.includes('hpa')) return 'Application';
  return 'Other';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function rcaSnippet(rca: any): string {
  if (!rca) return '';
  if (typeof rca === 'string') return rca.slice(0, 120);
  if (rca.rootCause) return String(rca.rootCause).slice(0, 120);
  if (rca.summary) return String(rca.summary).slice(0, 120);
  return '';
}

function ArticleModal({ article, onClose }: { article: KBArticle; onClose: () => void }) {
  const cat = guessCategory(article);
  const cs = catStyle(cat);
  const rca = article.rootCauseAnalysis;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--argus-overlay)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in"
        style={{ background: 'var(--argus-surface)', border: '1px solid var(--argus-border)', borderRadius: 'var(--cx-radius)', boxShadow: 'var(--argus-shadow-card)' }}
      >
        <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--argus-border)' }}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
              <BookOpen className="w-4 h-4" style={{ color: cs.text }} />
            </div>
            <div className="min-w-0">
              {article.problemNumber && (
                <p className="text-[10px] font-mono font-bold tracking-widest uppercase mb-0.5" style={{ color: cs.text }}>
                  {article.problemNumber}
                </p>
              )}
              <h2 className="text-[17px] font-display font-bold text-ink leading-snug">{article.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>
                  {cat}
                </span>
                <span className="text-[11px] text-dim font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {fmtDate(article.updatedAt)}
                </span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] shrink-0" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {rca && (
            <div>
              <p className="text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Root cause analysis</p>
              <div className="rounded-xl p-4 border border-steel bg-[color:var(--argus-elevated)]">
                {typeof rca === 'string' ? (
                  <p className="text-[13px] text-ink leading-relaxed">{rca}</p>
                ) : (
                  <div className="space-y-2">
                    {rca.rootCause && <p className="text-[13px] text-ink"><span className="font-semibold">Root cause:</span> {rca.rootCause}</p>}
                    {rca.impact && <p className="text-[13px] text-ink"><span className="font-semibold">Impact:</span> {rca.impact}</p>}
                    {rca.immediateAction && <p className="text-[13px] text-ink"><span className="font-semibold">Immediate action:</span> {rca.immediateAction}</p>}
                    {rca.permanentFix && <p className="text-[13px] text-ink"><span className="font-semibold">Permanent fix:</span> {rca.permanentFix}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {article.workaround && (
            <div>
              <p className="text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Workaround / resolution</p>
              <div className="flex items-start gap-3 rounded-xl p-4 bg-emerald-dim">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald" />
                <p className="text-[13px] text-ink leading-relaxed">{article.workaround}</p>
              </div>
            </div>
          )}

          {article.tags && article.tags.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {article.tags.map((tag, i) => (
                  <span key={i} className="cx-pill cx-pill--neutral">#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {(article._count?.incidents || 0) > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 bg-amber-dim text-amber">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-[12px] font-medium">
                {article._count!.incidents} related incident{article._count!.incidents !== 1 ? 's' : ''} linked to this problem
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertKBCard({ entry, onClick }: { entry: AlertKBEntry; onClick: () => void }) {
  const cat = entry.category || 'Other';
  const cs = catStyle(cat);
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl p-4 w-full transition-all group border border-steel bg-[color:var(--argus-surface)] hover:bg-[color:var(--argus-elevated)]"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
          <FileText className="w-3.5 h-3.5" style={{ color: cs.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-ink leading-tight truncate">{entry.name}</p>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-graphite group-hover:text-muted transition-colors" />
          </div>
          {entry.description && (
            <p className="text-[11px] text-muted mt-1 leading-relaxed line-clamp-2">{entry.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ background: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>{cat}</span>
            {entry.remediation && (
              <span className="cx-pill cx-pill--ok">Auto-remediable</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function AlertKBModal({ entry, onClose }: { entry: AlertKBEntry; onClose: () => void }) {
  const cat = entry.category || 'Other';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--argus-overlay)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto animate-fade-in"
        style={{ background: 'var(--argus-surface)', border: '1px solid var(--argus-border)', borderRadius: 'var(--cx-radius)', boxShadow: 'var(--argus-shadow-card)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--argus-border)' }}>
          <div>
            <p className="cx-eyebrow">{cat}</p>
            <h3 className="cx-sectionhead__title" style={{ fontSize: '1.25rem' }}>{entry.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {entry.description && (
            <div>
              <p className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Description</p>
              <p className="text-[13px] text-ink leading-relaxed">{entry.description}</p>
            </div>
          )}
          {entry.symptoms && entry.symptoms.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Symptoms</p>
              <ul className="space-y-1">
                {entry.symptoms.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-ink">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.resolution && (
            <div>
              <p className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Resolution steps</p>
              <div className="rounded-xl p-4 bg-emerald-dim">
                <p className="text-[13px] text-ink leading-relaxed whitespace-pre-line">{entry.resolution}</p>
              </div>
            </div>
          )}
          {entry.remediation && (
            <div>
              <p className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Auto-remediation action</p>
              <div className="rounded-xl px-4 py-3 flex items-center gap-2 bg-signal-dim text-signal">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p className="text-[12px] font-semibold">{entry.remediation}</p>
              </div>
            </div>
          )}
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {entry.tags.map((tag, i) => (
                <span key={i} className="cx-pill cx-pill--neutral">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeBasePage() {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [tab, setTab] = useState<'kedb' | 'alerts'>('kedb');
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [selectedAlertKB, setSelectedAlertKB] = useState<AlertKBEntry | null>(null);

  const { data: kedbResp, isLoading: kedbLoading } = useQuery({
    queryKey: ['kb-kedb'],
    queryFn: async () => {
      const { data } = await api.get('/problems?limit=100&state=KNOWN_ERROR');
      return data;
    },
    staleTime: 60000,
  });
  const articles: KBArticle[] = (kedbResp?.data || []).filter((p: KBArticle) =>
    p.rootCauseAnalysis || p.workaround
  );

  const { data: alertKBResp, isLoading: alertKBLoading } = useAlertKB();
  const alertKBRaw = alertKBResp?.data || [];

  const alertKBEntries: AlertKBEntry[] = alertKBRaw.map((e: any) => ({
    id: e.id || e.name,
    name: e.name || e.alertName || 'Unknown',
    description: e.description,
    symptoms: e.symptoms || (e.symptom ? [e.symptom] : []),
    resolution: e.resolution || e.steps,
    remediation: e.remediation,
    category: e.category || guessAlertCategory(e.name || ''),
    tags: e.tags || [],
  }));

  const filteredArticles = articles.filter(a => {
    const cat = guessCategory(a);
    const matchCat = category === 'All' || cat === category;
    const matchSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.workaround || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const filteredAlertKB = alertKBEntries.filter(e => {
    const matchCat = category === 'All' || e.category === category;
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const isLoading = tab === 'kedb' ? kedbLoading : alertKBLoading;
  const visibleCount = tab === 'kedb' ? filteredArticles.length : filteredAlertKB.length;

  const kpis = [
    { label: 'KEDB', value: kedbLoading ? '—' : articles.length, sub: 'known errors with RCA' },
    { label: 'Alert patterns', value: alertKBLoading ? '—' : alertKBEntries.length, sub: 'from the agent pipeline' },
    { label: 'In view', value: isLoading ? '—' : visibleCount, sub: tab === 'kedb' ? 'articles matching' : 'patterns matching' },
    { label: 'Category', value: category, sub: 'filter on the list' },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Intelligence · known errors</span>
            <h1 className="cx-hero__title">Knowledge</h1>
            <p className="cx-hero__deck">
              Known-error articles and alert patterns, so the next incident does not start from a blank page.
              A workaround that lives only in someone’s head is the failure this page exists to catch.
            </p>
          </div>
          {canEdit && (
            <button type="button" className="cx-hero__btn">
              <Plus size={14} strokeWidth={1.75} />
              Create an article
            </button>
          )}
        </div>
        <dl className="cx-hero__kpis mt-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="cx-hero__kpi">
              <dt className="cx-hero__kpi-label">{kpi.label}</dt>
              <dd>
                <div className="cx-hero__kpi-value">{kpi.value}</div>
                <div className="cx-hero__kpi-sub">{kpi.sub}</div>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Knowledge</span>
      </nav>

      <Toolbar>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as 'kedb' | 'alerts')}
          options={[
            { value: 'kedb', label: 'KEDB', icon: BookOpen },
            { value: 'alerts', label: 'Alert patterns', icon: AlertCircle },
          ]}
        />

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search knowledge base…"
            className="input-field pl-8 py-1.5 text-[13px]"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-ink" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <div className="flex items-center gap-1 flex-wrap">
          {CATEGORIES.map(cat => (
            <GhostButton key={cat} active={category === cat} onClick={() => setCategory(cat)}>
              {cat}
            </GhostButton>
          ))}
        </div>
      </Toolbar>

      {isLoading && (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-dim" />
          <span className="text-[12px] text-dim font-mono">Loading knowledge base…</span>
        </div>
      )}

      {tab === 'kedb' && !isLoading && (
        <>
          <div className="cx-listhead__count mb-2">
            <span className="cx-listhead__count-value">{filteredArticles.length} article{filteredArticles.length === 1 ? '' : 's'}</span>
          </div>
          {filteredArticles.length === 0 ? (
            <Panel>
              <div className="flex flex-col items-center justify-center py-12">
                <BookOpen className="w-10 h-10 mb-3 text-graphite" strokeWidth={1.75} />
                <p className="text-sm text-ink font-medium">No KEDB articles found</p>
                <p className="text-xs text-muted mt-1">Problems in KNOWN_ERROR state with RCA or a workaround appear here.</p>
              </div>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredArticles.map(a => {
                const cat = guessCategory(a);
                const cs = catStyle(cat);
                const snippet = rcaSnippet(a.rootCauseAnalysis);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedArticle(a)}
                    className="text-left rounded-xl p-4 transition-all group border border-steel bg-[color:var(--argus-surface)] hover:bg-[color:var(--argus-elevated)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
                        <BookOpen className="w-3.5 h-3.5" style={{ color: cs.text }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-ink truncate">{a.title}</p>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-graphite group-hover:text-muted transition-colors" />
                        </div>
                        {snippet && (
                          <p className="text-[11px] text-muted mt-1 leading-relaxed line-clamp-2">{snippet}…</p>
                        )}
                        {a.workaround && !snippet && (
                          <p className="text-[11px] text-muted mt-1 line-clamp-2">{a.workaround}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {a.problemNumber && (
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-[color:var(--argus-elevated)] text-muted">{a.problemNumber}</span>
                          )}
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                            style={{ background: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>{cat}</span>
                          {a.tags && a.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded text-muted">
                              <Tag className="w-2 h-2" />{tag}
                            </span>
                          ))}
                          <span className="text-[9px] text-dim font-mono ml-auto flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{fmtDate(a.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'alerts' && !isLoading && (
        <>
          <div className="cx-listhead__count mb-2">
            <span className="cx-listhead__count-value">{filteredAlertKB.length} pattern{filteredAlertKB.length === 1 ? '' : 's'}</span>
          </div>
          {filteredAlertKB.length === 0 ? (
            <Panel>
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-10 h-10 mb-3 text-graphite" strokeWidth={1.75} />
                <p className="text-sm text-ink font-medium">No alert patterns found</p>
              </div>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredAlertKB.map(e => (
                <AlertKBCard key={e.id} entry={e} onClick={() => setSelectedAlertKB(e)} />
              ))}
            </div>
          )}
        </>
      )}

      {selectedArticle && <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
      {selectedAlertKB && <AlertKBModal entry={selectedAlertKB} onClose={() => setSelectedAlertKB(null)} />}
    </Page>
  );
}
