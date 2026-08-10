import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Maximize2, Minimize2, RefreshCw, Wifi, WifiOff,
  Radio, Zap, Users, Shield, AlertTriangle, Activity,
  Server, ChevronRight, Eye,
} from 'lucide-react';
import api from '../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Alert {
  id: string; name: string; severity: string; status: string;
  labels?: string; createdAt: string;
  organizationId?: string; organization?: { id: string; name: string; slug?: string };
}
interface OnCallSchedule {
  id: string; isPrimary: boolean;
  user: { firstName: string; lastName: string };
  team: { name: string };
}
interface IncidentStat { total: number; open: number; critical: number; }

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseInstance(alert: Alert): string {
  if (!alert.labels) return '';
  try {
    const parsed = typeof alert.labels === 'string' ? JSON.parse(alert.labels) : alert.labels;
    return (parsed.instance || '').split(':')[0] || '';
  } catch { return ''; }
}

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  return `${Math.floor(d / 3600)}h`;
}

function clockTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
function clockDate() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Design tokens ─────────────────────────────────────────────────────────────
// Background layering: base #061220 → panels #0D1F35 → cards #112338
const BG_BASE   = '#061220';   // deepest navy — page background
const BG_PANEL  = '#0B1A2E';   // panel background
const BG_CARD   = '#0F2035';   // card surface
const BG_HOVER  = '#142843';   // hover state
const BORDER    = 'rgba(99,179,255,0.08)';  // subtle blue border
const BORDER_LT = 'rgba(99,179,255,0.15)';  // brighter border for accents
const TEXT_PRI  = '#E2EEF9';   // primary text
const TEXT_SEC  = '#6B8FAD';   // secondary text
const TEXT_DIM  = '#2E4A63';   // dimmed text

const SEV = {
  CRITICAL: { color: '#FF4D6A', glow: 'rgba(255,77,106,0.35)', bg: 'rgba(255,77,106,0.08)', border: 'rgba(255,77,106,0.22)', label: 'CRIT' },
  WARNING:  { color: '#FFA726', glow: 'rgba(255,167,38,0.30)', bg: 'rgba(255,167,38,0.07)', border: 'rgba(255,167,38,0.20)', label: 'WARN' },
  INFO:     { color: '#4FC3F7', glow: 'rgba(79,195,247,0.25)', bg: 'rgba(79,195,247,0.07)', border: 'rgba(79,195,247,0.18)', label: 'INFO' },
} as const;
type SevKey = keyof typeof SEV;

// ── SAS Ring ──────────────────────────────────────────────────────────────────
const R = 72, CIRC = 2 * Math.PI * R;
function SASRing({ score }: { score: number }) {
  const color  = score >= 75 ? '#00E5A0' : score >= 45 ? '#FFA726' : '#FF4D6A';
  const glow   = score >= 75 ? 'rgba(0,229,160,0.4)' : score >= 45 ? 'rgba(255,167,38,0.4)' : 'rgba(255,77,106,0.4)';
  const label  = score >= 75 ? 'NOMINAL' : score >= 45 ? 'ELEVATED' : 'CRITICAL';
  const filled = (score / 100) * CIRC;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 175, height: 175 }}>
      {/* Outer ambient ring */}
      <div className="absolute inset-0 rounded-full" style={{
        background: `radial-gradient(circle at center, ${glow} 0%, transparent 70%)`,
        opacity: 0.3,
      }} />
      <svg width="175" height="175" viewBox="0 0 175 175">
        {/* Track */}
        <circle cx="87.5" cy="87.5" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
        {/* Fill */}
        <circle cx="87.5" cy="87.5" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC - filled}`}
          transform="rotate(-90 87.5 87.5)"
          style={{ filter: `drop-shadow(0 0 10px ${color})`, transition: 'stroke-dasharray 1.5s ease, stroke 0.6s ease' }}
        />
        {/* Tick marks */}
        {[0, 25, 50, 75].map(v => {
          const a = ((v / 100) * 360 - 90) * (Math.PI / 180);
          const ix = 87.5 + (R + 15) * Math.cos(a), iy = 87.5 + (R + 15) * Math.sin(a);
          const ox = 87.5 + (R + 19) * Math.cos(a), oy = 87.5 + (R + 19) * Math.sin(a);
          return <line key={v} x1={ix} y1={iy} x2={ox} y2={oy} stroke={TEXT_DIM} strokeWidth="1.5" />;
        })}
      </svg>
      <div className="absolute flex flex-col items-center justify-center gap-0.5">
        <span className="text-[7px] font-mono font-black tracking-[0.25em]" style={{ color: `${color}60` }}>SAS INDEX</span>
        <span className="font-black tabular-nums leading-none" style={{
          fontSize: 48, color, fontFamily: 'JetBrains Mono, monospace',
          textShadow: `0 0 24px ${glow}`,
        }}>{score}</span>
        <span className="text-[8px] font-black tracking-[0.18em] px-2 py-0.5 rounded"
          style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>{label}</span>
      </div>
    </div>
  );
}

// ── Sev Counter ───────────────────────────────────────────────────────────────
function SevCounter({ sev, count, icon: Icon }: { sev: SevKey; count: number; icon: React.ElementType }) {
  const cfg = SEV[sev];
  return (
    <div className="flex flex-col items-center py-3.5 rounded-xl relative overflow-hidden"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {count > 0 && <div className="absolute top-0 inset-x-0 h-px" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />}
      <Icon className="w-3.5 h-3.5 mb-2" style={{ color: cfg.color }} />
      <span className="text-[24px] font-black tabular-nums leading-none mb-0.5" style={{
        color: cfg.color,
        textShadow: count > 0 ? `0 0 20px ${cfg.glow}` : 'none',
        fontFamily: 'JetBrains Mono, monospace',
      }}>{count}</span>
      <span className="text-[7px] font-black tracking-[0.18em]" style={{ color: `${cfg.color}60` }}>{cfg.label}</span>
    </div>
  );
}

// ── Org Card ──────────────────────────────────────────────────────────────────
function OrgCard({ name, critical, warning, info }: {
  name: string; critical: number; warning: number; info: number;
}) {
  const total = critical + warning + info;
  const hasCrit = critical > 0;
  const hasWarn = warning > 0;
  const statusColor = hasCrit ? '#FF4D6A' : hasWarn ? '#FFA726' : '#00E5A0';
  const bg = hasCrit ? 'rgba(255,77,106,0.06)' : hasWarn ? 'rgba(255,167,38,0.05)' : 'rgba(0,229,160,0.04)';
  const border = hasCrit ? 'rgba(255,77,106,0.22)' : hasWarn ? 'rgba(255,167,38,0.16)' : 'rgba(0,229,160,0.10)';

  return (
    <div className="rounded-lg px-2.5 py-2 relative overflow-hidden"
      style={{ background: bg, border: `1px solid ${border}` }}>
      {hasCrit && (
        <div className="absolute top-0 left-0 w-full h-0.5"
          style={{ background: '#FF4D6A', boxShadow: '0 0 6px rgba(255,77,106,0.6)' }} />
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: statusColor, boxShadow: hasCrit ? `0 0 5px ${statusColor}` : 'none' }} />
          <span className="text-[10px] font-semibold truncate" style={{ color: TEXT_PRI }}>{name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {critical > 0 && <span className="text-[9px] font-black tabular-nums" style={{ color: '#FF4D6A' }}>{critical}C</span>}
          {warning  > 0 && <span className="text-[9px] font-black tabular-nums" style={{ color: '#FFA726' }}>{warning}W</span>}
          {info     > 0 && <span className="text-[9px] font-black tabular-nums" style={{ color: '#4FC3F7' }}>{info}I</span>}
          {total === 0  && <span className="text-[9px] font-bold" style={{ color: '#00E5A0' }}>OK</span>}
        </div>
      </div>
    </div>
  );
}

// ── Panel Header ──────────────────────────────────────────────────────────────
function PanelHeader({ icon: Icon, title, right, iconColor = '#4FC3F7' }: {
  icon: React.ElementType; title: string; right?: React.ReactNode; iconColor?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 shrink-0"
      style={{ borderBottom: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.25)' }}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3" style={{ color: iconColor }} />
        <span className="text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: TEXT_SEC }}>{title}</span>
      </div>
      {right && <span className="text-[9px] font-mono" style={{ color: TEXT_DIM }}>{right}</span>}
    </div>
  );
}

// ── Main NOC View ──────────────────────────────────────────────────────────────
export default function NOCView() {
  const [fullscreen, setFullscreen] = useState(false);
  const [tick, setTick] = useState(0);
  const [, setTimeTick] = useState(0);

  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setTimeTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const { data: alertResp, isLoading } = useQuery({
    queryKey: ['noc-alerts', tick],
    queryFn: () => api.get('/alerts?limit=500&status=FIRING').then(r => r.data),
    staleTime: 25000,
  });
  const { data: oncallResp } = useQuery({
    queryKey: ['noc-oncall', tick],
    queryFn: () => api.get('/teams/on-call/overview').then(r => r.data),
    staleTime: 30000,
  });
  const { data: incidentResp } = useQuery({
    queryKey: ['noc-incidents', tick],
    queryFn: () => api.get('/incidents?state=OPEN&limit=100').then(r => r.data),
    staleTime: 30000,
  });

  const alerts: Alert[] = alertResp?.data || [];
  const schedules: OnCallSchedule[] = oncallResp?.data?.schedules || [];
  const oncallStats = oncallResp?.data?.stats || {};
  const incidents = incidentResp?.data || [];
  const p1Incidents = incidents.filter((i: any) => i.priority === 'P1').length;

  const critical = alerts.filter(a => a.severity === 'CRITICAL');
  const warning  = alerts.filter(a => a.severity === 'WARNING');
  const info     = alerts.filter(a => !['CRITICAL','WARNING'].includes(a.severity));
  const orgsAffected = new Set(alerts.map(a => a.organizationId).filter(Boolean)).size;
  const sas = Math.max(0, Math.round(100 - critical.length * 5 - warning.length * 1.5 - orgsAffected * 2));

  const byOrg = useMemo(() => {
    const map = new Map<string, { name: string; critical: number; warning: number; info: number }>();
    alerts.forEach(a => {
      const key = a.organizationId || 'unknown';
      if (!map.has(key)) map.set(key, { name: a.organization?.name || key.slice(0, 12), critical: 0, warning: 0, info: 0 });
      const e = map.get(key)!;
      if (a.severity === 'CRITICAL') e.critical++;
      else if (a.severity === 'WARNING') e.warning++;
      else e.info++;
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v, total: v.critical + v.warning + v.info }))
      .sort((a, b) => b.critical - a.critical || b.total - a.total);
  }, [alerts]);

  const cascades = useMemo(() => {
    const tenMin = Date.now() - 10 * 60 * 1000;
    const byInst: Record<string, Alert[]> = {};
    alerts.filter(a => new Date(a.createdAt).getTime() > tenMin)
      .forEach(a => { const inst = parseInstance(a); if (!inst) return; (byInst[inst] = byInst[inst] || []).push(a); });
    return Object.entries(byInst).filter(([, l]) => l.length >= 3).sort(([, a], [, b]) => b.length - a.length).slice(0, 4);
  }, [alerts]);

  const liveFeed = useMemo(() =>
    [...alerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50),
  [alerts]);

  // 12-bucket sparkline (last 60 min, 5-min slots)
  const nowTs = Date.now();
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const s = nowTs - (12 - i) * 5 * 60 * 1000, e = s + 5 * 60 * 1000;
    return critical.filter(a => { const t = new Date(a.createdAt).getTime(); return t >= s && t <= e; }).length;
  });
  const maxB = Math.max(...buckets, 1);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen?.(); setFullscreen(true); }
    else { document.exitFullscreen?.(); setFullscreen(false); }
  }, []);

  const systemOK = critical.length === 0 && warning.length === 0;

  return (
    <>
      <style>{`
        @keyframes noc-ticker   { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes noc-blink    { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes noc-scanline { 0% { transform: translateY(-100%) } 100% { transform: translateY(100vh) } }
        @keyframes noc-fadein   { from { opacity:0; transform: translateY(4px) } to { opacity:1; transform: none } }
        .noc-ticker-inner { animation: noc-ticker 90s linear infinite; will-change: transform; }
        .noc-blink { animation: noc-blink 2s ease-in-out infinite; }
        .noc-row-in { animation: noc-fadein 0.3s ease both; }
      `}</style>

      <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50' : '-m-6'}`}
        style={{
          background: `linear-gradient(160deg, ${BG_BASE} 0%, #081828 50%, #061018 100%)`,
          minHeight: fullscreen ? '100vh' : 'calc(100vh - 56px)',
          fontFamily: 'JetBrains Mono, monospace',
          color: TEXT_PRI,
          position: 'relative',
        }}>

        {/* Grid texture overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'linear-gradient(rgba(99,179,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Ambient corner glows */}
        <div className="pointer-events-none absolute top-0 left-0 w-96 h-96 opacity-10"
          style={{ background: 'radial-gradient(circle at top left, #1565C0, transparent 70%)' }} />
        <div className="pointer-events-none absolute bottom-0 right-0 w-96 h-96 opacity-8"
          style={{ background: 'radial-gradient(circle at bottom right, #0D3B66, transparent 70%)' }} />

        {/* ══ TOP BAR ══ */}
        <div className="relative flex items-center justify-between px-5 h-11 shrink-0 z-10"
          style={{ borderBottom: `1px solid ${BORDER_LT}`, background: 'rgba(6,18,32,0.85)', backdropFilter: 'blur(8px)' }}>

          {/* Left: branding */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4" style={{ color: '#4FC3F7' }} />
              <span className="text-[12px] font-black tracking-[0.25em] uppercase" style={{ color: 'var(--argus-ink)' }}>WeCrew NOC</span>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                background: systemOK ? 'rgba(0,229,160,0.12)' : 'rgba(255,77,106,0.12)',
                color: systemOK ? '#00E5A0' : '#FF4D6A',
                border: `1px solid ${systemOK ? 'rgba(0,229,160,0.3)' : 'rgba(255,77,106,0.3)'}`,
              }}>
                {systemOK ? 'ALL CLEAR' : `${alerts.length} FIRING`}
              </span>
            </div>
            <div style={{ width: 1, height: 16, background: BORDER_LT }} />
            <div className="flex items-center gap-3 text-[9px]" style={{ color: TEXT_SEC }}>
              <span><span className="font-black" style={{ color: '#FF4D6A' }}>{critical.length}</span> CRIT</span>
              <span><span className="font-black" style={{ color: '#FFA726' }}>{warning.length}</span> WARN</span>
              <span><span className="font-black" style={{ color: '#4FC3F7' }}>{info.length}</span> INFO</span>
            </div>
            {cascades.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full noc-blink"
                style={{ background: 'rgba(255,77,106,0.12)', border: '1px solid rgba(255,77,106,0.35)' }}>
                <Zap className="w-3 h-3" style={{ color: '#FF4D6A' }} />
                <span className="text-[9px] font-black tracking-widest" style={{ color: '#FF4D6A' }}>
                  CASCADE STORM · {cascades.length}
                </span>
              </div>
            )}
          </div>

          {/* Right: clock + controls */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[13px] font-black tabular-nums" style={{ color: TEXT_PRI, letterSpacing: '0.05em' }}>{clockTime()}</div>
              <div className="text-[8px]" style={{ color: TEXT_DIM }}>{clockDate()}</div>
            </div>
            <div style={{ width: 1, height: 20, background: BORDER }} />
            {isLoading
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: TEXT_SEC }} />
              : <Wifi className="w-3.5 h-3.5" style={{ color: '#00E5A0' }} />}
            <button onClick={toggleFullscreen} className="p-1 rounded transition-colors"
              style={{ color: TEXT_SEC }} onMouseEnter={e => (e.currentTarget.style.color = TEXT_PRI)}
              onMouseLeave={e => (e.currentTarget.style.color = TEXT_SEC)}>
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ══ MAIN 12-COL GRID ══ */}
        <div className="relative flex-1 grid grid-cols-12 gap-0 min-h-0 overflow-hidden z-10">

          {/* ─── LEFT: SAS + Counters + Stats (col 1-3) ─── */}
          <div className="col-span-3 flex flex-col overflow-hidden" style={{ borderRight: `1px solid ${BORDER}` }}>

            {/* SAS Ring */}
            <div className="flex items-center justify-center py-5 shrink-0"
              style={{ borderBottom: `1px solid ${BORDER}` }}>
              <SASRing score={sas} />
            </div>

            {/* Severity counters */}
            <div className="grid grid-cols-3 gap-2 px-3 py-3 shrink-0"
              style={{ borderBottom: `1px solid ${BORDER}` }}>
              <SevCounter sev="CRITICAL" count={critical.length} icon={AlertTriangle} />
              <SevCounter sev="WARNING"  count={warning.length}  icon={Activity} />
              <SevCounter sev="INFO"     count={info.length}     icon={Shield} />
            </div>

            {/* Stat rows */}
            <div className="px-3 py-3 space-y-1.5 shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
              {[
                { icon: Server,        label: 'Orgs Affected',    val: orgsAffected,                     color: '#4FC3F7' },
                { icon: AlertTriangle, label: 'Open Incidents',   val: incidents.length,                  color: '#FF4D6A' },
                { icon: AlertTriangle, label: 'P1 Active',        val: p1Incidents,                       color: '#FF4D6A' },
                { icon: Users,         label: 'On-Call Responders', val: oncallStats.activeResponders || 0, color: '#00E5A0' },
                { icon: Shield,        label: 'Teams Covered',    val: oncallStats.teamsCovered || 0,     color: '#FFA726' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = BG_HOVER)}
                  onMouseLeave={e => (e.currentTarget.style.background = BG_CARD)}>
                  <div className="flex items-center gap-2">
                    <s.icon className="w-3 h-3" style={{ color: `${s.color}60` }} />
                    <span className="text-[9px] uppercase tracking-wider" style={{ color: TEXT_SEC }}>{s.label}</span>
                  </div>
                  <span className="text-[16px] font-black tabular-nums" style={{ color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>{s.val}</span>
                </div>
              ))}
            </div>

            {/* Sparkline: critical/5min last hour */}
            <div className="px-3 py-3 mt-auto shrink-0">
              <div className="rounded-xl p-3" style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
                <span className="block text-[7px] font-bold tracking-widest uppercase mb-2" style={{ color: TEXT_DIM }}>
                  Critical / 5 min · last 60 min
                </span>
                <div className="flex items-end gap-0.5 h-8">
                  {buckets.map((b, i) => (
                    <div key={i} className="flex-1 rounded-sm transition-all duration-500"
                      title={`${b} critical`}
                      style={{
                        height: `${Math.max((b / maxB) * 100, 8)}%`,
                        background: b > 0 ? `rgba(255,77,106,${0.3 + (b / maxB) * 0.65})` : 'rgba(255,77,106,0.06)',
                        boxShadow: b > 0 ? '0 0 4px rgba(255,77,106,0.3)' : 'none',
                      }} />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[7px]" style={{ color: TEXT_DIM }}>-60m</span>
                  <span className="text-[7px]" style={{ color: TEXT_DIM }}>now</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── CENTER: Live Alert Feed (col 4-9) ─── */}
          <div className="col-span-6 flex flex-col overflow-hidden" style={{ borderRight: `1px solid ${BORDER}` }}>

            {/* Cascade storm banner */}
            {cascades.length > 0 && (
              <div className="px-4 py-2.5 shrink-0"
                style={{ borderBottom: `1px solid rgba(255,77,106,0.2)`, background: 'rgba(255,77,106,0.05)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5" style={{ color: '#FF4D6A' }} />
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#FF4D6A' }}>
                    Active Cascade Storms
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {cascades.map(([inst, list]) => (
                    <div key={inst} className="flex items-center gap-2 px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.22)' }}>
                      <span className="text-[10px] font-mono truncate max-w-[180px]" style={{ color: '#FFCDD2' }}>{inst}</span>
                      <span className="text-[10px] font-black" style={{ color: '#FF4D6A' }}>{list.length}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feed header */}
            <div className="px-4 py-2 shrink-0 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 noc-blink" style={{ color: '#FF4D6A' }} />
                <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: TEXT_SEC }}>Live Alert Feed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono" style={{ color: TEXT_DIM }}>{alerts.length} firing</span>
              </div>
            </div>

            {/* Feed rows */}
            <div className="flex-1 overflow-y-auto">
              {liveFeed.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <WifiOff className="w-9 h-9" style={{ color: TEXT_DIM }} />
                  <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: '#00E5A0' }}>All Systems Operational</span>
                  <span className="text-[9px]" style={{ color: TEXT_DIM }}>No firing alerts</span>
                </div>
              ) : (
                <div>
                  {/* Column headers */}
                  <div className="grid px-4 py-1.5 text-[7px] font-black tracking-[0.15em] uppercase sticky top-0"
                    style={{ background: BG_PANEL, borderBottom: `1px solid ${BORDER}`, color: TEXT_DIM,
                      gridTemplateColumns: '6px 1fr 120px 70px 48px' }}>
                    <span />
                    <span>Alert Name</span>
                    <span>Organization</span>
                    <span>Instance</span>
                    <span className="text-right">Age</span>
                  </div>
                  {liveFeed.map((alert, idx) => {
                    const cfg = SEV[alert.severity as SevKey] || SEV.INFO;
                    const inst = parseInstance(alert);
                    return (
                      <div key={alert.id} className="noc-row-in"
                        style={{ animationDelay: `${Math.min(idx * 20, 400)}ms` }}>
                        <div className="grid px-4 py-2 items-center transition-colors cursor-default"
                          style={{
                            borderBottom: `1px solid ${BORDER}`,
                            gridTemplateColumns: '6px 1fr 120px 70px 48px',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = BG_HOVER)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {/* Severity stripe */}
                          <div className="w-1 h-5 rounded-full mr-3"
                            style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.glow}` }} />
                          {/* Name */}
                          <div className="min-w-0 pr-3">
                            <span className="text-[11px] font-semibold truncate block" style={{ color: TEXT_PRI }}>{alert.name}</span>
                          </div>
                          {/* Org */}
                          <span className="text-[10px] truncate pr-2" style={{ color: TEXT_SEC }}>
                            {alert.organization?.name || '—'}
                          </span>
                          {/* Instance */}
                          <span className="text-[9px] font-mono truncate pr-2" style={{ color: TEXT_DIM }}>{inst || '—'}</span>
                          {/* Age + badge */}
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                              {cfg.label}
                            </span>
                            <span className="text-[8px] font-mono" style={{ color: TEXT_DIM }}>{relTime(alert.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT: Org Health + On-Call (col 10-12) ─── */}
          <div className="col-span-3 flex flex-col overflow-hidden">

            {/* Org Health */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <PanelHeader icon={Server} title="Org Health Matrix" iconColor="#4FC3F7" right={`${byOrg.length} orgs`} />
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {byOrg.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)' }}>
                      <Shield className="w-5 h-5" style={{ color: '#00E5A0' }} />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#00E5A0' }}>All Clear</span>
                  </div>
                ) : (
                  byOrg.map(org => (
                    <OrgCard key={org.id} name={org.name} critical={org.critical} warning={org.warning} info={org.info} />
                  ))
                )}
              </div>
            </div>

            {/* On-Call */}
            <div className="shrink-0 flex flex-col" style={{ maxHeight: '42%' }}>
              <PanelHeader icon={Users} title="On-Call Now" iconColor="#00E5A0"
                right={<span style={{ color: (oncallStats.activeResponders || 0) > 0 ? '#00E5A0' : '#FF4D6A' }}>
                  {oncallStats.activeResponders || 0} active
                </span>} />
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {schedules.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <span className="text-[9px]" style={{ color: TEXT_DIM }}>No active schedules</span>
                  </div>
                ) : (
                  schedules.slice(0, 8).map(s => (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors"
                      style={{
                        background: s.isPrimary ? 'rgba(0,229,160,0.05)' : BG_CARD,
                        border: `1px solid ${s.isPrimary ? 'rgba(0,229,160,0.18)' : BORDER}`,
                      }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black shrink-0"
                        style={{
                          background: s.isPrimary ? 'rgba(0,229,160,0.18)' : 'rgba(255,255,255,0.06)',
                          color: s.isPrimary ? '#00E5A0' : TEXT_SEC,
                        }}>
                        {s.user.firstName[0]}{s.user.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-semibold truncate" style={{ color: TEXT_PRI }}>
                          {s.user.firstName} {s.user.lastName}
                        </div>
                        <div className="text-[8px] truncate" style={{ color: TEXT_DIM }}>{s.team.name}</div>
                      </div>
                      {s.isPrimary && (
                        <span className="text-[7px] font-black px-1 py-0.5 rounded shrink-0"
                          style={{ background: 'rgba(0,229,160,0.12)', color: '#00E5A0', border: '1px solid rgba(0,229,160,0.2)' }}>
                          P
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══ BOTTOM TICKER ══ */}
        <div className="relative flex items-center gap-3 shrink-0 overflow-hidden px-4 h-8 z-10"
          style={{ borderTop: `1px solid ${BORDER_LT}`, background: 'rgba(6,18,32,0.9)' }}>
          <span className="text-[7px] font-black uppercase tracking-widest shrink-0 px-1.5 py-0.5 rounded noc-blink"
            style={{ color: '#FF4D6A', background: 'rgba(255,77,106,0.12)', border: '1px solid rgba(255,77,106,0.3)' }}>
            LIVE
          </span>
          <div className="flex-1 overflow-hidden">
            {liveFeed.length > 0 ? (
              <div className="noc-ticker-inner flex gap-10 whitespace-nowrap">
                {[...liveFeed, ...liveFeed].map((a, i) => {
                  const cfg = SEV[a.severity as SevKey] || SEV.INFO;
                  return (
                    <span key={`${a.id}-${i}`} className="inline-flex items-center gap-1.5 shrink-0">
                      <span className="inline-block w-1 h-1 rounded-full"
                        style={{ background: cfg.color, boxShadow: `0 0 4px ${cfg.glow}` }} />
                      <span className="text-[9px]" style={{ color: TEXT_PRI }}>{a.name}</span>
                      <span className="text-[9px]" style={{ color: TEXT_SEC }}>{a.organization?.name || parseInstance(a) || '—'}</span>
                      <span className="text-[8px] font-bold" style={{ color: `${cfg.color}80` }}>{cfg.label}</span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#00E5A0' }}>
                All systems operational — no active alerts
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
