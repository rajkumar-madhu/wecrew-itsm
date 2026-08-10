import { create } from 'zustand';

interface UINotification {
  id: string; title: string; message: string;
  type: 'info' | 'warning' | 'error' | 'success'; read: boolean; timestamp: string; link?: string;
}

interface UIState {
  sidebarCollapsed: boolean;
  globalSearchOpen: boolean;
  commandPaletteOpen: boolean;
  notifications: UINotification[];
  toggleSidebar: () => void;
  toggleGlobalSearch: () => void;
  setGlobalSearchOpen: (open: boolean) => void;
  addNotification: (n: Omit<UINotification, 'id' | 'read' | 'timestamp'>) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false, globalSearchOpen: false, commandPaletteOpen: false, notifications: [],
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleGlobalSearch: () => set((s) => ({ globalSearchOpen: !s.globalSearchOpen })),
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
  addNotification: (n) => set((s) => ({
    notifications: [{ ...n, id: Date.now().toString(36) + Math.random().toString(36).slice(2), read: false, timestamp: new Date().toISOString() }, ...s.notifications],
  })),
  markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n) })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clearNotifications: () => set({ notifications: [] }),
}));
