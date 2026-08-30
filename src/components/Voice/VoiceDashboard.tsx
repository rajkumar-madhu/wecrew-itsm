import type React from 'react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import {
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Bot,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Volume2,
  Languages,
  Heart,
  User,
  ExternalLink,
  Send,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  useVoiceCallLogs,
  useVoiceStats,
  useVoiceLanguages,
  useVoiceHealth,
  useTranscribe,
  useSynthesize,
  useMakeCall,
} from '../../hooks/useVoice';
import { useSocket } from '../../lib/socket';
import type { VoiceCallLog, VoiceHandler } from '../../types';
import { Page, Toolbar, Panel, Segmented, GhostButton, PrimaryButton } from '../ui/PageChrome';

// ── AI Voice Agent Chat ──

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
}

const AGENT_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'mr', label: 'Marathi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'gu', label: 'Gujarati' },
];

function AIAgentTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: "Hello! I'm Santhira, your IT incident management assistant. Click the microphone to speak, or type a message below.", timestamp: new Date() },
  ]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [agentLang, setAgentLang] = useState('en');

  const socketRef = useRef<Socket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const addMsg = useCallback((role: ChatMessage['role'], text: string) => {
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: new Date() }]);
  }, []);

  // Audio playback queue
  const playNext = useCallback(() => {
    if (audioQueueRef.current.length === 0) { isPlayingRef.current = false; return; }
    isPlayingRef.current = true;
    const b64 = audioQueueRef.current.shift()!;
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); playNext(); };
    audio.onerror = () => { URL.revokeObjectURL(url); playNext(); };
    audio.play().catch(() => playNext());
  }, []);

  // Connect to Santhira voice agent (reconnects when language changes)
  useEffect(() => {
    const voiceSocket = io(window.location.origin, {
      path: '/santhira/socket.io/',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socketRef.current = voiceSocket;

    voiceSocket.on('connect', () => {
      setIsConnected(true);
      voiceSocket.emit('start-session', { language: agentLang });
    });

    voiceSocket.on('disconnect', () => setIsConnected(false));

    voiceSocket.on('session-ready', (data: { session_id: string }) => {
      console.log('[Santhira] Session:', data.session_id);
    });

    voiceSocket.on('transcript', (data: { text: string }) => {
      setIsProcessing(true);
      setProcessingText('Thinking...');
      addMsg('user', data.text);
    });

    voiceSocket.on('response-text', (data: { text: string }) => {
      setIsProcessing(false);
      setProcessingText('');
      addMsg('assistant', data.text);
    });

    voiceSocket.on('audio-response', (data: { audio: string }) => {
      audioQueueRef.current.push(data.audio);
      if (!isPlayingRef.current) playNext();
    });

    voiceSocket.on('error', (data: { code: string; message: string }) => {
      setIsProcessing(false);
      setProcessingText('');
      if (data.code !== 'AUDIO_TOO_SHORT') {
        addMsg('system', `Error: ${data.message}`);
      }
    });

    return () => { voiceSocket.disconnect(); };
  }, [addMsg, playNext, agentLang]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Mic recording
  const startRecording = useCallback(async () => {
    if (!socketRef.current?.connected) { toast.error('Voice agent not connected'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) socketRef.current?.emit('audio-chunk', e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        socketRef.current?.emit('finalize-audio', {});
        setIsProcessing(true);
        setProcessingText('Transcribing...');
      };

      recorder.start(250);
      setIsRecording(true);
    } catch {
      toast.error('Microphone access denied');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setIsRecording(false);
  }, []);

  // Keep ref in sync
  useEffect(() => {
    if (isRecording) {
      // startRecording creates the recorder, we need to capture it
    }
  }, [isRecording]);

  // Patched startRecording to save ref
  const handleMicClick = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (!socketRef.current?.connected) { toast.error('Voice agent not connected'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) socketRef.current?.emit('audio-chunk', e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          socketRef.current?.emit('finalize-audio', {});
          setIsProcessing(true);
          setProcessingText('Transcribing...');
        };

        recorderRef.current = recorder;
        recorder.start(250);
        setIsRecording(true);
      } catch {
        toast.error('Microphone access denied');
      }
    }
  }, [isRecording, stopRecording]);

  // Send text message
  const handleSendText = useCallback(() => {
    const text = textInput.trim();
    if (!text || !socketRef.current?.connected) return;
    addMsg('user', text);
    socketRef.current.emit('text-message', { text });
    setTextInput('');
    setIsProcessing(true);
    setProcessingText('Thinking...');
  }, [textInput, addMsg]);

  return (
    <div className="overflow-hidden bg-[color:var(--argus-surface)]" style={{ height: 'calc(100vh - 400px)', minHeight: '500px' }}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-steel bg-[color:var(--argus-elevated)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-signal-dim flex items-center justify-center">
            <Bot className="w-4 h-4 text-signal" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-ink">Santhira AI Agent</h3>
            <p className="text-[10px] text-dim">GPT-4.1 &middot; Real-time voice &middot; ITSM tools</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            value={agentLang}
            onChange={e => { setAgentLang(e.target.value); setMessages([{ id: 'welcome', role: 'assistant', text: "Language changed. Starting new session...", timestamp: new Date() }]); }}
            className="filter-select text-[11px]"
          >
            {AGENT_LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>

          {/* Status */}
          <div className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border',
            isConnected
              ? 'border-steel bg-emerald-dim text-emerald'
              : 'border-steel bg-crimson-dim text-crimson'
          )}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ height: 'calc(100% - 140px)' }}>
        {messages.map(msg => (
          <div key={msg.id} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={clsx(
                'max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'rounded-br-sm'
                  : msg.role === 'system'
                  ? 'bg-crimson-dim text-crimson rounded-bl-sm'
                  : 'bg-[color:var(--argus-elevated)] text-ink border border-steel rounded-bl-sm'
              )}
              style={msg.role === 'user' ? { background: 'var(--argus-signal)', color: 'var(--brand-paper)' } : undefined}
            >
              <div className={clsx(
                'text-[10px] font-mono font-medium uppercase tracking-wider mb-1',
                msg.role === 'user' ? 'opacity-70' : msg.role === 'system' ? 'text-crimson' : 'text-dim'
              )}>
                {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'Santhira'}
              </div>
              <span className="whitespace-pre-wrap">{msg.text}</span>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-[color:var(--argus-elevated)] border border-steel rounded-xl rounded-bl-sm px-4 py-2.5 text-sm text-muted flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="italic">{processingText || 'Processing...'}</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-steel bg-[color:var(--argus-elevated)] px-5 py-3 flex items-center gap-3">
        {/* Text Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
            placeholder="Type a message or use the mic..."
            disabled={!isConnected || isRecording}
            className="input-field disabled:opacity-50"
          />
        </div>

        {/* Send Text */}
        <button
          onClick={handleSendText}
          disabled={!isConnected || !textInput.trim() || isRecording}
          className="w-10 h-10 rounded-xl bg-signal flex items-center justify-center disabled:opacity-30 transition-all"
          style={{ color: 'var(--brand-paper)' }}
        >
          <Send className="w-4 h-4" />
        </button>

        {/* Mic Button */}
        <button
          onClick={handleMicClick}
          disabled={!isConnected}
          className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300',
            isRecording
              ? 'bg-coral animate-pulse'
              : 'bg-signal hover:opacity-90'
          )}
          style={{ color: 'var(--brand-paper)' }}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

// ── Subcomponents ──

function HandlerBadge({ handler }: { handler: VoiceHandler }) {
  const tone: Record<VoiceHandler, 'alert' | 'ok' | 'warn'> = {
    AI_BOT: 'alert',
    HUMAN: 'ok',
    IVR: 'warn',
  };
  const icons: Record<VoiceHandler, React.ComponentType<{ className?: string }>> = {
    AI_BOT: Bot,
    HUMAN: User,
    IVR: Phone,
  };
  const IconComp = icons[handler];
  return (
    <span className={clsx('cx-pill inline-flex items-center gap-1', `cx-pill--${tone[handler]}`)}>
      <IconComp className="w-3 h-3" />
      {handler.replace('_', ' ')}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-dim">—</span>;
  const s = status.toLowerCase();
  const tone =
    s === 'completed' ? 'ok' :
    s === 'in-progress' || s === 'ringing' ? 'warn' :
    s === 'failed' || s === 'busy' || s === 'no-answer' ? 'danger' :
    'neutral';
  return <span className={clsx('cx-pill', `cx-pill--${tone}`)}>{status}</span>;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Main Component ──

export default function VoiceDashboard() {
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [handlerFilter, setHandlerFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Voice tools state
  const [activeTab, setActiveTab] = useState<'agent' | 'logs' | 'transcribe' | 'synthesize' | 'call'>('agent');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [synthesizeText, setSynthesizeText] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [transcriptionResult, setTranscriptionResult] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryFilters = useMemo(() => {
    const f: Record<string, string | number> = { page, limit: 20 };
    if (directionFilter !== 'ALL') f.direction = directionFilter;
    if (handlerFilter !== 'ALL') f.handler = handlerFilter;
    return f;
  }, [directionFilter, handlerFilter, page]);

  const socket = useSocket();

  const { data: logsResponse, isLoading: logsLoading } = useVoiceCallLogs(queryFilters);
  const { data: statsResponse } = useVoiceStats();
  const { data: languagesResponse } = useVoiceLanguages();
  const { data: healthResponse } = useVoiceHealth();
  const transcribe = useTranscribe();
  const synthesize = useSynthesize();
  const makeCall = useMakeCall();

  // Real-time: toast when a call completes and an incident is auto-created
  useEffect(() => {
    const handler = (data: { callId: string; incidentNumber: string }) => {
      toast.success(
        `Call completed — incident ${data.incidentNumber} auto-created`,
        { duration: 6000, icon: '📞' }
      );
    };
    socket.on('voice:call-completed', handler);
    return () => { socket.off('voice:call-completed', handler); };
  }, [socket]);

  const logs: VoiceCallLog[] = logsResponse?.data ?? [];
  const pagination = logsResponse?.pagination;
  const stats = statsResponse?.data;
  const languages = languagesResponse?.data ?? [];
  const voiceHealth = healthResponse?.data;

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (l) =>
        l.callerNumber?.toLowerCase().includes(q) ||
        l.callerName?.toLowerCase().includes(q) ||
        l.transcript?.toLowerCase().includes(q) ||
        l.callSid?.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  // ── Recording ──

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
        try {
          const result = await transcribe.mutateAsync({ audio: file, language: selectedLanguage });
          setTranscriptionResult(result.data?.text || 'No transcription returned');
          toast.success('Transcription complete');
        } catch (err: any) {
          toast.error(err?.response?.data?.error ?? 'Transcription failed');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error('Microphone access denied');
    }
  }, [transcribe, selectedLanguage]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleFileTranscribe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await transcribe.mutateAsync({ audio: file, language: selectedLanguage });
      setTranscriptionResult(result.data?.text || 'No transcription returned');
      toast.success('Transcription complete');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Transcription failed');
    }
  };

  const handleSynthesize = async () => {
    if (!synthesizeText.trim()) { toast.error('Enter text to synthesize'); return; }
    try {
      const blob = await synthesize.mutateAsync({ text: synthesizeText, language: selectedLanguage });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      toast.success('Playing synthesized audio');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Synthesis failed');
    }
  };

  const handleMakeCall = async () => {
    if (!callNumber.trim()) { toast.error('Enter a phone number'); return; }
    try {
      await makeCall.mutateAsync({ to: callNumber });
      toast.success('Call initiated');
      setCallNumber('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to initiate call');
    }
  };

  const tabs = [
    { id: 'agent' as const, label: 'AI Agent', icon: Bot },
    { id: 'logs' as const, label: 'Call Logs', icon: Phone },
    { id: 'transcribe' as const, label: 'Transcribe', icon: Mic },
    { id: 'synthesize' as const, label: 'Synthesize', icon: Volume2 },
    { id: 'call' as const, label: 'Make Call', icon: PhoneCall },
  ];

  const kpis = [
    { label: 'Calls', value: stats?.total ?? '—', sub: 'on record' },
    { label: 'Inbound', value: stats?.inbound ?? '—', sub: 'received at the gateway' },
    { label: 'Outbound', value: stats?.outbound ?? '—', sub: 'initiated from here' },
    { label: 'AI handled', value: stats?.aiHandled ?? '—', sub: 'bot took the call' },
    { label: 'Avg duration', value: formatDuration(stats?.averageDurationSeconds ?? 0), sub: 'talk time' },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Respond · communications</span>
            <h1 className="cx-hero__title">Voice</h1>
            <p className="cx-hero__deck">
              Santhira on the line — STT, TTS and Twilio IVR. A missed call here is a pager that never rang.
            </p>
          </div>
          <div className="cx-posture">
            <Heart size={14} strokeWidth={1.75} />
            <span className="text-xs font-mono">Voice server</span>
            <span className={clsx('cx-posture__chip', voiceHealth?.healthy ? 'text-emerald' : 'text-crimson')}>
              {voiceHealth?.healthy ? 'online' : 'offline'}
            </span>
          </div>
        </div>
        <dl className="cx-hero__kpis cx-hero__kpis--5 mt-6">
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
        <span className="cx-crumb__current">Voice</span>
      </nav>

      <Toolbar>
        <Segmented
          options={tabs.map((tab) => ({ value: tab.id, label: tab.label, icon: tab.icon }))}
          value={activeTab}
          onChange={(v) => setActiveTab(v as typeof activeTab)}
        />
        {languages.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Languages size={14} className="text-dim" />
            {languages.map((lang: { code: string; name: string }) => (
              <GhostButton
                key={lang.code}
                active={selectedLanguage === lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
              >
                {lang.name}
              </GhostButton>
            ))}
          </div>
        )}
      </Toolbar>

      {activeTab === 'agent' && (
        <Panel noPad>
          <AIAgentTab />
        </Panel>
      )}

      {activeTab === 'transcribe' && (
        <Panel title="Speech to text" titleExtra={<span className="text-dim font-mono text-[10px]">Whisper STT</span>}>
          <div className="flex flex-col items-center gap-4 py-4">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={transcribe.isPending}
              className={clsx(
                'w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                isRecording
                  ? 'bg-coral-dim border-coral animate-pulse'
                  : 'bg-signal-dim border-signal'
              )}
            >
              {transcribe.isPending ? (
                <Loader2 className="w-8 h-8 text-signal animate-spin" />
              ) : isRecording ? (
                <Square className="w-8 h-8 text-coral" />
              ) : (
                <Mic className="w-8 h-8 text-signal" />
              )}
            </button>
            <p className="text-xs text-muted">
              {isRecording ? 'Recording — click to stop' : transcribe.isPending ? 'Transcribing…' : 'Click to record or upload a file'}
            </p>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileTranscribe}
                className="hidden"
              />
              <GhostButton
                onClick={() => fileInputRef.current?.click()}
                disabled={transcribe.isPending}
              >
                {transcribe.isPending ? 'Transcribing…' : 'Upload audio'}
              </GhostButton>
            </div>
            {transcriptionResult && (
              <div className="w-full mt-2 p-4 border border-steel bg-[color:var(--argus-elevated)]">
                <p className="text-[10px] text-dim mb-1 font-mono uppercase tracking-widest">Transcription</p>
                <p className="text-sm text-ink leading-relaxed">{transcriptionResult}</p>
              </div>
            )}
          </div>
        </Panel>
      )}

      {activeTab === 'synthesize' && (
        <Panel title="Text to speech" titleExtra={<span className="text-dim font-mono text-[10px]">XTTS v2</span>}>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Text to speak</label>
              <textarea
                value={synthesizeText}
                onChange={(e) => setSynthesizeText(e.target.value)}
                placeholder="Enter text to convert to speech…"
                rows={4}
                className="input-field w-full text-sm resize-none"
              />
            </div>
            <PrimaryButton onClick={handleSynthesize} disabled={synthesize.isPending}>
              {synthesize.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {synthesize.isPending ? 'Generating…' : 'Speak'}
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {activeTab === 'call' && (
        <Panel title="Outbound call" titleExtra={<span className="text-dim font-mono text-[10px]">Twilio IVR</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Phone number</label>
              <input
                type="tel"
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="+919876543210"
                className="input-field w-full text-sm"
              />
            </div>
            <div className="flex items-end">
              <PrimaryButton onClick={handleMakeCall} disabled={makeCall.isPending}>
                {makeCall.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                {makeCall.isPending ? 'Calling…' : 'Initiate call'}
              </PrimaryButton>
            </div>
          </div>
          <p className="text-xs text-muted mt-4">
            The recipient hears an automated greeting and can interact via DTMF or speech.
          </p>
        </Panel>
      )}

      {activeTab === 'logs' && (
        <>
          <Toolbar>
            <div className="cx-listhead__count">
              <span className="cx-listhead__count-value">
                {logsLoading ? '—' : `${pagination?.total ?? filteredLogs.length} call${(pagination?.total ?? filteredLogs.length) === 1 ? '' : 's'}`}
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
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
            </select>

            <select
              value={handlerFilter}
              onChange={(e) => { setHandlerFilter(e.target.value); setPage(1); }}
              className={clsx('filter-select', handlerFilter !== 'ALL' && 'filter-select--active')}
            >
              <option value="ALL">All handlers</option>
              <option value="AI_BOT">AI Bot</option>
              <option value="HUMAN">Human</option>
              <option value="IVR">IVR</option>
            </select>

            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
              <input
                type="text"
                placeholder="Search caller, transcript, or SID…"
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
                    <th>Dir</th>
                    <th>Caller</th>
                    <th>Transcript</th>
                    <th>Handler</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Incident</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center">
                        <Loader2 size={18} className="mx-auto mb-2 animate-spin text-dim" />
                        <p className="text-xs text-muted font-mono">Loading call logs…</p>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center">
                        <Phone size={22} className="mx-auto mb-2 text-graphite" strokeWidth={1.75} />
                        <p className="text-sm text-ink font-medium">No call logs found</p>
                        <p className="text-xs text-muted mt-1">Make a call or adjust the filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((call) => (
                      <tr key={call.id}>
                        <td>
                          {call.direction === 'INBOUND' ? (
                            <PhoneIncoming size={14} className="text-emerald" />
                          ) : (
                            <PhoneOutgoing size={14} className="text-amber" />
                          )}
                        </td>
                        <td>
                          <div className="font-display text-sm text-ink">{call.callerName || 'Unknown'}</div>
                          <div className="font-mono text-[11px] text-dim">{call.callerNumber || '—'}</div>
                        </td>
                        <td className="text-xs text-muted max-w-[280px] truncate">{call.transcript || '—'}</td>
                        <td><HandlerBadge handler={call.handler} /></td>
                        <td><StatusBadge status={call.status} /></td>
                        <td className="font-mono text-[11px] text-dim">{formatDuration(call.duration)}</td>
                        <td>
                          {call.linkedIncidentId ? (
                            <Link
                              to={`/incidents/${call.linkedIncidentId}`}
                              className="text-[11px] text-signal font-mono inline-flex items-center gap-1 hover:underline"
                            >
                              <ExternalLink size={12} />
                              Incident
                            </Link>
                          ) : (
                            <span className="text-[10px] text-dim">—</span>
                          )}
                        </td>
                        <td className="text-[11px] text-dim font-mono whitespace-nowrap">
                          {new Date(call.createdAt).toLocaleString()}
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
        </>
      )}
    </Page>
  );
}
