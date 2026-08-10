import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  // Browser chrome (mobile address bar)
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0E1116' : '#F4F1EA');
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },
    }),
    {
      name: 'wecrew-theme',
      partialize: (s) => ({ theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme === 'dark' ? 'dark' : 'light');
      },
    }
  )
);

/** Call once at app boot (before paint if possible). */
export function initTheme() {
  try {
    const raw = localStorage.getItem('wecrew-theme');
    if (raw) {
      const parsed = JSON.parse(raw);
      const theme: ThemeMode = parsed?.state?.theme === 'dark' ? 'dark' : 'light';
      applyTheme(theme);
      return;
    }
  } catch {
    /* ignore */
  }
  applyTheme('light');
}
