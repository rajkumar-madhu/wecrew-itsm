import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { COMPANY, FOOTER_COLUMNS, NAV, PILOT_DAYS } from './site';

/*
  Shell for the public marketing routes (/, /itsm, /modules, /security, /pilot,
  /contact).

  Deliberately NOT wrapped in `.app-shell`: the light-mode compatibility shim at
  the bottom of index.css is scoped to that class and force-inks h1-h4 and
  .text-white. Staying outside it means these pages get the brand tokens
  straight, and the `cx-hero` dark panel needs no opt-out rules.
*/

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label={`${COMPANY.name} home`}>
      <span
        className="grid h-7 w-7 place-items-center rounded-sm text-[11px] font-bold tracking-wide text-white"
        style={{ background: 'var(--brand-coral)' }}
        aria-hidden
      >
        WC
      </span>
      <span className="leading-none">
        <span className="block font-display text-[16px] font-semibold tracking-tight text-ink">{COMPANY.name}</span>
        <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">ITSM</span>
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="grid h-8 w-8 place-items-center rounded border border-steel text-muted transition-colors hover:text-ink"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
    </button>
  );
}

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Each public page starts at the top. Only the scroll position is synced
  // here — the mobile menu closes from its own link handlers, because setting
  // state inside this effect would queue a second render on every navigation.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const closeMenu = () => setMenuOpen(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'text-[13px] font-medium transition-colors',
      isActive ? 'text-ink' : 'text-muted hover:text-ink'
    );

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col overflow-x-hidden bg-void font-body text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-obsidian focus:px-3 focus:py-2 focus:text-[13px] focus:text-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-steel bg-void/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark />

          <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary">
            {NAV.filter((item) => !item.footerOnly).map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            <Link to="/login" className="cx-btn cx-btn--ghost">
              Sign in
            </Link>
            <Link to="/pilot" className="cx-btn cx-btn--primary">
              Start {PILOT_DAYS}-day pilot
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded border border-steel text-muted lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={17} strokeWidth={1.75} /> : <Menu size={17} strokeWidth={1.75} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-steel bg-obsidian lg:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6" aria-label="Primary">
              {NAV.filter((item) => !item.footerOnly).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'rounded px-2 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-slate text-ink' : 'text-muted hover:text-ink'
                    )
                  }
                  onClick={closeMenu}
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-2 flex items-center gap-2 border-t border-steel pt-3">
                <ThemeToggle />
                <Link to="/login" className="cx-btn cx-btn--ghost flex-1" onClick={closeMenu}>
                  Sign in
                </Link>
                <Link to="/pilot" className="cx-btn cx-btn--primary flex-1" onClick={closeMenu}>
                  Start pilot
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-steel bg-obsidian">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Wordmark />
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted">{COMPANY.tagline}</p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="cx-eyebrow">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-[13px] text-muted transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="cx-eyebrow">Contact</p>
            <ul className="mt-3 space-y-2 text-[13px] text-muted">
              <li>
                <a href={`mailto:${COMPANY.email}`} className="transition-colors hover:text-ink">
                  {COMPANY.email}
                </a>
              </li>
              <li>
                <a href={`mailto:${COMPANY.supportEmail}`} className="transition-colors hover:text-ink">
                  {COMPANY.supportEmail}
                </a>
              </li>
              {COMPANY.phone && (
                <li>
                  <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="transition-colors hover:text-ink">
                    {COMPANY.phone}
                  </a>
                </li>
              )}
              <li>{COMPANY.hours}</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-steel">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-[12px] text-dim sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
            </p>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em]">
              Self-hosted · Customer-controlled data
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
