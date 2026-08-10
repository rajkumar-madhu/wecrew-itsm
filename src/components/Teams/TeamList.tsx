import type React from 'react';
import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  Users, Shield, UserPlus, Mail, Hash, ChevronDown, ChevronUp,
  AlertTriangle, Clock, Loader2, Search, Building2, Phone,
  Plus, X, Wrench, Database, Network, Headphones, Code,
  ShieldCheck, BarChart3, Activity, Globe, Zap, Briefcase,
  MoreHorizontal, Pencil, Trash2, UserMinus, Crown,
  MessageSquare, Bell,
} from 'lucide-react';
import { useTeams, useCreateTeam } from '../../hooks/useTeams';
import { useAuthStore } from '../../stores/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

// ── Team type definitions with icons and colors ──
const TEAM_TYPES: Record<string, { icon: any; label: string; hex: string; bg: string; border: string }> = {
  DEVOPS:    { icon: Code,         label: 'DevOps',           hex: '#A5B4FC', bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.3)' },
  NETWORK:   { icon: Network,      label: 'Network',          hex: '#38BDF8', bg: 'rgba(14,165,233,0.15)',  border: 'rgba(14,165,233,0.3)' },
  DATABASE:  { icon: Database,     label: 'Database',         hex: '#6EE7B7', bg: 'rgba(5,150,105,0.15)',   border: 'rgba(5,150,105,0.3)' },
  SUPPORT:   { icon: Headphones,   label: 'Support',          hex: '#FCD34D', bg: 'rgba(217,119,6,0.15)',   border: 'rgba(217,119,6,0.3)' },
  SECURITY:  { icon: ShieldCheck,  label: 'Security',         hex: '#FCA5A5', bg: 'rgba(220,38,38,0.15)',   border: 'rgba(220,38,38,0.3)' },
  INFRA:     { icon: Wrench,       label: 'Infrastructure',   hex: '#C4B5FD', bg: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.3)' },
  PLATFORM:  { icon: Globe,        label: 'Platform',         hex: '#5EEAD4', bg: 'rgba(20,184,166,0.15)',  border: 'rgba(20,184,166,0.3)' },
  SRE:       { icon: Activity,     label: 'SRE',              hex: '#F9A8D4', bg: 'rgba(236,72,153,0.15)',  border: 'rgba(236,72,153,0.3)' },
  MANAGEMENT:{ icon: Briefcase,    label: 'Management',       hex: '#94A3B8', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)' },
  OTHER:     { icon: Users,        label: 'General',          hex: '#A5B4FC', bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.3)' },
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

const roleDarkStyles: Record<string, React.CSSProperties> = {
  LEAD:     { background: 'rgba(217,119,6,0.15)',  color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' },
  MEMBER:   { background: 'rgba(99,102,241,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(99,102,241,0.3)' },
  OBSERVER: { background: 'rgba(100,116,139,0.15)',color: 'var(--argus-muted)', border: '1px solid rgba(100,116,139,0.3)' },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative rounded-2xl shadow-2xl w-full max-w-lg p-0 animate-slide-in" style={{ background: '#0C0A18', border: '1px solid rgba(139,92,246,0.25)' }} onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--argus-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
              <Users className="w-4 h-4 text-ink" />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--argus-ink)' }}>Create New Team</h2>
              <p className="text-xs" style={{ color: 'var(--argus-muted)' }}>Add a team to your organization</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--argus-muted)' }}>
            <X className="w-5 h-5" />
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

          <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid var(--argus-border)' }}>
            <button
              type="submit"
              disabled={!name.trim() || createTeam.isPending}
              className="flex items-center gap-2 flex-1 justify-center px-4 py-2 rounded-xl text-sm font-semibold text-ink disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(90deg, #8B5CF6, #6366F1)' }}
            >
              {createTeam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {createTeam.isPending ? 'Creating...' : 'Create Team'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium transition-all" style={{ color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }}>Cancel</button>
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

  const workloadColor = totalWorkload > 10 ? '#FCA5A5' : totalWorkload > 5 ? '#FCD34D' : '#6EE7B7';

  return (
    <div className="rounded-xl transition-all duration-200" style={{ background: 'var(--argus-elevated)', border: expanded ? `1px solid ${def.border}` : '1px solid rgba(255,255,255,0.08)' }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
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
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl transition-all" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
                    <div className="relative shrink-0">
                      <div className={clsx('w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-[11px] font-bold text-white', member.gradClass)}>
                        {member.avatar}
                      </div>
                      {member.role === 'LEAD' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#D97706', border: '2px solid #0C0A18' }}>
                          <Crown className="w-2 h-2 text-ink" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--argus-ink)' }}>{member.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={roleDarkStyles[member.role] || roleDarkStyles.MEMBER}>
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

  // Fetch orgs for admin view
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => { const { data } = await api.get('/organizations'); return data; },
    staleTime: 60000,
    enabled: user?.role === 'ADMIN',
  });

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ background: 'var(--argus-surface)', minHeight: '100vh' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#8B5CF6' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--argus-muted)' }}>Loading teams...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ background: 'var(--argus-surface)', minHeight: '100vh', color: 'var(--argus-crimson)' }}>
        <AlertTriangle className="w-10 h-10 mb-3" />
        <p className="text-lg font-semibold">Failed to load teams</p>
        <p className="text-sm mt-1" style={{ color: 'var(--argus-muted)' }}>Please check your connection and try again.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-0" style={{ background: 'var(--argus-surface)', minHeight: '100vh', padding: '1.5rem' }}>
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden mb-5" style={{ background: 'var(--argus-surface)', border: '1px solid rgba(139,92,246,0.15)' }}>
        {/* 3px accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #8B5CF6, #6366F1, transparent)' }} />
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        {/* Glow orbs */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)' }} />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--argus-elevated)' }}>
                  <Users size={16} style={{ color: '#A78BFA' }} />
                </div>
                <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--argus-ink)' }}>Teams</h1>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ color: '#A78BFA', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.2)' }}>RBAC</span>
              </div>
              <p className="text-sm ml-[42px]" style={{ color: 'var(--argus-muted)' }}>Manage teams, members, and on-call assignments across your organization</p>
            </div>
            {canManage && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-ink transition-all duration-200 hover:scale-[1.02]"
                style={{ background: 'linear-gradient(90deg, #8B5CF6, #6366F1)' }}
              >
                <Plus className="w-4 h-4" /> Create Team
              </button>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-4 ml-[42px]">
            {[
              { label: 'Teams', value: teams.length, sub: `${activeTeams} active` },
              { label: 'Members', value: totalMembers, sub: 'across all teams' },
              { label: 'Workload', value: totalWorkload, sub: 'open items' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
                <div>
                  <p className="text-xl font-bold font-display" style={{ color: 'var(--argus-ink)' }}>{s.value}</p>
                  <p className="text-[10px]" style={{ color: 'var(--argus-muted)' }}>{s.label}</p>
                </div>
                <span className="text-[9px] font-mono" style={{ color: 'var(--argus-muted)' }}>{s.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="h-0.5 -mt-5 mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)' }} />

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap p-3 rounded-xl" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', backdropFilter: 'blur(8px)' }}>
        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--argus-dim)' }} />
          <input
            type="text"
            placeholder="Search teams or members..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none transition-all"
            style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)' }}
          />
        </div>

        <div className="h-5 w-px" style={{ background: 'var(--argus-elevated)' }} />

        {/* Type filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter('ALL')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={typeFilter === 'ALL'
              ? { background: 'rgba(139,92,246,0.2)', color: 'var(--argus-signal)', border: '1px solid rgba(139,92,246,0.4)' }
              : { background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }}
          >
            All <span className="text-[10px] opacity-60 ml-1">{teams.length}</span>
          </button>
          {Object.entries(TEAM_TYPES).filter(([k]) => k !== 'OTHER' && (typeCounts[k] || 0) > 0).map(([key, def]) => {
            const Icon = def.icon;
            const isActive = typeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={isActive
                  ? { background: def.bg, color: def.hex, border: `1px solid ${def.border}` }
                  : { background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }}
              >
                <Icon className="w-3 h-3" /> {def.label} <span className="text-[10px] opacity-60">{typeCounts[key] || 0}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xs ml-auto font-mono" style={{ color: 'var(--argus-muted)' }}>{filtered.length} team{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Team cards ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--argus-dim)' }} />
          <p className="text-lg font-semibold" style={{ color: 'var(--argus-muted)' }}>No teams found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--argus-muted)' }}>
            {searchQuery || typeFilter !== 'ALL' ? 'Try adjusting your filters' : 'Create your first team to get started'}
          </p>
          {canManage && !searchQuery && typeFilter === 'ALL' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-ink"
              style={{ background: 'linear-gradient(90deg, #8B5CF6, #6366F1)' }}
            >
              <Plus className="w-4 h-4" /> Create Team
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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

      {/* Create Team Modal */}
      <CreateTeamModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
