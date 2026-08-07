import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronDown, Check, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

interface Org {
  id: string;
  name: string;
  slug: string;
  environment: string;
  isActive: boolean;
  _count?: { users: number; incidents: number };
}

const envColors: Record<string, string> = {
  PROD: 'bg-emerald-500/20 text-emerald-400',
  DR: 'bg-amber-500/20 text-amber-400',
  UAT: 'bg-sky-500/20 text-sky-400',
  DEV: 'bg-violet-500/20 text-violet-400',
};

export default function OrgSwitcher() {
  const user = useAuthStore((s) => s.user);
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const setSelectedOrg = useAuthStore((s) => s.setSelectedOrg);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function switchOrg(id: string | null) {
    setSelectedOrg(id);
    setOpen(false);
    // Flush all org-scoped query caches so every page re-fetches for the new org
    qc.invalidateQueries({ predicate: (q) => !q.queryKey.includes('organizations') });
  }
  const isSuperAdmin = user?.role === 'ADMIN' && !user?.organizationId;

  const { data } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await api.get('/organizations?limit=50');
      return data;
    },
    staleTime: 120000,
    enabled: isSuperAdmin,
  });

  const orgs: Org[] = data?.data || [];
  const selected = orgs.find((o) => o.id === selectedOrgId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Only show for ADMIN users
  if (!isSuperAdmin) return null;

  return (
    <div ref={ref} className="relative px-3 mb-2">
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border',
          'bg-[#1E293B]/50 border-[#334155] text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white'
        )}
      >
        <Building2 size={14} className="text-indigo-400 shrink-0" />
        <span className="truncate flex-1 text-left">
          {selected ? selected.name : 'All Organizations'}
        </span>
        {selected && (
          <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase', envColors[selected.environment] || 'bg-stone-500/20 text-stone-400')}>
            {selected.environment}
          </span>
        )}
        <ChevronDown size={12} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-[#0F172A] border border-[#334155] rounded-xl shadow-2xl max-h-[400px] overflow-y-auto">
          {/* All orgs option */}
          <button
            onClick={() => switchOrg(null)}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors border-b border-[#1E293B]',
              !selectedOrgId ? 'bg-indigo-500/10 text-indigo-300' : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
            )}
          >
            <Globe size={13} />
            <span className="flex-1 text-left font-medium">All Organizations</span>
            {!selectedOrgId && <Check size={13} className="text-indigo-400" />}
          </button>

          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => switchOrg(org.id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors',
                selectedOrgId === org.id ? 'bg-indigo-500/10 text-indigo-300' : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
              )}
            >
              <Building2 size={12} className="shrink-0 opacity-50" />
              <span className="flex-1 text-left truncate">{org.name}</span>
              <span className={clsx('px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0', envColors[org.environment] || 'bg-stone-500/20 text-stone-400')}>
                {org.environment}
              </span>
              {selectedOrgId === org.id && <Check size={12} className="text-indigo-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
