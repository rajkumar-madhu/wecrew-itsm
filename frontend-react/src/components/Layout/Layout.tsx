import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import Sidebar from './Sidebar';
import Header from './Header';
import { useRealtime } from '../../hooks/useRealtime';

export default function Layout() {
  useRealtime();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="app-shell min-h-screen bg-void text-ink"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 15% -10%, rgba(99,102,241,0.12) 0%, transparent 45%), radial-gradient(ellipse at 90% 10%, rgba(34,211,238,0.06) 0%, transparent 40%)',
      }}
    >
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={clsx('transition-all duration-300', collapsed ? 'ml-[68px]' : 'ml-[240px]')}>
        <Header />
        <main className="p-6 min-h-[calc(100vh-3.5rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
