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
  Filter,
  Loader2,
  Play,
  Square,
  Volume2,
  Languages,
  Heart,
  Clock,
  User,
  ExternalLink,
  Send,
  Wifi,
  WifiOff,
  MessageSquare,
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
    <div className="glass-card border-violet-100 overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 400px)', minHeight: '500px' }}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-stone-900">Santhira AI Agent</h3>
            <p className="text-[10px] text-stone-400">GPT-4.1 &middot; Real-time voice &middot; ITSM tools</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            value={agentLang}
            onChange={e => { setAgentLang(e.target.value); setMessages([{ id: 'welcome', role: 'assistant', text: "Language changed. Starting new session...", timestamp: new Date() }]); }}
            className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-[11px] font-mono text-stone-700 focus:outline-none focus:border-violet-300"
          >
            {AGENT_LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>

          {/* Status */}
          <div className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border',
            isConnected
              ? 'border-emerald-200 bg-emerald-50 text-emerald'
              : 'border-red-200 bg-red-50 text-crimson'
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
            <div className={clsx(
              'max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-signal text-white rounded-br-sm'
                : msg.role === 'system'
                ? 'bg-red-50 text-crimson border border-red-200 rounded-bl-sm'
                : 'bg-stone-100 text-stone-800 border border-stone-200 rounded-bl-sm'
            )}>
              <div className={clsx(
                'text-[10px] font-mono font-medium uppercase tracking-wider mb-1',
                msg.role === 'user' ? 'text-ink/60' : msg.role === 'system' ? 'text-crimson/60' : 'text-stone-400'
              )}>
                {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'Santhira'}
              </div>
              <span className="whitespace-pre-wrap">{msg.text}</span>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-stone-100 border border-stone-200 rounded-xl rounded-bl-sm px-4 py-2.5 text-sm text-stone-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="italic">{processingText || 'Processing...'}</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-stone-200 bg-stone-50/50 px-5 py-3 flex items-center gap-3">
        {/* Text Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
            placeholder="Type a message or use the mic..."
            disabled={!isConnected || isRecording}
            className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 disabled:opacity-50 transition-all"
          />
        </div>

        {/* Send Text */}
        <button
          onClick={handleSendText}
          disabled={!isConnected || !textInput.trim() || isRecording}
          className="w-10 h-10 rounded-xl bg-signal text-white flex items-center justify-center hover:bg-[#4338CA] disabled:opacity-30 transition-all"
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
              ? 'bg-crimson text-white animate-pulse shadow-lg shadow-red-200'
              : 'bg-violet text-white hover:bg-[#6D28D9] shadow-lg shadow-violet-200'
          )}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

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
    signal: { border: 'border-[color:var(--argus-signal)]/25', icon: 'text-signal', bg: 'bg-[color:var(--argus-signal-dim)]' },
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

function HandlerBadge({ handler }: { handler: VoiceHandler }) {
  const cls: Record<VoiceHandler, string> = {
    AI_BOT: 'bg-violet-50 text-violet border-violet-200',
    HUMAN: 'bg-[color:var(--argus-signal-dim)] text-signal border-[color:var(--argus-signal)]/25',
    IVR: 'bg-amber-50 text-amber border-amber-200',
  };
  const icons: Record<VoiceHandler, React.ComponentType<{ className?: string }>> = {
    AI_BOT: Bot,
    HUMAN: User,
    IVR: Phone,
  };
  const IconComp = icons[handler];
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border', cls[handler])}>
      <IconComp className="w-3 h-3" />
      {handler.replace('_', ' ')}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-stone-300">-</span>;
  const s = status.toLowerCase();
  const cls =
    s === 'completed' ? 'bg-emerald-50 text-emerald border-emerald-200' :
    s === 'in-progress' || s === 'ringing' ? 'bg-amber-50 text-amber border-amber-200' :
    s === 'failed' || s === 'busy' || s === 'no-answer' ? 'bg-red-50 text-crimson border-red-200' :
    'bg-stone-100 text-stone-500 border-stone-200';
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border', cls)}>
      {status}
    </span>
  );
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

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-obsidian text-ink border border-[color:var(--argus-border)] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-[color:var(--argus-elevated)] flex items-center justify-center">
                  <Mic size={16} className="text-violet-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Voice Gateway</h1>
              </div>
              <p className="text-slate-400 text-sm ml-[42px]">
                Multilingual voice AI &middot; STT + TTS + IVR &middot; <span className="font-mono text-slate-300">{stats?.total ?? 0}</span> total calls
              </p>
            </div>
            <div className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
              voiceHealth?.healthy
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/20 bg-red-500/10 text-red-400'
            )}>
              <Heart className="w-3.5 h-3.5" />
              <span className="font-mono">Voice Server: {voiceHealth?.healthy ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-violet-500/60 to-transparent -mt-5 mb-4" />

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard icon={Phone} label="Total Calls" value={stats?.total ?? 0} color="signal" />
        <StatsCard icon={PhoneIncoming} label="Inbound" value={stats?.inbound ?? 0} color="emerald" />
        <StatsCard icon={PhoneOutgoing} label="Outbound" value={stats?.outbound ?? 0} color="amber" />
        <StatsCard icon={Bot} label="AI Handled" value={stats?.aiHandled ?? 0} color="violet" />
        <StatsCard icon={Clock} label="Avg Duration" value={formatDuration(stats?.averageDurationSeconds ?? 0)} color="signal" />
      </div>

      {/* Language Selector */}
      {languages.length > 0 && (
        <div className="glass-card p-4 border-stone-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-stone-500">
              <Languages className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Language</span>
            </div>
            <div className="flex gap-2">
              {languages.map((lang: { code: string; name: string }) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                    selectedLanguage === lang.code
                      ? 'border-[color:var(--argus-signal)]/25 bg-[color:var(--argus-signal-dim)] text-signal'
                      : 'border-stone-200 text-stone-400 hover:text-stone-700 hover:border-stone-300'
                  )}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="glass-card p-1 border-stone-200 inline-flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-[color:var(--argus-signal-dim)] text-signal border border-[color:var(--argus-signal)]/25'
                : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100 border border-transparent'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content: AI Agent */}
      {activeTab === 'agent' && <AIAgentTab />}

      {/* Tab Content: Transcribe */}
      {activeTab === 'transcribe' && (
        <div className="glass-card p-6 border-indigo-100 space-y-5 animate-fade-in">
          <h3 className="text-sm font-display font-bold text-stone-900 flex items-center gap-2">
            <Mic className="w-4 h-4 text-signal" />
            Speech-to-Text (Whisper STT)
          </h3>

          <div className="flex flex-col items-center gap-4">
            {/* Record button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={transcribe.isPending}
              className={clsx(
                'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300',
                isRecording
                  ? 'bg-red-50 border-2 border-crimson animate-pulse'
                  : 'bg-[color:var(--argus-signal-dim)] border-2 border-[color:var(--argus-signal)]/25 hover:border-signal hover:bg-indigo-100'
              )}
            >
              {transcribe.isPending ? (
                <Loader2 className="w-8 h-8 text-signal animate-spin" />
              ) : isRecording ? (
                <Square className="w-8 h-8 text-crimson" />
              ) : (
                <Mic className="w-8 h-8 text-signal" />
              )}
            </button>
            <p className="text-xs text-stone-400">
              {isRecording ? 'Recording... Click to stop' : transcribe.isPending ? 'Transcribing...' : 'Click to record or upload a file'}
            </p>

            {/* File upload */}
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileTranscribe}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={transcribe.isPending}
                className="btn-ghost px-4 py-2 text-xs disabled:opacity-50"
              >
                Upload Audio File
              </button>
            </div>

            {/* Result */}
            {transcriptionResult && (
              <div className="w-full mt-4 p-4 rounded-lg bg-stone-50 border border-stone-200">
                <p className="text-xs text-stone-400 mb-1 font-semibold uppercase tracking-wider">Transcription Result</p>
                <p className="text-sm text-stone-900 leading-relaxed">{transcriptionResult}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Synthesize */}
      {activeTab === 'synthesize' && (
        <div className="glass-card p-6 border-indigo-100 space-y-5 animate-fade-in">
          <h3 className="text-sm font-display font-bold text-stone-900 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-signal" />
            Text-to-Speech (XTTS v2)
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-stone-500 font-medium mb-1 block">Text to Speak</label>
              <textarea
                value={synthesizeText}
                onChange={(e) => setSynthesizeText(e.target.value)}
                placeholder="Enter text to convert to speech..."
                rows={4}
                className="input-field w-full text-sm resize-none"
              />
            </div>
            <button
              onClick={handleSynthesize}
              disabled={synthesize.isPending}
              className="btn-primary px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {synthesize.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {synthesize.isPending ? 'Generating...' : 'Speak'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Make Call */}
      {activeTab === 'call' && (
        <div className="glass-card p-6 border-indigo-100 space-y-5 animate-fade-in">
          <h3 className="text-sm font-display font-bold text-stone-900 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-signal" />
            Outbound Call (Twilio IVR)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-stone-500 font-medium mb-1 block">Phone Number</label>
              <input
                type="tel"
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="+919876543210"
                className="input-field w-full text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleMakeCall}
                disabled={makeCall.isPending}
                className="btn-primary px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {makeCall.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PhoneCall className="w-4 h-4" />
                )}
                {makeCall.isPending ? 'Calling...' : 'Initiate Call'}
              </button>
            </div>
          </div>
          <p className="text-xs text-stone-300">
            Calls use Twilio IVR. The recipient will hear an automated greeting and can interact via DTMF or speech.
          </p>
        </div>
      )}

      {/* Tab Content: Call Logs */}
      {activeTab === 'logs' && (
        <>
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
                <option value="INBOUND">Inbound</option>
                <option value="OUTBOUND">Outbound</option>
              </select>

              <select
                value={handlerFilter}
                onChange={(e) => { setHandlerFilter(e.target.value); setPage(1); }}
                className={`filter-select ${handlerFilter !== 'ALL' ? 'filter-select--active' : ''}`}
              >
                <option value="ALL">All Handlers</option>
                <option value="AI_BOT">AI Bot</option>
                <option value="HUMAN">Human</option>
                <option value="IVR">IVR</option>
              </select>

              <div className="w-px h-7 bg-stone-200/60 hidden sm:block" />

              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by caller, transcript, or call SID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50/80 border border-stone-200/80 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Loading State */}
          {logsLoading && (
            <div className="glass-card p-12 text-center">
              <Loader2 className="w-8 h-8 text-signal mx-auto mb-3 animate-spin" />
              <p className="text-stone-500 font-medium">Loading call logs...</p>
            </div>
          )}

          {/* Call Logs */}
          {!logsLoading && (
            <div className="space-y-3">
              {filteredLogs.length === 0 && (
                <div className="glass-card p-12 text-center">
                  <Phone className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500 font-medium">No call logs found</p>
                  <p className="text-stone-300 text-sm mt-1">Make a call or adjust filters</p>
                </div>
              )}

              {filteredLogs.map((call) => (
                <div
                  key={call.id}
                  className="glass-card p-5 transition-all duration-300 hover:scale-[1.005] group border-stone-200 hover:border-[color:var(--argus-signal)]/25"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0">
                      {call.direction === 'INBOUND' ? (
                        <div className="p-2 rounded-xl bg-emerald-50">
                          <PhoneIncoming className="w-4 h-4 text-emerald" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-amber-50">
                          <PhoneOutgoing className="w-4 h-4 text-amber" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-display font-bold text-stone-900">
                          {call.callerName || call.callerNumber || 'Unknown'}
                        </span>
                        <StatusBadge status={call.status} />
                        <HandlerBadge handler={call.handler} />
                      </div>

                      {call.transcript && (
                        <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-relaxed">
                          {call.transcript}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {call.callerNumber && (
                          <span className="text-[11px] text-stone-400 font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3 text-stone-300" />
                            {call.callerNumber}
                          </span>
                        )}
                        {call.duration != null && (
                          <span className="text-[11px] text-stone-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-300" />
                            {formatDuration(call.duration)}
                          </span>
                        )}
                        {call.language && (
                          <span className="text-[11px] text-stone-400 font-mono flex items-center gap-1">
                            <Languages className="w-3 h-3 text-stone-300" />
                            {call.language.toUpperCase()}
                          </span>
                        )}
                        <span className="text-[11px] text-stone-400 font-mono">
                          {new Date(call.createdAt).toLocaleString()}
                        </span>
                        {call.callSid && (
                          <span className="text-[10px] text-stone-300 font-mono">
                            SID: {call.callSid.substring(0, 16)}...
                          </span>
                        )}
                        {call.linkedIncidentId && (
                          <Link
                            to={`/incidents/${call.linkedIncidentId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-signal font-mono flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Incident
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between glass-card px-4 py-3 border-stone-200">
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
        </>
      )}
    </div>
  );
}
