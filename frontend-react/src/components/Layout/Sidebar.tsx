import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, ChevronDown, Eye, LogOut, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import OrgSwitcher from './OrgSwitcher';
import { NAV_HUBS, ADMIN_HUB, visibleItems, hubForPath } from './navigation';
import type { NavHub, NavItem } from './navigation';
import { useUIStore } from '../../stores/uiStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// Sidebar palette: on #07101E these keep text ≥ 4.5:1 and icons ≥ 3:1 (WCAG AA)
const C = {
  text: '#9DB3C8',
  textHover: '#D5E3F0',
  icon: '#7590A9',
  label: '#7F97AD',
  active: '#E2EEF9',
};

const TOGGLES_KEY = 'argus-nav-hubs';

// Explicit open/closed choices per hub; hubs without a choice follow the current page
function loadToggles(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(TOGGLES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

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

  const { pathname } = useLocation();
  const activeHub = hubForPath(pathname);
  const [toggles, setToggles] = useState<Record<string, boolean>>(loadToggles);
  const openPalette = useUIStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    try { localStorage.setItem(TOGGLES_KEY, JSON.stringify(toggles)); } catch { /* storage blocked */ }
  }, [toggles]);

  // The hub holding the current page is open unless the user closed it
  const isOpen = (id: string) => toggles[id] ?? id === activeHub;
  const toggleHub = (id: string) => setToggles((t) => ({ ...t, [id]: !isOpen(id) }));

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

      {/* ── Quick search ── */}
      <div className="px-2.5 pt-3 relative z-10">
        <button
          type="button"
          onClick={() => openPalette(true)}
          aria-label="Search and jump to (Ctrl+K)"
          className={clsx(
            'w-full flex items-center gap-2 rounded-xl text-[12px] transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#818CF8]',
            collapsed ? 'justify-center py-2' : 'px-3 py-2'
          )}
          style={{ color: C.text, border: '1px solid rgba(99,179,255,0.12)' }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: C.icon }} aria-hidden="true" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search or jump to…</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: C.label, border: '1px solid rgba(99,179,255,0.16)' }}>Ctrl K</kbd>
            </>
          )}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1 scrollbar-thin relative z-10">
        {NAV_HUBS.map((hub) => (
          <HubSection key={hub.id} hub={hub} role={userRole} collapsed={collapsed}
            open={isOpen(hub.id)} active={activeHub === hub.id} onToggle={() => toggleHub(hub.id)} />
        ))}
        <div className="h-px mx-2 my-2" style={{ background: 'rgba(99,179,255,0.08)' }} />
        <HubSection hub={ADMIN_HUB} role={userRole} collapsed={collapsed}
          open={isOpen(ADMIN_HUB.id)} active={activeHub === ADMIN_HUB.id} onToggle={() => toggleHub(ADMIN_HUB.id)} />
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
              <p className="text-[10px] font-mono" style={{ color: C.label }}>
                {user.role}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); logout(); }}
              className="p-1.5 rounded-md transition-colors"
              title="Sign out"
              aria-label="Sign out"
              style={{ color: C.icon }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#FF4D6A';
                e.currentTarget.style.background = 'rgba(255,77,106,0.10)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = C.icon;
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
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-all duration-150"
          style={{ color: C.icon }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = C.textHover;
            e.currentTarget.style.background = 'rgba(99,179,255,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = C.icon;
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

// ── Hub (collapsible group) ───────────────────────────────

function HubSection({ hub, role, collapsed, open, active, onToggle }: {
  hub: NavHub; role: string; collapsed: boolean; open: boolean; active: boolean; onToggle: () => void;
}) {
  const items = visibleItems(hub, role);
  if (items.length === 0) return null;
  const listId = `nav-hub-${hub.id}`;

  // Collapsed rail: one icon per hub that links to its first page
  if (collapsed) {
    return (
      <NavLink to={items[0].to} title={hub.label} aria-label={hub.label}
        className="flex justify-center py-2 rounded-xl transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#818CF8]"
        style={active ? { background: 'rgba(79,70,229,0.14)' } : undefined}>
        <hub.icon className="w-[18px] h-[18px]" style={{ color: active ? '#A5B4FC' : C.icon }} aria-hidden="true" />
      </NavLink>
    );
  }

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={listId}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#818CF8]"
        style={{ color: active ? C.active : C.text }}>
        <hub.icon className="w-[17px] h-[17px] shrink-0" style={{ color: active ? '#A5B4FC' : C.icon }} aria-hidden="true" />
        <span className="flex-1 text-left">{hub.label}</span>
        <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', open ? 'rotate-0' : '-rotate-90')} style={{ color: C.icon }} aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} className="mt-0.5 mb-1 space-y-0.5 pl-3">
          {items.map((item) => <li key={item.to}><NavRow item={item} /></li>)}
        </ul>
      )}
    </div>
  );
}

function NavRow({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} end={item.end}
      className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#818CF8]">
      {({ isActive }) => (
        <div
          className={clsx('flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors relative', !isActive && 'hover:bg-white/[0.04]')}
          style={isActive ? { background: 'rgba(79,70,229,0.16)', color: C.active } : { color: C.text }}
        >
          {isActive && (
            <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full" style={{ background: '#818CF8' }} />
          )}
          <item.icon className="w-4 h-4 shrink-0" style={{ color: isActive ? '#A5B4FC' : C.icon }} aria-hidden="true" />
          <span className="truncate flex-1">{item.label}</span>
          {item.badge && (
            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded" style={getBadgeStyle(item.badge)}>
              {item.badge}
            </span>
          )}
          {isActive && <span className="sr-only">(current page)</span>}
        </div>
      )}
    </NavLink>
  );
}
