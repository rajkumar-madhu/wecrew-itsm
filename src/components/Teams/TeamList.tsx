import type React from 'react';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Users, Shield, Mail, Hash, ChevronDown, ChevronUp,
  AlertTriangle, Clock, Loader2, Search,
  Plus, X, Wrench, Database, Network, Headphones, Code,
  ShieldCheck, Activity, Globe, Zap, Briefcase, Crown,
  MessageSquare,
} from 'lucide-react';
import { useTeams, useCreateTeam } from '../../hooks/useTeams';
import { useAuthStore } from '../../stores/authStore';
import { Page, Toolbar, GhostButton } from '../ui/PageChrome';

// ── Team type definitions with icons and colors ──
const TEAM_TYPES: Record<string, { icon: any; label: string; hex: string; bg: string; border: string }> = {
  DEVOPS:     { icon: Code,         label: 'DevOps',         hex: '#2b4cff', bg: 'rgba(43,76,255,0.10)',  border: 'rgba(43,76,255,0.22)' },
  NETWORK:    { icon: Network,      label: 'Network',        hex: '#0e7490', bg: 'rgba(14,116,144,0.10)', border: 'rgba(14,116,144,0.22)' },
  DATABASE:   { icon: Database,     label: 'Database',       hex: '#0f7a55', bg: 'rgba(15,122,85,0.10)',  border: 'rgba(15,122,85,0.22)' },
  SUPPORT:    { icon: Headphones,   label: 'Support',        hex: '#d97706', bg: 'rgba(217,119,6,0.10)',  border: 'rgba(217,119,6,0.22)' },
  SECURITY:   { icon: ShieldCheck,  label: 'Security',       hex: '#dc2626', bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.22)' },
  INFRA:      { icon: Wrench,       label: 'Infrastructure', hex: '#5c5a56', bg: 'rgba(14,17,22,0.06)',   border: 'rgba(14,17,22,0.12)' },
  PLATFORM:   { icon: Globe,        label: 'Platform',       hex: '#2b4cff', bg: 'rgba(43,76,255,0.10)',  border: 'rgba(43,76,255,0.22)' },
  SRE:        { icon: Activity,     label: 'SRE',            hex: '#ff5b2e', bg: 'rgba(255,91,46,0.10)',  border: 'rgba(255,91,46,0.22)' },
  MANAGEMENT: { icon: Briefcase,    label: 'Management',     hex: '#5c5a56', bg: 'rgba(14,17,22,0.06)',   border: 'rgba(14,17,22,0.12)' },
  OTHER:      { icon: Users,        label: 'General',        hex: '#5c5a56', bg: 'rgba(14,17,22,0.06)',   border: 'rgba(14,17,22,0.12)' },
};

function detectTeamType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('devops') || n.includes('dev ops') || n.includes('cicd') || n.includes('deploy')) return 'DEVOPS';
  if (n.includes('network') || n.includes('noc') || n.includes('connectivity') || n.includes('wan') || n.includes('firewall')) return 'NETWORK';
  if (n.includes('database') || n.includes('dba') || n.includes('db ') || n.includes('mysql') || n.includes('postgres') || n.includes('redis')) return 'DATABASE';
  if (n.includes('support') || n.includes('helpdesk') || n.includes('service desk') || n.includes('l1') || n.includes('l2') || n.includes('l3') || n.includes('customer')) return 'SUPPORT';
  if (n.includes('security') || n.includes('soc') || n.includes('infosec') || n.includes('compliance')) return 'SECURITY';
  if (n.includes('infra') || n.includes('hardware') || n.includes('data center') || n.includes('dc ')) return 'INFRA';
  if (n.includes('platform') || n.includes('cloud') || n.includes('k8s') || n.includes('kubernetes') || n.includes('aws') || n.includes('azure')) return 'PLATFORM';
  if (n.includes('sre') || n.includes('reliability')) return 'SRE';
  if (n.includes('management') || n.includes('leadership') || n.includes('executive')) return 'MANAGEMENT';
  return 'OTHER';
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName || '').charAt(0).toUpperCase();
  const l = (lastName || '').charAt(0).toUpperCase();
  return f + l || '??';
}

function getFullName(user: any): string {
  if (!user) return 'Unknown';
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
}

const roleStyles: Record<string, React.CSSProperties> = {
  LEAD:     { background: 'var(--argus-amber-dim)', color: 'var(--argus-amber)', border: '1px solid color-mix(in srgb, var(--argus-amber) 25%, transparent)' },
  MEMBER:   { background: 'var(--argus-signal-dim)', color: 'var(--argus-signal)', border: '1px solid color-mix(in srgb, var(--argus-signal) 25%, transparent)' },
  OBSERVER: { background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' },
};

const avatarGradients = [
  'from-[#6366F1] to-[#8B5CF6]',
  'from-[#10B981] to-[#14B8A6]',
  'from-[#F59E0B] to-[#F97316]',
  'from-[#EF4444] to-[#EC4899]',
  'from-[#0EA5E9] to-[#6366F1]',
  'from-[#8B5CF6] to-[#EC4899]',
];

function avatarGrad(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return avatarGradients[Math.abs(h) % avatarGradients.length];
}

// ── Create Team Modal ──
function CreateTeamModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [slackChannel, setSlackChannel] = useState('');
  const [teamType, setTeamType] = useState('DEVOPS');
  const createTeam = useCreateTeam();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTeam.mutateAsync({
      name,
      description: description || undefined,
      email: email || undefined,
      slackChannel: slackChannel || undefined,
    });
    setName(''); setDescription(''); setEmail(''); setSlackChannel('');
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'var(--argus-overlay)' }} />
      <div
        className="relative w-full max-w-lg animate-fade-in"
        style={{ background: 'var(--argus-surface)', border: '1px solid var(--argus-border)', borderRadius: 'var(--cx-radius)', boxShadow: 'var(--argus-shadow-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--argus-border)' }}>
          <div>
            <p className="cx-eyebrow">Administration</p>
            <h2 className="cx-sectionhead__title" style={{ fontSize: '1.25rem' }}>Create a team</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Team type pills */}
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>Team Type</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TEAM_TYPES).filter(([k]) => k !== 'OTHER').map(([key, def]) => {
                const Icon = def.icon;
                const isActive = teamType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTeamType(key)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={isActive ? { background: def.bg, color: def.hex, border: `1px solid ${def.border}` } : { background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }}
                  >
                    <Icon className="w-3 h-3" /> {def.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>Team Name *</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}
              placeholder={`e.g. ${TEAM_TYPES[teamType]?.label || ''} - Production`}
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>Description</label>
            <textarea
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}
              rows={2}
              placeholder="Brief description of team responsibilities..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>Team Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--argus-dim)' }} />
                <input className="w-full pl-9 rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }} placeholder="team@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--argus-muted)' }}>Slack Channel</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--argus-dim)' }} />
                <input className="w-full pl-9 rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }} placeholder="team-channel" value={slackChannel} onChange={e => setSlackChannel(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--argus-border)' }}>
            <button
              type="submit"
              disabled={!name.trim() || createTeam.isPending}
              className="cx-btn cx-btn--primary flex-1 disabled:opacity-50"
            >
              {createTeam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {createTeam.isPending ? 'Creating…' : 'Create team'}
            </button>
            <button type="button" onClick={onClose} className="cx-btn cx-btn--ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Team Card ──
function TeamCard({ team, expanded, onToggle }: { team: any; expanded: boolean; onToggle: () => void }) {
  const teamType = detectTeamType(team.name);
  const def = TEAM_TYPES[teamType] || TEAM_TYPES.OTHER;
  const TeamIcon = def.icon;
  const memberCount = team.members?.length || 0;
  const incidentCount = team._count?.assignedIncidents || 0;
  const changeCount = team._count?.assignedChanges || 0;
  const problemCount = team._count?.assignedProblems || 0;
  const totalWorkload = incidentCount + changeCount + problemCount;
  const managerName = team.manager ? getFullName(team.manager) : (team.lead ? getFullName(team.lead) : null);

  const members = (team.members || []).map((m: any) => {
    const u = m.user || m;
    return {
      id: u.id,
      name: getFullName(u),
      role: m.role || (team.manager && u.id === team.manager.id ? 'LEAD' : 'MEMBER'),
      avatar: getInitials(u.firstName, u.lastName),
      email: u.email,
      jobTitle: u.jobTitle,
      department: u.department,
      mfaEnabled: u.mfaEnabled,
      gradClass: avatarGrad(u.id),
    };
  });

  // Sort: LEAD first, then MEMBER, then OBSERVER
  const roleOrder: Record<string, number> = { LEAD: 0, MEMBER: 1, OBSERVER: 2 };
  members.sort((a: any, b: any) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));

  const workloadColor = totalWorkload > 10 ? 'var(--argus-crimson)' : totalWorkload > 5 ? 'var(--argus-amber)' : 'var(--argus-emerald)';

  return (
    <div
      className="transition-colors"
      style={{
        background: 'var(--argus-surface)',
        border: expanded ? `1px solid ${def.border}` : '1px solid var(--argus-border)',
        borderRadius: 'var(--cx-radius)',
        boxShadow: 'var(--argus-shadow-card)',
      }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: def.bg }}>
            <TeamIcon className="w-5 h-5" style={{ color: def.hex }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold truncate" style={{ color: 'var(--argus-ink)' }}>{team.name}</h3>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: def.bg, color: def.hex, border: `1px solid ${def.border}` }}>{def.label.toUpperCase()}</span>
              {!team.isActive && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.15)', color: 'var(--argus-crimson)', border: '1px solid rgba(220,38,38,0.3)' }}>INACTIVE</span>}
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--argus-muted)' }}>{team.description || 'No description'}</p>
          </div>
        </div>

        <div className="flex items-center gap-5 shrink-0 ml-4">
          {/* Member count */}
          <div className="text-center">
            <p className="text-lg font-bold font-display" style={{ color: 'var(--argus-ink)' }}>{memberCount}</p>
            <p className="text-[10px] font-medium" style={{ color: 'var(--argus-muted)' }}>Members</p>
          </div>

          {/* Workload indicator */}
          <div className="text-center">
            <p className="text-lg font-bold font-display" style={{ color: workloadColor }}>{totalWorkload}</p>
            <p className="text-[10px] font-medium" style={{ color: 'var(--argus-muted)' }}>Workload</p>
          </div>

          {/* Contact icons */}
          <div className="flex items-center gap-1.5">
            {team.email && (
              <div className="p-1.5 rounded-md" style={{ background: 'var(--argus-elevated)' }} title={team.email}>
                <Mail className="w-3 h-3" style={{ color: 'var(--argus-muted)' }} />
              </div>
            )}
            {team.slackChannel && (
              <div className="p-1.5 rounded-md" style={{ background: 'var(--argus-elevated)' }} title={`#${team.slackChannel}`}>
                <MessageSquare className="w-3 h-3" style={{ color: 'var(--argus-muted)' }} />
              </div>
            )}
          </div>

          {/* Expand arrow */}
          {expanded
            ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--argus-muted)' }} />
            : <ChevronDown className="w-4 h-4" style={{ color: 'var(--argus-muted)' }} />
          }
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="animate-fade-in" style={{ borderTop: '1px solid var(--argus-border)' }}>
          {/* Stats bar */}
          <div className="flex items-center gap-6 px-5 py-3" style={{ background: 'var(--argus-elevated)' }}>
            {managerName && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--argus-muted)' }}>
                <Crown className="w-3 h-3" style={{ color: 'var(--argus-amber)' }} /> Manager: <span className="font-medium" style={{ color: 'var(--argus-ink)' }}>{managerName}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--argus-muted)' }}>
              <AlertTriangle className="w-3 h-3" style={{ color: 'var(--argus-crimson)' }} /> <span className="font-medium" style={{ color: 'var(--argus-ink)' }}>{incidentCount}</span> Incidents
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--argus-muted)' }}>
              <Zap className="w-3 h-3" style={{ color: 'var(--argus-signal)' }} /> <span className="font-medium" style={{ color: 'var(--argus-ink)' }}>{changeCount}</span> Changes
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--argus-muted)' }}>
              <Activity className="w-3 h-3" style={{ color: 'var(--argus-signal)' }} /> <span className="font-medium" style={{ color: 'var(--argus-ink)' }}>{problemCount}</span> Problems
            </span>
            <span className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: 'var(--argus-muted)' }}>
              <Clock className="w-3 h-3" /> Created {new Date(team.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* Members grid */}
          <div className="p-5">
            {members.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--argus-muted)' }}>
                <Users className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--argus-dim)' }} />
                <p className="text-sm font-medium">No members yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--argus-dim)' }}>Add team members to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {members.map((member: any) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                    <div className="relative shrink-0">
                      <div className={clsx('w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-[11px] font-bold text-white', member.gradClass)}>
                        {member.avatar}
                      </div>
                      {member.role === 'LEAD' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--argus-amber)', border: '2px solid var(--argus-surface)' }}>
                          <Crown className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--argus-ink)' }}>{member.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={roleStyles[member.role] || roleStyles.MEMBER}>
                          {member.role}
                        </span>
                        {member.jobTitle && <span className="text-[10px] truncate" style={{ color: 'var(--argus-muted)' }}>{member.jobTitle}</span>}
                      </div>
                    </div>
                    {member.mfaEnabled && <span title="MFA enabled"><Shield className="w-3 h-3 shrink-0" style={{ color: '#059669' }} /></span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function TeamList() {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: teamsData, isLoading, isError, refetch } = useTeams();
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const teams = teamsData?.data || [];

  // Enrich teams with detected type
  const enrichedTeams = useMemo(() =>
    teams.map((t: any) => ({ ...t, detectedType: detectTeamType(t.name) })),
    [teams]
  );

  // Filter
  const filtered = useMemo(() => {
    let result = enrichedTeams;
    if (typeFilter !== 'ALL') result = result.filter((t: any) => t.detectedType === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t: any) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.members || []).some((m: any) => {
          const u = m.user || m;
          return getFullName(u).toLowerCase().includes(q);
        })
      );
    }
    return result;
  }, [enrichedTeams, typeFilter, searchQuery]);

  // Stats
  const totalMembers = teams.reduce((acc: number, t: any) => acc + (t.members?.length || 0), 0);
  const totalWorkload = teams.reduce((acc: number, t: any) => acc + (t._count?.assignedIncidents || 0) + (t._count?.assignedChanges || 0) + (t._count?.assignedProblems || 0), 0);
  const activeTeams = teams.filter((t: any) => t.isActive !== false).length;

  // Type counts for filter
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    enrichedTeams.forEach((t: any) => { counts[t.detectedType] = (counts[t.detectedType] || 0) + 1; });
    return counts;
  }, [enrichedTeams]);

  const kpis = [
    { label: 'Teams', value: isLoading ? '—' : teams.length, sub: `${activeTeams} active` },
    { label: 'Members', value: isLoading ? '—' : totalMembers, sub: 'holding a seat' },
    { label: 'Open work', value: isLoading ? '—' : totalWorkload, sub: 'incidents, changes, problems', tone: totalWorkload > 10 ? 'warn' : undefined },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Govern · people</span>
            <h1 className="cx-hero__title">Teams</h1>
            <p className="cx-hero__deck">
              Who belongs where, who leads, and how much open work sits on each group. On-call and
              escalation elsewhere in Argus attach to the teams held here.
            </p>
          </div>
          {canManage && (
            <button type="button" onClick={() => setShowCreateModal(true)} className="cx-hero__btn">
              <Plus size={14} strokeWidth={1.75} />
              Create a team
            </button>
          )}
        </div>
        <dl className="cx-hero__kpis mt-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={clsx('cx-hero__kpi', kpi.tone && `cx-hero__kpi--${kpi.tone}`)}>
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
        <span className="cx-crumb__current">Teams</span>
      </nav>

      <Toolbar>
        <div className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {isLoading ? '—' : `${filtered.length} team${filtered.length === 1 ? '' : 's'}`}
          </span>
          <span className="cx-listhead__count-meta">{typeFilter === 'ALL' ? 'all types' : TEAM_TYPES[typeFilter]?.label}</span>
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams or members..."
            className="input-field pl-8 py-1.5 text-[13px]"
          />
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <div className="flex items-center gap-1 flex-wrap">
          <GhostButton active={typeFilter === 'ALL'} onClick={() => setTypeFilter('ALL')}>
            All
          </GhostButton>
          {Object.entries(TEAM_TYPES).filter(([k]) => k !== 'OTHER' && (typeCounts[k] || 0) > 0).map(([key, def]) => {
            const Icon = def.icon;
            return (
              <GhostButton key={key} active={typeFilter === key} onClick={() => setTypeFilter(key)}>
                <Icon className="w-3.5 h-3.5" /> {def.label}
              </GhostButton>
            );
          })}
        </div>
      </Toolbar>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Reading teams…
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-crimson" strokeWidth={1.75} />
          <p className="text-sm text-ink font-medium">Teams did not load</p>
          <p className="text-xs text-muted mt-1">Reload the page to try again.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-ink font-medium">No teams match these filters</p>
          <p className="text-xs text-muted mt-1">
            {searchQuery || typeFilter !== 'ALL' ? 'Clear the filters to see every team.' : 'Create a team to get started.'}
          </p>
          {canManage && !searchQuery && typeFilter === 'ALL' && (
            <button type="button" onClick={() => setShowCreateModal(true)} className="cx-btn cx-btn--primary mt-4">
              <Plus size={14} /> Create a team
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((team: any) => (
            <TeamCard
              key={team.id}
              team={team}
              expanded={expandedTeam === team.id}
              onToggle={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
            />
          ))}
        </div>
      )}

      <CreateTeamModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => refetch()}
      />
    </Page>
  );
}
