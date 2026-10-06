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

export interface MfaChallenge { mfaRequired: true; mfaToken: string }

/** POST to a public auth endpoint; throws the API's message on failure. */
async function postAuth(path: string, body: unknown) {
  const res = await fetch(`/api/v1/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status === 429 ? 'Too many attempts. Wait a few minutes and try again.'
      : payload?.details?.[0]?.msg || payload?.error || 'Login failed';
    throw new Error(msg);
  }
  return payload;
}

interface AuthState {
  user: User | null; token: string | null; refreshToken: string | null;
  organization: Organization | null;
  selectedOrgId: string | null; // Admin org filter
  isAuthenticated: boolean; isLoading: boolean;
  /** Resolves to a challenge when the account has two-factor on; finish with verifyMfa. */
  login: (email: string, password: string) => Promise<MfaChallenge | void>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  /** Trade the one-time token from the Keycloak redirect for a session. */
  ssoExchange: (handoff: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API envelope
  completeLogin: (payload: any) => void;
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
          const payload = await postAuth('login', { email, password });
          if (payload?.data?.mfaRequired) {
            set({ isLoading: false });
            return { mfaRequired: true, mfaToken: payload.data.mfaToken };
          }
          get().completeLogin(payload);
        } catch (err) {
          set({ isLoading: false, isAuthenticated: false });
          throw new Error((err as Error)?.message || 'Invalid credentials');
        }
      },
      verifyMfa: async (mfaToken, code) => {
        set({ isLoading: true });
        try {
          get().completeLogin(await postAuth('mfa/verify', { mfaToken, code }));
        } catch (err) {
          set({ isLoading: false, isAuthenticated: false });
          throw err;
        }
      },
      ssoExchange: async (handoff) => {
        set({ isLoading: true });
        try {
          get().completeLogin(await postAuth('sso/exchange', { handoff }));
        } catch (err) {
          set({ isLoading: false, isAuthenticated: false });
          throw err;
        }
      },
      completeLogin: (payload) => {
        if (!payload?.data?.accessToken) throw new Error('Login failed: no token returned');
        set({
          user: payload.data.user,
          token: payload.data.accessToken,
          refreshToken: payload.data.refreshToken,
          organization: payload.data.organization || null,
          selectedOrgId: payload.data.user?.organizationId || null,
          isAuthenticated: true,
          isLoading: false,
        });
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
