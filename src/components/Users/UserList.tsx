import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  UserPlus, Search, X, ChevronLeft, ChevronRight, Shield,
  ShieldOff, Pencil, Lock, Unlock, MoreHorizontal, Trash2, KeyRound,
  AlertTriangle, Building2, Clock,
  Mail,
} from 'lucide-react';
import api from '../../lib/api';
import { useUserCensus } from '../../hooks/useUsers';
import { useAuthStore } from '../../stores/authStore';
import { Page, Toolbar, GhostButton } from '../ui/PageChrome';
import type { User, Role, UserStatus } from '../../types';

// ── Constants ──
const ALL_ROLES: Role[] = ['ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR', 'VIEWER'];
const ALL_STATUSES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];

const roleLabel: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  ENGINEER: 'Engineer',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer',
};

const roleTone: Record<Role, 'danger' | 'warn' | 'alert' | 'ok' | 'neutral'> = {
  ADMIN: 'danger',
  MANAGER: 'warn',
  ENGINEER: 'alert',
  OPERATOR: 'ok',
  VIEWER: 'neutral',
};

const statusLabel: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  LOCKED: 'Locked',
};

const statusTone: Record<UserStatus, 'ok' | 'neutral' | 'danger'> = {
  ACTIVE: 'ok',
  INACTIVE: 'neutral',
  LOCKED: 'danger',
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
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, j) => (
        <td key={j}><div className="h-3.5 rounded bg-[color:var(--argus-elevated)] w-3/4" /></td>
      ))}
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
      <button type="button" onClick={() => setOpen(!open)} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] transition-colors" title="More actions">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 py-1 z-30 animate-fade-in" style={{ background: 'var(--argus-surface)', border: '1px solid var(--argus-border)', borderRadius: 'var(--cx-radius)', boxShadow: 'var(--argus-shadow-card)' }}>
          <button type="button" onClick={() => { onEdit(user); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-ink hover:bg-[color:var(--argus-elevated)]">
            <Pencil className="w-3.5 h-3.5 text-dim" /> Edit
          </button>
          <button type="button" onClick={() => { onToggleLock(user); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-ink hover:bg-[color:var(--argus-elevated)]">
            {user.status === 'LOCKED' ? <><Unlock className="w-3.5 h-3.5 text-emerald" /> Unlock</> : <><Lock className="w-3.5 h-3.5 text-amber" /> Lock</>}
          </button>
          <button type="button" className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-ink hover:bg-[color:var(--argus-elevated)]">
            <Mail className="w-3.5 h-3.5 text-dim" /> Send invite
          </button>
          <button type="button" className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-ink hover:bg-[color:var(--argus-elevated)]">
            <KeyRound className="w-3.5 h-3.5 text-dim" /> Reset password
          </button>
          <div className="border-t border-[color:var(--argus-border)] my-1" />
          <button type="button" className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-coral hover:bg-[color:var(--argus-coral-dim)]">
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

  // The hero counts claim to describe the organisation, so they cannot be
  // derived from `users` — that is one filtered page of twenty. This census is
  // deliberately unfiltered: narrowing the table to ENGINEERs should not report
  // that the organisation has no admins.
  const {
    data: censusData,
    isLoading: censusLoading,
    isError: censusFailed,
  } = useUserCensus<User>();

  const census: User[] = useMemo(() => censusData?.items ?? [], [censusData]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    ALL_ROLES.forEach(r => { c[r] = 0; });
    census.forEach(u => { c[u.role] = (c[u.role] || 0) + 1; });
    return c;
  }, [census]);

  const locked = users.filter((u) => u.status === 'LOCKED').length;
  const mfaOff = users.filter((u) => !u.mfaEnabled).length;
  const admins = roleCounts.ADMIN || 0;

  const kpis = [
    { label: 'Users', value: isLoading ? '—' : totalCount, sub: 'in this organisation' },
    { label: 'Admins', value: isLoading ? '—' : admins, sub: 'can change who else can' },
    { label: 'Locked', value: isLoading ? '—' : locked, sub: 'cannot sign in', tone: locked > 0 ? 'danger' : undefined },
    { label: 'MFA off', value: isLoading ? '—' : mfaOff, sub: 'password only', tone: mfaOff > 0 ? 'warn' : undefined },
    { label: 'On this page', value: isLoading ? '—' : users.length, sub: `page ${page} of ${totalPages}` },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Govern · identity</span>
            <h1 className="cx-hero__title">Users</h1>
            <p className="cx-hero__deck">
              Accounts, roles and who can still sign in. A locked user and a user without MFA are
              the two states this page exists to make visible.
            </p>
          </div>
          <button type="button" className="cx-hero__btn">
            <UserPlus size={14} strokeWidth={1.75} />
            Invite a user
          </button>
        </div>
        <dl className="cx-hero__kpis cx-hero__kpis--5 mt-6">
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
        <span className="cx-crumb__current">Users</span>
      </nav>

      <Toolbar>
        <div className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {isLoading ? '—' : `${totalCount} user${totalCount === 1 ? '' : 's'}`}
          </span>
          <span className="cx-listhead__count-meta">page {page} of {totalPages}</span>
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email or department..."
            className="input-field pl-8 py-1.5 text-[13px]"
          />
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <div className="flex items-center gap-1 flex-wrap">
          <GhostButton active={roleFilter === 'ALL'} onClick={() => setRoleFilter('ALL')}>All roles</GhostButton>
          {ALL_ROLES.map((role) => (
            <GhostButton key={role} active={roleFilter === role} onClick={() => setRoleFilter(role)}>
              {roleLabel[role]}
            </GhostButton>
          ))}
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        {ALL_STATUSES.map((s) => (
          <GhostButton key={s} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}>
            {statusLabel[s]}
          </GhostButton>
        ))}

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-[11px] text-dim hover:text-coral transition-colors ml-auto"
          >
            <X size={11} />
            Clear filters
          </button>
        )}
      </Toolbar>

      <div className="cx-table-wrap">
        <div className="overflow-x-auto">
          <table className="cx-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Organisation</th>
                <th>Department</th>
                <th>Last login</th>
                <th>MFA</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <AlertTriangle size={22} className="mx-auto mb-2 text-crimson" strokeWidth={1.75} />
                    <p className="text-sm text-ink font-medium">Users did not load</p>
                    <p className="text-xs text-muted mt-1">{(error as any)?.response?.data?.error || 'Reload the page to try again.'}</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <p className="text-sm text-ink font-medium">No users match these filters</p>
                    <p className="text-xs text-muted mt-1">
                      {hasFilters ? 'Clear the filters to see every account.' : 'Invite a user to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const initials = getInitials(user.firstName, user.lastName);
                  const fullName = getFullName(user);
                  const grad = avatarGrad(user.id);
                  const org = (user as any).organization;
                  const isCurrentUser = currentUser?.id === user.id;

                  return (
                    <tr key={user.id} className={clsx(isCurrentUser && 'bg-[color:var(--argus-signal-dim)]')}>
                      <td>
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="relative shrink-0">
                            <span className={clsx('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white', grad)}>
                              {user.avatar ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /> : initials}
                            </span>
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-ink font-medium">
                              {fullName}
                              {isCurrentUser && <span className="ml-1.5 text-[10px] font-mono uppercase tracking-wider text-signal">you</span>}
                            </span>
                            <span className="block truncate text-[11px] text-dim">{user.email}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className={clsx('cx-pill', `cx-pill--${roleTone[user.role]}`)}>{roleLabel[user.role]}</span>
                      </td>
                      <td>
                        <span className={clsx('cx-pill', `cx-pill--${statusTone[user.status]}`)}>{statusLabel[user.status]}</span>
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-muted">
                        {org ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 size={12} className="text-graphite" />
                            {org.name}
                          </span>
                        ) : 'Global'}
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-muted">{user.department || '—'}</td>
                      <td className="whitespace-nowrap font-mono text-[12px] text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={12} className="text-graphite" />
                          {relativeTime(user.lastLogin)}
                        </span>
                      </td>
                      <td>
                        {user.mfaEnabled
                          ? <span title="MFA on" className="text-emerald"><Shield size={15} strokeWidth={1.75} /></span>
                          : <span title="MFA off" className="text-coral"><ShieldOff size={15} strokeWidth={1.75} /></span>}
                      </td>
                      <td>
                        <span className="flex items-center justify-end gap-0.5">
                          <button type="button" onClick={() => handleEdit(user)} className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)]" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleLock(user)}
                            className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)]"
                            title={user.status === 'LOCKED' ? 'Unlock' : 'Lock'}
                          >
                            {user.status === 'LOCKED' ? <Unlock size={14} /> : <Lock size={14} />}
                          </button>
                          <ActionsDropdown user={user} onEdit={handleEdit} onToggleLock={handleToggleLock} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalCount > 0 && (
          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[color:var(--argus-border)]">
            <span className="text-[12px] text-muted">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="px-2 text-[12px] font-mono text-muted">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="p-1.5 rounded text-muted hover:text-ink hover:bg-[color:var(--argus-elevated)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
