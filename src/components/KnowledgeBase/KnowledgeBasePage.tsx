import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, Search, X, Plus, Tag, Clock, AlertCircle,
  ChevronRight, FileText, CheckCircle2, AlertTriangle, Filter,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useAlertKB } from '../../hooks/useProblems';

// ── Types ──────────────────────────────────────────────────────────────────────
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
  Infrastructure: { bg: 'rgba(99,102,241,0.1)',  text: '#4F46E5', border: 'rgba(99,102,241,0.25)' },
  Application:    { bg: 'rgba(16,185,129,0.1)',  text: '#059669', border: 'rgba(16,185,129,0.25)' },
  Database:       { bg: 'rgba(217,119,6,0.1)',   text: '#D97706', border: 'rgba(217,119,6,0.25)' },
  Network:        { bg: 'rgba(14,165,233,0.1)',  text: '#0284C7', border: 'rgba(14,165,233,0.25)' },
  Security:       { bg: 'rgba(220,38,38,0.1)',   text: '#DC2626', border: 'rgba(220,38,38,0.25)' },
  Other:          { bg: 'rgba(124,58,237,0.1)',  text: '#7C3AED', border: 'rgba(124,58,237,0.25)' },
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

// ── Article Detail Modal ───────────────────────────────────────────────────────
function ArticleModal({ article, onClose }: { article: KBArticle; onClose: () => void }) {
  const cat = guessCategory(article);
  const cs = catStyle(cat);
  const rca = article.rootCauseAnalysis;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: '#FFFFFF', border: '1px solid #E7E5E4', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: '1px solid #E7E5E4' }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
              <BookOpen className="w-4 h-4" style={{ color: cs.text }} />
            </div>
            <div>
              {article.problemNumber && (
                <p className="text-[10px] font-mono font-bold tracking-widest uppercase mb-0.5" style={{ color: cs.text }}>
                  {article.problemNumber}
                </p>
              )}
              <h2 className="text-[17px] font-display font-bold text-stone-900 leading-snug">{article.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>
                  {cat}
                </span>
                <span className="text-[11px] text-stone-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {fmtDate(article.updatedAt)}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Root Cause */}
          {rca && (
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Root Cause Analysis</p>
              <div className="rounded-xl p-4" style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                {typeof rca === 'string' ? (
                  <p className="text-[13px] text-stone-700 leading-relaxed">{rca}</p>
                ) : (
                  <div className="space-y-2">
                    {rca.rootCause && <p className="text-[13px] text-stone-700"><span className="font-semibold">Root Cause:</span> {rca.rootCause}</p>}
                    {rca.impact && <p className="text-[13px] text-stone-700"><span className="font-semibold">Impact:</span> {rca.impact}</p>}
                    {rca.immediateAction && <p className="text-[13px] text-stone-700"><span className="font-semibold">Immediate Action:</span> {rca.immediateAction}</p>}
                    {rca.permanentFix && <p className="text-[13px] text-stone-700"><span className="font-semibold">Permanent Fix:</span> {rca.permanentFix}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workaround */}
          {article.workaround && (
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Workaround / Resolution</p>
              <div className="flex items-start gap-3 rounded-xl p-4"
                style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#059669' }} />
                <p className="text-[13px] text-stone-700 leading-relaxed">{article.workaround}</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {article.tags.map((tag, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                    style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related incidents count */}
          {(article._count?.incidents || 0) > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl px-4 py-3"
              style={{ background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.15)' }}>
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#D97706' }} />
              <p className="text-[12px] font-medium" style={{ color: '#92400E' }}>
                {article._count!.incidents} related incident{article._count!.incidents !== 1 ? 's' : ''} linked to this problem
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AlertKB Card (from agentPipeline KB) ──────────────────────────────────────
function AlertKBCard({ entry, onClick }: { entry: AlertKBEntry; onClick: () => void }) {
  const cat = entry.category || 'Other';
  const cs = catStyle(cat);
  return (
    <button onClick={onClick}
      className="text-left rounded-xl p-4 w-full transition-all group"
      style={{ background: '#FFFFFF', border: '1px solid #E7E5E4' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = cs.border)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#E7E5E4')}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
          <FileText className="w-3.5 h-3.5" style={{ color: cs.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-stone-900 leading-tight truncate">{entry.name}</p>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-stone-300 group-hover:text-stone-500 transition-colors" />
          </div>
          {entry.description && (
            <p className="text-[11px] text-stone-500 mt-1 leading-relaxed line-clamp-2">{entry.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ background: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>{cat}</span>
            {entry.remediation && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                AUTO-REMEDIABLE
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── AlertKB Detail Modal ───────────────────────────────────────────────────────
function AlertKBModal({ entry, onClose }: { entry: AlertKBEntry; onClose: () => void }) {
  const cat = entry.category || 'Other';
  const cs = catStyle(cat);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl"
        style={{ background: '#FFFFFF', border: '1px solid #E7E5E4', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E7E5E4' }}>
          <div>
            <h3 className="text-[15px] font-display font-bold text-stone-900">{entry.name}</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
              style={{ background: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>{cat}</span>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {entry.description && (
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Description</p>
              <p className="text-[13px] text-stone-700 leading-relaxed">{entry.description}</p>
            </div>
          )}
          {entry.symptoms && entry.symptoms.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Symptoms</p>
              <ul className="space-y-1">
                {entry.symptoms.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-stone-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#D97706' }} />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.resolution && (
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Resolution Steps</p>
              <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <p className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-line">{entry.resolution}</p>
              </div>
            </div>
          )}
          {entry.remediation && (
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Auto-Remediation Action</p>
              <div className="rounded-xl px-4 py-3 flex items-center gap-2"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#4F46E5' }} />
                <p className="text-[12px] font-semibold" style={{ color: '#4F46E5' }}>{entry.remediation}</p>
              </div>
            </div>
          )}
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {entry.tags.map((tag, i) => (
                <span key={i} className="text-[11px] px-2.5 py-1 rounded-full"
                  style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function KnowledgeBasePage() {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('All');
  const [tab, setTab]             = useState<'kedb' | 'alerts'>('kedb');
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [selectedAlertKB, setSelectedAlertKB] = useState<AlertKBEntry | null>(null);

  // KEDB: problems with KEDB data
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

  // Alert KB from agentPipeline
  const { data: alertKBResp, isLoading: alertKBLoading } = useAlertKB();
  const alertKBRaw = alertKBResp?.data || [];

  // Normalise alertKB entries
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

  // Filter
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

  return (
    <div className="animate-fade-in">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-white shadow-sm border border-stone-200 rounded-2xl mx-4 mt-4">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-72 h-20 pointer-events-none opacity-[0.06]"
          style={{ background: 'radial-gradient(ellipse at 100% 0%, #4F46E5 0%, transparent 70%)' }} />

        <div className="relative px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <BookOpen className="w-5 h-5" style={{ color: '#4F46E5' }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#4F46E5' }}>Intelligence</span>
                  <span className="text-stone-300">/</span>
                  <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">Knowledge Base</span>
                </div>
                <h1 className="text-[22px] font-display font-bold text-stone-900 tracking-tight">Knowledge Base</h1>
                <p className="text-[12px] text-stone-500 mt-0.5">
                  KEDB articles, alert patterns, resolution guides
                </p>
              </div>
            </div>
            {canEdit && (
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#4F46E5' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.16)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}>
                <Plus className="w-4 h-4" />
                Create Article
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="flex gap-4 px-4 pt-4 pb-6">

        {/* Left: category filter */}
        <div className="w-44 shrink-0">
          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E7E5E4' }}>
            <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #E7E5E4' }}>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                <Filter className="w-3 h-3" /> Category
              </p>
            </div>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="w-full text-left px-3 py-2 text-[12px] font-medium transition-colors"
                style={
                  category === cat
                    ? { background: 'rgba(99,102,241,0.08)', color: '#4F46E5', borderLeft: '2px solid #4F46E5' }
                    : { color: '#78716C', borderLeft: '2px solid transparent' }
                }
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tab switcher */}
          <div className="rounded-xl overflow-hidden mt-3" style={{ background: '#FFFFFF', border: '1px solid #E7E5E4' }}>
            <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #E7E5E4' }}>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Source</p>
            </div>
            {[
              { key: 'kedb', label: 'KEDB (Problems)', icon: BookOpen },
              { key: 'alerts', label: 'Alert Patterns', icon: AlertCircle },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as 'kedb' | 'alerts')}
                className="w-full text-left px-3 py-2 text-[12px] font-medium transition-colors flex items-center gap-2"
                style={
                  tab === t.key
                    ? { background: 'rgba(99,102,241,0.08)', color: '#4F46E5', borderLeft: '2px solid #4F46E5' }
                    : { color: '#78716C', borderLeft: '2px solid transparent' }
                }
              >
                <t.icon className="w-3.5 h-3.5 shrink-0" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: articles */}
        <div className="flex-1 min-w-0">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search knowledge base…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
              style={{ background: '#FFFFFF', border: '1px solid #E7E5E4' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12 gap-2">
              <div className="w-5 h-5 border border-[#4F46E5]/30 border-t-[#4F46E5] rounded-full animate-spin" />
              <span className="text-[12px] text-stone-500 font-mono">Loading knowledge base…</span>
            </div>
          )}

          {/* KEDB Articles */}
          {tab === 'kedb' && !isLoading && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-stone-500 font-mono">{filteredArticles.length} articles</span>
              </div>
              {filteredArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
                  style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                  <BookOpen className="w-10 h-10 mb-3" style={{ color: '#D6D3D1' }} />
                  <p className="text-[13px] text-stone-500 font-mono">No KEDB articles found</p>
                  <p className="text-[11px] text-stone-400 mt-1">Problems in KNOWN_ERROR state with RCA/workaround appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredArticles.map(a => {
                    const cat = guessCategory(a);
                    const cs = catStyle(cat);
                    const snippet = rcaSnippet(a.rootCauseAnalysis);
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedArticle(a)}
                        className="text-left rounded-xl p-4 transition-all group"
                        style={{ background: '#FFFFFF', border: '1px solid #E7E5E4' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = cs.border)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#E7E5E4')}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
                            <BookOpen className="w-3.5 h-3.5" style={{ color: cs.text }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-semibold text-stone-900 truncate">{a.title}</p>
                              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-stone-300 group-hover:text-stone-500 transition-colors" />
                            </div>
                            {snippet && (
                              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed line-clamp-2">{snippet}…</p>
                            )}
                            {a.workaround && !snippet && (
                              <p className="text-[11px] text-stone-500 mt-1 line-clamp-2">{a.workaround}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {a.problemNumber && (
                                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                                  style={{ background: '#F1F5F9', color: 'var(--argus-muted)' }}>{a.problemNumber}</span>
                              )}
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                style={{ background: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>{cat}</span>
                              {a.tags && a.tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded"
                                  style={{ background: '#F8FAFC', color: 'var(--argus-muted)' }}>
                                  <Tag className="w-2 h-2" />{tag}
                                </span>
                              ))}
                              <span className="text-[9px] text-stone-400 font-mono ml-auto flex items-center gap-1">
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

          {/* Alert KB */}
          {tab === 'alerts' && !isLoading && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-stone-500 font-mono">{filteredAlertKB.length} patterns</span>
              </div>
              {filteredAlertKB.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
                  style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                  <AlertCircle className="w-10 h-10 mb-3" style={{ color: '#D6D3D1' }} />
                  <p className="text-[13px] text-stone-500 font-mono">No alert patterns found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredAlertKB.map(e => (
                    <AlertKBCard key={e.id} entry={e} onClick={() => setSelectedAlertKB(e)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedArticle && <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
      {selectedAlertKB && <AlertKBModal entry={selectedAlertKB} onClose={() => setSelectedAlertKB(null)} />}
    </div>
  );
}
