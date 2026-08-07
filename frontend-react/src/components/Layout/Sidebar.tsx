import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, AlertTriangle, GitBranch, Bug, Bell,
  Server, Network, Brain, Zap, BarChart3, Plug, Users,
  Settings, ChevronLeft, ChevronRight, Shield, Eye,
  MessageSquare, Mic, Activity, LogOut, Phone, Layers, MessagesSquare,
  Monitor, CalendarDays, CalendarClock, GitMerge, Terminal,
  BookOpen, Clock, FileSearch, UserCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import OrgSwitcher from './OrgSwitcher';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  icon: React.ComponentType<any>;
  label: string;
  end?: boolean;
  roles?: string[];
  badge?: string;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'OPERATIONS',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/incidents', icon: AlertTriangle, label: 'Incidents' },
      { to: '/changes', icon: GitBranch, label: 'Changes' },
      { to: '/changes/calendar', icon: CalendarDays, label: 'Change Calendar' },
      { to: '/sla', icon: Clock, label: 'SLA Policies' },
      { to: '/problems', icon: Bug, label: 'Problems' },
      { to: '/oncall', icon: Phone, label: 'On-Call' },
      { to: '/oncall-calendar', icon: CalendarDays, label: 'On-Call Calendar' },
      { to: '/escalation', icon: GitMerge, label: 'Escalation Policies' },
      { to: '/maintenance', icon: CalendarClock, label: 'Maintenance Windows' },
    ],
  },
  {
    label: 'MONITORING',
    items: [
      { to: '/alerts', icon: Bell, label: 'Alerts' },
      { to: '/assets', icon: Server, label: 'Assets / CMDB' },
      { to: '/network', icon: Network, label: 'Network' },
      { to: '/metrics', icon: Activity, label: 'Metrics' },
      { to: '/apm', icon: Eye, label: 'Service Health', badge: 'LIVE' },
      { to: '/k8s', icon: Layers, label: 'Kubernetes' },
      { to: '/logs', icon: Terminal, label: 'Log Explorer', badge: 'NEW' },
      { to: '/noc', icon: Monitor, label: 'NOC View', badge: 'LIVE' },
      { to: '/pagerduty', icon: Bell, label: 'PagerDuty' },
    ],
  },
  {
    label: 'COMMUNICATIONS',
    items: [
      { to: '/chat', icon: MessagesSquare, label: 'Team Chat', badge: 'LIVE' },
      { to: '/sms', icon: MessageSquare, label: 'SMS Gateway' },
      { to: '/voice', icon: Mic, label: 'Voice Agent' },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { to: '/ai-insights', icon: Brain, label: 'AI Insights', badge: 'AI' },
      { to: '/automation', icon: Zap, label: 'Automation' },
      { to: '/knowledge-base', icon: BookOpen, label: 'Knowledge Base' },
      { to: '/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    label: 'PLATFORM',
    items: [
      { to: '/integrations', icon: Plug, label: 'Integrations', roles: ['ADMIN'] },
      { to: '/teams', icon: Users, label: 'Teams' },
      { to: '/users', icon: Shield, label: 'Users', roles: ['ADMIN', 'MANAGER'] },
      { to: '/audit', icon: FileSearch, label: 'Audit Log', roles: ['ADMIN', 'MANAGER'] },
      { to: '/profile', icon: UserCircle, label: 'My Profile' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

function getBadgeStyle(badge: string): React.CSSProperties {
  if (badge === 'LIVE') return {
    color: '#FF4D6A',
    background: 'rgba(255,77,106,0.12)',
    border: '1px solid rgba(255,77,106,0.3)',
  };
  if (badge === 'AI') return {
    color: '#A78BFA',
    background: 'rgba(167,139,250,0.12)',
    border: '1px solid rgba(167,139,250,0.3)',
  };
  if (badge === 'NEW') return {
    color: '#34D399',
    background: 'rgba(52,211,153,0.12)',
    border: '1px solid rgba(52,211,153,0.3)',
  };
  return {
    color: '#94B4CC',
    background: 'rgba(99,179,255,0.08)',
    border: '1px solid rgba(99,179,255,0.16)',
  };
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const userRole = user?.role || 'VIEWER';
  const initials = user
    ? `${(user.firstName?.[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}`
    : 'U';

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
      style={{
        background: '#07101E',
        borderRight: '1px solid rgba(99,179,255,0.08)',
      }}
    >
      {/* ── Top ambient glow ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '128px',
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% -20%, rgba(79,70,229,0.15) 0%, transparent 70%)',
          zIndex: 0,
        }}
      />

      {/* ── Brand ── */}
      <div
        className="flex items-center gap-3 px-4 h-14 shrink-0 relative z-10"
        style={{ borderBottom: '1px solid rgba(99,179,255,0.08)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #4F46E5, #7C3AED)',
            boxShadow: '0 0 12px rgba(79,70,229,0.4)',
          }}
        >
          <Eye className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span
              className="font-display font-bold text-[15px] tracking-tight"
              style={{ color: '#E2EEF9' }}
            >
              WeCrew
            </span>
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{
                color: '#818CF8',
                background: 'rgba(79,70,229,0.2)',
                border: '1px solid rgba(79,70,229,0.4)',
              }}
            >
              ITSM
            </span>
          </div>
        )}
      </div>

      {/* ── Org Switcher (Admin only) ── */}
      {!collapsed && <OrgSwitcher />}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4 scrollbar-thin relative z-10">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || item.roles.includes(userRole)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {!collapsed ? (
                <div className="flex items-center gap-2 px-3 mb-1.5">
                  <span
                    className="text-[9px] font-black tracking-[0.18em] uppercase whitespace-nowrap"
                    style={{ color: '#5A7D99' }}
                  >
                    {group.label}
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{ background: 'rgba(99,179,255,0.06)' }}
                  />
                </div>
              ) : (
                <div
                  className="h-px mx-2 mb-2"
                  style={{ background: 'rgba(99,179,255,0.06)' }}
                />
              )}

              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className="block relative"
                  >
                    {({ isActive }) => (
                      <div
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer group relative overflow-hidden',
                          collapsed && 'justify-center'
                        )}
                        style={
                          isActive
                            ? {
                                background: 'rgba(79,70,229,0.12)',
                                color: '#E2EEF9',
                              }
                            : {
                                color: '#4A6F8A',
                              }
                        }
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'rgba(99,179,255,0.05)';
                            e.currentTarget.style.color = '#94B4CC';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#4A6F8A';
                          }
                        }}
                      >
                        {/* Active left accent bar */}
                        {isActive && (
                          <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                            style={{
                              background: '#4F46E5',
                              boxShadow: '0 0 8px rgba(79,70,229,0.4)',
                            }}
                          />
                        )}

                        <item.icon
                          className="w-[18px] h-[18px] shrink-0 transition-colors"
                          style={{ color: isActive ? '#818CF8' : '#2A4A63' }}
                        />

                        {!collapsed && (
                          <>
                            <span className="truncate flex-1">{item.label}</span>
                            {item.badge && (
                              <span
                                className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
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

      {/* ── User + Collapse ── */}
      <div
        className="p-2.5 shrink-0 space-y-1 relative z-10"
        style={{ borderTop: '1px solid rgba(99,179,255,0.08)' }}
      >
        {user && !collapsed && (
          <div
            className="flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer"
            onClick={() => navigate('/profile')}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(99,179,255,0.10)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                boxShadow: '0 0 8px rgba(79,70,229,0.3)',
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[12px] font-semibold truncate"
                style={{ color: '#E2EEF9' }}
              >
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] font-mono" style={{ color: '#2A4A63' }}>
                {user.role}
              </p>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-md transition-colors"
              title="Logout"
              style={{ color: '#2A4A63' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#FF4D6A';
                e.currentTarget.style.background = 'rgba(255,77,106,0.10)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#2A4A63';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Collapse button */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-all duration-150"
          style={{ color: '#2A4A63' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#4A6F8A';
            e.currentTarget.style.background = 'rgba(99,179,255,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#2A4A63';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Collapse</span>
              </>
            )
          }
        </button>
      </div>
    </aside>
  );
}
