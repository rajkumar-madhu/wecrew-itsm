import { NavLink, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, AlertTriangle, GitBranch, Bug, Bell,
  Server, Network, Brain, Zap, BarChart3, Plug, Users,
  Settings, ChevronLeft, ChevronRight, Shield, Layers,
  MessageSquare, Mic, Activity, LogOut, Phone, MessagesSquare,
  Monitor, CalendarDays, CalendarClock, GitMerge, Terminal,
  BookOpen, Clock, FileSearch, UserCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import OrgSwitcher from './OrgSwitcher';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  isMobile?: boolean;
  onNavigate?: () => void;
}

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  end?: boolean;
  roles?: string[];
  badge?: string;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Self-Service',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/incidents', icon: AlertTriangle, label: 'Incidents' },
      { to: '/problems', icon: Bug, label: 'Problems' },
      { to: '/changes', icon: GitBranch, label: 'Changes' },
      { to: '/changes/calendar', icon: CalendarDays, label: 'Change calendar' },
      { to: '/knowledge-base', icon: BookOpen, label: 'Knowledge' },
    ],
  },
  {
    label: 'IT Operations',
    items: [
      { to: '/alerts', icon: Bell, label: 'Alerts' },
      { to: '/assets', icon: Server, label: 'CMDB / Assets' },
      { to: '/network', icon: Network, label: 'Network' },
      { to: '/metrics', icon: Activity, label: 'Metrics' },
      { to: '/apm', icon: Activity, label: 'Service health', badge: 'Live' },
      { to: '/k8s', icon: Layers, label: 'Kubernetes' },
      { to: '/logs', icon: Terminal, label: 'Log explorer' },
      { to: '/noc', icon: Monitor, label: 'NOC' },
      { to: '/integrations', icon: Plug, label: 'Integrations', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Service delivery',
    items: [
      { to: '/sla', icon: Clock, label: 'SLA policies' },
      { to: '/oncall', icon: Phone, label: 'On-call' },
      { to: '/oncall-calendar', icon: CalendarDays, label: 'On-call calendar' },
      { to: '/escalation', icon: GitMerge, label: 'Escalation' },
      { to: '/maintenance', icon: CalendarClock, label: 'Maintenance' },
      { to: '/chat', icon: MessagesSquare, label: 'Team chat' },
      { to: '/sms', icon: MessageSquare, label: 'SMS gateway' },
      { to: '/voice', icon: Mic, label: 'Voice agent' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/ai-insights', icon: Brain, label: 'AI insights' },
      { to: '/automation', icon: Zap, label: 'Automation' },
      { to: '/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/teams', icon: Users, label: 'Teams' },
      { to: '/users', icon: Shield, label: 'Users', roles: ['ADMIN', 'MANAGER'] },
      { to: '/audit', icon: FileSearch, label: 'Audit log', roles: ['ADMIN', 'MANAGER'] },
      { to: '/profile', icon: UserCircle, label: 'My profile' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

function getBadgeStyle(badge: string): React.CSSProperties {
  if (badge === 'Live' || badge === 'LIVE') {
    return {
      color: '#7eb6ff',
      background: 'rgba(27,111,212,0.25)',
      border: '1px solid rgba(126,182,255,0.25)',
    };
  }
  return {
    color: '#a8b3c4',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
  };
}

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen = false,
  isMobile = false,
  onNavigate,
}: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const userRole = user?.role || 'VIEWER';
  const initials = user
    ? `${(user.firstName?.[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}`
    : 'U';

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen h-[100dvh] z-50 flex flex-col transition-transform duration-200 ease-out',
        isMobile ? 'w-[min(280px,88vw)]' : collapsed ? 'w-[56px]' : 'w-[240px]',
        isMobile && !mobileOpen && '-translate-x-full',
        isMobile && mobileOpen && 'translate-x-0 shadow-2xl',
        !isMobile && 'translate-x-0'
      )}
      style={{
        background: 'var(--argus-nav-bg)',
        borderRight: '1px solid var(--argus-nav-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-3 h-12 shrink-0"
        style={{ borderBottom: '1px solid var(--argus-nav-border)' }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-white"
          style={{ background: 'var(--argus-coral)' }}
        >
          <Shield size={15} strokeWidth={2} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-body font-semibold text-[13px] text-white tracking-tight leading-none">
              WeCrew Ops
            </p>
            <p
              className="font-mono text-[9px] mt-1 leading-none uppercase tracking-[0.14em]"
              style={{ color: 'var(--argus-nav-group)' }}
            >
              ITSM
            </p>
          </div>
        )}
      </div>

      {!collapsed && <OrgSwitcher />}

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || item.roles.includes(userRole)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {!collapsed ? (
                <p
                  className="px-2.5 mb-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em]"
                  style={{ color: 'var(--argus-nav-group)' }}
                >
                  {group.label}
                </p>
              ) : (
                <div className="h-px mx-2 mb-2" style={{ background: 'var(--argus-nav-border)' }} />
              )}

              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => onNavigate?.()}
                    className="block"
                  >
                    {({ isActive }) => (
                      <div
                        className={clsx(
                          'flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] font-medium transition-colors cursor-pointer',
                          collapsed && 'justify-center px-0'
                        )}
                        style={
                          isActive
                            ? {
                                background: 'var(--argus-nav-active-bg)',
                                color: 'var(--argus-nav-active)',
                              }
                            : { color: 'var(--argus-nav-idle)' }
                        }
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                            e.currentTarget.style.color = 'var(--argus-nav-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--argus-nav-idle)';
                          }
                        }}
                      >
                        <item.icon
                          className="w-[17px] h-[17px] shrink-0"
                          style={{
                            color: isActive
                              ? 'var(--argus-nav-icon-active)'
                              : 'var(--argus-nav-icon)',
                          }}
                        />
                        {!collapsed && (
                          <>
                            <span className="truncate flex-1">{item.label}</span>
                            {item.badge && (
                              <span
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={getBadgeStyle(item.badge)}
                              >
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div
        className="p-2 shrink-0 space-y-1"
        style={{ borderTop: '1px solid var(--argus-nav-border)' }}
      >
        {user && !collapsed && (
          <div
            className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer"
            onClick={() => go('/profile')}
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: 'var(--argus-signal)' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium truncate text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] truncate" style={{ color: 'var(--argus-nav-group)' }}>
                {user.role}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                logout();
              }}
              className="p-1.5 rounded-md"
              title="Log out"
              style={{ color: 'var(--argus-nav-icon)' }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs transition-colors min-h-[40px]"
          style={{ color: 'var(--argus-nav-idle)' }}
          aria-label={isMobile ? 'Close menu' : collapsed ? 'Expand navigator' : 'Collapse navigator'}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--argus-nav-idle)';
          }}
        >
          {isMobile ? (
            <ChevronLeft className="w-4 h-4" />
          ) : collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
