import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Users, UserPlus, Search, X, ChevronLeft, ChevronRight, Shield,
  ShieldOff, Pencil, Lock, Unlock, MoreHorizontal, Trash2, KeyRound,
  AlertTriangle, Loader2, Filter, Building2, Clock, Activity,
  Mail, Phone, Globe, Crown, CheckCircle, XCircle, Ban,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import type { User, Role, UserStatus } from '../../types';

// ── Constants ──
const ALL_ROLES: Role[] = ['ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR', 'VIEWER'];
const ALL_STATUSES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];

const roleBadgeConfig: Record<Role, { cls: string; icon: any; label: string }> = {
  ADMIN:    { cls: 'bg-[#FEF2F2] text-[#EF4444] border-[#FECACA]', icon: Crown,    label: 'Admin' },
  MANAGER:  { cls: 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]', icon: Shield,   label: 'Manager' },
  ENGINEER: { cls: 'bg-[#EEF2FF] text-[#6366F1] border-[#C7D2FE]', icon: Activity, label: 'Engineer' },
  OPERATOR: { cls: 'bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]', icon: Globe,    label: 'Operator' },
  VIEWER:   { cls: 'bg-[#F1F5F9] text-muted border-[#CBD5E1]', icon: Users,    label: 'Viewer' },
};

const statusConfig: Record<UserStatus, { dot: string; icon: any; label: string; cls: string }> = {
  ACTIVE:   { dot: 'bg-[#10B981]', icon: CheckCircle, label: 'Active',   cls: 'text-[#10B981]' },
  INACTIVE: { dot: 'bg-[#94A3B8]', icon: XCircle,     label: 'Inactive', cls: 'text-muted' },
  LOCKED:   { dot: 'bg-[#EF4444]', icon: Ban,         label: 'Locked',   cls: 'text-[#EF4444]' },
};

// ── Helpers ──
function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || '??';
}

function getFullName(user: User): string {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const avatarGradients = [
  'from-[#6366F1] to-[#8B5CF6]', 'from-[#10B981] to-[#14B8A6]',
  'from-[#F59E0B] to-[#F97316]', 'from-[#EF4444] to-[#EC4899]',
  'from-[#0EA5E9] to-[#6366F1]', 'from-[#8B5CF6] to-[#EC4899]',
];

function avatarGrad(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return avatarGradients[Math.abs(h) % avatarGradients.length];
}

// ── Debounce ──
function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDv(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return dv;
}

// ── Skeleton Row ──
function SkeletonRow() {
  return (
    <tr className="border-b border-[#F1F5F9] animate-pulse">
      <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[#E2E8F0]" /><div className="space-y-1.5"><div className="h-3.5 bg-[#E2E8F0] rounded w-28" /><div className="h-3 bg-[#F1F5F9] rounded w-36" /></div></div></td>
      <td className="px-5 py-3.5"><div className="h-5 bg-[#E2E8F0] rounded w-20" /></td>
      <td className="px-5 py-3.5"><div className="h-4 bg-[#E2E8F0] rounded w-16" /></td>
      <td className="px-5 py-3.5"><div className="h-4 bg-[#E2E8F0] rounded w-24" /></td>
      <td className="px-5 py-3.5"><div className="h-4 bg-[#E2E8F0] rounded w-20" /></td>
      <td className="px-5 py-3.5"><div className="h-4 bg-[#E2E8F0] rounded w-6 mx-auto" /></td>
      <td className="px-5 py-3.5"><div className="h-4 bg-[#E2E8F0] rounded w-16" /></td>
    </tr>
  );
}

// ── Actions Dropdown ──
function ActionsDropdown({ user, onEdit, onToggleLock }: { user: User; onEdit: (u: User) => void; onToggleLock: (u: User) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback((e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }, []);
  useEffect(() => { if (open) document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, [open, close]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg text-muted hover:text-[color:var(--argus-ink)] hover:bg-[#F1F5F9] transition-colors" title="More actions">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E2E8F0] rounded-xl py-1 shadow-xl z-30 animate-fade-in">
          <button onClick={() => { onEdit(user); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dim hover:bg-[#F8FAFC] transition-colors">
            <Pencil className="w-3.5 h-3.5 text-muted" /> Edit User
          </button>
          <button onClick={() => { onToggleLock(user); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dim hover:bg-[#F8FAFC] transition-colors">
            {user.status === 'LOCKED' ? <><Unlock className="w-3.5 h-3.5 text-[#10B981]" /> Unlock Account</> : <><Lock className="w-3.5 h-3.5 text-[#F59E0B]" /> Lock Account</>}
          </button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dim hover:bg-[#F8FAFC] transition-colors">
            <Mail className="w-3.5 h-3.5 text-[#6366F1]" /> Send Invite
          </button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dim hover:bg-[#F8FAFC] transition-colors">
            <KeyRound className="w-3.5 h-3.5 text-[#0EA5E9]" /> Reset Password
          </button>
          <div className="border-t border-[#F1F5F9] my-1" />
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Deactivate
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function UserList() {
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const debouncedSearch = useDebounce(searchInput, 350);
  const currentUser = useAuthStore(s => s.user);

  useEffect(() => { setPage(1); }, [debouncedSearch, roleFilter, statusFilter]);

  const queryParams = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: pageSize };
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (roleFilter !== 'ALL') p.role = roleFilter;
    if (statusFilter !== 'ALL') p.status = statusFilter;
    return p;
  }, [page, pageSize, debouncedSearch, roleFilter, statusFilter]);

  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: ['users', queryParams],
    queryFn: async () => {
      const sp = new URLSearchParams();
      Object.entries(queryParams).forEach(([k, v]) => { if (v != null && v !== '') sp.append(k, String(v)); });
      const { data } = await api.get(`/auth/users?${sp}`);
      return data;
    },
    staleTime: 30000,
  });

  const users: User[] = response?.data ?? [];
  const pagination = response?.pagination ?? { total: 0, page: 1, limit: pageSize, totalPages: 1 };
  const totalCount = pagination.total ?? 0;
  const totalPages = Math.max(1, pagination.totalPages ?? Math.ceil(totalCount / pageSize));
  const hasFilters = searchInput.trim() !== '' || roleFilter !== 'ALL' || statusFilter !== 'ALL';

  const clearFilters = () => { setSearchInput(''); setRoleFilter('ALL'); setStatusFilter('ALL'); setPage(1); };
  const handleEdit = (_u: User) => {};
  const handleToggleLock = (_u: User) => {};

  // Compute role distribution for hero stats
  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    ALL_ROLES.forEach(r => { c[r] = 0; });
    users.forEach(u => { c[u.role] = (c[u.role] || 0) + 1; });
    return c;
  }, [users]);

  if (isError) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="relative rounded-2xl overflow-hidden bg-obsidian text-ink border border-[color:var(--argus-border)] p-6">
          <h1 className="font-display text-2xl font-bold text-ink flex items-center gap-3"><Shield className="w-6 h-6 text-signal" /> User Management</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-[#EF4444]">
          <AlertTriangle className="w-10 h-10 mb-3" />
          <p className="text-lg font-semibold">Failed to load users</p>
          <p className="text-sm text-muted mt-1">{(error as any)?.response?.data?.error || 'Check your connection.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-obsidian text-ink border border-[color:var(--argus-border)]">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-[color:var(--argus-signal)]/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#8B5CF6]/6 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-[color:var(--argus-elevated)] flex items-center justify-center">
                  <Shield size={16} className="text-signal" />
                </div>
                <h1 className="font-display text-2xl font-bold text-ink tracking-tight">User Management</h1>
                <span className="text-[9px] font-mono font-bold text-signal bg-[color:var(--argus-signal)]/15 px-1.5 py-0.5 rounded border border-[#6366F1]/20">IAM</span>
              </div>
              <p className="text-muted text-sm ml-[42px]">
                {isLoading ? 'Loading users...' : <>Manage accounts, roles & permissions across your organization &middot; <span className="font-mono text-ink font-bold">{totalCount}</span> users</>}
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-[#6366F1]/25 transition-all duration-200 hover:scale-[1.02]">
              <UserPlus className="w-4 h-4" /> Invite User
            </button>
          </div>

          {/* Role distribution pills */}
          <div className="flex items-center gap-3 mt-4 ml-[42px]">
            {ALL_ROLES.map(role => {
              const cfg = roleBadgeConfig[role];
              const RoleIcon = cfg.icon;
              return (
                <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)]">
                  <RoleIcon className="w-3.5 h-3.5 text-muted" />
                  <div>
                    <p className="text-sm font-bold text-ink font-display">{roleCounts[role] || 0}</p>
                    <p className="text-[9px] text-muted uppercase tracking-wider">{cfg.label}</p>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)]">
              <Shield className="w-3.5 h-3.5 text-[#10B981]" />
              <div>
                <p className="text-sm font-bold text-ink font-display">{users.filter(u => u.mfaEnabled).length}</p>
                <p className="text-[9px] text-muted uppercase tracking-wider">MFA On</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-[#6366F1]/60 to-transparent" />

      {/* ── FILTER BAR ── */}
      <div className="-mt-3 relative z-10 bg-white/95 backdrop-blur-xl rounded-xl border border-[#E2E8F0] shadow-sm p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by name, email, or department..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#FAFBFC] border border-[#E2E8F0] rounded-lg text-sm text-[color:var(--argus-ink)] placeholder-[#94A3B8] focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10 transition-all"
            />
          </div>

          <div className="w-px h-7 bg-[#E2E8F0] hidden sm:block" />
          <div className="flex items-center gap-1.5 text-muted">
            <Filter size={13} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">Filters</span>
          </div>

          {/* Role filter pills */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={clsx('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                roleFilter === 'ALL' ? 'bg-obsidian text-ink border border-[color:var(--argus-border)] border-[color:var(--argus-border)]' : 'bg-white text-muted border-[#E2E8F0] hover:border-[#CBD5E1]'
              )}
            >
              All Roles
            </button>
            {ALL_ROLES.map(role => {
              const cfg = roleBadgeConfig[role];
              return (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={clsx('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    roleFilter === role ? `${cfg.cls}` : 'bg-white text-muted border-[#E2E8F0] hover:border-[#CBD5E1]'
                  )}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="w-px h-7 bg-[#E2E8F0] hidden sm:block" />

          {/* Status pills */}
          {ALL_STATUSES.map(s => {
            const sc = statusConfig[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
                className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  statusFilter === s ? `bg-[#F8FAFC] ${sc.cls} border-current` : 'bg-white text-muted border-[#E2E8F0] hover:border-[#CBD5E1]'
                )}
              >
                <div className={clsx('w-1.5 h-1.5 rounded-full', sc.dot)} /> {sc.label}
              </button>
            );
          })}

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-[#EF4444] hover:bg-[#FEF2F2] rounded-lg border border-transparent hover:border-[#FECACA] transition-all">
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Data Table ── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#FAFBFC]">
                <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">User</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Role</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Organization</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Department</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Last Login</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold text-muted uppercase tracking-wider">MFA</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted">
                      <Users className="w-10 h-10 text-ink" />
                      <p className="text-lg font-medium text-muted">No users found</p>
                      <p className="text-sm">{hasFilters ? 'Try adjusting your filters.' : 'No users have been created yet.'}</p>
                      {hasFilters && <button onClick={clearFilters} className="btn-ghost text-sm mt-1">Clear all filters</button>}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(user => {
                  const initials = getInitials(user.firstName, user.lastName);
                  const fullName = getFullName(user);
                  const grad = avatarGrad(user.id);
                  const roleCfg = roleBadgeConfig[user.role];
                  const statusCfg = statusConfig[user.status];
                  const StatusIcon = statusCfg.icon;
                  const org = (user as any).organization;
                  const isCurrentUser = currentUser?.id === user.id;

                  return (
                    <tr key={user.id} className={clsx('border-b border-[#F1F5F9] hover:bg-[#FAFBFC] transition-colors group', isCurrentUser && 'bg-[#EEF2FF]/30')}>
                      {/* User */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className={clsx('w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-[11px] font-bold text-white', grad)}>
                              {user.avatar ? <img src={user.avatar} alt={fullName} className="w-9 h-9 rounded-full object-cover" /> : initials}
                            </div>
                            <div className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', statusCfg.dot)} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-[color:var(--argus-ink)] truncate">{fullName}</p>
                              {isCurrentUser && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#EEF2FF] text-[#6366F1] border border-[#C7D2FE]">YOU</span>}
                            </div>
                            <p className="text-xs text-muted truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5">
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border', roleCfg.cls)}>
                          {user.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={clsx('w-3.5 h-3.5', statusCfg.cls)} />
                          <span className={clsx('text-xs font-medium', statusCfg.cls)}>{statusCfg.label}</span>
                        </div>
                      </td>

                      {/* Organization */}
                      <td className="px-5 py-3.5">
                        {org ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-muted" />
                            <span className="text-xs text-dim font-medium truncate max-w-[120px]">{org.name}</span>
                            {org.environment && (
                              <span className={clsx('text-[8px] font-bold px-1 py-0.5 rounded',
                                org.environment === 'PROD' ? 'bg-[#ECFDF5] text-[#10B981]' :
                                org.environment === 'DR' ? 'bg-[#FEF3C7] text-[#D97706]' :
                                org.environment === 'UAT' ? 'bg-[#EEF2FF] text-[#6366F1]' :
                                'bg-[#F1F5F9] text-muted'
                              )}>
                                {org.environment}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-ink">Global</span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-5 py-3.5">
                        {user.department
                          ? <span className="text-xs text-dim">{user.department}</span>
                          : <span className="text-ink">&mdash;</span>
                        }
                      </td>

                      {/* Last Login */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-ink" />
                          <span className="text-xs text-muted whitespace-nowrap">{relativeTime(user.lastLogin)}</span>
                        </div>
                      </td>

                      {/* MFA */}
                      <td className="px-5 py-3.5 text-center">
                        {user.mfaEnabled
                          ? <span title="MFA enabled"><Shield className="w-4 h-4 text-[#10B981] mx-auto" /></span>
                          : <span title="MFA disabled"><ShieldOff className="w-4 h-4 text-ink mx-auto" /></span>
                        }
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEdit(user)} className="p-1.5 rounded-lg text-muted hover:text-[#6366F1] hover:bg-[#EEF2FF] transition-colors opacity-0 group-hover:opacity-100" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleLock(user)}
                            className={clsx('p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100',
                              user.status === 'LOCKED' ? 'text-muted hover:text-[#10B981] hover:bg-[#ECFDF5]' : 'text-muted hover:text-[#F59E0B] hover:bg-[#FEF3C7]'
                            )}
                            title={user.status === 'LOCKED' ? 'Unlock' : 'Lock'}
                          >
                            {user.status === 'LOCKED' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>
                          <ActionsDropdown user={user} onEdit={handleEdit} onToggleLock={handleToggleLock} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && users.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#E2E8F0] bg-[#FAFBFC]">
            <span className="text-xs text-muted">
              Showing <span className="font-medium text-[color:var(--argus-ink)]">{(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, totalCount)}</span> of <span className="font-medium text-[color:var(--argus-ink)]">{totalCount}</span>
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className={clsx('p-1.5 rounded-lg transition-colors', page === 1 ? 'text-ink cursor-not-allowed' : 'text-muted hover:text-[color:var(--argus-ink)] hover:bg-[#F1F5F9]')}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={clsx('w-8 h-8 rounded-lg text-xs font-medium transition-all',
                      page === p ? 'bg-obsidian text-ink border border-[color:var(--argus-border)]' : 'text-muted hover:bg-[#F1F5F9]'
                    )}>
                    {p}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="text-xs text-muted px-1">...</span>}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className={clsx('p-1.5 rounded-lg transition-colors', page >= totalPages ? 'text-ink cursor-not-allowed' : 'text-muted hover:text-[color:var(--argus-ink)] hover:bg-[#F1F5F9]')}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
