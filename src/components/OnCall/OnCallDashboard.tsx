import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Phone,
  Mail,
  MessageSquare,
  Bell,
  ChevronLeft,
  ChevronRight,
  Users,
  Timer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTeams } from '../../hooks/useTeams';
import {
  useOnCallOverview,
  useOnCallSchedules,
  useEscalationPolicies,
  useOnCallHistory,
} from '../../hooks/useOnCall';
import { Page, Panel, Toolbar, EnterpriseHero, EnterprisePosture } from '../ui/PageChrome';
import type { EnterpriseKpi } from '../ui/PageChrome';

/* ====================================================================
   HELPERS
   ==================================================================== */

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatName(user: any): string {
  if (!user) return 'Unassigned';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Unassigned';
}

function initials(user: any): string {
  const name = formatName(user);
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'ended';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

const NOTIFY_ICONS: Record<string, LucideIcon> = {
  PHONE: Phone,
  EMAIL: Mail,
  SLACK: MessageSquare,
  SMS: MessageSquare,
};

function PriorityBadge({ p }: { p: string }) {
  const tone = p === 'P1' ? 'danger' : p === 'P2' ? 'warn' : 'neutral';
  return <span className={clsx('cx-pill', `cx-pill--${tone}`)}>{p}</span>;
}

/* ====================================================================
   COVERAGE RIBBON
   ==================================================================== */

/**
 * 168 cells, one per hour of the week.
 *
 * The polarity is deliberately the opposite of the usual coverage heatmap: a
 * covered hour is quiet and an uncovered hour is coral. Nobody acts on the
 * knowledge that Tuesday afternoon has two responders — the only state worth
 * a reader's attention is the hour when the pager belongs to no one.
 */
function CoverageRibbon({
  matrix,
  weekDates,
  isToday,
  weekOffset,
  onPrev,
  onNext,
  onToday,
}: {
  matrix: number[][];
  weekDates: Date[];
  isToday: (d: Date) => boolean;
  weekOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const now = new Date();
  const gaps = matrix.flat().filter((n) => n === 0).length;
  const thin = matrix.flat().filter((n) => n === 1).length;

  return (
    <div className="cx-ribbon">
      <div className="cx-ribbon__head">
        <span className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {gaps === 0 ? 'Every hour is covered' : `${gaps} uncovered hour${gaps === 1 ? '' : 's'}`}
          </span>
          <span className="cx-listhead__count-meta">
            {thin} hour{thin === 1 ? '' : 's'} on a single responder
          </span>
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous week"
            className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="px-2 py-1 rounded text-[11px] font-mono text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] transition-colors"
          >
            {weekOffset === 0 ? 'This week' : `${weekOffset > 0 ? '+' : ''}${weekOffset}w`}
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next week"
            className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="cx-ribbon__body">
        <div className="cx-ribbon__inner">
          <div className="cx-ribbon__hours" aria-hidden>
            {HOURS.map((h) => (
              <span key={h} className="cx-ribbon__hour">{h % 6 === 0 ? String(h).padStart(2, '0') : ''}</span>
            ))}
          </div>

          {DAYS_SHORT.map((day, di) => {
            const date = weekDates[di];
            const today = isToday(date);
            return (
              <div key={day} className="cx-ribbon__row">
                <span className={clsx('cx-ribbon__day', today && 'cx-ribbon__day--today')}>{day}</span>
                <span className="cx-ribbon__cells">
                  {HOURS.map((h) => {
                    const count = matrix[di]?.[h] || 0;
                    const cellTime = new Date(date);
                    cellTime.setHours(h, 0, 0, 0);
                    const past = cellTime < now;
                    return (
                      <span
                        key={h}
                        className={clsx(
                          'cx-ribbon__cell',
                          count === 0 && 'cx-ribbon__cell--gap',
                          count === 1 && 'cx-ribbon__cell--thin',
                          past && 'cx-ribbon__cell--past'
                        )}
                        title={`${day} ${String(h).padStart(2, '0')}:00 — ${count} responder${count === 1 ? '' : 's'}`}
                      />
                    );
                  })}
                </span>
              </div>
            );
          })}

          <div className="cx-ribbon__legend">
            <span className="cx-ribbon__key">
              <span className="cx-ribbon__swatch cx-ribbon__cell--gap" /> No cover
            </span>
            <span className="cx-ribbon__key">
              <span className="cx-ribbon__swatch cx-ribbon__cell--thin" /> One responder
            </span>
            <span className="cx-ribbon__key">
              <span className="cx-ribbon__swatch" /> Covered
            </span>
            <span className="cx-ribbon__key text-graphite">Faded hours have already passed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   PAGE
   ==================================================================== */

export default function OnCallDashboard() {
  const navigate = useNavigate();
  const { data: teamsResponse, isLoading: teamsLoading } = useTeams({});
  const teams: any[] = teamsResponse?.data || [];

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [weekOffset, setWeekOffset] = useState(0);

  const activeTeamId = selectedTeamId || teams[0]?.id || '';

  const { data: overviewData, isLoading: overviewLoading } = useOnCallOverview();
  const { data: schedulesData } = useOnCallSchedules(activeTeamId);
  const { data: escalationData } = useEscalationPolicies(activeTeamId);
  const { data: historyData } = useOnCallHistory(activeTeamId);

  const overview = overviewData?.data;
  const schedules: any[] = schedulesData?.data || [];
  const escalationPolicies: any[] = escalationData?.data || [];
  const recentIncidents: any[] = historyData?.data?.recentIncidents || [];

  const stats = overview?.stats || { activeResponders: 0, teamsCovered: 0, openCritical: 0, totalSchedules: 0 };
  const allOnCall: any[] = overview?.schedules || [];

  const primarySchedules = schedules.filter((s: any) => s.isPrimary);
  const secondarySchedules = schedules.filter((s: any) => !s.isPrimary);

  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const isToday = (d: Date) => {
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const coverageMatrix = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const sched of allOnCall) {
      const start = new Date(sched.startTime);
      const end = new Date(sched.endTime);
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const cellTime = new Date(weekDates[d]);
          cellTime.setHours(h, 0, 0, 0);
          if (cellTime >= start && cellTime < end) matrix[d][h]++;
        }
      }
    }
    return matrix;
  }, [allOnCall, weekDates]);

  const uncoveredHours = useMemo(() => coverageMatrix.flat().filter((n) => n === 0).length, [coverageMatrix]);

  const isLoadingAny = teamsLoading || overviewLoading;

  const kpis: EnterpriseKpi[] = [
    { label: 'On duty', value: stats.activeResponders, sub: 'holding a pager now' },
    { label: 'Teams covered', value: stats.teamsCovered, sub: `of ${teams.length || '—'} teams` },
    {
      label: 'Uncovered hours',
      value: uncoveredHours,
      sub: 'this week',
      tone: uncoveredHours > 0 ? 'danger' : undefined,
    },
    {
      label: 'Open P1/P2',
      value: stats.openCritical,
      sub: 'someone is being paged',
      tone: stats.openCritical > 0 ? 'warn' : undefined,
    },
    { label: 'Schedules', value: stats.totalSchedules, sub: 'rotations defined' },
  ];

  return (
    <Page>
      <EnterpriseHero
        plane="respond"
        domain="on-call"
        title="On-call"
        deck="Org-scoped rota coverage — who holds the pager, when handover happens, and which hours belong to nobody. An uncovered hour is the failure this page catches."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/oncall-calendar')}
              className="cx-hero__btn cx-hero__btn--ghost"
            >
              Full calendar
            </button>
            <button type="button" onClick={() => navigate('/escalation')} className="cx-hero__btn">
              Escalation policies
            </button>
          </>
        }
        kpiCols={5}
        kpis={kpis.map((kpi) => ({
          ...kpi,
          value: isLoadingAny ? '—' : kpi.value,
        }))}
      />
      <EnterprisePosture chips={['Org-scoped schedules', 'Named responder on page', 'Coverage gaps visible']} />

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">On-call</span>
      </nav>

      {/* ── Signature: coverage ribbon ── */}
      <div className="cx-sectionhead">
        <div>
          <h2 className="cx-sectionhead__title">Coverage</h2>
          <p className="cx-sectionhead__deck">
            Every hour of the week across all teams. Coral means nobody is on call for that hour.
          </p>
        </div>
      </div>

      <CoverageRibbon
        matrix={coverageMatrix}
        weekDates={weekDates}
        isToday={isToday}
        weekOffset={weekOffset}
        onPrev={() => setWeekOffset((o) => o - 1)}
        onNext={() => setWeekOffset((o) => o + 1)}
        onToday={() => setWeekOffset(0)}
      />

      {/* ── Team scope ── */}
      <div className="cx-sectionhead">
        <div>
          <h2 className="cx-sectionhead__title">Rota</h2>
          <p className="cx-sectionhead__deck">
            The roster, escalation path and recent pages for one team.
          </p>
        </div>
      </div>

      <Toolbar>
        <span className="cx-listhead__count">
          <Users size={14} className="text-dim mr-1.5 self-center" />
          <span className="cx-listhead__count-value">Team</span>
        </span>
        <select
          aria-label="Choose a team"
          value={activeTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="filter-select min-w-[180px]"
        >
          {teams.length === 0 && <option value="">No teams</option>}
          {teams.map((t: any) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span className="text-[11px] text-dim ml-auto">
          {primarySchedules.length} primary · {secondarySchedules.length} backup
        </span>
      </Toolbar>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Roster */}
        <Panel title="Who has the pager">
          {schedules.length === 0 ? (
            <p className="text-[13px] text-muted py-4">
              This team has no on-call schedule. Alerts routed here will not page anyone.
            </p>
          ) : (
            <div className="space-y-2">
              {primarySchedules.map((s: any) => (
                <div key={s.id} className="cx-roster cx-roster--primary">
                  <span className="cx-roster__mark">{initials(s.user)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="cx-roster__name block truncate">{formatName(s.user)}</span>
                    <span className="cx-roster__meta block">
                      Primary · hands over in {timeUntil(s.endTime)}
                    </span>
                  </span>
                  {s.user?.phone && (
                    <a
                      href={`tel:${s.user.phone}`}
                      className="text-[12px] font-mono text-coral hover:underline shrink-0"
                    >
                      {s.user.phone}
                    </a>
                  )}
                </div>
              ))}

              {secondarySchedules.map((s: any) => (
                <div key={s.id} className="cx-roster">
                  <span className="cx-roster__mark">{initials(s.user)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="cx-roster__name block truncate">{formatName(s.user)}</span>
                    <span className="cx-roster__meta block">
                      Backup · hands over in {timeUntil(s.endTime)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Escalation */}
        <Panel title="If nobody answers">
          {escalationPolicies.length === 0 ? (
            <p className="text-[13px] text-muted py-4">
              No escalation policy. An unacknowledged page stops with the primary responder.
            </p>
          ) : (
            escalationPolicies.map((policy: any) => (
              <div key={policy.id} className="mb-4 last:mb-0">
                <p className="cx-eyebrow mb-2">{policy.name}</p>
                <ol className="space-y-0">
                  {(policy.rules || []).map((rule: any, idx: number) => {
                    const NotifyIcon = NOTIFY_ICONS[rule.notifyType] || Bell;
                    const last = idx === (policy.rules?.length || 0) - 1;
                    return (
                      <li key={rule.id} className="flex items-start gap-3">
                        {/* The ladder is a real sequence — level 2 only fires
                            because level 1 stayed silent — so the rail earns
                            its numbering. */}
                        <span className="flex flex-col items-center shrink-0">
                          <span className="w-6 h-6 rounded-full border border-[color:var(--argus-border)] bg-[color:var(--argus-elevated)] text-[10px] font-mono text-muted flex items-center justify-center">
                            {rule.level}
                          </span>
                          {!last && <span className="w-px flex-1 min-h-[18px] bg-[color:var(--argus-border)]" />}
                        </span>
                        <span className={clsx('min-w-0 flex-1', !last && 'pb-3')}>
                          <span className="block text-[13px] text-ink truncate">{rule.notifyTargets}</span>
                          <span className="flex items-center gap-3 mt-0.5 text-[11px] font-mono text-muted">
                            <span className="inline-flex items-center gap-1">
                              <Timer size={11} strokeWidth={1.75} />
                              after {rule.delayMinutes}m
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <NotifyIcon size={11} strokeWidth={1.75} />
                              {String(rule.notifyType || '').toLowerCase()}
                            </span>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))
          )}
        </Panel>

        {/* Recent pages */}
        <Panel
          title="Recent pages"
          actions={<span className="text-[11px] font-mono text-dim">{recentIncidents.length}</span>}
          noPad
        >
          {recentIncidents.length === 0 ? (
            <p className="text-[13px] text-muted px-3.5 py-5">No P1 or P2 incidents paged this team.</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {recentIncidents.map((inc: any) => (
                <li key={inc.id} className="border-b border-[color:var(--argus-border)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[color:var(--argus-elevated)] transition-colors"
                  >
                    <span className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[11px] text-signal">{inc.number}</span>
                      <PriorityBadge p={inc.priority} />
                    </span>
                    <span className="block text-[13px] text-ink truncate">{inc.shortDescription}</span>
                    <span className="block text-[11px] font-mono text-muted mt-0.5">
                      {relativeTime(inc.createdAt)}
                      {inc.assignedTo && ` · ${formatName(inc.assignedTo)}`}
                      {inc.acknowledgedAt ? ' · acknowledged' : ' · unacknowledged'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </Page>
  );
}
