import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Maximize2, Minimize2, RefreshCw, Wifi,
  Radio, Zap, Users, Shield, AlertTriangle, Activity,
  Server, Eye,
} from 'lucide-react';
import api from '../../lib/api';
import { Page, EnterpriseHero, EnterprisePosture } from '../ui/PageChrome';

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

// ── Palette ───────────────────────────────────────────────────────────────────
// The wallboard is the one surface in Argus that stays dark whatever the theme —
// it is read across a lit room, not at a desk. So it takes the app's own dark
// tokens as literals rather than a private navy scheme: same ink, same coral
// alarm, same Fraunces numerals as every other page, just sized for distance.
const INK          = '#15131f';   // brand ink (--brand-ink) — board background
const PANEL        = '#141820';   // panel background
const CARD         = '#1a1f28';   // card surface
const HOVER        = '#222835';
const LINE         = '#252b36';   // hairline
const LINE_STRONG   = '#2f3644';
const TEXT         = '#f4f1ea';   // brand paper
const TEXT_MUTED   = '#a8a49c';
const TEXT_DIM     = '#6b7689';

const CORAL  = '#ff5b2e';  // brand accent, used here only for alarm
const AMBER  = '#fbbf24';
const BLUE   = '#6b85ff';
const GREEN  = '#34d399';

const DISPLAY = 'Fraunces, Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const BODY = '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';

const SEV = {
  CRITICAL: { color: CORAL, bg: 'rgba(255,91,46,0.10)',  border: 'rgba(255,91,46,0.30)',  label: 'Critical' },
  WARNING:  { color: AMBER, bg: 'rgba(251,191,36,0.09)', border: 'rgba(251,191,36,0.26)', label: 'Warning' },
  INFO:     { color: BLUE,  bg: 'rgba(107,133,255,0.09)', border: 'rgba(107,133,255,0.24)', label: 'Info' },
} as const;
type SevKey = keyof typeof SEV;

// ── Micro-label ───────────────────────────────────────────────────────────────
function Label({ children, color = TEXT_DIM }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9.5, fontWeight: 500,
      letterSpacing: '0.14em', textTransform: 'uppercase', color,
    }}>{children}</span>
  );
}

// ── Posture block ─────────────────────────────────────────────────────────────
// Replaces the glowing gauge. Same score, stated as a numeral and a hairline
// meter — a ring drawn in neon reads no faster from ten metres than a number
// does, and it costs the board its typographic identity.
function Posture({ score }: { score: number }) {
  const color = score >= 75 ? GREEN : score >= 45 ? AMBER : CORAL;
  const label = score >= 75 ? 'Nominal' : score >= 45 ? 'Elevated' : 'Critical';
  return (
    <div className="px-4 py-5" style={{ borderBottom: `1px solid ${LINE}` }}>
      <Label>Service assurance</Label>
      <div className="flex items-baseline gap-3 mt-1.5">
        <span style={{
          fontFamily: DISPLAY, fontSize: 68, fontWeight: 600,
          lineHeight: 0.9, letterSpacing: '-0.03em', color,
        }}>{score}</span>
        <span style={{ fontFamily: BODY, fontSize: 15, color: TEXT_MUTED }}>{label}</span>
      </div>
      <div className="mt-3.5 h-1 rounded-full overflow-hidden" style={{ background: LINE }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(score, 2)}%`, background: color, transition: 'width 1s ease, background 0.6s ease' }}
        />
      </div>
    </div>
  );
}

// ── Severity counter ──────────────────────────────────────────────────────────
function SevCounter({ sev, count }: { sev: SevKey; count: number }) {
  const cfg = SEV[sev];
  const lit = count > 0;
  return (
    <div className="px-3 py-3 rounded" style={{
      background: lit ? cfg.bg : CARD,
      border: `1px solid ${lit ? cfg.border : LINE}`,
    }}>
      <Label color={lit ? cfg.color : TEXT_DIM}>{cfg.label}</Label>
      <div style={{
        fontFamily: DISPLAY, fontSize: 34, fontWeight: 600, lineHeight: 1.05,
        letterSpacing: '-0.02em', color: lit ? cfg.color : TEXT_DIM, marginTop: 2,
      }}>{count}</div>
    </div>
  );
}

// ── Org row ───────────────────────────────────────────────────────────────────
function OrgRow({ name, critical, warning, info }: {
  name: string; critical: number; warning: number; info: number;
}) {
  const statusColor = critical > 0 ? CORAL : warning > 0 ? AMBER : GREEN;
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded" style={{
      background: CARD,
      border: `1px solid ${LINE}`,
      borderLeft: `2px solid ${statusColor}`,
    }}>
      <span className="truncate" style={{ fontFamily: BODY, fontSize: 12.5, color: TEXT }}>{name}</span>
      <span className="flex items-center gap-2 shrink-0" style={{ fontFamily: MONO, fontSize: 11 }}>
        {critical > 0 && <span style={{ color: CORAL }}>{critical}c</span>}
        {warning > 0 && <span style={{ color: AMBER }}>{warning}w</span>}
        {info > 0 && <span style={{ color: BLUE }}>{info}i</span>}
        {critical + warning + info === 0 && <span style={{ color: GREEN }}>clear</span>}
      </span>
    </div>
  );
}

// ── Panel header ──────────────────────────────────────────────────────────────
function PanelHeader({ icon: Icon, title, right }: {
  icon: React.ElementType; title: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 shrink-0"
      style={{ borderBottom: `1px solid ${LINE}`, background: PANEL }}>
      <span className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" style={{ color: TEXT_DIM }} strokeWidth={1.75} />
        <Label color={TEXT_MUTED}>{title}</Label>
      </span>
      {right}
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────
export default function NOCView() {
  const [fullscreen, setFullscreen] = useState(false);
  const [tick, setTick] = useState(0);
  const [, setTimeTick] = useState(0);

  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setTimeTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  // `limit=500` is refused by `validatePagination` (limit is capped at 100), so
  // this returned a 400 and the board showed no firing alerts at all — the one
  // thing a NOC wall exists to show. Walk the pages instead.
  const { data: alertResp, isLoading } = useQuery({
    queryKey: ['noc-alerts', tick],
    queryFn: () => fetchAllPages<Alert>('/alerts', { params: { status: 'FIRING' } }),
    staleTime: 25000,
  });
  const { data: oncallResp } = useQuery({
    queryKey: ['noc-oncall', tick],
    queryFn: () => api.get('/teams/on-call/overview').then(r => r.data),
    staleTime: 30000,
  });
  const { data: incidentResp } = useQuery({
    queryKey: ['noc-incidents', tick],
    queryFn: async () => {
      // Backend has no virtual OPEN state — expand to real open IncidentState values.
      const openStates = ['NEW', 'IN_PROGRESS', 'ON_HOLD', 'ESCALATED'] as const;
      const pages = await Promise.all(
        openStates.map((state) =>
          api.get(`/incidents?state=${state}&limit=100`).then((r) => r.data?.data || []),
        ),
      );
      const byId = new Map<string, unknown>();
      for (const row of pages.flat()) {
        if (row?.id) byId.set(row.id, row);
      }
      return { data: Array.from(byId.values()) };
    },
    staleTime: 30000,
  });

  const alerts: Alert[] = alertResp?.items || [];
  const schedules: OnCallSchedule[] = oncallResp?.data?.schedules || [];
  const oncallStats = oncallResp?.data?.stats || {};
  const incidents = incidentResp?.data || [];
  const p1Incidents = incidents.filter((i: any) => i.priority === 'P1').length;

  const critical = alerts.filter(a => a.severity === 'CRITICAL');
  const warning  = alerts.filter(a => a.severity === 'WARNING');
  const info     = alerts.filter(a => !['CRITICAL', 'WARNING'].includes(a.severity));
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

  const FEED_COLS = '3px 1fr 132px 88px 60px';

  return (
    <Page>
      <style>{`
        @keyframes noc-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .noc-ticker-inner { animation: noc-ticker 120s linear infinite; will-change: transform; }
        .noc-feed-row:hover { background: ${HOVER} !important; }
        @media (prefers-reduced-motion: reduce) {
          .noc-ticker-inner { animation: none; }
        }
      `}</style>

      {!fullscreen && (
        <>
          <EnterpriseHero
            plane="observe"
            domain="NOC"
            title="NOC"
            deck="Org-scoped wallboard — live firing alerts, on-call coverage, and service assurance across organisations."
            meta={
              <>
                <span className={clsx('cx-pill', systemOK ? 'cx-pill--ok' : 'cx-pill--alert')}>
                  {systemOK ? 'All clear' : `${alerts.length} firing`}
                </span>
                <span className="text-right">
                  <span className="block tabular-nums font-mono text-[15px] tracking-wide text-white/90">
                    {clockTime()}
                  </span>
                  <span className="block font-mono text-[9.5px] uppercase tracking-widest text-white/55">
                    {clockDate()}
                  </span>
                </span>
                {isLoading
                  ? <RefreshCw className="w-4 h-4 animate-spin opacity-55" strokeWidth={1.75} />
                  : <Wifi className="w-4 h-4" style={{ color: GREEN }} strokeWidth={1.75} />}
              </>
            }
            actions={
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Fill the screen"
                className="cx-hero__btn cx-hero__btn--ghost !px-2"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            }
            kpiCols={5}
            kpis={[
              { label: 'Critical', value: critical.length, sub: 'firing now', tone: critical.length > 0 ? 'danger' : undefined },
              { label: 'Warning', value: warning.length, sub: 'firing now', tone: warning.length > 0 ? 'warn' : undefined },
              { label: 'Info', value: info.length, sub: 'firing now' },
              { label: 'Open incidents', value: incidents.length, sub: p1Incidents > 0 ? `${p1Incidents} P1` : 'none P1', tone: p1Incidents > 0 ? 'danger' : undefined },
              { label: 'Assurance', value: sas, sub: sas >= 75 ? 'nominal' : sas >= 45 ? 'elevated' : 'critical', tone: sas < 45 ? 'danger' : sas < 75 ? 'warn' : undefined },
            ]}
          />
          <EnterprisePosture chips={['Multi-org wallboard', 'Evidence-first posture', 'Named on-call visible']} />

          <nav className="cx-crumb" aria-label="Breadcrumb">
            <Link to="/dashboard">Operations</Link>
            <span aria-hidden>/</span>
            <span className="cx-crumb__current">NOC</span>
          </nav>
        </>
      )}

      <div className={fullscreen ? 'fixed inset-0 z-50 flex flex-col' : 'cx-noc flex flex-col'}
        style={{
          background: INK,
          minHeight: fullscreen ? '100vh' : undefined,
          fontFamily: BODY,
          color: TEXT,
        }}>

        {fullscreen && (
          <div className="flex items-center justify-between gap-4 px-5 h-12 shrink-0 flex-wrap"
            style={{ borderBottom: `1px solid ${LINE_STRONG}`, background: PANEL }}>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2.5">
                <Eye className="w-4 h-4" style={{ color: CORAL }} strokeWidth={1.75} />
                <span style={{
                  fontFamily: DISPLAY, fontSize: 17, fontWeight: 600,
                  letterSpacing: '-0.01em', color: TEXT,
                }}>NOC</span>
              </span>
              <span className="px-2 py-0.5 rounded-full" style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: systemOK ? 'rgba(52,211,153,0.14)' : 'rgba(255,91,46,0.14)',
                color: systemOK ? GREEN : CORAL,
                border: `1px solid ${systemOK ? 'rgba(52,211,153,0.3)' : 'rgba(255,91,46,0.3)'}`,
              }}>
                {systemOK ? 'All clear' : `${alerts.length} firing`}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-right">
                <span className="block tabular-nums" style={{ fontFamily: MONO, fontSize: 15, color: TEXT, letterSpacing: '0.02em' }}>
                  {clockTime()}
                </span>
                <span className="block" style={{ fontFamily: MONO, fontSize: 9.5, color: TEXT_DIM }}>{clockDate()}</span>
              </span>
              {isLoading
                ? <RefreshCw className="w-4 h-4 animate-spin" style={{ color: TEXT_DIM }} strokeWidth={1.75} />
                : <Wifi className="w-4 h-4" style={{ color: GREEN }} strokeWidth={1.75} />}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Leave fullscreen"
                className="p-1.5 rounded"
                style={{ color: TEXT_MUTED }}
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══ MAIN GRID ══ */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">

          {/* ─── LEFT: posture, counts, stats ─── */}
          <div className="lg:col-span-3 flex flex-col overflow-y-auto" style={{ borderRight: `1px solid ${LINE}` }}>
            <Posture score={sas} />

            <div className="grid grid-cols-3 gap-2 px-3 py-3 shrink-0" style={{ borderBottom: `1px solid ${LINE}` }}>
              <SevCounter sev="CRITICAL" count={critical.length} />
              <SevCounter sev="WARNING" count={warning.length} />
              <SevCounter sev="INFO" count={info.length} />
            </div>

            <div className="px-3 py-3 space-y-1.5 shrink-0" style={{ borderBottom: `1px solid ${LINE}` }}>
              {[
                { icon: Server,        label: 'Orgs affected',  val: orgsAffected,                      color: BLUE },
                { icon: AlertTriangle, label: 'Open incidents', val: incidents.length,                  color: TEXT },
                { icon: Activity,      label: 'P1 active',      val: p1Incidents,                       color: p1Incidents > 0 ? CORAL : TEXT },
                { icon: Users,         label: 'Responders',     val: oncallStats.activeResponders || 0, color: (oncallStats.activeResponders || 0) > 0 ? GREEN : CORAL },
                { icon: Shield,        label: 'Teams covered',  val: oncallStats.teamsCovered || 0,     color: TEXT },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ background: CARD, border: `1px solid ${LINE}` }}>
                  <span className="flex items-center gap-2">
                    <s.icon className="w-3.5 h-3.5" style={{ color: TEXT_DIM }} strokeWidth={1.75} />
                    <Label color={TEXT_MUTED}>{s.label}</Label>
                  </span>
                  <span className="tabular-nums" style={{
                    fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: s.color, lineHeight: 1,
                  }}>{s.val}</span>
                </div>
              ))}
            </div>

            <div className="px-3 py-3 mt-auto shrink-0">
              <div className="rounded p-3" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                <Label>Critical per 5 min · last hour</Label>
                <div className="flex items-end gap-1 h-10 mt-2.5">
                  {buckets.map((b, i) => (
                    <div key={i} className="flex-1 rounded-sm"
                      title={`${b} critical`}
                      style={{
                        height: `${Math.max((b / maxB) * 100, 6)}%`,
                        background: b > 0 ? CORAL : LINE,
                        opacity: b > 0 ? 0.45 + (b / maxB) * 0.55 : 1,
                        transition: 'height 0.5s ease',
                      }} />
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  <Label>−60m</Label>
                  <Label>now</Label>
                </div>
              </div>
            </div>
          </div>

          {/* ─── CENTRE: live feed ─── */}
          <div className="lg:col-span-6 flex flex-col overflow-hidden" style={{ borderRight: `1px solid ${LINE}` }}>

            {cascades.length > 0 && (
              <div className="px-4 py-3 shrink-0"
                style={{ borderBottom: `1px solid rgba(255,91,46,0.25)`, background: 'rgba(255,91,46,0.06)' }}>
                <span className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5" style={{ color: CORAL }} strokeWidth={1.75} />
                  <Label color={CORAL}>Cascades — one host, many alerts</Label>
                </span>
                <div className="flex gap-2 flex-wrap">
                  {cascades.map(([inst, list]) => (
                    <span key={inst} className="flex items-center gap-2 px-2.5 py-1 rounded"
                      style={{ background: 'rgba(255,91,46,0.10)', border: `1px solid rgba(255,91,46,0.28)` }}>
                      <span className="truncate max-w-[200px]" style={{ fontFamily: MONO, fontSize: 11.5, color: TEXT }}>{inst}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 500, color: CORAL }}>{list.length}×</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 py-2.5 shrink-0 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${LINE}`, background: PANEL }}>
              <span className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5" style={{ color: CORAL }} strokeWidth={1.75} />
                <Label color={TEXT_MUTED}>Live alert feed</Label>
              </span>
              <Label>{alerts.length} firing</Label>
            </div>

            <div className="flex-1 overflow-y-auto">
              {liveFeed.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2.5">
                  <Shield className="w-8 h-8" style={{ color: GREEN }} strokeWidth={1.5} />
                  <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, color: TEXT }}>
                    Nothing is firing
                  </span>
                  <Label>Every monitored service is reporting healthy</Label>
                </div>
              ) : (
                <>
                  <div className="grid px-4 py-2 sticky top-0 z-10"
                    style={{ background: PANEL, borderBottom: `1px solid ${LINE}`, gridTemplateColumns: FEED_COLS, gap: 12 }}>
                    <span />
                    <Label>Alert</Label>
                    <Label>Organisation</Label>
                    <Label>Host</Label>
                    <Label>Age</Label>
                  </div>
                  {liveFeed.map((alert) => {
                    const cfg = SEV[alert.severity as SevKey] || SEV.INFO;
                    const inst = parseInstance(alert);
                    return (
                      <div key={alert.id} className="noc-feed-row grid px-4 py-2.5 items-center transition-colors"
                        style={{ borderBottom: `1px solid ${LINE}`, gridTemplateColumns: FEED_COLS, gap: 12 }}>
                        <span className="h-5 rounded-full" style={{ background: cfg.color }} />
                        <span className="truncate" style={{ fontFamily: BODY, fontSize: 13.5, color: TEXT }}>{alert.name}</span>
                        <span className="truncate" style={{ fontFamily: BODY, fontSize: 12, color: TEXT_MUTED }}>
                          {alert.organization?.name || '—'}
                        </span>
                        <span className="truncate" style={{ fontFamily: MONO, fontSize: 11, color: TEXT_DIM }}>{inst || '—'}</span>
                        <span className="text-right tabular-nums" style={{ fontFamily: MONO, fontSize: 11.5, color: cfg.color }}>
                          {relTime(alert.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* ─── RIGHT: org health + on-call ─── */}
          <div className="lg:col-span-3 flex flex-col overflow-hidden">

            <div className="flex-1 flex flex-col overflow-hidden" style={{ borderBottom: `1px solid ${LINE}` }}>
              <PanelHeader icon={Server} title="Org health" right={<Label>{byOrg.length} affected</Label>} />
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {byOrg.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
                    <Shield className="w-6 h-6" style={{ color: GREEN }} strokeWidth={1.5} />
                    <Label color={GREEN}>All organisations clear</Label>
                  </div>
                ) : (
                  byOrg.map(org => (
                    <OrgRow key={org.id} name={org.name} critical={org.critical} warning={org.warning} info={org.info} />
                  ))
                )}
              </div>
            </div>

            <div className="shrink-0 flex flex-col" style={{ maxHeight: '44%' }}>
              <PanelHeader
                icon={Users}
                title="On call now"
                right={
                  <Label color={(oncallStats.activeResponders || 0) > 0 ? GREEN : CORAL}>
                    {oncallStats.activeResponders || 0} on duty
                  </Label>
                }
              />
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {schedules.length === 0 ? (
                  <div className="px-1 py-4">
                    <Label color={CORAL}>Nobody is on call</Label>
                  </div>
                ) : (
                  schedules.slice(0, 8).map(s => (
                    <div key={s.id} className="flex items-center gap-2.5 rounded px-2.5 py-2"
                      style={{
                        background: CARD,
                        border: `1px solid ${LINE}`,
                        borderLeft: `2px solid ${s.isPrimary ? CORAL : LINE_STRONG}`,
                      }}>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: s.isPrimary ? CORAL : HOVER,
                          color: s.isPrimary ? '#fff' : TEXT_MUTED,
                          fontFamily: MONO, fontSize: 10, fontWeight: 500,
                        }}>
                        {s.user.firstName[0]}{s.user.lastName[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate" style={{ fontFamily: BODY, fontSize: 12.5, color: TEXT }}>
                          {s.user.firstName} {s.user.lastName}
                        </span>
                        <span className="block truncate" style={{ fontFamily: MONO, fontSize: 10, color: TEXT_DIM }}>
                          {s.team.name} · {s.isPrimary ? 'primary' : 'backup'}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══ TICKER ══ */}
        <div className="flex items-center gap-3 shrink-0 overflow-hidden px-4 h-9"
          style={{ borderTop: `1px solid ${LINE_STRONG}`, background: PANEL }}>
          <Label color={CORAL}>Live</Label>
          <div className="flex-1 overflow-hidden">
            {liveFeed.length > 0 ? (
              <div className="noc-ticker-inner flex gap-10 whitespace-nowrap">
                {[...liveFeed, ...liveFeed].map((a, i) => {
                  const cfg = SEV[a.severity as SevKey] || SEV.INFO;
                  return (
                    <span key={`${a.id}-${i}`} className="inline-flex items-center gap-2 shrink-0">
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                      <span style={{ fontFamily: BODY, fontSize: 12, color: TEXT }}>{a.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT_DIM }}>
                        {a.organization?.name || parseInstance(a) || '—'}
                      </span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <span style={{ fontFamily: BODY, fontSize: 12, color: TEXT_MUTED }}>
                No active alerts — every monitored service is reporting healthy.
              </span>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
