// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — useAuth Hook
// Ergonomic wrapper over authStore + TanStack Query mutations
// for profile update and password change.
// ═══════════════════════════════════════════════════════════

import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

// ── Main selector hook ────────────────────────────────────

export function useAuth() {
  const store = useAuthStore();
  const role = store.user?.role ?? '';

  const isAdmin    = role === 'ADMIN';
  // Cross-organization powers (tenant management, org switching) need this,
  // not just role ADMIN: self-registered trial owners are ADMINs of one org.
  const isPlatformAdmin = isAdmin && store.user?.isPlatformAdmin === true;
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
    isPlatformAdmin,
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
