import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import Sidebar from './Sidebar';
import Header from './Header';
import { useRealtime } from '../../hooks/useRealtime';

const MOBILE_BP = 1024;

export default function Layout() {
  useRealtime();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BP : false
  );

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < MOBILE_BP;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen, isMobile]);

  return (
    <div className="app-shell min-h-screen min-h-[100dvh] bg-void text-ink">
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'var(--argus-overlay)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={isMobile ? false : collapsed}
        onToggle={() => {
          if (isMobile) setMobileOpen((v) => !v);
          else setCollapsed((v) => !v);
        }}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        onNavigate={() => setMobileOpen(false)}
      />

      <div
        className={clsx(
          'transition-[margin] duration-200 min-h-screen min-h-[100dvh] flex flex-col',
          isMobile ? 'ml-0' : collapsed ? 'ml-[56px]' : 'ml-[240px]'
        )}
      >
        <Header
          onMenuClick={() => setMobileOpen(true)}
          showMenuButton={isMobile}
        />
        <main className="flex-1 px-3 py-3 md:px-4 md:py-4 min-h-0 w-full max-w-[100vw] overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
