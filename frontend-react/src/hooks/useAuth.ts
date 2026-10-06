// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — useAuth Hook
// Ergonomic wrapper over authStore + TanStack Query mutations
// for profile update and password change.
// ═══════════════════════════════════════════════════════════

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

// ── Main selector hook ────────────────────────────────────

export function useAuth() {
  const store = useAuthStore();
  const role = store.user?.role ?? '';

  const isAdmin    = role === 'ADMIN';
  const isManager  = role === 'MANAGER' || isAdmin;
  const isEngineer = role === 'ENGINEER' || isManager;

  function hasRole(...roles: string[]): boolean {
    return roles.includes(role);
  }

  /**
   * Returns true if the current user may create/edit the given resource.
   * Viewers and operators are read-only.
   */
  function canManage(resource: 'incidents' | 'changes' | 'problems' | 'assets' | 'teams'): boolean {
    if (isAdmin) return true;
    if (isManager) return true;
    if (role === 'ENGINEER' && (resource === 'incidents' || resource === 'problems')) return true;
    if (role === 'OPERATOR' && resource === 'incidents') return true;
    return false;
  }

  return {
    ...store,
    role,
    isAdmin,
    isManager,
    isEngineer,
    hasRole,
    canManage,
  };
}

// ── Profile update ────────────────────────────────────────

interface ProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  department?: string;
  timezone?: string;
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      const { data } = await api.put('/auth/me', input);
      return data.data;
    },
    onSuccess: (user) => {
      setUser(user);
      toast.success('Profile updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Failed to update profile');
    },
  });
}

// ── Change password ───────────────────────────────────────

interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const { data } = await api.post('/auth/change-password', input);
      return data;
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Failed to change password');
    },
  });
}

// ── Two-factor authentication ─────────────────────────────

export interface MfaSetup { secret: string; otpauthUrl: string }

// MfaSettings shows these errors inline; a no-op onError keeps the global
// mutation toast from repeating them.
const inlineErrors = () => {};

/** Starts enrolment; the secret isn't active until useEnableMfa confirms a code. */
export function useSetupMfa() {
  return useMutation({
    mutationFn: async (): Promise<MfaSetup> => {
      const { data } = await api.post('/auth/mfa/setup');
      return data.data;
    },
    onError: inlineErrors,
  });
}

function setStoredMfaEnabled(mfaEnabled: boolean) {
  const { user, setUser } = useAuthStore.getState();
  if (user) setUser({ ...user, mfaEnabled });
}

export function useEnableMfa() {
  return useMutation({
    mutationFn: async (code: string) => { await api.post('/auth/mfa/enable', { code }); },
    onSuccess: () => {
      setStoredMfaEnabled(true);
      toast.success('Two-factor authentication is on');
    },
    onError: inlineErrors,
  });
}

export function useDisableMfa() {
  return useMutation({
    mutationFn: async (input: { password: string; code: string }) => { await api.post('/auth/mfa/disable', input); },
    onSuccess: () => {
      setStoredMfaEnabled(false);
      toast.success('Two-factor authentication is off');
    },
    onError: inlineErrors,
  });
}

/** ADMIN: clear another user's two-factor (lost phone). Also signs them out. */
export function useResetUserMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => { await api.delete(`/auth/users/${userId}/mfa`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Two-factor reset. They can sign in with their password and set it up again.');
    },
  });
}
