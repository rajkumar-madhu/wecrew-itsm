import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  MessageSquare,
  Send,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
} from 'lucide-react';
import { useSMSLogs, useSMSStats, useSMSProviders, useSendSMS } from '../../hooks/useSMS';
import type { SMSLog, SMSProvider } from '../../types';

// ── Subcomponents ──

function StatsCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  const c: Record<string, { border: string; icon: string; bg: string }> = {
    signal: { border: 'border-indigo-200', icon: 'text-signal', bg: 'bg-indigo-50' },
    crimson: { border: 'border-red-200', icon: 'text-crimson', bg: 'bg-red-50' },
    amber: { border: 'border-amber-200', icon: 'text-amber', bg: 'bg-amber-50' },
    emerald: { border: 'border-emerald-200', icon: 'text-emerald', bg: 'bg-emerald-50' },
    violet: { border: 'border-violet-200', icon: 'text-violet', bg: 'bg-violet-50' },
  };
  const s = c[color] || c.signal;
  return (
    <div className={clsx('glass-card p-4 transition-all duration-300', s.border)}>
      <div className="flex items-start justify-between mb-2">
        <div className={clsx('p-2 rounded-xl', s.bg)}>
          <Icon className={clsx('w-4 h-4', s.icon)} />
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-stone-900 tracking-tight">{value}</p>
      <p className="text-xs text-stone-400 mt-0.5">{label}</p>
    </div>
  );
}

function ProviderBadge({ provider }: { provider: SMSProvider }) {
  const cls: Record<SMSProvider, string> = {
    TWILIO: 'bg-indigo-50 text-signal border-indigo-200',
    MSG91: 'bg-violet-50 text-violet border-violet-200',
    KALEYRA: 'bg-amber-50 text-amber border-amber-200',
  };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border', cls[provider])}>
      {provider}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls =
    s === 'SENT' || s === 'DELIVERED' ? 'bg-emerald-50 text-emerald border-emerald-200' :
    s === 'FAILED' ? 'bg-red-50 text-crimson border-red-200' :
    s === 'RECEIVED' ? 'bg-indigo-50 text-signal border-indigo-200' :
    'bg-stone-100 text-stone-500 border-stone-200';
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border', cls)}>
      {s}
    </span>
  );
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'INBOUND') return <ArrowDownLeft className="w-3.5 h-3.5 text-signal" />;
  return <ArrowUpRight className="w-3.5 h-3.5 text-amber" />;
}

// ── Main Component ──

export default function SMSDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // Send SMS form state
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

  // Client-side search filter
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

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0F172A] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <MessageSquare size={16} className="text-indigo-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-white tracking-tight">SMS Gateway</h1>
              </div>
              <p className="text-slate-400 text-sm ml-[42px]">
                Multi-provider SMS management &middot; <span className="font-mono text-slate-300">{stats?.total ?? 0}</span> total messages
              </p>
            </div>
            <button onClick={() => setShowSendForm(!showSendForm)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.02]">
              <Send className="w-4 h-4" /> Send SMS
            </button>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent -mt-5 mb-4" />

      {/* Send SMS Form */}
      {showSendForm && (
        <div className="glass-card p-5 border-indigo-200 space-y-4 animate-fade-in">
          <h3 className="text-sm font-display font-bold text-stone-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-signal" />
            Compose Message
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-stone-500 font-medium mb-1 block">Recipient</label>
              <input
                type="tel"
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                placeholder="+919876543210"
                className="input-field w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium mb-1 block">Provider (optional)</label>
              <select
                value={sendProvider}
                onChange={(e) => setSendProvider(e.target.value)}
                className="input-field w-full text-sm"
              >
                <option value="">Auto-select</option>
                <option value="TWILIO">Twilio</option>
                <option value="MSG91">MSG91</option>
                <option value="KALEYRA">Kaleyra</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSend}
                disabled={sendSMS.isPending}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-2 w-full justify-center disabled:opacity-50"
              >
                {sendSMS.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-500 font-medium mb-1 block">Message</label>
            <textarea
              value={sendMessage}
              onChange={(e) => setSendMessage(e.target.value)}
              placeholder="Type your message..."
              rows={3}
              maxLength={160}
              className="input-field w-full text-sm resize-none"
            />
            <p className="text-[10px] text-stone-300 mt-1 font-mono">{sendMessage.length}/160 characters</p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard icon={MessageSquare} label="Total Messages" value={stats?.total ?? 0} color="signal" />
        <StatsCard icon={CheckCircle} label="Sent" value={stats?.sent ?? 0} color="emerald" />
        <StatsCard icon={XCircle} label="Failed" value={stats?.failed ?? 0} color="crimson" />
        <StatsCard icon={ArrowDownLeft} label="Inbound" value={stats?.inbound ?? 0} color="violet" />
        <StatsCard icon={Activity} label="Success Rate" value={`${stats?.successRate ?? 0}%`} color="amber" />
      </div>

      {/* Provider Status */}
      {providers.length > 0 && (
        <div className="glass-card p-4 border-stone-200">
          <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-3">Provider Status</h3>
          <div className="flex flex-wrap gap-3">
            {providers.map((p: { name: SMSProvider; healthy: boolean; message: string }) => (
              <div
                key={p.name}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                  p.healthy
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50'
                )}
              >
                <span className={clsx('w-2 h-2 rounded-full', p.healthy ? 'bg-emerald' : 'bg-crimson')} />
                <span className="font-mono text-xs text-stone-900">{p.name}</span>
                <span className="text-[10px] text-stone-400">{p.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white/90 backdrop-blur-xl rounded-xl border border-stone-200 shadow-sm p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-stone-400">
            <Filter size={13} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">Filters</span>
          </div>

          <select
            value={directionFilter}
            onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}
            className={`filter-select ${directionFilter !== 'ALL' ? 'filter-select--active' : ''}`}
          >
            <option value="ALL">All Directions</option>
            <option value="OUTBOUND">Outbound</option>
            <option value="INBOUND">Inbound</option>
          </select>

          <select
            value={providerFilter}
            onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
            className={`filter-select ${providerFilter !== 'ALL' ? 'filter-select--active' : ''}`}
          >
            <option value="ALL">All Providers</option>
            <option value="TWILIO">Twilio</option>
            <option value="MSG91">MSG91</option>
            <option value="KALEYRA">Kaleyra</option>
          </select>

          <div className="w-px h-7 bg-stone-200/60 hidden sm:block" />

          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by recipient, message, or incident..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-stone-50/80 border border-stone-200/80 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {logsLoading && (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 text-signal mx-auto mb-3 animate-spin" />
          <p className="text-stone-500 font-medium">Loading SMS logs...</p>
        </div>
      )}

      {/* SMS Logs Table */}
      {!logsLoading && (
        <div className="glass-card overflow-hidden border-stone-200">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">No SMS logs found</p>
              <p className="text-stone-300 text-sm mt-1">Send your first message or adjust filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">Direction</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">Recipient</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">Message</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">Provider</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">Incident</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-stone-100 hover:bg-stone-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <DirectionIcon direction={log.direction} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-stone-900">{log.recipient}</td>
                      <td className="px-4 py-3 text-xs text-stone-500 max-w-[300px] truncate">{log.message}</td>
                      <td className="px-4 py-3"><ProviderBadge provider={log.provider} /></td>
                      <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                      <td className="px-4 py-3">
                        {log.incident ? (
                          <span className="text-[10px] font-mono text-signal">{log.incident.number}</span>
                        ) : (
                          <span className="text-[10px] text-stone-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-stone-400 font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
              <span className="text-xs text-stone-400 font-mono">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={!pagination.hasPrev}
                  className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext}
                  className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
