import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  MessageSquare,
  Send,
  Search,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useSMSLogs, useSMSStats, useSMSProviders, useSendSMS } from '../../hooks/useSMS';
import type { SMSLog, SMSProvider } from '../../types';
import { Page, Toolbar, Panel, EnterpriseHero, EnterprisePosture } from '../ui/PageChrome';
import type { EnterpriseKpi } from '../ui/PageChrome';

function ProviderBadge({ provider }: { provider: SMSProvider }) {
  const tone: Record<SMSProvider, 'alert' | 'ok' | 'warn'> = {
    TWILIO: 'alert',
    MSG91: 'ok',
    KALEYRA: 'warn',
  };
  return <span className={clsx('cx-pill', `cx-pill--${tone[provider] || 'neutral'}`)}>{provider}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const tone =
    s === 'SENT' || s === 'DELIVERED' ? 'ok' :
    s === 'FAILED' ? 'danger' :
    s === 'RECEIVED' ? 'alert' :
    'neutral';
  return <span className={clsx('cx-pill', `cx-pill--${tone}`)}>{s}</span>;
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'INBOUND') return <ArrowDownLeft className="w-3.5 h-3.5 text-signal" />;
  return <ArrowUpRight className="w-3.5 h-3.5 text-amber" />;
}

export default function SMSDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const [showSendForm, setShowSendForm] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sendProvider, setSendProvider] = useState<string>('');

  const queryFilters = useMemo(() => {
    const f: Record<string, string | number> = { page, limit: 20 };
    if (directionFilter !== 'ALL') f.direction = directionFilter;
    if (providerFilter !== 'ALL') f.provider = providerFilter;
    return f;
  }, [directionFilter, providerFilter, page]);

  const { data: logsResponse, isLoading: logsLoading } = useSMSLogs(queryFilters);
  const { data: statsResponse } = useSMSStats();
  const { data: providersResponse } = useSMSProviders();
  const sendSMS = useSendSMS();

  const logs: SMSLog[] = logsResponse?.data ?? [];
  const pagination = logsResponse?.pagination;
  const stats = statsResponse?.data;
  const providers = providersResponse?.data?.providers ?? [];

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (l) =>
        l.recipient.toLowerCase().includes(q) ||
        l.message.toLowerCase().includes(q) ||
        l.incident?.number?.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  const handleSend = async () => {
    if (!sendRecipient || !sendMessage) {
      toast.error('Recipient and message are required');
      return;
    }
    try {
      await sendSMS.mutateAsync({
        recipient: sendRecipient,
        message: sendMessage,
        provider: sendProvider || undefined,
      });
      toast.success('SMS sent successfully');
      setSendRecipient('');
      setSendMessage('');
      setShowSendForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to send SMS');
    }
  };

  const failed = stats?.failed ?? 0;
  const kpis: EnterpriseKpi[] = [
    { label: 'Messages', value: stats?.total ?? '—', sub: 'on record' },
    { label: 'Sent', value: stats?.sent ?? '—', sub: 'outbound delivered' },
    { label: 'Failed', value: failed, sub: 'did not leave the gateway', tone: failed > 0 ? 'danger' : undefined },
    { label: 'Inbound', value: stats?.inbound ?? '—', sub: 'replies received' },
    { label: 'Success', value: stats ? `${stats.successRate}%` : '—', sub: 'of attempted sends', tone: stats && stats.successRate < 90 ? 'warn' : undefined },
  ];

  return (
    <Page>
      <EnterpriseHero
        plane="respond"
        domain="communications"
        title="SMS"
        deck="Org-scoped outbound pages and inbound replies across Twilio, MSG91 and Kaleyra. A failed send is a pager that never rang."
        actions={
          <button type="button" onClick={() => setShowSendForm(!showSendForm)} className="cx-hero__btn">
            <Send size={14} strokeWidth={1.75} />
            Send an SMS
          </button>
        }
        kpiCols={5}
        kpis={kpis}
      />
      <EnterprisePosture chips={['Org-scoped delivery', 'Evidence on every send', 'Audit export ready']} />

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">SMS</span>
      </nav>

      {showSendForm && (
        <Panel title="Compose">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Recipient</label>
                <input
                  type="tel"
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value)}
                  placeholder="+919876543210"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Provider (optional)</label>
                <select
                  value={sendProvider}
                  onChange={(e) => setSendProvider(e.target.value)}
                  className="filter-select w-full"
                >
                  <option value="">Auto-select</option>
                  <option value="TWILIO">Twilio</option>
                  <option value="MSG91">MSG91</option>
                  <option value="KALEYRA">Kaleyra</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sendSMS.isPending}
                  className="cx-btn cx-btn--primary w-full disabled:opacity-50"
                >
                  {sendSMS.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Message</label>
              <textarea
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                maxLength={160}
                className="input-field resize-none"
              />
              <p className="text-[10px] text-dim mt-1 font-mono">{sendMessage.length}/160 characters</p>
            </div>
          </div>
        </Panel>
      )}

      {providers.length > 0 && (
        <Panel title="Providers">
          <div className="flex flex-wrap gap-3">
            {providers.map((p: { name: SMSProvider; healthy: boolean; message: string }) => (
              <div
                key={p.name}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                  p.healthy ? 'border-steel bg-emerald-dim' : 'border-steel bg-crimson-dim',
                )}
              >
                <span className={clsx('w-2 h-2 rounded-full', p.healthy ? 'bg-emerald' : 'bg-crimson')} />
                <span className="font-mono text-xs text-ink">{p.name}</span>
                <span className="text-[10px] text-dim">{p.message}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Toolbar>
        <div className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {logsLoading ? '—' : `${pagination?.total ?? filteredLogs.length} message${(pagination?.total ?? filteredLogs.length) === 1 ? '' : 's'}`}
          </span>
          {pagination && (
            <span className="cx-listhead__count-meta">page {pagination.page} of {pagination.totalPages}</span>
          )}
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <select
          value={directionFilter}
          onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}
          className={clsx('filter-select', directionFilter !== 'ALL' && 'filter-select--active')}
        >
          <option value="ALL">All directions</option>
          <option value="OUTBOUND">Outbound</option>
          <option value="INBOUND">Inbound</option>
        </select>

        <select
          value={providerFilter}
          onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
          className={clsx('filter-select', providerFilter !== 'ALL' && 'filter-select--active')}
        >
          <option value="ALL">All providers</option>
          <option value="TWILIO">Twilio</option>
          <option value="MSG91">MSG91</option>
          <option value="KALEYRA">Kaleyra</option>
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            placeholder="Search by recipient, message, or incident..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-8 py-1.5 text-[13px]"
          />
        </div>
      </Toolbar>

      <div className="cx-table-wrap">
        <div className="overflow-x-auto">
          <table className="cx-table">
            <thead>
              <tr>
                <th>Direction</th>
                <th>Recipient</th>
                <th>Message</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Incident</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Loader2 size={18} className="mx-auto mb-2 animate-spin text-dim" />
                    <p className="text-xs text-muted font-mono">Loading SMS logs…</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <MessageSquare size={22} className="mx-auto mb-2 text-graphite" strokeWidth={1.75} />
                    <p className="text-sm text-ink font-medium">No SMS logs found</p>
                    <p className="text-xs text-muted mt-1">Send a message or adjust the filters.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td><DirectionIcon direction={log.direction} /></td>
                    <td className="font-mono text-xs text-ink">{log.recipient}</td>
                    <td className="text-xs text-muted max-w-[300px] truncate">{log.message}</td>
                    <td><ProviderBadge provider={log.provider} /></td>
                    <td><StatusBadge status={log.status} /></td>
                    <td>
                      {log.incident ? (
                        <span className="text-[10px] font-mono text-signal">{log.incident.number}</span>
                      ) : (
                        <span className="text-[10px] text-dim">—</span>
                      )}
                    </td>
                    <td className="text-[11px] text-dim font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[color:var(--argus-border)]">
            <span className="text-[12px] text-muted">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={!pagination.hasPrev}
                aria-label="Previous page"
                className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="px-2 text-[12px] font-mono text-muted">{pagination.page} / {pagination.totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={!pagination.hasNext}
                aria-label="Next page"
                className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
