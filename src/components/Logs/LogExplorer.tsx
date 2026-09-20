import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, RefreshCw, Terminal, Clock, AlertTriangle,
  Filter, Download, Loader2, X, ChevronRight, FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Page } from '../ui/PageChrome';

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectSeverity(msg: string): 'error' | 'warn' | 'debug' | 'info' {
  if (/error|err|fatal|panic|exception|crit/i.test(msg)) return 'error';
  if (/warn|warning/i.test(msg)) return 'warn';
  if (/debug|trace/i.test(msg)) return 'debug';
  return 'info';
}

function formatNanoTs(ns: string) {
  try {
    const ms = Number(BigInt(ns) / BigInt(1_000_000));
    const d = new Date(ms);
    return d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch { return ns?.slice(0, 19) || ''; }
}

function highlightSearch(text: string, search: string) {
  if (!search.trim()) return <>{text}</>;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase()
          ? <mark key={i} className="bg-[#D97706]/30 text-[#D97706] rounded px-0.5 not-italic">{part}</mark>
          : part
      )}
    </>
  );
}

// Static severity class lookup — avoids Tailwind purging dynamic strings
function sevBadgeClass(sev: string) {
  if (sev === 'error') return 'bg-[#DC2626]/20 text-[#FCA5A5]';
  if (sev === 'warn')  return 'bg-[#D97706]/20 text-[#FCD34D]';
  if (sev === 'debug') return 'bg-[#475569]/30 text-muted';
  return 'bg-[#0EA5E9]/10 text-[#7DD3FC]';
}

function sevRowClass(sev: string) {
  if (sev === 'error') return 'bg-[#DC2626]/[0.06]';
  if (sev === 'warn')  return 'bg-[#D97706]/[0.04]';
  return '';
}

function sevTextClass(sev: string) {
  if (sev === 'error') return 'text-[#FCA5A5]';
  if (sev === 'warn')  return 'text-[#FCD34D]';
  if (sev === 'debug') return 'text-muted';
  return 'text-ink';
}

// ── Stat Card (glassmorphic inside dark hero) ─────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════════════════
const SINCE_OPTS = ['15m', '1h', '6h', '24h', '7d'] as const;
const LIMIT_OPTS = [100, 500, 1000, 2000] as const;

export default function LogExplorer() {
  const { selectedOrgId } = useAuthStore();
  const headers = selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {};

  const [since, setSince] = useState<string>('1h');
  const [limit, setLimit] = useState(500);
  const [queryInput, setQueryInput] = useState('{}');
  const [activeQuery, setActiveQuery] = useState('{}');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch, error: queryError } = useQuery({
    queryKey: ['loki-logs', selectedOrgId, activeQuery, since, limit],
    queryFn: () =>
      api.get('/k8s/logs', { headers, params: { query: activeQuery, since, limit, direction: 'backward' } })
        .then(r => r.data.data),
    retry: 1,
    refetchInterval: 15000,
  });

  const { data: labelsData } = useQuery({
    queryKey: ['loki-labels', selectedOrgId],
    queryFn: () => api.get('/k8s/logs/labels', { headers }).then(r => r.data.data),
    staleTime: 60000,
  });

  const { data: labelValuesData } = useQuery({
    queryKey: ['loki-label-values', selectedOrgId, selectedLabel],
    queryFn: () => api.get(`/k8s/logs/labels/${selectedLabel}/values`, { headers }).then(r => r.data.data),
    enabled: !!selectedLabel,
    staleTime: 30000,
  });

  const runQuery = useCallback(() => setActiveQuery(queryInput), [queryInput]);

  const injectLabel = (label: string, value: string) => {
    const kv = `${label}="${value}"`;
    if (queryInput.includes(kv)) return;
    const updated = queryInput.replace(/}$/, `, ${kv}}`).replace('{, ', '{');
    setQueryInput(updated);
  };

  const logs: any[] = data?.logs || [];
  const filteredLogs = logs.filter(l => {
    if (search && !l.message?.toLowerCase().includes(search.toLowerCase())) return false;
    if (severityFilter && detectSeverity(l.message) !== severityFilter) return false;
    return true;
  });

  const counts = { error: 0, warn: 0, info: 0, debug: 0 };
  for (const l of logs) { const s = detectSeverity(l.message); counts[s as keyof typeof counts]++; }

  const handleExport = () => {
    const txt = filteredLogs.map(l => `${formatNanoTs(l.timestamp)}  ${l.message}`).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([txt], { type: 'text/plain' })),
      download: `argus-logs-${new Date().toISOString().slice(0, 19)}.txt`,
    });
    a.click();
  };

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Operate · logs</span>
            <h1 className="cx-hero__title">Log explorer</h1>
            <p className="cx-hero__deck">
              LogQL search across infrastructure, SSH-proxied through Loki. Auto-refresh every 15s · {since} window.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExport} disabled={filteredLogs.length === 0} className="cx-hero__btn cx-hero__btn--ghost disabled:opacity-40">
              <Download size={14} /> Export
            </button>
            <button type="button" onClick={() => refetch()} className="cx-hero__btn">
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
        {/* The four severity tiles narrow the stream — clicking "Errors 37" is the
            fastest way through 4,000 lines, so they are buttons, not read-outs.
            Clicking the active one clears the filter. "Shown" is a read-out. */}
        <dl className="cx-hero__kpis cx-hero__kpis--5 mt-6">
          {([
            { label: 'Errors', sev: 'error', value: counts.error, tone: counts.error > 0 ? 'danger' : undefined },
            { label: 'Warnings', sev: 'warn', value: counts.warn, tone: counts.warn > 0 ? 'warn' : undefined },
            { label: 'Info', sev: 'info', value: counts.info, tone: undefined },
            { label: 'Debug', sev: 'debug', value: counts.debug, tone: undefined },
          ] as const).map((kpi) => {
            const active = severityFilter === kpi.sev;
            return (
              <button
                key={kpi.label}
                type="button"
                aria-pressed={active}
                onClick={() => setSeverityFilter(active ? null : kpi.sev)}
                className={`cx-hero__kpi text-left transition-colors${kpi.tone ? ` cx-hero__kpi--${kpi.tone}` : ''}${active ? ' ring-1 ring-signal' : ''}`}
              >
                <dt className="cx-hero__kpi-label">{kpi.label}</dt>
                <dd>
                  <div className="cx-hero__kpi-value">{kpi.value}</div>
                  <div className="cx-hero__kpi-sub">
                    {active ? 'filtering — click to clear' : 'in this window'}
                  </div>
                </dd>
              </button>
            );
          })}
          <div className="cx-hero__kpi">
            <dt className="cx-hero__kpi-label">Shown</dt>
            <dd>
              <div className="cx-hero__kpi-value">{filteredLogs.length}</div>
              <div className="cx-hero__kpi-sub">after filters</div>
            </dd>
          </div>
        </dl>
      </div>

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Log explorer</span>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* QUERY BAR (floating)                                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="-mt-3 relative z-10 bg-white/90 backdrop-blur-xl rounded-xl border border-stone-200 shadow-sm p-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* LogQL input */}
          <div className="flex-1 min-w-[260px] relative">
            <Terminal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runQuery()}
              placeholder='{} or {namespace="my-ns"} or {app="my-app"}'
              className="w-full pl-8 pr-3 py-2 text-[12px] border border-stone-200 rounded-lg bg-white text-stone-700 font-mono focus:outline-none focus:ring-2 focus:ring-[#059669]/30 focus:border-[#059669]/40"
            />
          </div>

          {/* Run */}
          <button
            onClick={runQuery}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#059669] text-white rounded-lg text-xs font-semibold hover:bg-[#047857] transition-colors shadow-sm"
          >
            <Search size={12} /> Run
          </button>

          {/* Label browser toggle */}
          <button
            onClick={() => setShowLabels(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              showLabels ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <Filter size={12} /> Labels
          </button>

          {/* Time range */}
          <div className="flex items-center gap-0.5 bg-stone-100 rounded-lg p-0.5">
            {SINCE_OPTS.map(opt => (
              <button
                key={opt}
                onClick={() => setSince(opt)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  since === opt ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Limit */}
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="text-[11px] border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-600 font-mono focus:outline-none"
          >
            {LIMIT_OPTS.map(n => <option key={n} value={n}>{n} lines</option>)}
          </select>

          {/* Live dot */}
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-stone-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
            Live · 15s
          </div>
        </div>

        {/* Quick query presets */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-stone-100">
          <span className="text-[10px] text-stone-400 uppercase tracking-wider font-medium shrink-0">Quick:</span>
          {[
            { label: 'All logs', q: '{}' },
            { label: 'Errors only', q: '{} |= "error"' },
            { label: 'Warnings', q: '{} |= "warn"' },
            { label: 'kube-system', q: '{namespace="kube-system"}' },
            { label: 'fs-linkedeye', q: '{namespace="fs-linkedeye"}' },
          ].map(p => (
            <button
              key={p.q}
              onClick={() => { setQueryInput(p.q); setActiveQuery(p.q); }}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors border ${
                activeQuery === p.q
                  ? 'bg-[#059669]/10 text-[#059669] border-[#059669]/30'
                  : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100 hover:text-stone-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Active filters row */}
        {(severityFilter || search) && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-stone-100">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Filters:</span>
            {severityFilter && (
              <button
                onClick={() => setSeverityFilter(null)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-900 text-white"
              >
                {severityFilter} <X size={10} />
              </button>
            )}
            {search && (
              <button
                onClick={() => setSearch('')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-200"
              >
                "{search}" <X size={10} />
              </button>
            )}
            <span className="text-[10px] text-stone-400">{filteredLogs.length} / {logs.length} entries</span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* LABEL BROWSER                                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showLabels && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 mb-3 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={13} className="text-[#059669]" />
            <span className="font-display text-sm font-semibold text-stone-800">Label Browser</span>
            <span className="text-[10px] text-stone-400 ml-1">Click a value to add it to the query</span>
          </div>
          <div className="flex gap-4">
            {/* Label names */}
            <div className="w-44 border-r border-stone-100 pr-4 shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-2">Labels</p>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {(labelsData?.labels || []).map((lbl: string) => (
                  <button
                    key={lbl}
                    onClick={() => setSelectedLabel(lbl)}
                    className={`flex items-center gap-1 w-full text-left px-2 py-1 rounded text-[12px] font-mono transition-colors ${
                      selectedLabel === lbl
                        ? 'bg-[#059669]/10 text-[#059669]'
                        : 'text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {selectedLabel === lbl && <ChevronRight size={10} />}
                    {lbl}
                  </button>
                ))}
                {!(labelsData?.labels?.length) && (
                  <p className="text-[11px] text-stone-400 px-2">No labels. Ensure Loki is running on port 3100.</p>
                )}
              </div>
            </div>
            {/* Values */}
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-2">
                Values {selectedLabel && <span className="text-[#059669] normal-case font-mono">({selectedLabel})</span>}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {selectedLabel && (labelValuesData?.values || []).map((val: string) => (
                  <button
                    key={val}
                    onClick={() => injectLabel(selectedLabel, val)}
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-stone-100 text-stone-600 hover:bg-[#059669]/10 hover:text-[#059669] transition-colors border border-stone-200 hover:border-[#059669]/30"
                  >
                    {val}
                  </button>
                ))}
                {!selectedLabel && <p className="text-[11px] text-stone-400">Select a label →</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SEARCH BAR                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-300" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Client-side filter — search within results…"
          className="w-full pl-9 pr-4 py-2.5 text-[12px] border border-stone-200 rounded-xl bg-white text-stone-700 font-mono focus:outline-none focus:ring-2 focus:ring-[#059669]/25"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* LOG OUTPUT                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-obsidian text-ink border border-[color:var(--argus-border)] rounded-xl border border-[#1E293B] shadow-xl overflow-hidden">
        {/* Terminal header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E293B] bg-obsidian text-ink border border-[color:var(--argus-border)]/80">
          <div className="flex items-center gap-3">
            {/* Traffic light dots */}
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#DC2626]/60" />
              <span className="w-3 h-3 rounded-full bg-[#D97706]/60" />
              <span className="w-3 h-3 rounded-full bg-[#059669]/60" />
            </div>
            <div className="w-px h-4 bg-slate text-ink" />
            <Terminal size={12} className="text-[#34D399]" />
            <span className="text-[12px] font-mono text-muted">
              {activeQuery}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-[#475569]">
            <span>{filteredLogs.length} lines</span>
            <span>·</span>
            <span>{since}</span>
            {isFetching && <Loader2 size={12} className="animate-spin text-[#34D399]" />}
          </div>
        </div>

        {/* Log lines */}
        <div className="overflow-auto max-h-[680px]">
          {isLoading ? (
            <div className="py-24 text-center">
              <Loader2 size={24} className="text-[#34D399] animate-spin mx-auto mb-3" />
              <p className="text-[#475569] text-sm font-mono">Querying Loki via SSH…</p>
            </div>
          ) : queryError ? (
            <div className="py-20 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-[#DC2626]/10 flex items-center justify-center mx-auto mb-4 border border-[#DC2626]/20">
                <AlertTriangle size={24} className="text-[#DC2626]" />
              </div>
              <p className="text-muted font-semibold mb-1">
                {!selectedOrgId ? 'No Organization Selected' : 'Log Query Failed'}
              </p>
              <p className="text-[#475569] text-sm max-w-sm mx-auto">
                {!selectedOrgId
                  ? 'Select an organization from the sidebar to view its logs.'
                  : 'Could not reach the log endpoint. Check network or SSH connectivity.'}
              </p>
              <p className="text-dim text-xs mt-2 font-mono">
                {(queryError as any)?.response?.data?.error || (queryError as any)?.message}
              </p>
            </div>
          ) : data?.error ? (
            <div className="py-20 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-[#D97706]/10 flex items-center justify-center mx-auto mb-4 border border-[#D97706]/20">
                <AlertTriangle size={24} className="text-[#D97706]" />
              </div>
              <p className="text-muted font-semibold mb-1">Loki Unavailable</p>
              <p className="text-[#475569] text-sm max-w-sm mx-auto">
                Could not connect to Loki on the selected org's infrastructure.
                Ensure Loki is deployed and accessible on port 3100 via SSH.
              </p>
              <p className="text-dim text-xs mt-2 font-mono">{data.error}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-24 text-center px-8">
              <FileText size={32} className="text-ink mx-auto mb-3" />
              <p className="text-[#475569] text-sm font-semibold">No log entries matched</p>
              <p className="text-dim text-xs mt-1 mb-4">Try widening the time range, using <code className="text-[#34D399] bg-[#059669]/10 px-1 rounded">{'{}' }</code> to show all logs, or open the <strong className="text-muted">Labels</strong> browser to explore available streams.</p>
              <div className="flex flex-wrap justify-center gap-2 text-[11px]">
                {[
                  { label: 'Show all logs', q: '{}' },
                  { label: 'Errors only', q: '{} |= "error"' },
                  { label: 'Widen to 24h', action: () => {} },
                ].slice(0, 2).map(p => (
                  <button
                    key={p.q}
                    onClick={() => { setQueryInput(p.q!); setActiveQuery(p.q!); }}
                    className="px-3 py-1 rounded-lg bg-[#059669]/15 text-[#34D399] border border-[#059669]/25 hover:bg-[#059669]/25 transition-colors font-mono"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <table className="w-full text-[12px] font-mono border-collapse">
              <tbody>
                {filteredLogs.map((l: any, i: number) => {
                  const sev = detectSeverity(l.message);
                  return (
                    <tr key={i} className={`border-b border-[color:var(--argus-border)] hover:bg-white/[0.025] group ${sevRowClass(sev)}`}>
                      {/* Line number */}
                      <td className="px-2 py-0.5 text-dim select-none text-right w-10 align-top tabular-nums">
                        {i + 1}
                      </td>
                      {/* Timestamp */}
                      <td className="px-2 py-0.5 text-[#475569] whitespace-nowrap w-[110px] align-top tabular-nums">
                        {formatNanoTs(l.timestamp)}
                      </td>
                      {/* Severity badge */}
                      <td className="px-1 py-0.5 w-[46px] align-top">
                        <span className={`text-[10px] px-1.5 rounded font-bold ${sevBadgeClass(sev)}`}>
                          {sev === 'error' ? 'ERR' : sev === 'warn' ? 'WRN' : sev === 'debug' ? 'DBG' : 'INF'}
                        </span>
                      </td>
                      {/* Message */}
                      <td className={`px-2 py-0.5 break-all align-top ${sevTextClass(sev)}`}>
                        {search ? highlightSearch(l.message, search) : l.message}
                        {/* Labels on hover */}
                        {l.labels && Object.keys(l.labels).length > 0 && (
                          <span className="ml-2 text-ink opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                            {Object.entries(l.labels).filter(([k]) => k !== '__name__').slice(0, 4).map(([k, v]) => `${k}=${v}`).join(' ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Page>
  );
}
