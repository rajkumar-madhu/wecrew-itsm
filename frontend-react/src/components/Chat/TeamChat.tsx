import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, Users, Loader2, Hash } from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useSocket, emitEvent, onEvent } from '../../lib/socket';

interface ChatTeam {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  lastMessage?: {
    body: string;
    createdAt: string;
    author: string;
  } | null;
}

interface ChatUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  role?: string;
}

interface ChatMessage {
  id: string;
  teamId: string;
  userId: string;
  body: string;
  createdAt: string;
  user: ChatUser;
}

function initials(u: ChatUser) {
  return `${(u.firstName?.[0] || '').toUpperCase()}${(u.lastName?.[0] || '').toUpperCase()}` || '?';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TeamChat() {
  const user = useAuthStore((s) => s.user);
  const meId = user?.id;
  useSocket();

  const [teams, setTeams] = useState<ChatTeam[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) || null,
    [teams, activeTeamId]
  );

  const loadTeams = useCallback(async () => {
    setLoadingTeams(true);
    setError(null);
    try {
      const { data } = await api.get('/chat/teams');
      const list: ChatTeam[] = data.data || [];
      setTeams(list);
      if (!activeTeamId && list.length) setActiveTeamId(list[0].id);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load teams');
    } finally {
      setLoadingTeams(false);
    }
  }, [activeTeamId]);

  const loadMessages = useCallback(async (teamId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const { data } = await api.get(`/chat/teams/${teamId}/messages`, {
        params: { limit: 80 },
      });
      setMessages(data.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load messages');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeTeamId) return;
    loadMessages(activeTeamId);
    emitEvent('join:team', activeTeamId);
    return () => {
      emitEvent('leave:team', activeTeamId);
    };
  }, [activeTeamId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Live messages
  useEffect(() => {
    const offMsg = onEvent<ChatMessage>('chat:message', (msg) => {
      if (!msg?.teamId) return;
      if (msg.teamId === activeTeamId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      setTeams((prev) =>
        prev.map((t) =>
          t.id === msg.teamId
            ? {
                ...t,
                lastMessage: {
                  body: msg.body,
                  createdAt: msg.createdAt,
                  author: `${msg.user?.firstName || ''} ${msg.user?.lastName || ''}`.trim(),
                },
              }
            : t
        )
      );
    });

    const offTyping = onEvent<{ teamId: string; userId: string; typing: boolean }>(
      'chat:typing',
      (p) => {
        if (p.teamId !== activeTeamId || p.userId === meId) return;
        setTypingUser(p.typing ? p.userId : null);
        if (p.typing) {
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingUser(null), 2500);
        }
      }
    );

    return () => {
      offMsg();
      offTyping();
    };
  }, [activeTeamId, meId]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeTeamId || sending) return;
    setSending(true);
    setError(null);
    try {
      emitEvent('chat:typing', { teamId: activeTeamId, typing: false });
      const { data } = await api.post(`/chat/teams/${activeTeamId}/messages`, { body });
      const msg: ChatMessage = data.data;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setDraft('');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const onDraftChange = (v: string) => {
    setDraft(v);
    if (!activeTeamId) return;
    emitEvent('chat:typing', { teamId: activeTeamId, typing: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      emitEvent('chat:typing', { teamId: activeTeamId, typing: false });
    }, 1200);
  };

  return (
    <div className="animate-float-up h-[calc(100vh-6.5rem)] flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 shrink-0">
        <div>
          <p className="section-label mb-1">Communications</p>
          <h1 className="page-title text-2xl flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-signal-bright" />
            Team Chat
          </h1>
          <p className="page-subtitle mt-1">Real-time ops chat by team channel</p>
        </div>
      </div>

      <div className="glass-card flex-1 min-h-0 flex overflow-hidden">
        {/* Team list */}
        <aside
          className="w-64 shrink-0 flex flex-col border-r"
          style={{ borderColor: 'rgba(99,179,255,0.1)' }}
        >
          <div className="px-3 py-3 flex items-center gap-2 border-b" style={{ borderColor: 'rgba(99,179,255,0.08)' }}>
            <Users className="w-4 h-4 text-muted" />
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Teams</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loadingTeams && (
              <div className="flex items-center justify-center py-10 text-muted">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
            {!loadingTeams && teams.length === 0 && (
              <p className="text-sm text-muted px-2 py-4">No teams available. Create a team first.</p>
            )}
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTeamId(t.id)}
                className={clsx(
                  'w-full text-left rounded-xl px-3 py-2.5 transition-all',
                  activeTeamId === t.id
                    ? 'bg-signal/15 text-ink'
                    : 'text-muted hover:bg-white/5 hover:text-ink'
                )}
              >
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-dim">{t.memberCount}</span>
                </div>
                {t.lastMessage && (
                  <p className="text-[11px] text-dim mt-1 truncate pl-5">
                    {t.lastMessage.author}: {t.lastMessage.body}
                  </p>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Conversation */}
        <section className="flex-1 min-w-0 flex flex-col">
          <header
            className="px-4 py-3 flex items-center gap-3 border-b shrink-0"
            style={{ borderColor: 'rgba(99,179,255,0.08)' }}
          >
            {activeTeam ? (
              <>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(34,211,238,0.2))',
                    border: '1px solid rgba(99,102,241,0.35)',
                  }}
                >
                  <Hash className="w-4 h-4 text-signal-bright" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink truncate">{activeTeam.name}</h2>
                  <p className="text-[11px] text-dim truncate">
                    {activeTeam.memberCount} members
                    {activeTeam.description ? ` · ${activeTeam.description}` : ''}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Select a team to start chatting</p>
            )}
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loadingMessages && (
              <div className="flex justify-center py-16 text-muted">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
            {!loadingMessages && activeTeamId && messages.length === 0 && (
              <div className="text-center py-16">
                <MessageSquare className="w-10 h-10 text-dim mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted">No messages yet. Say hello to the team.</p>
              </div>
            )}
            {messages.map((m) => {
              const mine = m.userId === meId;
              return (
                <div
                  key={m.id}
                  className={clsx('flex gap-2.5', mine ? 'flex-row-reverse' : 'flex-row')}
                >
                  <div
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{
                      background: mine
                        ? 'linear-gradient(135deg, #6366F1, #22D3EE)'
                        : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                    }}
                  >
                    {initials(m.user)}
                  </div>
                  <div className={clsx('max-w-[70%] min-w-0', mine ? 'items-end' : 'items-start')}>
                    <div className={clsx('flex items-baseline gap-2 mb-0.5', mine && 'flex-row-reverse')}>
                      <span className="text-[12px] font-medium text-ink">
                        {mine ? 'You' : `${m.user.firstName} ${m.user.lastName}`.trim()}
                      </span>
                      <span className="text-[10px] text-dim font-mono">{formatTime(m.createdAt)}</span>
                    </div>
                    <div
                      className={clsx(
                        'rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words',
                        mine ? 'rounded-tr-md text-white' : 'rounded-tl-md text-ink'
                      )}
                      style={
                        mine
                          ? {
                              background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
                              boxShadow: '0 0 16px -8px rgba(99,102,241,0.6)',
                            }
                          : {
                              background: 'rgba(15,27,45,0.95)',
                              border: '1px solid rgba(99,179,255,0.12)',
                            }
                      }
                    >
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })}
            {typingUser && (
              <p className="text-[11px] text-dim italic px-1">Someone is typing…</p>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div className="px-4 py-2 text-xs text-crimson border-t" style={{ borderColor: 'rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.08)' }}>
              {error}
            </div>
          )}

          <footer
            className="p-3 border-t shrink-0"
            style={{ borderColor: 'rgba(99,179,255,0.08)' }}
          >
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                className="input-field min-h-[44px] max-h-32 resize-none flex-1"
                placeholder={activeTeam ? `Message #${activeTeam.name}` : 'Select a team…'}
                disabled={!activeTeamId || sending}
                value={draft}
                rows={1}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                type="submit"
                className="btn-primary h-11 px-4 flex items-center gap-2 shrink-0 disabled:opacity-40"
                disabled={!activeTeamId || !draft.trim() || sending}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </form>
            <p className="text-[10px] text-dim mt-1.5 px-0.5">Enter to send · Shift+Enter for newline</p>
          </footer>
        </section>
      </div>
    </div>
  );
}
