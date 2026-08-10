import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { disconnectSocket } from '../lib/socket';
import { queryClient } from '../lib/queryClient';

interface Organization {
  id: string;
  name: string;
  slug: string;
  environment: string;
  fqdn: string | null;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  status: string | null;
  department: string | null;
  jobTitle: string | null;
  timezone: string | null;
  mfaEnabled: boolean;
  organizationId: string | null;
  lastLogin: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface AuthState {
  user: User | null; token: string | null; refreshToken: string | null;
  organization: Organization | null;
  selectedOrgId: string | null; // Admin org filter
  isAuthenticated: boolean; isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setSelectedOrg: (orgId: string | null) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null, token: null, refreshToken: null, organization: null, selectedOrgId: null,
      isAuthenticated: false, isLoading: true, // true until rehydrate + checkAuth
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const cleanEmail = String(email || '').trim().toLowerCase();
          const res = await fetch('/api/v1/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            const detail = payload?.details?.[0];
            let msg = payload?.error || detail?.msg || 'Login failed';
            if (detail?.path === 'email' || /invalid value/i.test(msg) || msg === 'Validation failed') {
              msg = 'Enter a valid email address (e.g. support@wecrew.in)';
            } else if (msg === 'Invalid credentials') {
              msg = 'Invalid email or password. Use your full email, not a username.';
            }
            throw new Error(msg);
          }
          if (!payload?.data?.accessToken) {
            throw new Error('Login failed: no token returned');
          }
          set({
            user: payload.data.user,
            token: payload.data.accessToken,
            refreshToken: payload.data.refreshToken,
            organization: payload.data.organization || null,
            selectedOrgId: payload.data.user?.organizationId || null,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err: any) {
          set({ isLoading: false, isAuthenticated: false });
          throw new Error(err?.message || 'Invalid credentials');
        }
      },
      logout: () => {
        const { token } = get();
        if (token) fetch('/api/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
        disconnectSocket();
        queryClient.clear();
        set({ user: null, token: null, refreshToken: null, organization: null, selectedOrgId: null, isAuthenticated: false, isLoading: false });
      },
      setUser: (user) => set({ user, isAuthenticated: true }),
      setTokens: (token, refreshToken) => set({ token, refreshToken, isAuthenticated: !!token }),
      setSelectedOrg: (orgId) => set({ selectedOrgId: orgId }),
      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null, isLoading: false });
          return;
        }
        set({ isLoading: true });
        try {
          const res = await fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error();
          const data = await res.json();
          set({
            user: data.data,
            organization: data.data.organization || null,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Keep tokens only if network blip? Prefer clear on 401
          set({ user: null, token: null, refreshToken: null, organization: null, selectedOrgId: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'wecrew-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        selectedOrgId: state.selectedOrgId,
        organization: state.organization,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Migrate old auth key if present
        try {
          const legacy = localStorage.getItem('linkedeye-auth');
          if (legacy && !localStorage.getItem('wecrew-auth')) {
            localStorage.setItem('wecrew-auth', legacy);
            localStorage.removeItem('linkedeye-auth');
          }
        } catch {}
        // After localStorage rehydrate, validate token with API
        if (state?.token) {
          // Defer so store is fully ready
          setTimeout(() => {
            useAuthStore.getState().checkAuth();
          }, 0);
        } else if (state) {
          state.isLoading = false;
          useAuthStore.setState({ isLoading: false });
        }
      },
    }
  )
);
