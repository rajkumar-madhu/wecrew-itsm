import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Search, Bell, Command, LogOut, User, ChevronRight, Loader2, AlertTriangle, GitBranch, Bug, Server, Siren, CheckCheck, Menu, Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../stores/authStore';
import { useGlobalSearch } from '../../hooks/useSearch';
import { useUnreadCount, useNotifications, useMarkAsRead, useMarkAllAsRead } from '../../hooks/useNotifications';
import { useThemeStore } from '../../stores/themeStore';

const routeTitles: Record<string, string> = {
  '/': 'Mission Control',
  '/dashboard': 'Dashboard',
  '/incidents': 'Incidents',
  '/incidents/create': 'Create Incident',
  '/changes': 'Changes',
  '/changes/calendar': 'Change Calendar',
  '/changes/create': 'Create Change',
  '/problems': 'Problems',
  '/problems/create': 'Create Problem',
  '/oncall': 'On-Call',
  '/oncall-calendar': 'On-Call Calendar',
  '/escalation': 'Escalation Policies',
  '/maintenance': 'Maintenance Windows',
  '/alerts': 'Alerts',
  '/assets': 'Assets / CMDB',
  '/assets/create': 'Create Asset',
  '/network': 'Network Topology',
  '/metrics': 'Metrics',
  '/apm': 'Service Health',
  '/k8s': 'Kubernetes',
  '/logs': 'Log Explorer',
  '/noc': 'NOC',
  '/pagerduty': 'PagerDuty',
  '/chat': 'Team Chat',
  '/sms': 'SMS Gateway',
  '/voice': 'Voice Agent',
  '/ai-insights': 'AI Insights',
  '/automation': 'Automation',
  '/knowledge-base': 'Knowledge Base',
  '/reports': 'Reports',
  '/integrations': 'Integration Hub',
  '/teams': 'Teams',
  '/users': 'Users',
  '/audit': 'Audit Log',
  '/profile': 'My Profile',
  '/settings': 'Settings',
  '/sla': 'SLA Policies',
};

interface SearchResultItem {
  id: string;
  number?: string;
  title?: string;
  name?: string;
  subject?: string;
  description?: string;
  status?: string;
  priority?: string;
  severity?: string;
}

const resultGroups: { key: string; label: string; icon: React.ReactNode; route: string }[] = [
  { key: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-3.5 h-3.5" />, route: '/incidents' },
  { key: 'changes', label: 'Changes', icon: <GitBranch className="w-3.5 h-3.5" />, route: '/changes' },
  { key: 'problems', label: 'Problems', icon: <Bug className="w-3.5 h-3.5" />, route: '/problems' },
  { key: 'assets', label: 'Assets', icon: <Server className="w-3.5 h-3.5" />, route: '/assets' },
  { key: 'alerts', label: 'Alerts', icon: <Siren className="w-3.5 h-3.5" />, route: '/alerts' },
];

function getResultTitle(item: SearchResultItem): string {
  return item.title || item.subject || item.name || item.description || 'Untitled';
}

function getResultNumber(item: SearchResultItem): string {
  return item.number || item.id || '';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Light-themed notification styles
const notifStyles: Record<string, { bg: string; border: string; titleColor: string; textColor: string }> = {
  INCIDENT: {
    bg: 'rgba(225,29,72,0.08)',
    border: 'rgba(225,29,72,0.18)',
    titleColor: '#BE123C',
    textColor: '#64748B',
  },
  SLA: {
    bg: 'rgba(217,119,6,0.08)',
    border: 'rgba(217,119,6,0.18)',
    titleColor: '#B45309',
    textColor: '#64748B',
  },
  CHANGE: {
    bg: 'rgba(79,70,229,0.08)',
    border: 'rgba(79,70,229,0.18)',
    titleColor: '#4338CA',
    textColor: '#64748B',
  },
  ALERT: {
    bg: 'rgba(234,88,12,0.08)',
    border: 'rgba(234,88,12,0.18)',
    titleColor: '#C2410C',
    textColor: '#64748B',
  },
  DEFAULT: {
    bg: 'rgba(15,23,42,0.04)',
    border: 'rgba(15,23,42,0.10)',
    titleColor: '#334155',
    textColor: '#64748B',
  },
};

interface NotifItemProps {
  notification: import('../../hooks/useNotifications').Notification;
  onRead: (id: string) => void;
  onNavigate: () => void;
}

function NotifItem({ notification: n, onRead, onNavigate }: NotifItemProps) {
  const style = notifStyles[n.type] ?? notifStyles.DEFAULT;

  const inner = (
    <div
      className="mx-3 my-1.5 p-2.5 rounded-lg text-xs transition-opacity cursor-pointer"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        opacity: n.isRead ? 0.5 : 1,
      }}
      onClick={() => { if (!n.isRead) onRead(n.id); }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="font-semibold" style={{ color: style.titleColor }}>{n.title}</span>
          <p className="mt-0.5 truncate" style={{ color: style.textColor }}>{n.message}</p>
        </div>
        {!n.isRead && (
          <span
            className="w-1.5 h-1.5 mt-1 rounded-full shrink-0"
            style={{ background: 'var(--argus-signal)', boxShadow: '0 0 4px rgba(79,70,229,0.6)' }}
          />
        )}
      </div>
      <span className="text-[10px] mt-1 block" style={{ color: 'var(--argus-dim)' }}>{timeAgo(n.createdAt)}</span>
    </div>
  );

  if (n.link) {
    return <Link to={n.link} onClick={onNavigate}>{inner}</Link>;
  }
  return <div>{inner}</div>;
}

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export default function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const initials = user ? `${(user.firstName?.[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}` : 'U';
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User';
  const displayRole = user?.role || 'User';
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: searchData, isLoading: searchLoading } = useGlobalSearch(searchQuery);

  // Notifications
  const { data: unreadData }   = useUnreadCount();
  const { data: notifData }    = useNotifications();
  const markAsRead             = useMarkAsRead();
  const markAllAsRead          = useMarkAllAsRead();
  const unreadCount            = unreadData ?? 0;
  const notifications          = notifData?.data?.notifications ?? [];

  const pathSegments = location.pathname.split('/').filter(Boolean);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const results = searchData?.data?.results;
  const hasResults = results && resultGroups.some(g => {
    const arr = results[g.key as keyof typeof results];
    return Array.isArray(arr) && arr.length > 0;
  });

  const handleResultClick = (route: string, id: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(`${route}/${id}`);
  };

  return (
    <header
      className="sticky top-0 z-30 flex flex-col"
      style={{
        background: 'var(--argus-chrome)',
        borderBottom: '1px solid var(--argus-border)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="h-12 flex items-center justify-between gap-2 px-3 sm:px-4">
      {/* Left: Menu + Breadcrumbs */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuClick}
            className="p-2 -ml-1 rounded-lg transition-all shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            style={{ color: 'var(--argus-muted)' }}
            aria-label="Open navigation menu"
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--argus-ink)'; e.currentTarget.style.background = 'var(--argus-chrome-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--argus-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <nav className="flex items-center gap-1 text-[13px] min-w-0 overflow-hidden">
          {pathSegments.length === 0 ? (
            <span className="font-semibold truncate" style={{ color: 'var(--argus-ink)' }}>Dashboard</span>
          ) : (
            pathSegments.map((seg, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                {i > 0 && (
                  <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--argus-dim)' }} />
                )}
                <span
                  className={clsx(
                    'truncate',
                    i === pathSegments.length - 1 ? 'font-semibold' : 'font-normal hidden sm:inline'
                  )}
                  style={{ color: i === pathSegments.length - 1 ? 'var(--argus-ink)' : 'var(--argus-muted)' }}
                >
                  {seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')}
                </span>
              </span>
            ))
          )}
        </nav>
      </div>

      {/* Right: Search + Notifications + Profile */}
      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
        {/* Search Trigger */}
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 100); }}
          className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-lg text-[13px] transition-all min-h-[44px] sm:min-h-0"
          style={{
            background: 'var(--argus-elevated)',
            border: '1px solid var(--argus-border-strong)',
            color: 'var(--argus-muted)',
          }}
          aria-label="Search"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--argus-chrome-hover)';
            e.currentTarget.style.color = 'var(--argus-muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--argus-elevated)';
            e.currentTarget.style.color = 'var(--argus-muted)';
          }}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Search everything...</span>
          <kbd
            className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{
              background: 'var(--argus-chrome-hover)',
              border: '1px solid var(--argus-border-strong)',
              color: 'var(--argus-dim)',
            }}
          >
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="relative p-2 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          style={{ color: 'var(--argus-muted)' }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--argus-ink)'; e.currentTarget.style.background = 'var(--argus-chrome-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--argus-muted)'; e.currentTarget.style.background = 'transparent'; }}
        >
          {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Notifications */}

        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="relative p-2 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            style={{ color: 'var(--argus-muted)' }}
            aria-label="Notifications"
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--argus-ink)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--argus-muted)'; }}
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[9px] font-bold text-ink leading-none"
                style={{
                  background: '#DC2626',
                  boxShadow: '0 0 0 2px var(--argus-chrome)',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-12 w-[min(20rem,calc(100vw-1.5rem))] sm:w-80 rounded-xl overflow-hidden animate-fade-in"
              style={{
                background: 'var(--argus-chrome)',
                border: '1px solid var(--argus-border-strong)',
                boxShadow: 'var(--argus-panel-shadow)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--argus-border)' }}
              >
                <h3 className="text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>
                  Notifications
                  {unreadCount > 0 && (
                    <span
                      className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        color: 'var(--argus-crimson)',
                        background: 'rgba(220,38,38,0.12)',
                        border: '1px solid rgba(220,38,38,0.2)',
                      }}
                    >
                      {unreadCount} new
                    </span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead.mutate()}
                    className="flex items-center gap-1 text-[11px] font-medium transition-colors"
                    style={{ color: 'var(--argus-signal)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--argus-ink)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--argus-signal)'; }}
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs" style={{ color: 'var(--argus-dim)' }}>
                    <Bell className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--argus-dim)' }} />
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 15).map((n) => (
                    <NotifItem
                      key={n.id}
                      notification={n}
                      onRead={(id) => { markAsRead.mutate(id); }}
                      onNavigate={() => setNotifOpen(false)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 p-1 rounded-lg transition-all"
            style={{ background: profileOpen ? 'var(--argus-chrome-hover)' : 'transparent' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-ink"
              style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                boxShadow: '0 0 8px rgba(79,70,229,0.3)',
              }}
            >
              {initials}
            </div>
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-12 w-56 rounded-xl p-2 animate-fade-in"
              style={{
                background: 'var(--argus-chrome)',
                border: '1px solid var(--argus-border-strong)',
                boxShadow: 'var(--argus-panel-shadow)',
              }}
            >
              <div
                className="px-3 py-2 mb-1"
                style={{ borderBottom: '1px solid var(--argus-border)' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--argus-ink)' }}>{displayName}</p>
                <p className="text-[11px] font-mono" style={{ color: 'var(--argus-dim)' }}>{displayRole}</p>
              </div>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all text-left"
                style={{ color: 'var(--argus-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--argus-ink)';
                  e.currentTarget.style.background = 'var(--argus-chrome-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--argus-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <User className="w-4 h-4" /> Profile
              </button>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all text-left"
                style={{ color: 'var(--argus-crimson)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(220,38,38,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
      </div>{/* /header row */}

      {/* ── Search Overlay ── */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] sm:pt-[15vh] px-3 sm:px-4"
          onClick={() => setSearchOpen(false)}
          style={{ background: 'var(--argus-overlay)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="relative w-full max-w-xl overflow-hidden animate-slide-in"
            style={{
              background: 'var(--argus-chrome)',
              border: '1px solid var(--argus-border-strong)',
              borderRadius: '16px',
              boxShadow: 'var(--argus-panel-shadow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Row */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid var(--argus-border)' }}
            >
              <Search className="w-5 h-5 shrink-0" style={{ color: 'var(--argus-signal)' }} />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search incidents, changes, assets..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{
                  color: 'var(--argus-ink)',
                }}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.setProperty(
                    '--tw-placeholder-color',
                    '#94A3B8'
                  );
                }}
              />
              <kbd
                className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{
                  background: 'var(--argus-chrome-hover)',
                  border: '1px solid var(--argus-border-strong)',
                  color: 'var(--argus-dim)',
                }}
              >
                ESC
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {/* Empty state */}
              {!searchQuery && (
                <div className="p-4 text-sm text-center" style={{ color: 'var(--argus-dim)' }}>
                  Type to search across all modules
                </div>
              )}

              {/* Loading */}
              {searchQuery && searchLoading && (
                <div className="p-6 flex flex-col items-center gap-2" style={{ color: 'var(--argus-muted)' }}>
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--argus-signal)' }} />
                  <span className="text-sm">Searching for "{searchQuery}"...</span>
                </div>
              )}

              {/* Results */}
              {searchQuery && !searchLoading && results && hasResults && (
                <div className="py-2">
                  {resultGroups.map(group => {
                    const items: SearchResultItem[] = results[group.key as keyof typeof results] || [];
                    if (!items.length) return null;
                    return (
                      <div key={group.key}>
                        <div
                          className="px-4 py-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em]"
                          style={{ color: 'var(--argus-dim)' }}
                        >
                          {group.icon}
                          {group.label}
                          <span className="font-mono">({items.length})</span>
                        </div>
                        {items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleResultClick(group.route, item.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group"
                            style={{ color: 'var(--argus-ink)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(79,70,229,0.08)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-xs font-mono font-semibold"
                                  style={{ color: 'var(--argus-signal)' }}
                                >
                                  {getResultNumber(item)}
                                </span>
                                {item.priority && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={
                                      item.priority === 'P1'
                                        ? { color: 'var(--argus-crimson)', background: 'rgba(220,38,38,0.12)' }
                                        : item.priority === 'P2'
                                        ? { color: '#FB923C', background: 'rgba(234,88,12,0.12)' }
                                        : item.priority === 'P3'
                                        ? { color: '#FBB040', background: 'rgba(217,119,6,0.12)' }
                                        : { color: 'var(--argus-signal)', background: 'rgba(79,70,229,0.12)' }
                                    }
                                  >
                                    {item.priority}
                                  </span>
                                )}
                                {item.severity && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={
                                      item.severity === 'critical'
                                        ? { color: 'var(--argus-crimson)', background: 'rgba(220,38,38,0.12)' }
                                        : item.severity === 'high'
                                        ? { color: '#FB923C', background: 'rgba(234,88,12,0.12)' }
                                        : item.severity === 'medium'
                                        ? { color: '#FBB040', background: 'rgba(217,119,6,0.12)' }
                                        : { color: 'var(--argus-signal)', background: 'rgba(79,70,229,0.12)' }
                                    }
                                  >
                                    {item.severity}
                                  </span>
                                )}
                                {item.status && (
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                    style={{
                                      color: 'var(--argus-muted)',
                                      background: 'var(--argus-chrome-hover)',
                                      border: '1px solid var(--argus-border-strong)',
                                    }}
                                  >
                                    {item.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--argus-muted)' }}>
                                {getResultTitle(item)}
                              </p>
                            </div>
                            <ChevronRight
                              className="w-3.5 h-3.5 flex-shrink-0 transition-colors"
                              style={{ color: 'var(--argus-dim)' }}
                            />
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* No results */}
              {searchQuery && !searchLoading && results && !hasResults && (
                <div className="p-6 flex flex-col items-center gap-2" style={{ color: 'var(--argus-dim)' }}>
                  <Search className="w-5 h-5" style={{ color: 'var(--argus-dim)' }} />
                  <span className="text-sm" style={{ color: 'var(--argus-muted)' }}>
                    No results found for "{searchQuery}"
                  </span>
                  <span className="text-xs" style={{ color: 'var(--argus-dim)' }}>
                    Try a different search term
                  </span>
                </div>
              )}

              {/* Min length hint */}
              {searchQuery && searchQuery.length < 2 && !searchLoading && !results && (
                <div className="p-4 text-sm text-center" style={{ color: 'var(--argus-dim)' }}>
                  Type at least 2 characters to search
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
